// Shared digitization response types used by the session-backed OCR flow.

import type {
  ApiRevisionMetadata,
  MetadataBatchSummary,
  PaginationMeta,
  SessionIngestionRun,
} from "./sessionApi.types"

export interface FolderPreviewRequest {
  folder_path: string
  recursive: boolean
  max_files: number
  metadata_fields: string[]
  force: boolean
}

export interface JobSummary {
  id: number
  lifecycle_status?: "active" | "delete_pending" | "deleted" | string
  generation?: number
  delete_requested_at?: string | null
  deleted_at?: string | null
  deleted_by_name?: string | null
  delete_error?: string | null
  preview_available?: boolean
  ocr_batch_id?: number | null
  document_id: string
  data_path: string
  import_action?: string | null
  metadata_batch_id?: string | null
  metadata_batch_name?: string | null
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
  signature_status?: string | null
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

export interface FolderStatusResponse extends ApiRevisionMetadata {
  batch_id?: number | null
  folder_path: string
  recursive: boolean
  total_files: number
  total_jobs: number
  missing_files: string[]
  status_counts: Record<string, number>
  document_numbering_mode?: string | null
  remove_blank_pages_before_ocr?: boolean
  upload_mode?: "append" | "overwrite" | string | null
  reextracting?: boolean
  pdf_preprocessing?: Record<string, unknown> | null
  metadata_extraction_status?: string | null
  metadata_extraction_complete?: boolean | null
  metadata_extraction_completed_at?: string | null
  digitization_complete?: boolean | null
  metadata_ready_documents?: number
  metadata_final_documents?: number
  metadata_complete_documents?: number
  metadata_processing_documents?: number
  metadata_usable_documents?: number
  metadata_perfect_documents?: number
  metadata_failed_documents?: number
  metadata_skipped_documents?: number
  metadata_cancelled_documents?: number
  metadata_missing_task_documents?: number
  metadata_verified_documents?: number
  metadata_reviewed_documents?: number
  metadata_warning_documents?: number
  signature_extracted_documents: number
  signature_pending_documents: number
  signature_failed_documents: number
  extracting_ingestion_runs?: number
  extracting_zip_ingestion_runs?: number
  updating_ingestion_runs?: number
  updating_ingestion_run_ids?: number[]
  ready_ingestion_runs?: number
  failed_ingestion_runs?: number
  metadata_batches?: MetadataBatchSummary[]
  pagination?: PaginationMeta
  ingestion_runs?: SessionIngestionRun[]
  jobs: JobSummary[]
}
