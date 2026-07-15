import { useEffect, useMemo, useRef, useState } from "react"
import {
  ExternalLink,
  FileSearch,
  Loader2,
  RefreshCw,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  getDocumentPreviewUrl,
  removeDocumentBlankPages,
  type DocumentPreviewUrlResponse,
  type SessionDocumentResponse,
} from "@/features/upload/api/sessionApi"
import { visibleAwareDelay } from "@/shared/lib/pageVisibility"
import { cn } from "@/shared/lib/utils"
import { toast } from "sonner"
import {
  BlankPageReviewPanel,
  type BlankPageReviewMode,
} from "./DocumentPdfPreview.blankPageReviewPanel"
import type {
  PreviewState,
  PreviewVariantState,
} from "./DocumentPdfPreview.types"
import {
  normalizePreviewVariants,
  pdfEmbedUrl,
  preferredPreviewVariant,
  previewVariantBadge,
  previewVariantNeedsRefresh,
  previewVariantSummary,
  shortVariantLabel,
} from "./DocumentPdfPreview.utils"

export interface DocumentPreviewTarget {
  id: number | null
  fileName: string
  dataPath: string
}

interface DocumentPdfPreviewProps {
  sessionId: string | null
  document: DocumentPreviewTarget | null
  className?: string
  onClose?: () => void
  presentation?: string
  enableBlankPageReview?: boolean
  onDocumentUpdated?: (document: SessionDocumentResponse) => void
}

const PREVIEW_RETRY_DELAYS_MS = [2_000, 4_000, 8_000, 15_000, 30_000]
const PREVIEW_MAX_RETRY_ATTEMPTS = 8
const PREVIEW_HIDDEN_RETRY_INTERVAL_MS = 30_000

function activeVariantKeyFromResponse(
  response: DocumentPreviewUrlResponse,
  variants: PreviewVariantState[]
): string {
  const activeKey = String(response.active_variant_key || "").trim()
  if (activeKey && variants.some((variant) => variant.key === activeKey)) {
    return activeKey
  }
  return preferredPreviewVariant(variants).key
}

export function DocumentPdfPreview({
  sessionId,
  document,
  className,
  onClose,
  presentation,
  enableBlankPageReview = false,
  onDocumentUpdated,
}: DocumentPdfPreviewProps) {
  const isDossierReviewPresentation = presentation === "dossier_review"
  const [refreshKey, setRefreshKey] = useState(0)
  const manualRefreshRef = useRef(false)
  const previewResponseCacheRef = useRef<
    Map<string, DocumentPreviewUrlResponse>
  >(new Map())
  const previewRetryAttemptsRef = useRef<Map<string, number>>(new Map())
  const lastPreviewDocumentKeyRef = useRef("")
  const [state, setState] = useState<PreviewState>({
    status: "idle",
    variants: [],
    activeVariantKey: "",
    error: "",
  })
  const [selectedVariantKey, setSelectedVariantKey] = useState("")
  const [blankPageReviewSubmitting, setBlankPageReviewSubmitting] =
    useState(false)
  const [blankPageReviewError, setBlankPageReviewError] = useState("")
  const documentId = document?.id ?? null
  const documentKey = useMemo(() => {
    if (!sessionId || documentId === null) return ""
    return `${sessionId}:${documentId}`
  }, [documentId, sessionId])

  useEffect(() => {
    let cancelled = false
    let retryTimeout: ReturnType<typeof setTimeout> | null = null

    const scheduleRetry = () => {
      const attempts = previewRetryAttemptsRef.current.get(documentKey) ?? 0
      if (attempts >= PREVIEW_MAX_RETRY_ATTEMPTS) return
      previewRetryAttemptsRef.current.set(documentKey, attempts + 1)
      const retryDelay =
        PREVIEW_RETRY_DELAYS_MS[
          Math.min(attempts, PREVIEW_RETRY_DELAYS_MS.length - 1)
        ]
      retryTimeout = setTimeout(() => {
        if (!cancelled) setRefreshKey((key) => key + 1)
      }, visibleAwareDelay(retryDelay, PREVIEW_HIDDEN_RETRY_INTERVAL_MS))
    }

    if (!document) {
      lastPreviewDocumentKeyRef.current = ""
      setState({
        status: "idle",
        variants: [],
        activeVariantKey: "",
        error: "",
      })
      return () => {
        cancelled = true
      }
    }
    if (!sessionId) {
      lastPreviewDocumentKeyRef.current = ""
      setState({
        status: "error",
        variants: [],
        activeVariantKey: "",
        error: "Chua co session de lay preview PDF.",
      })
      return () => {
        cancelled = true
      }
    }
    if (documentId === null) {
      lastPreviewDocumentKeyRef.current = ""
      setState({
        status: "error",
        variants: [],
        activeVariantKey: "",
        error: "Tai lieu nay chua co ma trong session.",
      })
      return () => {
        cancelled = true
      }
    }

    const load = async () => {
      const documentChanged = lastPreviewDocumentKeyRef.current !== documentKey
      lastPreviewDocumentKeyRef.current = documentKey
      if (documentChanged) {
        previewRetryAttemptsRef.current.delete(documentKey)
      }
      const cachedResponse = previewResponseCacheRef.current.get(documentKey)
      if (cachedResponse) {
        const cachedVariants = normalizePreviewVariants(cachedResponse)
        setState({
          status: "ready",
          variants: cachedVariants,
          activeVariantKey: activeVariantKeyFromResponse(
            cachedResponse,
            cachedVariants
          ),
          error: "",
        })
        return
      }

      setState((current) => ({
        status: "loading",
        variants: documentChanged ? [] : current.variants,
        activeVariantKey: documentChanged ? "" : current.activeVariantKey,
        error: "",
      }))

      try {
        const response = await getDocumentPreviewUrl(sessionId, documentId, {
          presentation,
        })
        const variants = normalizePreviewVariants(response)
        const activeVariantKey = activeVariantKeyFromResponse(
          response,
          variants
        )
        const needsRefresh = variants.some(previewVariantNeedsRefresh)
        const preserveReadyUrls = !manualRefreshRef.current
        manualRefreshRef.current = false
        if (!needsRefresh && variants.some((variant) => Boolean(variant.url))) {
          previewResponseCacheRef.current.set(documentKey, response)
          previewRetryAttemptsRef.current.delete(documentKey)
        } else {
          previewResponseCacheRef.current.delete(documentKey)
        }
        if (!cancelled) {
          setState((current) => ({
            status: "ready",
            variants: mergePreviewVariants(
              current.variants,
              variants,
              preserveReadyUrls
            ),
            activeVariantKey,
            error: "",
          }))
          if (needsRefresh) scheduleRetry()
        }
      } catch (err) {
        if (!cancelled) {
          setState((current) => ({
            status: "error",
            variants: current.variants,
            activeVariantKey: current.activeVariantKey,
            error:
              err instanceof Error ? err.message : "Khong the tai preview PDF.",
          }))
          scheduleRetry()
        }
      }
    }

    void load()
    return () => {
      cancelled = true
      if (retryTimeout) clearTimeout(retryTimeout)
    }
  }, [document, documentId, documentKey, presentation, refreshKey, sessionId])

  useEffect(() => {
    setSelectedVariantKey("")
  }, [documentKey])

  const canRefresh = Boolean(document && sessionId && document.id !== null)
  const hasPreviewVariants = state.variants.length > 0
  const selectedVariant = useMemo(() => {
    if (!hasPreviewVariants) return null
    return (
      state.variants.find((variant) => variant.key === selectedVariantKey) ??
      state.variants.find(
        (variant) => variant.key === state.activeVariantKey
      ) ??
      preferredPreviewVariant(state.variants)
    )
  }, [
    hasPreviewVariants,
    selectedVariantKey,
    state.activeVariantKey,
    state.variants,
  ])
  const originalVariant = useMemo(
    () =>
      state.variants.find(
        (variant) =>
          variant.key === "original" && variant.status === "ready" && variant.url
      ) ?? null,
    [state.variants]
  )

  useEffect(() => {
    if (!hasPreviewVariants) {
      if (selectedVariantKey) setSelectedVariantKey("")
      return
    }
    if (state.variants.some((variant) => variant.key === selectedVariantKey)) {
      return
    }
    setSelectedVariantKey(
      preferredPreviewVariant(state.variants, state.activeVariantKey).key
    )
  }, [
    hasPreviewVariants,
    selectedVariantKey,
    state.activeVariantKey,
    state.variants,
  ])

  const refreshPreview = () => {
    if (documentKey) previewResponseCacheRef.current.delete(documentKey)
    if (documentKey) previewRetryAttemptsRef.current.delete(documentKey)
    manualRefreshRef.current = true
    setRefreshKey((key) => key + 1)
  }
  const submitBlankPageReview = async (blankPages: number[]) => {
    if (!sessionId || documentId === null) return
    setBlankPageReviewSubmitting(true)
    setBlankPageReviewError("")
    try {
      const response = await removeDocumentBlankPages(sessionId, documentId, {
        blank_pages: blankPages,
        created_by: "ui",
        review_note: "manual blank page review",
      })
      if (response.document) onDocumentUpdated?.(response.document)
      if (response.preview) {
        const variants = normalizePreviewVariants(response.preview)
        previewResponseCacheRef.current.set(documentKey, response.preview)
        previewRetryAttemptsRef.current.delete(documentKey)
        setState({
          status: "ready",
          variants,
          activeVariantKey: activeVariantKeyFromResponse(response.preview, variants),
          error: "",
        })
        setSelectedVariantKey("processed")
      } else {
        refreshPreview()
      }
      toast.success("Đã ghi nhận và tạo bản xóa trang trắng mới.")
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Không thể ghi nhận xóa trang trắng thủ công."
      setBlankPageReviewError(message)
      toast.error(message)
    } finally {
      setBlankPageReviewSubmitting(false)
    }
  }
  const selectedVariantUrl = selectedVariant?.url ?? ""

  return (
    <div
      className={cn(
        "flex min-h-[360px] min-w-0 flex-col overflow-hidden rounded-2xl border border-[#D8E1EC] bg-white shadow-sm sm:min-h-[520px]",
        className
      )}
    >
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-[#E2E8F0] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#EAF1FF] text-[#0052FF]">
            <FileSearch className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#0F172A]">
              {document?.fileName || "Chưa chọn tài liệu"}
            </p>
            <p className="truncate text-[11px] text-[#64748B]">
              {document?.dataPath || "Preview PDF"}
            </p>
            {selectedVariant &&
            !enableBlankPageReview &&
            !isDossierReviewPresentation ? (
              <p className="mt-0.5 truncate text-[11px] text-[#475569]">
                {previewVariantSummary(selectedVariant) ||
                  selectedVariant.dataPath ||
                  selectedVariant.label}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {state.variants.length > 1 && !isDossierReviewPresentation ? (
            <PreviewVariantSwitch
              variants={state.variants}
              selectedKey={selectedVariant?.key ?? ""}
              onSelect={setSelectedVariantKey}
            />
          ) : null}
          <a
            className={cn(
              "inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white text-[#475569] transition-colors hover:bg-[#F8FAFC] hover:text-[#0052FF]",
              !selectedVariantUrl && "pointer-events-none opacity-50"
            )}
            href={selectedVariantUrl || undefined}
            target="_blank"
            rel="noreferrer"
            title="Mở PDF trong tab mới"
            aria-disabled={!selectedVariantUrl}
          >
            <ExternalLink className="size-3.5" />
          </a>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            title="Làm mới preview"
            disabled={!canRefresh || state.status === "loading"}
            onClick={refreshPreview}
          >
            {state.status === "loading" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
          </Button>
          {onClose && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              title="Đóng preview"
              onClick={onClose}
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 bg-[#F8FAFC]">
        {selectedVariant ? (
          <PreviewPane
            variant={selectedVariant}
            reviewSourceVariant={originalVariant}
            hideStatus={isDossierReviewPresentation}
            blankPageReview={
              enableBlankPageReview &&
              selectedVariant.key === "processed" &&
              selectedVariant.status === "ready" &&
              Boolean(selectedVariant.url)
                ? {
                    submitting: blankPageReviewSubmitting,
                    error: blankPageReviewError,
                    onSubmit: submitBlankPageReview,
                  }
                : undefined
            }
          />
        ) : (
          <PreviewEmptyState state={state} hasDocument={Boolean(document)} />
        )}
      </div>
    </div>
  )
}

function mergePreviewVariants(
  currentVariants: PreviewVariantState[],
  nextVariants: PreviewVariantState[],
  preserveReadyUrls: boolean
): PreviewVariantState[] {
  if (currentVariants.length === 0) return nextVariants
  const currentByKey = new Map(
    currentVariants.map((variant) => [variant.key, variant])
  )
  return nextVariants.map((nextVariant) => {
    const currentVariant = currentByKey.get(nextVariant.key)
    if (!currentVariant) return nextVariant
    const mergedVariant =
      preserveReadyUrls && currentVariant.url && nextVariant.url
        ? { ...nextVariant, url: currentVariant.url }
        : nextVariant
    return previewVariantsEqual(currentVariant, mergedVariant)
      ? currentVariant
      : mergedVariant
  })
}

function previewVariantsEqual(
  left: PreviewVariantState,
  right: PreviewVariantState
): boolean {
  return (
    left.key === right.key &&
    left.label === right.label &&
    left.dataPath === right.dataPath &&
    left.url === right.url &&
    left.status === right.status &&
    left.processingStatus === right.processingStatus &&
    left.versionId === right.versionId &&
    left.versionType === right.versionType &&
    left.error === right.error &&
    left.note === right.note &&
    left.sameAsOriginal === right.sameAsOriginal &&
    left.sourcePageCount === right.sourcePageCount &&
    left.outputPageCount === right.outputPageCount &&
    numberArraysEqual(left.blankPages, right.blankPages) &&
    numberArraysEqual(left.removedPages, right.removedPages) &&
    numberArraysEqual(left.imageWarningPages, right.imageWarningPages) &&
    JSON.stringify(left.blankPageWarnings) ===
      JSON.stringify(right.blankPageWarnings)
  )
}

function numberArraysEqual(left: number[], right: number[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
}

function PreviewVariantSwitch({
  variants,
  selectedKey,
  onSelect,
}: {
  variants: PreviewVariantState[]
  selectedKey: string
  onSelect: (key: string) => void
}) {
  return (
    <div
      className="flex h-8 items-center rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] p-0.5"
      aria-label="Chọn bản PDF preview"
    >
      {variants.map((variant) => {
        const selected = variant.key === selectedKey
        const disabled = !variant.url && variant.status === "failed"
        const variantWarningPages = blankPageWarningPages(variant)
        const hasVariantBlankPageWarnings =
          variant.blankPageWarnings.length > 0 ||
          variantWarningPages.length > 0
        const hasVariantRemovedBlankPages =
          !hasVariantBlankPageWarnings &&
          blankPageRemovedPages(variant).length > 0
        return (
          <button
            key={variant.key}
            type="button"
            title={variant.label}
            disabled={disabled}
            onClick={() => onSelect(variant.key)}
            className={cn(
              "flex h-7 min-w-[88px] items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-40",
              selected
                ? "bg-white text-[#0052FF] shadow-sm"
                : "text-[#475569] hover:bg-white/80 hover:text-[#0F172A]"
            )}
          >
            <span className="truncate">{shortVariantLabel(variant)}</span>
            {previewVariantNeedsRefresh(variant) ? (
              <Loader2 className="size-3 animate-spin text-amber-600" />
            ) : null}
            {variant.blankPageWarnings.length > 0 ||
            variantWarningPages.length > 0 ? (
              <TriangleAlert className="size-3 text-amber-600" />
            ) : hasVariantRemovedBlankPages ? (
              <Trash2 className="size-3 text-sky-600" />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

function PreviewPane({
  variant,
  reviewSourceVariant,
  hideStatus = false,
  blankPageReview,
}: {
  variant: PreviewVariantState
  reviewSourceVariant?: PreviewVariantState | null
  hideStatus?: boolean
  blankPageReview?: {
    submitting: boolean
    error: string
    onSubmit: (blankPages: number[]) => Promise<void> | void
  }
}) {
  const [blankPageReviewMode, setBlankPageReviewMode] =
    useState<BlankPageReviewMode>("preview")
  const iframeUrl = variant.url ? pdfEmbedUrl(variant.url) : ""
  const badge = previewVariantBadge(variant)
  const warningPages = blankPageWarningPages(variant)
  const hasBlankPageWarnings =
    variant.blankPageWarnings.length > 0 || warningPages.length > 0
  const removedBlankPages = blankPageRemovedPages(variant)
  const hasRemovedBlankPages =
    !hasBlankPageWarnings && removedBlankPages.length > 0

  useEffect(() => {
    setBlankPageReviewMode("preview")
  }, [variant.key, variant.url, variant.versionId])

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white">
      {!blankPageReview && !hideStatus ? (
        <div className="flex items-center justify-between gap-3 border-b border-[#E2E8F0] px-4 py-2.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-[#0F172A]">
                {variant.label}
              </p>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                  badge.className
                )}
              >
                {badge.label}
              </span>
              {variant.sameAsOriginal ? (
                <span className="inline-flex items-center rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[11px] font-medium text-[#3730A3]">
                  Trùng bản gốc
                </span>
              ) : null}
              {hasBlankPageWarnings ? (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800"
                  title={
                    warningPages.length > 0
                      ? `Cảnh báo trang trắng: trang ${warningPages.join(", ")}`
                      : "Cảnh báo trang trắng"
                  }
                >
                  <TriangleAlert className="size-3.5" />
                  Cảnh báo trang trắng
                </span>
              ) : hasRemovedBlankPages ? (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border border-sky-300 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800"
                  title={`Đã xóa trang trắng: trang ${removedBlankPages.join(", ")}`}
                >
                  <Trash2 className="size-3.5" />
                  Đã xóa trang trắng
                </span>
              ) : null}
            </div>
          </div>
          <a
            className={cn(
              "inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white text-[#475569] transition-colors hover:bg-[#F8FAFC] hover:text-[#0052FF]",
              !variant.url && "pointer-events-none opacity-50"
            )}
            href={variant.url || undefined}
            target="_blank"
            rel="noreferrer"
            title={`Mở ${variant.label} trong tab mới`}
          >
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      ) : null}

      {hasBlankPageWarnings && !blankPageReview && !hideStatus ? (
        <div className="border-b border-amber-300 bg-amber-50 px-4 py-3.5 text-sm text-amber-900">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <div className="min-w-0">
              <p className="font-semibold text-amber-950">
                Cảnh báo trang trắng có dấu hiệu chứa hình ảnh
              </p>
              {warningPages.length > 0 ? (
                <p className="mt-1 leading-relaxed">
                  Trang{" "}
                  <span className="font-semibold">
                    {warningPages.join(", ")}
                  </span>{" "}
                  được nhận diện là trắng nhưng có thể chứa hình ảnh. Hãy kiểm
                  tra kỹ trước khi xóa.
                </p>
              ) : null}
              {variant.blankPageWarnings.length > 0 ? (
                <ul className="mt-2 space-y-1 text-amber-800">
                  {variant.blankPageWarnings.map((warning, index) => (
                    <li key={`${String(warning.type || "warning")}-${index}`}>
                      {blankPageWarningLabel(warning)}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1 overflow-hidden bg-[#F8FAFC]">
        {blankPageReview ? (
          <BlankPageReviewPanel
            variant={variant}
            sourceVariant={reviewSourceVariant}
            reviewMode={blankPageReviewMode}
            submitting={blankPageReview.submitting}
            submitError={blankPageReview.error}
            onReviewModeChange={setBlankPageReviewMode}
            onSubmit={blankPageReview.onSubmit}
          />
        ) : iframeUrl ? (
          <iframe
            src={iframeUrl}
            title={`PDF preview ${variant.label}`}
            className="h-full min-h-[320px] w-full border-0 bg-white sm:min-h-[480px]"
          />
        ) : (
          <PreviewVariantEmptyState variant={variant} />
        )}
      </div>
    </section>
  )
}

function blankPageWarningPages(variant: PreviewVariantState): number[] {
  const pages = new Set(variant.imageWarningPages)
  for (const warning of variant.blankPageWarnings) {
    const pageNumber = Number(warning.page_number)
    if (Number.isInteger(pageNumber) && pageNumber > 0) pages.add(pageNumber)
  }
  return [...pages].sort((left, right) => left - right)
}

function blankPageRemovedPages(variant: PreviewVariantState): number[] {
  const source =
    variant.removedPages.length > 0
      ? variant.removedPages
      : variant.key === "processed"
        ? variant.blankPages
        : []
  return [...new Set(source.filter((page) => Number.isInteger(page) && page > 0))]
    .sort((left, right) => left - right)
}

function blankPageWarningLabel(
  warning: PreviewVariantState["blankPageWarnings"][number]
): string {
  const pageNumber = Number(warning.page_number)
  const pageLabel =
    Number.isInteger(pageNumber) && pageNumber > 0
      ? `Trang ${pageNumber}: `
      : ""
  const message = String(warning.message || "").trim()
  return `${pageLabel}${
    message || "Có image block độ tin cậy cao trên trang được phân loại trắng."
  }`
}

function PreviewVariantEmptyState({
  variant,
}: {
  variant: PreviewVariantState
}) {
  if (previewVariantNeedsRefresh(variant)) {
    return (
      <div className="flex h-full min-h-[260px] items-center justify-center px-6 text-center">
        <div className="max-w-sm text-sm text-[#64748B]">
          <Loader2 className="mx-auto mb-3 size-8 animate-spin text-[#0052FF]" />
          <p className="font-medium text-[#0F172A]">
            Đang chuẩn bị {variant.label.toLowerCase()}
          </p>
          <p className="mt-1">
            {variant.note || "Hệ thống đang xử lý bản PDF này."}
          </p>
        </div>
      </div>
    )
  }

  if (variant.status === "failed") {
    return (
      <div className="flex h-full min-h-[260px] items-center justify-center px-6 text-center">
        <div className="max-w-sm text-sm text-[#64748B]">
          <TriangleAlert className="mx-auto mb-3 size-8 text-amber-500" />
          <p className="font-medium text-[#0F172A]">
            Không mở được {variant.label.toLowerCase()}
          </p>
          <p className="mt-1">
            {variant.error || "Có lỗi khi lấy dữ liệu preview PDF."}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-[260px] items-center justify-center px-6 text-center">
      <div className="max-w-sm text-sm text-[#64748B]">
        <FileSearch className="mx-auto mb-3 size-8 text-[#94A3B8]" />
        <p className="font-medium text-[#0F172A]">
          Preview của {variant.label.toLowerCase()} chưa sẵn sàng
        </p>
        <p className="mt-1">
          {variant.note || "Bấm làm mới để thử lấy lại URL preview."}
        </p>
      </div>
    </div>
  )
}

function PreviewEmptyState({
  state,
  hasDocument,
}: {
  state: PreviewState
  hasDocument: boolean
}) {
  if (state.status === "loading") {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-[#64748B] sm:min-h-[480px]">
        <Loader2 className="mr-2 size-4 animate-spin text-[#0052FF]" />
        Đang tải preview PDF...
      </div>
    )
  }

  if (state.status === "error") {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center px-6 text-center sm:min-h-[480px]">
        <div className="max-w-sm text-sm text-[#64748B]">
          <TriangleAlert className="mx-auto mb-3 size-8 text-amber-500" />
          <p className="font-medium text-[#0F172A]">
            Không mở được preview PDF
          </p>
          <p className="mt-1">{state.error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-[320px] items-center justify-center px-6 text-center sm:min-h-[480px]">
      <div className="max-w-sm text-sm text-[#64748B]">
        <FileSearch className="mx-auto mb-3 size-8 text-[#94A3B8]" />
        <p className="font-medium text-[#0F172A]">
          {hasDocument ? "Preview PDF chưa sẵn sàng" : "Chưa chọn tài liệu"}
        </p>
        <p className="mt-1">
          {hasDocument
            ? "Bấm làm mới để lấy lại URL preview."
            : "Chọn một tài liệu trong danh sách."}
        </p>
      </div>
    </div>
  )
}
