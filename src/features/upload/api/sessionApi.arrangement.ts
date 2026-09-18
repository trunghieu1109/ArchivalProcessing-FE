import { requestJson } from "./sessionApi.http"

export type SupplementalIntakeMode =
  | "existing_dossier"
  | "new_dossier_existing_leaf"
  | "new_dossier_new_path"

export type SupplementalIntakeTargetState =
  | "existing"
  | "pending"
  | "materialized"

export type ArrangementDossierKind = "cluster_dossier" | "draft_dossier"

export interface SupplementalClassificationPathNode {
  kind: "existing" | "new"
  group_id?: string
  client_group_id?: string
  type?: string
  name?: string
  definition?: string
  criteria?: Array<Record<string, unknown>>
}

export interface SupplementalIntakeDocument {
  session_document_id: number
  document_id: string
  file_name: string
  dossier_id: string
  arrangement_status: "draft" | "active" | string
  ocr_status: string
  review_status: string
  is_reviewed: boolean
  metadata_ready?: boolean
  metadata_final?: boolean
  remote_metadata_status?: string | null
  data_path?: string | null
  original_path?: string | null
  light_metadata?: Record<string, unknown>
  lifecycle_status?: string
  preview_available?: boolean
  draft_sequence: number
  error: Record<string, unknown> | string | null
}

export interface SupplementalIntakeResponse {
  intake_id: string
  session_id: string
  client_request_id: string
  intake_mode: SupplementalIntakeMode
  status: string
  base_cluster_version_id: string | null
  base_plan_version_id: string | null
  target: {
    state: SupplementalIntakeTargetState
    cluster_version_id?: string | null
    plan_version_id?: string | null
    cluster_id: string | null
    dossier_id: string | null
    leaf_group_id: string | null
    group_ids: string[]
    group_path: string[]
    resolved_path?: Array<Record<string, unknown>>
    reserved_leaf_id?: string | null
  }
  dossier?: Record<string, unknown> & {
    dossier_id?: string | null
    dossier_draft_id?: number | null
    status?: string
  }
  folder_upload_id: string | null
  counts: {
    file_count: number
    draft_count: number
    verified_count: number
    failed_count: number
  }
  documents: SupplementalIntakeDocument[]
  created_at: string
  updated_at: string
  error: Record<string, unknown> | null
}

export interface SupplementalIntakeListResponse {
  session_id: string
  items: SupplementalIntakeResponse[]
  next_after_id: string | null
  has_more: boolean
}

export interface SupplementalClassificationPathValidation {
  session_id: string
  base_plan_version_id: string
  valid: boolean
  resolved_path: Array<Record<string, unknown>>
  canonical_path_key: string
  reservation: {
    tree_change_id: string
    supplemental_intake_id: string
    status: string
  } | null
}

export type PrepareSupplementalIntakePayload = {
  client_request_id: string
  intake_mode: SupplementalIntakeMode
  base_cluster_version_id?: string
  note?: string
  created_by?: string
  target_dossier_id?: string
  target_classification?: {
    plan_version_id: string
    group_ids: string[]
  }
  base_plan_version_id?: string
  classification_path?: SupplementalClassificationPathNode[]
  dossier?: Record<string, unknown> & { title: string }
}

export interface ArrangementSortResponse {
  session_id: string
  status: "completed" | string
  scope: {
    type: "dossier" | "classification_leaf" | string
    id: string
    dossier_kind?: ArrangementDossierKind
  }
  previous_cluster_version_id: string | null
  cluster_version_id: string | null
  plan_version_id: string | null
  change_api_url: string | null
  sorted_document_count?: number
  excluded_draft_document_count?: number
  sorted_dossier_count?: number
  excluded_draft_dossier_count?: number
}

export interface ClusteringPendingDocumentsResponse {
  session_id: string
  active_cluster_version_id: string | null
  has_pending_documents: boolean
  can_update_dossiers: boolean
  blocked_reasons: string[]
  count: number
  documents: SupplementalIntakeDocument[]
}

const sessionPath = (sessionId: string) =>
  `/sessions/${encodeURIComponent(sessionId)}`

export function prepareSupplementalIntake(
  sessionId: string,
  payload: PrepareSupplementalIntakePayload
): Promise<SupplementalIntakeResponse> {
  return requestJson(`${sessionPath(sessionId)}/supplemental-intakes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export function validateSupplementalClassificationPath(
  sessionId: string,
  payload: {
    base_plan_version_id: string
    classification_path: SupplementalClassificationPathNode[]
  }
): Promise<SupplementalClassificationPathValidation> {
  return requestJson(
    `${sessionPath(sessionId)}/classification-paths/validate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  )
}

export function getSupplementalIntake(
  sessionId: string,
  intakeId: string
): Promise<SupplementalIntakeResponse> {
  return requestJson(
    `${sessionPath(sessionId)}/supplemental-intakes/${encodeURIComponent(intakeId)}`,
    { cache: "no-store" }
  )
}

export function listSupplementalIntakes(
  sessionId: string,
  options: { status?: string; includeDocuments?: boolean } = {}
): Promise<SupplementalIntakeListResponse> {
  const query = new URLSearchParams()
  if (options.status) query.set("status", options.status)
  if (options.includeDocuments !== undefined) {
    query.set("include_documents", String(options.includeDocuments))
  }
  return requestJson(
    `${sessionPath(sessionId)}/supplemental-intakes${query.size ? `?${query}` : ""}`,
    { cache: "no-store" }
  )
}

export function sortDossierDocuments(
  sessionId: string,
  dossierId: string,
  dossierKind: ArrangementDossierKind,
  baseClusterVersionId?: string | null
): Promise<ArrangementSortResponse> {
  return requestJson(
    `${sessionPath(sessionId)}/dossiers/${encodeURIComponent(dossierId)}/documents/sort`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_request_id: crypto.randomUUID(),
        dossier_kind: dossierKind,
        ...(baseClusterVersionId
          ? { base_cluster_version_id: baseClusterVersionId }
          : {}),
        strategy: "chronological",
        created_by: "ui",
      }),
    }
  )
}

export function sortLeafDossiers(
  sessionId: string,
  leafGroupId: string,
  planVersionId: string,
  baseClusterVersionId: string
): Promise<ArrangementSortResponse> {
  return requestJson(
    `${sessionPath(sessionId)}/classification-groups/${encodeURIComponent(leafGroupId)}/dossiers/sort`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_request_id: crypto.randomUUID(),
        plan_version_id: planVersionId,
        base_cluster_version_id: baseClusterVersionId,
        strategy: "business_default",
        created_by: "ui",
      }),
    }
  )
}

export function getClusteringPendingDocuments(
  sessionId: string
): Promise<ClusteringPendingDocumentsResponse> {
  return requestJson(`${sessionPath(sessionId)}/documents/clustering-pending`, {
    cache: "no-store",
  })
}
