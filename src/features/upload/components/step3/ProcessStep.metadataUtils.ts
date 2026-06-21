import {
  documentHasUserMetadataEdit,
  normalizeDocumentReviewStatus,
  type SessionDocumentResponse,
} from "@/features/upload/api/sessionApi"
import {
  buildDisplayMetadata,
  hasMetadataWarning,
} from "@/features/upload/lib/metadata"
import type { PdfMetadata } from "@/features/upload/types"

export function mergeIncomingMetadata(
  previous: PdfMetadata[],
  incoming: PdfMetadata[]
): PdfMetadata[] {
  const previousById = new Map(previous.map((item) => [item.id, item]))
  const incomingIds = new Set(incoming.map((item) => item.id))
  const merged = incoming.map((rawItem) => {
    const item = normalizePdfMetadata(rawItem)
    const local = previousById.get(item.id)
    const sameOcrBatch =
      local?.ocr_batch_id === undefined ||
      item.ocr_batch_id === undefined ||
      local.ocr_batch_id === item.ocr_batch_id
    if (
      local?.is_reviewed === true &&
      item.is_reviewed !== true &&
      sameOcrBatch
    ) {
      const normalizedMetadata =
        item.normalized_metadata ?? local.normalized_metadata
      const rawMetadata = item.raw_metadata ?? local.raw_metadata
      return {
        ...local,
        ocr_batch_id: item.ocr_batch_id,
        import_action: item.import_action,
        status: item.status,
        remote_metadata_status: item.remote_metadata_status,
        metadata_batch_id: item.metadata_batch_id,
        metadata_batch_assigned_to_user_id:
          item.metadata_batch_assigned_to_user_id,
        metadata_batch_assigned_to_email: item.metadata_batch_assigned_to_email,
        metadata_batch_assigned_to_name: item.metadata_batch_assigned_to_name,
        metadata_batch_assigned_at: item.metadata_batch_assigned_at,
        metadata_verified_by_user_id: item.metadata_verified_by_user_id,
        metadata_verified_by_email: item.metadata_verified_by_email,
        metadata_verified_by_name: item.metadata_verified_by_name,
        metadata_verified_at: item.metadata_verified_at,
        metadata_review_note: item.metadata_review_note,
        is_reviewed: local.is_reviewed,
        metadata_ready: item.metadata_ready,
        metadata_final: item.metadata_final,
        normalized_metadata: normalizedMetadata,
        raw_metadata: rawMetadata,
        light_metadata: buildDisplayMetadata({
          light_metadata: local.light_metadata,
          normalized_metadata: normalizedMetadata,
          raw_metadata: rawMetadata,
          remote_metadata_status: item.remote_metadata_status,
          status: item.status,
        }),
      }
    }
    return item
  })
  previous.forEach((item) => {
    if (!incomingIds.has(item.id)) {
      merged.push(normalizePdfMetadata(item))
    }
  })
  return merged
}

export function replaceVerifiedDocument(
  items: PdfMetadata[],
  document: SessionDocumentResponse
): PdfMetadata[] {
  const next = documentResponseToPdfMetadata(document)
  return items.map((item) => (item.id === next.id ? next : item))
}

export function replaceDocument(
  items: PdfMetadata[],
  document: SessionDocumentResponse
): PdfMetadata[] {
  const next = documentResponseToPdfMetadata(document)
  return items.map((item) => (item.id === next.id ? next : item))
}

export function replaceVerifiedDocuments(
  items: PdfMetadata[],
  documents: SessionDocumentResponse[]
): PdfMetadata[] {
  return replaceDocuments(items, documents)
}

export function replaceDocuments(
  items: PdfMetadata[],
  documents: SessionDocumentResponse[]
): PdfMetadata[] {
  const byId = new Map(
    documents.map((document) => {
      const item = documentResponseToPdfMetadata(document)
      return [item.id, item] as const
    })
  )
  return items.map((item) => byId.get(item.id) ?? item)
}

export function documentResponseToPdfMetadata(
  document: SessionDocumentResponse
): PdfMetadata {
  const lightMetadata = buildDisplayMetadata(document)
  const reviewStatus = normalizeDocumentReviewStatus(document, lightMetadata)
  return {
    id: document.id,
    ocr_batch_id: document.ocr_batch_id,
    document_id: document.document_id,
    data_path: document.data_path,
    import_action: document.import_action,
    metadata_batch_id: document.metadata_batch_id,
    metadata_batch_assigned_to_user_id:
      document.metadata_batch_assigned_to_user_id,
    metadata_batch_assigned_to_email: document.metadata_batch_assigned_to_email,
    metadata_batch_assigned_to_name: document.metadata_batch_assigned_to_name,
    metadata_batch_assigned_at: document.metadata_batch_assigned_at,
    metadata_verified_by_user_id: document.metadata_verified_by_user_id,
    metadata_verified_by_email: document.metadata_verified_by_email,
    metadata_verified_by_name: document.metadata_verified_by_name,
    metadata_verified_at: document.metadata_verified_at,
    metadata_review_note: document.metadata_review_note,
    status: document.ocr_status,
    remote_metadata_status: document.remote_metadata_status,
    review_status: reviewStatus,
    is_reviewed: document.is_reviewed === true,
    metadata_ready: document.metadata_ready,
    metadata_final: document.metadata_final,
    metadata_version_count: document.metadata_version_count,
    metadata_user_edited: documentHasUserMetadataEdit(document),
    error: document.error,
    light_metadata: lightMetadata,
    normalized_metadata: document.normalized_metadata,
    raw_metadata: document.raw_metadata,
    applied: document.is_reviewed === true || reviewStatus === "verified",
  }
}

export function normalizePdfMetadata(item: PdfMetadata): PdfMetadata {
  const reviewStatus = normalizeDocumentReviewStatus(
    {
      review_status: item.review_status,
      metadata_ready: item.metadata_ready,
    },
    item.light_metadata
  )
  const applied = item.is_reviewed === true || reviewStatus === "verified"
  if (reviewStatus === item.review_status && item.applied === applied) {
    return item
  }
  return {
    ...item,
    review_status: reviewStatus,
    applied,
  }
}

export function metadataSortScore(item: PdfMetadata): number {
  if (isMetadataExtractionPending(item)) return 0
  if (isMetadataFailedItem(item)) return 1
  if (needsMetadataReview(item)) return 2
  if (isAutomaticallyVerifiedMetadata(item)) return 3
  return 4
}

export function normalizedMetadataStatus(item: PdfMetadata): string {
  return String(item.remote_metadata_status || item.status || "")
    .trim()
    .toLowerCase()
}

export function isMetadataFailedItem(item: PdfMetadata): boolean {
  return [
    "failed",
    "final_failed",
    "signature_failed",
    "skipped",
    "cancelled",
  ].includes(normalizedMetadataStatus(item))
}

export function isMetadataExtractionPending(item: PdfMetadata): boolean {
  return !item.metadata_ready && !isMetadataFailedItem(item)
}

export function needsMetadataReview(item: PdfMetadata): boolean {
  return (
    item.metadata_ready &&
    item.is_reviewed !== true &&
    (item.review_status !== "verified" || hasMetadataWarning(item))
  )
}

export function isMetadataConfirmable(item: PdfMetadata): boolean {
  return item.metadata_ready && item.is_reviewed !== true
}

export function isAutomaticallyVerifiedMetadata(item: PdfMetadata): boolean {
  return (
    item.metadata_ready &&
    item.is_reviewed !== true &&
    !needsMetadataReview(item)
  )
}
