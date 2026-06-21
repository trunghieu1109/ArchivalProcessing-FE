import {
  apiUrl,
  downloadFileName,
  requestJson,
  responseErrorMessage,
  withAuth,
} from "./sessionApi.http"
import type { DocumentArchiveDownload } from "./sessionApi.types"

export interface PublicationDocument {
  session_document_id: number
  document_id: string
  source_file_name: string
  issued_date: string
  sequence_number: number
  sequence_code: string
  standard_file_name: string
  numbered_pdf_version_id?: string | null
  download_ready: boolean
}

export interface PublicationDossier {
  session_dossier_id: number
  dossier_id: string
  title: string
  dossier_number: string
  box_number: string
  formation_year: string
  dossier_code: string
  standard_name: string
  download_ready: boolean
  documents: PublicationDocument[]
}

export interface PublicationBox {
  box_number: string
  name: string
  download_ready: boolean
  dossiers: PublicationDossier[]
}

export interface PublicationManifest {
  schema_version: number
  session_id: string
  cluster_version_id: string
  fingerprint: string
  generated_at: string
  artifact_id: number
  archive_code: string
  fonds_creator_code: string
  naming_separator: string
  ready: boolean
  reused: boolean
  validation_errors: string[]
  summary: {
    box_count: number
    dossier_count: number
    document_count: number
  }
  boxes: PublicationBox[]
}

export type PublicationArchiveScope =
  | { scope?: "all" }
  | { scope: "box"; box_number: string }
  | { scope: "dossier"; session_dossier_id: number }

export type PublicationArchiveScopeResponse =
  | { type: "all" }
  | { type: "box"; box_number: string }
  | { type: "dossier"; session_dossier_id: number }

export interface PublicationArchiveJob {
  id: number
  job_type: string
  status: string
  retry_count: number
  payload: Record<string, unknown>
  locked_at?: string | null
  locked_by?: string | null
  error?: string | null
  created_at: string
  updated_at: string
}

export interface PublicationArchiveArtifact {
  id: number
  artifact_id: number
  artifact_type: string
  status: string
  file_name: string
  generated_at?: string | null
  manifest: Record<string, unknown>
}

export interface PublicationArchiveStatus {
  session_id: string
  scope: PublicationArchiveScopeResponse
  active: boolean
  job: PublicationArchiveJob | null
  artifact: PublicationArchiveArtifact | null
}

export interface PublicationArchiveJobResponse {
  session_id: string
  job_id: number
  job_type: string
  status: string
  scope: PublicationArchiveScopeResponse
  payload: Record<string, unknown>
  created_by?: string | null
  worker_required: boolean
}

export async function getPublicationManifest(
  sessionId: string
): Promise<PublicationManifest> {
  return requestJson<PublicationManifest>(
    `/sessions/${encodeURIComponent(sessionId)}/publication`
  )
}

export async function updatePublicationName(
  sessionId: string,
  payload: {
    target_type: "box" | "dossier" | "document"
    target_id: string | number
    name: string
  }
): Promise<PublicationManifest> {
  return requestJson<PublicationManifest>(
    `/sessions/${encodeURIComponent(sessionId)}/publication/names`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  )
}

export async function enqueuePublicationArchive(
  sessionId: string,
  scope: PublicationArchiveScope = { scope: "all" }
): Promise<PublicationArchiveJobResponse> {
  return requestJson<PublicationArchiveJobResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/publication/archive`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scope),
    }
  )
}

export async function getPublicationArchiveStatus(
  sessionId: string,
  scope: PublicationArchiveScope = { scope: "all" }
): Promise<PublicationArchiveStatus> {
  const params = new URLSearchParams()
  const scopeName = scope.scope ?? "all"
  params.set("scope", scopeName)
  if (scope.scope === "box") {
    params.set("box_number", scope.box_number)
  }
  if (scope.scope === "dossier") {
    params.set("session_dossier_id", String(scope.session_dossier_id))
  }
  return requestJson<PublicationArchiveStatus>(
    `/sessions/${encodeURIComponent(sessionId)}/publication/archive?${params.toString()}`
  )
}

export async function downloadPublicationArchiveArtifact(
  sessionId: string,
  artifactId: number
): Promise<DocumentArchiveDownload> {
  return downloadPublication(
    `/sessions/${encodeURIComponent(sessionId)}/publication/archive/${encodeURIComponent(String(artifactId))}/download`,
    `${sessionId}-publication.zip`
  )
}

export async function downloadPublicationAll(
  sessionId: string
): Promise<DocumentArchiveDownload> {
  return downloadPublication(
    `/sessions/${encodeURIComponent(sessionId)}/publication/download`,
    `${sessionId}-publication.zip`
  )
}

export async function downloadPublicationBox(
  sessionId: string,
  boxNumber: string
): Promise<DocumentArchiveDownload> {
  return downloadPublication(
    `/sessions/${encodeURIComponent(sessionId)}/publication/boxes/${encodeURIComponent(boxNumber)}/download`,
    `box-${boxNumber}.zip`
  )
}

export async function downloadPublicationDossier(
  sessionId: string,
  sessionDossierId: number
): Promise<DocumentArchiveDownload> {
  return downloadPublication(
    `/sessions/${encodeURIComponent(sessionId)}/publication/dossiers/${encodeURIComponent(String(sessionDossierId))}/download`,
    `dossier-${sessionDossierId}.zip`
  )
}

export async function downloadPublicationDocument(
  sessionId: string,
  sessionDocumentId: number
): Promise<DocumentArchiveDownload> {
  return downloadPublication(
    `/sessions/${encodeURIComponent(sessionId)}/publication/documents/${encodeURIComponent(String(sessionDocumentId))}/download`,
    `document-${sessionDocumentId}.pdf`
  )
}

async function downloadPublication(
  path: string,
  fallbackName: string
): Promise<DocumentArchiveDownload> {
  const response = await fetch(apiUrl(path), withAuth())
  if (!response.ok) throw new Error(await responseErrorMessage(response))
  return {
    blob: await response.blob(),
    fileName:
      downloadFileName(response.headers.get("content-disposition")) ||
      fallbackName,
  }
}
