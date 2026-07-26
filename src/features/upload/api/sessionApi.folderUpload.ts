import {
  apiUrl,
  requestJson,
  responseErrorMessage,
  withAuth,
} from "./sessionApi.http"
import type {
  FolderUploadCompleteResponse,
  FolderUploadFileListResponse,
  FolderUploadFileStatus,
  FolderUploadMode,
  FolderUploadPresignResponse,
  FolderUploadRegisterResponse,
  FolderUploadSummary,
} from "./sessionApi.types"

export interface FolderManifestItem {
  client_file_id: string
  relative_path: string
  size_bytes: number
  content_type: "application/pdf"
}

const uploadPath = (sessionId: string, folderUploadId?: string) =>
  `/sessions/${encodeURIComponent(sessionId)}/inputs/folder-uploads${
    folderUploadId ? `/${encodeURIComponent(folderUploadId)}` : ""
  }`

export function createFolderUpload(
  sessionId: string,
  input: {
    client_upload_id: string
    mode: FolderUploadMode
    root_name: string
    expected_file_count: number
    expected_total_bytes: number
  },
  signal?: AbortSignal
): Promise<FolderUploadSummary> {
  return requestJson(uploadPath(sessionId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  })
}

export function registerFolderUploadFiles(
  sessionId: string,
  folderUploadId: string,
  files: FolderManifestItem[],
  signal?: AbortSignal
): Promise<FolderUploadRegisterResponse> {
  return requestJson(
    `${uploadPath(sessionId, folderUploadId)}/files/register`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files }),
      signal,
    }
  )
}

export function presignFolderUploadFiles(
  sessionId: string,
  folderUploadId: string,
  fileIds: number[],
  signal?: AbortSignal
): Promise<FolderUploadPresignResponse> {
  return requestJson(`${uploadPath(sessionId, folderUploadId)}/files/presign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_ids: fileIds }),
    signal,
  })
}

export function completeFolderUploadFiles(
  sessionId: string,
  folderUploadId: string,
  files: Array<{ file_id: number; size_bytes: number; etag?: string }>,
  signal?: AbortSignal
): Promise<FolderUploadCompleteResponse> {
  return requestJson(
    `${uploadPath(sessionId, folderUploadId)}/files/complete`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files }),
      signal,
    }
  )
}

export function sealFolderUpload(
  sessionId: string,
  folderUploadId: string,
  signal?: AbortSignal
): Promise<FolderUploadSummary> {
  return requestJson(`${uploadPath(sessionId, folderUploadId)}/seal`, {
    method: "POST",
    signal,
  })
}

export function cancelFolderUpload(
  sessionId: string,
  folderUploadId: string,
  reason = "user_cancelled",
  keepalive = false
): Promise<FolderUploadSummary> {
  return requestJson(`${uploadPath(sessionId, folderUploadId)}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
    keepalive,
  })
}

export function heartbeatFolderUpload(
  sessionId: string,
  folderUploadId: string
): Promise<void> {
  return fetch(
    apiUrl(`${uploadPath(sessionId, folderUploadId)}/heartbeat`),
    withAuth({ method: "POST" })
  ).then(async (response) => {
    if (!response.ok) throw new Error(await responseErrorMessage(response))
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
  options: {
    status?: FolderUploadFileStatus
    afterId?: number
    limit?: number
    signal?: AbortSignal
  } = {}
): Promise<FolderUploadFileListResponse> {
  const query = new URLSearchParams()
  if (options.status) query.set("status", options.status)
  if (options.afterId !== undefined) {
    query.set("after_id", String(options.afterId))
  }
  if (options.limit !== undefined) query.set("limit", String(options.limit))
  const suffix = query.size > 0 ? `?${query.toString()}` : ""
  return requestJson(
    `${uploadPath(sessionId, folderUploadId)}/files${suffix}`,
    { signal: options.signal }
  )
}

export function cancelFolderUploadKeepalive(
  sessionId: string,
  folderUploadId: string,
  reason = "page_hidden"
): void {
  void fetch(
    apiUrl(`${uploadPath(sessionId, folderUploadId)}/cancel`),
    withAuth({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
      keepalive: true,
    })
  ).catch(() => undefined)
}

export function putFolderPresignedFile(
  contract: {
    upload_url: string
    upload_headers: Record<string, string>
  },
  file: File,
  signal: AbortSignal,
  onProgress: (loadedBytes: number) => void
): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const abort = () => xhr.abort()
    xhr.open("PUT", contract.upload_url, true)
    for (const [name, value] of Object.entries(contract.upload_headers)) {
      xhr.setRequestHeader(name, value)
    }
    if (
      !Object.keys(contract.upload_headers).some(
        (name) => name.toLowerCase() === "content-type"
      )
    ) {
      xhr.setRequestHeader("Content-Type", "application/pdf")
    }
    xhr.upload.onprogress = (event) => onProgress(event.loaded)
    xhr.onload = () => {
      signal.removeEventListener("abort", abort)
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`Object storage trả về HTTP ${xhr.status}.`))
        return
      }
      resolve(xhr.getResponseHeader("ETag"))
    }
    xhr.onerror = () => {
      signal.removeEventListener("abort", abort)
      reject(new Error("Không thể kết nối object storage để upload PDF."))
    }
    xhr.onabort = () => {
      signal.removeEventListener("abort", abort)
      reject(new DOMException("Upload đã bị hủy.", "AbortError"))
    }
    if (signal.aborted) {
      reject(new DOMException("Upload đã bị hủy.", "AbortError"))
      return
    }
    signal.addEventListener("abort", abort, { once: true })
    xhr.send(file)
  })
}
