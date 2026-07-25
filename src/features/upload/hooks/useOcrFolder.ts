import { useState, useRef, useCallback, useEffect } from "react"
import type { FolderStatusResponse, JobSummary } from "@/features/upload/api/ocrApi"
import { hasMetadataWarning } from "@/features/upload/lib/metadata"
import { visibleAwareDelay } from "@/shared/lib/pageVisibility"
import {
  digitizationToFolderStatus,
  getDigitizationStatus,
  isDigitizationComplete,
  isMetadataExtractionComplete,
  restartDocumentMetadata,
  startDigitization,
  type DocumentNumberingMode,
  type DocumentNumberingStylePreset,
  type MetadataDocumentScope,
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

const OCR_POLL_INTERVAL_MS = 5_000
const OCR_POLL_RETRY_INTERVAL_MS = 5_000
const OCR_DOCUMENT_DEFAULT_PAGE_SIZE = 50
const OCR_DOCUMENT_MIN_PAGE_SIZE = 1
const OCR_DOCUMENT_MAX_PAGE_SIZE = 1000
const OCR_DOCUMENT_PAGE_SIZE_STORAGE_KEY =
  "archival-processing.metadata-display-page-size"
const OCR_EMPTY_STATUS_RETRY_LIMIT = 12
const OCR_DOCUMENT_REFRESH_MIN_INTERVAL_MS = 15_000
const DEFAULT_DOCUMENT_NUMBERING_MODE: DocumentNumberingMode = "page"
const DEFAULT_METADATA_DOCUMENT_SCOPE: MetadataDocumentScope = { scope: "all" }
const OCR_WAIT_SUPERSEDED_ERROR_NAME = "OcrWaitSupersededError"

function ocrWaitSupersededError(): Error {
  const error = new Error(
    "Quá trình theo dõi OCR trước đó đã được lần xử lý mới tiếp quản."
  )
  error.name = OCR_WAIT_SUPERSEDED_ERROR_NAME
  return error
}

function ocrWaitInterruptedError(
  token: number,
  supersededTokens: ReadonlySet<number>
): Error {
  return supersededTokens.has(token)
    ? ocrWaitSupersededError()
    : new Error("Đã hủy quá trình chờ kết quả OCR.")
}

export function isOcrWaitSupersededError(error: unknown): boolean {
  return (
    error instanceof Error && error.name === OCR_WAIT_SUPERSEDED_ERROR_NAME
  )
}

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
  setDocumentPageSize: (pageSize: number) => void
  metadataDocumentScope: MetadataDocumentScope
  setMetadataDocumentScope: (scope: MetadataDocumentScope) => void
  restartMetadata: (documentId: number) => Promise<SessionDocumentResponse>
  mergeVerifiedDocuments: (documents: SessionDocumentResponse[]) => void
  reset: () => void
}

interface UseOcrFolderOptions {
  enabled?: boolean
  clearOnDisable?: boolean
}

interface CachedDocumentRange {
  offset: number
  limit: number
}

interface DocumentRangeCache {
  jobsByOffset: Map<number, JobSummary>
  status: FolderStatusResponse | null
  total: number | null
  documentsRevision: string | null
}

export function useOcrFolder(
  sessionId: string | null,
  { enabled = true, clearOnDisable = false }: UseOcrFolderOptions = {}
): UseOcrFolderResult {
  const [state, setState] = useState<OcrFolderState>("idle")
  const [status, setStatus] = useState<FolderStatusResponse | null>(null)
  const statusRef = useRef<FolderStatusResponse | null>(null)
  const [error, setError] = useState("")
  const [documentPageIndex, setDocumentPageIndexState] = useState(0)
  const documentPageIndexRef = useRef(0)
  const [metadataDocumentScope, setMetadataDocumentScopeState] =
    useState<MetadataDocumentScope>(DEFAULT_METADATA_DOCUMENT_SCOPE)
  const [documentPageSize, setDocumentPageSizeState] = useState(() =>
    readStoredDocumentPageSize()
  )
  const documentPageSizeRef = useRef(documentPageSize)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const existingStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const tokenRef = useRef(0)
  const rejectRef = useRef<((error: Error) => void) | null>(null)
  const supersededTokensRef = useRef<Set<number>>(new Set())
  const pendingStartRef = useRef<PendingStartContext | null>(null)
  const manualOperationTokenRef = useRef<number | null>(null)
  const documentPageCacheSessionRef = useRef<string | null>(null)
  const documentPageCacheRef = useRef<DocumentRangeCache>(
    createDocumentRangeCache()
  )
  const prefetchingDocumentRangesRef = useRef<Set<string>>(new Set())
  const metadataDocumentScopeRequestKeyRef = useRef("all")
  const metadataDocumentScopeStateKeyRef = useRef("all")
  const metadataDocumentScopeRef = useRef<MetadataDocumentScope>(
    DEFAULT_METADATA_DOCUMENT_SCOPE
  )
  const lastDocumentRefreshSignatureRef = useRef("")
  const lastDocumentRefreshAtRef = useRef(0)

  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    documentPageSizeRef.current = documentPageSize
  }, [documentPageSize])

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
    const nextPageIndex = Math.max(0, Math.floor(Number(pageIndex) || 0))
    documentPageIndexRef.current = nextPageIndex
    setDocumentPageIndexState(nextPageIndex)
  }, [])

  const setDocumentPageSize = useCallback((pageSize: number) => {
    const nextPageSize = normalizeDocumentPageSize(pageSize)
    documentPageSizeRef.current = nextPageSize
    writeStoredDocumentPageSize(nextPageSize)
    setDocumentPageSizeState((current) =>
      current === nextPageSize ? current : nextPageSize
    )
    documentPageIndexRef.current = 0
    setDocumentPageIndexState(0)
    prefetchingDocumentRangesRef.current.clear()
    setStatus((current) => {
      if (!current) return current
      const cachedStatus = getCachedDocumentRangeStatus(
        documentPageCacheRef.current,
        { offset: 0, limit: nextPageSize }
      )
      return cachedStatus
        ? mergeCachedDocumentPage(current, cachedStatus)
        : current
    })
  }, [])

  const setMetadataDocumentScope = useCallback(
    (scope: MetadataDocumentScope) => {
      const nextScope = normalizeMetadataDocumentScope(scope)
      const nextScopeKey = metadataDocumentScopeKey(nextScope)
      if (metadataDocumentScopeStateKeyRef.current === nextScopeKey) return
      metadataDocumentScopeStateKeyRef.current = nextScopeKey
      metadataDocumentScopeRef.current = nextScope
      clearDocumentRangeCache(documentPageCacheRef.current)
      prefetchingDocumentRangesRef.current.clear()
      lastDocumentRefreshSignatureRef.current = ""
      lastDocumentRefreshAtRef.current = 0
      documentPageIndexRef.current = 0
      setDocumentPageIndexState(0)
      setStatus((current) =>
        current ? { ...current, jobs: [], pagination: undefined } : current
      )
      setMetadataDocumentScopeState(nextScope)
    },
    []
  )

  useEffect(() => {
    if (documentPageCacheSessionRef.current === sessionId) return
    documentPageCacheSessionRef.current = sessionId
    clearDocumentRangeCache(documentPageCacheRef.current)
    prefetchingDocumentRangesRef.current.clear()
    lastDocumentRefreshSignatureRef.current = ""
    lastDocumentRefreshAtRef.current = 0
    metadataDocumentScopeRequestKeyRef.current = "all"
    metadataDocumentScopeStateKeyRef.current = "all"
    metadataDocumentScopeRef.current = DEFAULT_METADATA_DOCUMENT_SCOPE
    documentPageIndexRef.current = 0
    setDocumentPageIndexState(0)
    setMetadataDocumentScopeState(DEFAULT_METADATA_DOCUMENT_SCOPE)
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

  const fetchDocumentRangeStatus = useCallback(
    async ({ offset, limit }: CachedDocumentRange) => {
      if (!sessionId) return null
      const requestScope = metadataDocumentScopeRef.current
      const requestScopeKey = metadataDocumentScopeKey(requestScope)
      const result = await getDigitizationStatus(sessionId, {
        includeDocuments: true,
        summaryOnly: false,
        limit,
        offset,
        metadataDocumentScope: requestScope,
      })
      if (metadataDocumentScopeStateKeyRef.current !== requestScopeKey) {
        return null
      }
      const fallbackFolderPath =
        result?.batches[0]?.folder_path ?? status?.folder_path ?? ""
      return {
        result,
        status: digitizationToFolderStatus(result, fallbackFolderPath),
      }
    },
    [sessionId, status?.folder_path]
  )

  const prefetchDocumentPage = useCallback(
    async (pageIndex: number) => {
      if (!sessionId) return
      const pageSize = documentPageSizeRef.current
      const targetRange = { offset: pageIndex * pageSize, limit: pageSize }
      const missingRanges = missingDocumentRanges(
        documentPageCacheRef.current,
        targetRange
      )
      if (missingRanges.length === 0) return

      try {
        for (const missingRange of missingRanges) {
          const rangeKey = documentRangeKey(missingRange)
          if (prefetchingDocumentRangesRef.current.has(rangeKey)) continue
          prefetchingDocumentRangesRef.current.add(rangeKey)
          try {
            const fetched = await fetchDocumentRangeStatus(missingRange)
            if (fetched) {
              cacheDocumentRange(documentPageCacheRef.current, fetched.status)
            }
          } finally {
            prefetchingDocumentRangesRef.current.delete(rangeKey)
          }
        }
      } catch {
        // Prefetch is opportunistic; visible page loading handles real errors.
      }
    },
    [fetchDocumentRangeStatus, sessionId]
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
      const pageSize = documentPageSizeRef.current
      const pageIndex = Math.max(
        0,
        Math.floor(Number(options.pageIndex ?? documentPageIndex) || 0)
      )
      if (options.pageIndex !== undefined) {
        documentPageIndexRef.current = pageIndex
        setDocumentPageIndexState(pageIndex)
      }
      if (options.force) {
        clearDocumentRangeCache(documentPageCacheRef.current)
        prefetchingDocumentRangesRef.current.clear()
      }
      const targetRange = { offset: pageIndex * pageSize, limit: pageSize }
      const cachedStatus =
        !options.force && !status?.reextracting
          ? getCachedDocumentRangeStatus(
              documentPageCacheRef.current,
              targetRange
            )
          : null

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

      let latestResult: Awaited<ReturnType<typeof getDigitizationStatus>> = null
      const missingRanges =
        options.force || status?.reextracting
          ? [targetRange]
          : missingDocumentRanges(documentPageCacheRef.current, targetRange)
      for (const missingRange of missingRanges) {
        const fetched = await fetchDocumentRangeStatus(missingRange)
        if (!fetched) return null
        latestResult = fetched.result
        cacheDocumentRange(documentPageCacheRef.current, fetched.status)
      }
      let nextStatus = getCachedDocumentRangeStatus(
        documentPageCacheRef.current,
        targetRange
      )
      if (
        !nextStatus &&
        !(
          missingRanges.length === 1 &&
          sameDocumentRange(missingRanges[0], targetRange)
        )
      ) {
        const fetched = await fetchDocumentRangeStatus(targetRange)
        if (!fetched) return null
        latestResult = fetched.result
        cacheDocumentRange(documentPageCacheRef.current, fetched.status)
        nextStatus =
          getCachedDocumentRangeStatus(
            documentPageCacheRef.current,
            targetRange
          ) ?? fetched.status
      }
      if (!nextStatus) return null
      setStatus((current) => {
        if (!current?.reextracting) return nextStatus
        return {
          ...nextStatus,
          total_files: Math.max(current.total_files, nextStatus.total_files),
          total_jobs: Math.max(current.total_jobs, nextStatus.total_jobs),
          pagination: nextStatus.pagination,
          reextracting: !isMetadataExtractionComplete(latestResult),
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
      fetchDocumentRangeStatus,
      prefetchDocumentPage,
      sessionId,
      status?.reextracting,
    ]
  )

  const refreshDocumentsPageRef = useRef(refreshDocumentsPage)
  useEffect(() => {
    refreshDocumentsPageRef.current = refreshDocumentsPage
  }, [refreshDocumentsPage])

  const refreshDocumentsForStatus = useCallback(
    (
      result: Awaited<ReturnType<typeof getDigitizationStatus>>,
      options: { force?: boolean } = {}
    ) => {
      if (!result) return
      const totalDocuments = digitizationStatusDocumentTotal(result)
      if (totalDocuments <= 0) return

      const signature = digitizationStatusRefreshSignature(result)
      const serverDocumentsRevision = revisionToken(result.documents_revision)
      const now = Date.now()
      const hasVisibleDocuments = (statusRef.current?.jobs.length ?? 0) > 0
      const shouldRefresh =
        options.force ||
        !hasVisibleDocuments ||
        signature !== lastDocumentRefreshSignatureRef.current ||
        (serverDocumentsRevision === null &&
          now - lastDocumentRefreshAtRef.current >=
            OCR_DOCUMENT_REFRESH_MIN_INTERVAL_MS)
      if (!shouldRefresh) return

      lastDocumentRefreshSignatureRef.current = signature
      lastDocumentRefreshAtRef.current = now
      void refreshDocumentsPageRef.current({ force: true })
    },
    []
  )

  useEffect(() => {
    const scopeKey = metadataDocumentScopeKey(metadataDocumentScope)
    if (metadataDocumentScopeRequestKeyRef.current === scopeKey) return
    metadataDocumentScopeRequestKeyRef.current = scopeKey
    void refreshDocumentsPage({ pageIndex: 0, force: true })
  }, [metadataDocumentScope, refreshDocumentsPage])

  const pollUntilComplete = useCallback(
    (token: number, fallbackFolderPath: string) => {
      const poll = async () => {
        if (tokenRef.current !== token) return
        try {
          if (!sessionId) return
          if (document.visibilityState === "hidden") {
            timeoutRef.current = setTimeout(
              poll,
              visibleAwareDelay(OCR_POLL_INTERVAL_MS)
            )
            return
          }
          const requestScope = metadataDocumentScopeRef.current
          const requestScopeKey = metadataDocumentScopeKey(requestScope)
          const pageSize = documentPageSizeRef.current
          const result = await getDigitizationStatus(sessionId, {
            includeDocuments: false,
            summaryOnly: true,
            limit: pageSize,
            offset: documentPageIndexRef.current * pageSize,
            metadataDocumentScope: requestScope,
          })
          if (metadataDocumentScopeStateKeyRef.current !== requestScopeKey) {
            timeoutRef.current = setTimeout(
              poll,
              visibleAwareDelay(OCR_POLL_INTERVAL_MS)
            )
            return
          }
          applyStatusResult(result, fallbackFolderPath, {
            preserveDocuments: true,
          })
          setError("")
          const complete = isDigitizationComplete(result)
          refreshDocumentsForStatus(result, { force: complete })
          if (complete) {
            stop()
            setState("done")
            return
          }
          setState(
            isMetadataExtractionComplete(result) ? "metadata_ready" : "polling"
          )
          timeoutRef.current = setTimeout(
            poll,
            visibleAwareDelay(OCR_POLL_INTERVAL_MS)
          )
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
      refreshDocumentsForStatus,
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
    supersededTokensRef.current.clear()
    manualOperationTokenRef.current = null
    pendingStartRef.current = null
    clearDocumentRangeCache(documentPageCacheRef.current)
    prefetchingDocumentRangesRef.current.clear()
    lastDocumentRefreshSignatureRef.current = ""
    lastDocumentRefreshAtRef.current = 0
    setState("idle")
    setStatus(null)
    setError("")
    documentPageIndexRef.current = 0
    setDocumentPageIndexState(0)
    metadataDocumentScopeRequestKeyRef.current = "all"
    metadataDocumentScopeStateKeyRef.current = "all"
    metadataDocumentScopeRef.current = DEFAULT_METADATA_DOCUMENT_SCOPE
    setMetadataDocumentScopeState(DEFAULT_METADATA_DOCUMENT_SCOPE)
  }, [stop])

  const refresh = useCallback(async (options: OcrRefreshOptions = {}) => {
    if (!sessionId) {
      pendingStartRef.current = null
      clearDocumentRangeCache(documentPageCacheRef.current)
      prefetchingDocumentRangesRef.current.clear()
      setState("idle")
      setStatus(null)
      setError("")
      metadataDocumentScopeRequestKeyRef.current = "all"
      metadataDocumentScopeStateKeyRef.current = "all"
      metadataDocumentScopeRef.current = DEFAULT_METADATA_DOCUMENT_SCOPE
      setMetadataDocumentScopeState(DEFAULT_METADATA_DOCUMENT_SCOPE)
      return null
    }

    const includeDocuments = options.includeDocuments ?? false
    const pageSize = documentPageSizeRef.current
    const pageLimit =
      includeDocuments && options.limit === undefined
        ? pageSize
        : options.limit
    const pageOffset =
      includeDocuments && options.offset === undefined
        ? documentPageIndexRef.current * pageSize
        : options.offset
    const requestScope = metadataDocumentScopeRef.current
    const requestScopeKey = metadataDocumentScopeKey(requestScope)
    const result = await getDigitizationStatus(sessionId, {
      includeDocuments,
      summaryOnly: options.summaryOnly ?? !includeDocuments,
      limit: pageLimit,
      offset: pageOffset,
      metadataDocumentScope: requestScope,
    })
    if (metadataDocumentScopeStateKeyRef.current !== requestScopeKey) {
      return null
    }
    const fallbackFolderPath = result?.batches[0]?.folder_path ?? ""
    if (!hasDigitizationWork(result)) {
      stop()
      tokenRef.current += 1
      pendingStartRef.current = null
      clearDocumentRangeCache(documentPageCacheRef.current)
      prefetchingDocumentRangesRef.current.clear()
      setState("idle")
      setStatus(null)
      setError("")
      metadataDocumentScopeRequestKeyRef.current = "all"
      metadataDocumentScopeStateKeyRef.current = "all"
      metadataDocumentScopeRef.current = DEFAULT_METADATA_DOCUMENT_SCOPE
      setMetadataDocumentScopeState(DEFAULT_METADATA_DOCUMENT_SCOPE)
      return null
    }

    const nextStatus = applyStatusResult(result, fallbackFolderPath, {
      preserveDocuments: !includeDocuments,
    })
    if (includeDocuments) {
      cacheDocumentRange(documentPageCacheRef.current, nextStatus)
    }
    setError("")
    const complete = isDigitizationComplete(result)
    refreshDocumentsForStatus(result, { force: includeDocuments || complete })
    if (complete) {
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
    pollUntilComplete,
    refreshDocumentsForStatus,
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
      updateCachedDocumentJobs(documentPageCacheRef.current, documentsById)

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
      if (manualOperationTokenRef.current !== null) {
        supersededTokensRef.current.add(manualOperationTokenRef.current)
      }
      rejectRef.current?.(ocrWaitSupersededError())
      rejectRef.current = null
      const token = tokenRef.current + 1
      tokenRef.current = token
      manualOperationTokenRef.current = null
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
      if (manualOperationTokenRef.current !== null) return
      stop()
      tokenRef.current += 1
      pendingStartRef.current = null
      rejectRef.current = null
      supersededTokensRef.current.clear()
      if (clearOnDisable) {
        const disableToken = tokenRef.current
        clearDocumentRangeCache(documentPageCacheRef.current)
        prefetchingDocumentRangesRef.current.clear()
        queueMicrotask(() => {
          if (tokenRef.current !== disableToken) return
          setState("idle")
          setStatus(null)
          setError("")
        })
      }
      return
    }

    if (manualOperationTokenRef.current !== null) return

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
      if (document.visibilityState === "hidden") {
        existingStatusTimeoutRef.current = setTimeout(
          pollExistingStatus,
          visibleAwareDelay(OCR_POLL_INTERVAL_MS)
        )
        return
      }
      try {
        const requestScope = metadataDocumentScopeRef.current
        const requestScopeKey = metadataDocumentScopeKey(requestScope)
        const pageSize = documentPageSizeRef.current
        const result = await getDigitizationStatus(sessionId, {
          includeDocuments: false,
          summaryOnly: true,
          limit: pageSize,
          offset: documentPageIndexRef.current * pageSize,
          metadataDocumentScope: requestScope,
        })
        if (tokenRef.current !== token) return
        if (metadataDocumentScopeStateKeyRef.current !== requestScopeKey) {
          existingStatusTimeoutRef.current = setTimeout(
            pollExistingStatus,
            visibleAwareDelay(OCR_POLL_INTERVAL_MS)
          )
          return
        }

        const fallbackFolderPath = result?.batches[0]?.folder_path ?? ""
        if (!hasDigitizationWork(result)) {
          pendingStartRef.current = null
          clearDocumentRangeCache(documentPageCacheRef.current)
          prefetchingDocumentRangesRef.current.clear()
          setStatus(null)
          setError("")
          if (emptyStatusRetries < OCR_EMPTY_STATUS_RETRY_LIMIT) {
            emptyStatusRetries += 1
            setState("polling")
            existingStatusTimeoutRef.current = setTimeout(
              pollExistingStatus,
              visibleAwareDelay(OCR_POLL_INTERVAL_MS)
            )
            return
          }
          setState("idle")
          return
        }
        emptyStatusRetries = 0

        applyStatusResult(result, fallbackFolderPath, {
          preserveDocuments: true,
        })
        setError("")
        const complete = isDigitizationComplete(result)
        refreshDocumentsForStatus(result, { force: complete })
        if (complete) {
          setState("done")
          return
        }

        setState(
          isMetadataExtractionComplete(result) ? "metadata_ready" : "polling"
        )
        existingStatusTimeoutRef.current = setTimeout(
          pollExistingStatus,
          visibleAwareDelay(OCR_POLL_INTERVAL_MS)
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
          visibleAwareDelay(OCR_POLL_RETRY_INTERVAL_MS)
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
    enabled,
    refreshDocumentsForStatus,
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
      if (manualOperationTokenRef.current !== null) {
        supersededTokensRef.current.add(manualOperationTokenRef.current)
      }
      rejectRef.current?.(ocrWaitSupersededError())
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
      clearDocumentRangeCache(documentPageCacheRef.current)
      prefetchingDocumentRangesRef.current.clear()
      manualOperationTokenRef.current = token
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
        if (tokenRef.current !== token) {
          const interruption = ocrWaitInterruptedError(
            token,
            supersededTokensRef.current
          )
          supersededTokensRef.current.delete(token)
          throw interruption
        }
        pendingStartRef.current = null
        if (manualOperationTokenRef.current === token) {
          manualOperationTokenRef.current = null
        }
        setState("error")
        setError(
          err instanceof Error ? err.message : "KhÃ´ng thá»ƒ báº¯t Ä‘áº§u OCR."
        )
        throw err
      }
      if (tokenRef.current !== token) {
        const interruption = ocrWaitInterruptedError(
          token,
          supersededTokensRef.current
        )
        supersededTokensRef.current.delete(token)
        throw interruption
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
              rejectPolling(
                ocrWaitInterruptedError(token, supersededTokensRef.current)
              )
              return
            }
            if (document.visibilityState === "hidden") {
              timeoutRef.current = setTimeout(
                poll,
                visibleAwareDelay(OCR_POLL_INTERVAL_MS)
              )
              return
            }
            try {
              const requestScope = metadataDocumentScopeRef.current
              const requestScopeKey = metadataDocumentScopeKey(requestScope)
              const pageSize = documentPageSizeRef.current
              const result = await getDigitizationStatus(sessionId, {
                includeDocuments: false,
                summaryOnly: true,
                limit: pageSize,
                offset: documentPageIndexRef.current * pageSize,
                metadataDocumentScope: requestScope,
              })
              if (
                metadataDocumentScopeStateKeyRef.current !== requestScopeKey
              ) {
                timeoutRef.current = setTimeout(
                  poll,
                  visibleAwareDelay(OCR_POLL_INTERVAL_MS)
                )
                return
              }
              const pendingStart = pendingStartRef.current
              if (
                pendingStart &&
                !hasExpectedStartedBatch(result, pendingStart)
              ) {
                setError("")
                setState("polling")
                timeoutRef.current = setTimeout(
                  poll,
                  visibleAwareDelay(OCR_POLL_INTERVAL_MS)
                )
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
              refreshDocumentsForStatus(result, { force: complete })
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
              timeoutRef.current = setTimeout(
                poll,
                visibleAwareDelay(OCR_POLL_INTERVAL_MS)
              )
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
        supersededTokensRef.current.delete(token)
        if (manualOperationTokenRef.current === token) {
          manualOperationTokenRef.current = null
        }
      }
    },
    [
      refreshDocumentsForStatus,
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
    setDocumentPageSize,
    metadataDocumentScope,
    setMetadataDocumentScope,
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
        result.ingestion_runs.length > 0 ||
        result.documents.length > 0 ||
        (result.summary?.total_documents ?? 0) > 0)
  )
}

function digitizationStatusDocumentTotal(
  result: Awaited<ReturnType<typeof getDigitizationStatus>>
): number {
  if (!result) return 0
  return Math.max(
    result.documents.length,
    result.summary?.total_documents ?? 0,
    statusCountTotal(result.summary?.status_counts),
    ...result.batches.map((batch) => {
      const expectedTotal = Math.max(
        batch.total_files ?? 0,
        batch.total_jobs ?? 0
      )
      return expectedTotal > 0
        ? expectedTotal
        : statusCountTotal(batch.status_counts)
    })
  )
}

function digitizationStatusRefreshSignature(
  result: Awaited<ReturnType<typeof getDigitizationStatus>>
): string {
  if (!result) return ""
  const documentsRevision = revisionToken(result.documents_revision)
  if (documentsRevision !== null) return `documents:${documentsRevision}`
  return JSON.stringify({
    summary: {
      total_documents: result.summary?.total_documents ?? 0,
      status_counts: result.summary?.status_counts ?? {},
      metadata_ready: result.summary?.metadata_ready ?? null,
      metadata_final: result.summary?.metadata_final ?? null,
      metadata_usable_documents:
        result.summary?.metadata_usable_documents ?? null,
      complete_documents: result.summary?.complete_documents ?? null,
      processing_documents: result.summary?.processing_documents ?? null,
      failed_documents: result.summary?.failed_documents ?? null,
      verified: result.summary?.verified ?? null,
      reviewed: result.summary?.reviewed ?? null,
      warning: result.summary?.warning ?? null,
    },
    batches: result.batches.map((batch) => ({
      id: batch.id,
      status: batch.status,
      total_files: batch.total_files ?? 0,
      total_jobs: batch.total_jobs ?? 0,
      status_counts: batch.status_counts ?? {},
    })),
    ingestion_runs: result.ingestion_runs.map((run) => ({
      id: run.id,
      status: run.status,
      total_pdf_files: run.total_pdf_files ?? 0,
      extracted_count: run.extracted_count ?? 0,
      skipped_count: run.skipped_count ?? 0,
      updated_at: run.updated_at ?? null,
    })),
  })
}

function revisionToken(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value))
  }
  if (typeof value === "string") {
    const text = value.trim()
    return text || null
  }
  return null
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

function createDocumentRangeCache(): DocumentRangeCache {
  return {
    jobsByOffset: new Map(),
    status: null,
    total: null,
    documentsRevision: null,
  }
}

function clearDocumentRangeCache(cache: DocumentRangeCache) {
  cache.jobsByOffset.clear()
  cache.status = null
  cache.total = null
  cache.documentsRevision = null
}

function cacheDocumentRange(
  cache: DocumentRangeCache,
  status: FolderStatusResponse
) {
  const nextRevision = revisionToken(status.documents_revision)
  if (
    cache.documentsRevision &&
    nextRevision &&
    cache.documentsRevision !== nextRevision
  ) {
    clearDocumentRangeCache(cache)
  }

  const offset = normalizedDocumentRangeOffset(status)
  status.jobs.forEach((job, index) => {
    cache.jobsByOffset.set(offset + index, job)
  })
  cache.status = status
  cache.total = documentRangeTotal(status)
  cache.documentsRevision = nextRevision ?? cache.documentsRevision
}

function getCachedDocumentRangeStatus(
  cache: DocumentRangeCache,
  range: CachedDocumentRange
): FolderStatusResponse | null {
  if (!cache.status) return null
  const total = cache.total ?? documentRangeTotal(cache.status)
  const offset = Math.max(0, Math.floor(Number(range.offset) || 0))
  const limit = Math.max(1, Math.floor(Number(range.limit) || 1))
  const end = total === null ? offset + limit : Math.min(offset + limit, total)
  const jobs: JobSummary[] = []

  for (let index = offset; index < end; index += 1) {
    const job = cache.jobsByOffset.get(index)
    if (!job) return null
    jobs.push(job)
  }

  return {
    ...cache.status,
    jobs,
    pagination: documentRangePagination(cache.status, {
      offset,
      limit,
      returned: jobs.length,
      total,
    }),
  }
}

function missingDocumentRanges(
  cache: DocumentRangeCache,
  range: CachedDocumentRange
): CachedDocumentRange[] {
  const offset = Math.max(0, Math.floor(Number(range.offset) || 0))
  const limit = Math.max(1, Math.floor(Number(range.limit) || 1))
  const total = cache.total ?? (cache.status ? documentRangeTotal(cache.status) : null)
  const end = total === null ? offset + limit : Math.min(offset + limit, total)
  const ranges: CachedDocumentRange[] = []
  let missingStart: number | null = null

  for (let index = offset; index < end; index += 1) {
    if (!cache.jobsByOffset.has(index)) {
      missingStart ??= index
      continue
    }
    if (missingStart !== null) {
      ranges.push({ offset: missingStart, limit: index - missingStart })
      missingStart = null
    }
  }

  if (missingStart !== null) {
    ranges.push({ offset: missingStart, limit: end - missingStart })
  }
  return ranges
}

function updateCachedDocumentJobs(
  cache: DocumentRangeCache,
  documentsById: Map<number, JobSummary>
) {
  for (const [offset, job] of cache.jobsByOffset) {
    const nextJob = documentsById.get(job.id)
    if (nextJob) {
      cache.jobsByOffset.set(offset, nextJob)
    }
  }
  if (cache.status) {
    cache.status = replaceCachedDocumentJobs(cache.status, documentsById)
  }
}

function documentRangeKey({ offset, limit }: CachedDocumentRange): string {
  return `${Math.max(0, Math.floor(Number(offset) || 0))}:${Math.max(
    1,
    Math.floor(Number(limit) || 1)
  )}`
}

function sameDocumentRange(
  left: CachedDocumentRange,
  right: CachedDocumentRange
): boolean {
  return documentRangeKey(left) === documentRangeKey(right)
}

function normalizedDocumentRangeOffset(status: FolderStatusResponse): number {
  return Math.max(0, Math.floor(Number(status.pagination?.offset ?? 0) || 0))
}

function documentRangeTotal(status: FolderStatusResponse): number | null {
  const total = Number(
    status.pagination?.total ??
      Math.max(status.total_files, status.total_jobs, status.jobs.length)
  )
  return Number.isFinite(total) ? Math.max(0, Math.floor(total)) : null
}

function documentRangePagination(
  status: FolderStatusResponse,
  {
    offset,
    limit,
    returned,
    total,
  }: {
    offset: number
    limit: number
    returned: number
    total: number | null
  }
): FolderStatusResponse["pagination"] {
  const paginationTotal = total ?? Math.max(offset + returned, status.jobs.length)
  const nextOffset = offset + returned
  const hasMore = nextOffset < paginationTotal
  return {
    ...status.pagination,
    total: paginationTotal,
    limit,
    offset,
    returned,
    has_more: hasMore,
    next_offset: hasMore ? nextOffset : null,
  }
}

function mergeCachedDocumentPage(
  current: FolderStatusResponse | null,
  cached: FolderStatusResponse
): FolderStatusResponse {
  if (!current) return cached
  return {
    ...cached,
    revision: current.revision,
    documents_revision: current.documents_revision,
    updated_at: current.updated_at,
    last_event_id: current.last_event_id,
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
    metadata_batches: current.metadata_batches,
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
  const total =
    status.pagination?.total ??
    Math.max(status.total_files, status.total_jobs, status.jobs.length)
  const nextPageIndex = pageIndex + 1
  return nextPageIndex * pageSize < total ? nextPageIndex : null
}

function normalizeMetadataDocumentScope(
  scope: MetadataDocumentScope
): MetadataDocumentScope {
  if (scope.scope === "batch") {
    return {
      scope: "batch",
      batchId: String(scope.batchId ?? "").trim(),
    }
  }
  if (scope.scope === "auto") {
    return {
      scope: "auto",
      offset: Math.max(0, Math.floor(Number(scope.offset) || 0)),
      size: Math.max(1, Math.floor(Number(scope.size) || 1)),
    }
  }
  if (scope.scope === "reviewed" || scope.scope === "unassigned") {
    return { scope: scope.scope }
  }
  return DEFAULT_METADATA_DOCUMENT_SCOPE
}

function metadataDocumentScopeKey(scope: MetadataDocumentScope): string {
  if (scope.scope === "batch") {
    return `batch:${String(scope.batchId ?? "").trim()}`
  }
  if (scope.scope === "auto") {
    return `auto:${Math.max(0, Math.floor(Number(scope.offset) || 0))}:${Math.max(
      1,
      Math.floor(Number(scope.size) || 1)
    )}`
  }
  return scope.scope
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
  job: Pick<JobSummary, "status" | "remote_metadata_status" | "metadata_ready">
) {
  return (
    !job.metadata_ready && METADATA_RUNNING_JOB_STATUSES.has(metadataJobStatus(job))
  )
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

function readStoredDocumentPageSize(): number {
  if (typeof window === "undefined") return OCR_DOCUMENT_DEFAULT_PAGE_SIZE
  try {
    const storedValue = window.localStorage.getItem(
      OCR_DOCUMENT_PAGE_SIZE_STORAGE_KEY
    )
    return storedValue === null
      ? OCR_DOCUMENT_DEFAULT_PAGE_SIZE
      : normalizeDocumentPageSize(Number(storedValue))
  } catch {
    return OCR_DOCUMENT_DEFAULT_PAGE_SIZE
  }
}

function writeStoredDocumentPageSize(pageSize: number) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(
      OCR_DOCUMENT_PAGE_SIZE_STORAGE_KEY,
      String(normalizeDocumentPageSize(pageSize))
    )
  } catch {
    // Some browsers block localStorage in restricted contexts.
  }
}

function normalizeDocumentPageSize(pageSize: number): number {
  const numericValue = Math.floor(Number(pageSize))
  if (!Number.isFinite(numericValue)) return OCR_DOCUMENT_DEFAULT_PAGE_SIZE
  return Math.min(
    OCR_DOCUMENT_MAX_PAGE_SIZE,
    Math.max(OCR_DOCUMENT_MIN_PAGE_SIZE, numericValue)
  )
}
