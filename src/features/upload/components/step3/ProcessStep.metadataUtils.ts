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

const REEXTRACT_STALE_RESPONSE_GRACE_MS = 30_000

export function mergeIncomingMetadata(
  previous: PdfMetadata[],
  incoming: PdfMetadata[],
  options: { keepMissing?: boolean } = {}
): PdfMetadata[] {
  const keepMissing = options.keepMissing ?? true
  const previousById = new Map(previous.map((item) => [item.id, item]))
  const incomingIds = new Set(incoming.map((item) => item.id))
  const merged = incoming.map((rawItem) => {
    const item = normalizePdfMetadata(rawItem)
    const local = previousById.get(item.id)
    const sameOcrBatch =
      local?.ocr_batch_id === undefined ||
      item.ocr_batch_id === undefined ||
      local.ocr_batch_id === item.ocr_batch_id
    if (local && shouldKeepLocalReextractingState(local, item)) {
      return {
        ...local,
        metadata_batch_id: item.metadata_batch_id,
        metadata_batch_name: item.metadata_batch_name,
        metadata_batch_assigned_to_user_id:
          item.metadata_batch_assigned_to_user_id,
        metadata_batch_assigned_to_email: item.metadata_batch_assigned_to_email,
        metadata_batch_assigned_to_name: item.metadata_batch_assigned_to_name,
        metadata_batch_assigned_at: item.metadata_batch_assigned_at,
        edit_lock: item.edit_lock,
      }
    }
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
        signature_status: item.signature_status,
        metadata_batch_id: item.metadata_batch_id,
        metadata_batch_name: item.metadata_batch_name,
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
        edit_lock: item.edit_lock,
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
          signature_status: item.signature_status,
          status: item.status,
        }),
      }
    }
    return item
  })
  if (keepMissing) {
    previous.forEach((item) => {
      if (!incomingIds.has(item.id)) {
        merged.push(normalizePdfMetadata(item))
      }
    })
  }
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

export function replaceMetadataItem(
  items: PdfMetadata[],
  nextItem: PdfMetadata
): PdfMetadata[] {
  return items.map((item) => (item.id === nextItem.id ? nextItem : item))
}

export function resetMetadataItemForReextract(item: PdfMetadata): PdfMetadata {
  return normalizePdfMetadata({
    ...item,
    status: "processing",
    remote_metadata_status: "processing",
    signature_status: "processing",
    review_status: "pending",
    is_reviewed: false,
    metadata_ready: false,
    metadata_final: false,
    metadata_user_edited: false,
    metadata_verified_by_user_id: null,
    metadata_verified_by_email: null,
    metadata_verified_by_name: null,
    metadata_verified_at: null,
    metadata_review_note: null,
    error: null,
    light_metadata: {},
    normalized_metadata: {},
    raw_metadata: {},
    applied: false,
    metadata_reextract_started_at: Date.now(),
  })
}

export function resetMetadataItemsForReextract(
  items: PdfMetadata[],
  documentIds: Set<number>
): PdfMetadata[] {
  return items.map((item) =>
    documentIds.has(item.id) ? resetMetadataItemForReextract(item) : item
  )
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
  const status = String(
    document.remote_metadata_status || document.ocr_status || ""
  )
    .trim()
    .toLowerCase()
  const reextractStartedAt =
    METADATA_RUNNING_STATUSES.has(status) && !document.metadata_ready
      ? Date.now()
      : undefined
  return {
    id: document.id,
    ocr_batch_id: document.ocr_batch_id,
    document_id: document.document_id,
    data_path: document.data_path,
    import_action: document.import_action,
    metadata_batch_id: document.metadata_batch_id,
    metadata_batch_name: document.metadata_batch_name,
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
    edit_lock: document.edit_lock,
    status: document.ocr_status,
    remote_metadata_status: document.remote_metadata_status,
    signature_status: document.signature_status,
    review_status: reviewStatus,
    is_reviewed: document.is_reviewed === true,
    metadata_ready: document.metadata_ready,
    metadata_final: document.metadata_final,
    metadata_version_count: document.metadata_version_count,
    metadata_reextract_started_at: reextractStartedAt,
    metadata_user_edited: reextractStartedAt
      ? false
      : documentHasUserMetadataEdit(document),
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
      remote_metadata_status: item.remote_metadata_status,
      signature_status: item.signature_status,
      ocr_status: item.status,
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
    metadata_reextract_started_at: isMetadataExtractionPending(item)
      ? item.metadata_reextract_started_at
      : undefined,
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

export const METADATA_RUNNING_STATUSES = new Set([
  "pending",
  "queued",
  "running",
  "processing",
  "submitted",
  "ocr_done",
  "metadata_priority_running",
  "metadata_running",
  "cancel_requested",
])

export const METADATA_FAILED_STATUSES = new Set([
  "failed",
  "final_failed",
  "signature_failed",
  "skipped",
  "cancelled",
  "missing_task",
])

export function isMetadataFailedItem(item: PdfMetadata): boolean {
  return METADATA_FAILED_STATUSES.has(normalizedMetadataStatus(item))
}

export function isMetadataExtractionPending(item: PdfMetadata): boolean {
  const status = normalizedMetadataStatus(item)
  return (
    (!item.metadata_ready && METADATA_RUNNING_STATUSES.has(status)) ||
    (!item.metadata_ready && !isMetadataFailedItem(item))
  )
}

export function needsMetadataReview(item: PdfMetadata): boolean {
  return (
    !isMetadataExtractionPending(item) &&
    item.metadata_ready &&
    item.is_reviewed !== true &&
    (item.review_status !== "verified" || hasMetadataWarning(item))
  )
}

export function isMetadataConfirmable(item: PdfMetadata): boolean {
  return (
    !isMetadataExtractionPending(item) &&
    item.metadata_ready &&
    item.is_reviewed !== true
  )
}

export function isAutomaticallyVerifiedMetadata(item: PdfMetadata): boolean {
  return (
    !isMetadataExtractionPending(item) &&
    item.metadata_ready &&
    item.is_reviewed !== true &&
    !needsMetadataReview(item)
  )
}

function shouldKeepLocalReextractingState(
  local: PdfMetadata,
  incoming: PdfMetadata
): boolean {
  if (!isMetadataExtractionPending(local)) return false
  if (isMetadataExtractionPending(incoming)) return false
  if (isMetadataFailedItem(incoming)) return false
  if (!local.metadata_reextract_started_at) return false

  const localVersion = local.metadata_version_count
  const incomingVersion = incoming.metadata_version_count
  if (
    localVersion !== undefined &&
    incomingVersion !== undefined &&
    incomingVersion > localVersion
  ) {
    return false
  }

  return (
    Date.now() - local.metadata_reextract_started_at <
    REEXTRACT_STALE_RESPONSE_GRACE_MS
  )
}
