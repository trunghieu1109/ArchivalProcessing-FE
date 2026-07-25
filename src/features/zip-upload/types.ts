import type {
  SessionInputUploadResponse,
  UploadMode,
  UploadProgressSnapshot,
} from "@/features/upload/api/sessionApi"

export type ZipUploadJobStatus =
  | "preparing"
  | "uploading"
  | "completing"
  | "attention_required"
  | "cancelling"
  | "cancelled"
  | "completed"

export interface ZipUploadJob {
  id: string
  sessionId: string
  fileName: string
  fileSize: number
  mode: UploadMode
  maxFiles?: number
  status: ZipUploadJobStatus
  progress: UploadProgressSnapshot | null
  result: SessionInputUploadResponse | null
  error: string | null
  startedAt: number
  updatedAt: number
  dockHidden: boolean
  metadataNavigationHandled: boolean
}

export interface ZipUploadStartInput {
  sessionId: string
  file: File
  mode: UploadMode
  maxFiles?: number
  createdBy?: string
}

export interface ZipUploadStartResult {
  jobId: string
  completion: Promise<SessionInputUploadResponse>
}
