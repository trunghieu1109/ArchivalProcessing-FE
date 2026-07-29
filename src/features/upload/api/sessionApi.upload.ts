import {
  apiUrl,
  defaultContentType,
  delay,
  postJson,
  requestJson,
  responseErrorMessage,
  uploadProgressSnapshot,
  withAuth,
} from "./sessionApi.http"
import {
  PresignedUploadNetworkError,
  putPresignedBlob,
  putPresignedFile,
  requestJsonWithBinaryUploadProgress,
  requestJsonWithUploadProgress,
  withSessionUploadEventProgress,
} from "./sessionApi.uploadProgress"
import type {
  SessionInputFileType,
  SessionInputRemoteChunkedCreateResponse,
  SessionInputRemoteChunkedPart,
  SessionInputRemoteChunkedPartsPresignResponse,
  SessionInputRemoteUploadPresignResponse,
  SessionInputUploadResponse,
  UploadSessionInputOptions,
} from "./sessionApi.types"
import { globalUploadPutSemaphore } from "@/shared/lib/uploadSemaphore"

export const DIRECT_PRESIGNED_UPLOAD_ENABLED = [
  "1",
  "true",
  "yes",
  "on",
].includes(
  String(import.meta.env.VITE_ARCHIVAL_DIRECT_PRESIGNED_UPLOAD ?? "true")
    .trim()
    .toLowerCase()
)
const BYTES_PER_MB = 1024 * 1024
const DEFAULT_CHUNKED_UPLOAD_CHUNK_SIZE_MB = 64
const CONFIGURED_CHUNKED_UPLOAD_CHUNK_SIZE_MB = parseOptionalPositiveIntegerEnv(
  import.meta.env.VITE_ARCHIVAL_CHUNKED_UPLOAD_CHUNK_SIZE_MB
)
const CONFIGURED_CHUNKED_UPLOAD_CHUNK_SIZE_BYTES =
  CONFIGURED_CHUNKED_UPLOAD_CHUNK_SIZE_MB === null
    ? null
    : CONFIGURED_CHUNKED_UPLOAD_CHUNK_SIZE_MB * BYTES_PER_MB
export const RAW_ZIP_CHUNKED_UPLOAD_THRESHOLD_BYTES = 50 * 1024 * 1024
export const CHUNKED_UPLOAD_CHUNK_SIZE_BYTES =
  (CONFIGURED_CHUNKED_UPLOAD_CHUNK_SIZE_MB ??
    DEFAULT_CHUNKED_UPLOAD_CHUNK_SIZE_MB) * BYTES_PER_MB
export const CHUNKED_UPLOAD_PART_PRESIGN_BATCH_SIZE = 32
export const CHUNKED_UPLOAD_MAX_CONCURRENCY = 4
export const CHUNKED_PROXY_UPLOAD_MAX_CONCURRENCY = 1
export const CHUNKED_UPLOAD_PART_MAX_ATTEMPTS = 3
export const PRESIGNED_UPLOAD_STALL_MS = 12_000

function parseOptionalPositiveIntegerEnv(value: unknown): number | null {
  const parsed = Number.parseInt(String(value ?? ""), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export async function uploadSessionInput(
  sessionId: string,
  fileType: SessionInputFileType,
  file: File,
  options: string | UploadSessionInputOptions = "ui"
): Promise<SessionInputUploadResponse> {
  const uploadOptions =
    typeof options === "string" ? { createdBy: options } : options
  if (fileType === "raw_zip") {
    return uploadRawZipSessionInputDirect(sessionId, file, uploadOptions)
  }
  const form = new FormData()
  form.append("file_type", fileType)
  form.append("created_by", uploadOptions.createdBy ?? "ui")
  form.append("file", file)
  return requestJsonWithUploadProgress<SessionInputUploadResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/inputs/upload`,
    form,
    uploadOptions.onProgress,
    uploadOptions.signal
  )
}

async function uploadRawZipSessionInputDirect(
  sessionId: string,
  file: File,
  options: UploadSessionInputOptions
): Promise<SessionInputUploadResponse> {
  const clientUploadId = options.clientUploadId ?? newClientUploadId()
  if (file.size > RAW_ZIP_CHUNKED_UPLOAD_THRESHOLD_BYTES) {
    return uploadRawZipSessionInputChunked(sessionId, file, options)
  }
  const contentType = file.type || defaultContentType(file.name)
  const presign = await postJson<SessionInputRemoteUploadPresignResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/inputs/remote-upload/presign`,
    {
      file_type: "raw_zip",
      file_name: file.name,
      content_type: contentType,
      size_bytes: file.size,
      created_by: options.createdBy ?? "ui",
      client_upload_id: clientUploadId,
    }
  )
  if (!presign.remote_file_id) {
    throw new Error("Chỉnh Lý chưa trả về remote_file_id cho file ZIP.")
  }
  throwIfUploadAborted(options.signal)
  options.onProgress?.(uploadProgressSnapshot("uploading", 0, file.size))
  if (!DIRECT_PRESIGNED_UPLOAD_ENABLED) {
    return proxyPresignedRawZipUpload(
      sessionId,
      file,
      contentType,
      presign,
      options
    )
  }
  try {
    await globalUploadPutSemaphore.run(
      options.jobId ?? presign.client_upload_id ?? clientUploadId,
      () =>
        putPresignedFile(
          presign.upload_url,
          file,
          contentType,
          options.onProgress,
          options.signal
        ),
      options.signal
    )
  } catch (error) {
    throwIfUploadAborted(options.signal)
    if (!(error instanceof PresignedUploadNetworkError)) throw error
    return proxyPresignedRawZipUpload(
      sessionId,
      file,
      contentType,
      presign,
      options
    )
  }
  options.onProgress?.(
    uploadProgressSnapshot("processing", file.size, file.size)
  )
  const completed = await postJson<SessionInputUploadResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/inputs/remote-upload/complete`,
    {
      file_type: "raw_zip",
      file_name: file.name,
      content_type: contentType,
      size_bytes: file.size,
      remote_batch_id: presign.remote_batch_id,
      remote_file_id: presign.remote_file_id,
      upload_url: presign.upload_url,
      created_by: options.createdBy ?? "ui",
      upload_mode: options.uploadMode ?? "append",
      client_upload_id: presign.client_upload_id ?? clientUploadId,
      ...(options.maxFiles === undefined
        ? {}
        : { max_files: options.maxFiles }),
    }
  )
  options.onProgress?.(uploadProgressSnapshot("done", file.size, file.size))
  return completed
}

async function uploadRawZipSessionInputChunked(
  sessionId: string,
  file: File,
  options: UploadSessionInputOptions
): Promise<SessionInputUploadResponse> {
  const clientUploadId = options.clientUploadId ?? newClientUploadId()
  const contentType = file.type || defaultContentType(file.name)
  const chunked = await requestJson<SessionInputRemoteChunkedCreateResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/inputs/remote-upload/chunked/create`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_type: "raw_zip",
        file_name: file.name,
        content_type: contentType,
        size_bytes: file.size,
        ...(CONFIGURED_CHUNKED_UPLOAD_CHUNK_SIZE_BYTES === null
          ? {}
          : { chunk_size_bytes: CONFIGURED_CHUNKED_UPLOAD_CHUNK_SIZE_BYTES }),
        created_by: options.createdBy ?? "ui",
        client_upload_id: clientUploadId,
      }),
    }
  )
  if (!chunked.remote_file_id) {
    throw new Error(
      "Chỉnh Lý chưa trả về remote_file_id cho chunked ZIP upload."
    )
  }
  const uploadId = chunked.upload_id || chunked.remote_upload_id
  if (!uploadId) {
    throw new Error("Chỉnh Lý chưa trả về upload_id cho chunked ZIP upload.")
  }

  throwIfUploadAborted(options.signal)
  const totalParts =
    chunked.part_count ||
    Math.ceil(
      file.size / (chunked.chunk_size_bytes || CHUNKED_UPLOAD_CHUNK_SIZE_BYTES)
    )
  let completedBytes = 0
  const activePartBytes = new Map<number, number>()
  const emitProgress = () => {
    const activeBytes = Array.from(activePartBytes.values()).reduce(
      (sum, value) => sum + value,
      0
    )
    options.onProgress?.(
      uploadProgressSnapshot(
        "uploading",
        Math.min(file.size, completedBytes + activeBytes),
        file.size
      )
    )
  }
  options.onProgress?.(uploadProgressSnapshot("uploading", 0, file.size))

  for (
    let startPart = 1;
    startPart <= totalParts;
    startPart += CHUNKED_UPLOAD_PART_PRESIGN_BATCH_SIZE
  ) {
    const partCount = Math.min(
      CHUNKED_UPLOAD_PART_PRESIGN_BATCH_SIZE,
      totalParts - startPart + 1
    )
    const presignedParts =
      await requestJson<SessionInputRemoteChunkedPartsPresignResponse>(
        `/sessions/${encodeURIComponent(sessionId)}/inputs/remote-upload/chunked/${encodeURIComponent(uploadId)}/parts/presign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            remote_batch_id: chunked.remote_batch_id,
            start_part: startPart,
            part_count: partCount,
          }),
          signal: options.signal,
        }
      )
    await uploadChunkedParts(
      sessionId,
      uploadId,
      chunked,
      file,
      presignedParts.parts,
      {
        activePartBytes,
        onPartComplete: (part) => {
          activePartBytes.delete(part.part_number)
          completedBytes += chunkedPartSize(part)
          emitProgress()
        },
        onPartProgress: emitProgress,
        jobId: options.jobId ?? chunked.client_upload_id ?? uploadId,
        signal: options.signal,
      }
    )
  }

  options.onProgress?.(
    uploadProgressSnapshot("processing", file.size, file.size)
  )
  const completed = await requestJson<SessionInputUploadResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/inputs/remote-upload/chunked/${encodeURIComponent(uploadId)}/complete`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_type: "raw_zip",
        file_name: file.name,
        content_type: contentType,
        size_bytes: file.size,
        remote_batch_id: chunked.remote_batch_id,
        remote_file_id: chunked.remote_file_id,
        delete_parts: true,
        created_by: options.createdBy ?? "ui",
        upload_mode: options.uploadMode ?? "append",
        client_upload_id: chunked.client_upload_id ?? clientUploadId,
        ...(options.maxFiles === undefined
          ? {}
          : { max_files: options.maxFiles }),
      }),
    }
  )
  options.onProgress?.(uploadProgressSnapshot("done", file.size, file.size))
  return completed
}

async function uploadChunkedParts(
  sessionId: string,
  uploadId: string,
  chunked: SessionInputRemoteChunkedCreateResponse,
  file: File,
  parts: SessionInputRemoteChunkedPart[],
  progress: {
    activePartBytes: Map<number, number>
    onPartProgress: () => void
    onPartComplete: (part: SessionInputRemoteChunkedPart) => void
    jobId: string
    signal?: AbortSignal
  }
): Promise<void> {
  let nextIndex = 0
  const workerCount = Math.min(
    DIRECT_PRESIGNED_UPLOAD_ENABLED
      ? CHUNKED_UPLOAD_MAX_CONCURRENCY
      : CHUNKED_PROXY_UPLOAD_MAX_CONCURRENCY,
    parts.length
  )
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < parts.length) {
      throwIfUploadAborted(progress.signal)
      const part = parts[nextIndex++]
      await uploadChunkedPartWithRetry(
        sessionId,
        uploadId,
        chunked,
        file,
        part,
        progress
      )
      progress.onPartComplete(part)
    }
  })
  await Promise.all(workers)
}

async function uploadChunkedPartWithRetry(
  sessionId: string,
  uploadId: string,
  chunked: SessionInputRemoteChunkedCreateResponse,
  file: File,
  part: SessionInputRemoteChunkedPart,
  progress: {
    activePartBytes: Map<number, number>
    onPartProgress: () => void
    jobId: string
    signal?: AbortSignal
  }
): Promise<void> {
  let lastError: unknown = null
  for (
    let attempt = 1;
    attempt <= CHUNKED_UPLOAD_PART_MAX_ATTEMPTS;
    attempt++
  ) {
    throwIfUploadAborted(progress.signal)
    try {
      const blob = chunkBlobForPart(file, part)
      progress.activePartBytes.set(part.part_number, 0)
      progress.onPartProgress()
      if (!DIRECT_PRESIGNED_UPLOAD_ENABLED) {
        await proxyChunkedPartUpload(
          sessionId,
          uploadId,
          chunked,
          file,
          part,
          blob,
          progress.signal
        )
        progress.activePartBytes.set(part.part_number, blob.size)
        progress.onPartProgress()
      } else {
        try {
          await globalUploadPutSemaphore.run(
            progress.jobId,
            () =>
              putPresignedBlob(
                part.upload_url,
                blob,
                part.content_type,
                (loadedBytes) => {
                  progress.activePartBytes.set(part.part_number, loadedBytes)
                  progress.onPartProgress()
                },
                progress.signal
              ),
            progress.signal
          )
        } catch (error) {
          throwIfUploadAborted(progress.signal)
          if (!(error instanceof PresignedUploadNetworkError)) throw error
          await proxyChunkedPartUpload(
            sessionId,
            uploadId,
            chunked,
            file,
            part,
            blob,
            progress.signal
          )
          progress.activePartBytes.set(part.part_number, blob.size)
          progress.onPartProgress()
        }
      }
      return
    } catch (error) {
      lastError = error
      progress.activePartBytes.delete(part.part_number)
      progress.onPartProgress()
      if (attempt < CHUNKED_UPLOAD_PART_MAX_ATTEMPTS) {
        await delay(500 * attempt)
        throwIfUploadAborted(progress.signal)
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`Không thể upload chunk ${part.part_number}.`)
}

function chunkedPartSize(part: SessionInputRemoteChunkedPart): number {
  if (Number.isFinite(part.size_bytes) && part.size_bytes > 0) {
    return part.size_bytes
  }
  return Math.max(0, part.byte_end - part.byte_start + 1)
}

function chunkBlobForPart(
  file: File,
  part: SessionInputRemoteChunkedPart
): Blob {
  const start = Math.max(0, part.byte_start)
  const end =
    Number.isFinite(part.size_bytes) && part.size_bytes > 0
      ? start + part.size_bytes
      : part.byte_end + 1
  return file.slice(start, Math.min(file.size, Math.max(start, end)))
}

async function proxyChunkedPartUpload(
  sessionId: string,
  uploadId: string,
  chunked: SessionInputRemoteChunkedCreateResponse,
  file: File,
  part: SessionInputRemoteChunkedPart,
  blob: Blob,
  signal?: AbortSignal
): Promise<void> {
  if (!chunked.remote_file_id) {
    throw new Error("Missing remote_file_id for chunked ZIP upload.")
  }
  const query = new URLSearchParams({
    file_type: "raw_zip",
    file_name: file.name,
    remote_batch_id: chunked.remote_batch_id,
    remote_file_id: chunked.remote_file_id,
    upload_url: part.upload_url,
    size_bytes: String(blob.size),
  })
  if (part.content_type) query.set("content_type", part.content_type)
  const response = await fetch(
    apiUrl(
      `/sessions/${encodeURIComponent(sessionId)}/inputs/remote-upload/chunked/${encodeURIComponent(uploadId)}/parts/${encodeURIComponent(String(part.part_number))}/proxy?${query.toString()}`
    ),
    withAuth({
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/octet-stream",
      },
      body: blob,
      signal,
    })
  )
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response))
  }
}

async function proxyPresignedRawZipUpload(
  sessionId: string,
  file: File,
  contentType: string,
  presign: SessionInputRemoteUploadPresignResponse,
  options: UploadSessionInputOptions
): Promise<SessionInputUploadResponse> {
  const query = new URLSearchParams({
    file_type: "raw_zip",
    file_name: file.name,
    content_type: contentType,
    size_bytes: String(file.size),
    created_by: options.createdBy ?? "ui",
    remote_batch_id: presign.remote_batch_id,
    remote_file_id: presign.remote_file_id ?? "",
    upload_mode: options.uploadMode ?? "append",
    client_upload_id: presign.client_upload_id ?? options.clientUploadId ?? "",
  })
  if (options.maxFiles !== undefined) {
    query.set("max_files", String(options.maxFiles))
  }
  const proxyUpload =
    requestJsonWithBinaryUploadProgress<SessionInputUploadResponse>(
      `/sessions/${encodeURIComponent(sessionId)}/inputs/remote-upload/proxy?${query.toString()}`,
      file,
      contentType,
      options.onProgress,
      options.signal
    )
  return withSessionUploadEventProgress(
    sessionId,
    "raw_zip",
    file.name,
    presign.remote_file_id ?? null,
    proxyUpload,
    options.onProgress
  )
}

function newClientUploadId(): string {
  if (typeof crypto.randomUUID === "function") {
    return `zip-upload-${crypto.randomUUID()}`
  }
  return `zip-upload-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function throwIfUploadAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("Upload đã bị hủy.", "AbortError")
  }
}

export function cancelRawZipUpload(
  sessionId: string,
  clientUploadId: string,
  reason = "user_cancelled",
  keepalive = false
): Promise<SessionInputUploadResponse> {
  return requestJson<SessionInputUploadResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/inputs/remote-upload/cancel`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_upload_id: clientUploadId,
        reason,
      }),
      keepalive,
    }
  )
}

export function cancelRawZipUploadKeepalive(
  sessionId: string,
  clientUploadId: string,
  reason = "page_hidden"
): void {
  void fetch(
    apiUrl(
      `/sessions/${encodeURIComponent(sessionId)}/inputs/remote-upload/cancel`
    ),
    withAuth({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_upload_id: clientUploadId,
        reason,
      }),
      keepalive: true,
    })
  ).catch(() => undefined)
}

export async function registerSessionInput(
  sessionId: string,
  fileType: SessionInputFileType,
  fileName: string,
  createdBy = "ui"
): Promise<SessionInputUploadResponse> {
  return requestJson<SessionInputUploadResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/inputs/register`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_type: fileType,
        file_name: fileName,
        created_by: createdBy,
      }),
    }
  )
}
