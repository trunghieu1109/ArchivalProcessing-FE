import type {
  SessionInputFileType,
  SessionEventResponse,
  UploadProgressSnapshot,
} from "./sessionApi.types"
import {
  apiUrl,
  presignedUploadErrorMessage,
  requestJson,
  responseTextErrorMessage,
  setXhrAuthHeader,
  uploadProgressSnapshot,
} from "./sessionApi.http"
import { visibleAwareDelay } from "@/shared/lib/pageVisibility"

export const PRESIGNED_UPLOAD_STALL_MS = 12_000
const UPLOAD_EVENT_POLL_INTERVAL_MS = 3_000
const UPLOAD_EVENT_HIDDEN_POLL_INTERVAL_MS = 15_000

export async function withSessionUploadEventProgress<T>(
  sessionId: string,
  fileType: SessionInputFileType,
  fileName: string,
  remoteFileId: string | null,
  pending: Promise<T>,
  onProgress?: (progress: UploadProgressSnapshot) => void
): Promise<T> {
  if (!onProgress) return pending
  let stopped = false
  let afterId = 0
  let wakeDelay: (() => void) | null = null
  const waitForNextPoll = () =>
    new Promise<void>((resolve) => {
      const finish = () => {
        if (wakeDelay === finish) wakeDelay = null
        window.clearTimeout(timeoutId)
        resolve()
      }
      const timeoutId = window.setTimeout(
        finish,
        visibleAwareDelay(
          UPLOAD_EVENT_POLL_INTERVAL_MS,
          UPLOAD_EVENT_HIDDEN_POLL_INTERVAL_MS
        )
      )
      wakeDelay = finish
    })
  const poll = async () => {
    while (!stopped) {
      try {
        const response = await requestJson<SessionEventResponse>(
          `/sessions/${encodeURIComponent(sessionId)}/events?after_id=${encodeURIComponent(String(afterId))}&limit=50`
        )
        for (const event of response.events) {
          afterId = Math.max(afterId, event.id)
          const progress = uploadProgressFromEvent(
            event.event_type,
            event.payload,
            fileType,
            fileName,
            remoteFileId
          )
          if (progress) onProgress(progress)
        }
      } catch {
        // Upload itself owns the user-facing error; event polling is best-effort progress only.
      }
      await waitForNextPoll()
    }
  }
  const pollPromise = poll()
  try {
    return await pending
  } finally {
    stopped = true
    const wake = wakeDelay as (() => void) | null
    wake?.()
    await pollPromise.catch(() => undefined)
  }
}

function uploadProgressFromEvent(
  eventType: string,
  payload: Record<string, unknown> | undefined,
  fileType: SessionInputFileType,
  fileName: string,
  remoteFileId: string | null
): UploadProgressSnapshot | null {
  if (!payload) return null
  if (payload.file_type !== fileType || payload.file_name !== fileName)
    return null
  if (remoteFileId && payload.remote_file_id !== remoteFileId) return null
  const loadedBytes = Number(payload.uploaded_bytes ?? 0)
  const totalBytes = Number(payload.total_bytes ?? 0)
  if (!Number.isFinite(loadedBytes) || !Number.isFinite(totalBytes)) return null
  if (eventType.endsWith(".failed")) {
    return uploadProgressSnapshot("error", loadedBytes, totalBytes)
  }
  if (eventType.endsWith(".completed")) {
    return uploadProgressSnapshot(
      "done",
      totalBytes || loadedBytes,
      totalBytes || loadedBytes
    )
  }
  if (
    eventType.includes(".progress") ||
    eventType.endsWith(".started") ||
    eventType.endsWith(".received")
  ) {
    return uploadProgressSnapshot("uploading", loadedBytes, totalBytes)
  }
  return null
}

export function requestJsonWithUploadProgress<T>(
  path: string,
  body: FormData,
  onProgress?: (progress: UploadProgressSnapshot) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    let lastProgress: UploadProgressSnapshot | null = null
    xhr.open("POST", apiUrl(path), true)
    setXhrAuthHeader(xhr)

    xhr.upload.onprogress = (event) => {
      const totalBytes = event.lengthComputable ? event.total : 0
      const loadedBytes = event.loaded
      lastProgress = uploadProgressSnapshot(
        "uploading",
        loadedBytes,
        totalBytes
      )
      onProgress?.(lastProgress)
    }

    xhr.upload.onload = () => {
      if (lastProgress) {
        onProgress?.(
          uploadProgressSnapshot(
            "processing",
            lastProgress.totalBytes,
            lastProgress.totalBytes
          )
        )
      }
    }

    xhr.onload = () => {
      const ok = xhr.status >= 200 && xhr.status < 300
      if (!ok) {
        if (lastProgress) {
          onProgress?.(
            uploadProgressSnapshot(
              "error",
              lastProgress.loadedBytes,
              lastProgress.totalBytes
            )
          )
        }
        reject(
          new Error(responseTextErrorMessage(xhr.status, xhr.responseText))
        )
        return
      }
      try {
        if (lastProgress) {
          onProgress?.(
            uploadProgressSnapshot(
              "done",
              lastProgress.totalBytes,
              lastProgress.totalBytes
            )
          )
        }
        resolve(JSON.parse(xhr.responseText || "{}") as T)
      } catch {
        reject(new Error("Backend trả về JSON không hợp lệ."))
      }
    }

    xhr.onerror = () => {
      if (lastProgress) {
        onProgress?.(
          uploadProgressSnapshot(
            "error",
            lastProgress.loadedBytes,
            lastProgress.totalBytes
          )
        )
      }
      reject(new Error("Không thể kết nối backend để upload."))
    }
    xhr.onabort = () => {
      if (lastProgress) {
        onProgress?.(
          uploadProgressSnapshot(
            "error",
            lastProgress.loadedBytes,
            lastProgress.totalBytes
          )
        )
      }
      reject(new Error("Upload đã bị hủy."))
    }
    xhr.send(body)
  })
}

export function requestJsonWithBinaryUploadProgress<T>(
  path: string,
  file: File,
  contentType: string,
  onProgress?: (progress: UploadProgressSnapshot) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    let lastProgress: UploadProgressSnapshot | null = uploadProgressSnapshot(
      "uploading",
      0,
      file.size
    )
    xhr.open("POST", apiUrl(path), true)
    setXhrAuthHeader(xhr)
    xhr.setRequestHeader("Accept", "application/json")
    if (contentType) xhr.setRequestHeader("Content-Type", contentType)

    xhr.upload.onprogress = (event) => {
      const totalBytes = event.lengthComputable ? event.total : file.size
      const loadedBytes = event.loaded
      lastProgress = uploadProgressSnapshot(
        "uploading",
        loadedBytes,
        totalBytes
      )
      onProgress?.(lastProgress)
    }

    xhr.upload.onload = () => {
      onProgress?.(uploadProgressSnapshot("processing", file.size, file.size))
    }

    xhr.onload = () => {
      const ok = xhr.status >= 200 && xhr.status < 300
      if (!ok) {
        onProgress?.(
          uploadProgressSnapshot(
            "error",
            lastProgress?.loadedBytes ?? 0,
            lastProgress?.totalBytes ?? file.size
          )
        )
        reject(
          new Error(responseTextErrorMessage(xhr.status, xhr.responseText))
        )
        return
      }
      try {
        onProgress?.(uploadProgressSnapshot("done", file.size, file.size))
        resolve(JSON.parse(xhr.responseText || "{}") as T)
      } catch {
        reject(new Error("Backend trả về JSON không hợp lệ."))
      }
    }

    xhr.onerror = () => {
      onProgress?.(
        uploadProgressSnapshot(
          "error",
          lastProgress?.loadedBytes ?? 0,
          lastProgress?.totalBytes ?? file.size
        )
      )
      reject(new Error("Không thể kết nối backend để upload ZIP."))
    }
    xhr.onabort = () => {
      onProgress?.(
        uploadProgressSnapshot(
          "error",
          lastProgress?.loadedBytes ?? 0,
          lastProgress?.totalBytes ?? file.size
        )
      )
      reject(new Error("Upload ZIP đã bị hủy."))
    }
    xhr.send(file)
  })
}

export class PresignedUploadNetworkError extends Error {}

export function putPresignedFile(
  uploadUrl: string,
  file: File,
  contentType: string,
  onProgress?: (progress: UploadProgressSnapshot) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    let lastProgress: UploadProgressSnapshot | null = uploadProgressSnapshot(
      "uploading",
      0,
      file.size
    )
    let settled = false
    let fallbackAbort = false
    let stallTimer: number | null = null

    const clearStallTimer = () => {
      if (stallTimer !== null) {
        window.clearTimeout(stallTimer)
        stallTimer = null
      }
    }
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      clearStallTimer()
      callback()
    }
    const rejectForFallback = () => {
      if (settled) return
      fallbackAbort = true
      xhr.abort()
      finish(() =>
        reject(
          new PresignedUploadNetworkError(
            "Direct presigned upload did not respond."
          )
        )
      )
    }
    const armStallTimer = () => {
      clearStallTimer()
      stallTimer = window.setTimeout(
        rejectForFallback,
        PRESIGNED_UPLOAD_STALL_MS
      )
    }
    xhr.open("PUT", uploadUrl, true)
    if (contentType) xhr.setRequestHeader("Content-Type", contentType)

    xhr.upload.onprogress = (event) => {
      armStallTimer()
      const totalBytes = event.lengthComputable ? event.total : file.size
      const loadedBytes = event.loaded
      lastProgress = uploadProgressSnapshot(
        "uploading",
        loadedBytes,
        totalBytes
      )
      onProgress?.(lastProgress)
    }

    xhr.onload = () => {
      const ok = xhr.status >= 200 && xhr.status < 300
      if (!ok) {
        if (xhr.status === 0) {
          finish(() =>
            reject(
              new PresignedUploadNetworkError(
                "Direct presigned upload did not respond."
              )
            )
          )
          return
        }
        onProgress?.(
          uploadProgressSnapshot(
            "error",
            lastProgress?.loadedBytes ?? 0,
            lastProgress?.totalBytes ?? file.size
          )
        )
        finish(() =>
          reject(
            new Error(presignedUploadErrorMessage(xhr.status, xhr.responseText))
          )
        )
        return
      }
      finish(resolve)
    }

    xhr.onerror = () => {
      finish(() =>
        reject(
          new PresignedUploadNetworkError(
            "Direct presigned upload did not respond."
          )
        )
      )
    }
    xhr.onabort = () => {
      if (fallbackAbort) return
      onProgress?.(
        uploadProgressSnapshot(
          "error",
          lastProgress?.loadedBytes ?? 0,
          lastProgress?.totalBytes ?? file.size
        )
      )
      reject(new Error("Upload ZIP lên Chỉnh Lý đã bị hủy."))
    }
    armStallTimer()
    xhr.send(file)
  })
}

export function putPresignedBlob(
  uploadUrl: string,
  blob: Blob,
  contentType?: string | null,
  onProgress?: (loadedBytes: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", uploadUrl, true)
    if (contentType) xhr.setRequestHeader("Content-Type", contentType)

    xhr.upload.onprogress = (event) => {
      onProgress?.(event.loaded)
    }

    xhr.onload = () => {
      const ok = xhr.status >= 200 && xhr.status < 300
      if (!ok) {
        if (xhr.status === 0) {
          reject(
            new PresignedUploadNetworkError(
              "Direct presigned chunk upload did not respond."
            )
          )
          return
        }
        reject(
          new Error(presignedUploadErrorMessage(xhr.status, xhr.responseText))
        )
        return
      }
      resolve()
    }

    xhr.onabort = () => {
      reject(new Error("Upload chunk lên Chỉnh Lý đã bị hủy."))
    }
    xhr.onerror = () => {
      reject(
        new PresignedUploadNetworkError(
          "Direct presigned chunk upload did not respond."
        )
      )
    }
    xhr.send(blob)
  })
}
