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
  DigitizationBatch,
  DigitizationDocument,
  DigitizationStatusResponse,
  DocumentArchiveDownload,
  DocumentEditLockResponse,
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
  metadata?: Record<string, unknown>,
  options: { lockToken?: string } = {}
): Promise<SessionDocumentResponse> {
  return requestJson<SessionDocumentResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/documents/${encodeURIComponent(String(documentId))}/verify`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        metadata,
        lock_token: options.lockToken,
        created_by: "ui",
      }),
    }
  )
}

export async function patchDocumentMetadata(
  sessionId: string,
  documentId: number,
  metadata: Record<string, unknown>,
  options: { lockToken?: string } = {}
): Promise<SessionDocumentResponse> {
  return requestJson<SessionDocumentResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/documents/${encodeURIComponent(String(documentId))}/metadata`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        metadata,
        lock_token: options.lockToken,
        created_by: "ui",
      }),
    }
  )
}

export async function bulkVerifyDocumentMetadata(
  sessionId: string,
  documentIds: number[],
  lockTokens: Record<number, string> = {}
): Promise<BulkVerifyDocumentsResponse> {
  return requestJson<BulkVerifyDocumentsResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/documents/bulk-verify`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        document_ids: documentIds,
        lock_tokens: lockTokens,
        created_by: "ui",
      }),
    }
  )
}

export async function acquireDocumentEditLock(
  sessionId: string,
  documentId: number
): Promise<DocumentEditLockResponse> {
  return requestJson<DocumentEditLockResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/documents/${encodeURIComponent(String(documentId))}/edit-lock`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }
  )
}

export async function heartbeatDocumentEditLock(
  sessionId: string,
  documentId: number,
  lockToken: string
): Promise<DocumentEditLockResponse> {
  return requestJson<DocumentEditLockResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/documents/${encodeURIComponent(String(documentId))}/edit-lock/heartbeat`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lock_token: lockToken }),
    }
  )
}

export async function releaseDocumentEditLock(
  sessionId: string,
  documentId: number,
  lockToken: string
): Promise<{ session_id: string; document_id: number; locked: false }> {
  return requestJson<{ session_id: string; document_id: number; locked: false }>(
    `/sessions/${encodeURIComponent(sessionId)}/documents/${encodeURIComponent(String(documentId))}/edit-lock`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lock_token: lockToken }),
    }
  )
}

export function releaseDocumentEditLockOnPageUnload(
  sessionId: string,
  documentId: number,
  lockToken: string
): void {
  void fetch(
    apiUrl(
      `/sessions/${encodeURIComponent(sessionId)}/documents/${encodeURIComponent(String(documentId))}/edit-lock`
    ),
    withAuth({
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lock_token: lockToken }),
      keepalive: true,
    })
  ).catch(() => undefined)
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

export async function removeDocumentBlankPages(
  sessionId: string,
  documentId: number,
  payload: {
    blank_pages: number[]
    created_by?: string
    review_note?: string
  }
): Promise<{
  session_id: string
  document_id: number
  status: string
  blank_pages: number[]
  document?: SessionDocumentResponse | null
  preview?: DocumentPreviewUrlResponse | null
}> {
  return requestJson(
    `/sessions/${encodeURIComponent(sessionId)}/documents/${encodeURIComponent(String(documentId))}/blank-pages/remove`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
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
  const batches = response?.batches ?? []
  const batch = batches[0]
  const ingestionRuns = response?.ingestion_runs ?? []
  const documents = response?.documents ?? []
  const summary = response?.summary
  const responseDocumentTotal = summary?.total_documents ?? documents.length
  const pendingBatchCounts = batches
    .filter((candidate) => !isTerminalBatch(candidate))
    .map((candidate) => {
      const knownDocuments = Math.max(
        statusCountTotal(candidate.status_counts),
        response?.pagination === undefined
          ? documents.filter(
              (document) => document.ocr_batch_id === candidate.id
            ).length
          : 0
      )
      return {
        uploadMode: candidate.upload_mode,
        total: Math.max(0, candidate.total_files ?? candidate.total_jobs ?? 0),
        pending: Math.max(
          0,
          (candidate.total_files ?? candidate.total_jobs ?? 0) - knownDocuments
        ),
      }
    })
  const appendPendingDocumentCount = pendingBatchCounts
    .filter(({ uploadMode }) => uploadMode === "append")
    .reduce((total, candidate) => total + candidate.pending, 0)
  const overwriteExpectedDocumentCount = pendingBatchCounts
    .filter(({ uploadMode }) => uploadMode !== "append")
    .reduce((total, candidate) => Math.max(total, candidate.total), 0)
  const cumulativeDocumentCount = Math.max(
    responseDocumentTotal + appendPendingDocumentCount,
    overwriteExpectedDocumentCount
  )
  const jobs: JobSummary[] = documents.map((document) => {
    const lightMetadata = buildDisplayMetadata(document)
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
      metadata_batch_assigned_to_email:
        document.metadata_batch_assigned_to_email,
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
  const digitizationComplete = isDigitizationComplete(response)
  return {
    revision: response?.revision,
    documents_revision: response?.documents_revision,
    updated_at: response?.updated_at,
    last_event_id: response?.last_event_id,
    batch_id: batch?.id ?? null,
    folder_path: batch?.folder_path ?? fallbackFolderPath,
    recursive: batch?.recursive ?? true,
    total_files: Math.max(responseDocumentTotal, cumulativeDocumentCount),
    total_jobs: Math.max(responseDocumentTotal, cumulativeDocumentCount),
    missing_files: batches.flatMap(
      (candidate) => candidate.missing_files ?? []
    ),
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
    digitization_complete: digitizationComplete,
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
    ingestion_runs: ingestionRuns,
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
    extracting_ingestion_runs:
      summary?.extracting_ingestion_runs ??
      ingestionRuns.filter((run) =>
        ["extract_starting", "extracting", "legacy_unknown"].includes(
          String(run.status || "")
            .trim()
            .toLowerCase()
        )
      ).length,
    ready_ingestion_runs:
      summary?.ready_ingestion_runs ??
      ingestionRuns.filter((run) => run.status === "ready").length,
    failed_ingestion_runs:
      summary?.failed_ingestion_runs ??
      ingestionRuns.filter((run) => run.status === "extract_failed").length,
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

function statusCountTotal(counts: Record<string, number>): number {
  return Object.values(counts).reduce(
    (total, value) => total + Math.max(0, Number(value) || 0),
    0
  )
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
  const batches = response?.batches ?? []
  if (batches.length === 0) return false

  const ingestionRuns = response?.ingestion_runs ?? []
  if (ingestionRuns.length > 0) {
    return ingestionRuns.every((run) => {
      if (!["ready", "extract_failed"].includes(run.status)) return false
      const linkedBatches = batches.filter(
        (batch) => batch.ingestion_run_id === run.id
      )
      return (
        linkedBatches.length > 0 &&
        linkedBatches.every((batch) => isTerminalBatch(batch))
      )
    })
  }

  return batches.every((batch) => isTerminalBatch(batch))
}

export function isMetadataExtractionComplete(
  response: DigitizationStatusResponse | null
): boolean {
  const batches = response?.batches ?? []
  if (batches.length === 0) return false
  if (
    (response?.ingestion_runs ?? []).some(
      (run) => !["ready", "extract_failed"].includes(run.status)
    )
  ) {
    return false
  }
  return batches.every((batch) => {
    if (batch.metadata_extraction_complete === true) return true
    if (isTerminalBatch(batch)) return true
    const status = normalizeStatus(batch.metadata_extraction_status)
    return ["ready", "completed_with_errors"].includes(status)
  })
}

function isTerminalBatch(batch: DigitizationBatch): boolean {
  return (
    batch.digitization_complete === true ||
    ["done", "completed_with_errors", "failed"].includes(
      normalizeStatus(batch.status)
    )
  )
}
