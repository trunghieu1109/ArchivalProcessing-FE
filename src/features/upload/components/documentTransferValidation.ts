import type { DocumentTransferPreviewResponse } from "@/features/upload/api/sessionApi"

interface TransferValidationTarget {
  id: number
  name: string
}

export function transferValidationMessages(
  errors: DocumentTransferPreviewResponse["validation_errors"],
  targets: TransferValidationTarget[],
  blockingJobs: DocumentTransferPreviewResponse["blocking_jobs"] = [],
  duplicates: DocumentTransferPreviewResponse["duplicates"] = []
): string[] {
  const namesById = new Map(targets.map((target) => [target.id, target.name]))
  return [
    ...new Set(
      [
        ...errors.map((item) => {
          const name = item.session_document_id
            ? namesById.get(item.session_document_id)
            : undefined
          const request = item.request_id ? ` Yêu cầu: ${item.request_id}.` : ""
          return `${name ? `${name}: ` : ""}${item.message}${request}`
        }),
        ...blockingJobs.map((blocker) => {
          const role =
            blocker.session_role === "target" ? "Phông đích" : "Phông nguồn"
          if (blocker.job_type === "document_mutation") {
            return `${role} đang có thao tác thay đổi tài liệu (${blocker.status || "đang xử lý"}).`
          }
          if (blocker.job_type) {
            return `${role} đang có tác vụ ${blocker.job_type} (${blocker.status || "đang xử lý"}).`
          }
          return "Một tài liệu đang bị khóa chỉnh sửa. Hãy thử lại sau khi khóa được giải phóng."
        }),
        ...(duplicates.length > 0
          ? [`Phông đích đã có ${duplicates.length} tài liệu trùng tham chiếu từ xa.`]
          : []),
      ]
    ),
  ]
}
