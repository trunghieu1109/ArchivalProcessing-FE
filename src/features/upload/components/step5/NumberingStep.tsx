import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, Loader2, Search, X } from "lucide-react"
import { toast } from "sonner"
import { visibleAwareDelay } from "@/shared/lib/pageVisibility"
import { ProgressTimeline } from "@/features/upload/components/ProgressTimeline"
import { PaginationControls } from "@/features/upload/components/PaginationControls"
import {
  downloadArtifact,
  enqueueDocumentNumbering,
  exportMetadataSnapshot,
  getDocumentNumberingStatus,
  getNumberedDocumentPreviewUrl,
  getNumberingStyles,
  importMetadataBoxNumbers as importMetadataBoxNumbersApi,
  updateDocumentNumberingFromPage,
  type DocumentNumberingMode,
  type DocumentNumberingStylePreset,
  type NumberingDocumentStatus,
  type NumberingStatusResponse,
  type NumberingStyleOption,
} from "@/features/upload/api/sessionApi"
import {
  DossierMetaChip,
  NumberingDocumentRow,
  NumberingMetadataPanel,
  NumberingStat,
  NumberingStepFooter,
  NumberingStepHeader,
} from "./NumberingStep.parts"
import { NumberedPdfPreviewPanel } from "./NumberingStep.preview"
import {
  groupDocumentsByDossier,
  isNumberingComplete,
  numberingEntries,
  saveBlob,
  textOrNull,
} from "./NumberingStep.utils"

const NUMBERING_POLL_INTERVAL_MS = 5_000
const NUMBERING_DOCUMENT_REFRESH_EVERY = 3
const NUMBERING_PAGE_SIZE = 10
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
  onDocumentNumberingModeChange: (
    mode: DocumentNumberingMode
  ) => Promise<boolean | void>
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
  onDocumentNumberingModeChange,
  documentNumberingStylePreset,
  documentNumberingStyleOverrides,
  onDocumentNumberingStyleApplied,
  autoStart = false,
  onAutoStartHandled,
  onContinue,
}: NumberingStepProps) {
  const autoStartedSessionRef = useRef<string | null>(null)
  const [status, setStatus] = useState<NumberingStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [changingMode, setChangingMode] = useState(false)
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
  const [numberingFilter, setNumberingFilter] = useState("")
  const [numberingPageIndex, setNumberingPageIndex] = useState(0)
  const [metadataExporting, setMetadataExporting] = useState(false)
  const [metadataImporting, setMetadataImporting] = useState(false)
  const metadataImportInputRef = useRef<HTMLInputElement | null>(null)
  const numberingPageCacheSessionRef = useRef<string | null>(null)
  const numberingPageCacheRef = useRef<Map<number, NumberingStatusResponse>>(
    new Map()
  )
  const prefetchingNumberingPagesRef = useRef<Set<number>>(new Set())
  const numberingDocumentsRevisionRef = useRef<string | null>(null)
  const [completedPhases, setCompletedPhases] = useState<Set<string>>(
    () => new Set()
  )
  const statusForCurrentSession =
    status?.session_id === sessionId ? status : null
  const appliedStylePreset =
    statusForCurrentSession?.document_numbering_style_preset ||
    documentNumberingStylePreset
  const appliedStyleOverrides = useMemo(
    () =>
      cleanNumberingStyleOverrides(
        statusForCurrentSession
          ? statusForCurrentSession.document_numbering_style_overrides
          : documentNumberingStyleOverrides
      ),
    [documentNumberingStyleOverrides, statusForCurrentSession]
  )
  const hasPendingStyleChanges =
    stylePresetDraft !== appliedStylePreset ||
    !numberingStyleOverridesEqual(styleOverridesDraft, appliedStyleOverrides)

  useEffect(() => {
    if (numberingPageCacheSessionRef.current === sessionId) return
    numberingPageCacheSessionRef.current = sessionId
    numberingPageCacheRef.current.clear()
    prefetchingNumberingPagesRef.current.clear()
    numberingDocumentsRevisionRef.current = null
    setNumberingPageIndex(0)
  }, [sessionId])

  useEffect(() => {
    const sessionChanged = styleDraftSessionRef.current !== sessionId
    if (!sessionChanged && styleDraftDirty) return
    styleDraftSessionRef.current = sessionId
    setStylePresetDraft(appliedStylePreset)
    setStyleOverridesDraft(appliedStyleOverrides)
    setStyleDraftDirty(false)
  }, [appliedStyleOverrides, appliedStylePreset, sessionId, styleDraftDirty])

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
      try {
        const response = await fetchNumberingPageStatus(pageIndex)
        if (response) numberingPageCacheRef.current.set(pageIndex, response)
      } catch {
        // Prefetch is best-effort; visible refreshes surface real errors.
      } finally {
        prefetchingNumberingPagesRef.current.delete(pageIndex)
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
      } = {}
    ) => {
      if (!sessionId) {
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
      try {
        const includeDocuments = options.includeDocuments ?? true
        const pageSize = NUMBERING_PAGE_SIZE
        const pageIndex = Math.max(
          0,
          Math.floor(Number(options.pageIndex ?? numberingPageIndex) || 0)
        )
        if (includeDocuments && options.force) {
          numberingPageCacheRef.current.clear()
          prefetchingNumberingPagesRef.current.clear()
        }

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
        if (!response) return null
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
        setStatus((current) => {
          if (includeDocuments || !current) return response
          return {
            ...response,
            documents: current.documents,
            pagination: mergeNumberingPaginationTotal(
              current.pagination,
              response.pagination
            ),
          }
        })
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
        const message =
          err instanceof Error
            ? err.message
            : "Không tải được trạng thái đánh số."
        if (!options.silent) setError(message)
        return null
      } finally {
        if (!options.silent) setLoading(false)
      }
    },
    [
      fetchNumberingPageStatus,
      numberingPageIndex,
      prefetchNumberingPage,
      sessionId,
    ]
  )

  const startNumbering = useCallback(
    async (force = false) => {
      if (!sessionId) {
        toast.error("Chưa có session để đánh số trang.")
        return
      }
      const shouldForce = force || hasPendingStyleChanges
      setStarting(true)
      setError("")
      setProgressPhase("loading_data")
      setProgressMessage(
        shouldForce
          ? "Đang gửi yêu cầu đánh số lại theo cấu hình hiện tại."
          : "Đang gửi yêu cầu đánh số trang."
      )
      setCompletedPhases(new Set())
      try {
        const response = await enqueueDocumentNumbering(sessionId, {
          created_by: "ui",
          force: shouldForce,
          document_numbering_style_preset: stylePresetDraft,
          document_numbering_style_overrides: styleOverridesDraft,
        })
        onDocumentNumberingStyleApplied?.(stylePresetDraft, styleOverridesDraft)
        setStatus((current) =>
          current?.session_id === sessionId
            ? {
                ...current,
                document_numbering_style_preset: stylePresetDraft,
                document_numbering_style_overrides: styleOverridesDraft,
              }
            : current
        )
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
            shouldForce
              ? "Đã gửi task đánh số lại."
              : "Đã gửi task đánh số trang."
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
      hasPendingStyleChanges,
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
      newNumber: number
    ) => {
      if (!sessionId) {
        toast.error("Chưa có session để cập nhật số.")
        return
      }
      if (!Number.isFinite(anchorPageNumber) || anchorPageNumber < 1) {
        toast.error("Trang cần sửa phải lớn hơn hoặc bằng 1.")
        return
      }
      if (!Number.isFinite(newNumber) || newNumber < 1) {
        toast.error("Số mới phải lớn hơn hoặc bằng 1.")
        return
      }
      setUpdatingDocumentId(document.session_document_id)
      setPreviewDocumentId(document.session_document_id)
      setError("")
      setProgressPhase("loading_data")
      setProgressMessage("Đang gửi yêu cầu cập nhật số.")
      setCompletedPhases(new Set())
      try {
        const response = await updateDocumentNumberingFromPage(
          sessionId,
          document.session_document_id,
          {
            anchor_page_number: anchorPageNumber,
            new_number: newNumber,
            created_by: "ui",
            force: true,
          }
        )
        if (response.created) {
          toast.success("Đã gửi task cập nhật số.")
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

      setRetryingDocumentId(document.session_document_id)
      setPreviewDocumentId(document.session_document_id)
      setError("")
      setProgressPhase("loading_data")
      setProgressMessage(
        `Đang gửi yêu cầu đánh số lại ${document.file_name || document.document_id}.`
      )
      setCompletedPhases(new Set())
      const entries = numberingEntries(document)
      const firstEntry = entries[0]
      const anchorPageNumber = firstEntry?.page_number ?? 1
      const currentNumber =
        Number.parseInt(String(firstEntry?.label ?? ""), 10) ||
        document.document_number_start ||
        1
      try {
        const response = await updateDocumentNumberingFromPage(
          sessionId,
          document.session_document_id,
          {
            anchor_page_number: anchorPageNumber,
            new_number: currentNumber,
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
    [
      refreshStatus,
      sessionId,
      starting,
      status?.active,
    ]
  )

  const exportMetadata = useCallback(async () => {
    if (!sessionId) {
      toast.error("Chưa có session để xuất metadata.")
      return
    }
    setMetadataExporting(true)
    setError("")
    try {
      const result = await exportMetadataSnapshot(sessionId, {
        created_by: "ui",
      })
      const artifact = result.artifact ?? result.artifacts[0]
      if (!artifact) {
        throw new Error("Backend chưa trả về artifact metadata.")
      }
      toast.success("Đã tạo snapshot metadata. Đang tải file.")
      const download = await downloadArtifact(sessionId, artifact.id)
      saveBlob(download.blob, download.fileName)
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
  }, [sessionId])

  const importMetadataBoxNumbers = useCallback(
    async (file: File | null) => {
      if (!file) return
      if (!sessionId) {
        toast.error("Chưa có session để nhập số hộp.")
        return
      }
      if (!file.name.toLowerCase().endsWith(".xlsx")) {
        toast.error("File nhập số hộp phải là .xlsx.")
        return
      }

      setMetadataImporting(true)
      setError("")
      try {
        const result = await importMetadataBoxNumbersApi(sessionId, file, {
          created_by: "ui",
        })
        toast.success(
          `Đã cập nhật số hộp cho ${result.updated_dossiers} hồ sơ.`
        )
        const issueCount = result.unmatched_rows + result.conflict_count
        if (issueCount > 0) {
          toast.info(
            `Có ${issueCount} dòng chưa cập nhật được do chưa khớp hồ sơ hoặc bị trùng số hộp.`
          )
        }
        await refreshStatus({ silent: true, force: true })
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Không thể nhập số hộp từ metadata."
        setError(message)
        toast.error(message)
      } finally {
        setMetadataImporting(false)
      }
    },
    [refreshStatus, sessionId]
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
      })
      if (cancelled) return
      const nextDocumentsRevision = revisionToken(response?.documents_revision)
      const documentsChanged =
        nextDocumentsRevision !== null &&
        nextDocumentsRevision !== previousDocumentsRevision
      const periodicDocumentRefresh =
        pollCount % NUMBERING_DOCUMENT_REFRESH_EVERY === 0
      const shouldRefreshDocuments =
        !response?.active ||
        documentsChanged ||
        periodicDocumentRefresh
      if (shouldRefreshDocuments) {
        void refreshStatus({
          silent: true,
          includeDocuments: true,
          force: true,
        })
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
        const warningCount =
          response.summary.blank_page_warning_documents ?? 0
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
  }, [refreshStatus, sessionId, starting, status?.active])

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

  const documentsByDossier = useMemo(
    () => groupDocumentsByDossier(status?.documents ?? []),
    [status?.documents]
  )
  const dossiersWithoutBoxCount = useMemo(
    () =>
      documentsByDossier.filter((group) => !textOrNull(group.boxNumber)).length,
    [documentsByDossier]
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
  const numberingPaginationTotal =
    status?.pagination?.total ?? status?.summary.total_dossiers ?? 0
  const numberingPageCount = Math.max(
    1,
    Math.ceil(numberingPaginationTotal / NUMBERING_PAGE_SIZE)
  )
  const normalizedNumberingPageIndex = Math.min(
    Math.max(0, numberingPageIndex),
    numberingPageCount - 1
  )
  const numberingPageOffset =
    status?.pagination?.offset ??
    normalizedNumberingPageIndex * NUMBERING_PAGE_SIZE
  const numberingPageReturned =
    status?.pagination?.returned ?? filteredDocumentsByDossier.length
  const previewDocument = useMemo(
    () =>
      (status?.documents ?? []).find(
        (document) => document.session_document_id === previewDocumentId
      ) ?? null,
    [previewDocumentId, status?.documents]
  )
  const previewSessionDocumentId = previewDocument?.session_document_id ?? null
  const previewPdfVersionId = previewDocument?.numbered_pdf_version_id ?? null

  useEffect(() => {
    if (
      !sessionId ||
      previewSessionDocumentId === null ||
      previewPdfVersionId === null ||
      previewPdfVersionId === ""
    ) {
      setPreviewUrl("")
      setPreviewError("")
      setPreviewLoading(false)
      return
    }

    let cancelled = false
    setPreviewUrl("")
    setPreviewError("")
    setPreviewLoading(true)
    getNumberedDocumentPreviewUrl(sessionId, previewSessionDocumentId)
      .then((response) => {
        if (!cancelled) setPreviewUrl(response.download_url)
      })
      .catch((err) => {
        if (cancelled) return
        setPreviewError(
          err instanceof Error
            ? err.message
            : "Không thể cấp URL preview PDF đã đánh số."
        )
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [
    previewPdfVersionId,
    previewRefreshKey,
    previewSessionDocumentId,
    sessionId,
  ])
  const totalDocuments = status?.summary.total_documents ?? 0
  const doneCount = status?.summary.done ?? 0
  const failedCount = status?.summary.failed ?? 0
  const pendingCount = status?.summary.pending ?? 0
  const blankPageWarningDocumentCount =
    status?.summary.blank_page_warning_documents ?? 0
  const unresolvedCount = Math.max(0, totalDocuments - doneCount)
  const hasNumberingOutput = doneCount > 0 || failedCount > 0
  const complete = Boolean(status && isNumberingComplete(status))
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
  const blockedReason = useMemo(() => {
    const reasons: string[] = []
    if (metadataBusy) {
      reasons.push("Đang cập nhật metadata. Hãy chờ xong rồi tạo mục lục.")
    }
    if (failedCount > 0) {
      reasons.push(`Còn ${failedCount} tài liệu lỗi.`)
    }
    if (unresolvedCount > 0) {
      reasons.push(
        `Còn ${unresolvedCount} tài liệu chưa hoàn tất hoặc vừa được cập nhật số đánh.`
      )
    }
    if (dossiersWithoutBoxCount > 0) {
      reasons.push(
        `Chưa nhập số hộp cho ${dossiersWithoutBoxCount} hồ sơ.`
      )
    }
    return reasons.join(" ")
  }, [dossiersWithoutBoxCount, failedCount, metadataBusy, unresolvedCount])
  const canContinue =
    complete &&
    failedCount === 0 &&
    unresolvedCount === 0 &&
    dossiersWithoutBoxCount === 0
  const canRestartNumbering = hasNumberingOutput
  const changeNumberingMode = async (mode: DocumentNumberingMode) => {
    if (active || changingMode || mode === documentNumberingMode) return
    const hadCompletedNumbering = complete
    setChangingMode(true)
    setError("")
    try {
      const saved = await onDocumentNumberingModeChange(mode)
      if (saved === false) return
      await refreshStatus({ silent: true, force: true })
      setProgressPhase(null)
      setProgressMessage("")
      setCompletedPhases(new Set())
      if (hadCompletedNumbering) {
        toast.info("Đã đổi cách đánh số. Vui lòng đánh số lại tài liệu.")
      }
    } finally {
      setChangingMode(false)
    }
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
  const modeLabel =
    documentNumberingMode === "sheet" ? "Đánh số theo tờ" : "Đánh số theo trang"

  return (
    <div className="flex flex-col gap-5">
      <NumberingStepHeader
        modeLabel={modeLabel}
        documentNumberingMode={documentNumberingMode}
        documentNumberingStylePreset={stylePresetDraft}
        documentNumberingStyleOverrides={styleOverridesDraft}
        numberingStyleOptions={numberingStyleOptions}
        changingMode={changingMode}
        loading={loading}
        starting={starting}
        active={active}
        complete={complete}
        hasPendingStyleChanges={hasPendingStyleChanges}
        canRestart={canRestartNumbering}
        onRefresh={() => refreshStatus({ force: true })}
        onStart={() => startNumbering(false)}
        onRestart={() => startNumbering(true)}
        onModeChange={changeNumberingMode}
        onStyleChange={changeNumberingStyle}
        onOverridesChange={changeNumberingStyleOverrides}
      />
      <NumberingMetadataPanel
        metadataImportInputRef={metadataImportInputRef}
        sessionId={sessionId}
        active={active}
        metadataBusy={metadataBusy}
        metadataExporting={metadataExporting}
        metadataImporting={metadataImporting}
        onExportMetadata={exportMetadata}
        onImportMetadataBoxNumbers={importMetadataBoxNumbers}
      />
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
      {stoppedWithUnresolved ? (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              Còn {unresolvedCount} tài liệu chưa hoàn tất nhưng không có job
              đánh số đang chạy.
              {failedCount > 0
                ? ` Có ${failedCount} tài liệu lỗi.`
                : pendingCount > 0
                  ? " Một số lỗi render có thể đang được backend trả về trạng thái chờ xử lý."
                  : ""}{" "}
              Hãy bấm <strong>Đánh số lại</strong> ở dòng tài liệu cần xử lý,
              hoặc chạy lại phần còn thiếu.
            </span>
          </div>
          <button
            type="button"
            onClick={() => void startNumbering(false)}
            disabled={active || starting}
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-amber-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:pointer-events-none disabled:opacity-60"
          >
            Đánh số lại phần còn thiếu
          </button>
        </div>
      ) : null}
      {error ? (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
      {complete && blankPageWarningDocumentCount > 0 ? (
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
        <NumberingStat label="Tổng tài liệu" value={totalDocuments} />
        <NumberingStat label="Đã đánh số" value={doneCount} tone="success" />
        <NumberingStat
          label="Chưa hoàn tất"
          value={unresolvedCount}
          tone={unresolvedCount ? "danger" : "neutral"}
        />
        <NumberingStat
          label="Lỗi"
          value={failedCount}
          tone={failedCount ? "danger" : "neutral"}
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
                  Các tài liệu được nhóm theo hồ sơ đang active.
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
              {pagedDocumentsByDossier.map((group) => (
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
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    {group.documents.map((document) => (
                      <NumberingDocumentRow
                        key={document.session_document_id}
                        document={document}
                        previewing={
                          previewDocumentId === document.session_document_id
                        }
                        onPreview={() =>
                          setPreviewDocumentId(document.session_document_id)
                        }
                        onUpdateFromPage={updateDocumentNumberFromPage}
                        updating={
                          updatingDocumentId === document.session_document_id
                        }
                        retrying={
                          retryingDocumentId === document.session_document_id
                        }
                        retryable={
                          hasNumberingOutput && document.status !== "running"
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
                          Boolean(status?.active) ||
                          updatingDocumentId !== null ||
                          retryingDocumentId !== null
                        }
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
          {filteredDocumentsByDossier.length > 0 && (
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
                itemLabel="hồ sơ"
                onPageChange={(pageIndex) => {
                  setNumberingPageIndex(pageIndex)
                  void refreshStatus({
                    silent: true,
                    includeDocuments: true,
                    pageIndex,
                  })
                }}
              />
            </div>
          )}
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
        active={active}
        metadataBusy={metadataBusy}
        canContinue={canContinue}
        blockedReason={blockedReason}
        doneCount={doneCount}
        totalDocuments={totalDocuments}
        failedCount={failedCount}
        unresolvedCount={unresolvedCount}
        onContinue={onContinue}
      />
    </div>
  )
}

type NumberingDossierGroup = ReturnType<typeof groupDocumentsByDossier>[number]

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

function mergeNumberingPaginationTotal(
  current: NumberingStatusResponse["pagination"] | undefined,
  next: NumberingStatusResponse["pagination"] | undefined
): NumberingStatusResponse["pagination"] | undefined {
  if (!current) return next
  if (!next) return current
  return {
    ...current,
    total: next.total,
  }
}

function mergeCachedNumberingPage(
  current: NumberingStatusResponse | null,
  cached: NumberingStatusResponse
): NumberingStatusResponse {
  if (!current) return cached
  return {
    ...cached,
    revision: current.revision,
    documents_revision: current.documents_revision,
    updated_at: current.updated_at,
    last_event_id: current.last_event_id,
    session_id: current.session_id,
    cluster_version_id: current.cluster_version_id,
    document_numbering_mode: current.document_numbering_mode,
    document_numbering_style_preset: current.document_numbering_style_preset,
    document_numbering_style_overrides:
      current.document_numbering_style_overrides,
    active: current.active,
    job: current.job,
    summary: current.summary,
    pagination: mergeCachedNumberingPagination(
      current.pagination,
      cached.pagination
    ),
    documents: cached.documents,
    dossiers: cached.dossiers,
  }
}

function mergeCachedNumberingPagination(
  current: NumberingStatusResponse["pagination"] | undefined,
  cached: NumberingStatusResponse["pagination"] | undefined
): NumberingStatusResponse["pagination"] | undefined {
  if (!cached) return current
  if (!current) return cached
  return {
    ...cached,
    total: current.total,
  }
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
