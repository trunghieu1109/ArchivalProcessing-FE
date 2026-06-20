export type ProcessState = "idle" | "processing" | "done"

export interface SectionHandle {
  hasFile: () => boolean
  process: () => Promise<void>
}

export interface ArchiveEntry {
  name: string
  size: number
  isDir: boolean
}

export interface ClassificationCriterion {
  id: string
  field: string
  label: string
  values: string[]
  definition: string
}

export interface PlanLeafCandidate {
  title: string
  kind?: string
  evidence?: string
}

export interface PlanLeafGroupCandidates {
  leaf_group_ref: string
  candidates: PlanLeafCandidate[]
}

export interface RetentionAppendixNode {
  type: string
  name: string
  retention_period?: string
  note?: string
  source_row_index?: number | null
  source_unit_index?: number | null
  source_file_name?: string
  children: RetentionAppendixNode[]
}

export interface PlanGroup {
  id: string
  name: string
  type: string
  definition: string
  candidates?: PlanLeafCandidate[]
  children: PlanGroup[]
}

export interface PlanCriterionSet {
  group_level: string
  criteria: string[]
}

export type FileRegisterAnalysisStatus =
  | "detected"
  | "not_detected"
  | "ambiguous"

export type FileRegisterTimeGranularity = "year" | "quarter" | "month"

export interface FileRegisterConfig {
  analysis_status: FileRegisterAnalysisStatus
  summary: string
  evidence: string[]
  steps: Array<{
    criterion: "document_type" | "issued_date"
    granularity?: FileRegisterTimeGranularity
  }>
  merge_small_dossiers: boolean
}

export interface ParsedPlan {
  summary: string
  fonds_name: string
  groups: PlanGroup[]
  criterias: PlanCriterionSet[]
  leaf_group_candidates: PlanLeafGroupCandidates[]
  file_register_config: FileRegisterConfig
  retention_appendices: RetentionAppendixNode[]
}

export interface FolderNode {
  id: string
  name: string
  children: FolderNode[]
  type?: string
  definition?: string
  candidates?: PlanLeafCandidate[]
  criteria?: ClassificationCriterion[]
  hoSoName?: string
  soHoSo?: string
  thoiHanBaoQuan?: string
}

export interface PdfMetadata {
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
  light_metadata: Record<string, unknown>
  normalized_metadata?: Record<string, unknown>
  raw_metadata?: Record<string, unknown>
  pdf_preprocessing?: Record<string, unknown> | null
  error?: string | null
  applied: boolean
}

export type AppStep = 1 | 2 | 3 | 4 | 5 | 6
