import { useEffect, useMemo, useState } from "react"
import { Dialog } from "radix-ui"
import {
  AlertTriangle,
  Loader2,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  deleteSessionDocuments,
  previewSessionDocumentDeletion,
  retrySessionDocumentDeletion,
  type DocumentDeletionBlocker,
  type DocumentDeletionOperationResponse,
  type DocumentDeletionPreviewResponse,
} from "@/features/upload/api/sessionApi"

export interface DocumentDeletionTarget {
  id: number
  name: string
}

interface DocumentDeletionDialogProps {
  open: boolean
  sessionId: string | null
  targets: DocumentDeletionTarget[]
  onOpenChange: (open: boolean) => void
  onMutationCompleted: (
    result: DocumentDeletionOperationResponse,
    targetedDocumentIds: number[]
  ) => void
}

export function DocumentDeletionDialog({
  open,
  sessionId,
  targets,
  onOpenChange,
  onMutationCompleted,
}: DocumentDeletionDialogProps) {
  const [preview, setPreview] =
    useState<DocumentDeletionPreviewResponse | null>(null)
  const [operation, setOperation] =
    useState<DocumentDeletionOperationResponse | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [reason, setReason] = useState("")
  const [confirmed, setConfirmed] = useState(false)
  const documentIds = useMemo(
    () => [...new Set(targets.map((target) => target.id))],
    [targets]
  )

  useEffect(() => {
    if (!open || !sessionId || documentIds.length === 0) return
    let cancelled = false
    const loadPreview = async () => {
      await Promise.resolve()
      if (cancelled) return
      setLoadingPreview(true)
      setPreview(null)
      setOperation(null)
      setError("")
      setReason("")
      setConfirmed(false)
      try {
        const response = await previewSessionDocumentDeletion(
          sessionId,
          documentIds
        )
        if (!cancelled) setPreview(response)
      } catch (caught) {
        if (cancelled) return
        setError(
          deletionErrorMessage(
            caught,
            "Không thể kiểm tra điều kiện xóa tài liệu."
          )
        )
      } finally {
        if (!cancelled) setLoadingPreview(false)
      }
    }
    void loadPreview()
    return () => {
      cancelled = true
    }
  }, [documentIds, open, sessionId])

  const submitDelete = async () => {
    if (
      !sessionId ||
      !preview?.allowed ||
      !confirmed ||
      documentIds.length === 0
    )
      return
    setSubmitting(true)
    setError("")
    try {
      const result = await deleteSessionDocuments(
        sessionId,
        documentIds,
        reason,
        confirmed
      )
      setOperation(result)
      onMutationCompleted(result, documentIds)
      if (result.status === "completed") {
        toast.success(
          `Đã xóa ${documentIds.length} tài liệu khỏi session. Cần lập hồ sơ lại.`
        )
        onOpenChange(false)
      } else {
        toast.warning(
          "Một số tài liệu đang chờ Chỉnh Lý xác nhận xóa. Có thể thử lại ngay trong hộp thoại."
        )
      }
    } catch (caught) {
      const message = deletionErrorMessage(caught, "Không thể xóa tài liệu.")
      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const retryDelete = async () => {
    if (!sessionId || !operation?.operation_id) return
    setSubmitting(true)
    setError("")
    try {
      const result = await retrySessionDocumentDeletion(
        sessionId,
        operation.operation_id
      )
      setOperation(result)
      onMutationCompleted(result, documentIds)
      if (result.status === "completed") {
        toast.success("Đã hoàn tất xóa các tài liệu còn pending.")
        onOpenChange(false)
      } else if (result.retry_exhausted) {
        toast.error(
          "Đã hết số lần thử xóa. Operation được đánh dấu failed và cần kiểm tra thủ công."
        )
      } else {
        toast.warning("Vẫn còn tài liệu chưa được Chỉnh Lý xác nhận xóa.")
      }
    } catch (caught) {
      const message = deletionErrorMessage(caught, "Không thể thử xóa lại.")
      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const blockers = preview?.blocking_jobs ?? []
  const hasClusterHistoryBlocker = blockers.some(
    (blocker) => blocker.code === "DOCUMENT_ALREADY_CLUSTERED"
  )
  const jobsToCancel = preview?.jobs_to_cancel ?? []
  const continuingJobs = preview?.continuing_jobs ?? []
  const impact = preview?.impact
  const pendingDocuments = operation?.pending_session_documents ?? []

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#0F172A]/50 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[88svh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-[#CBD5E1] bg-white shadow-2xl outline-none">
          <div className="flex items-start gap-3 border-b border-[#E2E8F0] px-5 py-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
              <Trash2 className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base font-semibold text-[#0F172A]">
                Xóa tài liệu khỏi toàn session
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-[#64748B]">
                Tài liệu sẽ không còn tham gia OCR, lập hồ sơ, đánh số, tạo
                mục lục hay xuất bản. Dữ liệu lịch sử vẫn được giữ lại.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" className="size-8 p-0">
                <X className="size-4" />
                <span className="sr-only">Đóng</span>
              </Button>
            </Dialog.Close>
          </div>

          <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">
                {targets.length} tài liệu được chọn
              </p>
              <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#475569]">
                {targets.map((target) => (
                  <li key={target.id} className="truncate">
                    {target.name}
                  </li>
                ))}
              </ul>
            </div>

            {loadingPreview ? (
              <div className="flex items-center gap-2 rounded-lg bg-[#F8FAFC] px-3 py-3 text-sm text-[#64748B]">
                <Loader2 className="size-4 animate-spin" />
                Đang kiểm tra các task đang chạy và phạm vi ảnh hưởng...
              </div>
            ) : null}

            {blockers.length > 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                <p className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="size-4" />
                  Chưa thể xóa tài liệu
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                  {blockers.map((blocker, index) => (
                    <li key={`${blocker.job_id ?? blocker.operation_id ?? index}`}>
                      {deletionBlockerLabel(blocker)}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs">
                  {hasClusterHistoryBlocker
                    ? "Hãy bỏ chọn các tài liệu đã được lập hồ sơ rồi kiểm tra lại."
                    : "Vui lòng đợi tài liệu được mở khóa hoặc task hoàn thành rồi kiểm tra lại."}
                </p>
              </div>
            ) : null}

            {jobsToCancel.length > 0 && blockers.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
                <p className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="size-4" />
                  Task riêng của tài liệu sẽ được hủy
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                  {jobsToCancel.map((job, index) => (
                    <li key={`${job.job_id ?? index}`}>
                      {jobTypeLabel(job.job_type ?? "task")} · {job.status}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs">
                  Bạn không cần đợi OCR hoặc metadata của các tài liệu này hoàn
                  thành. Kết quả trả về muộn sẽ bị hệ thống bỏ qua.
                </p>
              </div>
            ) : null}

            {continuingJobs.length > 0 && blockers.length === 0 ? (
              <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-3 text-sm text-sky-950">
                <p className="flex items-center gap-2 font-semibold">
                  <RefreshCw className="size-4" />
                  Task chung vẫn tiếp tục chạy
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                  {continuingJobs.map((job, index) => (
                    <li key={`${job.job_id ?? index}`}>
                      {jobTypeLabel(job.job_type ?? "task")} · {job.status}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs">
                  Task theo dõi batch không bị hủy; nó sẽ bỏ qua tài liệu đã xóa
                  và tiếp tục xử lý các tài liệu còn active.
                </p>
              </div>
            ) : null}

            {impact && blockers.length === 0 ? (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-950">
                <p className="font-semibold">Kết quả sẽ bị ảnh hưởng</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                  {impact.affected_dossier_ids.length > 0 ? (
                    <li>
                      {impact.affected_dossier_ids.length} hồ sơ đang chứa tài
                      liệu được chọn.
                    </li>
                  ) : null}
                  {impact.clustering_will_be_stale ? (
                    <li>Kết quả lập hồ sơ hiện tại sẽ cần chạy lại.</li>
                  ) : null}
                  {impact.numbering_will_be_stale ? (
                    <li>Kết quả đánh số hiện tại sẽ không còn hợp lệ.</li>
                  ) : null}
                  {impact.artifact_downloads_will_be_blocked ? (
                    <li>
                      {impact.ready_artifact_count} artifact cũ sẽ bị khóa xem
                      và tải xuống.
                    </li>
                  ) : null}
                  <li>Hệ thống không tự động chạy lại pipeline sau khi xóa.</li>
                </ul>
              </div>
            ) : null}

            {pendingDocuments.length > 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900">
                <p className="font-semibold">
                  {pendingDocuments.length} tài liệu còn delete_pending
                </p>
                <p className="mt-1">
                  Đã retry {operation?.retry_count ?? 0}/
                  {operation?.max_retry_count ?? 3} lần.
                </p>
                {pendingDocuments.map((document) => (
                  <p key={document.session_document_id} className="mt-1">
                    #{document.session_document_id}: {document.error}
                  </p>
                ))}
                {operation?.retry_exhausted ? (
                  <p className="mt-2 font-semibold text-red-700">
                    Xóa đã failed sau khi hết số lần retry. Tài liệu tiếp tục bị
                    loại khỏi pipeline và cần được kiểm tra thủ công.
                  </p>
                ) : null}
              </div>
            ) : null}

            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </p>
            ) : null}

            {!operation ? (
              <div className="space-y-3">
                <label className="block text-xs font-medium text-[#475569]">
                  Lý do (không bắt buộc)
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    rows={2}
                    className="mt-1 w-full resize-none rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/15"
                  />
                </label>
                <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-xs text-red-900">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                    className="mt-0.5 size-4 shrink-0 accent-red-600"
                  />
                  <span>
                    Tôi hiểu đây là thao tác xóa tài liệu khỏi toàn session và
                    đồng ý tiếp tục. Các kết quả lập hồ sơ, đánh số, mục lục và
                    xuất bản hiện tại có thể không còn hợp lệ.
                  </span>
                </label>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3 sm:flex-row sm:justify-end">
            <Dialog.Close asChild>
              <Button variant="outline" disabled={submitting}>
                Đóng
              </Button>
            </Dialog.Close>
            {pendingDocuments.length > 0 && !operation?.retry_exhausted ? (
              <Button onClick={() => void retryDelete()} disabled={submitting}>
                {submitting ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                ) : (
                  <RefreshCw data-icon="inline-start" />
                )}
                Thử xóa lại
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={() => void submitDelete()}
                disabled={
                  submitting || loadingPreview || !preview?.allowed || !sessionId
                  || !confirmed
                }
              >
                {submitting ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                ) : (
                  <Trash2 data-icon="inline-start" />
                )}
                Xóa khỏi session
              </Button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function jobTypeLabel(jobType: string): string {
  return (
    {
      build_clusters: "Lập hồ sơ",
      refresh_dossier_classification: "Cập nhật phân loại hồ sơ",
      number_documents: "Đánh số tài liệu",
      finalize_artifacts: "Tạo mục lục",
      build_publication_archive: "Tạo gói xuất bản",
      poll_ingestion_extract: "Giải nén dữ liệu đầu vào",
      start_digitization: "Bắt đầu số hóa",
      poll_digitization: "Theo dõi số hóa",
      process_digitization_document: "OCR tài liệu",
      sync_digitization_document_metadata: "Đồng bộ metadata",
      refresh_final_metadata: "Cập nhật metadata cuối",
      document_mutation: "Thay đổi tập tài liệu",
    }[jobType] ?? jobType
  )
}

function deletionBlockerLabel(blocker: DocumentDeletionBlocker): string {
  if (blocker.code === "DOCUMENT_ALREADY_CLUSTERED") {
    return (
      blocker.message ||
      `Tài liệu ${blocker.file_name || `#${blocker.session_document_id ?? ""}`} đã từng được lập hồ sơ và không thể xóa.`
    )
  }
  if (
    blocker.code === "DOCUMENT_DELETION_LOCKED_AFTER_CLUSTERING" &&
    blocker.message
  ) {
    return blocker.message
  }
  if (blocker.type === "document_edit_lock") {
    const owner =
      blocker.owner?.name || blocker.owner?.email || blocker.owner?.user_id
    const documentId = blocker.document_id ?? blocker.session_document_id
    return [
      documentId ? `Tài liệu #${documentId}` : "Tài liệu",
      owner ? `đang được ${owner} chỉnh sửa` : "đang được chỉnh sửa",
      blocker.expires_at ? `đến ${blocker.expires_at}` : "",
    ]
      .filter(Boolean)
      .join(" ")
  }
  return `${jobTypeLabel(blocker.job_type ?? "task")} · ${blocker.status ?? "active"}`
}

function deletionErrorMessage(caught: unknown, fallback: string): string {
  if (!(caught instanceof Error) || !caught.message) return fallback
  try {
    const detail = JSON.parse(caught.message) as {
      message?: unknown
      blocking_jobs?: Array<{
        message?: unknown
        job_type?: unknown
        status?: unknown
      }>
    }
    const message =
      typeof detail.message === "string" && detail.message.trim()
        ? detail.message.trim()
        : fallback
    const blockers = Array.isArray(detail.blocking_jobs)
      ? detail.blocking_jobs
          .map((blocker) => {
            const blockerMessage = String(blocker.message ?? "").trim()
            if (blockerMessage) return blockerMessage
            const jobType = String(blocker.job_type ?? "").trim()
            const status = String(blocker.status ?? "").trim()
            return jobType
              ? `${jobTypeLabel(jobType)}${status ? ` (${status})` : ""}`
              : ""
          })
          .filter(Boolean)
      : []
    return blockers.length > 0 ? `${message} ${blockers.join(", ")}.` : message
  } catch {
    return caught.message
  }
}
