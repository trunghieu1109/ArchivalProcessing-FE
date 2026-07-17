import { delay, requestJson, requestJsonOrNull } from "./sessionApi.http"
import type {
  ActivePlanResponse,
  CreateSessionResponse,
  DeleteSessionResponse,
  DossierBuildStrategy,
  DocumentNumberingMode,
  SessionDetailResponse,
  SessionListResponse,
  SessionProgressEvent,
  SessionSummary,
} from "./sessionApi.types"

export async function listSessions(
  options:
    | number
    | {
        limit?: number
        offset?: number
        sessionId?: string
        fondsName?: string
        archiveName?: string
        fondsCreatorCode?: string
      } = 100
): Promise<SessionListResponse> {
  const limit = typeof options === "number" ? options : (options.limit ?? 100)
  const offset = typeof options === "number" ? 0 : (options.offset ?? 0)
  const query = new URLSearchParams()
  query.set("limit", String(limit))
  query.set("offset", String(offset))
  if (typeof options !== "number") {
    setOptionalQuery(query, "session_id", options.sessionId)
    setOptionalQuery(query, "fonds_name", options.fondsName)
    setOptionalQuery(query, "archive_name", options.archiveName)
    setOptionalQuery(query, "fonds_creator_code", options.fondsCreatorCode)
  }
  return requestJson<SessionListResponse>(`/sessions?${query.toString()}`)
}

function setOptionalQuery(
  query: URLSearchParams,
  key: string,
  value: string | null | undefined
) {
  const text = String(value ?? "").trim()
  if (text) query.set(key, text)
}

export async function getSession(
  sessionId: string
): Promise<SessionDetailResponse> {
  return requestJson<SessionDetailResponse>(
    `/sessions/${encodeURIComponent(sessionId)}`
  )
}

export async function createSession(
  createdBy = "ui",
  metadata: {
    archive_name?: string | null
    archive_code?: string | null
    fonds_name?: string | null
    fonds_creator_code?: string | null
  } = {}
): Promise<CreateSessionResponse> {
  return requestJson<CreateSessionResponse>("/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ created_by: createdBy, ...metadata }),
  })
}

export async function patchSessionMetadata(
  sessionId: string,
  payload: {
    archive_name?: string | null
    archive_code?: string | null
    fonds_name?: string | null
    fonds_creator_code?: string | null
  }
): Promise<SessionSummary> {
  return requestJson<SessionSummary>(
    `/sessions/${encodeURIComponent(sessionId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  )
}

export async function assignSessionCoordinator(
  sessionId: string,
  coordinatorUserId: string | null
): Promise<SessionSummary> {
  return requestJson<SessionSummary>(
    `/sessions/${encodeURIComponent(sessionId)}/coordinator`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coordinator_user_id: coordinatorUserId }),
    }
  )
}

export async function deleteSession(
  sessionId: string
): Promise<DeleteSessionResponse> {
  return requestJson<DeleteSessionResponse>(
    `/sessions/${encodeURIComponent(sessionId)}`,
    { method: "DELETE" }
  )
}

export async function enqueuePlanAnalysis(
  sessionId: string,
  payload: {
    plan_file?: string
    retention_file?: string
    retention_files?: string[]
    dossier_build_strategy?: DossierBuildStrategy
    document_numbering_mode?: DocumentNumberingMode
  }
): Promise<void> {
  await requestJson<unknown>(
    `/sessions/${encodeURIComponent(sessionId)}/plan/analyze`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  )
}

export async function listSessionEvents(
  sessionId: string,
  options: { afterId?: number; limit?: number } = {}
): Promise<{ session_id: string; events: SessionProgressEvent[] }> {
  const query = new URLSearchParams()
  if (options.afterId !== undefined)
    query.set("after_id", String(options.afterId))
  if (options.limit !== undefined) query.set("limit", String(options.limit))
  const suffix = query.toString()
  return requestJson<{ session_id: string; events: SessionProgressEvent[] }>(
    `/sessions/${encodeURIComponent(sessionId)}/events${suffix ? `?${suffix}` : ""}`
  )
}

export async function getActivePlan(
  sessionId: string
): Promise<ActivePlanResponse | null> {
  return requestJsonOrNull<ActivePlanResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/plan/active`
  )
}

export async function getWorkingPlan(
  sessionId: string
): Promise<ActivePlanResponse | null> {
  return requestJsonOrNull<ActivePlanResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/plan`
  )
}

export async function patchDraftPlan(
  sessionId: string,
  payload: Record<string, unknown>
): Promise<ActivePlanResponse> {
  return requestJson<ActivePlanResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/plan`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  )
}

export async function activatePlanVersion(
  sessionId: string,
  planVersionId: string,
  payload: { created_by?: string } = {}
): Promise<ActivePlanResponse> {
  return requestJson<ActivePlanResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/plan/versions/${encodeURIComponent(planVersionId)}/activate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  )
}

export async function waitForWorkingPlan(
  sessionId: string,
  timeoutMs = 120_000,
  intervalMs = 2_000,
  options: { previousPlanId?: string; afterVersionNumber?: number } = {}
): Promise<ActivePlanResponse> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const plan = await getWorkingPlan(sessionId)
    if (plan && isExpectedPlan(plan, options)) return plan
    await delay(intervalMs)
  }
  throw new Error(
    "Quá thời gian chờ phân tích phương án. Hãy kiểm tra backend worker."
  )
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
