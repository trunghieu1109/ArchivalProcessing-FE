export const DOCUMENT_EDIT_LOCKED_MESSAGE =
  "Tài liệu này đang được chỉnh sửa bởi người khác. Vui lòng thử lại sau."

export function isDocumentEditLockedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false

  const message = error.message.toLowerCase()
  const status = errorStatus(error)
  if (status !== null) {
    if (status === 423) return true
    if (status === 409) {
      return (
        message.includes("lock_token") ||
        message.includes("edit lock") ||
        message.includes("locked") ||
        message.includes("chỉnh sửa")
      )
    }
  }

  return (
    message.includes("document edit lock") ||
    message.includes("document is locked") ||
    ["being edited", "by another user"].every((part) =>
      message.includes(part)
    ) ||
    message.includes("đang được chỉnh sửa")
  )
}

function errorStatus(error: Error): number | null {
  const status = (error as { status?: unknown }).status
  return typeof status === "number" ? status : null
}
