import type { FolderStatusResponse, JobSummary } from "@/features/upload/api/ocrApi"

export type SessionInputFileType =
  | "arrangement_plan"
  | "retention_schedule"
  | "raw_zip"

export interface CreateSessionResponse {
  session_id: string
  status: string
  created_at: string
}

export interface SessionSummary {
  session_id: string
  status: string
  created_at: string
  updated_at?: string
  active_plan_version_id?: string | null
  active_cluster_version_id?: string | null
  file_count?: number
}

export interface SessionListResponse {
  sessions: SessionSummary[]
}

export interface SessionDetailResponse extends SessionSummary {
  files: SessionInputUploadResponse[]
}

export interface SessionInputUploadResponse {
  id: number
  session_id: string
  file_type: SessionInputFileType
  file_name: string
  local_cached_path: string | null
  data_path?: string | null
  checksum: string | null
  folder_path?: string
}

export interface ActivePlanResponse {
  id?: string
  version_number?: number
  summary: string
  fonds_name: string
  groups?: unknown[]
  flat_groups?: unknown[]
  classification_groups?: unknown[]
  criterias?: unknown[]
}

export interface DigitizationDocument {
  id: number
  document_id: string
  data_path: string
  ocr_status: string
  review_status: string
  metadata_ready: boolean
  metadata_final: boolean
  raw_metadata?: Record<string, unknown>
  metadata?: Record<string, unknown>
  normalized_metadata?: Record<string, unknown>
}

export interface DigitizationBatch {
  id: number
  folder_path: string
  recursive: boolean
  total_files: number | null
  total_jobs: number | null
  missing_files: string[]
  status_counts: Record<string, number>
  status: string
}

export interface DigitizationStatusResponse {
  session_id: string
  batches: DigitizationBatch[]
  documents: DigitizationDocument[]
  summary: {
    total_documents: number
    status_counts: Record<string, number>
  }
}

export interface SessionArtifact {
  id: number
  artifact_type: string
  file_name: string
  status: string
}

export interface ArtifactListResponse {
  session_id: string
  artifacts: SessionArtifact[]
}

export interface SessionDocumentResponse {
  id: number
  session_id: string
  document_id: string
  data_path: string
  file_name: string
  ocr_status: string
  review_status: string
  metadata_ready: boolean
  metadata_final: boolean
  metadata?: Record<string, unknown>
  normalized_metadata?: Record<string, unknown>
  raw_metadata?: Record<string, unknown>
}

export interface ClusterPlacement {
  id: number
  session_document_id: number
  document_id: string
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
  dossier_id: string
  cluster_id: string
  generated_title: string
  title: string
  title_override: string | null
  dossier_number: string | null
  folder_name: string | null
  retention_period: string | null
  retention_recommendation: Record<string, unknown>
  classification: DossierClassification | null
}

export interface SessionClusterSummary {
  id: number
  cluster_id: string
  dossier_id: string
  title: string
  dossier: SessionDossierSummary | null
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
  summary: Record<string, unknown>
  affected_clusters: string[]
  batch_snapshot_count: number
  created_at: string
  clusters: SessionClusterSummary[]
}

const API_BASE = (import.meta.env.VITE_ARCHIVAL_API_BASE_URL ?? "/api").replace(/\/+$/, "")

export async function listSessions(limit = 100): Promise<SessionListResponse> {
  return requestJson<SessionListResponse>(`/sessions?limit=${encodeURIComponent(String(limit))}`)
}

export async function getSession(sessionId: string): Promise<SessionDetailResponse> {
  return requestJson<SessionDetailResponse>(`/sessions/${encodeURIComponent(sessionId)}`)
}

export async function createSession(createdBy = "ui"): Promise<CreateSessionResponse> {
  return requestJson<CreateSessionResponse>("/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ created_by: createdBy }),
  })
}

export async function uploadSessionInput(
  sessionId: string,
  fileType: SessionInputFileType,
  file: File,
  createdBy = "ui"
): Promise<SessionInputUploadResponse> {
  const form = new FormData()
  form.append("file_type", fileType)
  form.append("created_by", createdBy)
  form.append("file", file)
  return requestJson<SessionInputUploadResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/inputs/upload`,
    {
      method: "POST",
      body: form,
    }
  )
}

export async function registerSessionInput(
  sessionId: string,
  fileType: SessionInputFileType,
  fileName: string,
  createdBy = "ui"
): Promise<SessionInputUploadResponse> {
  return requestJson<SessionInputUploadResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/inputs/register`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_type: fileType,
        file_name: fileName,
        created_by: createdBy,
      }),
    }
  )
}

export async function enqueuePlanAnalysis(
  sessionId: string,
  payload: { plan_file: string; retention_file?: string }
): Promise<void> {
  await requestJson<unknown>(`/sessions/${encodeURIComponent(sessionId)}/plan/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function getActivePlan(sessionId: string): Promise<ActivePlanResponse | null> {
  return requestJsonOrNull<ActivePlanResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/plan`
  )
}

export async function patchActivePlan(
  sessionId: string,
  payload: Record<string, unknown>
): Promise<ActivePlanResponse> {
  return requestJson<ActivePlanResponse>(`/sessions/${encodeURIComponent(sessionId)}/plan`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function waitForActivePlan(
  sessionId: string,
  timeoutMs = 120_000,
  intervalMs = 2_000,
  options: { previousPlanId?: string; afterVersionNumber?: number } = {}
): Promise<ActivePlanResponse> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const plan = await getActivePlan(sessionId)
    if (plan && isExpectedPlan(plan, options)) return plan
    await delay(intervalMs)
  }
  throw new Error("Quá thời gian chờ phân tích phương án. Hãy kiểm tra backend worker.")
}

function isExpectedPlan(
  plan: ActivePlanResponse,
  options: { previousPlanId?: string; afterVersionNumber?: number }
): boolean {
  if (options.previousPlanId && plan.id === options.previousPlanId) return false
  if (
    options.afterVersionNumber !== undefined &&
    typeof plan.version_number === "number" &&
    plan.version_number <= options.afterVersionNumber
  ) {
    return false
  }
  return true
}

export async function startDigitization(
  sessionId: string,
  payload: {
    folder_path: string
    recursive?: boolean
    force?: boolean
    max_files?: number
    confirmed_plan_version_id: string
  }
): Promise<void> {
  await requestJson<unknown>(`/sessions/${encodeURIComponent(sessionId)}/digitization/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recursive: true,
      force: false,
      ...payload,
    }),
  })
}

export async function getDigitizationStatus(
  sessionId: string
): Promise<DigitizationStatusResponse | null> {
  return requestJsonOrNull<DigitizationStatusResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/digitization`
  )
}

export async function verifyDocumentMetadata(
  sessionId: string,
  documentId: number,
  metadata?: Record<string, unknown>
): Promise<SessionDocumentResponse> {
  return requestJson<SessionDocumentResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/documents/${encodeURIComponent(String(documentId))}/verify`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metadata, created_by: "ui" }),
    }
  )
}

export async function getActiveClusters(
  sessionId: string
): Promise<ClusterVersionResponse | null> {
  return requestJsonOrNull<ClusterVersionResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/clusters`
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

export function digitizationToFolderStatus(
  response: DigitizationStatusResponse | null,
  fallbackFolderPath: string
): FolderStatusResponse {
  const batch = response?.batches[0]
  const documents = response?.documents ?? []
  const jobs: JobSummary[] = documents.map((document) => ({
    id: document.id,
    document_id: document.document_id,
    data_path: document.data_path,
    status: document.ocr_status,
    review_status: document.review_status,
    metadata_ready: document.metadata_ready,
    metadata_final: document.metadata_final,
    light_metadata:
      document.normalized_metadata ??
      document.metadata ??
      document.raw_metadata ??
      {},
    normalized_metadata: document.normalized_metadata,
    raw_metadata: document.raw_metadata,
  }))
  return {
    folder_path: batch?.folder_path ?? fallbackFolderPath,
    recursive: batch?.recursive ?? true,
    total_files: batch?.total_files ?? documents.length,
    total_jobs: batch?.total_jobs ?? documents.length,
    missing_files: batch?.missing_files ?? [],
    status_counts: batch?.status_counts ?? response?.summary.status_counts ?? {},
    jobs,
  }
}

export function isDigitizationComplete(response: DigitizationStatusResponse | null): boolean {
  const batch = response?.batches[0]
  return Boolean(batch && ["done", "completed_with_errors", "failed"].includes(batch.status))
}

export async function enqueueFinalizeArtifacts(
  sessionId: string,
  payload: { created_by?: string } = {}
): Promise<void> {
  await requestJson<unknown>(`/sessions/${encodeURIComponent(sessionId)}/artifacts/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function listArtifacts(sessionId: string): Promise<ArtifactListResponse> {
  return requestJson<ArtifactListResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/artifacts`
  )
}

export async function waitForArtifacts(
  sessionId: string,
  timeoutMs = 120_000,
  intervalMs = 2_000
): Promise<ArtifactListResponse> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const result = await listArtifacts(sessionId)
    if (result.artifacts.some((artifact) => artifact.status === "ready")) {
      return result
    }
    await delay(intervalMs)
  }
  throw new Error("Quá thời gian chờ tạo artifact. Hãy kiểm tra backend worker.")
}

export function artifactDownloadUrl(sessionId: string, artifactId: number): string {
  return apiUrl(
    `/sessions/${encodeURIComponent(sessionId)}/artifacts/${artifactId}/download`
  )
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), init)
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response))
  }
  return response.json() as Promise<T>
}

async function requestJsonOrNull<T>(path: string, init?: RequestInit): Promise<T | null> {
  const response = await fetch(apiUrl(path), init)
  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response))
  }
  return response.json() as Promise<T>
}

async function responseErrorMessage(response: Response): Promise<string> {
  const text = await response.text()
  if (!text) return `API error ${response.status}`
  try {
    const payload = JSON.parse(text) as { detail?: unknown }
    if (typeof payload.detail === "string") return payload.detail
    if (payload.detail) return JSON.stringify(payload.detail)
  } catch {
    return text
  }
  return text
}

function apiUrl(path: string): string {
  return API_BASE ? `${API_BASE}${path}` : path
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}
