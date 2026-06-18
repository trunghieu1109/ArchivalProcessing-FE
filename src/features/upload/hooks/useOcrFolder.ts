import { useState, useRef, useCallback, useEffect } from "react"
import type {
  FolderStatusResponse,
  JobSummary,
} from "@/features/upload/api/ocrApi"
import {
  documentHasUserMetadataEdit,
  digitizationToFolderStatus,
  getDigitizationStatus,
  isDigitizationComplete,
  normalizeDocumentReviewStatus,
  restartDocumentMetadata,
  startDigitization,
  type DocumentNumberingMode,
  type SessionDocumentResponse,
  type UploadMode,
} from "@/features/upload/api/sessionApi"
import { buildDisplayMetadata } from "@/features/upload/lib/metadata"

export type OcrFolderState = "idle" | "starting" | "polling" | "done" | "error"

const OCR_POLL_INTERVAL_MS = 2_000
const OCR_POLL_RETRY_INTERVAL_MS = 5_000
const DEFAULT_DOCUMENT_NUMBERING_MODE: DocumentNumberingMode = "page"

interface PendingStartContext {
  previousBatchId: number | null
  expectedMode: DocumentNumberingMode
}

export interface UseOcrFolderResult {
  state: OcrFolderState
  status: FolderStatusResponse | null
  error: string
  start: (
    folderPath: string,
    options: {
      maxFiles?: number
      confirmedPlanVersionId: string
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

export function useOcrFolder(sessionId: string | null): UseOcrFolderResult {
  const [state, setState] = useState<OcrFolderState>("idle")
  const [status, setStatus] = useState<FolderStatusResponse | null>(null)
  const [error, setError] = useState("")
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tokenRef = useRef(0)
  const rejectRef = useRef<((error: Error) => void) | null>(null)
  const pendingStartRef = useRef<PendingStartContext | null>(null)

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
  }, [schedulePollRetry, sessionId, stop])

  const start = useCallback(
    async (
      folderPath: string,
      options: {
        maxFiles?: number
        confirmedPlanVersionId: string
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
        setState("error")
        setError(
          err instanceof Error ? err.message : "KhÃ´ng thá»ƒ báº¯t Ä‘áº§u OCR."
        )
        throw err
      }
      setState("polling")

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
            rejectPolling(
              new Error("Đã hủy quá trình chờ kết quả OCR.")
            )
            return
          }
          try {
            const result = await getDigitizationStatus(sessionId)
            const pendingStart = pendingStartRef.current
            if (pendingStart && !hasExpectedStartedBatch(result, pendingStart)) {
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

function sessionDocumentToJobSummary(
  document: SessionDocumentResponse
): JobSummary {
  const lightMetadata = buildDisplayMetadata(document)
  return {
    id: document.id,
    ocr_batch_id: document.ocr_batch_id,
    document_id: document.document_id,
    data_path: document.data_path,
    import_action: document.import_action,
    metadata_batch_id: document.metadata_batch_id,
    metadata_batch_assigned_to_user_id:
      document.metadata_batch_assigned_to_user_id,
    metadata_batch_assigned_to_email: document.metadata_batch_assigned_to_email,
    metadata_batch_assigned_to_name: document.metadata_batch_assigned_to_name,
    metadata_batch_assigned_at: document.metadata_batch_assigned_at,
    metadata_verified_by_user_id: document.metadata_verified_by_user_id,
    metadata_verified_by_email: document.metadata_verified_by_email,
    metadata_verified_by_name: document.metadata_verified_by_name,
    metadata_verified_at: document.metadata_verified_at,
    status: document.ocr_status,
    remote_metadata_status: document.remote_metadata_status,
    review_status: normalizeDocumentReviewStatus(document, lightMetadata),
    is_reviewed: document.is_reviewed === true,
    metadata_ready: document.metadata_ready,
    metadata_final: document.metadata_final,
    metadata_version_count: document.metadata_version_count,
    metadata_user_edited: documentHasUserMetadataEdit(document),
    error: document.error,
    light_metadata: lightMetadata,
    normalized_metadata: document.normalized_metadata,
    raw_metadata: document.raw_metadata,
  }
}

function buildReextractingStatus(
  previousStatus: FolderStatusResponse,
  folderPath: string,
  expectedMode: DocumentNumberingMode,
  options: {
    resetExistingDocuments: boolean
    uploadMode?: UploadMode
  }
): FolderStatusResponse {
  const jobs = options.resetExistingDocuments
    ? previousStatus.jobs.map((job) => ({
        ...job,
        status: "processing",
        remote_metadata_status: "processing",
        review_status: "pending",
        is_reviewed: false,
        metadata_ready: false,
        metadata_final: false,
        metadata_user_edited: false,
        error: null,
        light_metadata: {},
        normalized_metadata: {},
        raw_metadata: {},
        pdf_preprocessing: null,
      }))
    : previousStatus.jobs
  const totalJobs = Math.max(previousStatus.total_jobs, previousStatus.jobs.length)
  const totalFiles = Math.max(previousStatus.total_files, jobs.length)
  return {
    ...previousStatus,
    folder_path: folderPath || previousStatus.folder_path,
    total_files: totalFiles,
    total_jobs: totalJobs,
    status_counts: options.resetExistingDocuments
      ? { processing: jobs.length || totalJobs || totalFiles }
      : countJobStatuses(jobs),
    document_numbering_mode: expectedMode,
    upload_mode: options.uploadMode ?? previousStatus.upload_mode ?? null,
    reextracting: true,
    pdf_preprocessing: options.resetExistingDocuments
      ? null
      : previousStatus.pdf_preprocessing,
    signature_extracted_documents: options.resetExistingDocuments
      ? 0
      : previousStatus.signature_extracted_documents,
    signature_pending_documents: options.resetExistingDocuments
      ? 0
      : previousStatus.signature_pending_documents,
    signature_failed_documents: options.resetExistingDocuments
      ? 0
      : previousStatus.signature_failed_documents,
    jobs,
  }
}

function mergeReextractingStatus(
  currentStatus: FolderStatusResponse,
  nextStatus: FolderStatusResponse
): FolderStatusResponse {
  const jobsByPath = new Map(nextStatus.jobs.map((job) => [job.data_path, job]))
  const jobs = currentStatus.jobs.map(
    (job) => jobsByPath.get(job.data_path) ?? job
  )
  nextStatus.jobs.forEach((job) => {
    if (!jobs.some((currentJob) => currentJob.data_path === job.data_path)) {
      jobs.push(job)
    }
  })
  const totalJobs = Math.max(currentStatus.total_jobs, nextStatus.total_jobs, jobs.length)
  const totalFiles = Math.max(
    currentStatus.total_files,
    nextStatus.total_files,
    jobs.length
  )
  return {
    ...currentStatus,
    ...nextStatus,
    total_files: totalFiles,
    total_jobs: totalJobs,
    status_counts: countJobStatuses(jobs),
    reextracting: true,
    jobs,
  }
}

function hasExpectedStartedBatch(
  result: {
    batches: Array<{ id: number; document_numbering_mode?: string | null }>
  } | null,
  pendingStart: PendingStartContext
): boolean {
  const latestBatch = result?.batches[0]
  if (!latestBatch) return false
  if (
    pendingStart.previousBatchId !== null &&
    latestBatch.id === pendingStart.previousBatchId
  ) {
    return false
  }
  const latestMode = normalizeDocumentNumberingMode(
    latestBatch.document_numbering_mode
  )
  return latestMode === pendingStart.expectedMode
}

function normalizeDocumentNumberingMode(
  value: string | null | undefined
): DocumentNumberingMode | null {
  return value === "page" || value === "sheet" ? value : null
}

function countJobStatuses(jobs: JobSummary[]): Record<string, number> {
  const counts: Record<string, number> = {}
  jobs.forEach((job) => {
    const status = String(job.status || "unknown").trim() || "unknown"
    counts[status] = (counts[status] ?? 0) + 1
  })
  return counts
}
