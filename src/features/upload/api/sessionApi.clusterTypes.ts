import type {
  ApiRevisionMetadata,
  DocumentNumberingMode,
} from "./sessionApi.sessionTypes"

export type BlankPageWarning = Record<string, unknown> & {
  type?: string
  severity?: string
  page_number?: number
  classification?: string
  is_blank?: boolean
  message?: string
  image_warnings?: Array<Record<string, unknown>>
}

export interface DocumentPreviewUrlResponse {
  session_id: string
  document_id: number
  document_numbering_mode?: DocumentNumberingMode | null
  data_path: string
  download_url?: string | null
  expires_in?: number | null
  expires_at?: string | null
  active_variant_key?: string | null
  preview_variants?: DocumentPreviewVariantResponse[]
}

export interface DocumentPreviewVariantResponse {
  key: string
  label: string
  data_path: string
  download_url?: string | null
  expires_in?: number | null
  expires_at?: string | null
  status?: string | null
  processing_status?: string | null
  version_id?: string | number | null
  version_type?: string | null
  blank_pages?: number[]
  removed_pages?: number[]
  blank_page_warnings?: BlankPageWarning[]
  image_warning_pages?: number[]
  source_page_count?: number | null
  output_page_count?: number | null
  same_as_original?: boolean
  error?: string | null
  note?: string | null
}

export interface DocumentArchiveDownload {
  blob: Blob
  fileName: string
}

export interface ClusterPlacement {
  id: number
  session_document_id: number
  document_id: string
  dossier_id?: string | null
  position_index: number
  placement_status: string
  requires_review: boolean
  page_count: number | null
  sheet_count: number | null
  source_page_count?: number | null
  output_page_count?: number | null
  document_numbering_mode?: DocumentNumberingMode | null
  dossier_suggestions?: SessionDossierSuggestion[] | null
  metadata: Record<string, unknown>
}

export interface SessionDossierSuggestionRepresentativeDocument {
  session_document_id: number
  document_id: string
  file_name: string
  title?: string | null
  issued_date?: string | null
  document_number?: string | null
}

export interface SessionDossierSuggestion {
  rank: number
  session_dossier_id: number
  dossier_id: string
  cluster_id: string
  title: string
  best_other_similarity: number
  average_similarity?: number
  matching_document_count?: number
  matched_document_ids?: string[]
  matched_session_document_ids?: number[]
  document_similarity_scores?: Array<{
    session_document_id: number
    document_id: string
    similarity: number
  }>
  representative_document_ids: string[]
  representative_documents: SessionDossierSuggestionRepresentativeDocument[]
  document_count: number
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
  metadata_revision?: number | null
}

export interface SessionDossierSummary {
  id?: number
  dossier_id: string
  cluster_id: string
  generated_title: string
  title: string
  title_override: string | null
  dossier_number: string | null
  dossier_code?: string | null
  box_number: string | null
  folder_name: string | null
  dossier_storage_id?: string | null
  retention_period: string | null
  notes?: string[]
  document_ids?: string[]
  page_count?: number | null
  archive_name?: string | null
  fonds_name?: string | null
  inventory_number?: string | null
  information_sign?: string | null
  annotation?: string | null
  start_date?: string | null
  end_date?: string | null
  language?: string | null
  sheet_count?: number | string | null
  usage_mode?: string | null
  physical_condition?: string | null
  paper_dossier_id?: string | null
  note?: string | null
  retention_recommendation: Record<string, unknown>
  retention_override?: Record<string, unknown>
  pending_metadata_import?: Record<string, unknown>
  pending_count_conflicts?: Array<Record<string, unknown>>
  manual_metadata_fields?: string[]
  metadata_revision?: number
  classification_status?: "current" | "pending" | "running" | "failed" | string
  classified_metadata_revision?: number | null
  status?: string
  source?: string
  created_by?: string | null
  created_from_temporary_folder?: boolean
  classification: DossierClassification | null
  updated_at?: string
}

export interface SessionDossierPatchPayload {
  title?: string | null
  dossier_number?: string | null
  dossier_code?: string | null
  box_number?: string | null
  folder_name?: string | null
  dossier_storage_id?: string | null
  retention_period?: string | null
  retention_candidate_entry_id?: string | null
  retention_candidate_version_id?: string | null
  archive_name?: string | null
  fonds_name?: string | null
  inventory_number?: string | null
  information_sign?: string | null
  annotation?: string | null
  start_date?: string | null
  end_date?: string | null
  language?: string | null
  sheet_count?: number | string | null
  page_count?: number | string | null
  usage_mode?: string | null
  physical_condition?: string | null
  paper_dossier_id?: string | null
  note?: string | null
  retention_recommendation?: Record<string, unknown> | null
  created_by?: string
}

export interface SessionDossierDraft {
  id: number
  session_id: string
  target_cluster_id: string
  source: string
  status: "pending" | "applied" | "cancelled" | string
  session_document_ids: number[]
  metadata: Record<string, unknown>
  manual_metadata_fields: string[]
  metadata_revision: number
  created_by?: string | null
  applied_cluster_version_id?: string | null
  applied_session_dossier_id?: number | null
  created_at: string
  updated_at: string
}

export interface SessionDossierDraftListResponse {
  session_id: string
  status?: string | null
  drafts: SessionDossierDraft[]
}

export interface SessionDossierRetentionCandidatesResponse {
  session_id: string
  dossier_id: string
  cluster_version_id: string
  retention_recommendation: Record<string, unknown>
  candidates: RetentionCandidateSummary[]
  versions?: RetentionCandidateVersion[]
  active_candidate_version_id?: string | null
  candidate_count: number
  candidates_truncated: boolean
}

export interface SessionDossierSuggestionPayload {
  draft_id?: number | null
  dossier_id?: string | null
  cluster_id?: string | null
  session_document_ids?: number[]
  metadata?: Record<string, unknown>
  options?: Record<string, unknown>
}

export interface SessionDossierTitleSuggestion {
  title: string
  confidence?: number | null
  rationale?: string | null
  source?: string | null
}

export interface SessionDossierSuggestionBaseResponse {
  session_id: string
  status: string
  target_type?: string | null
  target_key?: string | null
  draft_id?: number | null
  dossier_id?: string | null
  cluster_id?: string | null
  session_document_ids?: number[]
  input_summary?: Record<string, unknown>
  error?: string | null
}

export interface SessionDossierTitleSuggestionResponse extends SessionDossierSuggestionBaseResponse {
  suggestions: SessionDossierTitleSuggestion[]
}

export interface SessionDossierRetentionSuggestionResponse extends SessionDossierSuggestionBaseResponse {
  plan_version_id?: string | null
  recommendation?: Record<string, unknown> | null
  retention_recommendation?: Record<string, unknown> | null
  candidates: RetentionCandidateSummary[]
  versions?: RetentionCandidateVersion[]
  active_candidate_version_id?: string | null
  candidate_count: number
  candidates_truncated: boolean
  index?: Record<string, unknown> | null
}

export interface RetentionReferenceMergePathItem {
  name: string
  depth?: number | null
}

export interface RetentionReference {
  entry_id?: string | null
  appendix_name?: string | null
  source_file_name?: string | null
  merge_path?: RetentionReferenceMergePathItem[]
  breadcrumb?: string | null
  document_type?: string | null
  source_row_index?: string | number | null
  source_unit_index?: string | number | null
  retention_period?: string | null
  note?: string | null
}

export interface RetentionCandidateSummary extends RetentionReference {
  entry_id: string
  rank?: number | null
  combined_score?: number | null
  keyword_score?: number | null
  semantic_score?: number | null
  context?: RetentionReference | null
}

export interface RetentionCandidateVersion {
  version_id: string
  version_number?: number | null
  created_at?: string | null
  plan_version_id?: string | null
  cluster_version_id?: string | null
  source_hash?: string | null
  source_count?: number | null
  appendix_count?: number | null
  sources?: Array<{
    source_file_name?: string | null
    source_title?: string | null
    source_order?: number | null
    source_session_file_id?: number | string | null
    appendix_names?: string[]
    appendix_count?: number | null
  }>
  candidates: RetentionCandidateSummary[]
  candidate_count?: number | null
  candidates_truncated?: boolean
  status?: string | null
}

export interface SessionClusterSummary {
  id: number
  cluster_id: string
  dossier_id: string
  is_temporary?: boolean
  created_from_temporary_folder?: boolean
  title: string
  dossier: SessionDossierSummary | null
  dossiers?: SessionDossierSummary[]
  status: string
  notes: string[]
  document_ids: string[]
  page_count: number | null
  sheet_count: number | null
  start_date: string | null
  end_date: string | null
  placements: ClusterPlacement[]
}

export type ClusterGroupInformationRowType = "dossier" | "document"

export interface ClusterGroupInformationRow {
  row_index: number
  row_type: ClusterGroupInformationRowType
  dossier_id: string
  cluster_id: string
  session_dossier_id?: number | null
  session_document_id?: number | null
  document_id?: string | null
  dossier_number: string
  title: string
  count_value: number | null
  page_count: number | null
  sheet_count: number | null
  date_text: string
  start_date?: string | null
  end_date?: string | null
  document_number: string
  document_number_part?: string | null
  document_notation_part?: string | null
  author: string
  retention_period: string
  basis: string
  basis_detail?: string
  retention_reference?: RetentionReference | null
  retention_candidate_count?: number
  file_name: string
  position_index?: number | null
}

export interface ClusterGroupInformationTableResponse {
  session_id: string
  cluster_version_id: string
  version_number: number
  group_label: string
  document_numbering_mode: DocumentNumberingMode
  count_label: string
  dossier_count: number
  document_count: number
  rows: ClusterGroupInformationRow[]
}

export interface ClusterVersionResponse extends ApiRevisionMetadata {
  id: string
  session_id: string
  version_number: number
  source: string
  status: string
  previous_version_id: string | null
  plan_version_id: string | null
  summary: Record<string, unknown>
  affected_clusters: string[]
  batch_snapshot_count: number
  created_at: string
  clusters?: SessionClusterSummary[]
}

export interface ClusterVersionListResponse extends ApiRevisionMetadata {
  session_id: string
  versions: ClusterVersionResponse[]
}

export interface ClusterFeedbackResponse {
  id: number
  session_id: string
  session_document_id: number | null
  document_id?: string | null
  feedback_type: string
  source_cluster_id?: string | null
  target_cluster_id?: string | null
  weight?: number | null
  status: string
  details: Record<string, unknown>
  cancelled_metadata_keep_feedback_ids?: number[]
  created_by?: string | null
  created_at: string
}

export interface ClusterFeedbackPagination {
  limit?: number | null
  after_id?: number | null
  returned: number
  total: number
  has_more: boolean
}

export interface ClusterFeedbackListResponse extends ApiRevisionMetadata {
  session_id: string
  feedback: ClusterFeedbackResponse[]
  pending_feedback?: ClusterFeedbackResponse[]
  dossier_drafts?: SessionDossierDraft[]
  active_version_id?: string | null
  active_version_created_at?: string | null
  feedback_count?: number
  pending_feedback_count?: number
  dossier_draft_count?: number
  summary_only?: boolean
  pending_only?: boolean
  pagination?: ClusterFeedbackPagination
}

export interface CancelPendingClusterFeedbackResponse {
  session_id: string
  active_version_id?: string | null
  active_version_created_at?: string | null
  cancelled_feedback_count: number
  cancelled_feedback_ids: number[]
  cancelled_draft_ids?: number[]
  feedback_event_id?: number | null
  status: string
}

export interface DossierPromoteResponse {
  session_id: string
  target_cluster_id: string
  temporary_cluster_id?: string
  promoted_document_ids: string[]
  promoted_session_document_ids: number[]
  feedback_count: number
  cancelled_metadata_keep_feedback_ids?: number[]
  feedback_event_id?: number
  recompute_status?: string
  worker_required?: boolean
  action?: string
  draft_id?: number
  draft?: SessionDossierDraft
}

export interface TemporaryFolderPromoteResponse extends DossierPromoteResponse {
  temporary_cluster_id: string
}

export type SelectedDocumentsPromoteResponse = DossierPromoteResponse

export interface SelectedDocumentsMoveResponse {
  session_id: string
  target_cluster_id: string
  moved_document_ids: string[]
  moved_session_document_ids: number[]
  feedback_count: number
  cancelled_metadata_keep_feedback_ids?: number[]
  feedback_event_id?: number
  recompute_status?: string
  worker_required?: boolean
  action?: string
}
