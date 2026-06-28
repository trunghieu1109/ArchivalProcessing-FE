import { useState, useRef, useCallback, useEffect } from "react"
import type { FolderStatusResponse, JobSummary } from "@/features/upload/api/ocrApi"
import { hasMetadataWarning } from "@/features/upload/lib/metadata"
import {
  digitizationToFolderStatus,
  getDigitizationStatus,
  isDigitizationComplete,
  isMetadataExtractionComplete,
  restartDocumentMetadata,
  startDigitization,
  type DocumentNumberingMode,
  type DocumentNumberingStylePreset,
  type SessionDocumentResponse,
  type UploadMode,
} from "@/features/upload/api/sessionApi"
import {
  buildReextractingStatus,
  hasExpectedStartedBatch,
  sessionDocumentToReextractingDocument,
  sessionDocumentToJobSummary,
  type PendingStartContext,
} from "./useOcrFolderUtils"

export type OcrFolderState =
  | "idle"
  | "starting"
  | "polling"
  | "metadata_ready"
  | "done"
  | "error"

const OCR_POLL_INTERVAL_MS = 2_000
const OCR_POLL_RETRY_INTERVAL_MS = 5_000
const OCR_DOCUMENT_PAGE_SIZE = 50
const OCR_EMPTY_STATUS_RETRY_LIMIT = 60
const DEFAULT_DOCUMENT_NUMBERING_MODE: DocumentNumberingMode = "page"

export interface OcrRefreshOptions {
  includeDocuments?: boolean
  summaryOnly?: boolean
  limit?: number
  offset?: number
}

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
      documentNumberingStylePreset?: DocumentNumberingStylePreset
      documentNumberingStyleOverrides?: {
        font_size?: number
        color?: string
        opacity?: number
      }
      sessionFileId?: number
      remoteFileId?: string | number | null
      uploadMode?: UploadMode
      force?: boolean
      reextract?: boolean
      previousStatus?: FolderStatusResponse | null
    }
  ) => Promise<void>
  refresh: (options?: OcrRefreshOptions) => Promise<FolderStatusResponse | null>
  refreshDocumentsPage: (options?: {
    pageIndex?: number
    force?: boolean
  }) => Promise<FolderStatusResponse | null>
  documentPageIndex: number
  documentPageSize: number
  setDocumentPageIndex: (pageIndex: number) => void
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
  const [documentPageIndex, setDocumentPageIndexState] = useState(0)
  const documentPageSize = OCR_DOCUMENT_PAGE_SIZE
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const existingStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const tokenRef = useRef(0)
  const rejectRef = useRef<((error: Error) => void) | null>(null)
  const pendingStartRef = useRef<PendingStartContext | null>(null)
  const manualOperationRef = useRef(false)
  const documentPageCacheSessionRef = useRef<string | null>(null)
  const documentPageCacheRef = useRef<Map<number, FolderStatusResponse>>(
    new Map()
  )
  const prefetchingDocumentPagesRef = useRef<Set<number>>(new Set())

  const stop = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (existingStatusTimeoutRef.current) {
      clearTimeout(existingStatusTimeoutRef.current)
      existingStatusTimeoutRef.current = null
    }
  }, [])

  const schedulePollRetry = useCallback(
    (
      callback: () => void,
      message: string,
      retryMs = OCR_POLL_RETRY_INTERVAL_MS
    ) => {
      setError(`${message} Đang thử lại...`)
      setState((current) =>
        current === "metadata_ready" ? "metadata_ready" : "polling"
      )
      timeoutRef.current = setTimeout(callback, retryMs)
    },
    []
  )

  const setDocumentPageIndex = useCallback((pageIndex: number) => {
    setDocumentPageIndexState(Math.max(0, Math.floor(Number(pageIndex) || 0)))
  }, [])

  useEffect(() => {
    if (documentPageCacheSessionRef.current === sessionId) return
    documentPageCacheSessionRef.current = sessionId
    documentPageCacheRef.current.clear()
    prefetchingDocumentPagesRef.current.clear()
    setDocumentPageIndexState(0)
  }, [sessionId])

  const applyStatusResult = useCallback(
    (
      result: Awaited<ReturnType<typeof getDigitizationStatus>>,
      fallbackFolderPath: string,
      options: { preserveDocuments?: boolean } = {}
    ) => {
      const nextStatus = digitizationToFolderStatus(result, fallbackFolderPath)
      setStatus((current) => {
        if (
          !options.preserveDocuments ||
          nextStatus.jobs.length > 0 ||
          !current
        ) {
          return nextStatus
        }
        return {
          ...nextStatus,
          jobs: current.jobs,
          pagination: mergeOcrPaginationTotal(
            current.pagination,
            nextStatus.pagination
          ),
        }
      })
      return nextStatus
    },
    []
  )

  const fetchDocumentPageStatus = useCallback(
    async (pageIndex: number) => {
      if (!sessionId) return null
      const result = await getDigitizationStatus(sessionId, {
        includeDocuments: true,
        summaryOnly: false,
        limit: documentPageSize,
        offset: pageIndex * documentPageSize,
      })
      const fallbackFolderPath =
        result?.batches[0]?.folder_path ?? status?.folder_path ?? ""
      return {
        result,
        status: digitizationToFolderStatus(result, fallbackFolderPath),
      }
    },
    [documentPageSize, sessionId, status?.folder_path]
  )

  const prefetchDocumentPage = useCallback(
    async (pageIndex: number) => {
      if (!sessionId) return
      if (documentPageCacheRef.current.has(pageIndex)) return
      if (prefetchingDocumentPagesRef.current.has(pageIndex)) return

      prefetchingDocumentPagesRef.current.add(pageIndex)
      try {
        const fetched = await fetchDocumentPageStatus(pageIndex)
        if (fetched) {
          documentPageCacheRef.current.set(pageIndex, fetched.status)
        }
      } catch {
        // Prefetch is opportunistic; visible page loading handles real errors.
      } finally {
        prefetchingDocumentPagesRef.current.delete(pageIndex)
      }
    },
    [fetchDocumentPageStatus, sessionId]
  )

  const refreshDocumentsPage = useCallback(
    async (
      options: {
        pageIndex?: number
        force?: boolean
      } = {}
    ) => {
      if (!sessionId) {
        return null
      }
      const pageSize = documentPageSize
      const pageIndex = Math.max(
        0,
        Math.floor(Number(options.pageIndex ?? documentPageIndex) || 0)
      )
      if (options.pageIndex !== undefined) {
        setDocumentPageIndexState(pageIndex)
      }
      if (options.force) {
        documentPageCacheRef.current.clear()
        prefetchingDocumentPagesRef.current.clear()
      }
      const cachedStatus =
        !options.force && !status?.reextracting
          ? documentPageCacheRef.current.get(pageIndex)
          : undefined

      if (cachedStatus) {
        setStatus((current) => mergeCachedDocumentPage(current, cachedStatus))
        setError("")
        const nextPageIndex = nextPrefetchPageIndex(
          pageIndex,
          pageSize,
          cachedStatus
        )
        if (nextPageIndex !== null) {
          void prefetchDocumentPage(nextPageIndex)
        }
        return cachedStatus
      }

      const fetched = await fetchDocumentPageStatus(pageIndex)
      if (!fetched) return null
      const { result, status: nextStatus } = fetched
      documentPageCacheRef.current.set(pageIndex, nextStatus)
      setStatus((current) => {
        if (!current?.reextracting) return nextStatus
        return {
          ...nextStatus,
          total_files: Math.max(current.total_files, nextStatus.total_files),
          total_jobs: Math.max(current.total_jobs, nextStatus.total_jobs),
          pagination: nextStatus.pagination,
          reextracting: !isMetadataExtractionComplete(result),
        }
      })
      setError("")
      const nextPageIndex = nextPrefetchPageIndex(pageIndex, pageSize, nextStatus)
      if (nextPageIndex !== null) {
        void prefetchDocumentPage(nextPageIndex)
      }
      return nextStatus
    },
    [
      documentPageIndex,
      documentPageSize,
      fetchDocumentPageStatus,
      prefetchDocumentPage,
      sessionId,
      status?.reextracting,
    ]
  )

  const pollUntilComplete = useCallback(
    (token: number, fallbackFolderPath: string) => {
      const poll = async () => {
        if (tokenRef.current !== token) return
        try {
          if (!sessionId) return
          const result = await getDigitizationStatus(sessionId, {
            includeDocuments: true,
            summaryOnly: false,
            limit: documentPageSize,
            offset: documentPageIndex * documentPageSize,
          })
          applyStatusResult(result, fallbackFolderPath, {
            preserveDocuments: false,
          })
          setError("")
          if (shouldRefreshDocumentsFromStatus(result)) {
            void refreshDocumentsPage({ force: true })
          }
          if (isDigitizationComplete(result)) {
            stop()
            setState("done")
            return
          }
          setState(
            isMetadataExtractionComplete(result) ? "metadata_ready" : "polling"
          )
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
    [
      applyStatusResult,
      documentPageIndex,
      documentPageSize,
      refreshDocumentsPage,
      schedulePollRetry,
      sessionId,
      stop,
    ]
  )

  const reset = useCallback(() => {
    stop()
    tokenRef.current += 1
    rejectRef.current?.(new Error("Đã hủy quá trình chờ kết quả OCR."))
    rejectRef.current = null
    pendingStartRef.current = null
    documentPageCacheRef.current.clear()
    prefetchingDocumentPagesRef.current.clear()
    setState("idle")
    setStatus(null)
    setError("")
    setDocumentPageIndexState(0)
  }, [stop])

  const refresh = useCallback(async (options: OcrRefreshOptions = {}) => {
    if (!sessionId) {
      pendingStartRef.current = null
      documentPageCacheRef.current.clear()
      prefetchingDocumentPagesRef.current.clear()
      setState("idle")
      setStatus(null)
      setError("")
      return null
    }

    const includeDocuments = options.includeDocuments ?? false
    const pageLimit =
      includeDocuments && options.limit === undefined
        ? documentPageSize
        : options.limit
    const pageOffset =
      includeDocuments && options.offset === undefined
        ? documentPageIndex * documentPageSize
        : options.offset
    const result = await getDigitizationStatus(sessionId, {
      includeDocuments,
      summaryOnly: options.summaryOnly ?? !includeDocuments,
      limit: pageLimit,
      offset: pageOffset,
    })
    const fallbackFolderPath = result?.batches[0]?.folder_path ?? ""
    if (!hasDigitizationWork(result)) {
      stop()
      tokenRef.current += 1
      pendingStartRef.current = null
      documentPageCacheRef.current.clear()
      prefetchingDocumentPagesRef.current.clear()
      setState("idle")
      setStatus(null)
      setError("")
      return null
    }

    const nextStatus = applyStatusResult(result, fallbackFolderPath, {
      preserveDocuments: !includeDocuments,
    })
    setError("")
    if (isDigitizationComplete(result)) {
      stop()
      tokenRef.current += 1
      setState("done")
    } else {
      stop()
      const token = tokenRef.current + 1
      tokenRef.current = token
      setState(
        isMetadataExtractionComplete(result) ? "metadata_ready" : "polling"
      )
      pollUntilComplete(token, fallbackFolderPath)
    }
    return nextStatus
  }, [
    applyStatusResult,
    documentPageIndex,
    documentPageSize,
    pollUntilComplete,
    sessionId,
    stop,
  ])

  const mergeVerifiedDocuments = useCallback(
    (documents: SessionDocumentResponse[]) => {
      if (documents.length === 0) return

      const documentsById = new Map(
        documents.map((document) => [
          document.id,
          sessionDocumentToJobSummary(document),
        ])
      )
      documentPageCacheRef.current.forEach((cachedStatus, pageIndex) => {
        const nextCachedStatus = replaceCachedDocumentJobs(
          cachedStatus,
          documentsById
        )
        if (nextCachedStatus !== cachedStatus) {
          documentPageCacheRef.current.set(pageIndex, nextCachedStatus)
        }
      })

      setStatus((current) => {
        if (!current) return current

        const seenIds = new Set<number>()
        let changed = false
        let readyDelta = 0
        let finalDelta = 0
        let failedDelta = 0
        let processingDelta = 0
        let reviewedDelta = 0
        let warningDelta = 0
        let statusCounts = current.status_counts
        const jobs = current.jobs.map((job) => {
          const nextJob = documentsById.get(job.id)
          if (!nextJob) return job
          seenIds.add(nextJob.id)
          changed = true
          readyDelta += Number(nextJob.metadata_ready) - Number(job.metadata_ready)
          finalDelta += Number(nextJob.metadata_final) - Number(job.metadata_final)
          failedDelta +=
            Number(isFailedMetadataJob(nextJob)) -
            Number(isFailedMetadataJob(job))
          processingDelta +=
            Number(isProcessingMetadataJob(nextJob)) -
            Number(isProcessingMetadataJob(job))
          reviewedDelta +=
            Number(isExpertReviewedMetadataJob(nextJob)) -
            Number(isExpertReviewedMetadataJob(job))
          warningDelta +=
            Number(needsReviewMetadataJob(nextJob)) -
            Number(needsReviewMetadataJob(job))
          statusCounts = applyStatusCountDelta(
            statusCounts,
            job.status,
            nextJob.status
          )
          return nextJob
        })

        for (const [documentId, nextJob] of documentsById) {
          if (seenIds.has(documentId)) continue
          changed = true
          readyDelta += Number(nextJob.metadata_ready)
          finalDelta += Number(nextJob.metadata_final)
          failedDelta += Number(isFailedMetadataJob(nextJob))
          processingDelta += Number(isProcessingMetadataJob(nextJob))
          reviewedDelta += Number(isExpertReviewedMetadataJob(nextJob))
          warningDelta += Number(needsReviewMetadataJob(nextJob))
          statusCounts = incrementStatusCount(statusCounts, nextJob.status)
          jobs.push(nextJob)
        }

        if (!changed) return current
        return {
          ...current,
          total_files: Math.max(current.total_files, jobs.length),
          total_jobs: Math.max(current.total_jobs, jobs.length),
          status_counts: statusCounts,
          metadata_ready_documents: addOptionalCountDelta(
            current.metadata_ready_documents,
            readyDelta
          ),
          metadata_final_documents: addOptionalCountDelta(
            current.metadata_final_documents,
            finalDelta
          ),
          metadata_failed_documents: addOptionalCountDelta(
            current.metadata_failed_documents,
            failedDelta
          ),
          metadata_processing_documents: addOptionalCountDelta(
            current.metadata_processing_documents,
            processingDelta
          ),
          metadata_reviewed_documents: addOptionalCountDelta(
            current.metadata_reviewed_documents,
            reviewedDelta
          ),
          metadata_warning_documents: addOptionalCountDelta(
            current.metadata_warning_documents,
            warningDelta
          ),
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
      const reextractingDocument =
        sessionDocumentToReextractingDocument(restarted)
      mergeVerifiedDocuments([reextractingDocument])
      pollUntilComplete(token, fallbackFolderPath || restarted.data_path)
      return reextractingDocument
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
        const disableToken = tokenRef.current
        documentPageCacheRef.current.clear()
        prefetchingDocumentPagesRef.current.clear()
        queueMicrotask(() => {
          if (tokenRef.current !== disableToken) return
          setState("idle")
          setStatus(null)
          setError("")
        })
      }
      return
    }

    if (manualOperationRef.current) return

    stop()
    tokenRef.current += 1
    const token = tokenRef.current

    if (!sessionId) {
      pendingStartRef.current = null
      queueMicrotask(() => {
        if (tokenRef.current !== token) return
        setState("idle")
        setStatus(null)
        setError("")
      })
      return
    }

    let emptyStatusRetries = 0

    const pollExistingStatus = async () => {
      if (tokenRef.current !== token) return
      try {
        const result = await getDigitizationStatus(sessionId, {
          includeDocuments: true,
          summaryOnly: false,
          limit: documentPageSize,
          offset: documentPageIndex * documentPageSize,
        })
        if (tokenRef.current !== token) return

        const fallbackFolderPath = result?.batches[0]?.folder_path ?? ""
        if (!hasDigitizationWork(result)) {
          pendingStartRef.current = null
          documentPageCacheRef.current.clear()
          prefetchingDocumentPagesRef.current.clear()
          setStatus(null)
          setError("")
          if (emptyStatusRetries < OCR_EMPTY_STATUS_RETRY_LIMIT) {
            emptyStatusRetries += 1
            setState("polling")
            existingStatusTimeoutRef.current = setTimeout(
              pollExistingStatus,
              OCR_POLL_INTERVAL_MS
            )
            return
          }
          setState("idle")
          return
        }
        emptyStatusRetries = 0

        applyStatusResult(result, fallbackFolderPath, {
          preserveDocuments: false,
        })
        if (shouldRefreshDocumentsFromStatus(result)) {
          void refreshDocumentsPage({ force: true })
        }
        setError("")
        if (isDigitizationComplete(result)) {
          setState("done")
          return
        }

        setState(
          isMetadataExtractionComplete(result) ? "metadata_ready" : "polling"
        )
        existingStatusTimeoutRef.current = setTimeout(
          pollExistingStatus,
          OCR_POLL_INTERVAL_MS
        )
      } catch (err) {
        if (tokenRef.current !== token) return
        const message =
          err instanceof Error
            ? err.message
            : "Không thể tải trạng thái số hóa."
        setError(`${message} Đang thử lại...`)
        setState((current) =>
          current === "metadata_ready" ? "metadata_ready" : "polling"
        )
        existingStatusTimeoutRef.current = setTimeout(
          pollExistingStatus,
          OCR_POLL_RETRY_INTERVAL_MS
        )
      }
    }

    void pollExistingStatus()
    return () => {
      if (existingStatusTimeoutRef.current) {
        clearTimeout(existingStatusTimeoutRef.current)
        existingStatusTimeoutRef.current = null
      }
    }
  }, [
    applyStatusResult,
    clearOnDisable,
    documentPageIndex,
    documentPageSize,
    enabled,
    refreshDocumentsPage,
    sessionId,
    stop,
  ])

  const start = useCallback(
    async (
      folderPath: string,
      options: {
        maxFiles?: number
        confirmedPlanVersionId?: string
        documentNumberingMode?: DocumentNumberingMode
        documentNumberingStylePreset?: DocumentNumberingStylePreset
        documentNumberingStyleOverrides?: {
          font_size?: number
          color?: string
          opacity?: number
        }
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
        Math.max(
          previousStatus?.total_files ?? 0,
          previousStatus?.total_jobs ?? 0,
          previousStatus?.pagination?.total ?? 0,
          previousStatus?.jobs.length ?? 0
        ) > 0
      const shouldResetExistingDocuments =
        options.reextract === true && !options.uploadMode
      pendingStartRef.current =
        shouldShowReextractingState && previousStatus
          ? {
              previousBatchId: previousStatus.batch_id ?? null,
              expectedMode,
            }
          : null
      documentPageCacheRef.current.clear()
      prefetchingDocumentPagesRef.current.clear()
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
          document_numbering_style_preset: options.documentNumberingStylePreset,
          document_numbering_style_overrides:
            options.documentNumberingStyleOverrides ?? null,
          session_file_id: options.sessionFileId,
          remote_file_id: options.remoteFileId,
          ...(options.uploadMode
            ? {
                upload_mode: options.uploadMode,
                overwrite: options.uploadMode === "overwrite",
              }
            : {}),
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
          let settled = false
          rejectRef.current = reject
          const resolvePolling = () => {
            if (settled) return
            settled = true
            rejectRef.current = null
            pendingStartRef.current = null
            resolve()
          }
          const rejectPolling = (error: Error) => {
            if (settled) return
            settled = true
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
              const result = await getDigitizationStatus(sessionId, {
                includeDocuments: true,
                summaryOnly: false,
                limit: documentPageSize,
                offset: documentPageIndex * documentPageSize,
              })
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
              const metadataReady = isMetadataExtractionComplete(result)
              setStatus((current) => {
                if (!current?.reextracting) {
                  if (!current || nextStatus.jobs.length > 0) return nextStatus
                  return {
                    ...nextStatus,
                    jobs: current.jobs,
                    pagination: mergeOcrPaginationTotal(
                      current.pagination,
                      nextStatus.pagination
                    ),
                  }
                }
                return {
                  ...nextStatus,
                  total_files: Math.max(
                    current.total_files,
                    nextStatus.total_files
                  ),
                  total_jobs: Math.max(
                    current.total_jobs,
                    nextStatus.total_jobs
                  ),
                  jobs: current.jobs,
                  pagination: mergeOcrPaginationTotal(
                    current.pagination,
                    nextStatus.pagination
                  ),
                  reextracting: !metadataReady,
                }
              })
              setError("")
              if (shouldRefreshDocumentsFromStatus(result)) {
                void refreshDocumentsPage({ force: true })
              }
              if (complete) {
                stop()
                setState("done")
                resolvePolling()
                return
              }
              setState(metadataReady ? "metadata_ready" : "polling")
              if (metadataReady) {
                resolvePolling()
              }
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
    [
      documentPageIndex,
      documentPageSize,
      refreshDocumentsPage,
      schedulePollRetry,
      sessionId,
      status,
      stop,
    ]
  )

  return {
    state,
    status,
    error,
    start,
    refresh,
    refreshDocumentsPage,
    documentPageIndex,
    documentPageSize,
    setDocumentPageIndex,
    restartMetadata,
    mergeVerifiedDocuments,
    reset,
  }
}

function hasDigitizationWork(
  result: Awaited<ReturnType<typeof getDigitizationStatus>>
): boolean {
  return Boolean(
    result &&
      (result.batches.length > 0 ||
        result.documents.length > 0 ||
        (result.summary?.total_documents ?? 0) > 0)
  )
}

function shouldRefreshDocumentsFromStatus(
  result: Awaited<ReturnType<typeof getDigitizationStatus>>
): boolean {
  if (!result) return false
  if (result.documents.length > 0) return true
  if ((result.summary?.total_documents ?? 0) > 0) return true
  const batch = result.batches[0]
  return (
    (batch?.total_files ?? 0) > 0 ||
    (batch?.total_jobs ?? 0) > 0 ||
    statusCountTotal(result.summary?.status_counts) > 0 ||
    statusCountTotal(batch?.status_counts) > 0
  )
}

function statusCountTotal(counts: Record<string, number> | undefined): number {
  if (!counts) return 0
  return Object.values(counts).reduce(
    (sum, value) => sum + Math.max(0, Number(value) || 0),
    0
  )
}

function mergeOcrPaginationTotal(
  current: FolderStatusResponse["pagination"] | undefined,
  next: FolderStatusResponse["pagination"] | undefined
): FolderStatusResponse["pagination"] | undefined {
  if (!current) return next
  if (!next) return current
  return {
    ...current,
    total: next.total,
  }
}

function mergeCachedDocumentPage(
  current: FolderStatusResponse | null,
  cached: FolderStatusResponse
): FolderStatusResponse {
  if (!current) return cached
  return {
    ...cached,
    batch_id: current.batch_id,
    folder_path: current.folder_path,
    recursive: current.recursive,
    total_files: current.total_files,
    total_jobs: current.total_jobs,
    missing_files: current.missing_files,
    status_counts: current.status_counts,
    document_numbering_mode: current.document_numbering_mode,
    remove_blank_pages_before_ocr: current.remove_blank_pages_before_ocr,
    upload_mode: current.upload_mode,
    reextracting: current.reextracting,
    pdf_preprocessing: current.pdf_preprocessing,
    metadata_extraction_status: current.metadata_extraction_status,
    metadata_extraction_complete: current.metadata_extraction_complete,
    metadata_extraction_completed_at: current.metadata_extraction_completed_at,
    digitization_complete: current.digitization_complete,
    metadata_ready_documents: current.metadata_ready_documents,
    metadata_final_documents: current.metadata_final_documents,
    metadata_complete_documents: current.metadata_complete_documents,
    metadata_processing_documents: current.metadata_processing_documents,
    metadata_usable_documents: current.metadata_usable_documents,
    metadata_perfect_documents: current.metadata_perfect_documents,
    metadata_failed_documents: current.metadata_failed_documents,
    metadata_skipped_documents: current.metadata_skipped_documents,
    metadata_cancelled_documents: current.metadata_cancelled_documents,
    metadata_missing_task_documents: current.metadata_missing_task_documents,
    metadata_verified_documents: current.metadata_verified_documents,
    metadata_reviewed_documents: current.metadata_reviewed_documents,
    metadata_warning_documents: current.metadata_warning_documents,
    signature_extracted_documents: current.signature_extracted_documents,
    signature_pending_documents: current.signature_pending_documents,
    signature_failed_documents: current.signature_failed_documents,
    pagination: mergeCachedDocumentPagination(
      current.pagination,
      cached.pagination
    ),
    jobs: cached.jobs,
  }
}

function mergeCachedDocumentPagination(
  current: FolderStatusResponse["pagination"] | undefined,
  cached: FolderStatusResponse["pagination"] | undefined
): FolderStatusResponse["pagination"] | undefined {
  if (!cached) return current
  if (!current) return cached
  return {
    ...cached,
    total: current.total,
  }
}

function nextPrefetchPageIndex(
  pageIndex: number,
  pageSize: number,
  status: FolderStatusResponse
): number | null {
  const total = Math.max(
    status.pagination?.total ?? 0,
    status.total_files,
    status.total_jobs,
    status.jobs.length
  )
  const nextPageIndex = pageIndex + 1
  return nextPageIndex * pageSize < total ? nextPageIndex : null
}

function replaceCachedDocumentJobs(
  cached: FolderStatusResponse,
  documentsById: Map<number, JobSummary>
): FolderStatusResponse {
  let changed = false
  const jobs = cached.jobs.map((job) => {
    const nextJob = documentsById.get(job.id)
    if (!nextJob) return job
    changed = true
    return nextJob
  })
  return changed ? { ...cached, jobs } : cached
}

function isExpertReviewedMetadataJob(job: Pick<JobSummary, "is_reviewed">) {
  return job.is_reviewed === true
}

function needsReviewMetadataJob(
  job: Pick<
    JobSummary,
    "metadata_ready" | "is_reviewed" | "review_status" | "light_metadata"
  >
) {
  return (
    job.metadata_ready &&
    job.is_reviewed !== true &&
    (job.review_status !== "verified" ||
      hasMetadataWarning({
        review_status: job.review_status,
        light_metadata: job.light_metadata ?? {},
      }))
  )
}

const METADATA_FAILED_JOB_STATUSES = new Set([
  "failed",
  "final_failed",
  "signature_failed",
  "skipped",
  "cancelled",
  "missing_task",
])

const METADATA_RUNNING_JOB_STATUSES = new Set([
  "pending",
  "queued",
  "running",
  "processing",
  "submitted",
  "ocr_done",
  "metadata_priority_running",
  "metadata_running",
  "signature_pending",
  "cancel_requested",
])

function isFailedMetadataJob(
  job: Pick<JobSummary, "status" | "remote_metadata_status">
) {
  return METADATA_FAILED_JOB_STATUSES.has(metadataJobStatus(job))
}

function isProcessingMetadataJob(
  job: Pick<JobSummary, "status" | "remote_metadata_status">
) {
  return METADATA_RUNNING_JOB_STATUSES.has(metadataJobStatus(job))
}

function metadataJobStatus(
  job: Pick<JobSummary, "status" | "remote_metadata_status">
): string {
  return String(job.remote_metadata_status || job.status || "")
    .trim()
    .toLowerCase()
}

function applyStatusCountDelta(
  counts: Record<string, number>,
  previousStatus: string | null | undefined,
  nextStatus: string | null | undefined
): Record<string, number> {
  const previousKey = statusCountKey(previousStatus)
  const nextKey = statusCountKey(nextStatus)
  if (previousKey === nextKey) return counts
  const nextCounts = { ...counts }
  nextCounts[previousKey] = Math.max(0, (nextCounts[previousKey] ?? 0) - 1)
  nextCounts[nextKey] = (nextCounts[nextKey] ?? 0) + 1
  return nextCounts
}

function incrementStatusCount(
  counts: Record<string, number>,
  status: string | null | undefined
): Record<string, number> {
  const key = statusCountKey(status)
  return {
    ...counts,
    [key]: (counts[key] ?? 0) + 1,
  }
}

function statusCountKey(status: string | null | undefined): string {
  return String(status || "unknown").trim() || "unknown"
}

function addOptionalCountDelta(count: number | undefined, delta: number) {
  if (count === undefined) return count
  return Math.max(0, count + delta)
}
