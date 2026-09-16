import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { Loader2, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  getClusterVersion,
  listClusterVersions,
  prepareSupplementalIntake,
  validateSupplementalClassificationPath,
  type SupplementalClassificationPathNode,
  type SupplementalIntakeMode,
} from "@/features/upload/api/sessionApi"
import type { PlanCriterionSet, PlanGroup } from "@/features/upload/types"
import {
  versionToGroups,
  type ClusterGroup,
} from "@/features/upload/lib/clusterGroups"
import { cn } from "@/shared/lib/utils"
import {
  cleanSupplementalDossierMetadata,
  flattenSupplementalClassificationTargets,
  isSupplementalYearLevel,
  sanitizeSupplementalGroupName,
  selectedSupplementalClassificationLeaf,
  supplementalClassificationPathFromChoices,
  supplementalClassificationLevels,
  supplementalExistingOptionsForNewPath,
  supplementalNewPathLevels,
  updateSupplementalClassificationSelection,
  type SupplementalNewPathChoice,
  type SupplementalClassificationTarget,
} from "./SupplementalIntakeUploadSection.logic"

interface SupplementalIntakeUploadSectionProps {
  sessionId: string | null
  activeClusterVersionId: string | null
  activePlanVersionId: string | null
  classificationGroups: PlanGroup[]
  classificationCriteria: PlanCriterionSet[]
  initialDossierGroups: ClusterGroup[]
  disabled?: boolean
}

export interface SupplementalIntakeUploadHandle {
  prepareIntake: () => Promise<string>
}

export const SupplementalIntakeUploadSection = forwardRef<
  SupplementalIntakeUploadHandle,
  SupplementalIntakeUploadSectionProps
>(function SupplementalIntakeUploadSection(
  {
    sessionId,
    activeClusterVersionId,
    activePlanVersionId,
    classificationGroups,
    classificationCriteria,
    initialDossierGroups,
    disabled = false,
  },
  ref
) {
  const [mode, setMode] = useState<SupplementalIntakeMode>("existing_dossier")
  const [dossierGroups, setDossierGroups] =
    useState<ClusterGroup[]>(initialDossierGroups)
  const [dossierId, setDossierId] = useState("")
  const [selectedClassificationIds, setSelectedClassificationIds] = useState<
    string[]
  >([])
  const [workingClusterVersionId, setWorkingClusterVersionId] = useState<
    string | null
  >(null)
  const [newPathChoices, setNewPathChoices] = useState<
    SupplementalNewPathChoice[]
  >([])
  const [title, setTitle] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [retentionPeriod, setRetentionPeriod] = useState("")
  const [note, setNote] = useState("")
  const [loadingTargets, setLoadingTargets] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [submitError, setSubmitError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!sessionId) {
      const resetTimer = window.setTimeout(() => {
        setWorkingClusterVersionId(null)
        setDossierGroups([])
      }, 0)
      return () => window.clearTimeout(resetTimer)
    }
    let cancelled = false
    const loadingTimer = window.setTimeout(() => {
      if (cancelled) return
      setLoadingTargets(true)
      setLoadError("")
      setWorkingClusterVersionId(null)
      setDossierGroups([])
    }, 0)
    void listClusterVersions(sessionId)
      .then(async (versionList) => {
        const currentVersionId =
          versionList.working_cluster_version_id ??
          versionList.draft_cluster_version_id ??
          versionList.active_cluster_version_id ??
          activeClusterVersionId ??
          null
        if (cancelled) return
        setWorkingClusterVersionId(currentVersionId)
        if (!currentVersionId) {
          setDossierGroups([])
          return
        }
        const version = await getClusterVersion(sessionId, currentVersionId, {
          includeClusters: true,
        })
        if (!cancelled) setDossierGroups(versionToGroups(version, []))
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(errorMessage(error))
      })
      .finally(() => {
        if (!cancelled) setLoadingTargets(false)
      })
    return () => {
      cancelled = true
      window.clearTimeout(loadingTimer)
    }
  }, [activeClusterVersionId, reloadKey, sessionId])

  const dossiers = useMemo(
    () =>
      dossierGroups.filter(
        (group) =>
          !group.isTemporary &&
          !group.isPendingDossier &&
          !group.isTransferPending &&
          Boolean(group.dossierId ?? group.id)
      ),
    [dossierGroups]
  )
  const classificationTargets = useMemo(() => {
    const fromPlan =
      flattenSupplementalClassificationTargets(classificationGroups)
    return fromPlan.length > 0 ? fromPlan : targetsFromDossiers(dossiers)
  }, [classificationGroups, dossiers])
  const classificationLevels = supplementalClassificationLevels(
    classificationTargets,
    selectedClassificationIds
  )
  const selectedLeaf = selectedSupplementalClassificationLeaf(
    classificationTargets,
    selectedClassificationIds
  )
  const newPathLevels = useMemo(
    () =>
      supplementalNewPathLevels(classificationGroups, classificationCriteria),
    [classificationCriteria, classificationGroups]
  )
  const newPath = supplementalClassificationPathFromChoices(
    newPathLevels,
    newPathChoices
  )
  const newPathComplete =
    newPathLevels.length > 0 &&
    newPathLevels.every((level) => {
      const choice = newPathChoices[level.depth]
      return (
        (choice?.kind === "existing" && Boolean(choice.groupId)) ||
        (choice?.kind === "new" && Boolean(choice.name.trim()))
      )
    })
  const newPathHasNewGroup = newPathChoices.some(
    (choice) => choice.kind === "new" && Boolean(choice.name.trim())
  )
  const needsDossier = mode !== "existing_dossier"
  const missingBaseline =
    !sessionId ||
    !activePlanVersionId ||
    (mode === "existing_dossier" && !workingClusterVersionId)

  const prepareIntake = async (): Promise<string> => {
    const validationMessage = intakeValidationMessage({
      sessionId,
      workingClusterVersionId,
      activePlanVersionId,
      disabled,
      loadingTargets,
      submitting,
      mode,
      dossierId,
      title,
      selectedLeaf,
      newPathComplete,
      newPathHasNewGroup,
    })
    if (validationMessage) {
      setSubmitError(validationMessage)
      throw new Error(validationMessage)
    }

    setSubmitting(true)
    setSubmitError("")
    try {
      const common = {
        client_request_id: crypto.randomUUID(),
        ...(workingClusterVersionId
          ? { base_cluster_version_id: workingClusterVersionId }
          : {}),
        intake_mode: mode,
        created_by: "ui",
        ...(note.trim() ? { note: note.trim() } : {}),
      }
      const dossier = cleanSupplementalDossierMetadata({
        title: title.trim(),
        start_date: startDate,
        end_date: endDate,
        retention_period: retentionPeriod,
      }) as Record<string, unknown> & { title: string }
      const classificationPath: SupplementalClassificationPathNode[] = newPath
      if (mode === "new_dossier_new_path") {
        const validation = await validateSupplementalClassificationPath(
          sessionId as string,
          {
            base_plan_version_id: activePlanVersionId as string,
            classification_path: classificationPath,
          }
        )
        if (!validation.valid) {
          throw new Error(
            "Path phân loại này đã tồn tại hoặc đang được một đợt bổ sung khác sử dụng."
          )
        }
      }
      const payload =
        mode === "existing_dossier"
          ? { ...common, target_dossier_id: dossierId }
          : mode === "new_dossier_existing_leaf" && selectedLeaf
            ? {
                ...common,
                target_classification: {
                  plan_version_id: activePlanVersionId as string,
                  group_ids: selectedLeaf.ids,
                },
                dossier,
              }
            : {
                ...common,
                base_plan_version_id: activePlanVersionId as string,
                classification_path: classificationPath,
                dossier,
              }
      const intake = await prepareSupplementalIntake(
        sessionId as string,
        payload
      )
      return intake.intake_id
    } catch (error) {
      const message = errorMessage(error)
      setSubmitError(message)
      throw error instanceof Error ? error : new Error(message)
    } finally {
      setSubmitting(false)
    }
  }

  useImperativeHandle(ref, () => ({ prepareIntake }))

  return (
    <div className="mt-5 border-t border-[#E2E8F0] pt-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-sm font-bold text-[#0F172A]">
            Thông tin bổ sung theo hồ sơ
          </h4>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-[#64748B]">
            Folder PDF đã chọn ở phía trên sẽ được gắn vào đúng hồ sơ hoặc nhóm
            phân loại khai báo dưới đây. Tài liệu mới vẫn là bản nháp cho tới
            khi verify OCR.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loadingTargets || missingBaseline || submitting}
          onClick={() => setReloadKey((value) => value + 1)}
          className="gap-2"
        >
          <RefreshCw
            className={cn("size-4", loadingTargets && "animate-spin")}
          />
          Tải lại dữ liệu đích
        </Button>
      </div>

      {(!sessionId || !activePlanVersionId) && (
        <Notice tone="warning">
          Session phải có phương án phân loại hiện hành trước khi upload bổ sung
          theo hồ sơ.
        </Notice>
      )}
      {sessionId &&
        activePlanVersionId &&
        mode === "existing_dossier" &&
        !workingClusterVersionId && (
          <Notice tone="warning">
            TH1 cần một cluster version hiện hành để xác định hồ sơ đích. Hệ
            thống ưu tiên bản draft đang sửa, nếu không có mới dùng bản active.
          </Notice>
        )}
      {loadError && <Notice tone="error">{loadError}</Notice>}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <Field label="Trường hợp bổ sung">
            <select
              value={mode}
              disabled={disabled || submitting}
              onChange={(event) =>
                setMode(event.target.value as SupplementalIntakeMode)
              }
              className={inputClass}
            >
              <option value="existing_dossier">
                TH1 — Thêm tài liệu vào hồ sơ đã có
              </option>
              <option value="new_dossier_existing_leaf">
                TH2 — Tạo hồ sơ mới trong mục đã có
              </option>
              <option value="new_dossier_new_path">
                TH3 — Tạo hồ sơ mới kèm mục chưa có
              </option>
            </select>
          </Field>

          <p className="text-xs font-semibold tracking-[0.08em] text-[#64748B] uppercase">
            Đích bổ sung
          </p>
          {loadingTargets ? (
            <div className="flex items-center gap-2 rounded-xl bg-[#F8FAFC] p-4 text-sm text-[#64748B]">
              <Loader2 className="size-4 animate-spin text-[#0052FF]" />
              Đang tải hồ sơ và cây phân loại hiện hành...
            </div>
          ) : mode === "existing_dossier" ? (
            <Field label="Hồ sơ đích">
              <select
                value={dossierId}
                onChange={(event) => setDossierId(event.target.value)}
                className={inputClass}
              >
                <option value="">Chọn hồ sơ</option>
                {dossiers.map((group) => (
                  <option
                    key={group.dossierId ?? group.id}
                    value={group.dossierId ?? group.id}
                  >
                    {group.label}
                  </option>
                ))}
              </select>
              {dossiers.length === 0 && (
                <FieldHint>
                  Cluster version hiện hành chưa có hồ sơ phù hợp.
                </FieldHint>
              )}
            </Field>
          ) : mode === "new_dossier_existing_leaf" ? (
            <Field label="Nhóm phân loại cấp nhỏ nhất">
              <div className="space-y-3">
                {classificationLevels.map((level) => (
                  <label key={level.depth} className="block">
                    <span className="mb-1 block text-xs text-[#64748B]">
                      Cấp {level.depth + 1}
                    </span>
                    <select
                      value={selectedClassificationIds[level.depth] ?? ""}
                      onChange={(event) =>
                        setSelectedClassificationIds((current) =>
                          updateSupplementalClassificationSelection(
                            current,
                            level.depth,
                            event.target.value
                          )
                        )
                      }
                      className={inputClass}
                    >
                      <option value="">Chọn nhóm cấp {level.depth + 1}</option>
                      {level.options.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              {classificationTargets.length === 0 && (
                <FieldHint>
                  Phương án hiện tại chưa có nhóm phân loại để lựa chọn.
                </FieldHint>
              )}
              {selectedClassificationIds.length > 0 && !selectedLeaf && (
                <FieldHint>
                  Nhóm đang chọn còn có nhóm con. Vui lòng chọn tiếp tới nhóm
                  nhỏ nhất.
                </FieldHint>
              )}
              {selectedLeaf && (
                <FieldHint>Đã chọn: {selectedLeaf.path.join(" / ")}</FieldHint>
              )}
            </Field>
          ) : (
            <Field label="Nhóm phân loại theo từng cấp">
              <div className="space-y-3">
                {newPathLevels.map((level) => {
                  const choice = newPathChoices[level.depth]
                  const previousChoice =
                    level.depth > 0
                      ? newPathChoices[level.depth - 1]
                      : undefined
                  const previousComplete =
                    level.depth === 0 ||
                    (previousChoice?.kind === "existing" &&
                      Boolean(previousChoice.groupId)) ||
                    (previousChoice?.kind === "new" &&
                      Boolean(previousChoice.name.trim()))
                  const existingOptions = supplementalExistingOptionsForNewPath(
                    classificationTargets,
                    newPathChoices,
                    level.depth
                  )
                  const selectionValue =
                    choice?.kind === "existing"
                      ? `existing:${choice.groupId}`
                      : choice?.kind === "new"
                        ? "__new__"
                        : ""
                  const yearLevel = isSupplementalYearLevel(level.type)
                  return (
                    <div
                      key={level.depth}
                      className="rounded-xl border border-[#D8E1EC] bg-[#F8FAFC] p-3"
                    >
                      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-[#0F172A]">
                            Cấp {level.depth + 1} ·{" "}
                            {supplementalLevelTypeLabel(level.type)}
                          </p>
                          {level.definition && (
                            <p className="mt-0.5 text-xs leading-5 text-[#64748B]">
                              {level.definition}
                            </p>
                          )}
                        </div>
                        {level.criteria.length > 0 && (
                          <div className="flex max-w-full flex-wrap items-center justify-end gap-1">
                            <span className="mr-1 text-[11px] font-semibold text-[#64748B]">
                              Tiêu chí:
                            </span>
                            {level.criteria.map((criterion) => (
                              <span
                                key={criterion}
                                className="rounded-full bg-[#EAF1FF] px-2 py-1 text-[11px] font-medium text-[#174EA6]"
                              >
                                {criterion}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <select
                        value={selectionValue}
                        disabled={disabled || submitting || !previousComplete}
                        onChange={(event) => {
                          const value = event.target.value
                          setNewPathChoices((current) => {
                            const prefix = current.slice(0, level.depth)
                            const nextChoice: SupplementalNewPathChoice =
                              value === "__new__"
                                ? { kind: "new", groupId: "", name: "" }
                                : value.startsWith("existing:")
                                  ? {
                                      kind: "existing",
                                      groupId: value.slice("existing:".length),
                                      name: "",
                                    }
                                  : { kind: "", groupId: "", name: "" }
                            return [...prefix, nextChoice]
                          })
                        }}
                        className={inputClass}
                      >
                        <option value="">Chọn nhóm có sẵn hoặc tự nhập</option>
                        {existingOptions.map((option) => (
                          <option
                            key={option.id}
                            value={`existing:${option.id}`}
                          >
                            {option.name}
                          </option>
                        ))}
                        <option value="__new__">+ Tự nhập nhóm mới</option>
                      </select>
                      {choice?.kind === "new" && (
                        <input
                          value={choice.name}
                          inputMode={yearLevel ? "numeric" : undefined}
                          pattern={yearLevel ? "[0-9]*" : undefined}
                          placeholder={
                            yearLevel
                              ? "Nhập năm, ví dụ: 2025"
                              : `Nhập tên nhóm ${supplementalLevelTypeLabel(level.type).toLowerCase()}`
                          }
                          aria-label={`Tên nhóm mới cấp ${level.depth + 1}`}
                          onChange={(event) => {
                            const name = sanitizeSupplementalGroupName(
                              level.type,
                              event.target.value
                            )
                            setNewPathChoices((current) => {
                              const next = [...current]
                              next[level.depth] = {
                                kind: "new",
                                groupId: "",
                                name,
                              }
                              return next
                            })
                          }}
                          className={cn(inputClass, "mt-2")}
                        />
                      )}
                      {!previousComplete && (
                        <FieldHint>
                          Hoàn tất cấp {level.depth} trước khi chọn cấp này.
                        </FieldHint>
                      )}
                    </div>
                  )
                })}
              </div>
              {newPathLevels.length === 0 ? (
                <FieldHint>
                  Phương án active chưa có cấu trúc cấp phân loại để khai báo.
                </FieldHint>
              ) : (
                <FieldHint>
                  Chọn nhóm đã có hoặc tự nhập ngay tại từng cấp. TH3 phải có ít
                  nhất một nhóm mới; cấp năm chỉ nhận chữ số.
                </FieldHint>
              )}
            </Field>
          )}
        </div>

        <div className="space-y-4">
          <p className="text-xs font-semibold tracking-[0.08em] text-[#64748B] uppercase">
            Thông tin hồ sơ
          </p>
          {needsDossier ? (
            <>
              <Field label="Tiêu đề hồ sơ">
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className={inputClass}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ngày bắt đầu">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Ngày kết thúc">
                  <input
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
              <Field label="Thời hạn bảo quản">
                <input
                  value={retentionPeriod}
                  onChange={(event) => setRetentionPeriod(event.target.value)}
                  className={inputClass}
                />
              </Field>
            </>
          ) : (
            <div className="rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] px-4 py-3 text-sm leading-6 text-[#1E3A8A]">
              Metadata hồ sơ hiện có được giữ nguyên. Các PDF mới chỉ được gắn
              vào hồ sơ đã chọn.
            </div>
          )}
          <Field label="Ghi chú">
            <textarea
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      {submitError && <Notice tone="error">{submitError}</Notice>}
    </div>
  )
})

function intakeValidationMessage({
  sessionId,
  workingClusterVersionId,
  activePlanVersionId,
  disabled,
  loadingTargets,
  submitting,
  mode,
  dossierId,
  title,
  selectedLeaf,
  newPathComplete,
  newPathHasNewGroup,
}: {
  sessionId: string | null
  workingClusterVersionId: string | null
  activePlanVersionId: string | null
  disabled: boolean
  loadingTargets: boolean
  submitting: boolean
  mode: SupplementalIntakeMode
  dossierId: string
  title: string
  selectedLeaf: SupplementalClassificationTarget | undefined
  newPathComplete: boolean
  newPathHasNewGroup: boolean
}): string | null {
  if (!sessionId || !activePlanVersionId) {
    return "Session chưa có phương án phân loại hiện hành."
  }
  if (mode === "existing_dossier" && !workingClusterVersionId) {
    return "TH1 cần một cluster version hiện hành để xác định hồ sơ đích."
  }
  if (disabled || loadingTargets || submitting) {
    return "Dữ liệu đích đang được tải hoặc session đang bận. Vui lòng thử lại."
  }
  if (mode === "existing_dossier" && !dossierId) {
    return "Vui lòng chọn hồ sơ đích cho TH1."
  }
  if (mode !== "existing_dossier" && !title.trim()) {
    return "Vui lòng nhập tiêu đề hồ sơ mới."
  }
  if (mode === "new_dossier_existing_leaf" && !selectedLeaf) {
    return "Vui lòng chọn nhóm phân loại cấp nhỏ nhất cho TH2."
  }
  if (mode === "new_dossier_new_path" && !newPathComplete) {
    return "Vui lòng chọn hoặc nhập nhóm cho đầy đủ từng cấp phân loại của TH3."
  }
  if (mode === "new_dossier_new_path" && !newPathHasNewGroup) {
    return "TH3 cần ít nhất một nhóm mới. Hãy chọn “Tự nhập nhóm mới” tại cấp phù hợp."
  }
  return null
}

function targetsFromDossiers(
  dossiers: ClusterGroup[]
): SupplementalClassificationTarget[] {
  const targets = new Map<string, SupplementalClassificationTarget>()
  for (const dossier of dossiers) {
    const ids = dossier.classificationGroupIds ?? []
    const id = ids.at(-1)
    if (!id || targets.has(id)) continue
    targets.set(id, {
      id,
      ids: [...ids],
      path: [...(dossier.classificationPath ?? [])],
      isLeaf: true,
    })
  }
  return [...targets.values()]
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-medium text-[#334155]">
      {label}
      <div className="mt-2">{children}</div>
    </label>
  )
}

function FieldHint({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-xs leading-5 text-[#64748B]">{children}</p>
}

function Notice({
  children,
  tone,
}: {
  children: ReactNode
  tone: "warning" | "error"
}) {
  return (
    <div
      className={cn(
        "mt-4 rounded-xl border px-4 py-3 text-sm",
        tone === "error"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-amber-200 bg-amber-50 text-amber-800"
      )}
    >
      {children}
    </div>
  )
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Không thể chuẩn bị đợt upload bổ sung."
}

function supplementalLevelTypeLabel(type: string): string {
  const normalized = type.trim().toLowerCase()
  if (normalized === "year") return "Năm"
  if (normalized === "subject") return "Chuyên đề"
  if (normalized === "series") return "Nhóm"
  return type.trim() || "Nhóm"
}

const inputClass =
  "w-full rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/10 disabled:cursor-not-allowed disabled:bg-[#F8FAFC]"
