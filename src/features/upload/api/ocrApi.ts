// Shared digitization response types used by the session-backed OCR flow.

export interface FolderPreviewRequest {
  folder_path: string
  recursive: boolean
  max_files: number
  metadata_fields: string[]
  force: boolean
}

export interface JobSummary {
  id: number
  ocr_batch_id?: number | null
  document_id: string
  data_path: string
  import_action?: string | null
  metadata_batch_id?: string | null
  metadata_batch_assigned_to_user_id?: string | number | null
  metadata_batch_assigned_to_email?: string | null
  metadata_batch_assigned_to_name?: string | null
  metadata_batch_assigned_at?: string | null
  metadata_verified_by_user_id?: string | number | null
  metadata_verified_by_email?: string | null
  metadata_verified_by_name?: string | null
  metadata_verified_at?: string | null
  metadata_review_note?: string | null
  status: string
  remote_metadata_status?: string | null
  review_status: string
  is_reviewed?: boolean
  metadata_ready: boolean
  metadata_final: boolean
  metadata_version_count?: number
  metadata_user_edited?: boolean
  error?: string | null
  light_metadata?: Record<string, unknown>
  normalized_metadata?: Record<string, unknown>
  raw_metadata?: Record<string, unknown>
  pdf_preprocessing?: Record<string, unknown> | null
}

export interface FolderPreviewResponse {
  folder_path: string
  recursive: boolean
  total_files: number
  job_ids: number[]
  jobs: JobSummary[]
}

export interface FolderStatusResponse {
  batch_id?: number | null
  folder_path: string
  recursive: boolean
  total_files: number
  total_jobs: number
  missing_files: string[]
  status_counts: Record<string, number>
  document_numbering_mode?: string | null
  upload_mode?: "append" | "overwrite" | string | null
  reextracting?: boolean
  pdf_preprocessing?: Record<string, unknown> | null
  signature_extracted_documents: number
  signature_pending_documents: number
  signature_failed_documents: number
  jobs: JobSummary[]
}
