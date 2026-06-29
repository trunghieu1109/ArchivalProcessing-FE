import type { FileRegisterConfig } from "@/features/upload/types"

export type SessionInputFileType =
  | "arrangement_plan"
  | "retention_schedule"
  | "raw_zip"

export type DossierBuildStrategy = "incremental" | "file_register"
export type DocumentNumberingMode = "page" | "sheet"
export type DocumentNumberingStylePreset =
  | "pencil_miama"
  | "pencil_bradley"
  | "stamp_times_bold"
export type UploadMode = "append" | "overwrite"

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

export interface SessionDetailResponse extends SessionSummary {
  files: SessionInputUploadResponse[]
  active_plan_analysis_job?: ActiveJobSummary | null
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

export interface ClusterBuildStatusResponse {
  session_id: string
  job_type: "build_clusters"
  active: boolean
  job: ActiveJobSummary | null
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
  onProgress?: (progress: UploadProgressSnapshot) => void
}

export interface ActivePlanResponse {
  id?: string
  version_number?: number
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
}
