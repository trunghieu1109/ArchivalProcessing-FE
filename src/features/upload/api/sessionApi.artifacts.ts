import {
  apiUrl,
  delay,
  downloadFileName,
  requestJson,
  responseErrorMessage,
  withAuth,
} from "./sessionApi.http"
import type {
  ArtifactListResponse,
  DocumentArchiveDownload,
  DocumentNumberingMode,
  EnqueueNumberingResponse,
  MetadataExportMode,
  MetadataSnapshotGroup,
  MetadataBoxNumberImportResponse,
  MetadataSnapshotResponse,
  NumberedDocumentPreviewUrlResponse,
  NumberingStatusResponse,
  NumberingStylesResponse,
  RemoteArtifactSignedUrlResponse,
} from "./sessionApi.types"

export async function enqueueFinalizeArtifacts(
  sessionId: string,
  payload: {
    created_by?: string
    metadata_export_mode?: MetadataExportMode
  } = {}
): Promise<Record<string, unknown>> {
  return requestJson<Record<string, unknown>>(
    `/sessions/${encodeURIComponent(sessionId)}/artifacts/finalize`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  )
}

export async function enqueueDocumentNumbering(
  sessionId: string,
  payload: {
    created_by?: string
    force?: boolean
    document_numbering_mode?: DocumentNumberingMode
    document_numbering_style_preset?: string
    style_preset?: string
    document_numbering_style_overrides?: { font_size?: number; color?: string; opacity?: number } | null
    style_overrides?: { font_size?: number; color?: string; opacity?: number } | null
  } = {}
): Promise<EnqueueNumberingResponse> {
  return requestJson<EnqueueNumberingResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/numbering/start`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  )
}

export async function getNumberingStyles(
  sessionId: string
): Promise<NumberingStylesResponse> {
  return requestJson<NumberingStylesResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/numbering/styles`
  )
}

export async function updateDocumentNumberingConfig(
  sessionId: string,
  payload: { document_numbering_mode: DocumentNumberingMode }
): Promise<{
  session_id: string
  document_numbering_mode: DocumentNumberingMode
}> {
  return requestJson<{
    session_id: string
    document_numbering_mode: DocumentNumberingMode
  }>(
    `/sessions/${encodeURIComponent(sessionId)}/numbering/config`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  )
}

export async function updateDocumentNumberingFromPage(
  sessionId: string,
  sessionDocumentId: number,
  payload: {
    anchor_page_number: number
    numbering_update_mode?: "auto" | "manual" | "cascade"
    new_number?: string | number
    new_label?: string
    numbering_entries?: Array<{ page_number: number; label: string }>
    created_by?: string
    force?: boolean
  }
): Promise<EnqueueNumberingResponse> {
  return requestJson<EnqueueNumberingResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/numbering/documents/${encodeURIComponent(String(sessionDocumentId))}/start`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        created_by: "ui",
        force: true,
        ...payload,
      }),
    }
  )
}

export async function getDocumentNumberingStatus(
  sessionId: string,
  options: {
    includeDocuments?: boolean
    summaryOnly?: boolean
    limit?: number
    offset?: number
  } = {}
): Promise<NumberingStatusResponse> {
  const searchParams = new URLSearchParams()
  if (options.includeDocuments !== undefined) {
    searchParams.set("include_documents", String(options.includeDocuments))
  }
  if (options.summaryOnly !== undefined) {
    searchParams.set("summary_only", String(options.summaryOnly))
  }
  if (options.limit !== undefined) {
    searchParams.set("limit", String(options.limit))
  }
  if (options.offset !== undefined) {
    searchParams.set("offset", String(options.offset))
  }
  const query = searchParams.toString()
  return requestJson<NumberingStatusResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/numbering/status${query ? `?${query}` : ""}`
  )
}

export async function getNumberedDocumentPreviewUrl(
  sessionId: string,
  sessionDocumentId: number
): Promise<NumberedDocumentPreviewUrlResponse> {
  return requestJson<NumberedDocumentPreviewUrlResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/numbering/documents/${encodeURIComponent(String(sessionDocumentId))}/preview-url`
  )
}

export async function exportMetadataSnapshot(
  sessionId: string,
  payload: {
    created_by?: string
    groups?: MetadataSnapshotGroup[]
    metadata_export_mode?: MetadataExportMode
  } = {}
): Promise<MetadataSnapshotResponse> {
  return requestJson<MetadataSnapshotResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/artifacts/metadata-snapshot`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  )
}

export async function importMetadataBoxNumbers(
  sessionId: string,
  file: File,
  payload: { created_by?: string; confirm_count_conflicts?: boolean } = {}
): Promise<MetadataBoxNumberImportResponse> {
  const form = new FormData()
  form.append("created_by", payload.created_by ?? "ui")
  form.append(
    "confirm_count_conflicts",
    payload.confirm_count_conflicts ? "true" : "false"
  )
  form.append("file", file)
  return requestJson<MetadataBoxNumberImportResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/artifacts/metadata-snapshot/import-box-numbers`,
    {
      method: "POST",
      body: form,
    }
  )
}

export async function clearMetadataBoxNumberPendingCounts(
  sessionId: string,
  payload: {
    created_by?: string
    dossier_id?: string | null
    session_dossier_id?: number | null
    fields?: Array<"page_count" | "sheet_count">
  } = {}
): Promise<Record<string, unknown>> {
  return requestJson<Record<string, unknown>>(
    `/sessions/${encodeURIComponent(sessionId)}/artifacts/metadata-snapshot/import-box-numbers/pending-counts/clear`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  )
}

export async function listArtifacts(
  sessionId: string,
  status?: string
): Promise<ArtifactListResponse> {
  const query = status ? `?status=${encodeURIComponent(status)}` : ""
  return requestJson<ArtifactListResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/artifacts${query}`
  )
}

export async function getArtifactRemoteSignedUrl(
  sessionId: string,
  artifactId: number
): Promise<RemoteArtifactSignedUrlResponse> {
  return requestJson<RemoteArtifactSignedUrlResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/artifacts/${encodeURIComponent(String(artifactId))}/remote-signed-url`
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
  throw new Error(
    "Quá thời gian chờ tạo artifact. Hãy kiểm tra backend worker."
  )
}

export function artifactDownloadUrl(
  sessionId: string,
  artifactId: number
): string {
  return apiUrl(
    `/sessions/${encodeURIComponent(sessionId)}/artifacts/${artifactId}/download`
  )
}

export async function downloadArtifact(
  sessionId: string,
  artifactId: number
): Promise<DocumentArchiveDownload> {
  const response = await fetch(
    artifactDownloadUrl(sessionId, artifactId),
    withAuth()
  )
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response))
  }
  return {
    blob: await response.blob(),
    fileName:
      downloadFileName(response.headers.get("content-disposition")) ||
      `${sessionId}-artifact-${artifactId}`,
  }
}

export function artifactPreviewUrl(
  sessionId: string,
  artifactId: number
): string {
  return apiUrl(
    `/sessions/${encodeURIComponent(sessionId)}/artifacts/${artifactId}/preview`
  )
}

export async function getArtifactPreviewHtml(
  sessionId: string,
  artifactId: number
): Promise<string> {
  const response = await fetch(
    artifactPreviewUrl(sessionId, artifactId),
    withAuth()
  )
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response))
  }
  return response.text()
}

export function artifactDownloadAllUrl(sessionId: string): string {
  return apiUrl(
    `/sessions/${encodeURIComponent(sessionId)}/artifacts/download-all`
  )
}

export async function downloadAllArtifacts(
  sessionId: string
): Promise<DocumentArchiveDownload> {
  const response = await fetch(artifactDownloadAllUrl(sessionId), withAuth())
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response))
  }
  return {
    blob: await response.blob(),
    fileName:
      downloadFileName(response.headers.get("content-disposition")) ||
      `${sessionId}-finalize-artifacts.zip`,
  }
}
