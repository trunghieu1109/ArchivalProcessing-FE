import { authHeaderValue } from "@/features/auth/lib/authStorage"
import type { UploadProgressSnapshot } from "./sessionApi.types"

const API_BASE = (import.meta.env.VITE_ARCHIVAL_API_BASE_URL ?? "/api").replace(
  /\/+$/,
  ""
)
const inFlightGetJsonRequests = new Map<string, Promise<unknown>>()

export class ApiRequestError extends Error {
  declare readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiRequestError"
    this.status = status
  }
}

export async function requestJson<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  return requestJsonInternal<T>(path, init, false) as Promise<T>
}

export async function postJson<T>(
  path: string,
  payload: Record<string, unknown>
): Promise<T> {
  return requestJson<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

export async function requestJsonOrNull<T>(
  path: string,
  init?: RequestInit
): Promise<T | null> {
  return requestJsonInternal<T>(path, init, true)
}

async function requestJsonInternal<T>(
  path: string,
  init: RequestInit | undefined,
  allowNotFound: boolean
): Promise<T | null> {
  const authedInit = withAuth(init)
  if (!canDedupeJsonRequest(authedInit)) {
    return fetchJson<T>(path, authedInit, allowNotFound)
  }

  const key = jsonDedupeKey(path, authedInit, allowNotFound)
  const existing = inFlightGetJsonRequests.get(key)
  if (existing) return existing as Promise<T | null>

  const request = fetchJson<T>(path, authedInit, allowNotFound).finally(() => {
    inFlightGetJsonRequests.delete(key)
  })
  inFlightGetJsonRequests.set(key, request)
  return request
}

async function fetchJson<T>(
  path: string,
  init: RequestInit,
  allowNotFound: boolean
): Promise<T | null> {
  const response = await fetch(apiUrl(path), init)
  if (allowNotFound && response.status === 404) return null
  if (!response.ok) {
    throw new ApiRequestError(await responseErrorMessage(response), response.status)
  }
  return response.json() as Promise<T>
}

function canDedupeJsonRequest(init: RequestInit): boolean {
  const method = String(init.method ?? "GET").toUpperCase()
  return method === "GET" && !init.body && !init.signal
}

function jsonDedupeKey(
  path: string,
  init: RequestInit,
  allowNotFound: boolean
): string {
  return [
    allowNotFound ? "json-or-null" : "json",
    apiUrl(path),
    headersDedupeKey(init.headers),
  ].join("\n")
}

function headersDedupeKey(headersInit: HeadersInit | undefined): string {
  const headers = new Headers(headersInit)
  return [...headers.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${value}`)
    .join("\n")
}

export async function responseErrorMessage(
  response: Response
): Promise<string> {
  const text = await response.text()
  return responseTextErrorMessage(response.status, text)
}

export function responseTextErrorMessage(status: number, text: string): string {
  if (!text) return `API error ${status}`
  try {
    const payload = JSON.parse(text) as { detail?: unknown }
    if (typeof payload.detail === "string") return payload.detail
    if (payload.detail) return JSON.stringify(payload.detail)
  } catch {
    return text
  }
  return text
}

export function downloadFileName(contentDisposition: string | null): string {
  if (!contentDisposition) return ""
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim())
    } catch {
      return utf8Match[1].trim()
    }
  }
  const quotedMatch = contentDisposition.match(/filename="([^"]+)"/i)
  if (quotedMatch?.[1]) return quotedMatch[1]
  const plainMatch = contentDisposition.match(/filename=([^;]+)/i)
  return plainMatch?.[1]?.trim() ?? ""
}

export function presignedUploadErrorMessage(
  status: number,
  text: string
): string {
  if (status === 413) {
    return "Chỉnh Lý gateway từ chối file ZIP vì quá lớn (HTTP 413 Payload Too Large). Cần tăng giới hạn upload gateway hoặc dùng ZIP nhỏ hơn."
  }
  if (!text) return `Upload ZIP lên Chỉnh Lý lỗi ${status}`
  return responseTextErrorMessage(status, text)
}

export function uploadProgressSnapshot(
  phase: UploadProgressSnapshot["phase"],
  loadedBytes: number,
  totalBytes: number
): UploadProgressSnapshot {
  const safeLoaded = Math.max(0, loadedBytes)
  const safeTotal = Math.max(0, totalBytes)
  return {
    phase,
    loadedBytes: safeLoaded,
    totalBytes: safeTotal,
    loadedMb: bytesToMb(safeLoaded),
    totalMb: bytesToMb(safeTotal),
    percent:
      safeTotal > 0
        ? Math.min(100, Math.round((safeLoaded / safeTotal) * 1000) / 10)
        : null,
  }
}

function bytesToMb(value: number): number {
  return Math.round((value / (1024 * 1024)) * 100) / 100
}

export function defaultContentType(fileName: string): string {
  return fileName.toLowerCase().endsWith(".zip")
    ? "application/zip"
    : "application/octet-stream"
}

export function apiUrl(path: string): string {
  return API_BASE ? `${API_BASE}${path}` : path
}

export function withAuth(init?: RequestInit): RequestInit {
  const authorization = authHeaderValue()
  if (!authorization) return init ?? {}
  const headers = new Headers(init?.headers)
  if (!headers.has("Authorization")) {
    headers.set("Authorization", authorization)
  }
  return { ...init, headers }
}

export function setXhrAuthHeader(xhr: XMLHttpRequest): void {
  const authorization = authHeaderValue()
  if (authorization) {
    xhr.setRequestHeader("Authorization", authorization)
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}
