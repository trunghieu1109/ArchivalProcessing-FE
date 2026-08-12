import { authHeaderValue } from "@/features/auth/lib/authStorage"
import type { UploadProgressSnapshot } from "./sessionApi.types"

const API_BASE = (import.meta.env.VITE_ARCHIVAL_API_BASE_URL ?? "/api").replace(
  /\/+$/,
  ""
)
const inFlightGetJsonRequests = new Map<string, Promise<unknown>>()

export class ApiRequestError extends Error {
  readonly status: number
  readonly code: string | null
  readonly detail: unknown
  readonly documentId: number | null

  constructor(
    message: string,
    status: number,
    options: { code?: string | null; detail?: unknown } = {}
  ) {
    super(message)
    this.name = "ApiRequestError"
    this.status = status
    this.code = options.code ?? null
    this.detail = options.detail
    const rawDocumentId =
      options.detail && typeof options.detail === "object"
        ? (options.detail as Record<string, unknown>).document_id
        : null
    const documentId = Number(rawDocumentId)
    this.documentId =
      rawDocumentId !== null &&
      rawDocumentId !== undefined &&
      Number.isInteger(documentId)
        ? documentId
        : null
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
  payload: Record<string, unknown>,
  signal?: AbortSignal
): Promise<T> {
  return requestJson<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
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
    const text = await response.text()
    const error = responseTextError(response.status, text)
    throw new ApiRequestError(error.message, response.status, {
      code: error.code,
      detail: error.detail,
    })
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
  return responseTextError(status, text).message
}

function responseTextError(
  status: number,
  text: string
): { message: string; code: string | null; detail: unknown } {
  if (!text) {
    return { message: `API error ${status}`, code: null, detail: null }
  }
  try {
    const payload = JSON.parse(text) as Record<string, unknown>
    const detailMessage = naturalDetailMessage(payload.detail)
    const detailRecord =
      payload.detail &&
      typeof payload.detail === "object" &&
      !Array.isArray(payload.detail)
        ? (payload.detail as Record<string, unknown>)
        : null
    const detailCode =
      typeof detailRecord?.code === "string" && detailRecord.code.trim()
        ? detailRecord.code.trim()
        : null
    if (detailMessage) {
      return {
        message: detailMessage,
        code: detailCode,
        detail: payload.detail,
      }
    }
    if (payload.detail) {
      return {
        message: `Yêu cầu không thể xử lý (lỗi ${status}). Vui lòng kiểm tra dữ liệu và thử lại.`,
        code: detailCode,
        detail: payload.detail,
      }
    }
    const code =
      typeof payload.code === "string" && payload.code.trim()
        ? payload.code.trim()
        : null
    const message =
      typeof payload.message === "string" && payload.message.trim()
        ? payload.message.trim()
        : ""
    if (code || message) {
      return {
        message: message || `API error ${status}`,
        code,
        detail: payload,
      }
    }
  } catch {
    return { message: text, code: null, detail: text }
  }
  return { message: text, code: null, detail: text }
}

function naturalDetailMessage(detail: unknown): string {
  if (typeof detail === "string") return detail.trim()
  if (Array.isArray(detail)) {
    return detail
      .map((item) => naturalDetailMessage(item))
      .filter(Boolean)
      .join("\n")
  }
  if (!detail || typeof detail !== "object") return ""

  const record = detail as Record<string, unknown>
  if (typeof record.message === "string" && record.message.trim()) {
    return record.message.trim()
  }
  if (typeof record.msg === "string" && record.msg.trim()) {
    return record.msg.trim()
  }
  return ""
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

export function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Request was aborted.", "AbortError"))
      return
    }
    const timeoutId = window.setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort)
      resolve()
    }, ms)
    const handleAbort = () => {
      window.clearTimeout(timeoutId)
      signal?.removeEventListener("abort", handleAbort)
      reject(new DOMException("Request was aborted.", "AbortError"))
    }
    signal?.addEventListener("abort", handleAbort, { once: true })
  })
}
