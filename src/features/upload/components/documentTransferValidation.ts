import type { DocumentTransferPreviewResponse } from "@/features/upload/api/sessionApi"

interface TransferValidationTarget {
  id: number
  name: string
}

export function transferValidationMessages(
  errors: DocumentTransferPreviewResponse["validation_errors"],
  targets: TransferValidationTarget[]
): string[] {
  const namesById = new Map(targets.map((target) => [target.id, target.name]))
  return [
    ...new Set(
      errors.map((item) => {
        const name = item.session_document_id
          ? namesById.get(item.session_document_id)
          : undefined
        const request = item.request_id ? ` Yêu cầu: ${item.request_id}.` : ""
        return `${name ? `${name}: ` : ""}${item.message}${request}`
      })
    ),
  ]
}
