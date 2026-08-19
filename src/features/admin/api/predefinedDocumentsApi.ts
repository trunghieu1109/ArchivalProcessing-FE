import { requestJson } from "@/features/upload/api/sessionApi.http"

export type PredefinedImportMode = "replace" | "append"

export interface PredefinedDocumentsSummary {
  active_row_count: number
  active_unique_hash_count: number
  active_dossier_key_count: number
  active_conflicting_hash_count: number
  latest_import_batch_id: string | null
  latest_source_file_name: string | null
  latest_imported_at: string | null
}

export interface PredefinedDocumentItem {
  id: number
  dossier_id: string
  predefined_dossier_key: string
  document_hash: string
  hash_version: number
  document_summary: string
  long_summary: string
  document_number: string
  document_type: string
  issuing_agency: string
  issued_date: string
  mentioned_subjects: string[]
  import_batch_id: string
  source_row: number
  source_file_name: string
  is_active: boolean
  created_at: string
}

export interface PredefinedDocumentsResponse {
  summary: PredefinedDocumentsSummary
  total: number
  offset: number
  limit: number
  query: string
  active_only: boolean
  items: PredefinedDocumentItem[]
}

export interface PredefinedImportExample {
  document_hash: string
  row_count: number
  source_rows: number[]
  predefined_dossier_keys: string[]
  document_number: string
  document_summary: string
}

export interface PredefinedImportPreview {
  mode: PredefinedImportMode
  file_name: string
  file_checksum: string
  row_count: number
  unique_hash_count: number
  unique_dossier_key_count: number
  duplicate_hash_group_count: number
  conflicting_hash_group_count: number
  hash_version: number
  warnings: string[]
  duplicate_examples: PredefinedImportExample[]
  conflict_examples: PredefinedImportExample[]
}

export interface PredefinedImportResponse {
  mode: PredefinedImportMode
  import_batch_id: string
  imported_row_count: number
  import: Omit<PredefinedImportPreview, "mode">
  active_summary: PredefinedDocumentsSummary
}

export interface PredefinedMatchExample {
  source_row: number
  status: string
  is_match: boolean
  candidate_count: number
  is_multiple_match: boolean
  document_hash: string
  populated_hash_field_count: number
  issuing_agency: string
  issued_date: string
  document_number: string
  document_type: string
}

export interface PredefinedMatchEvaluation {
  file_name: string
  file_checksum: string
  hash_version: number
  total_document_count: number
  hashable_document_count: number
  unhashable_document_count: number
  partial_hash_document_count: number
  unique_input_hash_count: number
  duplicate_input_hash_group_count: number
  matched_document_count: number
  unmatched_document_count: number
  match_rate: number
  hashable_match_rate: number
  unmatched_rate: number
  unhashable_rate: number
  multiple_predefined_match_count: number
  active_predefined_row_count: number
  active_predefined_hash_count: number
  warnings: string[]
  unmatched_examples: PredefinedMatchExample[]
  multiple_match_examples: PredefinedMatchExample[]
}

export function listPredefinedDocuments(
  options: { offset?: number; limit?: number; query?: string } = {}
): Promise<PredefinedDocumentsResponse> {
  const params = new URLSearchParams({
    offset: String(options.offset ?? 0),
    limit: String(options.limit ?? 50),
    active_only: "true",
  })
  if (options.query?.trim()) params.set("q", options.query.trim())
  return requestJson<PredefinedDocumentsResponse>(
    `/admin/predefined-documents?${params.toString()}`
  )
}

export function previewPredefinedDocuments(
  file: File,
  mode: PredefinedImportMode
): Promise<PredefinedImportPreview> {
  return upload<PredefinedImportPreview>("import-preview", file, mode)
}

export function importPredefinedDocuments(
  file: File,
  mode: PredefinedImportMode
): Promise<PredefinedImportResponse> {
  return upload<PredefinedImportResponse>("import", file, mode)
}

export function evaluatePredefinedMatches(
  file: File
): Promise<PredefinedMatchEvaluation> {
  return upload<PredefinedMatchEvaluation>("match-preview", file)
}

function upload<T>(
  action: "import-preview" | "import" | "match-preview",
  file: File,
  mode?: PredefinedImportMode
): Promise<T> {
  const form = new FormData()
  if (mode) form.append("mode", mode)
  form.append("file", file)
  return requestJson<T>(`/admin/predefined-documents/${action}`, {
    method: "POST",
    body: form,
  })
}
