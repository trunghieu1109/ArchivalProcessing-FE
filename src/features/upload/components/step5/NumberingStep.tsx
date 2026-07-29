import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Loader2,
  RotateCcw,
  Search,
  Target,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/features/auth/lib/AuthContext"
import { visibleAwareDelay } from "@/shared/lib/pageVisibility"
import { ProgressTimeline } from "@/features/upload/components/ProgressTimeline"
import { PaginationControls } from "@/features/upload/components/PaginationControls"
import {
  downloadArtifact,
  applyNumberingState,
  discardNumberingState,
  enqueueDocumentNumbering,
  exportMetadataSnapshot,
  clearMetadataBoxNumberPendingCounts,
  getDocumentNumberingStatus,
  getDocumentPreviewUrl,
  getNumberedDocumentPreviewUrl,
  getNumberingStyles,
  getNumberingState,
  importMetadataBoxNumbers as importMetadataBoxNumbersApi,
  patchSessionDossier,
  saveNumberingState,
  updateDocumentNumberingFromPage,
  type DocumentNumberingMode,
  type DocumentNumberingStylePreset,
  type MetadataBoxNumberImportResponse,
  type MetadataCountConflict,
  type MetadataExportMode,
  type NumberingDocumentStatus,
  type SessionDossierPatchPayload,
  type NumberingStatusResponse,
  type NumberingStateDetailResponse,
  type NumberingStyleOption,
} from "@/features/upload/api/sessionApi"
import {
  DossierNumberingModeToggle,
  DossierMetaChip,
  NumberingDocumentRow,
  NumberingMetadataPanel,
  NumberingStat,
  NumberingStepFooter,
  NumberingStepHeader,
  NumberingTimelineControls,
  NumberingTimelineWorkingActions,
  type DossierUpdateMode,
  type NumberingUpdateMode,
} from "./NumberingStep.parts"
import { NumberedPdfPreviewPanel } from "./NumberingStep.preview"
import {
  canPreviewNumberingDocument,
  groupDocumentsByDossier,
  isNumberingComplete,
  mergeCachedNumberingPage,
  mergeNumberingSummaryResponse,
  numberingEntries,
  saveBlob,
  statusBadge,
  textOrNull,
} from "./NumberingStep.utils"
import { SHOW_METADATA_COUNT_CONFLICT_WARNING } from "../step4/temporaryFeatureVisibility"

const NUMBERING_POLL_INTERVAL_MS = 5_000
const NUMBERING_DOCUMENT_REFRESH_EVERY = 3
const NUMBERING_PAGE_SIZE = 10
const NUMBERING_NAVIGATOR_PAGE_SIZE = 1000
const EMPTY_NUMBERING_DOCUMENTS: NumberingDocumentStatus[] = []
type MetadataImportReview = {
  file: File
  response: MetadataBoxNumberImportResponse
}
type NumberingStyleOverrides = {
  font_size?: number
  color?: string
  opacity?: number
}
const NUMBERING_PROGRESS_PHASES = [
  { id: "loading_data", label: "Chuẩn bị hồ sơ" },
  { id: "rendering_document", label: "Đánh số PDF" },
  { id: "completed", label: "Hoàn tất" },
]
const FALLBACK_NUMBERING_STYLE_OPTIONS: NumberingStyleOption[] = [
  {
    style_preset: "pencil_miama",
    font_family: "Miama Nueva",
    font_style: "italic",
    font_weight: "normal",
    font_size: 14,
    color: "#757573",
    opacity: 0.75,
    display_name: "Bút chì Miama",
    description: "Đánh số bằng bút chì, nét viết tay mềm.",
  },
  {
    style_preset: "pencil_bradley",
    font_family: "Bradley Hand ITC",
    font_style: "normal",
    font_weight: "normal",
    font_size: 14,
    color: "#767570",
    opacity: 0.75,
    display_name: "Bút chì Bradley",
    description: "Đánh số bằng bút chì, nét rõ và dễ nhìn hơn.",
  },
  {
    style_preset: "stamp_times_bold",
    font_family: "Times New Roman",
    font_style: "normal",
    font_weight: "bold",
    font_size: 16,
    color: "#3D3D3B",
    opacity: 1,
    display_name: "Dập in",
    description: "Đánh số bằng kiểu dập in, chữ đậm và sắc nét.",
  },
]

interface NumberingStepProps {
  sessionId: string | null
  documentNumberingMode: DocumentNumberingMode
  onDocumentNumberingModeApplied?: (mode: DocumentNumberingMode) => void
  documentNumberingStylePreset: DocumentNumberingStylePreset
  documentNumberingStyleOverrides?: NumberingStyleOverrides
  onDocumentNumberingStyleApplied?: (
    stylePreset: DocumentNumberingStylePreset,
    overrides: NumberingStyleOverrides
  ) => void
  autoStart?: boolean
  onAutoStartHandled?: () => void
  onContinue: () => void
}

export function NumberingStep({
  sessionId,
  documentNumberingMode,
  onDocumentNumberingModeApplied,
  documentNumberingStylePreset,
  documentNumberingStyleOverrides,
  onDocumentNumberingStyleApplied,
  autoStart = false,
  onAutoStartHandled,
  onContinue,
}: NumberingStepProps) {
  const { user } = useAuth()
  const currentUserRole = String(user?.role ?? "")
    .trim()
    .toLowerCase()
  const canManageNumbering =
    currentUserRole === "admin" || currentUserRole === "coordinator"
  const autoStartedSessionRef = useRef<string | null>(null)
  const [status, setStatus] = useState<NumberingStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [timelineMutating, setTimelineMutating] = useState(false)
  const [viewedNumberingState, setViewedNumberingState] =
    useState<NumberingStateDetailResponse | null>(null)
  const changingMode = false
  const [numberingModeDraft, setNumberingModeDraft] =
    useState<DocumentNumberingMode>(documentNumberingMode)
  const [numberingModeDraftDirty, setNumberingModeDraftDirty] = useState(false)
  const numberingModeDraftSessionRef = useRef<string | null>(null)
  const [stylePresetDraft, setStylePresetDraft] =
    useState<DocumentNumberingStylePreset>(documentNumberingStylePreset)
  const [styleOverridesDraft, setStyleOverridesDraft] =
    useState<NumberingStyleOverrides>(() =>
      cleanNumberingStyleOverrides(documentNumberingStyleOverrides)
    )
  const [styleDraftDirty, setStyleDraftDirty] = useState(false)
  const styleDraftSessionRef = useRef<string | null>(null)
  const [numberingStyleOptions, setNumberingStyleOptions] = useState<
    NumberingStyleOption[]
  >(FALLBACK_NUMBERING_STYLE_OPTIONS)
  const [updatingDocumentId, setUpdatingDocumentId] = useState<number | null>(
    null
  )
  const [retryingDocumentId, setRetryingDocumentId] = useState<number | null>(
    null
  )
  const [error, setError] = useState("")
  const [progressPhase, setProgressPhase] = useState<string | null>(null)
  const [progressMessage, setProgressMessage] = useState("")
  const [previewDocumentId, setPreviewDocumentId] = useState<number | null>(
    null
  )
  const [previewUrl, setPreviewUrl] = useState("")
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState("")
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0)
  const previewUrlRef = useRef("")
  const previewTargetRef = useRef("")
  const [numberingFilter, setNumberingFilter] = useState("")
  const [numberingPageIndex, setNumberingPageIndex] = useState(0)
  const [missingNavigatorOpen, setMissingNavigatorOpen] = useState(false)
  const [missingNavigatorLoading, setMissingNavigatorLoading] = useState(false)
  const [missingNavigatorError, setMissingNavigatorError] = useState("")
  const [missingNavigatorDocuments, setMissingNavigatorDocuments] = useState<
    NumberingDocumentStatus[]
  >([])
  const [missingNavigatorCacheKey, setMissingNavigatorCacheKey] = useState("")
  const [missingNavigatorIndex, setMissingNavigatorIndex] = useState(0)
  const [highlightedDocumentId, setHighlightedDocumentId] = useState<
    number | null
  >(null)
  const [highlightScrollRequest, setHighlightScrollRequest] = useState(0)
  const [dossierUpdateModes, setDossierUpdateModes] = useState<
    Record<string, DossierUpdateMode>
  >({})
  const [metadataExporting, setMetadataExporting] = useState(false)
  const [metadataImporting, setMetadataImporting] = useState(false)
  const [metadataImportReview, setMetadataImportReview] =
    useState<MetadataImportReview | null>(null)
  const metadataImportInputRef = useRef<HTMLInputElement | null>(null)
  const numberingPageCacheSessionRef = useRef<string | null>(null)
  const numberingPageCacheRef = useRef<Map<number, NumberingStatusResponse>>(
    new Map()
  )
  const numberingConfigCacheKeyRef = useRef<string | null>(null)
  const prefetchingNumberingPagesRef = useRef<Set<number>>(new Set())
  const numberingDocumentsRevisionRef = useRef<string | null>(null)
  const numberingRequestGenerationRef = useRef(0)
  const timelineMutationInFlightRef = useRef(false)
  const [completedPhases, setCompletedPhases] = useState<Set<string>>(
    () => new Set()
  )
  const statusForCurrentSession =
    status?.session_id === sessionId ? status : null
  const appliedNumberingMode =
    statusForCurrentSession?.document_numbering_mode || documentNumberingMode
  const currentPlanNumberingMode = documentNumberingMode
  const appliedStylePreset =
    statusForCurrentSession?.document_numbering_style_preset ||
    documentNumberingStylePreset
  const currentPlanStylePreset = documentNumberingStylePreset
  const appliedStyleOverrides = useMemo(
    () =>
      cleanNumberingStyleOverrides(
        statusForCurrentSession
          ? statusForCurrentSession.document_numbering_style_overrides
          : documentNumberingStyleOverrides
      ),
    [documentNumberingStyleOverrides, statusForCurrentSession]
  )
  const currentPlanStyleOverrides = useMemo(
    () => cleanNumberingStyleOverrides(documentNumberingStyleOverrides),
    [documentNumberingStyleOverrides]
  )
  const hasPendingStyleChanges =
    stylePresetDraft !== appliedStylePreset ||
    !numberingStyleOverridesEqual(styleOverridesDraft, appliedStyleOverrides)
  const hasPendingNumberingModeChange =
    appliedNumberingMode !== numberingModeDraft
  const hasPendingNumberingConfigChanges =
    hasPendingStyleChanges || hasPendingNumberingModeChange
  const numberingConfigCacheKey = useMemo(
    () =>
      JSON.stringify({
        sessionId,
        numberingModeDraft,
        stylePresetDraft,
        styleOverridesDraft,
      }),
    [numberingModeDraft, sessionId, styleOverridesDraft, stylePresetDraft]
  )
  const currentMissingNavigatorCacheKey = `${sessionId ?? ""}:${
    revisionToken(status?.documents_revision) ?? ""
  }`
  const visibleMissingNavigatorDocuments =
    missingNavigatorCacheKey === currentMissingNavigatorCacheKey
      ? missingNavigatorDocuments
      : EMPTY_NUMBERING_DOCUMENTS

  useEffect(() => {
    if (numberingPageCacheSessionRef.current === sessionId) return
    numberingPageCacheSessionRef.current = sessionId
    numberingRequestGenerationRef.current += 1
    numberingPageCacheRef.current.clear()
    prefetchingNumberingPagesRef.current.clear()
    numberingDocumentsRevisionRef.current = null
    setNumberingPageIndex(0)
    setMetadataImportReview(null)
    setViewedNumberingState(null)
  }, [sessionId])

  useEffect(() => {
    const sessionChanged = styleDraftSessionRef.current !== sessionId
    if (!sessionChanged && styleDraftDirty) return
    styleDraftSessionRef.current = sessionId
    setStylePresetDraft(currentPlanStylePreset)
    setStyleOverridesDraft(currentPlanStyleOverrides)
    setStyleDraftDirty(false)
  }, [
    currentPlanStyleOverrides,
    currentPlanStylePreset,
    sessionId,
    styleDraftDirty,
  ])

  useEffect(() => {
    const sessionChanged = numberingModeDraftSessionRef.current !== sessionId
    if (!sessionChanged && numberingModeDraftDirty) return
    numberingModeDraftSessionRef.current = sessionId
    setNumberingModeDraft(currentPlanNumberingMode)
    setNumberingModeDraftDirty(false)
  }, [currentPlanNumberingMode, numberingModeDraftDirty, sessionId])

  useEffect(() => {
    let cancelled = false
    async function loadStyles() {
      if (!sessionId) {
        setNumberingStyleOptions(FALLBACK_NUMBERING_STYLE_OPTIONS)
        return
      }
      try {
        const response = await getNumberingStyles(sessionId)
        if (!cancelled && response.styles.length > 0) {
          setNumberingStyleOptions(response.styles)
        }
      } catch {
        if (!cancelled) {
          setNumberingStyleOptions(FALLBACK_NUMBERING_STYLE_OPTIONS)
        }
      }
    }
    void loadStyles()
    return () => {
      cancelled = true
    }
  }, [sessionId])

  const fetchNumberingPageStatus = useCallback(
    async (pageIndex: number) => {
      if (!sessionId) return null
      return getDocumentNumberingStatus(sessionId, {
        includeDocuments: true,
        summaryOnly: false,
        limit: NUMBERING_PAGE_SIZE,
        offset: pageIndex * NUMBERING_PAGE_SIZE,
      })
    },
    [sessionId]
  )

  const prefetchNumberingPage = useCallback(
    async (pageIndex: number) => {
      if (!sessionId) return
      if (numberingPageCacheRef.current.has(pageIndex)) return
      if (prefetchingNumberingPagesRef.current.has(pageIndex)) return

      prefetchingNumberingPagesRef.current.add(pageIndex)
      const requestGeneration = numberingRequestGenerationRef.current
      try {
        const response = await fetchNumberingPageStatus(pageIndex)
        if (
          response &&
          requestGeneration === numberingRequestGenerationRef.current
        ) {
          numberingPageCacheRef.current.set(pageIndex, response)
        }
      } catch {
        // Prefetch is best-effort; visible refreshes surface real errors.
      } finally {
        if (requestGeneration === numberingRequestGenerationRef.current) {
          prefetchingNumberingPagesRef.current.delete(pageIndex)
        }
      }
    },
    [fetchNumberingPageStatus, sessionId]
  )

  const refreshStatus = useCallback(
    async (
      options: {
        silent?: boolean
        includeDocuments?: boolean
        pageIndex?: number
        force?: boolean
        deferApply?: boolean
      } = {}
    ) => {
      if (!sessionId) {
        numberingRequestGenerationRef.current += 1
        numberingPageCacheRef.current.clear()
        prefetchingNumberingPagesRef.current.clear()
        setStatus(null)
        setLoading(false)
        setError("Chưa có session để đánh số trang.")
        return null
      }
      if (!options.silent) {
        setLoading(true)
        setError("")
      }
      let requestGeneration = numberingRequestGenerationRef.current
      try {
        const includeDocuments = options.includeDocuments ?? true
        const pageSize = NUMBERING_PAGE_SIZE
        const pageIndex = Math.max(
          0,
          Math.floor(Number(options.pageIndex ?? numberingPageIndex) || 0)
        )
        if (includeDocuments && options.force) {
          numberingRequestGenerationRef.current += 1
          numberingPageCacheRef.current.clear()
          prefetchingNumberingPagesRef.current.clear()
        }
        requestGeneration = numberingRequestGenerationRef.current

        const cachedStatus =
          includeDocuments && !options.force
            ? numberingPageCacheRef.current.get(pageIndex)
            : undefined

        if (cachedStatus) {
          setStatus((current) =>
            mergeCachedNumberingPage(current, cachedStatus)
          )
          setError("")
          const nextPageIndex = nextNumberingPrefetchPageIndex(
            pageIndex,
            pageSize,
            cachedStatus
          )
          if (nextPageIndex !== null) {
            void prefetchNumberingPage(nextPageIndex)
          }
          return cachedStatus
        }

        const response = includeDocuments
          ? await fetchNumberingPageStatus(pageIndex)
          : await getDocumentNumberingStatus(sessionId, {
              includeDocuments,
              summaryOnly: true,
            })
        if (
          !response ||
          requestGeneration !== numberingRequestGenerationRef.current
        ) {
          return null
        }
        const nextDocumentsRevision = revisionToken(response.documents_revision)
        if (includeDocuments) {
          numberingDocumentsRevisionRef.current = nextDocumentsRevision
          numberingPageCacheRef.current.set(pageIndex, response)
        } else if (
          nextDocumentsRevision !== null &&
          numberingDocumentsRevisionRef.current !== null &&
          nextDocumentsRevision !== numberingDocumentsRevisionRef.current
        ) {
          numberingPageCacheRef.current.clear()
          prefetchingNumberingPagesRef.current.clear()
        }
        if (!options.deferApply) {
          setStatus((current) =>
            includeDocuments
              ? response
              : mergeNumberingSummaryResponse(current, response)
          )
        }
        setError("")
        if (includeDocuments) {
          const nextPageIndex = nextNumberingPrefetchPageIndex(
            pageIndex,
            pageSize,
            response
          )
          if (nextPageIndex !== null) {
            void prefetchNumberingPage(nextPageIndex)
          }
        }
        return response
      } catch (err) {
        const requestIsCurrent =
          numberingRequestGenerationRef.current === requestGeneration
        const message =
          err instanceof Error
            ? err.message
            : "Không tải được trạng thái đánh số."
        if (!options.silent && requestIsCurrent) setError(message)
        return null
      } finally {
        if (
          !options.silent &&
          numberingRequestGenerationRef.current === requestGeneration
        ) {
          setLoading(false)
        }
      }
    },
    [
      fetchNumberingPageStatus,
      numberingPageIndex,
      prefetchNumberingPage,
      sessionId,
    ]
  )

  const clearNumberingClientCaches = useCallback(() => {
    numberingRequestGenerationRef.current += 1
    numberingPageCacheRef.current.clear()
    prefetchingNumberingPagesRef.current.clear()
    numberingDocumentsRevisionRef.current = null
    setLoading(false)
    setNumberingPageIndex(0)
    setMissingNavigatorOpen(false)
    setMissingNavigatorCacheKey("")
    setMissingNavigatorDocuments([])
    setMissingNavigatorIndex(0)
    setPreviewRefreshKey((key) => key + 1)
  }, [])

  const applyNumberingStatusConfiguration = useCallback(
    (nextStatus: NumberingStatusResponse) => {
      const configuration = nextStatus.numbering_configuration
      const nextMode =
        configuration?.document_numbering_mode ??
        nextStatus.document_numbering_mode
      const nextPreset =
        configuration?.document_numbering_style_preset ??
        nextStatus.document_numbering_style_preset ??
        documentNumberingStylePreset
      const nextOverrides = cleanNumberingStyleOverrides(
        configuration?.document_numbering_style_overrides ??
          nextStatus.document_numbering_style_overrides
      )
      setNumberingModeDraft(nextMode)
      setStylePresetDraft(nextPreset)
      setStyleOverridesDraft(nextOverrides)
      setNumberingModeDraftDirty(false)
      setStyleDraftDirty(false)
      onDocumentNumberingModeApplied?.(nextMode)
      onDocumentNumberingStyleApplied?.(nextPreset, nextOverrides)
    },
    [
      documentNumberingStylePreset,
      onDocumentNumberingModeApplied,
      onDocumentNumberingStyleApplied,
    ]
  )

  const returnToWorkingNumberingView = useCallback(async () => {
    clearNumberingClientCaches()
    setViewedNumberingState(null)
    setPreviewDocumentId(null)
    setNumberingPageIndex(0)
    const nextStatus = await refreshStatus({
      silent: true,
      includeDocuments: true,
      pageIndex: 0,
      force: true,
    })
    if (nextStatus) {
      setStatus(nextStatus)
      applyNumberingStatusConfiguration(nextStatus)
    }
  }, [
    applyNumberingStatusConfiguration,
    clearNumberingClientCaches,
    refreshStatus,
  ])

  const mutateNumberingTimeline = useCallback(
    async (
      action: "save" | "discard" | "previous" | "next" | "apply" | "working"
    ) => {
      if (!sessionId || timelineMutationInFlightRef.current) {
        return
      }
      if (action === "working") {
        await returnToWorkingNumberingView()
        return
      }
      if (
        (action === "previous" || action === "next") &&
        !viewedNumberingState &&
        statusForCurrentSession?.numbering_state?.dirty
      ) {
        return
      }
      if (
        ["save", "discard", "apply"].includes(action) &&
        !canManageNumbering
      ) {
        return
      }
      timelineMutationInFlightRef.current = true
      setTimelineMutating(true)
      setError("")
      try {
        const expectation = {
          configurationId:
            statusForCurrentSession?.numbering_configuration?.id ?? null,
          workingRevision:
            statusForCurrentSession?.numbering_state?.working_revision ?? null,
          baseStateId:
            statusForCurrentSession?.numbering_state?.applied_state?.id ??
            statusForCurrentSession?.numbering_state?.current?.id ??
            null,
        }
        if (action === "save") {
          if (viewedNumberingState) return
          const response = await saveNumberingState(sessionId, expectation)
          await refreshStatus({
            silent: true,
            includeDocuments: true,
            pageIndex: numberingPageIndex,
            force: true,
          })
          toast.success(
            response.created === false
              ? "Trạng thái hiện tại đã được lưu trước đó."
              : "Đã lưu trạng thái đánh số."
          )
          return
        }

        if (action === "previous" || action === "next") {
          const targetStateId = viewedNumberingState
            ? action === "previous"
              ? viewedNumberingState.previous_state_id
              : viewedNumberingState.next_state_id
            : action === "previous"
              ? statusForCurrentSession?.numbering_state?.previous_state_id
              : statusForCurrentSession?.numbering_state?.next_state_id
          if (!targetStateId) return
          const detail = await getNumberingState(sessionId, targetStateId, {
            limit: NUMBERING_PAGE_SIZE,
            offset: 0,
          })
          if (detail.is_applied) {
            await returnToWorkingNumberingView()
            return
          }
          setViewedNumberingState(detail)
          setPreviewDocumentId(null)
          setNumberingPageIndex(0)
          return
        }

        const response =
          action === "apply"
            ? viewedNumberingState
              ? await applyNumberingState(
                  sessionId,
                  viewedNumberingState.state.id,
                  expectation
                )
              : null
            : await discardNumberingState(sessionId, expectation)
        if (!response) return
        clearNumberingClientCaches()
        setViewedNumberingState(null)
        const nextStatus =
          response.numbering_status ??
          (await refreshStatus({
            silent: true,
            includeDocuments: true,
            pageIndex: 0,
            force: true,
          }))
        if (nextStatus) {
          numberingDocumentsRevisionRef.current = revisionToken(
            nextStatus.documents_revision
          )
          setStatus(nextStatus)
          applyNumberingStatusConfiguration(nextStatus)
        }
        toast.success(
          action === "discard"
            ? "Đã bỏ các thay đổi chưa lưu."
            : "Đã sử dụng trạng thái đánh số đã chọn."
        )
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Không thể cập nhật timeline đánh số."
        await refreshStatus({
          silent: true,
          includeDocuments: true,
          pageIndex: 0,
          force: true,
        })
        setError(message)
        toast.error(message)
      } finally {
        timelineMutationInFlightRef.current = false
        setTimelineMutating(false)
      }
    },
    [
      applyNumberingStatusConfiguration,
      canManageNumbering,
      clearNumberingClientCaches,
      numberingPageIndex,
      refreshStatus,
      returnToWorkingNumberingView,
      sessionId,
      statusForCurrentSession,
      viewedNumberingState,
    ]
  )

  const loadViewedNumberingStatePage = useCallback(
    async (pageIndex: number) => {
      if (
        !sessionId ||
        !viewedNumberingState ||
        timelineMutationInFlightRef.current
      ) {
        return
      }
      const normalizedPageIndex = Math.max(0, Math.floor(pageIndex))
      timelineMutationInFlightRef.current = true
      setTimelineMutating(true)
      setError("")
      try {
        const detail = await getNumberingState(
          sessionId,
          viewedNumberingState.state.id,
          {
            limit: NUMBERING_PAGE_SIZE,
            offset: normalizedPageIndex * NUMBERING_PAGE_SIZE,
          }
        )
        if (detail.is_applied) {
          await returnToWorkingNumberingView()
          return
        }
        setViewedNumberingState(detail)
        setNumberingPageIndex(normalizedPageIndex)
        setPreviewDocumentId(null)
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Không thể tải trang tài liệu của trạng thái đánh số."
        setError(message)
        toast.error(message)
      } finally {
        timelineMutationInFlightRef.current = false
        setTimelineMutating(false)
      }
    },
    [returnToWorkingNumberingView, sessionId, viewedNumberingState]
  )

  useEffect(() => {
    if (!sessionId) {
      numberingConfigCacheKeyRef.current = null
      return
    }
    if (numberingConfigCacheKeyRef.current === numberingConfigCacheKey) return

    const hadPreviousConfig = numberingConfigCacheKeyRef.current !== null
    numberingConfigCacheKeyRef.current = numberingConfigCacheKey
    numberingRequestGenerationRef.current += 1
    numberingPageCacheRef.current.clear()
    prefetchingNumberingPagesRef.current.clear()
    numberingDocumentsRevisionRef.current = null
    setNumberingPageIndex(0)
    setMissingNavigatorCacheKey("")
    setMissingNavigatorDocuments([])
    setMissingNavigatorIndex(0)
    if (hadPreviousConfig) {
      setStatus(null)
      void refreshStatus({ force: true })
    }
  }, [numberingConfigCacheKey, refreshStatus, sessionId])

  const loadMissingNavigatorDocuments = useCallback(async () => {
    if (!sessionId) {
      setMissingNavigatorDocuments([])
      setMissingNavigatorIndex(0)
      setMissingNavigatorError("Chưa có session để xem tài liệu thiếu số.")
      return []
    }

    setMissingNavigatorLoading(true)
    setMissingNavigatorError("")
    try {
      const documents: NumberingDocumentStatus[] = []
      let offset = 0
      let guard = 0
      let fetchedCacheKey = currentMissingNavigatorCacheKey
      while (guard < 100) {
        const response = await getDocumentNumberingStatus(sessionId, {
          includeDocuments: true,
          summaryOnly: false,
          limit: NUMBERING_NAVIGATOR_PAGE_SIZE,
          offset,
        })
        fetchedCacheKey = `${sessionId}:${
          revisionToken(response.documents_revision) ?? ""
        }`
        documents.push(...response.documents)
        const pagination = response.pagination
        if (!pagination?.has_more || pagination.next_offset == null) break
        offset = pagination.next_offset
        guard += 1
      }
      setMissingNavigatorDocuments(documents)
      setMissingNavigatorCacheKey(fetchedCacheKey)
      setMissingNavigatorIndex((current) => {
        const missingCount = documents.filter(isMissingNumberingDocument).length
        if (missingCount <= 0) return 0
        return Math.min(Math.max(0, current), missingCount - 1)
      })
      return documents
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Không tải được danh sách tài liệu thiếu số."
      setMissingNavigatorError(message)
      return []
    } finally {
      setMissingNavigatorLoading(false)
    }
  }, [currentMissingNavigatorCacheKey, sessionId])

  const startNumbering = useCallback(
    async (force = false) => {
      if (!sessionId) {
        toast.error("Chưa có session để đánh số trang.")
        return
      }
      setStarting(true)
      setError("")
      setProgressPhase("loading_data")
      setProgressMessage(
        force
          ? "Đang gửi yêu cầu đánh số lại theo cấu hình hiện tại."
          : hasPendingNumberingConfigChanges
            ? "Đang áp dụng cấu hình và lấy hoặc tạo phần kết quả còn thiếu."
            : "Đang gửi yêu cầu đánh số trang."
      )
      setCompletedPhases(new Set())
      try {
        const response = await enqueueDocumentNumbering(sessionId, {
          created_by: "ui",
          force,
          document_numbering_mode: numberingModeDraft,
          document_numbering_style_preset: stylePresetDraft,
          document_numbering_style_overrides: styleOverridesDraft,
        })
        onDocumentNumberingModeApplied?.(numberingModeDraft)
        onDocumentNumberingStyleApplied?.(stylePresetDraft, styleOverridesDraft)
        setStatus((current) =>
          current?.session_id === sessionId
            ? {
                ...current,
                document_numbering_mode: numberingModeDraft,
                document_numbering_style_preset: stylePresetDraft,
                document_numbering_style_overrides: styleOverridesDraft,
              }
            : current
        )
        setNumberingModeDraftDirty(false)
        setStyleDraftDirty(false)
        if (response.status === "not_needed") {
          if (response.result) {
            numberingDocumentsRevisionRef.current = revisionToken(
              response.result.documents_revision
            )
            setStatus(response.result)
          }
          setProgressPhase(null)
          setCompletedPhases(
            new Set(NUMBERING_PROGRESS_PHASES.map((phase) => phase.id))
          )
          setProgressMessage("Đã lấy kết quả đánh số hiện có.")
          const warningCount =
            response.result?.summary.blank_page_warning_documents ?? 0
          if (warningCount > 0) {
            toast.warning(
              `Đã lấy kết quả. Có ${warningCount} tài liệu có cảnh báo trang trắng.`
            )
          } else {
            toast.info("Tài liệu đã được đánh số theo chế độ hiện tại.")
          }
        } else if (response.created) {
          toast.success(
            force ? "Đã gửi task đánh số lại." : "Đã gửi task đánh số trang."
          )
        } else {
          toast.info("Task đánh số trang đang được xử lý.")
        }
        await refreshStatus({ silent: true, force: true })
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Không gửi được task đánh số trang."
        setError(message)
        toast.error(message)
      } finally {
        setStarting(false)
      }
    },
    [
      hasPendingNumberingConfigChanges,
      numberingModeDraft,
      onDocumentNumberingModeApplied,
      onDocumentNumberingStyleApplied,
      refreshStatus,
      sessionId,
      styleOverridesDraft,
      stylePresetDraft,
    ]
  )

  const updateDocumentNumberFromPage = useCallback(
    async (
      document: NumberingDocumentStatus,
      anchorPageNumber: number,
      newLabel: string,
      updateMode: NumberingUpdateMode,
      manualEntries?: Array<{ page_number: number; label: string }>
    ) => {
      if (!sessionId) {
        toast.error("Chưa có session để cập nhật số.")
        return
      }
      if (!Number.isFinite(anchorPageNumber) || anchorPageNumber < 1) {
        toast.error("Trang cần sửa phải lớn hơn hoặc bằng 1.")
        return
      }
      const trimmedLabel = newLabel.trim()
      const manualEntriesPayload =
        updateMode === "manual" && manualEntries?.length
          ? manualEntries
          : undefined
      if (updateMode !== "manual" && !trimmedLabel) {
        toast.error("Số mới không được để trống.")
        return
      }
      if (
        updateMode === "manual" &&
        !manualEntriesPayload?.length &&
        !trimmedLabel
      ) {
        toast.error("Danh sách đánh số thủ công không được để trống.")
        return
      }
      if (updateMode === "auto" && !/^[0-9]+$/.test(trimmedLabel)) {
        toast.error("Đánh số tự động chỉ nhận số.")
        return
      }
      if (updateMode === "cascade" && !/^[0-9]+/.test(trimmedLabel)) {
        toast.error("Mốc đánh số phải bắt đầu bằng số.")
        return
      }
      const modeText =
        updateMode === "manual"
          ? "thủ công"
          : updateMode === "cascade"
            ? "theo mốc"
            : "tự động"
      setUpdatingDocumentId(document.session_document_id)
      setError("")
      setProgressPhase("loading_data")
      setProgressMessage(`Đang gửi yêu cầu cập nhật số ${modeText}.`)
      setCompletedPhases(new Set())
      try {
        const requestPayload: Parameters<
          typeof updateDocumentNumberingFromPage
        >[2] = {
          anchor_page_number: anchorPageNumber,
          numbering_update_mode: updateMode,
          created_by: "ui",
          force: true,
        }
        if (updateMode === "auto") {
          requestPayload.new_number = trimmedLabel
        } else if (updateMode === "cascade") {
          requestPayload.new_label = trimmedLabel
        } else if (manualEntriesPayload?.length) {
          requestPayload.numbering_entries = manualEntriesPayload
        } else {
          requestPayload.new_label = trimmedLabel
        }
        const response = await updateDocumentNumberingFromPage(
          sessionId,
          document.session_document_id,
          requestPayload
        )
        if (response.created) {
          toast.success(`Đã gửi task cập nhật số ${modeText}.`)
        } else {
          toast.info("Task đánh số đang được xử lý.")
        }
        await refreshStatus({ silent: true, force: true })
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Không cập nhật được số tài liệu."
        setError(message)
        toast.error(message)
      } finally {
        setUpdatingDocumentId(null)
      }
    },
    [refreshStatus, sessionId]
  )

  const retryIncompleteDocument = useCallback(
    async (document: NumberingDocumentStatus) => {
      if (!sessionId) {
        toast.error("Chưa có session để đánh số lại tài liệu.")
        return
      }
      if (starting || status?.active) return

      const entries = numberingEntries(document)
      const retryEntries = entries
        .map((entry) => ({
          page_number: entry.page_number,
          label: entry.label,
        }))
        .filter(
          (entry) =>
            Number.isFinite(entry.page_number) &&
            entry.page_number > 0 &&
            entry.label.trim().length > 0
        )
      const firstEntry = retryEntries[0]
      if (!firstEntry) {
        toast.error("Tài liệu chưa có trang hợp lệ để đánh số lại.")
        return
      }
      const anchorPageNumber = firstEntry.page_number
      setRetryingDocumentId(document.session_document_id)
      setError("")
      setProgressPhase("loading_data")
      setProgressMessage(
        `Đang gửi yêu cầu đánh số lại ${document.file_name || document.document_id}.`
      )
      setCompletedPhases(new Set())
      try {
        const response = await updateDocumentNumberingFromPage(
          sessionId,
          document.session_document_id,
          {
            anchor_page_number: anchorPageNumber,
            numbering_update_mode: "manual",
            numbering_entries: retryEntries,
            created_by: "ui",
            force: true,
          }
        )
        if (response.status === "not_needed") {
          if (response.result) {
            numberingDocumentsRevisionRef.current = revisionToken(
              response.result.documents_revision
            )
            setStatus(response.result)
          }
          toast.info("Không còn tài liệu cần đánh số lại.")
        } else if (response.created) {
          toast.success("Đã gửi task đánh số lại tài liệu.")
        } else {
          toast.info("Task đánh số đang được xử lý.")
        }
        await refreshStatus({ silent: true, force: true })
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Không gửi được task đánh số lại tài liệu."
        setError(message)
        toast.error(message)
      } finally {
        setRetryingDocumentId(null)
      }
    },
    [refreshStatus, sessionId, starting, status?.active]
  )

  const exportMetadata = useCallback(
    async (mode: MetadataExportMode) => {
      if (!sessionId) {
        toast.error("Chưa có session để xuất metadata.")
        return
      }
      setMetadataExporting(true)
      setError("")
      try {
        const result = await exportMetadataSnapshot(sessionId, {
          created_by: "ui",
          metadata_export_mode: mode,
        })
        const artifacts =
          result.artifacts?.length > 0
            ? result.artifacts
            : result.artifact
              ? [result.artifact]
              : []
        if (artifacts.length === 0) {
          throw new Error("Backend chưa trả về artifact metadata.")
        }
        toast.success(
          mode === "separated"
            ? "Đã tạo hai file metadata. Đang tải lần lượt."
            : "Đã tạo snapshot metadata. Đang tải file."
        )
        for (const artifact of artifacts) {
          const download = await downloadArtifact(sessionId, artifact.id)
          saveBlob(download.blob, download.fileName || artifact.file_name)
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Không thể xuất metadata tại thời điểm hiện tại."
        setError(message)
        toast.error(message)
      } finally {
        setMetadataExporting(false)
      }
    },
    [sessionId]
  )

  const importMetadataBoxNumbers = useCallback(
    async (
      file: File | null,
      options: { confirmCountConflicts?: boolean } = {}
    ) => {
      if (!file) return
      if (!sessionId) {
        toast.error("Chưa có session để nhập số hộp.")
        return
      }
      if (!file.name.toLowerCase().endsWith(".xlsx")) {
        toast.error("File nhập số hộp phải là .xlsx.")
        return
      }

      if (!options.confirmCountConflicts) {
        setMetadataImportReview(null)
      }
      setMetadataImporting(true)
      setError("")
      try {
        const result = await importMetadataBoxNumbersApi(sessionId, file, {
          created_by: "ui",
          confirm_count_conflicts: options.confirmCountConflicts,
        })
        const countConflicts = SHOW_METADATA_COUNT_CONFLICT_WARNING
          ? (result.count_conflicts ?? [])
          : []
        if (
          SHOW_METADATA_COUNT_CONFLICT_WARNING &&
          result.requires_confirmation &&
          countConflicts.length > 0
        ) {
          setMetadataImportReview({ file, response: result })
          toast.warning(
            `Có ${countConflicts.length} hồ sơ không đồng nhất ${
              result.numbering_mode === "sheet" ? "số tờ" : "số trang"
            }. Số cũ đang được giữ lại.`
          )
        } else {
          setMetadataImportReview(null)
          toast.success(
            options.confirmCountConflicts
              ? `Đã xác nhận số mới cho ${result.count_conflict_count ?? 0} hồ sơ.`
              : `Đã cập nhật metadata cho ${result.updated_dossiers} hồ sơ.`
          )
        }
        const issueCount =
          result.unmatched_rows +
          (result.row_conflict_count ??
            Math.max(
              0,
              result.conflict_count - (result.count_conflict_count ?? 0)
            ))
        if (issueCount > 0) {
          toast.info(
            `Có ${issueCount} dòng chưa cập nhật được do chưa khớp hồ sơ hoặc có nhiều giá trị khác nhau.`
          )
        }
        await refreshStatus({ silent: true, force: true })
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Không thể nhập metadata từ file Excel."
        setError(message)
        toast.error(message)
      } finally {
        setMetadataImporting(false)
      }
    },
    [refreshStatus, sessionId]
  )

  const removeLocalMetadataCountConflicts = useCallback(
    (resolvedConflicts: MetadataCountConflict[]) => {
      const resolvedKeys = new Set(
        resolvedConflicts.map(
          (conflict) =>
            `${conflict.session_dossier_id}:${conflict.dossier_id}:${conflict.field}`
        )
      )
      setMetadataImportReview((current) => {
        if (!current) return current
        const remainingConflicts = (
          current.response.count_conflicts ?? []
        ).filter(
          (conflict) =>
            !resolvedKeys.has(
              `${conflict.session_dossier_id}:${conflict.dossier_id}:${conflict.field}`
            )
        )
        if (remainingConflicts.length <= 0) return null
        return {
          ...current,
          response: {
            ...current.response,
            count_conflicts: remainingConflicts,
            count_conflict_count: remainingConflicts.length,
            pending_count_updates: remainingConflicts.length,
            requires_confirmation: true,
          },
        }
      })
    },
    []
  )

  const keepOldMetadataCountsForDossier = useCallback(
    async (conflicts: MetadataCountConflict[]) => {
      if (!sessionId || conflicts.length <= 0) return
      const firstConflict = conflicts[0]
      setMetadataImporting(true)
      setError("")
      try {
        await clearMetadataBoxNumberPendingCounts(sessionId, {
          created_by: "ui",
          dossier_id: firstConflict.dossier_id || firstConflict.cluster_id,
          session_dossier_id: firstConflict.session_dossier_id,
          fields: conflicts.map((conflict) => conflict.field),
        })
        removeLocalMetadataCountConflicts(conflicts)
        await refreshStatus({ silent: true, force: true })
        toast.info(
          `Đã giữ số cũ cho hồ sơ "${firstConflict.dossier_title || firstConflict.dossier_id}".`
        )
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Không thể xóa cảnh báo xung đột số tờ/số trang."
        setError(message)
        toast.error(message)
      } finally {
        setMetadataImporting(false)
      }
    },
    [refreshStatus, removeLocalMetadataCountConflicts, sessionId]
  )

  const confirmMetadataCountConflictsForDossier = useCallback(
    async (conflicts: MetadataCountConflict[]) => {
      if (!sessionId || conflicts.length <= 0) return
      const firstConflict = conflicts[0]
      const payload: SessionDossierPatchPayload = { created_by: "ui" }
      for (const conflict of conflicts) {
        if (conflict.field === "page_count") {
          payload.page_count = conflict.new_value
        } else {
          payload.sheet_count = conflict.new_value
        }
      }
      setMetadataImporting(true)
      setError("")
      try {
        await patchSessionDossier(
          sessionId,
          firstConflict.dossier_id || firstConflict.cluster_id,
          payload
        )
        removeLocalMetadataCountConflicts(conflicts)
        await refreshStatus({ silent: true, force: true })
        toast.success(
          `Đã dùng số mới cho hồ sơ "${firstConflict.dossier_title || firstConflict.dossier_id}".`
        )
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Không thể xác nhận dùng số mới cho hồ sơ."
        setError(message)
        toast.error(message)
      } finally {
        setMetadataImporting(false)
      }
    },
    [refreshStatus, removeLocalMetadataCountConflicts, sessionId]
  )

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  useEffect(() => {
    if (!autoStart || !sessionId) return
    if (autoStartedSessionRef.current === sessionId) return
    autoStartedSessionRef.current = sessionId
    onAutoStartHandled?.()
    void startNumbering(false)
  }, [autoStart, onAutoStartHandled, sessionId, startNumbering])

  useEffect(() => {
    if (!sessionId) return
    if (!status?.active && !starting) return
    let cancelled = false
    let timeoutId: number | null = null
    let pollCount = 0
    const poll = async () => {
      pollCount += 1
      const previousDocumentsRevision = numberingDocumentsRevisionRef.current
      const response = await refreshStatus({
        silent: true,
        includeDocuments: false,
        deferApply: true,
      })
      if (cancelled) return
      const nextDocumentsRevision = revisionToken(response?.documents_revision)
      const documentsChanged =
        nextDocumentsRevision !== null &&
        nextDocumentsRevision !== previousDocumentsRevision
      const periodicDocumentRefresh =
        pollCount % NUMBERING_DOCUMENT_REFRESH_EVERY === 0
      const shouldRefreshDocuments =
        !response?.active || documentsChanged || periodicDocumentRefresh
      if (shouldRefreshDocuments) {
        await refreshStatus({
          silent: true,
          includeDocuments: true,
          force: true,
        })
      } else if (response) {
        setStatus((current) => mergeNumberingSummaryResponse(current, response))
      }
      if (cancelled) return
      if (!response?.active && missingNavigatorOpen) {
        await loadMissingNavigatorDocuments()
      }
      if (response?.active || starting) {
        timeoutId = window.setTimeout(
          poll,
          visibleAwareDelay(NUMBERING_POLL_INTERVAL_MS)
        )
        return
      }
      if (response && isNumberingComplete(response)) {
        setProgressPhase(null)
        setCompletedPhases(
          new Set(NUMBERING_PROGRESS_PHASES.map((phase) => phase.id))
        )
        setProgressMessage("Đã hoàn tất đánh số trang.")
        const warningCount = response.summary.blank_page_warning_documents ?? 0
        if (warningCount > 0) {
          toast.warning(
            `Đã đánh số xong. Có ${warningCount} tài liệu có cảnh báo trang trắng.`
          )
        } else {
          toast.success("Đã hoàn tất đánh số trang.")
        }
      }
    }
    timeoutId = window.setTimeout(
      poll,
      visibleAwareDelay(NUMBERING_POLL_INTERVAL_MS)
    )
    return () => {
      cancelled = true
      if (timeoutId !== null) window.clearTimeout(timeoutId)
    }
  }, [
    loadMissingNavigatorDocuments,
    missingNavigatorOpen,
    refreshStatus,
    sessionId,
    starting,
    status?.active,
  ])

  useEffect(() => {
    if (!status) return
    const total = status.summary.total_documents
    const done = status.summary.done
    const failed = status.summary.failed
    const running = status.summary.running
    if (
      (status.active || running > 0 || starting) &&
      !(total > 0 && done + failed >= total)
    ) {
      setProgressPhase("rendering_document")
      setProgressMessage(`Đã đánh số ${done}/${total} tài liệu.`)
      setCompletedPhases(new Set(["loading_data"]))
      return
    }
    if (!status.active && !starting && total > 0 && done < total) {
      setProgressPhase(null)
      setCompletedPhases(new Set(["loading_data", "rendering_document"]))
      setProgressMessage(
        `Đã đánh số ${done}/${total} tài liệu; còn ${total - done} tài liệu chưa hoàn tất.`
      )
      return
    }
    if (total > 0 && done + failed >= total) {
      setProgressPhase(null)
      setCompletedPhases(
        new Set(NUMBERING_PROGRESS_PHASES.map((phase) => phase.id))
      )
      setProgressMessage(
        failed > 0
          ? `Đã đánh số ${done}/${total} tài liệu, ${failed} tài liệu lỗi.`
          : `Đã đánh số xong ${done}/${total} tài liệu.`
      )
    }
  }, [starting, status])

  const viewingNumberingHistory = viewedNumberingState !== null
  const displayedNumberingDocuments = useMemo(
    () => viewedNumberingState?.documents ?? status?.documents ?? [],
    [status?.documents, viewedNumberingState?.documents]
  )
  const displayedNumberingDossiers = useMemo(
    () => viewedNumberingState?.dossiers ?? status?.dossiers ?? [],
    [status?.dossiers, viewedNumberingState?.dossiers]
  )
  const documentsByDossier = useMemo(
    () => groupDocumentsByDossier(displayedNumberingDocuments),
    [displayedNumberingDocuments]
  )
  const dossiersWithoutBoxCount = useMemo(() => {
    const summaryCount = status?.summary.dossiers_without_box_count
    if (summaryCount !== undefined) return Math.max(0, summaryCount)
    return displayedNumberingDossiers.filter(
      (dossier) => !textOrNull(dossier.box_number)
    ).length
  }, [displayedNumberingDossiers, status?.summary.dossiers_without_box_count])
  const persistedMetadataCountConflicts = useMemo(
    () =>
      SHOW_METADATA_COUNT_CONFLICT_WARNING && !viewingNumberingHistory
        ? [
            ...((status?.dossiers ?? []).flatMap(
              (dossier) => dossier.pending_count_conflicts ?? []
            ) ?? []),
            ...((status?.documents ?? []).flatMap(
              (document) => document.pending_count_conflicts ?? []
            ) ?? []),
          ]
        : [],
    [status?.dossiers, status?.documents, viewingNumberingHistory]
  )
  const metadataCountConflictsByDossier = useMemo(
    () =>
      SHOW_METADATA_COUNT_CONFLICT_WARNING
        ? groupMetadataCountConflicts([
            ...persistedMetadataCountConflicts,
            ...(metadataImportReview?.response.count_conflicts ?? []),
          ])
        : new Map<string, MetadataCountConflict[]>(),
    [metadataImportReview, persistedMetadataCountConflicts]
  )
  const normalizedNumberingFilter = useMemo(
    () => normalizeSearchText(numberingFilter),
    [numberingFilter]
  )
  const filteredDocumentsByDossier = useMemo(
    () =>
      filterNumberingDossierGroups(
        documentsByDossier,
        normalizedNumberingFilter
      ),
    [documentsByDossier, normalizedNumberingFilter]
  )
  const pagedDocumentsByDossier = filteredDocumentsByDossier
  const displayedNumberingPagination =
    viewedNumberingState?.pagination ?? status?.pagination
  const numberingPaginationTotal =
    displayedNumberingPagination?.total ??
    (viewingNumberingHistory
      ? displayedNumberingDocuments.length
      : status?.summary.total_dossiers) ??
    0
  const numberingPageCount = Math.max(
    1,
    Math.ceil(numberingPaginationTotal / NUMBERING_PAGE_SIZE)
  )
  const normalizedNumberingPageIndex = Math.min(
    Math.max(0, numberingPageIndex),
    numberingPageCount - 1
  )
  const numberingPageOffset =
    displayedNumberingPagination?.offset ??
    normalizedNumberingPageIndex * NUMBERING_PAGE_SIZE
  const numberingPageReturned =
    displayedNumberingPagination?.returned ?? displayedNumberingDocuments.length
  const missingNumberingDocuments = useMemo(
    () => visibleMissingNavigatorDocuments.filter(isMissingNumberingDocument),
    [visibleMissingNavigatorDocuments]
  )
  const normalizedMissingNavigatorIndex = Math.min(
    Math.max(0, missingNavigatorIndex),
    Math.max(0, missingNumberingDocuments.length - 1)
  )
  const currentMissingDocument =
    missingNumberingDocuments[normalizedMissingNavigatorIndex] ?? null
  const focusMissingNumberingDocument = useCallback(
    async (
      document: NumberingDocumentStatus,
      allDocuments: NumberingDocumentStatus[] = visibleMissingNavigatorDocuments
    ) => {
      if (!sessionId) return
      const groups = groupDocumentsByDossier(allDocuments)
      const dossierIndex = groups.findIndex((group) =>
        group.documents.some(
          (item) => item.session_document_id === document.session_document_id
        )
      )
      const pageIndex =
        dossierIndex >= 0
          ? Math.floor(dossierIndex / NUMBERING_PAGE_SIZE)
          : normalizedNumberingPageIndex
      setNumberingFilter("")
      setNumberingPageIndex(pageIndex)
      await refreshStatus({
        silent: true,
        includeDocuments: true,
        pageIndex,
      })
      setPreviewDocumentId(document.session_document_id)
      setHighlightedDocumentId(document.session_document_id)
      setHighlightScrollRequest((current) => current + 1)
    },
    [
      visibleMissingNavigatorDocuments,
      normalizedNumberingPageIndex,
      refreshStatus,
      sessionId,
    ]
  )
  const openMissingNavigator = useCallback(async () => {
    setMissingNavigatorOpen(true)
    const documents =
      visibleMissingNavigatorDocuments.length > 0
        ? visibleMissingNavigatorDocuments
        : await loadMissingNavigatorDocuments()
    const missingDocuments = documents.filter(isMissingNumberingDocument)
    if (missingDocuments.length <= 0) return
    const nextIndex = Math.min(
      normalizedMissingNavigatorIndex,
      missingDocuments.length - 1
    )
    setMissingNavigatorIndex(nextIndex)
    await focusMissingNumberingDocument(missingDocuments[nextIndex], documents)
  }, [
    focusMissingNumberingDocument,
    loadMissingNavigatorDocuments,
    normalizedMissingNavigatorIndex,
    visibleMissingNavigatorDocuments,
  ])
  const changeMissingNavigatorIndex = useCallback(
    (nextIndex: number) => {
      const normalizedIndex = Math.min(
        Math.max(0, nextIndex),
        Math.max(0, missingNumberingDocuments.length - 1)
      )
      setMissingNavigatorIndex(normalizedIndex)
      const nextDocument = missingNumberingDocuments[normalizedIndex]
      if (nextDocument) void focusMissingNumberingDocument(nextDocument)
    },
    [focusMissingNumberingDocument, missingNumberingDocuments]
  )
  const previewDocument = useMemo(
    () =>
      displayedNumberingDocuments.find(
        (document) => document.session_document_id === previewDocumentId
      ) ??
      visibleMissingNavigatorDocuments.find(
        (document) => document.session_document_id === previewDocumentId
      ) ??
      null,
    [
      displayedNumberingDocuments,
      previewDocumentId,
      visibleMissingNavigatorDocuments,
    ]
  )
  const previewSessionDocumentId = previewDocument?.session_document_id ?? null
  const previewPdfVersionId = textOrNull(
    previewDocument?.numbered_pdf_version_id
  )
  const previewSourceUrl = textOrNull(previewDocument?.download_url)
  const previewCanPreview = previewDocument
    ? canPreviewNumberingDocument(previewDocument)
    : false

  useEffect(() => {
    previewUrlRef.current = previewUrl
  }, [previewUrl])

  useEffect(() => {
    if (!sessionId || previewSessionDocumentId === null || !previewCanPreview) {
      previewTargetRef.current = ""
      previewUrlRef.current = ""
      setPreviewUrl("")
      setPreviewError("")
      setPreviewLoading(false)
      return
    }

    let cancelled = false
    const previewTarget = `${sessionId}:${previewSessionDocumentId}`
    const targetChanged = previewTargetRef.current !== previewTarget
    previewTargetRef.current = previewTarget

    if (targetChanged) {
      previewUrlRef.current = ""
      setPreviewUrl("")
    }

    setPreviewError("")
    setPreviewLoading(true)

    const loadPreviewUrl = async () => {
      try {
        let nextPreviewUrl: string | null = null
        if (previewPdfVersionId) {
          const response = await getNumberedDocumentPreviewUrl(
            sessionId,
            previewSessionDocumentId,
            previewPdfVersionId
          )
          nextPreviewUrl = textOrNull(response.download_url)
        } else if (previewSourceUrl) {
          nextPreviewUrl = previewSourceUrl
        } else {
          const response = await getDocumentPreviewUrl(
            sessionId,
            previewSessionDocumentId
          )
          const fallbackUrl =
            textOrNull(response.download_url) ||
            response.preview_variants?.find((variant) =>
              textOrNull(variant.download_url)
            )?.download_url ||
            null
          nextPreviewUrl = fallbackUrl
        }
        if (cancelled) return
        if (nextPreviewUrl) {
          const resolvedPreviewUrl = nextPreviewUrl
          if (previewUrlRef.current !== resolvedPreviewUrl) {
            setPreviewUrl((current) => {
              previewUrlRef.current = resolvedPreviewUrl
              return current === resolvedPreviewUrl
                ? current
                : resolvedPreviewUrl
            })
          }
          return
        }
        const hasFallbackUrl = Boolean(previewUrlRef.current)
        if (!cancelled) {
          if (hasFallbackUrl) return
          else setPreviewError("Không có URL preview cho tài liệu này.")
        }
      } catch (err) {
        if (cancelled) return
        setPreviewError(
          err instanceof Error
            ? err.message
            : previewPdfVersionId
              ? "Không thể cấp URL preview PDF đã đánh số."
              : "Không thể cấp URL preview tài liệu."
        )
      } finally {
        if (!cancelled) setPreviewLoading(false)
      }
    }

    void loadPreviewUrl()

    return () => {
      cancelled = true
    }
  }, [
    previewCanPreview,
    previewPdfVersionId,
    previewRefreshKey,
    previewSessionDocumentId,
    previewSourceUrl,
    sessionId,
  ])

  useEffect(() => {
    if (highlightedDocumentId === null) return
    if (highlightScrollRequest <= 0) return
    const timeoutId = window.setTimeout(() => {
      const row = document.querySelector(
        `[data-numbering-document-id="${highlightedDocumentId}"]`
      )
      row?.scrollIntoView({ block: "center", behavior: "smooth" })
    }, 80)
    return () => window.clearTimeout(timeoutId)
  }, [highlightScrollRequest, highlightedDocumentId])

  const totalDocuments = status?.summary.total_documents ?? 0
  const doneCount = status?.summary.done ?? 0
  const displayedNumberingTotalDocuments = viewingNumberingHistory
    ? numberingPaginationTotal
    : totalDocuments
  const displayedNumberingDoneCount = viewingNumberingHistory
    ? numberingPaginationTotal
    : doneCount
  const failedCount = status?.summary.failed ?? 0
  const pendingCount = status?.summary.pending ?? 0
  const blankPageWarningDocumentCount =
    status?.summary.blank_page_warning_documents ?? 0
  const unresolvedCount = Math.max(0, totalDocuments - doneCount)
  const hasNumberingOutput = doneCount > 0 || failedCount > 0
  const complete = Boolean(
    status && isNumberingComplete(status) && !hasPendingNumberingConfigChanges
  )
  const active = starting || Boolean(status?.active)
  const stoppedWithUnresolved = Boolean(
    status &&
    !active &&
    totalDocuments > 0 &&
    unresolvedCount > 0 &&
    hasNumberingOutput
  )
  const queuedForWorker =
    status?.active === true && status.job?.status === "queued"
  const activeWorkerId =
    status?.job?.status === "running" ? status.job.locked_by : null
  const metadataBusy = metadataExporting || metadataImporting
  const continueBlockedReason = useMemo(() => {
    const reasons: string[] = []
    if (!status) reasons.push("Chưa có kết quả đánh số tài liệu.")
    if (active) reasons.push("Đang đánh số tài liệu, vui lòng chờ hoàn tất.")
    if (metadataBusy) {
      reasons.push("Đang cập nhật metadata, vui lòng chờ hoàn tất.")
    }
    if (failedCount > 0) {
      reasons.push(`Còn ${failedCount} tài liệu đánh số lỗi.`)
    }
    if (unresolvedCount > 0) {
      reasons.push(`Còn ${unresolvedCount} tài liệu chưa hoàn tất đánh số.`)
    }
    if (hasPendingNumberingConfigChanges) {
      reasons.push("Cấu hình đánh số đã thay đổi và chưa được áp dụng.")
    }
    if (dossiersWithoutBoxCount > 0) {
      reasons.push(`Chưa nhập số hộp cho ${dossiersWithoutBoxCount} hồ sơ.`)
    }
    return reasons.join(" ") || null
  }, [
    active,
    dossiersWithoutBoxCount,
    failedCount,
    hasPendingNumberingConfigChanges,
    metadataBusy,
    status,
    unresolvedCount,
  ])
  const canContinue =
    complete &&
    failedCount === 0 &&
    unresolvedCount === 0 &&
    !hasPendingNumberingConfigChanges &&
    dossiersWithoutBoxCount === 0
  const canRestartNumbering = hasNumberingOutput && canManageNumbering
  const timelineEnabled = Boolean(
    status?.numbering_capabilities?.timeline_enabled
  )
  const numberingState = status?.numbering_state
  const canSaveNumberingState = Boolean(
    canManageNumbering &&
    complete &&
    !active &&
    !viewingNumberingHistory &&
    (numberingState?.dirty || !numberingState?.current)
  )
  const changeNumberingMode = (mode: DocumentNumberingMode) => {
    if (active || changingMode || mode === numberingModeDraft) return
    setError("")
    setNumberingModeDraft(mode)
    setNumberingModeDraftDirty(mode !== appliedNumberingMode)
    setProgressPhase(null)
    setProgressMessage("")
    setCompletedPhases(new Set())
  }
  const changeNumberingStyle = (stylePreset: DocumentNumberingStylePreset) => {
    if (active || loading || stylePreset === stylePresetDraft) return
    setError("")
    const nextOverrides: NumberingStyleOverrides = {}
    setStylePresetDraft(stylePreset)
    setStyleOverridesDraft(nextOverrides)
    setStyleDraftDirty(
      stylePreset !== appliedStylePreset ||
        !numberingStyleOverridesEqual(nextOverrides, appliedStyleOverrides)
    )
  }
  const changeNumberingStyleOverrides = (overrides: {
    font_size?: number
    color?: string
    opacity?: number
  }) => {
    if (active || loading) return
    const nextOverrides = cleanNumberingStyleOverrides(overrides)
    setError("")
    setStyleOverridesDraft(nextOverrides)
    setStyleDraftDirty(
      stylePresetDraft !== appliedStylePreset ||
        !numberingStyleOverridesEqual(nextOverrides, appliedStyleOverrides)
    )
  }
  const displayedMode =
    viewedNumberingState?.configuration.document_numbering_mode ??
    numberingModeDraft
  const displayedStylePreset =
    viewedNumberingState?.configuration.document_numbering_style_preset ??
    stylePresetDraft
  const displayedStyleOverrides =
    viewedNumberingState?.configuration.document_numbering_style_overrides ??
    styleOverridesDraft
  const modeLabel =
    displayedMode === "sheet" ? "Đánh số theo tờ" : "Đánh số theo trang"

  return (
    <div className="flex flex-col gap-5">
      <NumberingStepHeader
        modeLabel={modeLabel}
        documentNumberingMode={displayedMode}
        documentNumberingStylePreset={displayedStylePreset}
        documentNumberingStyleOverrides={displayedStyleOverrides}
        numberingStyleOptions={numberingStyleOptions}
        changingMode={changingMode}
        loading={loading || viewingNumberingHistory}
        starting={starting}
        active={active || viewingNumberingHistory}
        complete={complete}
        hasPendingConfigChanges={hasPendingNumberingConfigChanges}
        canRestart={canRestartNumbering}
        onRefresh={() => refreshStatus({ force: true })}
        onStart={() => startNumbering(false)}
        onRestart={() => startNumbering(true)}
        onModeChange={changeNumberingMode}
        onStyleChange={changeNumberingStyle}
        onOverridesChange={changeNumberingStyleOverrides}
      />
      {timelineEnabled ? (
        <NumberingTimelineControls
          applied={
            numberingState?.applied_state?.sequence_number ??
            numberingState?.current?.sequence_number ??
            null
          }
          viewed={viewedNumberingState?.position ?? null}
          count={numberingState?.count ?? 0}
          dirty={numberingState?.dirty ?? true}
          busy={timelineMutating || active}
          canPrevious={
            viewedNumberingState
              ? viewedNumberingState.previous_state_id !== null
              : Boolean(!numberingState?.dirty && numberingState?.can_previous)
          }
          canNext={
            viewedNumberingState
              ? viewedNumberingState.next_state_id !== null
              : Boolean(!numberingState?.dirty && numberingState?.can_next)
          }
          canApply={Boolean(
            canManageNumbering &&
            viewedNumberingState?.can_apply &&
            !viewedNumberingState.is_applied
          )}
          applyBlockedReason={
            viewedNumberingState &&
            !viewedNumberingState.compatible_with_active_cluster
              ? "Chỉ có thể sử dụng state thuộc kết quả lập hồ sơ hiện hành."
              : viewedNumberingState?.is_applied
                ? "Đây là trạng thái đang được sử dụng."
                : null
          }
          onWorking={() => mutateNumberingTimeline("working")}
          onPrevious={() => mutateNumberingTimeline("previous")}
          onNext={() => mutateNumberingTimeline("next")}
          onApply={() => mutateNumberingTimeline("apply")}
        />
      ) : null}
      {!viewingNumberingHistory ? (
        <NumberingMetadataPanel
          metadataImportInputRef={metadataImportInputRef}
          sessionId={sessionId}
          active={active}
          metadataBusy={metadataBusy}
          metadataExporting={metadataExporting}
          metadataImporting={metadataImporting}
          metadataImportReview={metadataImportReview?.response ?? null}
          onExportMetadata={exportMetadata}
          onImportMetadataBoxNumbers={importMetadataBoxNumbers}
        />
      ) : null}
      {(status?.active || progressMessage || starting) && (
        <ProgressTimeline
          phases={NUMBERING_PROGRESS_PHASES}
          activePhase={progressPhase}
          completedPhases={completedPhases}
          title="Tiến trình đánh số"
          message={
            queuedForWorker
              ? "Task đang chờ worker artifacts nhận xử lý."
              : activeWorkerId
                ? `${progressMessage || "Đang xử lý PDF đánh số."} Worker: ${activeWorkerId}.`
                : progressMessage || "Đang xử lý PDF đánh số."
          }
        />
      )}
      {queuedForWorker ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            Job đánh số đã được tạo nhưng chưa có worker nhận. Kiểm tra worker
            artifacts có khai báo job type <code>number_documents</code>.
          </span>
        </div>
      ) : null}
      {stoppedWithUnresolved && !viewingNumberingHistory ? (
        <MissingNumberingNavigator
          unresolvedCount={unresolvedCount}
          failedCount={failedCount}
          pendingCount={pendingCount}
          open={missingNavigatorOpen}
          loading={missingNavigatorLoading}
          error={missingNavigatorError}
          documents={missingNumberingDocuments}
          currentIndex={normalizedMissingNavigatorIndex}
          currentDocument={currentMissingDocument}
          onOpen={() => void openMissingNavigator()}
          onClose={() => setMissingNavigatorOpen(false)}
          onReload={() => void loadMissingNavigatorDocuments()}
          onPrevious={() =>
            changeMissingNavigatorIndex(normalizedMissingNavigatorIndex - 1)
          }
          onNext={() =>
            changeMissingNavigatorIndex(normalizedMissingNavigatorIndex + 1)
          }
          onFocus={() => {
            if (currentMissingDocument) {
              void focusMissingNumberingDocument(currentMissingDocument)
            }
          }}
        />
      ) : null}
      {error ? (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
      {viewedNumberingState ? (
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <ListChecks className="mt-0.5 size-4 shrink-0" />
          <span>
            Đang xem bản lưu trạng thái {viewedNumberingState.position}/
            {viewedNumberingState.count}. Nội dung chỉ đọc và không thay đổi bản
            đang sử dụng.
          </span>
        </div>
      ) : null}
      {complete &&
      !viewingNumberingHistory &&
      blankPageWarningDocumentCount > 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            Đã đánh số xong. Có {blankPageWarningDocumentCount} tài liệu chứa
            cảnh báo từ bước xóa trang trắng. Các tài liệu này được gắn tag{" "}
            <strong>Cảnh báo trang trắng</strong> trong danh sách bên dưới.
          </span>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <NumberingStat
          label="Tổng tài liệu"
          value={displayedNumberingTotalDocuments}
        />
        <NumberingStat
          label="Đã đánh số"
          value={displayedNumberingDoneCount}
          tone="success"
        />
        <NumberingStat
          label="Chưa hoàn tất"
          value={viewedNumberingState ? 0 : unresolvedCount}
          tone={!viewedNumberingState && unresolvedCount ? "danger" : "neutral"}
        />
        <NumberingStat
          label="Lỗi"
          value={viewedNumberingState ? 0 : failedCount}
          tone={!viewedNumberingState && failedCount ? "danger" : "neutral"}
        />
      </div>
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)] xl:items-stretch">
        <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#CBD5E1] bg-white shadow-sm xl:h-[min(82svh,834px)] xl:min-h-[520px]">
          <div className="flex flex-col gap-3 border-b border-[#E2E8F0] px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#0F172A]">
                  Danh sách PDF đánh số
                </p>
                <p className="mt-1 text-xs text-[#64748B]">
                  {viewedNumberingState
                    ? "Các tài liệu thuộc snapshot đang xem; tài liệu đã xóa/chuyển được giữ read-only."
                    : "Các tài liệu được nhóm theo hồ sơ đang active."}
                </p>
              </div>
            </div>
            <label className="flex h-10 min-w-0 items-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-3 transition-colors focus-within:border-[#0052FF] focus-within:ring-2 focus-within:ring-[#0052FF]/15">
              <Search className="size-4 shrink-0 text-[#94A3B8]" />
              <input
                value={numberingFilter}
                onChange={(event) => setNumberingFilter(event.target.value)}
                placeholder="Lọc theo hồ sơ, hộp hoặc tên file"
                className="min-w-0 flex-1 bg-transparent text-sm text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
              />
              {numberingFilter ? (
                <button
                  type="button"
                  onClick={() => setNumberingFilter("")}
                  title="Xóa lọc"
                  aria-label="Xóa lọc"
                  className="flex size-6 shrink-0 items-center justify-center rounded-md text-[#64748B] hover:bg-[#F1F5F9]"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </label>
          </div>
          {loading ? (
            <div className="flex min-h-48 items-center justify-center text-sm text-[#64748B]">
              <Loader2 className="mr-2 size-4 animate-spin text-[#0052FF]" />
              Đang tải trạng thái đánh số...
            </div>
          ) : documentsByDossier.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center px-6 text-center text-sm text-[#64748B]">
              Chưa có tài liệu trong hồ sơ active để đánh số.
            </div>
          ) : filteredDocumentsByDossier.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center px-6 text-center text-sm text-[#64748B]">
              Không có hồ sơ hoặc tài liệu khớp bộ lọc.
            </div>
          ) : (
            <div className="min-h-0 flex-1 divide-y divide-[#E2E8F0] overflow-x-hidden overflow-y-auto">
              {pagedDocumentsByDossier.map((group) => {
                const dossierUpdateMode =
                  dossierUpdateModes[group.dossierId] ?? "auto"
                const hasNewNumberingDocuments = group.documents.some(
                  (document) =>
                    isAddedNumberingDocument(document, hasNumberingOutput)
                )
                const modeToggleDisabled =
                  starting ||
                  Boolean(status?.active) ||
                  updatingDocumentId !== null ||
                  retryingDocumentId !== null
                const firstDocument = group.documents[0]
                const metadataCountConflicts =
                  metadataCountConflictsByDossier.get(group.dossierId) ??
                  metadataCountConflictsByDossier.get(
                    firstDocument?.cluster_id ?? ""
                  ) ??
                  []
                const oldCountChoiceLabel = formatMetadataCountChoiceLabel(
                  metadataCountConflicts,
                  "old"
                )
                const newCountChoiceLabel = formatMetadataCountChoiceLabel(
                  metadataCountConflicts,
                  "new"
                )
                return (
                  <section key={group.dossierId} className="px-4 py-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#0F172A]">
                          {group.title || group.dossierId}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[#64748B]">
                          <span>{group.documents.length} tài liệu</span>
                          <DossierMetaChip
                            label="Hồ sơ số"
                            value={group.dossierNumber}
                          />
                          <DossierMetaChip
                            label="Hộp số"
                            value={group.boxNumber}
                          />
                          {metadataCountConflicts.map((conflict) => (
                            <span
                              key={`${conflict.field}:${conflict.old_value}:${conflict.new_value}`}
                              title={`Cũ: ${conflict.old_value} · Mới: ${conflict.new_value}`}
                              className="inline-flex shrink-0 items-center rounded-full border border-[#F59E0B] bg-[#FFFBEB] px-2 py-0.5 text-[10px] font-semibold text-[#92400E]"
                            >
                              <AlertTriangle className="mr-1 size-3" />
                              {conflict.tag}
                            </span>
                          ))}
                          {metadataCountConflicts.length > 0 ? (
                            <span className="inline-flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  void keepOldMetadataCountsForDossier(
                                    metadataCountConflicts
                                  )
                                }
                                disabled={metadataBusy || active}
                                title="Giữ số cũ cho hồ sơ này"
                                className="inline-flex h-6 items-center gap-1 rounded-md border border-[#F59E0B] bg-white px-2 text-[10px] font-semibold text-[#92400E] transition-colors hover:bg-[#FFFBEB] disabled:pointer-events-none disabled:opacity-50"
                              >
                                <RotateCcw className="size-3" />
                                Giữ số cũ
                                {oldCountChoiceLabel
                                  ? ` (${oldCountChoiceLabel})`
                                  : ""}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void confirmMetadataCountConflictsForDossier(
                                    metadataCountConflicts
                                  )
                                }
                                disabled={metadataBusy || active}
                                title="Dùng số mới cho hồ sơ này"
                                className="inline-flex h-6 items-center gap-1 rounded-md bg-[#0052FF] px-2 text-[10px] font-semibold text-white transition-colors hover:bg-[#0046D8] disabled:pointer-events-none disabled:opacity-50"
                              >
                                <Check className="size-3" />
                                Dùng số mới
                                {newCountChoiceLabel
                                  ? ` (${newCountChoiceLabel})`
                                  : ""}
                              </button>
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {hasNewNumberingDocuments && !viewingNumberingHistory ? (
                        <DossierNumberingModeToggle
                          updateMode={dossierUpdateMode}
                          disabled={modeToggleDisabled}
                          onChange={(mode) =>
                            setDossierUpdateModes((current) => ({
                              ...current,
                              [group.dossierId]: mode,
                            }))
                          }
                        />
                      ) : null}
                    </div>
                    <div className="grid gap-1.5">
                      {group.documents.map((document) => {
                        const isAddedDocument = isAddedNumberingDocument(
                          document,
                          hasNumberingOutput
                        )
                        const updateMode: NumberingUpdateMode = isAddedDocument
                          ? dossierUpdateMode
                          : "cascade"
                        const numberingEntryKey =
                          document.numbering_entries
                            ?.map(
                              (entry) => `${entry.page_number}:${entry.label}`
                            )
                            .join("|") ?? ""
                        return (
                          <NumberingDocumentRow
                            key={[
                              document.session_document_id,
                              document.document_number_start,
                              document.document_number_end,
                              updateMode,
                              numberingEntryKey,
                            ].join(":")}
                            document={document}
                            updateMode={updateMode}
                            previewing={
                              previewDocumentId === document.session_document_id
                            }
                            highlighted={
                              highlightedDocumentId ===
                              document.session_document_id
                            }
                            onPreview={() =>
                              setPreviewDocumentId(document.session_document_id)
                            }
                            onUpdateFromPage={updateDocumentNumberFromPage}
                            updating={
                              updatingDocumentId ===
                              document.session_document_id
                            }
                            retrying={
                              retryingDocumentId ===
                              document.session_document_id
                            }
                            retryable={
                              canManageNumbering &&
                              !viewingNumberingHistory &&
                              !document.historical_only &&
                              hasNumberingOutput &&
                              document.status !== "running"
                            }
                            stalled={
                              stoppedWithUnresolved &&
                              document.status !== "done" &&
                              document.status !== "failed" &&
                              document.status !== "running"
                            }
                            onRetry={retryIncompleteDocument}
                            disabled={
                              starting ||
                              viewingNumberingHistory ||
                              Boolean(status?.active) ||
                              !canManageNumbering ||
                              Boolean(document.historical_only) ||
                              updatingDocumentId !== null ||
                              retryingDocumentId !== null
                            }
                          />
                        )
                      })}
                    </div>
                  </section>
                )
              })}
            </div>
          )}
          {filteredDocumentsByDossier.length > 0 ? (
            <div className="border-t border-[#E2E8F0] px-4 py-3">
              <PaginationControls
                total={numberingPaginationTotal}
                pageIndex={normalizedNumberingPageIndex}
                pageSize={NUMBERING_PAGE_SIZE}
                pageCount={numberingPageCount}
                startNumber={
                  numberingPaginationTotal === 0 ? 0 : numberingPageOffset + 1
                }
                endNumber={
                  numberingPaginationTotal === 0
                    ? 0
                    : Math.min(
                        numberingPaginationTotal,
                        numberingPageOffset + numberingPageReturned
                      )
                }
                itemLabel={viewingNumberingHistory ? "tài liệu" : "hồ sơ"}
                onPageChange={(pageIndex) => {
                  if (viewingNumberingHistory) {
                    void loadViewedNumberingStatePage(pageIndex)
                  } else {
                    setNumberingPageIndex(pageIndex)
                    void refreshStatus({
                      silent: true,
                      includeDocuments: true,
                      pageIndex,
                    })
                  }
                }}
              />
            </div>
          ) : null}
        </div>
        <NumberedPdfPreviewPanel
          document={previewDocument}
          previewUrl={previewUrl}
          loading={previewLoading}
          error={previewError}
          onRefresh={() => setPreviewRefreshKey((key) => key + 1)}
          onClose={() => setPreviewDocumentId(null)}
        />
      </div>
      <NumberingStepFooter
        active={active || viewingNumberingHistory}
        metadataBusy={metadataBusy}
        canContinue={!viewingNumberingHistory && canContinue}
        blockedReason={
          viewingNumberingHistory
            ? "Hãy quay về Bản đang dùng trước khi tiếp tục."
            : continueBlockedReason
        }
        dossiersWithoutBoxCount={dossiersWithoutBoxCount}
        doneCount={doneCount}
        totalDocuments={totalDocuments}
        failedCount={failedCount}
        unresolvedCount={unresolvedCount}
        workingActions={
          timelineEnabled && !viewingNumberingHistory ? (
            <NumberingTimelineWorkingActions
              embedded
              busy={timelineMutating || active}
              canDiscard={
                canManageNumbering && Boolean(numberingState?.can_discard)
              }
              canSave={canSaveNumberingState}
              discardBlockedReason={numberingState?.discard_blocked_reason}
              onDiscard={() => mutateNumberingTimeline("discard")}
              onSave={() => mutateNumberingTimeline("save")}
            />
          ) : null
        }
        onContinue={onContinue}
      />
    </div>
  )
}

type NumberingDossierGroup = ReturnType<typeof groupDocumentsByDossier>[number]

function MissingNumberingNavigator({
  unresolvedCount,
  failedCount,
  pendingCount,
  open,
  loading,
  error,
  documents,
  currentIndex,
  currentDocument,
  onOpen,
  onClose,
  onReload,
  onPrevious,
  onNext,
  onFocus,
}: {
  unresolvedCount: number
  failedCount: number
  pendingCount: number
  open: boolean
  loading: boolean
  error: string
  documents: NumberingDocumentStatus[]
  currentIndex: number
  currentDocument: NumberingDocumentStatus | null
  onOpen: () => void
  onClose: () => void
  onReload: () => void
  onPrevious: () => void
  onNext: () => void
  onFocus: () => void
}) {
  const badge = currentDocument ? statusBadge(currentDocument.status) : null
  const atStart = currentIndex <= 0
  const atEnd = currentIndex >= documents.length - 1

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            Còn {unresolvedCount} tài liệu chưa hoàn tất nhưng không có job đánh
            số đang chạy.
            {failedCount > 0
              ? ` Có ${failedCount} tài liệu lỗi.`
              : pendingCount > 0
                ? " Một số lỗi render có thể đang được backend trả về trạng thái chờ xử lý."
                : ""}{" "}
            Có thể mở từng tài liệu còn thiếu số để kiểm tra và xử lý tại dòng
            tương ứng.
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {open ? (
            <button
              type="button"
              onClick={onReload}
              disabled={loading}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-3 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100 disabled:pointer-events-none disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ListChecks className="size-4" />
              )}
              Cập nhật
            </button>
          ) : null}
          <button
            type="button"
            onClick={open ? onClose : onOpen}
            disabled={loading && !open}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:pointer-events-none disabled:opacity-60"
          >
            {loading && !open ? (
              <Loader2 className="size-4 animate-spin" />
            ) : open ? (
              <X className="size-4" />
            ) : (
              <ListChecks className="size-4" />
            )}
            {open ? "Ẩn danh sách" : "Xem tài liệu thiếu số"}
          </button>
        </div>
      </div>

      {open ? (
        <div className="grid gap-3 rounded-lg border border-amber-200 bg-white px-3 py-3 text-[#0F172A] md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
          <button
            type="button"
            onClick={onPrevious}
            disabled={loading || atStart || documents.length <= 0}
            title="Tài liệu trước"
            aria-label="Tài liệu trước"
            className="inline-flex size-9 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white text-[#475569] transition-colors hover:border-[#0052FF]/40 hover:text-[#0052FF] disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
          </button>

          <div className="min-w-0">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-[#64748B]">
                <Loader2 className="size-4 animate-spin text-[#0052FF]" />
                Đang tải tài liệu thiếu số...
              </div>
            ) : error ? (
              <p className="text-sm font-medium text-rose-700">{error}</p>
            ) : currentDocument ? (
              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="rounded-md bg-[#F1F5F9] px-2 py-1 text-xs font-semibold text-[#475569] tabular-nums">
                    {currentIndex + 1}/{documents.length}
                  </span>
                  {badge ? (
                    <span
                      className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  ) : null}
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[#0F172A]">
                    {currentDocument.file_name || currentDocument.document_id}
                  </p>
                </div>
                <p className="truncate text-xs text-[#64748B]">
                  {currentDocument.dossier_title ||
                    currentDocument.dossier_id ||
                    "Chưa có hồ sơ"}
                </p>
              </div>
            ) : (
              <p className="text-sm font-medium text-emerald-700">
                Không còn tài liệu thiếu số.
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onFocus}
              disabled={loading || !currentDocument}
              title="Tới tài liệu đang chọn"
              aria-label="Tới tài liệu đang chọn"
              className="inline-flex size-9 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white text-[#475569] transition-colors hover:border-[#0052FF]/40 hover:text-[#0052FF] disabled:pointer-events-none disabled:opacity-40"
            >
              <Target className="size-4" />
            </button>
            <button
              type="button"
              onClick={onNext}
              disabled={loading || atEnd || documents.length <= 0}
              title="Tài liệu sau"
              aria-label="Tài liệu sau"
              className="inline-flex size-9 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white text-[#475569] transition-colors hover:border-[#0052FF]/40 hover:text-[#0052FF] disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function isMissingNumberingDocument(
  document: NumberingDocumentStatus
): boolean {
  if (document.historical_only) return false
  return String(document.status || "").toLowerCase() !== "done"
}

function cleanNumberingStyleOverrides(
  overrides: NumberingStyleOverrides | null | undefined
): NumberingStyleOverrides {
  const clean: NumberingStyleOverrides = {}
  if (
    typeof overrides?.font_size === "number" &&
    Number.isFinite(overrides.font_size)
  ) {
    clean.font_size = overrides.font_size
  }
  if (typeof overrides?.color === "string" && overrides.color.trim()) {
    clean.color = overrides.color.trim()
  }
  if (
    typeof overrides?.opacity === "number" &&
    Number.isFinite(overrides.opacity)
  ) {
    clean.opacity = overrides.opacity
  }
  return clean
}

function numberingStyleOverridesEqual(
  left: NumberingStyleOverrides | null | undefined,
  right: NumberingStyleOverrides | null | undefined
): boolean {
  const cleanLeft = cleanNumberingStyleOverrides(left)
  const cleanRight = cleanNumberingStyleOverrides(right)
  return (
    cleanLeft.font_size === cleanRight.font_size &&
    cleanLeft.color === cleanRight.color &&
    cleanLeft.opacity === cleanRight.opacity
  )
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

function groupMetadataCountConflicts(
  conflicts: MetadataCountConflict[]
): Map<string, MetadataCountConflict[]> {
  const grouped = new Map<string, MetadataCountConflict[]>()
  const signaturesByKey = new Map<string, Set<string>>()
  for (const conflict of conflicts) {
    const keys = new Set(
      [conflict.dossier_id, conflict.cluster_id]
        .map((key) => String(key || "").trim())
        .filter(Boolean)
    )
    const signature = [
      conflict.field,
      conflict.old_value,
      conflict.new_value,
    ].join(":")
    for (const normalizedKey of keys) {
      const signatures = signaturesByKey.get(normalizedKey) ?? new Set()
      if (signatures.has(signature)) {
        continue
      }
      const current = grouped.get(normalizedKey) ?? []
      current.push(conflict)
      grouped.set(normalizedKey, current)
      signatures.add(signature)
      signaturesByKey.set(normalizedKey, signatures)
    }
  }
  return grouped
}

function formatMetadataCountChoiceLabel(
  conflicts: MetadataCountConflict[],
  choice: "old" | "new"
): string {
  return conflicts
    .map((conflict) => {
      const fieldLabel = conflict.field === "sheet_count" ? "tờ" : "trang"
      const value = choice === "old" ? conflict.old_value : conflict.new_value
      return `${fieldLabel} ${value}`
    })
    .join(", ")
}

function nextNumberingPrefetchPageIndex(
  pageIndex: number,
  pageSize: number,
  status: NumberingStatusResponse
): number | null {
  const total = Math.max(
    status.pagination?.total ?? 0,
    status.summary.total_dossiers ?? 0,
    status.dossiers.length
  )
  const nextPageIndex = pageIndex + 1
  return nextPageIndex * pageSize < total ? nextPageIndex : null
}

function isAddedNumberingDocument(
  document: NumberingDocumentStatus,
  hasNumberingOutput: boolean
): boolean {
  if (!hasNumberingOutput) return false
  const changeStatus = String(
    document.document_change_status || ""
  ).toLowerCase()
  if (!["added", "moved_cluster", "moved_dossier"].includes(changeStatus)) {
    return false
  }
  return document.status !== "done" && document.status !== "running"
}

function filterNumberingDossierGroups(
  groups: NumberingDossierGroup[],
  normalizedFilter: string
): NumberingDossierGroup[] {
  if (!normalizedFilter) return groups
  return groups.flatMap((group) => {
    if (numberingGroupMatches(group, normalizedFilter)) return [group]
    const documents = group.documents.filter((document) =>
      numberingDocumentMatches(document, normalizedFilter)
    )
    return documents.length > 0 ? [{ ...group, documents }] : []
  })
}

function numberingGroupMatches(
  group: NumberingDossierGroup,
  normalizedFilter: string
): boolean {
  return normalizeSearchText(
    [
      group.title,
      group.dossierId,
      group.dossierNumber,
      group.boxNumber,
      group.hosoId,
      group.hopId,
    ].join(" ")
  ).includes(normalizedFilter)
}

function numberingDocumentMatches(
  document: NumberingDocumentStatus,
  normalizedFilter: string
): boolean {
  return normalizeSearchText(
    [
      document.file_name,
      document.data_path,
      document.document_id,
      document.dossier_title,
      document.dossier_number,
      document.box_number,
      document.hoso_id,
      document.hop_id,
      document.status,
    ].join(" ")
  ).includes(normalizedFilter)
}

function normalizeSearchText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}
