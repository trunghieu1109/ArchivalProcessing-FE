import type { UploadMode } from "@/features/upload/api/sessionApi"

export type FolderUploadFileStatus =
  | "queued"
  | "registering"
  | "registered"
  | "skipped"
  | "uploading"
  | "uploaded"
  | "confirming"
  | "confirmed"
  | "failed"
  | "cancelled"

export type FolderUploadJobStatus =
  | "preparing"
  | "uploading"
  | "sealing"
  | "reconciling"
  | "completed"
  | "attention_required"
  | "cancelling"
  | "cancelled"

export interface FolderUploadCounts {
  registered: number
  confirmed: number
  skipped: number
  failed: number
  cancelled: number
  effective: number
  mapped_documents: number
  unregistered: number
  unfinished: number
}

export interface FolderUploadIngestionRun {
  id: number
  ingestion_source: "folder" | "zip" | string
  status: string
  folder_upload_id: string | null
  total_pdf_files: number | null
}

export interface FolderUploadSummary {
  folder_upload_id: string
  session_id: string
  client_upload_id: string
  mode: UploadMode
  root_name: string
  status: string
  document_sync_status: string
  expected_file_count: number
  expected_total_bytes: number
  counts: FolderUploadCounts
  lease_expires_at: string | null
  cancel_reason: string | null
  cancelled_at: string | null
  ingestion_run: FolderUploadIngestionRun | null
  error: string | null
  created_at: string
  updated_at: string
}

export interface FolderUploadRemoteFile {
  file_id: number
  client_file_id: string
  relative_path: string
  normalized_relative_path: string
  size_bytes: number
  content_type: string
  status: string
  action: string | null
  remote_document_id: string | null
  attempt_count: number
  etag: string | null
  error: { code: string; message: string } | null
}

export interface FolderUploadFileState {
  sourceIndex: number
  clientFileId: string
  relativePath: string
  sizeBytes: number
  status: FolderUploadFileStatus
  remoteFileId: number | null
  uploadedBytes: number
  attempts: number
  action: string | null
  error: string | null
}

export interface FolderUploadJob {
  id: string
  sessionId: string
  folderUploadId: string | null
  rootName: string
  mode: UploadMode
  status: FolderUploadJobStatus
  files: FolderUploadFileState[]
  totalBytes: number
  uploadedBytes: number
  startedAt: number
  updatedAt: number
  error: string | null
  summary: FolderUploadSummary | null
  dockHidden: boolean
  metadataNavigationHandled: boolean
}

export interface FolderUploadStartInput {
  sessionId: string
  files: FileList | File[]
  mode: UploadMode
}

export interface RegisteredFolderFilesResponse {
  folder_upload_id: string
  files: FolderUploadRemoteFile[]
  counts: FolderUploadCounts
}

export interface PresignedFolderFile {
  file_id: number
  method: "PUT"
  upload_url: string
  upload_headers: Record<string, string>
  expires_at: string | null
}

export interface PresignedFolderFilesResponse {
  folder_upload_id: string
  files: PresignedFolderFile[]
}
