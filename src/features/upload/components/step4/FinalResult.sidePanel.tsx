import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import {
  Check,
  CheckCircle2,
  Edit2,
  FolderOpen,
  ListChecks,
  Loader2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/shared/lib/utils"
import {
  listSessionDossierRetentionCandidates,
  type RetentionCandidateSummary,
  type RetentionCandidateVersion,
  type RetentionReference,
} from "@/features/upload/api/sessionApi"
import type { ClusterGroup } from "@/features/upload/lib/clusterGroups"
import {
  DOSSIER_METADATA_EDIT_FIELDS,
  createDossierMetadataDraft,
  type DossierMetadataDraft,
} from "./FinalResult.metadataUtils"

const LEGACY_RETENTION_VERSION_ID = "__current_retention_candidates__"

export function DossierMetadataSidePanel({
  sessionId,
  group,
  saving,
  className,
  onSave,
  onSelectRetentionCandidate,
  onClose,
}: {
  sessionId: string | null
  group: ClusterGroup
  saving: boolean
  className?: string
  onSave: (
    group: ClusterGroup,
    draft: DossierMetadataDraft,
    dirtyFields: ReadonlySet<keyof DossierMetadataDraft>
  ) => Promise<void>
  onSelectRetentionCandidate?: (
    dossierId: string,
    entryId: string,
    candidateVersionId?: string | null
  ) => Promise<void>
  onClose: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<DossierMetadataDraft>(() =>
    createDossierMetadataDraft(group)
  )
  const [dirtyFields, setDirtyFields] = useState<
    Set<keyof DossierMetadataDraft>
  >(new Set())
  const [candidatePanelOpen, setCandidatePanelOpen] = useState(false)
  const [candidateVersions, setCandidateVersions] = useState<
    RetentionCandidateVersion[]
  >([])
  const [selectedCandidateVersionId, setSelectedCandidateVersionId] =
    useState("")
  const [candidatesLoading, setCandidatesLoading] = useState(false)
  const [candidatesError, setCandidatesError] = useState("")
  const [selectingEntryId, setSelectingEntryId] = useState("")
  const groupKey = group.dossierId ?? group.id
  const classificationNotice = classificationStatusNotice(
    group.classificationStatus
  )
  const metadataFields: Array<{
    label: string
    value: string
    wide?: boolean
  }> = [
    { label: "Tên kho lưu trữ", value: group.archiveName ?? "" },
    { label: "Tên phông", value: group.fondsName ?? "" },
    { label: "Mục lục số", value: group.inventoryNumber ?? "" },
    { label: "Hộp số", value: group.boxNumber ?? "" },
    { label: "Hồ sơ số", value: group.dossierNumber ?? "" },
    { label: "Ký hiệu thông tin", value: group.informationSign ?? "" },
    { label: "Tiêu đề hồ sơ", value: group.label, wide: true },
    { label: "Chú giải", value: group.annotation ?? "", wide: true },
    { label: "Thời gian bắt đầu", value: group.startDate ?? "" },
    { label: "Thời gian kết thúc", value: group.endDate ?? "" },
    { label: "Ngôn ngữ", value: group.language ?? "" },
    {
      label: "Số lượng tờ",
      value:
        typeof group.sheetCount === "number" ? String(group.sheetCount) : "",
    },
    {
      label: "Số lượng trang",
      value:
        typeof group.pageCount === "number" ? String(group.pageCount) : "",
    },
    { label: "Thời hạn bảo quản", value: group.retentionPeriod ?? "" },
    { label: "Chế độ sử dụng", value: group.usageMode ?? "" },
    {
      label: "Tình trạng vật lý",
      value: group.physicalCondition ?? "",
      wide: true,
    },
    { label: "Ghi chú", value: group.note ?? "", wide: true },
  ]

  useEffect(() => {
    setDraft(createDossierMetadataDraft(group))
    setDirtyFields(new Set())
    setEditing(false)
    setCandidatePanelOpen(false)
    setCandidateVersions([])
    setSelectedCandidateVersionId("")
    setCandidatesError("")
    setSelectingEntryId("")
  }, [groupKey])

  useEffect(() => {
    if (!editing) setDraft(createDossierMetadataDraft(group))
  }, [editing, group])

  const startEdit = () => {
    setDraft(createDossierMetadataDraft(group))
    setDirtyFields(new Set())
    setEditing(true)
  }

  const cancelEdit = () => {
    setDraft(createDossierMetadataDraft(group))
    setDirtyFields(new Set())
    setEditing(false)
  }

  const saveMetadata = async () => {
    try {
      await onSave(group, draft, dirtyFields)
      setDirtyFields(new Set())
      setEditing(false)
    } catch {
      // The parent handler owns user-facing error messages.
    }
  }

  const loadRetentionCandidates = async () => {
    if (!sessionId) {
      toast.error("Chưa có session để tải gợi ý thời hạn bảo quản.")
      return
    }
    if (group.isPendingDossier) {
      const versions = retentionCandidateVersionsFromResponse(
        group.retentionRecommendation ?? {}
      )
      setCandidatePanelOpen(true)
      setCandidatesLoading(false)
      setSelectingEntryId("")
      setCandidateVersions(versions)
      setSelectedCandidateVersionId(
        textValue(
          group.retentionRecommendation?.active_candidate_version_id
        ) ||
          versions[versions.length - 1]?.version_id ||
          ""
      )
      setCandidatesError(
        versions.some((version) => version.candidates.length > 0)
          ? ""
          : "Hồ sơ tạm này chưa có danh sách gợi ý thời hạn bảo quản."
      )
      return
    }
    if (!group.dossierId) {
      toast.error("Hồ sơ này chưa có mã để tải gợi ý thời hạn bảo quản.")
      return
    }
    setCandidatePanelOpen(true)
    setCandidatesLoading(true)
    setCandidatesError("")
    try {
      const response = await listSessionDossierRetentionCandidates(
        sessionId,
        group.dossierId,
        10
      )
      const versions = retentionCandidateVersionsFromResponse(response)
      setCandidateVersions(versions)
      setSelectedCandidateVersionId(
        textValue(response.active_candidate_version_id) ||
          versions[versions.length - 1]?.version_id ||
          ""
      )
    } catch (err) {
      setCandidateVersions([])
      setSelectedCandidateVersionId("")
      setCandidatesError(
        err instanceof Error
          ? err.message
          : "Không thể tải gợi ý thời hạn bảo quản."
      )
    } finally {
      setCandidatesLoading(false)
    }
  }

  const selectRetentionCandidate = async (
    candidate: RetentionCandidateSummary,
    candidateVersionId?: string | null
  ) => {
    const retentionPeriod = textValue(candidate.retention_period)
    if (!retentionPeriod) {
      toast.error("Gợi ý này chưa có thời hạn bảo quản.")
      return
    }
    const nextDraft = {
      ...createDossierMetadataDraft(group),
      retentionPeriod,
    }
    setSelectingEntryId(candidate.entry_id)
    try {
      if (!group.isPendingDossier && onSelectRetentionCandidate && group.dossierId) {
        await onSelectRetentionCandidate(
          group.dossierId,
          candidate.entry_id,
          candidateVersionId
        )
      } else {
        await onSave(group, nextDraft, new Set(["retentionPeriod"]))
      }
      setDraft(nextDraft)
      setEditing(false)
      setCandidatePanelOpen(false)
      toast.success(`Đã cập nhật thời hạn bảo quản "${retentionPeriod}".`)
    } catch {
      // The parent handler owns user-facing error messages.
    } finally {
      setSelectingEntryId("")
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.16 }}
      className={cn(
        "relative flex min-h-[360px] min-w-0 flex-col overflow-hidden rounded-2xl border border-[#D8E1EC] bg-white shadow-sm sm:min-h-[520px]",
        className
      )}
    >
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#EAF1FF] text-[#0052FF]">
            <FolderOpen className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#0F172A]">
              Metadata hồ sơ
            </p>
            <p className="truncate text-[11px] text-[#64748B]">{group.label}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {editing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={cancelEdit}
                disabled={saving}
              >
                Hủy
              </Button>
              <Button
                size="sm"
                onClick={() => void saveMetadata()}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                ) : (
                  <Check data-icon="inline-start" />
                )}
                Lưu metadata
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadRetentionCandidates()}
                disabled={saving || candidatesLoading}
              >
                {candidatesLoading ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                ) : (
                  <ListChecks data-icon="inline-start" />
                )}
                Gợi ý THBQ
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={startEdit}
                disabled={saving}
              >
                <Edit2 data-icon="inline-start" /> Sửa
              </Button>
            </>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title="Đóng metadata"
            onClick={onClose}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#F8FAFC] p-3">
        {classificationNotice && (
          <div
            className={cn(
              "mb-3 rounded-xl border px-3 py-2 text-xs leading-5",
              classificationNotice.kind === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            )}
          >
            {classificationNotice.message}
          </div>
        )}
        {editing ? (
          <div className="flex flex-col gap-2 rounded-xl bg-white p-3">
            {DOSSIER_METADATA_EDIT_FIELDS.map((field) => (
              <div
                key={field.key}
                className="grid min-w-0 grid-cols-1 gap-1 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-2"
              >
                <span className="pt-2 text-[11px] font-medium text-[#64748B]">
                  {field.label}
                </span>
                <textarea
                  value={draft[field.key]}
                  onChange={(event) =>
                    {
                      setDraft((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                      setDirtyFields((current) => {
                        const next = new Set(current)
                        next.add(field.key)
                        return next
                      })
                    }
                  }
                  rows={field.rows}
                  disabled={saving}
                  className="min-h-9 w-full min-w-0 resize-y rounded-lg border border-[#CBD5E1] bg-transparent px-2.5 py-1.5 text-xs leading-5 [overflow-wrap:anywhere] whitespace-pre-wrap transition-colors outline-none placeholder:text-[#94A3B8] focus-visible:border-[#0052FF] focus-visible:ring-3 focus-visible:ring-[#0052FF]/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:opacity-70"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid min-w-0 gap-2 text-xs">
            <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2">
              {metadataFields.map((field) => (
                <PreviewField
                  key={field.label}
                  label={field.label}
                  value={field.value}
                  wide={field.wide}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      {candidatePanelOpen && (
        <RetentionCandidatePanel
          group={group}
          versions={candidateVersions}
          selectedVersionId={selectedCandidateVersionId}
          loading={candidatesLoading}
          error={candidatesError}
          selectingEntryId={selectingEntryId}
          saving={saving}
          onClose={() => setCandidatePanelOpen(false)}
          onSelectVersion={setSelectedCandidateVersionId}
          onSelect={(candidate, versionId) =>
            void selectRetentionCandidate(candidate, versionId)
          }
        />
      )}
    </motion.div>
  )
}

function RetentionCandidatePanel({
  group,
  versions,
  selectedVersionId,
  loading,
  error,
  selectingEntryId,
  saving,
  onClose,
  onSelectVersion,
  onSelect,
}: {
  group: ClusterGroup
  versions: RetentionCandidateVersion[]
  selectedVersionId: string
  loading: boolean
  error: string
  selectingEntryId: string
  saving: boolean
  onClose: () => void
  onSelectVersion: (versionId: string) => void
  onSelect: (
    candidate: RetentionCandidateSummary,
    candidateVersionId?: string | null
  ) => void
}) {
  const selectedVersion =
    versions.find((version) => version.version_id === selectedVersionId) ??
    versions[versions.length - 1] ??
    null
  const candidates = selectedVersion?.candidates ?? []
  const selectedVersionForPatch =
    selectedVersion &&
    selectedVersion.version_id !== LEGACY_RETENTION_VERSION_ID
      ? selectedVersion.version_id
      : null
  return (
    <div className="absolute inset-x-3 top-16 bottom-3 z-40 flex flex-col overflow-hidden rounded-xl border border-[#CBD5E1] bg-white shadow-2xl">
      <div className="flex items-start justify-between gap-3 border-b border-[#E2E8F0] px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#0F172A]">
            Gợi ý thời hạn bảo quản
          </p>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-5 text-[#64748B]">
            {group.label}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Đóng gợi ý"
          onClick={onClose}
        >
          <X className="size-3.5" />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col bg-[#F8FAFC]">
        {loading ? (
          <div className="p-3">
            <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-[#CBD5E1] bg-white text-sm text-[#64748B]">
              <Loader2 className="mr-2 size-4 animate-spin text-[#0052FF]" />
              Đang tải gợi ý...
            </div>
          </div>
        ) : error ? (
          <div className="p-3">
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          </div>
        ) : (
          <>
            <RetentionVersionSelector
              versions={versions}
              selectedVersionId={selectedVersion?.version_id ?? ""}
              onSelectVersion={onSelectVersion}
            />
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {candidates.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#CBD5E1] bg-white px-3 py-8 text-center text-sm text-[#64748B]">
                  Chưa có gợi ý thời hạn bảo quản.
                </div>
              ) : (
                <div className="space-y-2">
                  {candidates.map((candidate) => {
                    const reference = candidateReference(candidate)
                    const selected =
                      textValue(candidate.retention_period) ===
                      textValue(group.retentionPeriod)
                    const candidateSaving =
                      selectingEntryId === candidate.entry_id
                    return (
                      <button
                        key={`${selectedVersion?.version_id ?? ""}-${candidate.entry_id}`}
                        type="button"
                        disabled={saving || Boolean(selectingEntryId)}
                        className={cn(
                          "w-full rounded-lg border bg-white p-2.5 text-left text-[11px] leading-5 shadow-sm transition hover:border-[#0052FF] hover:bg-[#F8FBFF] focus-visible:ring-2 focus-visible:ring-[#0052FF] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60",
                          selected ? "border-[#0052FF]" : "border-[#D8E1EC]"
                        )}
                        onClick={() =>
                          onSelect(candidate, selectedVersionForPatch)
                        }
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold text-[#0F172A]">
                            #{candidate.rank ?? "?"} ·{" "}
                            {reference.retention_period || "Chưa rõ thời hạn"}
                          </span>
                          {candidateSaving ? (
                            <Loader2 className="size-4 animate-spin text-[#0052FF]" />
                          ) : selected ? (
                            <CheckCircle2 className="size-4 text-emerald-600" />
                          ) : null}
                        </div>
                        <RetentionReferenceDetails reference={reference} />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function RetentionVersionSelector({
  versions,
  selectedVersionId,
  onSelectVersion,
}: {
  versions: RetentionCandidateVersion[]
  selectedVersionId: string
  onSelectVersion: (versionId: string) => void
}) {
  if (versions.length <= 1) return null
  return (
    <div className="shrink-0 border-b border-[#E2E8F0] bg-white px-3 py-2">
      <div className="flex gap-1 overflow-x-auto rounded-lg bg-[#F1F5F9] p-1">
        {versions.map((version, index) => {
          const selected = version.version_id === selectedVersionId
          const label = version.version_number ?? index + 1
          return (
            <button
              key={version.version_id}
              type="button"
              aria-pressed={selected}
              className={cn(
                "min-w-[124px] rounded-md px-2.5 py-1.5 text-left text-[11px] leading-4 transition focus-visible:ring-2 focus-visible:ring-[#0052FF] focus-visible:outline-none",
                selected
                  ? "bg-white text-[#0052FF] shadow-sm"
                  : "text-[#475569] hover:bg-white/70 hover:text-[#0F172A]"
              )}
              onClick={() => onSelectVersion(version.version_id)}
            >
              <span className="block font-semibold">Phiên bản {label}</span>
              <span className="block text-[10px] text-[#64748B]">
                {retentionVersionSummary(version)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function RetentionReferenceDetails({
  reference,
}: {
  reference?: RetentionReference | null
}) {
  const mergeNames =
    reference?.merge_path
      ?.map((item) => textValue(item.name))
      .filter(Boolean)
      .join(" > ") || textValue(reference?.breadcrumb)
  const rows = [
    ["Phụ lục", reference?.appendix_name],
    ["Nhóm", mergeNames],
    ["Nội dung", reference?.document_type],
    ["Số thứ tự điều", reference?.source_unit_index],
    ["Dòng nguồn", reference?.source_row_index],
    ["Thời hạn", reference?.retention_period],
    ["Thông tư", reference?.source_file_name],
    ["Ghi chú", reference?.note],
  ].filter(([, value]) => textValue(value))
  return (
    <dl className="space-y-1.5 text-[11px] leading-5">
      {rows.map(([label, value]) => (
        <div key={String(label)} className="grid grid-cols-[78px_1fr] gap-2">
          <dt className="font-medium text-[#64748B]">{label}</dt>
          <dd className="min-w-0 [overflow-wrap:anywhere] text-[#0F172A]">
            {textValue(value)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function candidateReference(
  candidate: RetentionCandidateSummary
): RetentionReference {
  const context = candidate.context ?? null
  return {
    ...context,
    ...candidate,
    merge_path: candidate.merge_path ?? context?.merge_path ?? [],
    appendix_name: candidate.appendix_name ?? context?.appendix_name ?? "",
    source_file_name:
      candidate.source_file_name ?? context?.source_file_name ?? "",
    document_type: candidate.document_type ?? "",
    retention_period: candidate.retention_period ?? "",
  }
}

function retentionCandidateVersionsFromResponse(
  response: unknown
): RetentionCandidateVersion[] {
  const payload = recordValue(response)
  const versions = Array.isArray(payload.versions)
    ? (payload.versions as RetentionCandidateVersion[])
    : []
  if (versions.length > 0) {
    return versions.map((version, index) => ({
      ...version,
      version_id:
        textValue(version.version_id) || `retention-version-${index + 1}`,
      version_number: version.version_number ?? index + 1,
      candidates: Array.isArray(version.candidates) ? version.candidates : [],
    }))
  }
  return [
    {
      version_id: LEGACY_RETENTION_VERSION_ID,
      version_number: 1,
      candidates: Array.isArray(payload.candidates)
        ? (payload.candidates as RetentionCandidateSummary[])
        : [],
      candidate_count:
        typeof payload.candidate_count === "number"
          ? payload.candidate_count
          : undefined,
      candidates_truncated: Boolean(payload.candidates_truncated),
    },
  ]
}

function recordValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function retentionVersionSummary(version: RetentionCandidateVersion): string {
  const sourceCount =
    typeof version.source_count === "number" ? version.source_count : null
  const appendixCount =
    typeof version.appendix_count === "number" ? version.appendix_count : null
  const candidateCount =
    typeof version.candidate_count === "number"
      ? version.candidate_count
      : version.candidates.length
  const sourceText =
    sourceCount !== null ? `${sourceCount} thông tư` : "nguồn hiện hành"
  const appendixText =
    appendixCount !== null
      ? `${appendixCount} phụ lục`
      : `${candidateCount} gợi ý`
  return `${sourceText} · ${appendixText}`
}

function textValue(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return ""
}

function classificationStatusNotice(
  status: string | null | undefined
): { kind: "pending" | "error"; message: string } | null {
  if (status === "pending" || status === "running") {
    return {
      kind: "pending",
      message:
        status === "running"
          ? "Đang phân loại lại hồ sơ theo metadata mới."
          : "Metadata đã lưu; hồ sơ đang chờ phân loại lại.",
    }
  }
  if (status === "failed") {
    return {
      kind: "error",
      message:
        "Phân loại lại hồ sơ chưa thành công. Metadata đã được lưu, bạn có thể thử cập nhật lại sau.",
    }
  }
  return null
}

export function PreviewField({
  label,
  value,
  icon,
  wide = false,
}: {
  label: string
  value: string
  icon?: React.ReactNode
  wide?: boolean
}) {
  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-lg bg-[#F8FAFC] px-2.5 py-2",
        wide && "col-span-full"
      )}
    >
      <p className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold tracking-[0.08em] text-[#94A3B8] uppercase">
        {icon}
        {label}
      </p>
      <p
        className={cn(
          "min-w-0 text-xs font-medium [overflow-wrap:anywhere] break-words whitespace-normal text-[#0F172A]",
          !wide && "line-clamp-2"
        )}
      >
        {value || "Chưa có"}
      </p>
    </div>
  )
}
