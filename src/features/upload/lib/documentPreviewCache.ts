import {
  getDocumentPreviewUrl,
  type DocumentPreviewUrlResponse,
} from "@/features/upload/api/sessionApi"
import { getStoredAccessToken } from "@/features/auth/lib/authStorage"

const PREVIEW_CACHE_TTL_MS = 8 * 60 * 1000

interface PreviewCacheEntry {
  response: DocumentPreviewUrlResponse
  expiresAt: number
}

const previewCache = new Map<string, PreviewCacheEntry>()
const previewRequests = new Map<string, Promise<DocumentPreviewUrlResponse>>()

function previewKey(
  sessionId: string,
  documentId: number,
  presentation?: string
) {
  const authScope = getStoredAccessToken() ?? "anonymous"
  return `${authScope}:${sessionId}:${documentId}:${presentation ?? "default"}`
}

export function getCachedDocumentPreview(
  sessionId: string,
  documentId: number,
  presentation?: string
) {
  const key = previewKey(sessionId, documentId, presentation)
  const entry = previewCache.get(key)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    previewCache.delete(key)
    return null
  }
  return entry.response
}

export function setCachedDocumentPreview(
  sessionId: string,
  documentId: number,
  presentation: string | undefined,
  response: DocumentPreviewUrlResponse
) {
  previewCache.set(previewKey(sessionId, documentId, presentation), {
    response,
    expiresAt: Date.now() + PREVIEW_CACHE_TTL_MS,
  })
}

export function invalidateDocumentPreview(
  sessionId: string,
  documentId: number,
  presentation?: string
) {
  previewCache.delete(previewKey(sessionId, documentId, presentation))
}

export async function loadDocumentPreview(
  sessionId: string,
  documentId: number,
  presentation?: string
) {
  const cached = getCachedDocumentPreview(sessionId, documentId, presentation)
  if (cached) return cached

  const key = previewKey(sessionId, documentId, presentation)
  const inFlight = previewRequests.get(key)
  if (inFlight) return inFlight

  const request = getDocumentPreviewUrl(sessionId, documentId, {
    presentation,
  })
    .then((response) => {
      setCachedDocumentPreview(sessionId, documentId, presentation, response)
      return response
    })
    .finally(() => previewRequests.delete(key))

  previewRequests.set(key, request)
  return request
}

export function prefetchDocumentPreview(
  sessionId: string,
  documentId: number | null | undefined,
  presentation?: string
) {
  if (!sessionId || documentId == null) return
  void loadDocumentPreview(sessionId, documentId, presentation).catch(
    () => undefined
  )
}
