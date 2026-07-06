import type {
  DocumentPreviewUrlResponse,
  DocumentPreviewVariantResponse,
} from "@/features/upload/api/sessionApi"
import type { PreviewVariantState } from "./DocumentPdfPreview.types"

export function normalizePreviewVariants(
  response: DocumentPreviewUrlResponse
): PreviewVariantState[] {
  const responseVariants =
    Array.isArray(response.preview_variants) &&
    response.preview_variants.length > 0
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
    status:
      String(variant.status || "")
        .trim()
        .toLowerCase() || "unavailable",
    processingStatus:
      String(variant.processing_status || "")
        .trim()
        .toLowerCase() || "",
    versionId: String(variant.version_id || "").trim(),
    versionType: String(variant.version_type || "").trim(),
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
    blankPageWarnings: Array.isArray(variant.blank_page_warnings)
      ? variant.blank_page_warnings
          .filter(isRecord)
          .map((warning) => ({ ...warning }))
      : [],
    imageWarningPages: Array.isArray(variant.image_warning_pages)
      ? variant.image_warning_pages
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value))
      : [],
    sourcePageCount: numberOrNull(variant.source_page_count),
    outputPageCount: numberOrNull(variant.output_page_count),
  }))
}

export function previewVariantNeedsRefresh(
  variant: PreviewVariantState
): boolean {
  return !variant.url && variant.status !== "failed"
}

export function preferredPreviewVariant(
  variants: PreviewVariantState[],
  activeVariantKey = ""
): PreviewVariantState {
  const activeVariant = activeVariantKey
    ? variants.find((variant) => variant.key === activeVariantKey)
    : undefined
  return (
    activeVariant ??
    variants.find(
      (variant) => variant.key === "processed" && variant.status === "ready"
    ) ??
    variants.find((variant) => variant.status === "ready") ??
    variants[0]
  )
}

export function previewVariantBadge(variant: PreviewVariantState): {
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

export function shortVariantLabel(variant: PreviewVariantState): string {
  if (variant.key === "original") return "Bản gốc"
  if (variant.key === "processed") return "Bỏ trang trắng"
  return variant.label
}

export function previewVariantSummary(variant: PreviewVariantState): string {
  const parts: string[] = []
  if (variant.blankPages.length > 0) {
    parts.push(`Trang trắng: ${compactPageList(variant.blankPages)}`)
  }
  if (variant.removedPages.length > 0) {
    parts.push(`Đã xoá: ${compactPageList(variant.removedPages)}`)
  }
  if (variant.imageWarningPages.length > 0) {
    parts.push(
      `Cảnh báo ảnh: trang ${compactPageList(variant.imageWarningPages)}`
    )
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

export function compactPageList(pages: number[]): string {
  if (pages.length <= 8) return pages.join(", ")
  return `${pages.slice(0, 8).join(", ")} +${pages.length - 8}`
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export function pdfEmbedUrl(url: string): string {
  if (!url || url.includes("#")) return url
  return `${url}#toolbar=1&navpanes=0&view=FitH&zoom=page-fit`
}
