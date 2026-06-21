import { useState, useRef, useCallback, useEffect } from "react"
import type { FolderStatusResponse } from "@/features/upload/api/ocrApi"
import {
  digitizationToFolderStatus,
  getDigitizationStatus,
  isDigitizationComplete,
  restartDocumentMetadata,
  startDigitization,
  type DocumentNumberingMode,
  type SessionDocumentResponse,
  type UploadMode,
} from "@/features/upload/api/sessionApi"
import {
  buildReextractingStatus,
  hasExpectedStartedBatch,
  mergeReextractingStatus,
  sessionDocumentToJobSummary,
  type PendingStartContext,
} from "./useOcrFolderUtils"

export type OcrFolderState = "idle" | "starting" | "polling" | "done" | "error"

const OCR_POLL_INTERVAL_MS = 2_000
const OCR_POLL_RETRY_INTERVAL_MS = 5_000
const DEFAULT_DOCUMENT_NUMBERING_MODE: DocumentNumberingMode = "page"

export interface UseOcrFolderResult {
  state: OcrFolderState
  status: FolderStatusResponse | null
  error: string
  start: (
    folderPath: string,
    options: {
      maxFiles?: number
      confirmedPlanVersionId?: string
      documentNumberingMode?: DocumentNumberingMode
      sessionFileId?: number
      remoteFileId?: string | number | null
      uploadMode?: UploadMode
      force?: boolean
      reextract?: boolean
      previousStatus?: FolderStatusResponse | null
    }
  ) => Promise<void>
  refresh: () => Promise<FolderStatusResponse | null>
  restartMetadata: (documentId: number) => Promise<SessionDocumentResponse>
  mergeVerifiedDocuments: (documents: SessionDocumentResponse[]) => void
  reset: () => void
}

interface UseOcrFolderOptions {
  enabled?: boolean
  clearOnDisable?: boolean
}

export function useOcrFolder(
  sessionId: string | null,
  { enabled = true, clearOnDisable = false }: UseOcrFolderOptions = {}
): UseOcrFolderResult {
  const [state, setState] = useState<OcrFolderState>("idle")
  const [status, setStatus] = useState<FolderStatusResponse | null>(null)
  const [error, setError] = useState("")
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tokenRef = useRef(0)
  const rejectRef = useRef<((error: Error) => void) | null>(null)
  const pendingStartRef = useRef<PendingStartContext | null>(null)
  const manualOperationRef = useRef(false)

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
    pendingStartRef.current = null
    setState("idle")
    setStatus(null)
    setError("")
  }, [stop])

  const refresh = useCallback(async () => {
    if (!sessionId) {
      pendingStartRef.current = null
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
      pendingStartRef.current = null
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
    if (!enabled) {
      if (manualOperationRef.current) return
      stop()
      tokenRef.current += 1
      pendingStartRef.current = null
      rejectRef.current = null
      if (clearOnDisable) {
        setState("idle")
        setStatus(null)
        setError("")
      }
      return
    }

    if (manualOperationRef.current) return

    stop()
    tokenRef.current += 1
    const token = tokenRef.current

    if (!sessionId) {
      pendingStartRef.current = null
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
          pendingStartRef.current = null
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
  }, [clearOnDisable, enabled, schedulePollRetry, sessionId, stop])

  const start = useCallback(
    async (
      folderPath: string,
      options: {
        maxFiles?: number
        confirmedPlanVersionId?: string
        documentNumberingMode?: DocumentNumberingMode
        sessionFileId?: number
        remoteFileId?: string | number | null
        uploadMode?: UploadMode
        force?: boolean
        reextract?: boolean
        previousStatus?: FolderStatusResponse | null
      }
    ) => {
      if (!sessionId) {
        throw new Error("Chưa có session để bắt đầu OCR.")
      }
      stop()
      rejectRef.current?.(
        new Error("Quá trình chờ kết quả OCR đã được thay thế.")
      )
      rejectRef.current = null
      const token = tokenRef.current + 1
      tokenRef.current = token
      const previousStatus = options.previousStatus ?? status
      const expectedMode =
        options.documentNumberingMode ?? DEFAULT_DOCUMENT_NUMBERING_MODE
      const shouldShowReextractingState =
        options.reextract === true &&
        previousStatus !== null &&
        (previousStatus?.jobs.length ?? 0) > 0
      const shouldResetExistingDocuments =
        options.reextract === true && !options.uploadMode
      pendingStartRef.current =
        shouldShowReextractingState && previousStatus
          ? {
              previousBatchId: previousStatus.batch_id ?? null,
              expectedMode,
            }
          : null
      manualOperationRef.current = true
      setState("starting")
      setStatus(
        shouldShowReextractingState && previousStatus
          ? buildReextractingStatus(previousStatus, folderPath, expectedMode, {
              resetExistingDocuments: shouldResetExistingDocuments,
              uploadMode: options.uploadMode,
            })
          : null
      )
      setError("")

      try {
        await startDigitization(sessionId, {
          folder_path: folderPath,
          recursive: true,
          force: options.force ?? false,
          max_files: options.maxFiles,
          confirmed_plan_version_id: options.confirmedPlanVersionId,
          document_numbering_mode: options.documentNumberingMode,
          session_file_id: options.sessionFileId,
          remote_file_id: options.remoteFileId,
          upload_mode: options.uploadMode,
          overwrite: options.uploadMode === "overwrite",
        })
      } catch (err) {
        pendingStartRef.current = null
        manualOperationRef.current = false
        setState("error")
        setError(
          err instanceof Error ? err.message : "KhÃ´ng thá»ƒ báº¯t Ä‘áº§u OCR."
        )
        throw err
      }
      setState("polling")

      try {
        await new Promise<void>((resolve, reject) => {
          rejectRef.current = reject
          const resolvePolling = () => {
            rejectRef.current = null
            pendingStartRef.current = null
            resolve()
          }
          const rejectPolling = (error: Error) => {
            rejectRef.current = null
            pendingStartRef.current = null
            reject(error)
          }
          const poll = async () => {
            if (tokenRef.current !== token) {
              rejectPolling(new Error("Đã hủy quá trình chờ kết quả OCR."))
              return
            }
            try {
              const result = await getDigitizationStatus(sessionId)
              const pendingStart = pendingStartRef.current
              if (
                pendingStart &&
                !hasExpectedStartedBatch(result, pendingStart)
              ) {
                setError("")
                setState("polling")
                timeoutRef.current = setTimeout(poll, OCR_POLL_INTERVAL_MS)
                return
              }
              pendingStartRef.current = null
              const nextStatus = digitizationToFolderStatus(result, folderPath)
              const complete = isDigitizationComplete(result)
              setStatus((current) => {
                if (!current?.reextracting) return nextStatus
                return {
                  ...mergeReextractingStatus(current, nextStatus),
                  reextracting: !complete,
                }
              })
              setError("")
              if (complete) {
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
      } finally {
        manualOperationRef.current = false
      }
    },
    [schedulePollRetry, sessionId, status, stop]
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
