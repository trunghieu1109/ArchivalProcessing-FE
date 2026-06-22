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
  CloseMetadataBatchResponse,
  CreateMetadataBatchResponse,
  DigitizationDocument,
  DigitizationStatusResponse,
  DocumentArchiveDownload,
  DocumentNumberingMode,
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
  options: { limit?: number; offset?: number } = {}
): Promise<DigitizationStatusResponse | null> {
  const searchParams = new URLSearchParams()
  if (options.limit !== undefined)
    searchParams.set("limit", String(options.limit))
  if (options.offset !== undefined)
    searchParams.set("offset", String(options.offset))
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
    status_counts: summary?.status_counts ?? batch?.status_counts ?? {},
    document_numbering_mode: batch?.document_numbering_mode ?? null,
    remove_blank_pages_before_ocr: batch?.remove_blank_pages_before_ocr ?? true,
    upload_mode: batch?.upload_mode ?? null,
    reextracting: false,
    pdf_preprocessing: batch?.pdf_preprocessing ?? null,
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

function documentSignatureStatus(document: DigitizationDocument): string {
  return String(document.remote_metadata_status || document.ocr_status || "")
    .trim()
    .toLowerCase()
}

export function normalizeDocumentReviewStatus(
  document: { review_status: string; metadata_ready: boolean },
  lightMetadata: Record<string, unknown>
): string {
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

export function isDigitizationComplete(
  response: DigitizationStatusResponse | null
): boolean {
  const batch = response?.batches[0]
  if (
    !batch ||
    !["done", "completed_with_errors", "failed"].includes(batch.status)
  ) {
    return false
  }
  const documents = latestBatchDocuments(response)
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
    ].includes(status)
  )
}
