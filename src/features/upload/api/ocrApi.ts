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
  document_id: string
  data_path: string
  status: string
  remote_metadata_status?: string | null
  review_status: string
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
  reextracting?: boolean
  pdf_preprocessing?: Record<string, unknown> | null
  signature_extracted_documents: number
  signature_pending_documents: number
  signature_failed_documents: number
  jobs: JobSummary[]
}
