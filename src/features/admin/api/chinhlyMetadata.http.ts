import {
  ApiRequestError,
  requestJson,
  responseTextErrorMessage,
  withAuth,
} from "@/features/upload/api/sessionApi.http"

const METADATA_API_BASE = String(
  import.meta.env.VITE_CHINHLY_METADATA_API_BASE_URL ?? ""
)
  .trim()
  .replace(/\/+$/, "")

const inFlight = new Map<string, Promise<unknown>>()

export function requestMetadataJson<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  // Existing deployments can keep the backend adapter by leaving the base empty.
  if (!METADATA_API_BASE) return requestJson<T>(`/admin${path}`, init)

  const url = `${METADATA_API_BASE}${path}`
  const authedInit = withAuth(init)
  const headers = new Headers(authedInit.headers)
  headers.set("Accept", "application/json")
  const options = { ...authedInit, headers }
  const method = String(options.method ?? "GET").toUpperCase()
  if (method !== "GET" || options.body || options.signal) {
    return fetchMetadataJson<T>(url, options)
  }
  const key = `${url}\n${JSON.stringify([...headers.entries()].sort())}`
  const existing = inFlight.get(key)
  if (existing) return existing as Promise<T>
  const request = fetchMetadataJson<T>(url, options).finally(() => {
    inFlight.delete(key)
  })
  inFlight.set(key, request)
  return request
}

async function fetchMetadataJson<T>(
  url: string,
  init: RequestInit
): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) {
    const text = await response.text()
    let detail: unknown = text
    let code: string | null = null
    let normalizedText = text
    try {
      const payload = JSON.parse(text)
      detail = payload?.error ?? payload?.detail ?? payload
      if (detail && typeof detail === "object" && "code" in detail) {
        code = typeof detail.code === "string" ? detail.code : null
      }
      normalizedText = JSON.stringify({ detail })
    } catch {
      // Preserve non-JSON gateway errors through the existing UI formatter.
    }
    throw new ApiRequestError(
      responseTextErrorMessage(response.status, normalizedText),
      response.status,
      { code, detail }
    )
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
