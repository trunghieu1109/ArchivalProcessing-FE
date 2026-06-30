import type {
  FolderStatusResponse,
  JobSummary,
} from "@/features/upload/api/ocrApi"
import {
  buildDisplayMetadata,
  hasMetadataWarning,
} from "@/features/upload/lib/metadata"
import {
  apiUrl,
  downloadFileName,
  requestJson,
  requestJsonOrNull,
  responseErrorMessage,
  withAuth,
} from "./sessionApi.http"
import { documentHasUserMetadataEdit } from "./sessionApi.types"
import type {
  AutoMetadataBatchPlanResponse,
  BulkVerifyDocumentsResponse,
  CloseMetadataBatchResponse,
  CreateMetadataBatchResponse,
  DigitizationDocument,
  DigitizationStatusResponse,
  DocumentArchiveDownload,
  DocumentNumberingMode,
  DocumentNumberingStylePreset,
  MetadataDocumentScope,
  DocumentPreviewUrlResponse,
  SessionDocumentResponse,
  UploadMode,
} from "./sessionApi.types"

export async function startDigitization(
  sessionId: string,
  payload: {
    folder_path: string
    recursive?: boolean
    force?: boolean
    max_files?: number
    confirmed_plan_version_id?: string
    document_numbering_mode?: DocumentNumberingMode
    document_numbering_style_preset?: DocumentNumberingStylePreset
    document_numbering_style_overrides?: {
      font_size?: number
      color?: string
      opacity?: number
    } | null
    remove_blank_pages_before_ocr?: boolean
    session_file_id?: number
    remote_file_id?: string | number | null
    upload_mode?: UploadMode
    overwrite?: boolean
  }
): Promise<void> {
  await requestJson<unknown>(
    `/sessions/${encodeURIComponent(sessionId)}/digitization/start`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recursive: true,
        force: false,
        remove_blank_pages_before_ocr: true,
        ...payload,
      }),
    }
  )
}

export async function getDigitizationStatus(
  sessionId: string,
  options: {
    includeDocuments?: boolean
    summaryOnly?: boolean
    limit?: number
    offset?: number
    metadataDocumentScope?: MetadataDocumentScope
  } = {}
): Promise<DigitizationStatusResponse | null> {
  const searchParams = new URLSearchParams()
  if (options.includeDocuments !== undefined) {
    searchParams.set("include_documents", String(options.includeDocuments))
  }
  if (options.summaryOnly !== undefined) {
    searchParams.set("summary_only", String(options.summaryOnly))
  }
  if (options.limit !== undefined)
    searchParams.set("limit", String(options.limit))
  if (options.offset !== undefined)
    searchParams.set("offset", String(options.offset))
  const metadataScope = options.metadataDocumentScope
  if (metadataScope && metadataScope.scope !== "all") {
    searchParams.set("metadata_batch_scope", metadataScope.scope)
    if (metadataScope.batchId) {
      searchParams.set("metadata_batch_id", metadataScope.batchId)
    }
    if (metadataScope.scope === "auto") {
      searchParams.set(
        "metadata_batch_offset",
        String(Math.max(0, Math.floor(metadataScope.offset ?? 0)))
      )
      if (metadataScope.size !== undefined) {
        searchParams.set(
          "metadata_batch_size",
          String(Math.max(1, Math.floor(metadataScope.size)))
        )
      }
    }
  }
  const query = searchParams.toString()
  return requestJsonOrNull<DigitizationStatusResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/digitization${query ? `?${query}` : ""}`
  )
}

export async function verifyDocumentMetadata(
  sessionId: string,
  documentId: number,
  metadata?: Record<string, unknown>
): Promise<SessionDocumentResponse> {
  return requestJson<SessionDocumentResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/documents/${encodeURIComponent(String(documentId))}/verify`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metadata, created_by: "ui" }),
    }
  )
}

export async function bulkVerifyDocumentMetadata(
  sessionId: string,
  documentIds: number[]
): Promise<BulkVerifyDocumentsResponse> {
  return requestJson<BulkVerifyDocumentsResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/documents/bulk-verify`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        document_ids: documentIds,
        created_by: "ui",
      }),
    }
  )
}

export async function createMetadataBatch(
  sessionId: string,
  documentIds: number[],
  assignedToUserId: string | number
): Promise<CreateMetadataBatchResponse> {
  return requestJson<CreateMetadataBatchResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/metadata-batches`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        document_ids: documentIds,
        assigned_to_user_id: assignedToUserId,
      }),
    }
  )
}

export async function getAutoMetadataBatchPlan(
  sessionId: string,
  batchCount: number
): Promise<AutoMetadataBatchPlanResponse> {
  const query = new URLSearchParams({
    batch_count: String(Math.max(1, Math.floor(batchCount))),
  })
  return requestJson<AutoMetadataBatchPlanResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/metadata-batches/auto-plan?${query.toString()}`
  )
}

export async function closeMetadataBatch(
  sessionId: string,
  batchId: string
): Promise<CloseMetadataBatchResponse> {
  return requestJson<CloseMetadataBatchResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/metadata-batches/${encodeURIComponent(batchId)}/close`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }
  )
}

export async function restartDocumentMetadata(
  sessionId: string,
  documentId: number,
  payload: { force?: boolean } = {}
): Promise<SessionDocumentResponse> {
  return requestJson<SessionDocumentResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/documents/${encodeURIComponent(String(documentId))}/restart-metadata`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        force: true,
        ...payload,
      }),
    }
  )
}

export async function getDocumentPreviewUrl(
  sessionId: string,
  documentId: number
): Promise<DocumentPreviewUrlResponse> {
  return requestJson<DocumentPreviewUrlResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/documents/${encodeURIComponent(String(documentId))}/preview-url`
  )
}

export async function downloadSessionDocuments(
  sessionId: string,
  documentIds: number[]
): Promise<DocumentArchiveDownload> {
  const response = await fetch(
    apiUrl(`/sessions/${encodeURIComponent(sessionId)}/documents/download`),
    withAuth({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document_ids: documentIds }),
    })
  )
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response))
  }
  return {
    blob: await response.blob(),
    fileName:
      downloadFileName(response.headers.get("content-disposition")) ||
      `${sessionId}-documents.zip`,
  }
}

export async function downloadSessionMetadataReviewXlsx(
  sessionId: string
): Promise<DocumentArchiveDownload> {
  const response = await fetch(
    apiUrl(
      `/sessions/${encodeURIComponent(sessionId)}/documents/metadata-export`
    ),
    withAuth()
  )
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response))
  }
  return {
    blob: await response.blob(),
    fileName:
      downloadFileName(response.headers.get("content-disposition")) ||
      `${sessionId}-metadata-review.xlsx`,
  }
}

export function digitizationToFolderStatus(
  response: DigitizationStatusResponse | null,
  fallbackFolderPath: string
): FolderStatusResponse {
  const batch = response?.batches[0]
  const documents = response?.documents ?? []
  const summary = response?.summary
  const responseDocumentTotal = summary?.total_documents ?? documents.length
  const batchComplete = ["done", "completed_with_errors", "failed"].includes(
    String(batch?.status || "")
      .trim()
      .toLowerCase()
  )
  const latestBatchDocumentCount =
    response?.pagination !== undefined
      ? responseDocumentTotal
      : batch?.id == null
        ? documents.length
        : documents.filter((document) => document.ocr_batch_id === batch.id)
            .length
  const pendingBatchDocumentCount = Math.max(
    0,
    batchComplete ? 0 : (batch?.total_files ?? 0) - latestBatchDocumentCount
  )
  const cumulativeDocumentCount =
    batch?.upload_mode === "append"
      ? responseDocumentTotal + pendingBatchDocumentCount
      : Math.max(responseDocumentTotal, batch?.total_files ?? 0)
  const jobs: JobSummary[] = documents.map((document) => {
    const lightMetadata = buildDisplayMetadata(document)
    return {
      id: document.id,
      ocr_batch_id: document.ocr_batch_id,
      document_id: document.document_id,
      data_path: document.data_path,
      import_action: document.import_action,
      metadata_batch_id: document.metadata_batch_id,
      metadata_batch_assigned_to_user_id:
        document.metadata_batch_assigned_to_user_id,
      metadata_batch_assigned_to_email:
        document.metadata_batch_assigned_to_email,
      metadata_batch_assigned_to_name: document.metadata_batch_assigned_to_name,
      metadata_batch_assigned_at: document.metadata_batch_assigned_at,
      metadata_verified_by_user_id: document.metadata_verified_by_user_id,
      metadata_verified_by_email: document.metadata_verified_by_email,
      metadata_verified_by_name: document.metadata_verified_by_name,
      metadata_verified_at: document.metadata_verified_at,
      metadata_review_note: document.metadata_review_note,
      status: document.ocr_status,
      remote_metadata_status: document.remote_metadata_status,
      signature_status: document.signature_status,
      review_status: normalizeDocumentReviewStatus(document, lightMetadata),
      is_reviewed: document.is_reviewed === true,
      metadata_ready: document.metadata_ready,
      metadata_final: document.metadata_final,
      metadata_version_count: document.metadata_version_count,
      metadata_user_edited: documentHasUserMetadataEdit(document),
      error: document.error,
      light_metadata: lightMetadata,
      normalized_metadata: document.normalized_metadata,
      raw_metadata: document.raw_metadata,
      pdf_preprocessing: document.pdf_preprocessing,
    }
  })
  const statusCounts = summary?.status_counts ?? batch?.status_counts ?? {}
  const processingDocumentCount =
    summary?.processing_documents ??
    countMetadataRunningStatuses(statusCounts) ??
    countRunningJobs(jobs)
  return {
    batch_id: batch?.id ?? null,
    folder_path: batch?.folder_path ?? fallbackFolderPath,
    recursive: batch?.recursive ?? true,
    total_files: cumulativeDocumentCount,
    total_jobs: Math.max(
      cumulativeDocumentCount,
      responseDocumentTotal +
        Math.max(0, (batch?.total_jobs ?? 0) - latestBatchDocumentCount)
    ),
    missing_files: batch?.missing_files ?? [],
    status_counts: statusCounts,
    pagination: response?.pagination,
    document_numbering_mode: batch?.document_numbering_mode ?? null,
    remove_blank_pages_before_ocr: batch?.remove_blank_pages_before_ocr ?? true,
    upload_mode: batch?.upload_mode ?? null,
    reextracting: false,
    pdf_preprocessing: batch?.pdf_preprocessing ?? null,
    metadata_extraction_status: batch?.metadata_extraction_status ?? null,
    metadata_extraction_complete: batch?.metadata_extraction_complete ?? null,
    metadata_extraction_completed_at:
      batch?.metadata_extraction_completed_at ?? null,
    digitization_complete: batch?.digitization_complete ?? null,
    metadata_ready_documents: summary?.metadata_ready,
    metadata_final_documents: summary?.metadata_final,
    metadata_complete_documents: summary?.complete_documents,
    metadata_processing_documents: processingDocumentCount,
    metadata_usable_documents: summary?.metadata_usable_documents,
    metadata_perfect_documents: summary?.perfect_documents,
    metadata_failed_documents: summary?.failed_documents,
    metadata_skipped_documents: summary?.skipped_documents,
    metadata_cancelled_documents: summary?.cancelled_documents,
    metadata_missing_task_documents: summary?.missing_task_documents,
    metadata_verified_documents: summary?.verified,
    metadata_reviewed_documents: summary?.reviewed,
    metadata_warning_documents: summary?.warning,
    metadata_batches: response?.metadata_batches ?? [],
    signature_extracted_documents:
      summary?.signature_extracted_documents ??
      documents.filter(
        (document) => documentSignatureStatus(document) === "done"
      ).length,
    signature_pending_documents:
      summary?.signature_pending_documents ??
      documents.filter(
        (document) => documentSignatureStatus(document) === "signature_pending"
      ).length,
    signature_failed_documents:
      summary?.signature_failed_documents ??
      documents.filter(
        (document) => documentSignatureStatus(document) === "signature_failed"
      ).length,
    jobs,
  }
}

function countMetadataRunningStatuses(
  statusCounts: Record<string, number>
): number | undefined {
  let count = 0
  let found = false
  for (const [status, value] of Object.entries(statusCounts)) {
    if (!METADATA_RUNNING_STATUSES.has(normalizeStatus(status))) continue
    count += Math.max(0, Number(value) || 0)
    found = true
  }
  return found ? count : undefined
}

function countRunningJobs(jobs: JobSummary[]): number {
  return jobs.filter(
    (job) =>
      !job.metadata_ready &&
      METADATA_RUNNING_STATUSES.has(
        normalizeStatus(job.remote_metadata_status || job.status)
      )
  ).length
}

function normalizeStatus(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
}

function documentSignatureStatus(document: DigitizationDocument): string {
  return normalizeStatus(
    document.signature_status ||
      document.remote_metadata_status ||
      document.ocr_status
  )
}

export function normalizeDocumentReviewStatus(
  document: {
    review_status: string
    metadata_ready: boolean
    remote_metadata_status?: string | null
    signature_status?: string | null
    ocr_status?: string | null
  },
  lightMetadata: Record<string, unknown>
): string {
  if (
    !document.metadata_ready &&
    METADATA_RUNNING_STATUSES.has(documentMetadataStatus(document))
  ) {
    return "pending"
  }
  const status = String(document.review_status || "")
    .trim()
    .toLowerCase()
  if (status === "verified" || status === "rejected") return status
  const hasWarning = hasMetadataWarning({
    review_status: status,
    light_metadata: lightMetadata,
  })
  if (status === "warning" && hasWarning) return status
  if (document.metadata_ready && !hasWarning) {
    return "verified"
  }
  return status || "pending"
}

const METADATA_RUNNING_STATUSES = new Set([
  "pending",
  "queued",
  "running",
  "processing",
  "submitted",
  "ocr_done",
  "metadata_priority_running",
  "metadata_running",
  "signature_pending",
  "cancel_requested",
])

function documentMetadataStatus(document: {
  remote_metadata_status?: string | null
  ocr_status?: string | null
}): string {
  return String(document.remote_metadata_status || document.ocr_status || "")
    .trim()
    .toLowerCase()
}

export function isDigitizationComplete(
  response: DigitizationStatusResponse | null
): boolean {
  const batch = response?.batches[0]
  if (batch?.digitization_complete === true) {
    return true
  }
  if (
    !batch ||
    !["done", "completed_with_errors", "failed"].includes(batch.status)
  ) {
    return false
  }
  const documents = latestBatchDocuments(response)
  const totalDocuments = response.summary?.total_documents ?? documents.length
  const completeDocuments = response.summary?.complete_documents
  if (
    response.pagination !== undefined &&
    totalDocuments > 0 &&
    completeDocuments !== undefined
  ) {
    return completeDocuments >= totalDocuments
  }
  const expectedDocuments = Math.max(
    batch.total_jobs ?? 0,
    batch.total_files ?? 0,
    documents.length
  )
  if (expectedDocuments > 0 && documents.length < expectedDocuments) {
    return false
  }
  return documents.every(isDigitizationDocumentComplete)
}

export function isMetadataExtractionComplete(
  response: DigitizationStatusResponse | null
): boolean {
  const batch = response?.batches[0]
  if (!batch) return false
  if (batch.metadata_extraction_complete === true) return true
  if (isDigitizationComplete(response)) return true
  const status = String(batch.metadata_extraction_status ?? "")
    .trim()
    .toLowerCase()
  if (["ready", "completed_with_errors"].includes(status)) return true
  const documents = latestBatchDocuments(response)
  const totalDocuments = response?.summary?.total_documents ?? documents.length
  const readyDocuments = response?.summary?.metadata_ready
  const failedDocuments =
    response?.summary?.failed_documents ??
    documents.filter(isDigitizationDocumentTerminalError).length
  if (
    totalDocuments > 0 &&
    readyDocuments !== undefined &&
    readyDocuments + failedDocuments >= totalDocuments
  ) {
    return true
  }
  return documents.length > 0 && documents.every(isMetadataReadyOrTerminalError)
}

function latestBatchDocuments(
  response: DigitizationStatusResponse | null
): DigitizationDocument[] {
  const documents = response?.documents ?? []
  const latestBatchId = response?.batches[0]?.id
  if (latestBatchId === undefined || latestBatchId === null) return documents
  return documents.filter((document) => document.ocr_batch_id === latestBatchId)
}

function isDigitizationDocumentComplete(
  document: DigitizationDocument
): boolean {
  const status = String(document.ocr_status ?? "")
    .trim()
    .toLowerCase()
  return (
    Boolean(document.metadata_final) ||
    [
      "done",
      "failed",
      "final_failed",
      "signature_failed",
      "skipped",
      "cancelled",
      "missing_task",
    ].includes(status)
  )
}

function isMetadataReadyOrTerminalError(
  document: DigitizationDocument
): boolean {
  return (
    Boolean(document.metadata_ready) ||
    isDigitizationDocumentTerminalError(document)
  )
}

function isDigitizationDocumentTerminalError(
  document: DigitizationDocument
): boolean {
  const status = String(document.ocr_status ?? "")
    .trim()
    .toLowerCase()
  return [
    "failed",
    "final_failed",
    "signature_failed",
    "skipped",
    "cancelled",
    "missing_task",
  ].includes(status)
}
