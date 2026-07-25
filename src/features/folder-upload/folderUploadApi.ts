import {
  apiUrl,
  postJson,
  requestJson,
  responseTextErrorMessage,
  withAuth,
} from "@/features/upload/api/sessionApi.http"
import type {
  FolderUploadRemoteFile,
  FolderUploadSummary,
  PresignedFolderFilesResponse,
  RegisteredFolderFilesResponse,
} from "./types"

const uploadPath = (sessionId: string, folderUploadId?: string) =>
  `/sessions/${encodeURIComponent(sessionId)}/inputs/folder-uploads${
    folderUploadId ? `/${encodeURIComponent(folderUploadId)}` : ""
  }`

export function createFolderUpload(
  sessionId: string,
  input: {
    client_upload_id: string
    mode: "append" | "overwrite"
    root_name: string
    expected_file_count: number
    expected_total_bytes: number
  },
  signal?: AbortSignal
): Promise<FolderUploadSummary> {
  return postJson(uploadPath(sessionId), input, signal)
}

export function registerFolderFiles(
  sessionId: string,
  folderUploadId: string,
  files: Array<{
    client_file_id: string
    relative_path: string
    size_bytes: number
    content_type: "application/pdf"
  }>,
  signal?: AbortSignal
): Promise<RegisteredFolderFilesResponse> {
  return postJson(`${uploadPath(sessionId, folderUploadId)}/files/register`, {
    files,
  }, signal)
}

export function presignFolderFiles(
  sessionId: string,
  folderUploadId: string,
  fileIds: number[],
  signal?: AbortSignal
): Promise<PresignedFolderFilesResponse> {
  return postJson(`${uploadPath(sessionId, folderUploadId)}/files/presign`, {
    file_ids: fileIds,
    expires_seconds: 1800,
  }, signal)
}

export function completeFolderFiles(
  sessionId: string,
  folderUploadId: string,
  files: Array<{ file_id: number; size_bytes: number; etag?: string }>,
  signal?: AbortSignal
): Promise<RegisteredFolderFilesResponse> {
  return postJson(`${uploadPath(sessionId, folderUploadId)}/files/complete`, {
    files,
  }, signal)
}

export function sealFolderUpload(
  sessionId: string,
  folderUploadId: string,
  signal?: AbortSignal
): Promise<FolderUploadSummary> {
  return postJson(`${uploadPath(sessionId, folderUploadId)}/seal`, {}, signal)
}

export function heartbeatFolderUpload(
  sessionId: string,
  folderUploadId: string
): Promise<void> {
  return fetch(apiUrl(`${uploadPath(sessionId, folderUploadId)}/heartbeat`), {
    ...withAuth({ method: "POST" }),
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(
        responseTextErrorMessage(response.status, await response.text())
      )
    }
  })
}

export function getFolderUpload(
  sessionId: string,
  folderUploadId: string,
  signal?: AbortSignal
): Promise<FolderUploadSummary> {
  return requestJson(uploadPath(sessionId, folderUploadId), { signal })
}

export function listFolderUploadFiles(
  sessionId: string,
  folderUploadId: string,
  afterId = 0,
  limit = 200
): Promise<{
  items: FolderUploadRemoteFile[]
  next_after_id: number | null
  has_more: boolean
}> {
  const query = new URLSearchParams({
    after_id: String(afterId),
    limit: String(limit),
  })
  return requestJson(
    `${uploadPath(sessionId, folderUploadId)}/files?${query.toString()}`
  )
}

export function cancelFolderUpload(
  sessionId: string,
  folderUploadId: string,
  reason: string,
  options: { keepalive?: boolean } = {}
): Promise<FolderUploadSummary | null> {
  if (!options.keepalive) {
    return postJson(`${uploadPath(sessionId, folderUploadId)}/cancel`, { reason })
  }
  return fetch(apiUrl(`${uploadPath(sessionId, folderUploadId)}/cancel`), {
    ...withAuth({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
      keepalive: true,
    }),
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(
        responseTextErrorMessage(response.status, await response.text())
      )
    }
    return response.json() as Promise<FolderUploadSummary>
  })
}
