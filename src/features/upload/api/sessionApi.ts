import type {
  FolderStatusResponse,
  JobSummary,
} from "@/features/upload/api/ocrApi"
import {
  buildDisplayMetadata,
  hasMetadataWarning,
} from "@/features/upload/lib/metadata"

export type SessionInputFileType =
  | "arrangement_plan"
  | "retention_schedule"
  | "raw_zip"

export interface CreateSessionResponse {
  session_id: string
  status: string
  archive_name?: string | null
  fonds_name?: string | null
  created_at: string
}

export interface SessionSummary {
  session_id: string
  status: string
  archive_name?: string | null
  fonds_name?: string | null
  created_at: string
  updated_at?: string
  active_plan_version_id?: string | null
  active_cluster_version_id?: string | null
  file_count?: number
  document_count?: number
  cluster_count?: number
  metadata_edited_document_count?: number
  metadata_correct_document_count?: number
  metadata_incorrect_document_count?: number
}

export interface SessionListResponse {
  sessions: SessionSummary[]
}

export interface SessionDetailResponse extends SessionSummary {
  files: SessionInputUploadResponse[]
}

export interface SessionInputUploadResponse {
  id: number
  session_id: string
  file_type: SessionInputFileType
  file_name: string
  local_cached_path: string | null
  data_path?: string | null
  checksum: string | null
  folder_path?: string | null
  remote_batch_id?: string | null
  remote_file_id?: string | null
  remote_kind?: string | null
  remote_object_name?: string | null
  remote_status?: string | null
  size_bytes?: number | null
  content_type?: string | null
}

interface SessionInputRemoteUploadPresignResponse {
  session_id: string
  file_type: SessionInputFileType
  file_name: string
  folder_path?: string | null
  data_path?: string | null
  upload_url: string
  remote_batch_id: string
  remote_file_id?: string | null
  remote_kind: string
  content_type: string
  size_bytes?: number | null
}

interface SessionInputRemoteChunkedCreateResponse {
  session_id: string
  file_type: SessionInputFileType
  file_name: string
  folder_path?: string | null
  data_path?: string | null
  upload_id: string
  remote_upload_id?: string | null
  remote_batch_id: string
  remote_file_id?: string | null
  remote_kind: string
  content_type: string
  size_bytes?: number | null
  chunk_size_bytes?: number | null
  part_count?: number | null
  remote_object_name?: string | null
  remote_status?: string | null
}

interface SessionInputRemoteChunkedPart {
  part_number: number
  object_name: string
  upload_url: string
  byte_start: number
  byte_end: number
  size_bytes: number
  content_type?: string | null
}

interface SessionInputRemoteChunkedPartsPresignResponse {
  upload_id: string
  batch_id: number | string
  file_id: number | string
  chunk_size_bytes: number
  total_size_bytes: number
  total_part_count: number
  parts: SessionInputRemoteChunkedPart[]
}

export interface UploadProgressSnapshot {
  phase: "uploading" | "processing" | "done" | "error"
  loadedBytes: number
  totalBytes: number
  loadedMb: number
  totalMb: number
  percent: number | null
}

export interface SessionProgressEvent {
  id: number
  session_id?: string
  event_type: string
  message?: string | null
  payload?: Record<string, unknown>
  created_at?: string
}

export interface ActiveJobSummary {
  id: number
  job_type: string
  status: string
  retry_count: number
  payload: Record<string, unknown>
  locked_at?: string | null
  locked_by?: string | null
  error?: string | null
  created_at?: string
  updated_at?: string
}

export interface ClusterBuildStatusResponse {
  session_id: string
  job_type: "build_clusters"
  active: boolean
  job: ActiveJobSummary | null
}

interface SessionEventResponse {
  events: Array<{
    id: number
    session_id?: string
    event_type: string
    message?: string | null
    payload?: Record<string, unknown>
    created_at?: string
  }>
}

interface UploadSessionInputOptions {
  createdBy?: string
  onProgress?: (progress: UploadProgressSnapshot) => void
}

export interface ActivePlanResponse {
  id?: string
  version_number?: number
  summary: string
  archive_name?: string
  fonds_name: string
  groups?: unknown[]
  flat_groups?: unknown[]
  classification_groups?: unknown[]
  criterias?: unknown[]
  leaf_group_candidates?: unknown[]
}

export interface DigitizationDocument {
  id: number
  document_id: string
  data_path: string
  remote_metadata_status?: string | null
  ocr_status: string
  review_status: string
  metadata_ready: boolean
  metadata_final: boolean
  metadata_version_count?: number
  metadata_user_edited?: boolean
  latest_metadata_version?: MetadataVersionSummary | null
  raw_metadata?: Record<string, unknown>
  metadata?: Record<string, unknown>
  normalized_metadata?: Record<string, unknown>
  error?: string | null
}

export interface DigitizationBatch {
  id: number
  folder_path: string
  recursive: boolean
  total_files: number | null
  total_jobs: number | null
  missing_files: string[]
  status_counts: Record<string, number>
  status: string
}

export interface DigitizationStatusResponse {
  session_id: string
  batches: DigitizationBatch[]
  documents: DigitizationDocument[]
  summary: {
    total_documents: number
    metadata_ready?: number
    metadata_final?: number
    verified?: number
    warning?: number
    signature_extracted_documents?: number
    signature_pending_documents?: number
    signature_failed_documents?: number
    status_counts: Record<string, number>
  }
}

export interface SessionArtifact {
  id: number
  session_id?: string
  artifact_type: string
  file_name: string
  local_path?: string
  status: string
  related_plan_version_id?: string | null
  related_cluster_version_id?: string | null
  manifest?: Record<string, unknown>
  generated_at?: string
}

export interface ArtifactListResponse {
  session_id: string
  artifacts: SessionArtifact[]
}

export interface MetadataSnapshotDocument {
  documentId: string
  sessionDocumentId?: number | null
  filePath: string
  fileName: string
  positionIndex: number
  pageCount?: number | null
  sheetCount?: number | null
  requiresReview?: boolean
  metadata: Record<string, unknown>
  remoteMetadataStatus?: string | null
  ocrStatus?: string
  signatureStatus?: string
  error?: string | null
}

export interface MetadataSnapshotGroup {
  id: string
  label: string
  dossierId?: string | null
  dossierNumber?: string | null
  boxNumber?: string | null
  folderName?: string | null
  classificationPath?: string[]
  retentionPeriod?: string | null
  confidence?: number | null
  requiresReview?: boolean
  pageCount?: number | null
  sheetCount?: number | null
  startDate?: string | null
  endDate?: string | null
  documents: MetadataSnapshotDocument[]
}

export interface MetadataSnapshotResponse {
  session_id: string
  run_id: string
  artifact: SessionArtifact
  artifacts: SessionArtifact[]
  summary: Record<string, unknown>
}

export interface MetadataBoxNumberImportResponse {
  session_id: string
  cluster_version_id: string
  cluster_version_number: number
  file_name?: string | null
  sheet_name: string
  header_row: number
  data_row_count: number
  imported_box_rows: number
  skipped_empty_box_rows: number
  matched_rows: number
  unmatched_rows: number
  updated_dossiers: number
  unchanged_dossiers: number
  conflict_count: number
  updated?: Array<Record<string, unknown>>
  unchanged?: Array<Record<string, unknown>>
  conflicts?: Array<Record<string, unknown>>
  unmatched?: Array<Record<string, unknown>>
}

export interface SessionDocumentResponse {
  id: number
  session_id: string
  document_id: string
  data_path: string
  file_name: string
  remote_metadata_status?: string | null
  ocr_status: string
  review_status: string
  metadata_ready: boolean
  metadata_final: boolean
  metadata_version_count?: number
  metadata_user_edited?: boolean
  latest_metadata_version?: MetadataVersionSummary | null
  metadata?: Record<string, unknown>
  normalized_metadata?: Record<string, unknown>
  raw_metadata?: Record<string, unknown>
  error?: string | null
}

export interface MetadataVersionSummary {
  id?: number
  version_number?: number
  source?: string | null
  review_status?: string | null
  remote_status?: string | null
  metadata_final?: boolean
  created_by?: string | null
  created_at?: string | null
}

const USER_METADATA_EDIT_SOURCES = new Set(["user_patch", "user_verified"])

export function documentHasUserMetadataEdit(document: {
  metadata_user_edited?: boolean
  latest_metadata_version?: MetadataVersionSummary | null
}): boolean {
  if (typeof document.metadata_user_edited === "boolean") {
    return document.metadata_user_edited
  }
  const source = String(document.latest_metadata_version?.source ?? "")
  return USER_METADATA_EDIT_SOURCES.has(source)
}

export interface DocumentPreviewUrlResponse {
  session_id: string
  document_id: number
  data_path: string
  download_url?: string | null
  expires_in?: number | null
  expires_at?: string | null
}

export interface ClusterPlacement {
  id: number
  session_document_id: number
  document_id: string
  position_index: number
  placement_status: string
  requires_review: boolean
  page_count: number | null
  sheet_count: number | null
  metadata: Record<string, unknown>
}

export interface DossierClassification {
  group_id: string | null
  group_name: string | null
  level_path: Array<Record<string, unknown>>
  group_ids: string[]
  group_path: string[]
  confidence: number | null
  rationale: string | null
  requires_review: boolean
}

export interface SessionDossierSummary {
  id?: number
  dossier_id: string
  cluster_id: string
  generated_title: string
  title: string
  title_override: string | null
  dossier_number: string | null
  box_number: string | null
  folder_name: string | null
  retention_period: string | null
  retention_recommendation: Record<string, unknown>
  retention_override?: Record<string, unknown>
  status?: string
  source?: string
  created_by?: string | null
  classification: DossierClassification | null
  updated_at?: string
}

export interface SessionDossierPatchPayload {
  title?: string | null
  dossier_number?: string | null
  box_number?: string | null
  folder_name?: string | null
  retention_period?: string | null
  created_by?: string
}

export interface SessionClusterSummary {
  id: number
  cluster_id: string
  dossier_id: string
  is_temporary?: boolean
  title: string
  dossier: SessionDossierSummary | null
  status: string
  notes: string[]
  document_ids: string[]
  page_count: number | null
  sheet_count: number | null
  start_date: string | null
  end_date: string | null
  placements: ClusterPlacement[]
}

export interface ClusterVersionResponse {
  id: string
  session_id: string
  version_number: number
  source: string
  status: string
  summary: Record<string, unknown>
  affected_clusters: string[]
  batch_snapshot_count: number
  created_at: string
  clusters: SessionClusterSummary[]
}

const API_BASE = (import.meta.env.VITE_ARCHIVAL_API_BASE_URL ?? "/api").replace(
  /\/+$/,
  ""
)
const DIRECT_PRESIGNED_UPLOAD_ENABLED = ["1", "true", "yes", "on"].includes(
  String(import.meta.env.VITE_ARCHIVAL_DIRECT_PRESIGNED_UPLOAD ?? "false")
    .trim()
    .toLowerCase()
)
const RAW_ZIP_CHUNKED_UPLOAD_THRESHOLD_BYTES = 50 * 1024 * 1024
const CHUNKED_UPLOAD_CHUNK_SIZE_BYTES = 16 * 1024 * 1024
const CHUNKED_UPLOAD_PART_PRESIGN_BATCH_SIZE = 32
const CHUNKED_UPLOAD_MAX_CONCURRENCY = 4
const CHUNKED_PROXY_UPLOAD_MAX_CONCURRENCY = 1
const CHUNKED_UPLOAD_PART_MAX_ATTEMPTS = 3
const PRESIGNED_UPLOAD_STALL_MS = 12_000

export async function listSessions(limit = 100): Promise<SessionListResponse> {
  return requestJson<SessionListResponse>(
    `/sessions?limit=${encodeURIComponent(String(limit))}`
  )
}

export async function getSession(
  sessionId: string
): Promise<SessionDetailResponse> {
  return requestJson<SessionDetailResponse>(
    `/sessions/${encodeURIComponent(sessionId)}`
  )
}

export async function createSession(
  createdBy = "ui"
): Promise<CreateSessionResponse> {
  return requestJson<CreateSessionResponse>("/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ created_by: createdBy }),
  })
}

export async function patchSessionMetadata(
  sessionId: string,
  payload: { archive_name?: string | null; fonds_name?: string | null }
): Promise<SessionSummary> {
  return requestJson<SessionSummary>(
    `/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  )
}

export async function uploadSessionInput(
  sessionId: string,
  fileType: SessionInputFileType,
  file: File,
  options: string | UploadSessionInputOptions = "ui"
): Promise<SessionInputUploadResponse> {
  const uploadOptions =
    typeof options === "string" ? { createdBy: options } : options
  if (fileType === "raw_zip") {
    return uploadRawZipSessionInputDirect(sessionId, file, uploadOptions)
  }
  const form = new FormData()
  form.append("file_type", fileType)
  form.append("created_by", uploadOptions.createdBy ?? "ui")
  form.append("file", file)
  return requestJsonWithUploadProgress<SessionInputUploadResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/inputs/upload`,
    form,
    uploadOptions.onProgress
  )
}

async function uploadRawZipSessionInputDirect(
  sessionId: string,
  file: File,
  options: UploadSessionInputOptions
): Promise<SessionInputUploadResponse> {
  if (file.size > RAW_ZIP_CHUNKED_UPLOAD_THRESHOLD_BYTES) {
    return uploadRawZipSessionInputChunked(sessionId, file, options)
  }
  const contentType = file.type || defaultContentType(file.name)
  const presign = await postJson<SessionInputRemoteUploadPresignResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/inputs/remote-upload/presign`,
    {
      file_type: "raw_zip",
      file_name: file.name,
      content_type: contentType,
      size_bytes: file.size,
      created_by: options.createdBy ?? "ui",
    }
  )
  if (!presign.remote_file_id) {
    throw new Error("Chỉnh Lý chưa trả về remote_file_id cho file ZIP.")
  }
  options.onProgress?.(uploadProgressSnapshot("uploading", 0, file.size))
  if (!DIRECT_PRESIGNED_UPLOAD_ENABLED) {
    return proxyPresignedRawZipUpload(
      sessionId,
      file,
      contentType,
      presign,
      options
    )
  }
  try {
    await putPresignedFile(
      presign.upload_url,
      file,
      contentType,
      options.onProgress
    )
  } catch (error) {
    if (!(error instanceof PresignedUploadNetworkError)) throw error
    return proxyPresignedRawZipUpload(
      sessionId,
      file,
      contentType,
      presign,
      options
    )
  }
  options.onProgress?.(
    uploadProgressSnapshot("processing", file.size, file.size)
  )
  const completed = await postJson<SessionInputUploadResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/inputs/remote-upload/complete`,
    {
      file_type: "raw_zip",
      file_name: file.name,
      content_type: contentType,
      size_bytes: file.size,
      remote_batch_id: presign.remote_batch_id,
      remote_file_id: presign.remote_file_id,
      upload_url: presign.upload_url,
      created_by: options.createdBy ?? "ui",
    }
  )
  options.onProgress?.(uploadProgressSnapshot("done", file.size, file.size))
  return completed
}

async function uploadRawZipSessionInputChunked(
  sessionId: string,
  file: File,
  options: UploadSessionInputOptions
): Promise<SessionInputUploadResponse> {
  const contentType = file.type || defaultContentType(file.name)
  const chunked = await requestJson<SessionInputRemoteChunkedCreateResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/inputs/remote-upload/chunked/create`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_type: "raw_zip",
        file_name: file.name,
        content_type: contentType,
        size_bytes: file.size,
        chunk_size_bytes: CHUNKED_UPLOAD_CHUNK_SIZE_BYTES,
        created_by: options.createdBy ?? "ui",
      }),
    }
  )
  if (!chunked.remote_file_id) {
    throw new Error(
      "Chỉnh Lý chưa trả về remote_file_id cho chunked ZIP upload."
    )
  }
  const uploadId = chunked.upload_id || chunked.remote_upload_id
  if (!uploadId) {
    throw new Error("Chỉnh Lý chưa trả về upload_id cho chunked ZIP upload.")
  }

  const totalParts =
    chunked.part_count ||
    Math.ceil(
      file.size / (chunked.chunk_size_bytes || CHUNKED_UPLOAD_CHUNK_SIZE_BYTES)
    )
  let completedBytes = 0
  const activePartBytes = new Map<number, number>()
  const emitProgress = () => {
    const activeBytes = Array.from(activePartBytes.values()).reduce(
      (sum, value) => sum + value,
      0
    )
    options.onProgress?.(
      uploadProgressSnapshot(
        "uploading",
        Math.min(file.size, completedBytes + activeBytes),
        file.size
      )
    )
  }
  options.onProgress?.(uploadProgressSnapshot("uploading", 0, file.size))

  for (
    let startPart = 1;
    startPart <= totalParts;
    startPart += CHUNKED_UPLOAD_PART_PRESIGN_BATCH_SIZE
  ) {
    const partCount = Math.min(
      CHUNKED_UPLOAD_PART_PRESIGN_BATCH_SIZE,
      totalParts - startPart + 1
    )
    const presignedParts =
      await requestJson<SessionInputRemoteChunkedPartsPresignResponse>(
        `/sessions/${encodeURIComponent(sessionId)}/inputs/remote-upload/chunked/${encodeURIComponent(uploadId)}/parts/presign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            remote_batch_id: chunked.remote_batch_id,
            start_part: startPart,
            part_count: partCount,
          }),
        }
      )
    await uploadChunkedParts(
      sessionId,
      uploadId,
      chunked,
      file,
      presignedParts.parts,
      {
        activePartBytes,
        onPartComplete: (part) => {
          activePartBytes.delete(part.part_number)
          completedBytes += chunkedPartSize(part)
          emitProgress()
        },
        onPartProgress: emitProgress,
      }
    )
  }

  options.onProgress?.(
    uploadProgressSnapshot("processing", file.size, file.size)
  )
  const completed = await requestJson<SessionInputUploadResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/inputs/remote-upload/chunked/${encodeURIComponent(uploadId)}/complete`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_type: "raw_zip",
        file_name: file.name,
        content_type: contentType,
        size_bytes: file.size,
        remote_batch_id: chunked.remote_batch_id,
        remote_file_id: chunked.remote_file_id,
        delete_parts: true,
        created_by: options.createdBy ?? "ui",
      }),
    }
  )
  options.onProgress?.(uploadProgressSnapshot("done", file.size, file.size))
  return completed
}

async function uploadChunkedParts(
  sessionId: string,
  uploadId: string,
  chunked: SessionInputRemoteChunkedCreateResponse,
  file: File,
  parts: SessionInputRemoteChunkedPart[],
  progress: {
    activePartBytes: Map<number, number>
    onPartProgress: () => void
    onPartComplete: (part: SessionInputRemoteChunkedPart) => void
  }
): Promise<void> {
  let nextIndex = 0
  const workerCount = Math.min(
    DIRECT_PRESIGNED_UPLOAD_ENABLED
      ? CHUNKED_UPLOAD_MAX_CONCURRENCY
      : CHUNKED_PROXY_UPLOAD_MAX_CONCURRENCY,
    parts.length
  )
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < parts.length) {
      const part = parts[nextIndex++]
      await uploadChunkedPartWithRetry(
        sessionId,
        uploadId,
        chunked,
        file,
        part,
        progress
      )
      progress.onPartComplete(part)
    }
  })
  await Promise.all(workers)
}

async function uploadChunkedPartWithRetry(
  sessionId: string,
  uploadId: string,
  chunked: SessionInputRemoteChunkedCreateResponse,
  file: File,
  part: SessionInputRemoteChunkedPart,
  progress: {
    activePartBytes: Map<number, number>
    onPartProgress: () => void
  }
): Promise<void> {
  let lastError: unknown = null
  for (
    let attempt = 1;
    attempt <= CHUNKED_UPLOAD_PART_MAX_ATTEMPTS;
    attempt++
  ) {
    try {
      const blob = chunkBlobForPart(file, part)
      progress.activePartBytes.set(part.part_number, 0)
      progress.onPartProgress()
      if (!DIRECT_PRESIGNED_UPLOAD_ENABLED) {
        await proxyChunkedPartUpload(
          sessionId,
          uploadId,
          chunked,
          file,
          part,
          blob
        )
        progress.activePartBytes.set(part.part_number, blob.size)
        progress.onPartProgress()
      } else {
        try {
          await putPresignedBlob(
            part.upload_url,
            blob,
            part.content_type,
            (loadedBytes) => {
              progress.activePartBytes.set(part.part_number, loadedBytes)
              progress.onPartProgress()
            }
          )
        } catch (error) {
          if (!(error instanceof PresignedUploadNetworkError)) throw error
          await proxyChunkedPartUpload(
            sessionId,
            uploadId,
            chunked,
            file,
            part,
            blob
          )
          progress.activePartBytes.set(part.part_number, blob.size)
          progress.onPartProgress()
        }
      }
      return
    } catch (error) {
      lastError = error
      progress.activePartBytes.delete(part.part_number)
      progress.onPartProgress()
      if (attempt < CHUNKED_UPLOAD_PART_MAX_ATTEMPTS) {
        await delay(500 * attempt)
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`Không thể upload chunk ${part.part_number}.`)
}

function chunkedPartSize(part: SessionInputRemoteChunkedPart): number {
  if (Number.isFinite(part.size_bytes) && part.size_bytes > 0) {
    return part.size_bytes
  }
  return Math.max(0, part.byte_end - part.byte_start + 1)
}

function chunkBlobForPart(
  file: File,
  part: SessionInputRemoteChunkedPart
): Blob {
  const start = Math.max(0, part.byte_start)
  const end =
    Number.isFinite(part.size_bytes) && part.size_bytes > 0
      ? start + part.size_bytes
      : part.byte_end + 1
  return file.slice(start, Math.min(file.size, Math.max(start, end)))
}

async function proxyChunkedPartUpload(
  sessionId: string,
  uploadId: string,
  chunked: SessionInputRemoteChunkedCreateResponse,
  file: File,
  part: SessionInputRemoteChunkedPart,
  blob: Blob
): Promise<void> {
  if (!chunked.remote_file_id) {
    throw new Error("Missing remote_file_id for chunked ZIP upload.")
  }
  const query = new URLSearchParams({
    file_type: "raw_zip",
    file_name: file.name,
    remote_batch_id: chunked.remote_batch_id,
    remote_file_id: chunked.remote_file_id,
    upload_url: part.upload_url,
    size_bytes: String(blob.size),
  })
  if (part.content_type) query.set("content_type", part.content_type)
  const response = await fetch(
    apiUrl(
      `/sessions/${encodeURIComponent(sessionId)}/inputs/remote-upload/chunked/${encodeURIComponent(uploadId)}/parts/${encodeURIComponent(String(part.part_number))}/proxy?${query.toString()}`
    ),
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/octet-stream",
      },
      body: blob,
    }
  )
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response))
  }
}

async function proxyPresignedRawZipUpload(
  sessionId: string,
  file: File,
  contentType: string,
  presign: SessionInputRemoteUploadPresignResponse,
  options: UploadSessionInputOptions
): Promise<SessionInputUploadResponse> {
  const query = new URLSearchParams({
    file_type: "raw_zip",
    file_name: file.name,
    content_type: contentType,
    size_bytes: String(file.size),
    created_by: options.createdBy ?? "ui",
    remote_batch_id: presign.remote_batch_id,
    remote_file_id: presign.remote_file_id ?? "",
  })
  const proxyUpload =
    requestJsonWithBinaryUploadProgress<SessionInputUploadResponse>(
      `/sessions/${encodeURIComponent(sessionId)}/inputs/remote-upload/proxy?${query.toString()}`,
      file,
      contentType,
      options.onProgress
    )
  return withSessionUploadEventProgress(
    sessionId,
    "raw_zip",
    file.name,
    presign.remote_file_id ?? null,
    proxyUpload,
    options.onProgress
  )
}

export async function registerSessionInput(
  sessionId: string,
  fileType: SessionInputFileType,
  fileName: string,
  createdBy = "ui"
): Promise<SessionInputUploadResponse> {
  return requestJson<SessionInputUploadResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/inputs/register`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_type: fileType,
        file_name: fileName,
        created_by: createdBy,
      }),
    }
  )
}

export async function enqueuePlanAnalysis(
  sessionId: string,
  payload: { plan_file?: string; retention_file?: string }
): Promise<void> {
  await requestJson<unknown>(
    `/sessions/${encodeURIComponent(sessionId)}/plan/analyze`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  )
}

export async function listSessionEvents(
  sessionId: string,
  options: { afterId?: number; limit?: number } = {}
): Promise<{ session_id: string; events: SessionProgressEvent[] }> {
  const query = new URLSearchParams()
  if (options.afterId !== undefined)
    query.set("after_id", String(options.afterId))
  if (options.limit !== undefined) query.set("limit", String(options.limit))
  const suffix = query.toString()
  return requestJson<{ session_id: string; events: SessionProgressEvent[] }>(
    `/sessions/${encodeURIComponent(sessionId)}/events${suffix ? `?${suffix}` : ""}`
  )
}

export async function getActivePlan(
  sessionId: string
): Promise<ActivePlanResponse | null> {
  return requestJsonOrNull<ActivePlanResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/plan`
  )
}

export async function patchActivePlan(
  sessionId: string,
  payload: Record<string, unknown>
): Promise<ActivePlanResponse> {
  return requestJson<ActivePlanResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/plan`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  )
}

export async function waitForActivePlan(
  sessionId: string,
  timeoutMs = 120_000,
  intervalMs = 2_000,
  options: { previousPlanId?: string; afterVersionNumber?: number } = {}
): Promise<ActivePlanResponse> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const plan = await getActivePlan(sessionId)
    if (plan && isExpectedPlan(plan, options)) return plan
    await delay(intervalMs)
  }
  throw new Error(
    "Quá thời gian chờ phân tích phương án. Hãy kiểm tra backend worker."
  )
}

function isExpectedPlan(
  plan: ActivePlanResponse,
  options: { previousPlanId?: string; afterVersionNumber?: number }
): boolean {
  if (options.previousPlanId && plan.id === options.previousPlanId) return false
  if (
    options.afterVersionNumber !== undefined &&
    typeof plan.version_number === "number" &&
    plan.version_number <= options.afterVersionNumber
  ) {
    return false
  }
  return true
}

export async function startDigitization(
  sessionId: string,
  payload: {
    folder_path: string
    recursive?: boolean
    force?: boolean
    max_files?: number
    confirmed_plan_version_id: string
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
        ...payload,
      }),
    }
  )
}

export async function getDigitizationStatus(
  sessionId: string
): Promise<DigitizationStatusResponse | null> {
  return requestJsonOrNull<DigitizationStatusResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/digitization`
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

export async function getActiveClusters(
  sessionId: string
): Promise<ClusterVersionResponse | null> {
  return requestJsonOrNull<ClusterVersionResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/clusters`
  )
}

export async function patchSessionDossier(
  sessionId: string,
  dossierId: string,
  payload: SessionDossierPatchPayload
): Promise<SessionDossierSummary & { feedback_event_id?: number }> {
  return requestJson<SessionDossierSummary & { feedback_event_id?: number }>(
    `/sessions/${encodeURIComponent(sessionId)}/dossiers/${encodeURIComponent(dossierId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        created_by: "ui",
        ...payload,
      }),
    }
  )
}

export async function getClusterBuildStatus(
  sessionId: string
): Promise<ClusterBuildStatusResponse> {
  return requestJson<ClusterBuildStatusResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/clustering/build/status`
  )
}

export async function enqueueClusterBuild(
  sessionId: string,
  payload: { source?: string; batch_size?: number } = {}
): Promise<Record<string, unknown>> {
  return requestJson<Record<string, unknown>>(
    `/sessions/${encodeURIComponent(sessionId)}/clustering/build`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "user_feedback",
        ...payload,
      }),
    }
  )
}

export async function moveDocumentBetweenClusters(
  sessionId: string,
  payload: {
    session_document_id: number
    source_cluster_id?: string | null
    target_cluster_id: string
    weight?: number
    details?: Record<string, unknown>
    created_by?: string
  }
): Promise<Record<string, unknown>> {
  return requestJson<Record<string, unknown>>(
    `/sessions/${encodeURIComponent(sessionId)}/clusters/manual-move`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weight: 1,
        created_by: "ui",
        ...payload,
      }),
    }
  )
}

export function digitizationToFolderStatus(
  response: DigitizationStatusResponse | null,
  fallbackFolderPath: string
): FolderStatusResponse {
  const batch = response?.batches[0]
  const documents = response?.documents ?? []
  const jobs: JobSummary[] = documents.map((document) => {
    const lightMetadata = buildDisplayMetadata(document)
    return {
      id: document.id,
      document_id: document.document_id,
      data_path: document.data_path,
      status: document.ocr_status,
      remote_metadata_status: document.remote_metadata_status,
      review_status: normalizeDocumentReviewStatus(document, lightMetadata),
      metadata_ready: document.metadata_ready,
      metadata_final: document.metadata_final,
      metadata_version_count: document.metadata_version_count,
      metadata_user_edited: documentHasUserMetadataEdit(document),
      error: document.error,
      light_metadata: lightMetadata,
      normalized_metadata: document.normalized_metadata,
      raw_metadata: document.raw_metadata,
    }
  })
  return {
    folder_path: batch?.folder_path ?? fallbackFolderPath,
    recursive: batch?.recursive ?? true,
    total_files: batch?.total_files ?? documents.length,
    total_jobs: batch?.total_jobs ?? documents.length,
    missing_files: batch?.missing_files ?? [],
    status_counts:
      batch?.status_counts ?? response?.summary.status_counts ?? {},
    signature_extracted_documents:
      response?.summary.signature_extracted_documents ??
      documents.filter(
        (document) => documentSignatureStatus(document) === "done"
      ).length,
    signature_pending_documents:
      response?.summary.signature_pending_documents ??
      documents.filter(
        (document) => documentSignatureStatus(document) === "signature_pending"
      ).length,
    signature_failed_documents:
      response?.summary.signature_failed_documents ??
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
  const documents = response?.documents ?? []
  const expectedDocuments = Math.max(
    batch.total_jobs ?? 0,
    batch.total_files ?? 0,
    response?.summary.total_documents ?? 0,
    documents.length
  )
  if (expectedDocuments > 0 && documents.length < expectedDocuments) {
    return false
  }
  return documents.every(isDigitizationDocumentComplete)
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
      "cancelled",
    ].includes(status)
  )
}

export async function enqueueFinalizeArtifacts(
  sessionId: string,
  payload: { created_by?: string } = {}
): Promise<Record<string, unknown>> {
  return requestJson<Record<string, unknown>>(
    `/sessions/${encodeURIComponent(sessionId)}/artifacts/finalize`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  )
}

export async function exportMetadataSnapshot(
  sessionId: string,
  payload: { created_by?: string; groups?: MetadataSnapshotGroup[] } = {}
): Promise<MetadataSnapshotResponse> {
  return requestJson<MetadataSnapshotResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/artifacts/metadata-snapshot`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  )
}

export async function importMetadataBoxNumbers(
  sessionId: string,
  file: File,
  payload: { created_by?: string } = {}
): Promise<MetadataBoxNumberImportResponse> {
  const form = new FormData()
  form.append("created_by", payload.created_by ?? "ui")
  form.append("file", file)
  return requestJson<MetadataBoxNumberImportResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/artifacts/metadata-snapshot/import-box-numbers`,
    {
      method: "POST",
      body: form,
    }
  )
}

export async function listArtifacts(
  sessionId: string,
  status?: string
): Promise<ArtifactListResponse> {
  const query = status ? `?status=${encodeURIComponent(status)}` : ""
  return requestJson<ArtifactListResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/artifacts${query}`
  )
}

export async function waitForArtifacts(
  sessionId: string,
  timeoutMs = 120_000,
  intervalMs = 2_000
): Promise<ArtifactListResponse> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const result = await listArtifacts(sessionId)
    if (result.artifacts.some((artifact) => artifact.status === "ready")) {
      return result
    }
    await delay(intervalMs)
  }
  throw new Error(
    "Quá thời gian chờ tạo artifact. Hãy kiểm tra backend worker."
  )
}

export function artifactDownloadUrl(
  sessionId: string,
  artifactId: number
): string {
  return apiUrl(
    `/sessions/${encodeURIComponent(sessionId)}/artifacts/${artifactId}/download`
  )
}

export function artifactPreviewUrl(
  sessionId: string,
  artifactId: number
): string {
  return apiUrl(
    `/sessions/${encodeURIComponent(sessionId)}/artifacts/${artifactId}/preview`
  )
}

export function artifactDownloadAllUrl(sessionId: string): string {
  return apiUrl(
    `/sessions/${encodeURIComponent(sessionId)}/artifacts/download-all`
  )
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), init)
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response))
  }
  return response.json() as Promise<T>
}

async function postJson<T>(
  path: string,
  payload: Record<string, unknown>
): Promise<T> {
  return requestJson<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

async function withSessionUploadEventProgress<T>(
  sessionId: string,
  fileType: SessionInputFileType,
  fileName: string,
  remoteFileId: string | null,
  pending: Promise<T>,
  onProgress?: (progress: UploadProgressSnapshot) => void
): Promise<T> {
  if (!onProgress) return pending
  let stopped = false
  let afterId = 0
  const poll = async () => {
    while (!stopped) {
      try {
        const response = await requestJson<SessionEventResponse>(
          `/sessions/${encodeURIComponent(sessionId)}/events?after_id=${encodeURIComponent(String(afterId))}&limit=50`
        )
        for (const event of response.events) {
          afterId = Math.max(afterId, event.id)
          const progress = uploadProgressFromEvent(
            event.event_type,
            event.payload,
            fileType,
            fileName,
            remoteFileId
          )
          if (progress) onProgress(progress)
        }
      } catch {
        // Upload itself owns the user-facing error; event polling is best-effort progress only.
      }
      await delay(1_000)
    }
  }
  const pollPromise = poll()
  try {
    return await pending
  } finally {
    stopped = true
    await pollPromise.catch(() => undefined)
  }
}

function uploadProgressFromEvent(
  eventType: string,
  payload: Record<string, unknown> | undefined,
  fileType: SessionInputFileType,
  fileName: string,
  remoteFileId: string | null
): UploadProgressSnapshot | null {
  if (!payload) return null
  if (payload.file_type !== fileType || payload.file_name !== fileName)
    return null
  if (remoteFileId && payload.remote_file_id !== remoteFileId) return null
  const loadedBytes = Number(payload.uploaded_bytes ?? 0)
  const totalBytes = Number(payload.total_bytes ?? 0)
  if (!Number.isFinite(loadedBytes) || !Number.isFinite(totalBytes)) return null
  if (eventType.endsWith(".failed")) {
    return uploadProgressSnapshot("error", loadedBytes, totalBytes)
  }
  if (eventType.endsWith(".completed")) {
    return uploadProgressSnapshot(
      "done",
      totalBytes || loadedBytes,
      totalBytes || loadedBytes
    )
  }
  if (
    eventType.includes(".progress") ||
    eventType.endsWith(".started") ||
    eventType.endsWith(".received")
  ) {
    return uploadProgressSnapshot("uploading", loadedBytes, totalBytes)
  }
  return null
}

function requestJsonWithUploadProgress<T>(
  path: string,
  body: FormData,
  onProgress?: (progress: UploadProgressSnapshot) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    let lastProgress: UploadProgressSnapshot | null = null
    xhr.open("POST", apiUrl(path), true)

    xhr.upload.onprogress = (event) => {
      const totalBytes = event.lengthComputable ? event.total : 0
      const loadedBytes = event.loaded
      lastProgress = uploadProgressSnapshot(
        "uploading",
        loadedBytes,
        totalBytes
      )
      onProgress?.(lastProgress)
    }

    xhr.upload.onload = () => {
      if (lastProgress) {
        onProgress?.(
          uploadProgressSnapshot(
            "processing",
            lastProgress.totalBytes,
            lastProgress.totalBytes
          )
        )
      }
    }

    xhr.onload = () => {
      const ok = xhr.status >= 200 && xhr.status < 300
      if (!ok) {
        if (lastProgress) {
          onProgress?.(
            uploadProgressSnapshot(
              "error",
              lastProgress.loadedBytes,
              lastProgress.totalBytes
            )
          )
        }
        reject(
          new Error(responseTextErrorMessage(xhr.status, xhr.responseText))
        )
        return
      }
      try {
        if (lastProgress) {
          onProgress?.(
            uploadProgressSnapshot(
              "done",
              lastProgress.totalBytes,
              lastProgress.totalBytes
            )
          )
        }
        resolve(JSON.parse(xhr.responseText || "{}") as T)
      } catch {
        reject(new Error("Backend trả về JSON không hợp lệ."))
      }
    }

    xhr.onerror = () => {
      if (lastProgress) {
        onProgress?.(
          uploadProgressSnapshot(
            "error",
            lastProgress.loadedBytes,
            lastProgress.totalBytes
          )
        )
      }
      reject(new Error("Không thể kết nối backend để upload."))
    }
    xhr.onabort = () => {
      if (lastProgress) {
        onProgress?.(
          uploadProgressSnapshot(
            "error",
            lastProgress.loadedBytes,
            lastProgress.totalBytes
          )
        )
      }
      reject(new Error("Upload đã bị hủy."))
    }
    xhr.send(body)
  })
}

function requestJsonWithBinaryUploadProgress<T>(
  path: string,
  file: File,
  contentType: string,
  onProgress?: (progress: UploadProgressSnapshot) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    let lastProgress: UploadProgressSnapshot | null = uploadProgressSnapshot(
      "uploading",
      0,
      file.size
    )
    xhr.open("POST", apiUrl(path), true)
    xhr.setRequestHeader("Accept", "application/json")
    if (contentType) xhr.setRequestHeader("Content-Type", contentType)

    xhr.upload.onprogress = (event) => {
      const totalBytes = event.lengthComputable ? event.total : file.size
      const loadedBytes = event.loaded
      lastProgress = uploadProgressSnapshot(
        "uploading",
        loadedBytes,
        totalBytes
      )
      onProgress?.(lastProgress)
    }

    xhr.upload.onload = () => {
      onProgress?.(uploadProgressSnapshot("processing", file.size, file.size))
    }

    xhr.onload = () => {
      const ok = xhr.status >= 200 && xhr.status < 300
      if (!ok) {
        onProgress?.(
          uploadProgressSnapshot(
            "error",
            lastProgress?.loadedBytes ?? 0,
            lastProgress?.totalBytes ?? file.size
          )
        )
        reject(
          new Error(responseTextErrorMessage(xhr.status, xhr.responseText))
        )
        return
      }
      try {
        onProgress?.(uploadProgressSnapshot("done", file.size, file.size))
        resolve(JSON.parse(xhr.responseText || "{}") as T)
      } catch {
        reject(new Error("Backend trả về JSON không hợp lệ."))
      }
    }

    xhr.onerror = () => {
      onProgress?.(
        uploadProgressSnapshot(
          "error",
          lastProgress?.loadedBytes ?? 0,
          lastProgress?.totalBytes ?? file.size
        )
      )
      reject(new Error("Không thể kết nối backend để upload ZIP."))
    }
    xhr.onabort = () => {
      onProgress?.(
        uploadProgressSnapshot(
          "error",
          lastProgress?.loadedBytes ?? 0,
          lastProgress?.totalBytes ?? file.size
        )
      )
      reject(new Error("Upload ZIP đã bị hủy."))
    }
    xhr.send(file)
  })
}

class PresignedUploadNetworkError extends Error {}

function putPresignedFile(
  uploadUrl: string,
  file: File,
  contentType: string,
  onProgress?: (progress: UploadProgressSnapshot) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    let lastProgress: UploadProgressSnapshot | null = uploadProgressSnapshot(
      "uploading",
      0,
      file.size
    )
    let settled = false
    let fallbackAbort = false
    let stallTimer: number | null = null

    const clearStallTimer = () => {
      if (stallTimer !== null) {
        window.clearTimeout(stallTimer)
        stallTimer = null
      }
    }
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      clearStallTimer()
      callback()
    }
    const rejectForFallback = () => {
      if (settled) return
      fallbackAbort = true
      xhr.abort()
      finish(() =>
        reject(
          new PresignedUploadNetworkError(
            "Direct presigned upload did not respond."
          )
        )
      )
    }
    const armStallTimer = () => {
      clearStallTimer()
      stallTimer = window.setTimeout(
        rejectForFallback,
        PRESIGNED_UPLOAD_STALL_MS
      )
    }
    xhr.open("PUT", uploadUrl, true)
    if (contentType) xhr.setRequestHeader("Content-Type", contentType)

    xhr.upload.onprogress = (event) => {
      armStallTimer()
      const totalBytes = event.lengthComputable ? event.total : file.size
      const loadedBytes = event.loaded
      lastProgress = uploadProgressSnapshot(
        "uploading",
        loadedBytes,
        totalBytes
      )
      onProgress?.(lastProgress)
    }

    xhr.onload = () => {
      const ok = xhr.status >= 200 && xhr.status < 300
      if (!ok) {
        if (xhr.status === 0) {
          finish(() =>
            reject(
              new PresignedUploadNetworkError(
                "Direct presigned upload did not respond."
              )
            )
          )
          return
        }
        onProgress?.(
          uploadProgressSnapshot(
            "error",
            lastProgress?.loadedBytes ?? 0,
            lastProgress?.totalBytes ?? file.size
          )
        )
        finish(() =>
          reject(
            new Error(presignedUploadErrorMessage(xhr.status, xhr.responseText))
          )
        )
        return
      }
      finish(resolve)
    }

    xhr.onerror = () => {
      finish(() =>
        reject(
          new PresignedUploadNetworkError(
            "Direct presigned upload did not respond."
          )
        )
      )
    }
    xhr.onabort = () => {
      if (fallbackAbort) return
      onProgress?.(
        uploadProgressSnapshot(
          "error",
          lastProgress?.loadedBytes ?? 0,
          lastProgress?.totalBytes ?? file.size
        )
      )
      reject(new Error("Upload ZIP lên Chỉnh Lý đã bị hủy."))
    }
    armStallTimer()
    xhr.send(file)
  })
}

function putPresignedBlob(
  uploadUrl: string,
  blob: Blob,
  contentType?: string | null,
  onProgress?: (loadedBytes: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", uploadUrl, true)
    if (contentType) xhr.setRequestHeader("Content-Type", contentType)

    xhr.upload.onprogress = (event) => {
      onProgress?.(event.loaded)
    }

    xhr.onload = () => {
      const ok = xhr.status >= 200 && xhr.status < 300
      if (!ok) {
        if (xhr.status === 0) {
          reject(
            new PresignedUploadNetworkError(
              "Direct presigned chunk upload did not respond."
            )
          )
          return
        }
        reject(
          new Error(presignedUploadErrorMessage(xhr.status, xhr.responseText))
        )
        return
      }
      resolve()
    }

    xhr.onabort = () => {
      reject(new Error("Upload chunk lên Chỉnh Lý đã bị hủy."))
    }
    xhr.onerror = () => {
      reject(
        new PresignedUploadNetworkError(
          "Direct presigned chunk upload did not respond."
        )
      )
    }
    xhr.send(blob)
  })
}

async function requestJsonOrNull<T>(
  path: string,
  init?: RequestInit
): Promise<T | null> {
  const response = await fetch(apiUrl(path), init)
  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response))
  }
  return response.json() as Promise<T>
}

async function responseErrorMessage(response: Response): Promise<string> {
  const text = await response.text()
  return responseTextErrorMessage(response.status, text)
}

function responseTextErrorMessage(status: number, text: string): string {
  if (!text) return `API error ${status}`
  try {
    const payload = JSON.parse(text) as { detail?: unknown }
    if (typeof payload.detail === "string") return payload.detail
    if (payload.detail) return JSON.stringify(payload.detail)
  } catch {
    return text
  }
  return text
}

function presignedUploadErrorMessage(status: number, text: string): string {
  if (status === 413) {
    return "Chỉnh Lý gateway từ chối file ZIP vì quá lớn (HTTP 413 Payload Too Large). Cần tăng giới hạn upload gateway hoặc dùng ZIP nhỏ hơn."
  }
  if (!text) return `Upload ZIP lên Chỉnh Lý lỗi ${status}`
  return responseTextErrorMessage(status, text)
}

function uploadProgressSnapshot(
  phase: UploadProgressSnapshot["phase"],
  loadedBytes: number,
  totalBytes: number
): UploadProgressSnapshot {
  const safeLoaded = Math.max(0, loadedBytes)
  const safeTotal = Math.max(0, totalBytes)
  return {
    phase,
    loadedBytes: safeLoaded,
    totalBytes: safeTotal,
    loadedMb: bytesToMb(safeLoaded),
    totalMb: bytesToMb(safeTotal),
    percent:
      safeTotal > 0
        ? Math.min(100, Math.round((safeLoaded / safeTotal) * 1000) / 10)
        : null,
  }
}

function bytesToMb(value: number): number {
  return Math.round((value / (1024 * 1024)) * 100) / 100
}

function defaultContentType(fileName: string): string {
  return fileName.toLowerCase().endsWith(".zip")
    ? "application/zip"
    : "application/octet-stream"
}

function apiUrl(path: string): string {
  return API_BASE ? `${API_BASE}${path}` : path
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}
