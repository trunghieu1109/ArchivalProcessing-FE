import type { ClusterDocument } from "@/features/upload/lib/clusterGroups"

export function isSupplementalPlacementPending(
  document: ClusterDocument
): boolean {
  return Boolean(document.metadata.supplemental_intake_id)
}

export function hasDraftSupplementalDocuments(
  documents: ClusterDocument[]
): boolean {
  return documents.some(
    (document) =>
      isSupplementalPlacementPending(document) &&
      supplementalArrangementStatus(document) !== "active"
  )
}

export function hasPendingSupplementalDocuments(
  documents: ClusterDocument[]
): boolean {
  return documents.some(isSupplementalPlacementPending)
}

export function usesDraftDocumentActions(
  document: ClusterDocument,
  inDraftDossier: boolean
): boolean {
  return inDraftDossier || isSupplementalPlacementPending(document)
}

export function supplementalPlacementLabel(document: ClusterDocument): string {
  return supplementalArrangementStatus(document) === "active"
    ? "Chờ cập nhật hồ sơ"
    : "Bản nháp"
}

export function supplementalPlacementDetails(
  document: ClusterDocument
): string {
  return supplementalArrangementStatus(document) === "active"
    ? "Tài liệu bổ sung đã được xác nhận và đang chờ cập nhật vào hồ sơ."
    : "Tài liệu bổ sung chưa được xác nhận OCR; vẫn là bản nháp ở cuối hồ sơ."
}

function supplementalArrangementStatus(
  document: ClusterDocument
): string | null {
  const value = document.metadata.arrangement_status
  return typeof value === "string" ? value : null
}
