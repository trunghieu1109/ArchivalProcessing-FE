import type { FileRegisterConfig } from "@/features/upload/types"

export type SessionInputFileType =
  | "arrangement_plan"
  | "retention_schedule"
  | "raw_zip"
  | "dossier_title_catalog"

export type DossierBuildStrategy =
  | "incremental"
  | "file_register"
  | "predefined"
  | "hybrid"
export type DocumentNumberingMode = "page" | "sheet"
export type DocumentNumberingStylePreset =
  | "pencil_miama"
  | "pencil_bradley"
  | "stamp_times_bold"
export type PlanVersionStatus = "draft" | "active" | "superseded"
export type UploadMode = "append" | "overwrite"

export interface ApiRevisionMetadata {
  revision?: number
  documents_revision?: number
  updated_at?: string | null
  last_event_id?: number | null
}

export interface CreateSessionResponse {
  session_id: string
  status: string
  archive_name?: string | null
  archive_code?: string | null
  fonds_name?: string | null
  fonds_creator_code?: string | null
  coordinator_user_id?: string | null
  remote_ingestion_batch_id?: string | null
  remote_ingestion_status?: string | null
  created_at: string
}

export interface SessionSummary {
  session_id: string
  status: string
  archive_name?: string | null
  archive_code?: string | null
  fonds_name?: string | null
  fonds_creator_code?: string | null
  coordinator_user_id?: string | null
  remote_ingestion_batch_id?: string | null
  remote_ingestion_status?: string | null
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
  pagination?: {
    total: number
    limit: number
    offset: number
    returned: number
    has_more: boolean
    next_offset?: number | null
  }
}

export interface DeleteSessionResponse {
  session_id: string
  deleted: boolean
  deleted_storage_paths: string[]
  storage_cleanup_errors: Array<{
    path: string
    error: string
  }>
}

export interface EnqueuePlanAnalysisResponse {
  session_id: string
  job_id: number
  job_type: "analyze_plan"
  status: string
  payload: Record<string, unknown>
}

export interface SessionDetailResponse extends SessionSummary {
  files: SessionInputUploadResponse[]
  active_plan_analysis_job?: ActiveJobSummary | null
  latest_folder_upload?: FolderUploadSummary | null
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
  ingestion_run?: SessionIngestionRun | null
  client_upload_id?: string | null
  upload_status?: string | null
  remote_upload_id?: string | null
  cancel_reason?: string | null
  cancelled_at?: string | null
  created_at?: string
  updated_at?: string
  catalog_checksum?: string | null
  mapping_count?: number | null
  header_mode?: "recognized_headers" | "first_two_columns" | string
  warnings?: string[]
}

export interface DeleteDossierTitleCatalogResponse {
  session_id: string
  deleted: boolean
  deleted_storage_paths?: string[]
}

export interface DossierTitleCatalogMappingItem {
  id: number
  temporary_code: string
  dossier_title: string
  start_time: string | null
  end_time: string | null
  retention_period: string | null
  source_row: number
}

export interface DossierTitleCatalogMappingsResponse {
  session_id: string
  catalog_file: {
    id: number
    file_name: string | null
    checksum: string | null
  } | null
  mapping_count: number
  total: number
  offset: number
  limit: number
  query: string
  items: DossierTitleCatalogMappingItem[]
}

export interface SessionIngestionRun {
  id: number
  session_id: string
  session_file_id?: number | null
  folder_upload_id?: string | null
  ingestion_source?: "zip" | "folder" | string
  ocr_batch_ids?: number[]
  file_name?: string | null
  remote_ingestion_batch_id?: string | null
  remote_file_id?: string | null
  remote_extract_job_id?: string | null
  upload_mode: UploadMode | string
  max_files?: number | null
  status: string
  total_pdf_files?: number | null
  extracted_count: number
  skipped_count: number
  error?: string | null
  last_polled_at?: string | null
  extract_started_at?: string | null
  extract_completed_at?: string | null
  created_at?: string
  updated_at?: string
}

export interface SessionInputRemoteUploadPresignResponse {
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
  client_upload_id?: string | null
}

export interface SessionInputRemoteChunkedCreateResponse {
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
  client_upload_id?: string | null
}

export type FolderUploadMode = "append" | "overwrite"
export type FolderUploadFileStatus =
  | "registered"
  | "presigned"
  | "confirmed"
  | "skipped"
  | "failed"
  | "cancelled"

export interface FolderUploadCounts {
  registered: number
  confirmed: number
  skipped: number
  failed: number
  cancelled: number
  effective: number
  mapped_documents: number
  unregistered: number
  unfinished: number
}

export interface FolderUploadIngestionRun {
  id: number
  session_id: string
  ingestion_source: string
  folder_upload_id: string
  status: string
  ocr_batch_ids: number[]
}

export interface FolderUploadSummary {
  folder_upload_id: string
  session_id: string
  client_upload_id: string
  mode: FolderUploadMode
  root_name: string
  status: string
  document_sync_status: string
  expected_file_count: number
  expected_total_bytes: number
  counts: FolderUploadCounts
  lease_expires_at?: string | null
  cancel_reason?: string | null
  cancelled_at?: string | null
  sealed_at?: string | null
  ingestion_run?: FolderUploadIngestionRun | null
  error?: string | null
  created_at: string
  updated_at: string
}

export interface FolderUploadFile {
  file_id: number
  client_file_id: string
  relative_path: string
  normalized_relative_path: string
  size_bytes: number
  content_type: string
  status: FolderUploadFileStatus
  action?: "created" | "overwritten" | "skipped" | string | null
  remote_document_id?: string | null
  attempt_count: number
  etag?: string | null
  error?: unknown
  created_at: string
  updated_at: string
}

export interface FolderUploadRegisterResponse {
  folder_upload_id: string
  files: FolderUploadFile[]
  counts: FolderUploadCounts
}

export interface FolderUploadPresignFile {
  file_id: number
  method: "PUT" | string
  upload_url: string
  upload_headers: Record<string, string>
  expires_at?: string | null
}

export interface FolderUploadPresignResponse {
  folder_upload_id: string
  files: FolderUploadPresignFile[]
}

export interface FolderUploadCompleteResponse {
  folder_upload_id: string
  files: FolderUploadFile[]
  counts: FolderUploadCounts
}

export interface FolderUploadFileListResponse {
  items: FolderUploadFile[]
  next_after_id?: number | null
  has_more: boolean
}

export interface SessionInputRemoteChunkedPart {
  part_number: number
  object_name: string
  upload_url: string
  byte_start: number
  byte_end: number
  size_bytes: number
  content_type?: string | null
}

export interface SessionInputRemoteChunkedPartsPresignResponse {
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

export interface ClusterBuildStatusResponse extends ApiRevisionMetadata {
  session_id: string
  job_type: "build_clusters"
  active: boolean
  job: ActiveJobSummary | null
  progress: {
    event_id: number
    job_id: number
    phase: string
    message?: string | null
    created_at?: string | null
  } | null
}

export interface EnsureClusterBuildResponse {
  session_id: string
  pending_document_count: number
  pending_document_ids: number[]
  pending_feedback_count?: number
  pending_feedback_ids?: number[]
  oldest_pending_age_seconds?: number | null
  reason: string
  should_enqueue: boolean
  created: boolean
  status: "queued" | "already_queued_or_running" | "not_needed"
  job_id?: number | null
  payload?: Record<string, unknown>
}

export interface SessionEventResponse {
  events: Array<{
    id: number
    session_id?: string
    event_type: string
    message?: string | null
    payload?: Record<string, unknown>
    created_at?: string
  }>
}

export interface UploadSessionInputOptions {
  createdBy?: string
  uploadMode?: UploadMode
  maxFiles?: number
  clientUploadId?: string
  jobId?: string
  signal?: AbortSignal
  onProgress?: (progress: UploadProgressSnapshot) => void
}

export interface ActivePlanResponse {
  id?: string
  session_id?: string
  version_number?: number
  status?: PlanVersionStatus
  source?: string
  created_at?: string
  summary: string
  dossier_build_strategy?: DossierBuildStrategy
  document_numbering_mode?: DocumentNumberingMode
  document_numbering_style_preset?: DocumentNumberingStylePreset
  document_numbering_style_overrides?: {
    font_size?: number
    color?: string
    opacity?: number
  } | null
  archive_name?: string
  fonds_name: string
  groups?: unknown[]
  flat_groups?: unknown[]
  classification_groups?: unknown[]
  criterias?: unknown[]
  leaf_group_candidates?: unknown[]
  file_register_config?: FileRegisterConfig
  retention_appendices?: unknown[]
  retention_sources?: RetentionSourceStatus[]
}

export interface RetentionSourceStatus {
  session_file_id?: number | null
  file_name: string
  source_title?: string | null
  source_order?: number | null
  status: "success" | "error"
  appendix_count?: number | null
  unit_count?: number | null
  error?: string | null
}
