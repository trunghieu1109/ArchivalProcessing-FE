import type { ClusterDocument } from "@/features/upload/lib/clusterGroups"

export function isDocumentTransferLocked(document: ClusterDocument): boolean {
  return (
    Boolean(document.activeTransferRequestId) ||
    document.lifecycleStatus === "transfer_pending"
  )
}

export function documentTransferLockLabel(document: ClusterDocument): string {
  return document.activeTransferRequestStatus === "accepting"
    ? "Đang chuyển Phông"
    : "Đang chờ chuyển Phông"
}

export function documentTransferLockDetails(document: ClusterDocument): string {
  const request = document.activeTransferRequestId
    ? ` Yêu cầu: ${document.activeTransferRequestId}.`
    : ""
  return `${documentTransferLockLabel(document)}; tài liệu tạm khóa và không thể chỉnh sửa hoặc tạo yêu cầu chuyển mới.${request}`
}

export function transferSelectionError(
  documents: ClusterDocument[]
): string | null {
  const transferLocked = documents.filter(isDocumentTransferLocked)
  if (transferLocked.length > 0) {
    return transferLocked.length === 1
      ? `Không thể chuyển Phông: ${documentNames(transferLocked)} đang thuộc một yêu cầu chuyển chưa được xử lý.`
      : `Không thể chuyển Phông vì ${transferLocked.length} tài liệu đã chọn đang thuộc yêu cầu chuyển chưa được xử lý: ${documentNames(transferLocked)}.`
  }

  const inactive = documents.filter(
    (document) =>
      Boolean(document.lifecycleStatus) && document.lifecycleStatus !== "active"
  )
  if (inactive.length > 0) {
    return inactive.length === 1
      ? `Không thể chuyển Phông: ${documentNames(inactive)} không còn ở trạng thái hoạt động.`
      : `Không thể chuyển Phông vì ${inactive.length} tài liệu đã chọn không còn ở trạng thái hoạt động: ${documentNames(inactive)}.`
  }

  return null
}

function documentNames(documents: ClusterDocument[]): string {
  const displayed = documents
    .slice(0, 3)
    .map((document) => `“${document.fileName}”`)
    .join(", ")
  const remaining = documents.length - 3
  return remaining > 0
    ? `${displayed} và ${remaining} tài liệu khác`
    : displayed
}
