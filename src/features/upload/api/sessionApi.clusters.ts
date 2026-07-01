import { requestJson, requestJsonOrNull } from "./sessionApi.http"
import type {
  CancelPendingClusterFeedbackResponse,
  ClusterBuildStatusResponse,
  ClusterFeedbackListResponse,
  ClusterGroupInformationTableResponse,
  ClusterVersionListResponse,
  ClusterVersionResponse,
  DossierBuildStrategy,
  EnsureClusterBuildResponse,
  SelectedDocumentsMoveResponse,
  SelectedDocumentsPromoteResponse,
  SessionDossierRetentionCandidatesResponse,
  SessionDossierPatchPayload,
  SessionDossierSummary,
  TemporaryFolderPromoteResponse,
} from "./sessionApi.types"

export async function getActiveClusters(
  sessionId: string,
  options: { includeClusters?: boolean; summaryOnly?: boolean } = {}
): Promise<ClusterVersionResponse | null> {
  const searchParams = new URLSearchParams()
  if (options.includeClusters !== undefined) {
    searchParams.set("include_clusters", String(options.includeClusters))
  }
  if (options.summaryOnly !== undefined) {
    searchParams.set("summary_only", String(options.summaryOnly))
  }
  const query = searchParams.toString()
  return requestJsonOrNull<ClusterVersionResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/clusters${query ? `?${query}` : ""}`
  )
}

export async function listClusterVersions(
  sessionId: string
): Promise<ClusterVersionListResponse> {
  return requestJson<ClusterVersionListResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/clusters/versions`
  )
}

export async function getClusterVersion(
  sessionId: string,
  clusterVersionId: string,
  options: { includeClusters?: boolean; summaryOnly?: boolean } = {}
): Promise<ClusterVersionResponse> {
  const searchParams = new URLSearchParams()
  if (options.includeClusters !== undefined) {
    searchParams.set("include_clusters", String(options.includeClusters))
  }
  if (options.summaryOnly !== undefined) {
    searchParams.set("summary_only", String(options.summaryOnly))
  }
  const query = searchParams.toString()
  return requestJson<ClusterVersionResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/clusters/versions/${encodeURIComponent(clusterVersionId)}${query ? `?${query}` : ""}`
  )
}

export async function getClusterGroupInformationTable(
  sessionId: string,
  payload: {
    cluster_version_id?: string | null
    dossier_ids: string[]
    group_label?: string | null
  }
): Promise<ClusterGroupInformationTableResponse> {
  return requestJson<ClusterGroupInformationTableResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/clusters/group-info`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  )
}

export async function activateClusterVersion(
  sessionId: string,
  clusterVersionId: string
): Promise<ClusterVersionResponse> {
  return requestJson<ClusterVersionResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/clusters/versions/${encodeURIComponent(clusterVersionId)}/activate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ created_by: "ui" }),
    }
  )
}

export async function patchSessionDossier(
  sessionId: string,
  dossierId: string,
  payload: SessionDossierPatchPayload
): Promise<SessionDossierSummary & { feedback_event_id?: number }> {
  return requestJson<SessionDossierSummary & { feedback_event_id?: number }>(
    `/sessions/${encodeURIComponent(sessionId)}/dossiers/${encodeURIComponent(dossierId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        created_by: "ui",
        ...payload,
      }),
    }
  )
}

export async function listSessionDossierRetentionCandidates(
  sessionId: string,
  dossierId: string,
  limit = 10
): Promise<SessionDossierRetentionCandidatesResponse> {
  const searchParams = new URLSearchParams()
  searchParams.set("limit", String(limit))
  return requestJson<SessionDossierRetentionCandidatesResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/dossiers/${encodeURIComponent(dossierId)}/retention-candidates?${searchParams.toString()}`
  )
}

export async function getClusterBuildStatus(
  sessionId: string
): Promise<ClusterBuildStatusResponse> {
  return requestJson<ClusterBuildStatusResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/clustering/build/status`
  )
}

export async function enqueueClusterBuild(
  sessionId: string,
  payload: {
    source?: string
    batch_size?: number
    dossier_build_strategy?: DossierBuildStrategy
  } = {}
): Promise<Record<string, unknown>> {
  return requestJson<Record<string, unknown>>(
    `/sessions/${encodeURIComponent(sessionId)}/clustering/build`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "user_feedback",
        ...payload,
      }),
    }
  )
}

export async function ensureClusterBuild(
  sessionId: string,
  payload: {
    source?: string
    batch_size?: number
    dossier_build_strategy?: DossierBuildStrategy
  } = {}
): Promise<EnsureClusterBuildResponse> {
  return requestJson<EnsureClusterBuildResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/clustering/ensure-build`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "user_view_results",
        ...payload,
      }),
    }
  )
}

export async function moveDocumentBetweenClusters(
  sessionId: string,
  payload: {
    session_document_id: number
    source_cluster_id?: string | null
    target_cluster_id: string
    weight?: number
    details?: Record<string, unknown>
    created_by?: string
  }
): Promise<Record<string, unknown>> {
  return requestJson<Record<string, unknown>>(
    `/sessions/${encodeURIComponent(sessionId)}/clusters/manual-move`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weight: 1,
        created_by: "ui",
        ...payload,
      }),
    }
  )
}

export async function listClusterFeedback(
  sessionId: string
): Promise<ClusterFeedbackListResponse> {
  return requestJson<ClusterFeedbackListResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/clusters/feedback`
  )
}

export async function cancelPendingClusterFeedback(
  sessionId: string,
  payload: { created_by?: string } = {}
): Promise<CancelPendingClusterFeedbackResponse> {
  return requestJson<CancelPendingClusterFeedbackResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/clusters/feedback/cancel-pending`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        created_by: "ui",
        ...payload,
      }),
    }
  )
}

export async function promoteTemporaryFolderDocuments(
  sessionId: string,
  payload: {
    session_document_ids: number[]
    created_by?: string
  }
): Promise<TemporaryFolderPromoteResponse> {
  return requestJson<TemporaryFolderPromoteResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/clusters/temporary-folder/promote`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        created_by: "ui",
        ...payload,
      }),
    }
  )
}

export async function promoteSelectedDocumentsToDossier(
  sessionId: string,
  payload: {
    session_document_ids: number[]
    created_by?: string
  }
): Promise<SelectedDocumentsPromoteResponse> {
  return requestJson<SelectedDocumentsPromoteResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/clusters/selected-documents/promote`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        created_by: "ui",
        ...payload,
      }),
    }
  )
}

export async function moveSelectedDocumentsToCluster(
  sessionId: string,
  payload: {
    session_document_ids: number[]
    target_cluster_id: string
    created_by?: string
  }
): Promise<SelectedDocumentsMoveResponse> {
  return requestJson<SelectedDocumentsMoveResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/clusters/selected-documents/move`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        created_by: "ui",
        ...payload,
      }),
    }
  )
}
