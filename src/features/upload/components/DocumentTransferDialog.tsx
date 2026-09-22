import { useEffect, useMemo, useRef, useState } from "react"
import { Dialog } from "radix-ui"
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  FolderTree,
  Loader2,
  Search,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  createSessionDocumentTransferRequest,
  getSessionDocumentTransferTargetContext,
  listSessionDocumentTransferTargets,
  previewSessionDocumentTransfer,
  type DocumentTransferClassificationLeaf,
  type DocumentTransferDossierInput,
  type DocumentTransferPreviewResponse,
  type DocumentTransferRequestResponse,
  type DocumentTransferTargetContext,
  type DocumentTransferTargetSession,
} from "@/features/upload/api/sessionApi"
import { transferValidationMessages } from "./documentTransferValidation"
import {
  buildClassificationTree,
  classificationLeafKey,
  type ClassificationTreeNode,
} from "./documentTransferClassificationTree"

export interface DocumentTransferTarget {
  id: number
  name: string
}

interface DocumentTransferDialogProps {
  open: boolean
  sourceSessionId: string | null
  targets: DocumentTransferTarget[]
  onOpenChange: (open: boolean) => void
  onRequestCreated: (
    request: DocumentTransferRequestResponse,
    targetedDocumentIds: number[]
  ) => void | Promise<void>
}

const EMPTY_DOSSIER: DocumentTransferDossierInput = {
  title: "",
  retention_period: "",
  start_date: "",
  end_date: "",
  annotation: "",
  language: "",
  note: "",
}

export function DocumentTransferDialog({
  open,
  sourceSessionId,
  targets,
  onOpenChange,
  onRequestCreated,
}: DocumentTransferDialogProps) {
  const documentIds = useMemo(
    () => [...new Set(targets.map((target) => target.id))],
    [targets]
  )
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [sessions, setSessions] = useState<DocumentTransferTargetSession[]>([])
  const [selectedTargetId, setSelectedTargetId] = useState("")
  const [context, setContext] = useState<DocumentTransferTargetContext | null>(
    null
  )
  const [dossier, setDossier] =
    useState<DocumentTransferDossierInput>(EMPTY_DOSSIER)
  const [reason, setReason] = useState("")
  const [preview, setPreview] =
    useState<DocumentTransferPreviewResponse | null>(null)
  const [loadingTargets, setLoadingTargets] = useState(false)
  const [loadingContext, setLoadingContext] = useState(false)
  const [checking, setChecking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const clientRequestIdRef = useRef("")

  useEffect(() => {
    if (!preview) clientRequestIdRef.current = ""
  }, [preview])

  useEffect(() => {
    if (!open) return
    const timeout = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      300
    )
    return () => window.clearTimeout(timeout)
  }, [open, search])

  useEffect(() => {
    if (!open || !sourceSessionId) return
    let cancelled = false
    const timeout = window.setTimeout(() => {
      setLoadingTargets(true)
      listSessionDocumentTransferTargets(sourceSessionId, {
        q: debouncedSearch,
        limit: 50,
        offset: 0,
      })
        .then((response) => {
          if (!cancelled) setSessions(response.targets)
        })
        .catch((caught: unknown) => {
          if (!cancelled) setError(errorMessage(caught))
        })
        .finally(() => {
          if (!cancelled) setLoadingTargets(false)
        })
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [debouncedSearch, open, sourceSessionId])

  useEffect(() => {
    if (!open || !sourceSessionId || !selectedTargetId) return
    let cancelled = false
    const timeout = window.setTimeout(() => {
      setLoadingContext(true)
      setContext(null)
      setPreview(null)
      setDossier(EMPTY_DOSSIER)
      setError("")
      getSessionDocumentTransferTargetContext(sourceSessionId, selectedTargetId)
        .then((response) => {
          if (!cancelled) setContext(response)
        })
        .catch((caught: unknown) => {
          if (!cancelled) setError(errorMessage(caught))
        })
        .finally(() => {
          if (!cancelled) setLoadingContext(false)
        })
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [open, selectedTargetId, sourceSessionId])

  const requiresDossier =
    context?.required_form_fields.includes("dossier") ?? false

  const normalizedDossier = requiresDossier ? cleanDossier(dossier) : undefined
  const canCheck = Boolean(
    context?.selectable &&
    documentIds.length > 0 &&
    (!requiresDossier || normalizedDossier?.title)
  )
  const validationMessages = useMemo(
    () =>
      transferValidationMessages(
        preview?.validation_errors ?? [],
        targets,
        preview?.blocking_jobs ?? [],
        preview?.duplicates ?? []
      ),
    [preview, targets]
  )

  const requestPayload = () => {
    if (!context) throw new Error("Chưa có context Phông đích.")
    return {
      target_session_id: context.target_session_id,
      session_document_ids: documentIds,
      expected_target_snapshot: context.target_snapshot,
      ...(normalizedDossier ? { dossier: normalizedDossier } : {}),
    }
  }

  const checkTransfer = async () => {
    if (!sourceSessionId || !canCheck) return
    setChecking(true)
    setPreview(null)
    setError("")
    try {
      setPreview(
        await previewSessionDocumentTransfer(sourceSessionId, requestPayload())
      )
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setChecking(false)
    }
  }

  const submitRequest = async () => {
    if (!sourceSessionId || !preview?.allowed) return
    setSubmitting(true)
    setError("")
    try {
      const clientRequestId = clientRequestIdRef.current || newClientId()
      clientRequestIdRef.current = clientRequestId

      const created = await createSessionDocumentTransferRequest(
        sourceSessionId,
        {
          ...requestPayload(),
          client_request_id: clientRequestId,
          expected_source_document_set_revision:
            preview.source_document_set_revision,
          expected_target_document_set_revision:
            preview.target_document_set_revision,
          expected_target_snapshot: preview.current_target_snapshot,
          ...(preview.normalized_dossier
            ? { dossier: preview.normalized_dossier }
            : {}),
          reason: reason.trim() || null,
          confirmed: true,
        }
      )
      await onRequestCreated(created, documentIds)
      toast.success(
        created.status === "completed"
          ? "Đã chuyển tài liệu sang Phông đích."
          : "Đã gửi yêu cầu tới người quản lý Phông đích."
      )
      closeDialog()
    } catch (caught) {
      const message = errorMessage(caught)
      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const closeDialog = () => {
    setSearch("")
    setSelectedTargetId("")
    setContext(null)
    setDossier(EMPTY_DOSSIER)
    setReason("")
    setPreview(null)
    setError("")
    onOpenChange(false)
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) =>
        nextOpen ? onOpenChange(true) : closeDialog()
      }
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/45" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[92vh] w-[min(920px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="flex items-center gap-2 text-xl font-semibold text-slate-900">
                <ArrowRightLeft className="h-5 w-5 text-blue-600" />
                Chuyển tài liệu sang Phông khác
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-slate-600">
                {documentIds.length} tài liệu đã chọn. Đích là session hoặc nhóm
                phân loại; hệ thống không cho chọn hồ sơ đích có sẵn.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Đóng">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-[0.9fr_1.1fr]">
            <section>
              <label className="text-sm font-medium text-slate-800">
                Phông đích
              </label>
              <div className="relative mt-2">
                <Search className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm tên Phông, kho hoặc mã cơ quan"
                  className="w-full rounded-lg border border-slate-300 py-2 pr-3 pl-9 text-sm"
                />
              </div>
              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
                {loadingTargets && (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang tải danh sách...
                  </div>
                )}
                {sessions.map((session) => (
                  <button
                    key={session.session_id}
                    type="button"
                    disabled={!session.selectable}
                    onClick={() => setSelectedTargetId(session.session_id)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      selectedTargetId === session.session_id
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 hover:border-slate-300"
                    } disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    <div className="font-medium text-slate-900">
                      {session.fonds_name ||
                        session.archive_name ||
                        session.session_id}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {caseLabel(session.transfer_case)}
                    </div>
                    {session.unavailable_reason && (
                      <div className="mt-1 text-xs text-rose-600">
                        {session.unavailable_reason}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              {loadingContext && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang xác định trường hợp chuyển...
                </div>
              )}
              {context && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                  <div className="font-medium">
                    {caseLabel(context.transfer_case)}
                  </div>
                  <div className="mt-1">
                    {context.requires_target_approval
                      ? "Yêu cầu sẽ chờ coordinator Phông đích accept/reject."
                      : "Tài liệu được chuyển ngay, không tạo hồ sơ."}
                  </div>
                </div>
              )}

              {requiresDossier && (
                <DossierFields
                  dossier={dossier}
                  onChange={(value) => {
                    setDossier(value)
                    setPreview(null)
                  }}
                />
              )}

              {context?.transfer_case ===
                "case_3_classification_pending_approval" && (
                <div className="flex gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  Người nhận sẽ chọn nhóm phân loại khi chấp nhận. Nếu không
                  chọn, hồ sơ được nhận ở trạng thái chưa phân loại.
                </div>
              )}

              {context?.transfer_case === "case_4_classification_approved" && (
                <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {context.cluster_version_approval_mode === "manual"
                    ? "Người nhận có thể chọn nhóm đích; nếu chọn, hệ thống tạo bản nháp mới và chờ duyệt."
                    : "Người nhận có thể chọn nhóm đích hoặc để hồ sơ ở trạng thái chưa phân loại."}
                </div>
              )}

              {context && (
                <label className="block text-sm font-medium text-slate-800">
                  Lý do chuyển
                  <textarea
                    value={reason}
                    onChange={(event) => {
                      setReason(event.target.value)
                      setPreview(null)
                    }}
                    rows={2}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              )}

              {preview && (
                <div
                  className={`rounded-xl border p-3 text-sm ${
                    preview.allowed
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border-rose-200 bg-rose-50 text-rose-900"
                  }`}
                >
                  <div className="flex items-center gap-2 font-medium">
                    {preview.allowed ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <AlertTriangle className="h-4 w-4" />
                    )}
                    {preview.allowed
                      ? "Dữ liệu hợp lệ, có thể gửi yêu cầu."
                      : "Chưa thể gửi yêu cầu."}
                  </div>
                  {!preview.allowed && validationMessages.length > 0 && (
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {validationMessages.map((message) => (
                        <li key={message}>{message}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  {error}
                </div>
              )}
            </section>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={closeDialog}>
              Hủy
            </Button>
            <Button
              variant="outline"
              disabled={!canCheck || checking || submitting}
              onClick={() => void checkTransfer()}
            >
              {checking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Kiểm tra
            </Button>
            <Button
              disabled={!preview?.allowed || submitting}
              onClick={() => void submitRequest()}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {context?.requires_target_approval
                ? "Gửi yêu cầu"
                : "Xác nhận chuyển"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function ClassificationTreePicker({
  leaves,
  selectedKey,
  onSelect,
}: {
  leaves: DocumentTransferClassificationLeaf[]
  selectedKey: string
  onSelect: (leaf: DocumentTransferClassificationLeaf) => void
}) {
  const tree = useMemo(() => buildClassificationTree(leaves), [leaves])
  const selectedLeaf = leaves.find(
    (leaf) => classificationLeafKey(leaf) === selectedKey
  )

  return (
    <div>
      <div className="text-sm font-medium text-slate-800">
        Cây phân loại Phông đích
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Mở theo đường dẫn phân loại và chỉ chọn nhóm cuối cùng.
      </p>
      <div
        role="tree"
        aria-label="Cây phân loại Phông đích"
        className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 py-1"
      >
        {tree.length > 0 ? (
          tree.map((node) => (
            <ClassificationTreeBranch
              key={node.key}
              node={node}
              level={0}
              selectedKey={selectedKey}
              onSelect={onSelect}
            />
          ))
        ) : (
          <div className="px-3 py-4 text-sm text-slate-500">
            Phông đích chưa có nhóm nhỏ để chọn.
          </div>
        )}
      </div>
      {selectedLeaf && (
        <div className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
          Đã chọn: {selectedLeaf.group_path.join(" / ")}
        </div>
      )}
    </div>
  )
}

function ClassificationTreeBranch({
  node,
  level,
  selectedKey,
  onSelect,
}: {
  node: ClassificationTreeNode
  level: number
  selectedKey: string
  onSelect: (leaf: DocumentTransferClassificationLeaf) => void
}) {
  const isLeaf = node.children.length === 0 && node.leaf
  const selected = Boolean(
    isLeaf && classificationLeafKey(isLeaf) === selectedKey
  )
  const paddingLeft = 12 + level * 20

  if (isLeaf) {
    return (
      <button
        type="button"
        role="treeitem"
        aria-selected={selected}
        onClick={() => onSelect(isLeaf)}
        style={{ paddingLeft }}
        className={`flex w-full items-center gap-2 py-2 pr-3 text-left text-sm transition ${
          selected
            ? "bg-blue-100 font-medium text-blue-800"
            : "text-slate-700 hover:bg-white"
        }`}
      >
        <span
          className={`h-3.5 w-3.5 rounded-full border ${
            selected
              ? "border-[4px] border-blue-600 bg-white"
              : "border-slate-400 bg-white"
          }`}
        />
        <span>{node.name}</span>
      </button>
    )
  }

  return (
    <div role="treeitem" aria-expanded="true">
      <div
        style={{ paddingLeft }}
        className="flex items-center gap-2 py-2 pr-3 text-sm font-medium text-slate-800"
      >
        <FolderTree className="h-4 w-4 shrink-0 text-slate-500" />
        <span>{node.name}</span>
      </div>
      <div role="group">
        {node.children.map((child) => (
          <ClassificationTreeBranch
            key={child.key}
            node={child}
            level={level + 1}
            selectedKey={selectedKey}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  )
}

function DossierFields({
  dossier,
  onChange,
}: {
  dossier: DocumentTransferDossierInput
  onChange: (value: DocumentTransferDossierInput) => void
}) {
  const field = (key: keyof DocumentTransferDossierInput, value: string) =>
    onChange({ ...dossier, [key]: value })
  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
      <label className="text-sm font-medium text-slate-800 sm:col-span-2">
        Tiêu đề hồ sơ mới
        <input
          value={dossier.title}
          onChange={(event) => field("title", event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="text-sm text-slate-700">
        Thời hạn bảo quản
        <input
          value={dossier.retention_period || ""}
          onChange={(event) => field("retention_period", event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="text-sm text-slate-700">
        Ngôn ngữ
        <input
          value={dossier.language || ""}
          onChange={(event) => field("language", event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="text-sm text-slate-700">
        Từ ngày
        <input
          type="date"
          value={dossier.start_date || ""}
          onChange={(event) => field("start_date", event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="text-sm text-slate-700">
        Đến ngày
        <input
          type="date"
          value={dossier.end_date || ""}
          onChange={(event) => field("end_date", event.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="text-sm text-slate-700 sm:col-span-2">
        Chú giải / ghi chú
        <textarea
          value={dossier.annotation || ""}
          onChange={(event) => field("annotation", event.target.value)}
          rows={2}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
    </div>
  )
}

function cleanDossier(
  dossier: DocumentTransferDossierInput
): DocumentTransferDossierInput {
  return Object.fromEntries(
    Object.entries(dossier)
      .map(([key, value]) => [
        key,
        typeof value === "string" ? value.trim() : value,
      ])
      .filter(([, value]) => value !== "")
  ) as unknown as DocumentTransferDossierInput
}

function caseLabel(value: string | null | undefined): string {
  if (value === "case_1_no_approved_plan") {
    return "Case 1 · Chuyển tài liệu vào session"
  }
  if (value === "case_2_plan_without_classification") {
    return "Case 2 · Tạo hồ sơ mới, chưa chọn nhóm phân loại"
  }
  if (value === "case_3_classification_pending_approval") {
    return "Case 3 · Tạo hồ sơ mới trong nhóm phân loại"
  }
  if (value === "case_4_classification_approved") {
    return "Case 4 · Tạo hồ sơ và active version mới"
  }
  return "Không khả dụng"
}

function newClientId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `transfer-${Date.now()}`
}

function errorMessage(caught: unknown): string {
  return caught instanceof Error
    ? caught.message
    : "Không thể xử lý yêu cầu chuyển tài liệu."
}
