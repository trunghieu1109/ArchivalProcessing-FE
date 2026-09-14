export const DOCUMENT_TRANSFER_UI_REFRESH_EVENT =
  "archival:document-transfer-refresh"

export interface DocumentTransferUiRefreshDetail {
  requestId?: string | null
  sourceSessionId?: string | null
  targetSessionId?: string | null
  status?: string | null
}

export function notifyDocumentTransferUiRefresh(
  detail: DocumentTransferUiRefreshDetail
): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent<DocumentTransferUiRefreshDetail>(
      DOCUMENT_TRANSFER_UI_REFRESH_EVENT,
      { detail }
    )
  )
}

export function documentTransferRefreshAffectsSession(
  detail: DocumentTransferUiRefreshDetail | undefined,
  sessionId: string
): boolean {
  if (!detail) return true
  return (
    detail.sourceSessionId === sessionId || detail.targetSessionId === sessionId
  )
}

export function isDocumentTransferRefreshEventType(eventType: string): boolean {
  return (
    eventType.startsWith("document_transfer.request.") ||
    eventType === "documents.transfer_requested" ||
    eventType.startsWith("documents.transfer_out_") ||
    eventType.startsWith("documents.transfer_in_")
  )
}
