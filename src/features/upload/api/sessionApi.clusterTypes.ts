import type { DocumentNumberingMode } from "./sessionApi.sessionTypes"

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
  sheet_count?: string | null
  usage_mode?: string | null
  physical_condition?: string | null
  note?: string | null
  retention_recommendation: Record<string, unknown>
  retention_override?: Record<string, unknown>
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
  box_number?: string | null
  folder_name?: string | null
  retention_period?: string | null
  archive_name?: string | null
  fonds_name?: string | null
  inventory_number?: string | null
  information_sign?: string | null
  annotation?: string | null
  start_date?: string | null
  end_date?: string | null
  language?: string | null
  sheet_count?: string | null
  usage_mode?: string | null
  physical_condition?: string | null
  note?: string | null
  created_by?: string
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

export interface ClusterVersionResponse {
  id: string
  session_id: string
  version_number: number
  source: string
  status: string
  previous_version_id: string | null
  summary: Record<string, unknown>
  affected_clusters: string[]
  batch_snapshot_count: number
  created_at: string
  clusters?: SessionClusterSummary[]
}

export interface ClusterVersionListResponse {
  session_id: string
  versions: ClusterVersionResponse[]
}

export interface DossierPromoteResponse {
  session_id: string
  target_cluster_id: string
  temporary_cluster_id?: string
  promoted_document_ids: string[]
  promoted_session_document_ids: number[]
  feedback_count: number
  feedback_event_id?: number
  recompute_status?: string
  worker_required?: boolean
  action?: string
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
  feedback_event_id?: number
  recompute_status?: string
  worker_required?: boolean
  action?: string
}
