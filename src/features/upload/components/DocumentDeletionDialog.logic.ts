import type { DocumentDeletionBlocker } from "@/features/upload/api/sessionApi"

export function jobTypeLabel(jobType: string): string {
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

export function deletionBlockerLabel(
  blocker: DocumentDeletionBlocker
): string {
  if (blocker.code === "DOCUMENT_ALREADY_CLUSTERED") {
    return (
      blocker.message ||
      `Tài liệu ${blocker.file_name || `#${blocker.session_document_id ?? blocker.document_id ?? ""}`} đã từng được lập hồ sơ và không thể xóa.`
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

function withoutTerminalPunctuation(value: string): string {
  return value.replace(/[.,;:!?]+$/u, "")
}

export function deletionErrorMessage(
  caught: unknown,
  fallback: string
): string {
  if (!(caught instanceof Error) || !caught.message) return fallback
  const detail = deletionErrorDetail(caught)
  if (detail) {
    const message =
      typeof detail.message === "string" && detail.message.trim()
        ? detail.message.trim()
        : caught.message || fallback
    const blockers = Array.isArray(detail.blocking_jobs)
      ? detail.blocking_jobs
          .map((blocker) => {
            const blockerMessage = String(blocker.message ?? "").trim()
            if (blockerMessage) return withoutTerminalPunctuation(blockerMessage)
            const jobType = String(blocker.job_type ?? "").trim()
            const status = String(blocker.status ?? "").trim()
            return jobType
              ? `${jobTypeLabel(jobType)}${status ? ` (${status})` : ""}`
              : ""
          })
          .filter(Boolean)
      : []
    return blockers.length > 0
      ? `${withoutTerminalPunctuation(message)}: ${blockers.join(", ")}.`
      : message
  }
  return caught.message
}

interface DeletionErrorDetail {
  message?: unknown
  blocking_jobs?: Array<{
    message?: unknown
    job_type?: unknown
    status?: unknown
  }>
}

function deletionErrorDetail(caught: Error): DeletionErrorDetail | null {
  const apiDetail = (caught as Error & { detail?: unknown }).detail
  if (isRecord(apiDetail)) return apiDetail as DeletionErrorDetail
  try {
    const parsed = JSON.parse(caught.message) as unknown
    return isRecord(parsed) ? (parsed as DeletionErrorDetail) : null
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
