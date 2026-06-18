import { useEffect, useMemo, useRef, useState } from "react"
import {
  ExternalLink,
  FileSearch,
  Loader2,
  RefreshCw,
  TriangleAlert,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  getDocumentPreviewUrl,
  type DocumentPreviewUrlResponse,
  type DocumentPreviewVariantResponse,
} from "@/features/upload/api/sessionApi"
import { cn } from "@/shared/lib/utils"

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
}

interface PreviewVariantState {
  key: string
  label: string
  dataPath: string
  url: string
  status: string
  processingStatus: string
  error: string
  note: string
  sameAsOriginal: boolean
  blankPages: number[]
  removedPages: number[]
  sourcePageCount: number | null
  outputPageCount: number | null
}

interface PreviewState {
  status: "idle" | "loading" | "ready" | "error"
  variants: PreviewVariantState[]
  error: string
}

const PREVIEW_RETRY_INTERVAL_MS = 2_000

export function DocumentPdfPreview({
  sessionId,
  document,
  className,
  onClose,
}: DocumentPdfPreviewProps) {
  const [refreshKey, setRefreshKey] = useState(0)
  const previewResponseCacheRef = useRef<Map<string, DocumentPreviewUrlResponse>>(
    new Map()
  )
  const [state, setState] = useState<PreviewState>({
    status: "idle",
    variants: [],
    error: "",
  })
  const [selectedVariantKey, setSelectedVariantKey] = useState("")
  const documentId = document?.id ?? null
  const documentKey = useMemo(() => {
    if (!sessionId || documentId === null) return ""
    return `${sessionId}:${documentId}`
  }, [documentId, sessionId])

  useEffect(() => {
    let cancelled = false
    let retryTimeout: ReturnType<typeof setTimeout> | null = null

    const scheduleRetry = () => {
      retryTimeout = setTimeout(() => {
        if (!cancelled) setRefreshKey((key) => key + 1)
      }, PREVIEW_RETRY_INTERVAL_MS)
    }

    if (!document) {
      setState({ status: "idle", variants: [], error: "" })
      return () => {
        cancelled = true
      }
    }
    if (!sessionId) {
      setState({
        status: "error",
        variants: [],
        error: "Chua co session de lay preview PDF.",
      })
      return () => {
        cancelled = true
      }
    }
    if (documentId === null) {
      setState({
        status: "error",
        variants: [],
        error: "Tai lieu nay chua co ma trong session.",
      })
      return () => {
        cancelled = true
      }
    }

    const load = async () => {
      const cachedResponse = previewResponseCacheRef.current.get(documentKey)
      if (cachedResponse) {
        const cachedVariants = normalizePreviewVariants(cachedResponse)
        setState({ status: "ready", variants: cachedVariants, error: "" })
        return
      }

      setState((current) => ({
        status: "loading",
        variants: current.variants,
        error: "",
      }))

      try {
        const response = await getDocumentPreviewUrl(sessionId, documentId)
        const variants = normalizePreviewVariants(response)
        const needsRefresh = variants.some(previewVariantNeedsRefresh)
        if (!needsRefresh && variants.some((variant) => Boolean(variant.url))) {
          previewResponseCacheRef.current.set(documentKey, response)
        } else {
          previewResponseCacheRef.current.delete(documentKey)
        }
        if (!cancelled) {
          setState({ status: "ready", variants, error: "" })
          if (needsRefresh) scheduleRetry()
        }
      } catch (err) {
        if (!cancelled) {
          setState((current) => ({
            status: "error",
            variants: current.variants,
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
  }, [document, documentId, documentKey, refreshKey, sessionId])

  const canRefresh = Boolean(document && sessionId && document.id !== null)
  const hasPreviewVariants = state.variants.length > 0
  const selectedVariant = useMemo(() => {
    if (!hasPreviewVariants) return null
    return (
      state.variants.find((variant) => variant.key === selectedVariantKey) ??
      preferredPreviewVariant(state.variants)
    )
  }, [hasPreviewVariants, selectedVariantKey, state.variants])

  useEffect(() => {
    if (!hasPreviewVariants) {
      if (selectedVariantKey) setSelectedVariantKey("")
      return
    }
    if (state.variants.some((variant) => variant.key === selectedVariantKey)) {
      return
    }
    setSelectedVariantKey(preferredPreviewVariant(state.variants).key)
  }, [hasPreviewVariants, selectedVariantKey, state.variants])

  const refreshPreview = () => {
    if (documentKey) previewResponseCacheRef.current.delete(documentKey)
    setRefreshKey((key) => key + 1)
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
            {selectedVariant ? (
              <p className="mt-0.5 truncate text-[11px] text-[#475569]">
                {previewVariantSummary(selectedVariant) ||
                  selectedVariant.dataPath ||
                  selectedVariant.label}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {state.variants.length > 1 ? (
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
          <PreviewPane variant={selectedVariant} />
        ) : (
          <PreviewEmptyState state={state} hasDocument={Boolean(document)} />
        )}
      </div>
    </div>
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
          </button>
        )
      })}
    </div>
  )
}

function PreviewPane({ variant }: { variant: PreviewVariantState }) {
  const iframeUrl = variant.url ? pdfEmbedUrl(variant.url) : ""
  const badge = previewVariantBadge(variant)

  return (
    <section className="flex h-full min-h-[320px] min-w-0 flex-col overflow-hidden bg-white sm:min-h-[480px]">
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

      <div className="relative min-h-0 flex-1 bg-[#F8FAFC]">
        {iframeUrl ? (
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

function normalizePreviewVariants(
  response: DocumentPreviewUrlResponse
): PreviewVariantState[] {
  const responseVariants =
    Array.isArray(response.preview_variants) && response.preview_variants.length > 0
      ? response.preview_variants
      : [
          {
            key: "primary",
            label: "Ban xem truoc",
            data_path: response.data_path,
            download_url: response.download_url,
            expires_in: response.expires_in,
            expires_at: response.expires_at,
            status: response.download_url ? "ready" : "unavailable",
          } satisfies DocumentPreviewVariantResponse,
        ]

  return responseVariants.map((variant) => ({
    key: String(variant.key || "preview"),
    label: String(variant.label || "Ban xem truoc"),
    dataPath: String(variant.data_path || "").trim(),
    url: String(variant.download_url || "").trim(),
    status: String(variant.status || "").trim().toLowerCase() || "unavailable",
    processingStatus:
      String(variant.processing_status || "").trim().toLowerCase() || "",
    error: String(variant.error || "").trim(),
    note: String(variant.note || "").trim(),
    sameAsOriginal: Boolean(variant.same_as_original),
    blankPages: Array.isArray(variant.blank_pages)
      ? variant.blank_pages
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value))
      : [],
    removedPages: Array.isArray(variant.removed_pages)
      ? variant.removed_pages
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value))
      : [],
    sourcePageCount: numberOrNull(variant.source_page_count),
    outputPageCount: numberOrNull(variant.output_page_count),
  }))
}

function previewVariantNeedsRefresh(variant: PreviewVariantState): boolean {
  return !variant.url && variant.status !== "failed"
}

function preferredPreviewVariant(
  variants: PreviewVariantState[]
): PreviewVariantState {
  return (
    variants.find(
      (variant) => variant.key === "processed" && variant.status === "ready"
    ) ??
    variants.find((variant) => variant.status === "ready") ??
    variants[0]
  )
}

function previewVariantBadge(variant: PreviewVariantState): {
  label: string
  className: string
} {
  if (variant.url) {
    return {
      label: "Sẵn sàng",
      className: "bg-emerald-50 text-emerald-700",
    }
  }
  if (previewVariantNeedsRefresh(variant)) {
    return {
      label: "Đang xử lý",
      className: "bg-amber-50 text-amber-700",
    }
  }
  if (variant.status === "failed") {
    return {
      label: "Lỗi",
      className: "bg-rose-50 text-rose-700",
    }
  }
  return {
    label: "Chưa sẵn sàng",
    className: "bg-slate-100 text-slate-700",
  }
}

function shortVariantLabel(variant: PreviewVariantState): string {
  if (variant.key === "original") return "Bản gốc"
  if (variant.key === "processed") return "Bỏ trang trắng"
  return variant.label
}

function previewVariantSummary(variant: PreviewVariantState): string {
  const parts: string[] = []
  if (variant.blankPages.length > 0) {
    parts.push(`Trang trắng: ${compactPageList(variant.blankPages)}`)
  }
  if (variant.removedPages.length > 0) {
    parts.push(`Đã xoá: ${compactPageList(variant.removedPages)}`)
  }
  if (variant.sourcePageCount !== null && variant.outputPageCount !== null) {
    parts.push(`${variant.sourcePageCount} -> ${variant.outputPageCount} trang`)
  } else if (variant.outputPageCount !== null) {
    parts.push(`Còn ${variant.outputPageCount} trang`)
  }
  if (variant.note) {
    parts.push(variant.note)
  }
  return parts.join(" · ")
}

function compactPageList(pages: number[]): string {
  if (pages.length <= 8) return pages.join(", ")
  return `${pages.slice(0, 8).join(", ")} +${pages.length - 8}`
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : null
}

function pdfEmbedUrl(url: string): string {
  if (!url || url.includes("#")) return url
  return `${url}#toolbar=1&navpanes=0&view=FitH&zoom=page-fit`
}
