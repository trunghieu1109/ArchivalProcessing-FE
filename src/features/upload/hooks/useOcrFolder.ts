import { useState, useRef, useCallback, useEffect } from "react"
import type {
  FolderStatusResponse,
  JobSummary,
} from "@/features/upload/api/ocrApi"
import {
  digitizationToFolderStatus,
  getDigitizationStatus,
  isDigitizationComplete,
  normalizeDocumentReviewStatus,
  restartDocumentMetadata,
  startDigitization,
  type SessionDocumentResponse,
} from "@/features/upload/api/sessionApi"
import { buildDisplayMetadata } from "@/features/upload/lib/metadata"

export type OcrFolderState = "idle" | "starting" | "polling" | "done" | "error"

const OCR_POLL_INTERVAL_MS = 2_000
const OCR_POLL_RETRY_INTERVAL_MS = 5_000

export interface UseOcrFolderResult {
  state: OcrFolderState
  status: FolderStatusResponse | null
  error: string
  start: (folderPath: string, options: { maxFiles?: number; confirmedPlanVersionId: string }) => Promise<void>
  refresh: () => Promise<FolderStatusResponse | null>
  restartMetadata: (documentId: number) => Promise<SessionDocumentResponse>
  mergeVerifiedDocuments: (documents: SessionDocumentResponse[]) => void
  reset: () => void
}

export function useOcrFolder(sessionId: string | null): UseOcrFolderResult {
  const [state, setState] = useState<OcrFolderState>("idle")
  const [status, setStatus] = useState<FolderStatusResponse | null>(null)
  const [error, setError] = useState("")
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tokenRef = useRef(0)
  const rejectRef = useRef<((error: Error) => void) | null>(null)

  const stop = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const schedulePollRetry = useCallback(
    (
      callback: () => void,
      message: string,
      retryMs = OCR_POLL_RETRY_INTERVAL_MS
    ) => {
      setError(`${message} Đang thử lại...`)
      setState("polling")
      timeoutRef.current = setTimeout(callback, retryMs)
    },
    []
  )

  const pollUntilComplete = useCallback(
    (token: number, fallbackFolderPath: string) => {
      const poll = async () => {
        if (tokenRef.current !== token) return
        try {
          if (!sessionId) return
          const result = await getDigitizationStatus(sessionId)
          setStatus(digitizationToFolderStatus(result, fallbackFolderPath))
          setError("")
          if (isDigitizationComplete(result)) {
            stop()
            setState("done")
            return
          }
          setState("polling")
          timeoutRef.current = setTimeout(poll, OCR_POLL_INTERVAL_MS)
        } catch (err) {
          if (tokenRef.current !== token) return
          schedulePollRetry(
            poll,
            err instanceof Error
              ? err.message
              : "Không thể kiểm tra trạng thái OCR."
          )
        }
      }

      void poll()
    },
    [schedulePollRetry, sessionId, stop]
  )

  const reset = useCallback(() => {
    stop()
    tokenRef.current += 1
    rejectRef.current?.(new Error("Đã hủy quá trình chờ kết quả OCR."))
    rejectRef.current = null
    setState("idle")
    setStatus(null)
    setError("")
  }, [stop])

  const refresh = useCallback(async () => {
    if (!sessionId) {
      setState("idle")
      setStatus(null)
      setError("")
      return null
    }

    const result = await getDigitizationStatus(sessionId)
    const fallbackFolderPath = result?.batches[0]?.folder_path ?? ""
    const hasExistingWork = Boolean(
      result && (result.batches.length > 0 || result.documents.length > 0)
    )
    if (!hasExistingWork) {
      setState("idle")
      setStatus(null)
      setError("")
      return null
    }

    const nextStatus = digitizationToFolderStatus(result, fallbackFolderPath)
    setStatus(nextStatus)
    setError("")
    setState(isDigitizationComplete(result) ? "done" : "polling")
    return nextStatus
  }, [sessionId])

  const mergeVerifiedDocuments = useCallback(
    (documents: SessionDocumentResponse[]) => {
      if (documents.length === 0) return

      setStatus((current) => {
        if (!current) return current

        const documentsById = new Map(
          documents.map((document) => [document.id, document])
        )
        const seenIds = new Set<number>()
        let changed = false
        const jobs = current.jobs.map((job) => {
          const document = documentsById.get(job.id)
          if (!document) return job
          seenIds.add(document.id)
          changed = true
          return sessionDocumentToJobSummary(document)
        })

        for (const document of documents) {
          if (seenIds.has(document.id)) continue
          changed = true
          jobs.push(sessionDocumentToJobSummary(document))
        }

        if (!changed) return current
        return {
          ...current,
          total_files: Math.max(current.total_files, jobs.length),
          total_jobs: Math.max(current.total_jobs, jobs.length),
          jobs,
        }
      })
    },
    []
  )

  const restartMetadata = useCallback(
    async (documentId: number) => {
      if (!sessionId) {
        throw new Error("Chưa có session để chạy lại metadata.")
      }
      stop()
      rejectRef.current?.(
        new Error("Quá trình chờ kết quả OCR đã được thay thế.")
      )
      rejectRef.current = null
      const token = tokenRef.current + 1
      tokenRef.current = token
      const fallbackFolderPath = status?.folder_path ?? ""
      setState("polling")
      setError("")
      const restarted = await restartDocumentMetadata(sessionId, documentId, {
        force: true,
      })
      mergeVerifiedDocuments([restarted])
      pollUntilComplete(token, fallbackFolderPath || restarted.data_path)
      return restarted
    },
    [
      mergeVerifiedDocuments,
      pollUntilComplete,
      sessionId,
      status?.folder_path,
      stop,
    ]
  )

  useEffect(() => {
    stop()
    tokenRef.current += 1
    const token = tokenRef.current

    if (!sessionId) {
      setState("idle")
      setStatus(null)
      setError("")
      return
    }

    const pollExistingStatus = async () => {
      if (tokenRef.current !== token) return
      try {
        const result = await getDigitizationStatus(sessionId)
        if (tokenRef.current !== token) return

        const fallbackFolderPath = result?.batches[0]?.folder_path ?? ""
        const hasExistingWork = Boolean(
          result && (result.batches.length > 0 || result.documents.length > 0)
        )
        if (!hasExistingWork) {
          setState("idle")
          setStatus(null)
          setError("")
          return
        }

        setStatus(digitizationToFolderStatus(result, fallbackFolderPath))
        setError("")
        if (isDigitizationComplete(result)) {
          setState("done")
          return
        }

        setState("polling")
        timeoutRef.current = setTimeout(
          pollExistingStatus,
          OCR_POLL_INTERVAL_MS
        )
      } catch (err) {
        if (tokenRef.current !== token) return
        schedulePollRetry(
          pollExistingStatus,
          err instanceof Error
            ? err.message
            : "Không thể tải trạng thái số hóa."
        )
      }
    }

    void pollExistingStatus()
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [schedulePollRetry, sessionId, stop])

  const start = useCallback(
    async (
      folderPath: string,
      options: { maxFiles?: number; confirmedPlanVersionId: string }
    ) => {
      if (!sessionId) {
        throw new Error("Chưa có session để bắt đầu OCR.")
      }
      if (!options.confirmedPlanVersionId) {
        throw new Error("Chưa xác nhận phương án chỉnh lý.")
      }
      stop()
      rejectRef.current?.(
        new Error("Quá trình chờ kết quả OCR đã được thay thế.")
      )
      rejectRef.current = null
      const token = tokenRef.current + 1
      tokenRef.current = token
      setState("starting")
      setStatus(null)
      setError("")

      await startDigitization(sessionId, {
        folder_path: folderPath,
        recursive: true,
        force: false,
        max_files: options.maxFiles,
        confirmed_plan_version_id: options.confirmedPlanVersionId,
      })
      setState("polling")

      await new Promise<void>((resolve, reject) => {
        rejectRef.current = reject
        const resolvePolling = () => {
          rejectRef.current = null
          resolve()
        }
        const rejectPolling = (error: Error) => {
          rejectRef.current = null
          reject(error)
        }
        const poll = async () => {
          if (tokenRef.current !== token) {
            rejectPolling(
              new Error("Đã hủy quá trình chờ kết quả OCR.")
            )
            return
          }
          try {
            const result = await getDigitizationStatus(sessionId)
            setStatus(digitizationToFolderStatus(result, folderPath))
            setError("")
            if (isDigitizationComplete(result)) {
              stop()
              setState("done")
              resolvePolling()
              return
            }
            setState("polling")
            timeoutRef.current = setTimeout(poll, OCR_POLL_INTERVAL_MS)
          } catch (err) {
            if (tokenRef.current !== token) return
            schedulePollRetry(
              poll,
              err instanceof Error
                ? err.message
                : "Không thể kiểm tra trạng thái OCR."
            )
          }
        }

        void poll()
      })
    },
    [schedulePollRetry, sessionId, stop]
  )

  return {
    state,
    status,
    error,
    start,
    refresh,
    restartMetadata,
    mergeVerifiedDocuments,
    reset,
  }
}

function sessionDocumentToJobSummary(
  document: SessionDocumentResponse
): JobSummary {
  const lightMetadata = buildDisplayMetadata(document)
  return {
    id: document.id,
    document_id: document.document_id,
    data_path: document.data_path,
    status: document.ocr_status,
    review_status: normalizeDocumentReviewStatus(document, lightMetadata),
    metadata_ready: document.metadata_ready,
    metadata_final: document.metadata_final,
    error: document.error,
    light_metadata: lightMetadata,
    normalized_metadata: document.normalized_metadata,
    raw_metadata: document.raw_metadata,
  }
}
