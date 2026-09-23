import { postJson, requestJson } from "./sessionApi.http"
import type { CreateSessionResponse } from "./sessionApi.sessionTypes"

export interface MergedDocument {
  session_document_id: number
  document_id: string
  title: string
  position_index: number
}

export interface MergedDossier {
  id: number
  source_session_id?: string
  source_dossier_id: number
  dossier_id: string
  dossier_number: string | null
  title: string
  start_date: string | null
  end_date: string | null
  classification_path: string[]
  documents: MergedDocument[]
}

export interface MergedSource {
  source_session_id: string
  fonds_name: string
  sync_status: string
  dossiers: MergedDossier[]
}

export interface MergedClassificationNode {
  group_id: string
  name: string
  type?: string | null
  children: MergedClassificationNode[]
  dossiers: MergedDossier[]
}

export interface MergedTree {
  session_id: string
  session_type: "merged"
  fonds_name: string
  classification_tree: MergedClassificationNode[]
  tree_change_count?: number
  sources: MergedSource[]
}

export function createMergedFonds(payload: {
  source_session_ids: string[]
  fonds_name: string
  archive_name?: string
  archive_code?: string
  fonds_creator_code?: string
}) {
  return postJson<CreateSessionResponse>("/sessions/merges", payload)
}

export function getMergedTree(sessionId: string) {
  return requestJson<MergedTree>(`/sessions/${encodeURIComponent(sessionId)}/merge/tree`)
}

export function syncMergedFonds(sessionId: string) {
  return postJson<{ session_id: string; synced_source_session_ids: string[] }>(
    `/sessions/${encodeURIComponent(sessionId)}/merge/sync`,
    {}
  )
}

export function refreshMergedFonds(sessionId: string) {
  return postJson<{
    session_id: string
    cluster_version_id: string
    inherited_document_count: number
    pending_document_count: number
    dossier_count: number
    box_numbers_reset: boolean
  }>(`/sessions/${encodeURIComponent(sessionId)}/merge/refresh`, {})
}
