import type {
  ApiRevisionMetadata,
  ActiveJobSummary,
  DocumentNumberingMode,
  DocumentNumberingStylePreset,
  UploadMode,
} from "./sessionApi.sessionTypes"
import type { BlankPageWarning } from "./sessionApi.clusterTypes"

export interface PaginationMeta {
  total: number
  limit: number | null
  offset: number
  returned: number
  has_more: boolean
  next_offset?: number | null
}

export interface DigitizationDocument {
  id: number
  ocr_batch_id?: number | null
  document_id: string
  data_path: string
  metadata_batch_id?: string | null
  metadata_batch_name?: string | null
  last_import_job_id?: string | number | null
  import_action?: string | null
  content_revision?: number | null
  metadata_batch_assigned_to_user_id?: string | number | null
  metadata_batch_assigned_to_email?: string | null
  metadata_batch_assigned_to_name?: string | null
  metadata_batch_assigned_at?: string | null
  metadata_verified_by_user_id?: string | number | null
  metadata_verified_by_email?: string | null
  metadata_verified_by_name?: string | null
  metadata_verified_at?: string | null
  metadata_review_note?: string | null
  remote_metadata_status?: string | null
  signature_status?: string | null
  ocr_status: string
  review_status: string
  is_reviewed?: boolean
  metadata_ready: boolean
  metadata_final: boolean
  metadata_version_count?: number
  metadata_user_edited?: boolean
  latest_metadata_version?: MetadataVersionSummary | null
  raw_metadata?: Record<string, unknown>
  metadata?: Record<string, unknown>
  normalized_metadata?: Record<string, unknown>
  pdf_preprocessing?: Record<string, unknown> | null
  error?: string | null
}

export interface DigitizationBatch {
  id: number
  ingestion_run_id?: number | null
  folder_path: string
  recursive: boolean
  total_files: number | null
  total_jobs: number | null
  missing_files: string[]
  status_counts: Record<string, number>
  status: string
  document_numbering_mode?: DocumentNumberingMode | null
  document_numbering_style_preset?: DocumentNumberingStylePreset | null
  document_numbering_style_overrides?: {
    font_size?: number
    color?: string
    opacity?: number
  } | null
  remove_blank_pages_before_ocr?: boolean
  remote_file_id?: string | number | null
  upload_mode?: UploadMode | string | null
  pdf_preprocessing?: Record<string, unknown> | null
  metadata_extraction_status?: string | null
  metadata_extraction_complete?: boolean | null
  metadata_extraction_completed_at?: string | null
  digitization_complete?: boolean | null
}

export interface DigitizationStatusResponse extends ApiRevisionMetadata {
  session_id: string
  ingestion_runs: import("./sessionApi.sessionTypes").SessionIngestionRun[]
  batches: DigitizationBatch[]
  documents: DigitizationDocument[]
  pagination?: PaginationMeta
  summary: {
    total_documents: number
    metadata_ready?: number
    metadata_final?: number
    complete_documents?: number
    processing_documents?: number
    metadata_usable_documents?: number
    perfect_documents?: number
    failed_documents?: number
    skipped_documents?: number
    cancelled_documents?: number
    missing_task_documents?: number
    verified?: number
    reviewed?: number
    warning?: number
    signature_extracted_documents?: number
    signature_pending_documents?: number
    signature_failed_documents?: number
    extracting_ingestion_runs?: number
    ready_ingestion_runs?: number
    failed_ingestion_runs?: number
    status_counts: Record<string, number>
  }
  metadata_batches?: MetadataBatchSummary[]
}

export type MetadataDocumentScopeType =
  | "all"
  | "unassigned"
  | "reviewed"
  | "auto"
  | "batch"

export interface MetadataDocumentScope {
  scope: MetadataDocumentScopeType
  batchId?: string | null
  offset?: number
  size?: number
}

export interface MetadataBatchSummary {
  kind: "manual" | "reviewed" | "unassigned"
  batch_id?: string | null
  name?: string | null
  batch_name?: string | null
  display_index?: number | null
  total_count: number
  ready_count: number
  reviewed_count: number
  auto_verified_count?: number
  warning_count: number
  failed_count?: number
  pending_ready_count: number
  assignee_user_id?: string | number | null
  assignee_email?: string | null
  assignee_name?: string | null
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

export interface NumberingDocumentStatus {
  session_document_id: number
  document_id: string
  file_name: string
  data_path: string
  cluster_id: string
  cluster_status?: string | null
  document_change_status?: string | null
  dossier_id: string
  dossier_title: string
  session_dossier_id?: number | null
  dossier_number?: string | null
  box_number?: string | null
  hoso_id?: string | null
  hop_id?: string | null
  position_index: number
  status: string
  mode: DocumentNumberingMode
  style_preset?: DocumentNumberingStylePreset | null
  document_numbering_style_preset?: DocumentNumberingStylePreset | null
  document_numbering_style_overrides?: {
    font_size?: number
    color?: string
    opacity?: number
  } | null
  document_number_start: number
  document_number_end: number
  entry_count: number
  source_page_count: number
  output_page_count: number
  blank_pages: number[]
  blank_page_warnings?: BlankPageWarning[]
  image_warning_pages?: number[]
  pending_count_conflicts?: MetadataCountConflict[]
  numbering_pages?: number[]
  numbering_entries?: Array<{
    page_number: number
    label: string
    numbering_number?: number | null
    numbering_suffix?: string | null
    numbering_width?: number | null
  }>
  source_version_id?: string | null
  numbering_manifest_version_id?: string | number | null
  render_task_id?: string | number | null
  remote_render_status?: string | null
  numbered_pdf_version_id?: string | number | null
  download_url?: string | null
  proxy_download_url?: string | null
  expires_at?: string | number | null
  error?: string | null
  updated_at?: string | null
}

export interface NumberingDossierStatus {
  dossier_id: string
  title: string
  session_dossier_id?: number | null
  dossier_number?: string | null
  box_number?: string | null
  hoso_id?: string | null
  hop_id?: string | null
  pending_count_conflicts?: MetadataCountConflict[]
  document_count: number
  status_counts: Record<string, number>
}

export interface NumberingStatusResponse extends ApiRevisionMetadata {
  session_id: string
  cluster_version_id: string
  document_numbering_mode: DocumentNumberingMode
  document_numbering_style_preset?: DocumentNumberingStylePreset | null
  document_numbering_style_overrides?: {
    font_size?: number
    color?: string
    opacity?: number
  } | null
  active: boolean
  job: ActiveJobSummary | null
  summary: {
    total_documents: number
    total_dossiers?: number
    status_counts: Record<string, number>
    done: number
    failed: number
    pending: number
    running: number
    blank_page_warning_documents?: number
  }
  documents: NumberingDocumentStatus[]
  dossiers: NumberingDossierStatus[]
  pagination?: PaginationMeta
}

export interface NumberedDocumentPreviewUrlResponse {
  session_id: string
  session_document_id: number
  document_id: string
  file_name: string
  numbered_pdf_version_id: string | number
  version_type?: string | null
  object_name?: string | null
  download_url: string
  proxy_download_url?: string | null
  expires_in?: number | null
  expires_at?: string | number | null
}

export interface NumberingStyleOption {
  style_preset: DocumentNumberingStylePreset
  name?: string
  display_name?: string
  description?: string
  font_family?: string
  font_style?: string
  font_weight?: string
  font_size?: number
  color?: string
  opacity?: number
  circle?: Record<string, unknown>
}

export interface NumberingStylesResponse {
  default_style_preset: DocumentNumberingStylePreset
  style_aliases?: Record<string, DocumentNumberingStylePreset>
  styles: NumberingStyleOption[]
  source?: string
}

export interface EnqueueNumberingResponse {
  session_id: string
  job_id: number | null
  job_type: string
  status: "queued" | "already_queued_or_running" | "not_needed"
  created: boolean
  payload: Record<string, unknown>
  worker_required: boolean
  result?: NumberingStatusResponse
}

export interface ArtifactListResponse extends ApiRevisionMetadata {
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
  clusterId?: string
  label: string
  dossierId?: string | null
  dossierStorageId?: string | null
  dossierNumber?: string | null
  boxNumber?: string | null
  folderName?: string | null
  archiveName?: string | null
  fondsName?: string | null
  inventoryNumber?: string | null
  informationSign?: string | null
  annotation?: string | null
  classificationPath?: string[]
  retentionPeriod?: string | null
  language?: string | null
  usageMode?: string | null
  physicalCondition?: string | null
  paperDossierId?: string | null
  note?: string | null
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
  numbering_mode?: DocumentNumberingMode
  confirmed_count_conflicts?: boolean
  matched_rows: number
  unmatched_rows: number
  updated_dossiers: number
  unchanged_dossiers: number
  conflict_count: number
  row_conflict_count?: number
  count_conflict_count?: number
  pending_count_updates?: number
  requires_confirmation?: boolean
  updated?: Array<Record<string, unknown>>
  unchanged?: Array<Record<string, unknown>>
  conflicts?: Array<Record<string, unknown>>
  count_conflicts?: MetadataCountConflict[]
  unmatched?: Array<Record<string, unknown>>
}

export interface MetadataCountConflict {
  session_dossier_id: number
  dossier_id: string
  cluster_id: string
  dossier_number: string
  dossier_title: string
  field: "page_count" | "sheet_count"
  numbering_mode: DocumentNumberingMode
  old_value: number
  new_value: number
  tag: string
  row_numbers: number[]
}

export interface SessionDocumentResponse {
  id: number
  session_id: string
  ocr_batch_id?: number | null
  document_id: string
  data_path: string
  file_name: string
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
  remote_metadata_status?: string | null
  signature_status?: string | null
  ocr_status: string
  review_status: string
  is_reviewed?: boolean
  metadata_ready: boolean
  metadata_final: boolean
  metadata_version_count?: number
  metadata_user_edited?: boolean
  latest_metadata_version?: MetadataVersionSummary | null
  metadata?: Record<string, unknown>
  normalized_metadata?: Record<string, unknown>
  raw_metadata?: Record<string, unknown>
  pdf_preprocessing?: Record<string, unknown> | null
  error?: string | null
}

export interface BulkVerifyDocumentsResponse {
  session_id: string
  requested_count: number
  verified_count: number
  failed_count: number
  documents: SessionDocumentResponse[]
  errors: Array<{
    document_id: number
    detail: string
  }>
}

export interface CreateMetadataBatchResponse {
  session_id: string
  batch_id: string
  metadata_batch_id?: string
  batch_name?: string | null
  metadata_batch_name?: string | null
  assigned_to_user_id?: string | number | null
  assigned_to_email?: string | null
  assigned_to_name?: string | null
  batch_created?: boolean
  appended_to_existing_batch?: boolean
  existing_batch_document_count?: number
  batch_document_count?: number
  requested_count?: number
  updated_count: number
  skipped_count?: number
  documents: SessionDocumentResponse[]
  skipped_documents?: SessionDocumentResponse[]
  errors?: Array<{
    document_id: number
    metadata_batch_id?: string | null
    metadata_batch_name?: string | null
    detail: string
  }>
}

export interface AutoMetadataBatchPlanGroup {
  index: number
  display_index?: number | null
  start: number
  end: number
  total_count: number
  document_ids: number[]
}

export interface AutoMetadataBatchPlanResponse {
  session_id: string
  batch_size: number
  batch_count?: number
  existing_batch_count?: number
  total_count: number
  groups: AutoMetadataBatchPlanGroup[]
}

export interface CloseMetadataBatchResponse {
  session_id: string
  batch_id: string
  reviewed_batch_id?: string
  reviewed_count?: number
  verified_batch_id?: string
  verified_count?: number
  unassigned_count: number
  updated_count: number
  documents: SessionDocumentResponse[]
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
