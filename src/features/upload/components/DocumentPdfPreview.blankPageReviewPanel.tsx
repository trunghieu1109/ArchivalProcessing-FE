import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  Check,
  Eye,
  Loader2,
  RotateCcw,
  Trash2,
} from "lucide-react"
import type { PDFDocumentProxy } from "pdfjs-dist"
import {
  buildPrefetchWindow,
  computePdfPreviewTargetWidth,
  createCanvasFromRenderedPage,
  createPdfDocumentLoadingTask,
  isPdfRenderCancelled,
  pdfPageRenderCache,
  prefetchPdfPageNumbers,
  type OptionalContentConfigPromise,
} from "./DocumentPdfPreview.pdfjs"
import { Button } from "@/components/ui/button"
import { cn } from "@/shared/lib/utils"
import {
  buildBlankPageReviewMapping,
  type BlankPageReviewMapping,
  sortedPageSet,
} from "./DocumentPdfPreview.blankPageReview"
import type { PreviewVariantState } from "./DocumentPdfPreview.types"
import { compactPageList, pdfEmbedUrl } from "./DocumentPdfPreview.utils"



interface BlankPageReviewPanelProps {
  variant: PreviewVariantState
  sourceVariant?: PreviewVariantState | null
  reviewMode: BlankPageReviewMode
  submitting: boolean
  submitError: string
  onReviewModeChange: (mode: BlankPageReviewMode) => void
  onSubmit: (blankPages: number[]) => Promise<void> | void
}

interface PdfLoadState {
  url: string
  document: PDFDocumentProxy | null
  pageCount: number
  error: string
}

export type BlankPageReviewMode = "preview" | "select"
const BLANK_PAGE_SELECTION_MAX_WIDTH = 600

function BlankPageWarningOverlay({
  show,
  reviewWarningPages,
  reviewMode,
  onDismiss,
  onShow,
}: {
  show: boolean
  reviewWarningPages: number[]
  reviewMode: BlankPageReviewMode
  onDismiss: () => void
  onShow: () => void
}) {
  if (!show) {
    return (
      <button
        type="button"
        onClick={onShow}
        className="absolute top-3 right-3 z-20 inline-flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-full border border-amber-300 bg-amber-50/95 px-3 py-2 text-sm font-medium text-amber-800 shadow-md backdrop-blur-sm transition-colors hover:bg-amber-100"
      >
        <AlertTriangle className="size-4 shrink-0" />
        <span className="truncate">
          Cảnh báo trang {compactPageList(reviewWarningPages)}
        </span>
      </button>
    )
  }

  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 z-20">
      <div className="pointer-events-auto flex max-h-[min(40vh,280px)] items-start gap-3 overflow-y-auto rounded-xl border border-amber-300 bg-amber-50/95 px-4 py-3 text-sm text-amber-900 shadow-lg backdrop-blur-sm">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-amber-950">
            Cảnh báo trang trắng có dấu hiệu chứa hình ảnh
          </p>
          <p className="mt-1 leading-relaxed">
            Trang{" "}
            <span className="font-semibold">
              {compactPageList(reviewWarningPages)}
            </span>{" "}
            được nhận diện là trắng nhưng có thể chứa hình ảnh.
            {reviewMode === "select"
              ? " Hãy kiểm tra kỹ từng trang trước khi ghi nhận xóa."
              : " Hãy chuyển sang chế độ Xóa trang trắng để kiểm tra và xử lý."}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100"
        >
          <Check className="size-4" />
          Đã kiểm tra
        </button>
      </div>
    </div>
  )
}
const PREVIEW_SCROLL_BUFFER_PX = 900
const INITIAL_NEARBY_PAGES = [1, 2]

export function BlankPageReviewPanel({
  variant,
  sourceVariant,
  reviewMode,
  submitting,
  submitError,
  onReviewModeChange,
  onSubmit,
}: BlankPageReviewPanelProps) {
  const [loadState, setLoadState] = useState<PdfLoadState>({
    url: "",
    document: null,
    pageCount: 0,
    error: "",
  })

  useEffect(() => {
    const reviewPdfUrl = sourceVariant?.url || variant.url
    if (!reviewPdfUrl) return
    let cancelled = false
    const abortController = new AbortController()
    const url = reviewPdfUrl
    let loadingTask: ReturnType<typeof createPdfDocumentLoadingTask> | null =
      null

    const loadPdf = async () => {
      try {
        const response = await fetch(url, { signal: abortController.signal })
        if (!response.ok) {
          throw new Error(`Không tải được PDF preview (${response.status}).`)
        }
        const data = new Uint8Array(await response.arrayBuffer())
        if (cancelled) return
        loadingTask = createPdfDocumentLoadingTask(data)
        const document = await loadingTask.promise
        if (cancelled) {
          document.cleanup()
          return
        }
        setLoadState({
          url,
          document,
          pageCount: document.numPages,
          error: "",
        })
      } catch (error: unknown) {
        if (!cancelled) {
          setLoadState({
            url,
            document: null,
            pageCount: 0,
            error:
              error instanceof Error
                ? error.message
                : "Không render được PDF để review trang trắng.",
          })
        }
      }
    }
    void loadPdf()
    return () => {
      cancelled = true
      abortController.abort()
      void loadingTask?.destroy()
      pdfPageRenderCache.clear()
    }
  }, [sourceVariant?.url, variant.url])

  const reviewPdfUrl = sourceVariant?.url || variant.url
  const rendersOriginalPages = Boolean(
    sourceVariant?.url && sourceVariant.key === "original"
  )
  const pdfDocument =
    loadState.url === reviewPdfUrl ? loadState.document : null
  const pageCount = loadState.url === reviewPdfUrl ? loadState.pageCount : 0
  const loadError = loadState.url === reviewPdfUrl ? loadState.error : ""
  const fallbackProcessedPageCount = Math.max(
    0,
    pageCount - variant.removedPages.length
  )
  const processedPageCount = rendersOriginalPages
    ? (variant.outputPageCount ?? fallbackProcessedPageCount)
    : pageCount
  const mapping = useMemo(
    () => buildBlankPageReviewMapping(variant, processedPageCount),
    [processedPageCount, variant]
  )
  const selectionKey = [
    variant.versionId || variant.url,
    sourceVariant?.versionId || sourceVariant?.url || "",
    mapping.initialDeletedOriginalPages.join(","),
  ].join(":")

  return (
    <BlankPageReviewSelection
      key={selectionKey}
      variant={variant}
      rendersOriginalPages={rendersOriginalPages}
      mapping={mapping}
      pdfDocument={pdfDocument}
      pageCount={pageCount}
      loadError={loadError}
      renderSessionId={reviewPdfUrl}
      reviewMode={reviewMode}
      submitting={submitting}
      submitError={submitError}
      onReviewModeChange={onReviewModeChange}
      onSubmit={onSubmit}
    />
  )
}

function BlankPageReviewSelection({
  variant,
  rendersOriginalPages,
  mapping,
  pdfDocument,
  pageCount,
  loadError,
  renderSessionId,
  reviewMode,
  submitting,
  submitError,
  onReviewModeChange,
  onSubmit,
}: {
  variant: PreviewVariantState
  rendersOriginalPages: boolean
  mapping: BlankPageReviewMapping
  pdfDocument: PDFDocumentProxy | null
  pageCount: number
  loadError: string
  renderSessionId: string
  reviewMode: BlankPageReviewMode
  submitting: boolean
  submitError: string
  onReviewModeChange: (mode: BlankPageReviewMode) => void
  onSubmit: (blankPages: number[]) => Promise<void> | void
}) {
  const [selectedDeletedPages, setSelectedDeletedPages] = useState<Set<number>>(
    () => new Set(mapping.initialDeletedOriginalPages)
  )
  const selectableWarningSet = useMemo(
    () =>
      new Set(
        rendersOriginalPages
          ? mapping.warningOriginalPages
          : mapping.visibleWarningOriginalPages
      ),
    [
      mapping.visibleWarningOriginalPages,
      mapping.warningOriginalPages,
      rendersOriginalPages,
    ]
  )
  const selectedPages = sortedPageSet(selectedDeletedPages)
  const iframeUrl = variant.url ? pdfEmbedUrl(variant.url) : ""
  const canSubmit = Boolean(variant.url && !submitting)
  const reviewWarningPages = mapping.warningOriginalPages
  const reviewWarningKey = reviewWarningPages.join(",")
  const hasReviewWarnings = reviewWarningPages.length > 0
  const [showWarningBanner, setShowWarningBanner] = useState(true)
  const optionalContentConfigPromise = useMemo(
    () => pdfDocument?.getOptionalContentConfig({ intent: "display" }) ?? null,
    [pdfDocument]
  )

  useEffect(() => {
    if (hasReviewWarnings) setShowWarningBanner(true)
  }, [hasReviewWarnings, reviewWarningKey])

  const toggleOriginalPage = (originalPage: number) => {
    setSelectedDeletedPages((current) => {
      const next = new Set(current)
      if (next.has(originalPage)) next.delete(originalPage)
      else next.add(originalPage)
      return next
    })
  }

  const resetSelection = () => {
    setSelectedDeletedPages(new Set(mapping.initialDeletedOriginalPages))
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F8FAFC]">
      <div className="shrink-0 border-b border-[#E2E8F0] bg-white px-3 py-2.5 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div
              className="inline-flex h-8 items-center rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] p-0.5"
              aria-label="Chế độ review trang trắng"
            >
              <button
                type="button"
                onClick={() => onReviewModeChange("preview")}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                  reviewMode === "preview"
                    ? "bg-white text-[#0052FF] shadow-sm"
                    : "text-[#475569] hover:bg-white/80 hover:text-[#0F172A]"
                )}
              >
                <Eye className="size-3.5" />
                Xem PDF
              </button>
              <button
                type="button"
                onClick={() => onReviewModeChange("select")}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                  reviewMode === "select"
                    ? "bg-white text-[#0052FF] shadow-sm"
                    : "text-[#475569] hover:bg-white/80 hover:text-[#0F172A]"
                )}
              >
                <Trash2 className="size-3.5" />
                Xóa trang trắng
              </button>
            </div>
          </div>

          {reviewMode === "select" ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetSelection}
                disabled={submitting}
              >
                <RotateCcw data-icon="inline-start" />
                Khôi phục chọn
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => onSubmit(selectedPages)}
                disabled={!canSubmit}
              >
                {submitting ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                ) : (
                  <Check data-icon="inline-start" />
                )}
                Ghi nhận xóa
              </Button>
            </div>
          ) : null}
        </div>

        {submitError ? (
          <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {submitError}
          </p>
        ) : null}
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {hasReviewWarnings ? (
          <BlankPageWarningOverlay
            show={showWarningBanner}
            reviewWarningPages={reviewWarningPages}
            reviewMode={reviewMode}
            onDismiss={() => setShowWarningBanner(false)}
            onShow={() => setShowWarningBanner(true)}
          />
        ) : null}
        {reviewMode === "preview" ? (
          iframeUrl ? (
            <iframe
              src={iframeUrl}
              title={`PDF preview ${variant.label}`}
              className="h-full min-h-[320px] w-full border-0 bg-white sm:min-h-[480px]"
            />
          ) : (
            <div className="flex h-full min-h-[320px] items-center justify-center px-6 text-center text-sm text-[#64748B]">
              Chưa có URL PDF để preview.
            </div>
          )
        ) : (
          <ManualSelectionPages
            mapping={mapping}
            pdfDocument={pdfDocument}
            renderSessionId={renderSessionId}
            optionalContentConfigPromise={optionalContentConfigPromise}
            pageCount={pageCount}
            loadError={loadError}
            rendersOriginalPages={rendersOriginalPages}
            selectedDeletedPages={selectedDeletedPages}
            warningSet={selectableWarningSet}
            submitting={submitting}
            onTogglePage={toggleOriginalPage}
          />
        )}
      </div>
    </div>
  )
}

function ManualSelectionPages({
  mapping,
  pdfDocument,
  renderSessionId,
  optionalContentConfigPromise,
  pageCount,
  loadError,
  rendersOriginalPages,
  selectedDeletedPages,
  warningSet,
  submitting,
  onTogglePage,
}: {
  mapping: BlankPageReviewMapping
  pdfDocument: PDFDocumentProxy | null
  renderSessionId: string
  optionalContentConfigPromise: OptionalContentConfigPromise | null
  pageCount: number
  loadError: string
  rendersOriginalPages: boolean
  selectedDeletedPages: Set<number>
  warningSet: Set<number>
  submitting: boolean
  onTogglePage: (originalPage: number) => void
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const [targetWidth, setTargetWidth] = useState<number | null>(null)
  const [nearbyPages, setNearbyPages] = useState<Set<number>>(
    () => new Set(INITIAL_NEARBY_PAGES)
  )
  const [anchorPages, setAnchorPages] = useState<number[]>(INITIAL_NEARBY_PAGES)

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const updateWidth = () => {
      setTargetWidth(
        computePdfPreviewTargetWidth(
          list.clientWidth,
          1,
          BLANK_PAGE_SELECTION_MAX_WIDTH
        )
      )
    }
    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(list)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const scrollContainer = scrollRef.current
    const list = listRef.current
    if (!scrollContainer || !list || pageCount <= 0) return

    const syncVisiblePages = () => {
      const cards = list.querySelectorAll<HTMLElement>("[data-preview-page]")
      const nextNearby = new Set<number>()
      const nextAnchors: number[] = []

      cards.forEach((card) => {
        const pageNumber = Number(card.dataset.previewPage)
        if (!Number.isInteger(pageNumber) || pageNumber <= 0) return
        const rect = card.getBoundingClientRect()
        const containerRect = scrollContainer.getBoundingClientRect()
        const expandedTop = containerRect.top - PREVIEW_SCROLL_BUFFER_PX
        const expandedBottom = containerRect.bottom + PREVIEW_SCROLL_BUFFER_PX
        if (rect.bottom >= expandedTop && rect.top <= expandedBottom) {
          nextNearby.add(pageNumber)
          if (
            rect.bottom >= containerRect.top &&
            rect.top <= containerRect.bottom
          ) {
            nextAnchors.push(pageNumber)
          }
        }
      })

      if (nextNearby.size === 0) {
        INITIAL_NEARBY_PAGES.forEach((page) => {
          if (page <= pageCount) nextNearby.add(page)
        })
      }
      if (nextAnchors.length === 0) {
        nextAnchors.push(...INITIAL_NEARBY_PAGES.filter((page) => page <= pageCount))
      }

      setNearbyPages(nextNearby)
      setAnchorPages(nextAnchors)
    }

    syncVisiblePages()
    scrollContainer.addEventListener("scroll", syncVisiblePages, {
      passive: true,
    })
    const observer = new ResizeObserver(syncVisiblePages)
    observer.observe(scrollContainer)
    observer.observe(list)
    return () => {
      scrollContainer.removeEventListener("scroll", syncVisiblePages)
      observer.disconnect()
    }
  }, [pageCount, targetWidth])

  useEffect(() => {
    if (!pdfDocument || !renderSessionId || !targetWidth || pageCount <= 0) {
      return
    }
    prefetchPdfPageNumbers({
      sessionId: renderSessionId,
      pdfDocument,
      pageNumbers: buildPrefetchWindow(anchorPages, pageCount, 1, 4),
      targetWidth,
      optionalContentConfigPromise,
      basePriority: 12,
    })
  }, [
    anchorPages,
    optionalContentConfigPromise,
    pageCount,
    pdfDocument,
    renderSessionId,
    targetWidth,
  ])
  if (loadError) {
    return (
      <div className="h-full overflow-y-auto p-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {loadError}
        </div>
      </div>
    )
  }

  if (!pdfDocument) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-[#64748B]">
        <Loader2 className="mr-2 size-4 animate-spin text-[#0052FF]" />
        Đang render các trang PDF...
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      className="h-full min-h-0 overflow-y-auto bg-[#F8FAFC] px-2 py-3 sm:px-3"
    >
      <div
        ref={listRef}
        className="mx-auto flex w-full max-w-[840px] flex-col gap-3"
      >
        {Array.from({ length: pageCount }, (_, index) => {
          const displayPage = index + 1
          const originalPage = rendersOriginalPages
            ? displayPage
            : mapping.processedToOriginal.get(displayPage) ?? displayPage
          const selected = selectedDeletedPages.has(originalPage)
          const warning = warningSet.has(originalPage)
          const togglePage = () => onTogglePage(originalPage)

          return (
            <div
              key={displayPage}
              data-preview-page={displayPage}
              role="button"
              tabIndex={submitting ? -1 : 0}
              aria-disabled={submitting}
              aria-pressed={selected}
              onClick={submitting ? undefined : togglePage}
              onKeyDown={(event) => {
                if (submitting) return
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  togglePage()
                }
              }}
              className={cn(
                "group w-full cursor-pointer rounded-lg border-2 bg-white p-2 text-left shadow-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#0052FF]/30 aria-disabled:cursor-not-allowed aria-disabled:opacity-70",
                selected
                  ? "border-rose-500 bg-rose-50/40 ring-2 ring-rose-100"
                  : warning
                    ? "border-amber-400 bg-amber-50/40 ring-2 ring-amber-100"
                    : "border-[#D8E1EC] hover:border-[#0052FF]/50"
              )}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2 px-1">
                <span
                  className={cn(
                    "text-sm font-semibold",
                    selected ? "text-rose-700" : "text-[#0F172A]"
                  )}
                >
                  Trang {originalPage}
                </span>
                {warning ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                    <AlertTriangle className="size-3.5" />
                    Có dấu hiệu ảnh
                  </span>
                ) : null}
                {selected ? (
                  <span className="inline-flex items-center rounded-full border border-rose-300 bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                    Đã chọn xóa
                  </span>
                ) : null}
              </div>
              {nearbyPages.has(displayPage) ? (
                <PdfPageFullView
                  pdfDocument={pdfDocument}
                  renderSessionId={renderSessionId}
                  optionalContentConfigPromise={optionalContentConfigPromise}
                  pageNumber={displayPage}
                  targetWidth={targetWidth}
                />
              ) : (
                <PdfPagePreviewPlaceholder
                  renderSessionId={renderSessionId}
                  pageNumber={displayPage}
                  targetWidth={targetWidth}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PdfPagePreviewPlaceholder({
  renderSessionId,
  pageNumber,
  targetWidth,
}: {
  renderSessionId: string
  pageNumber: number
  targetWidth: number | null
}) {
  const isReady =
    Boolean(renderSessionId && targetWidth) &&
    pdfPageRenderCache.has(renderSessionId, pageNumber, targetWidth ?? 0)

  return (
    <div
      className="flex min-h-[180px] items-center justify-center rounded-md bg-[#F1F5F9] p-6 text-xs text-[#94A3B8]"
      style={{
        minHeight: targetWidth ? `${Math.round(targetWidth / 1.414)}px` : 180,
      }}
    >
      {isReady ? "Cuộn tới để xem preview" : "Đang chuẩn bị preview..."}
    </div>
  )
}

function PdfPageFullView({
  pdfDocument,
  renderSessionId,
  optionalContentConfigPromise,
  pageNumber,
  targetWidth,
}: {
  pdfDocument: PDFDocumentProxy
  renderSessionId: string
  optionalContentConfigPromise: OptionalContentConfigPromise | null
  pageNumber: number
  targetWidth: number | null
}) {
  const frameRef = useRef<HTMLDivElement | null>(null)
  const viewerRef = useRef<HTMLDivElement | null>(null)
  const [pageAspectRatio, setPageAspectRatio] = useState(1 / 1.414)
  const [isRendering, setIsRendering] = useState(false)
  const [hasRendered, setHasRendered] = useState(false)
  const [renderError, setRenderError] = useState("")

  useEffect(() => {
    if (!targetWidth || !renderSessionId) return
    const viewer = viewerRef.current
    if (!viewer) return
    let cancelled = false

    const mountPage = async () => {
      try {
        setIsRendering(true)
        setRenderError("")
        const rendered = await pdfPageRenderCache.getOrRender(
          renderSessionId,
          {
            pdfDocument,
            pageNumber,
            targetWidth,
            optionalContentConfigPromise,
          },
          20
        )
        if (cancelled) return
        viewer.replaceChildren(createCanvasFromRenderedPage(rendered))
        setPageAspectRatio(rendered.aspectRatio)
        setHasRendered(true)
      } catch (error) {
        if (cancelled || isPdfRenderCancelled(error)) return
        const message = error instanceof Error ? error.message : String(error)
        setRenderError(message || "Không render được preview trang này.")
      } finally {
        if (!cancelled) setIsRendering(false)
      }
    }

    void mountPage()
    return () => {
      cancelled = true
    }
  }, [
    optionalContentConfigPromise,
    pageNumber,
    pdfDocument,
    renderSessionId,
    targetWidth,
  ])

  return (
    <div
      ref={frameRef}
      className="relative flex w-full items-start justify-center overflow-auto rounded-md bg-[#F1F5F9] p-2"
      style={{
        minHeight: targetWidth
          ? `${Math.round(targetWidth / pageAspectRatio) + 16}px`
          : undefined,
      }}
    >
      <div
        ref={viewerRef}
        className="pointer-events-none flex shrink-0 items-start justify-center"
        style={{
          width: targetWidth ? `${Math.round(targetWidth)}px` : "100%",
          minHeight: targetWidth
            ? `${Math.round(targetWidth / pageAspectRatio)}px`
            : undefined,
        }}
      />
      {!hasRendered ? (
        <div className="absolute inset-2 flex items-center justify-center rounded bg-white text-xs text-[#94A3B8] shadow">
          {isRendering ? "Đang render trang..." : "Đang chuẩn bị preview..."}
        </div>
      ) : null}
      {renderError ? (
        <span className="absolute right-3 bottom-3 left-3 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800 shadow-sm">
          Không render được preview trang này. Hãy đối chiếu trong tab Xem PDF.
        </span>
      ) : null}
    </div>
  )
}
