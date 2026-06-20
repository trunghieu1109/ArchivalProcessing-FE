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

export async function getPublicationManifest(
  sessionId: string
): Promise<PublicationManifest> {
  return requestJson<PublicationManifest>(
    `/sessions/${encodeURIComponent(sessionId)}/publication`
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
