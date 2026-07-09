import { useEffect, useState, type ReactNode } from "react"
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Edit2,
  FileText,
  Loader2,
  RefreshCw,
  Signature,
  Trash2,
} from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import { cn } from "@/shared/lib/utils"
import { Button } from "@/components/ui/button"
import {
  getWarningEntries,
  getWarningFields,
  hasMetadataWarning,
} from "@/features/upload/lib/metadata"
import {
  signatureTagInfo,
  type SignatureTagInfo,
} from "@/features/upload/lib/signatureStatus"
import type { PdfMetadata } from "@/features/upload/types"

export {
  METADATA_FIELDS,
  METADATA_LABELS,
  metadataFieldText,
} from "./metadataCardUtils"
import {
  METADATA_FIELDS,
  fieldHasWarning,
  isMetadataFailed,
  metadataEditorRows,
  metadataFieldText,
  reviewerDisplayName,
  signatureTagClass,
  warningLabel,
} from "./metadataCardUtils"
import { isMetadataExtractionPending } from "./ProcessStep.metadataUtils"

interface MetadataCardProps {
  item: PdfMetadata
  submitting?: boolean
  retrying?: boolean
  selected?: boolean
  selectionMode?: boolean
  selectionChecked?: boolean
  selectionDisabled?: boolean
  readOnly?: boolean
  onSelectionChange?: (checked: boolean, shiftKey: boolean) => void
  onSelect?: (expanded: boolean) => void
  onRetry?: () => void
  onApply: (
    dataPath: string,
    meta?: Record<string, unknown>
  ) => Promise<void> | void
}

export function MetadataCard({
  item,
  submitting = false,
  retrying = false,
  selected = false,
  selectionMode = false,
  selectionChecked = false,
  selectionDisabled = false,
  readOnly = false,
  onSelectionChange,
  onSelect,
  onRetry,
  onApply,
}: MetadataCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const warningFields = getWarningFields(item.light_metadata)
  const warningEntries = getWarningEntries(item.light_metadata)
  const hasWarnings = hasMetadataWarning(item)
  const expertReviewed = item.is_reviewed === true
  const expertReviewerName = reviewerDisplayName(item)
  const metadataPending = isMetadataExtractionPending(item)
  const autoVerified =
    !metadataPending &&
    (item.review_status === "verified" || (item.metadata_ready && !hasWarnings))
  const metadataFailed = isMetadataFailed(item.status)
  const metadataUnavailable = metadataFailed && !item.metadata_ready
  const hasMetadataEdits = item.metadata_user_edited === true
  const signatureTag = signatureTagInfo(item)
  const canRetryMetadata = Boolean(!readOnly && onRetry && !metadataPending)
  const blankPageWarningPages = blankPageWarningOriginalPages(item)
  const hasBlankPageWarnings =
    blankPageWarningPages.length > 0 || hasBlankPageWarningEntries(item)
  const removedBlankPages = blankPageRemovedPages(item)
  const hasRemovedBlankPages = removedBlankPages.length > 0

  useEffect(() => {
    if (readOnly && editing) {
      setEditing(false)
    }
  }, [editing, readOnly])

  const startEdit = () => {
    if (readOnly) return
    const nextDraft: Record<string, string> = {}
    METADATA_FIELDS.forEach((field) => {
      nextDraft[field.key] = metadataFieldText(
        item.light_metadata,
        field.aliases
      )
    })
    setDraft(nextDraft)
    setEditing(true)
    setExpanded(true)
  }

  const commitEdit = async () => {
    if (readOnly) return
    const updated: Record<string, unknown> = { ...item.light_metadata }
    METADATA_FIELDS.forEach((field) => {
      field.aliases.forEach((alias) => {
        if (alias !== field.key) delete updated[alias]
      })
      updated[field.key] = draft[field.key] ?? ""
    })
    updated["_warnings"] = {}
    await applyMetadata(updated)
    setEditing(false)
  }

  const applyMetadata = async (metadata?: Record<string, unknown>) => {
    if (readOnly) return
    try {
      await onApply(item.data_path, metadata)
      toast.success("Metadata đã được xác nhận.")
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Không thể xác nhận metadata."
      )
    }
  }

  const toggleMetadata = () => {
    const next = !expanded
    setExpanded(next)
    onSelect?.(next)
    if (!next) {
      setEditing(false)
    }
  }

  return (
    <div
      className={cn(
        "@container/metadata-card overflow-hidden rounded-xl border bg-card transition-all duration-200",
        selected
          ? "border-[#0052FF] shadow-[0_6px_18px_rgba(0,82,255,0.14)]"
          : expertReviewed
            ? "border-primary/30 shadow-[0_2px_12px_rgba(0,82,255,0.08)]"
            : autoVerified
              ? "border-emerald-200 shadow-[0_2px_12px_rgba(16,185,129,0.08)]"
              : hasWarnings
                ? "border-amber-300"
                : "border-border"
      )}
    >
      <div
        className={cn(
          "flex min-w-0 items-center gap-2.5 px-3 py-2 sm:gap-3 sm:px-4",
          onSelect && "cursor-pointer"
        )}
        onClick={toggleMetadata}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return
          event.preventDefault()
          toggleMetadata()
        }}
        role="button"
        tabIndex={0}
      >
        {selectionMode && (
          <button
            type="button"
            role="checkbox"
            aria-checked={selectionChecked}
            aria-disabled={selectionDisabled}
            disabled={selectionDisabled}
            title="Chọn tài liệu"
            onClick={(event) => {
              event.stopPropagation()
              if (selectionDisabled) return
              onSelectionChange?.(!selectionChecked, event.shiftKey)
            }}
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded border transition-colors",
              selectionDisabled
                ? "cursor-not-allowed border-[#CBD5E1] bg-[#F8FAFC] text-transparent opacity-50"
                : selectionChecked
                  ? "border-[#0052FF] bg-[#0052FF] text-white"
                  : "border-[#CBD5E1] bg-white text-transparent hover:border-[#0052FF]/50"
            )}
          >
            <Check className="size-3.5" />
          </button>
        )}
        <div
          className="flex size-7 shrink-0 items-center justify-center rounded-lg shadow-[0_4px_14px_rgba(0,82,255,0.2)]"
          style={{ background: "linear-gradient(135deg, #0052FF, #4D7CFF)" }}
        >
          <FileText className="size-3.5 text-white" />
        </div>
        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
          {item.data_path.split("/").pop()}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <MetadataCompactTags
            signatureTag={signatureTag}
            hasMetadataEdits={hasMetadataEdits}
            hasBlankPageWarnings={hasBlankPageWarnings}
            blankPageWarningPages={blankPageWarningPages}
            hasRemovedBlankPages={hasRemovedBlankPages}
            removedBlankPages={removedBlankPages}
            expertReviewed={expertReviewed}
            autoVerified={autoVerified}
            metadataFailed={metadataFailed}
            metadataPending={metadataPending}
            hasWarnings={hasWarnings}
            metadataReady={item.metadata_ready}
          />
          {canRetryMetadata && (
            <Button
              variant="outline"
              size="sm"
              title="Chạy lại metadata"
              onClick={(event) => {
                event.stopPropagation()
                onRetry?.()
              }}
              disabled={retrying || submitting}
              className="size-6 shrink-0 rounded-full p-0"
            >
              {retrying ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <RefreshCw className="size-3" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation()
              toggleMetadata()
            }}
            className="size-6 shrink-0 p-0 text-muted-foreground"
          >
            {expanded ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
          </Button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border px-4 py-3">
              {editing ? (
                <div className="flex flex-col gap-2">
                  <MetadataDocumentInfo
                    item={item}
                    expertReviewed={expertReviewed}
                    expertReviewerName={expertReviewerName}
                    hasBlankPageWarnings={hasBlankPageWarnings}
                    blankPageWarningPages={blankPageWarningPages}
                    hasRemovedBlankPages={hasRemovedBlankPages}
                    removedBlankPages={removedBlankPages}
                  />
                  {METADATA_FIELDS.map((field) => (
                    <div
                      key={field.key}
                      className="grid min-w-0 grid-cols-1 gap-1 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-2"
                    >
                      <span className="pt-2 text-[11px] font-medium text-muted-foreground">
                        {field.label}
                      </span>
                      <textarea
                        value={draft[field.key] ?? ""}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            [field.key]: event.target.value,
                          }))
                        }
                        rows={metadataEditorRows(field.key)}
                        className="min-h-9 w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-xs leading-5 [overflow-wrap:anywhere] whitespace-pre-wrap transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50"
                      />
                    </div>
                  ))}
                  {!readOnly && (
                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditing(false)}
                        disabled={submitting || retrying}
                      >
                        Hủy
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => void commitEdit()}
                        disabled={submitting}
                      >
                        {submitting && (
                          <Loader2
                            data-icon="inline-start"
                            className="animate-spin"
                          />
                        )}
                        Lưu & xác nhận
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <MetadataDocumentInfo
                    item={item}
                    expertReviewed={expertReviewed}
                    expertReviewerName={expertReviewerName}
                    hasBlankPageWarnings={hasBlankPageWarnings}
                    blankPageWarningPages={blankPageWarningPages}
                    hasRemovedBlankPages={hasRemovedBlankPages}
                    removedBlankPages={removedBlankPages}
                  />
                  {metadataFailed && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {item.error ||
                        "Trích xuất metadata thất bại. Có thể chạy lại metadata hoặc tự nhập metadata cho tài liệu này."}
                    </div>
                  )}
                  {hasWarnings && !metadataFailed && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <AlertTriangle className="size-3" />
                        Metadata có cảnh báo, cần kiểm tra trước khi xác nhận.
                      </div>
                      {warningEntries.length > 0 && (
                        <div className="mt-1 flex flex-col gap-0.5">
                          {warningEntries.slice(0, 6).map((warning, index) => (
                            <div
                              key={`${warning.field || "warning"}-${index}`}
                              className="flex gap-1.5"
                            >
                              {warning.field && (
                                <span className="font-medium">
                                  {warningLabel(warning.field)}:
                                </span>
                              )}
                              {warning.message && (
                                <span>{warning.message}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {METADATA_FIELDS.map((field) => {
                    const display = metadataFieldText(
                      item.light_metadata,
                      field.aliases
                    )
                    const isWarning = fieldHasWarning(
                      warningFields,
                      field.aliases
                    )
                    return (
                      <div
                        key={field.key}
                        className={cn(
                          "grid min-w-0 grid-cols-1 gap-1 rounded-md px-2 py-1 text-xs sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-2",
                          isWarning && "bg-amber-50"
                        )}
                      >
                        <span
                          className={cn(
                            "font-medium",
                            isWarning
                              ? "text-amber-700"
                              : "text-muted-foreground"
                          )}
                        >
                          {field.label}
                          {isWarning && (
                            <AlertTriangle className="ml-1 inline size-2.5 text-amber-500" />
                          )}
                        </span>
                        <span
                          className={cn(
                            "min-h-4 min-w-0 [overflow-wrap:anywhere] break-words whitespace-pre-wrap",
                            isWarning
                              ? "text-amber-900"
                              : display
                                ? "text-foreground"
                                : "text-muted-foreground"
                          )}
                        >
                          {display}
                        </span>
                      </div>
                    )
                  })}
                  {!readOnly && (
                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={startEdit}
                        disabled={submitting || retrying}
                      >
                        <Edit2 data-icon="inline-start" /> Sửa
                      </Button>
                      {canRetryMetadata && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={onRetry}
                          disabled={retrying || submitting}
                        >
                          {retrying ? (
                            <Loader2
                              data-icon="inline-start"
                              className="animate-spin"
                            />
                          ) : (
                            <RefreshCw data-icon="inline-start" />
                          )}
                          Chạy lại metadata
                        </Button>
                      )}
                      {!expertReviewed && (
                        <Button
                          size="sm"
                          disabled={
                            submitting ||
                            retrying ||
                            !item.metadata_ready ||
                            metadataUnavailable
                          }
                          onClick={() => void applyMetadata()}
                        >
                          {submitting ? (
                            <Loader2
                              data-icon="inline-start"
                              className="animate-spin"
                            />
                          ) : (
                            <Check data-icon="inline-start" />
                          )}
                          Xác nhận
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function MetadataDocumentInfo({
  item,
  expertReviewed,
  expertReviewerName,
  hasBlankPageWarnings,
  blankPageWarningPages,
  hasRemovedBlankPages,
  removedBlankPages,
}: {
  item: PdfMetadata
  expertReviewed: boolean
  expertReviewerName: string
  hasBlankPageWarnings: boolean
  blankPageWarningPages: number[]
  hasRemovedBlankPages: boolean
  removedBlankPages: number[]
}) {
  const reviewNote =
    item.metadata_review_note ||
    (expertReviewerName ? `Đã review bởi: ${expertReviewerName}` : "")

  return (
    <div className="space-y-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5">
      <div>
        <p className="text-[10px] font-semibold tracking-wide text-[#64748B] uppercase">
          Đường dẫn
        </p>
        <p className="mt-0.5 break-all font-roboto text-xs leading-5 text-[#0F172A]">
          {item.data_path}
        </p>
      </div>
      {expertReviewed && reviewNote ? (
        <div>
          <p className="text-[10px] font-semibold tracking-wide text-[#64748B] uppercase">
            Ghi chú review
          </p>
          <p className="mt-0.5 text-xs font-medium text-[#0052FF]">{reviewNote}</p>
        </div>
      ) : null}
      {hasBlankPageWarnings ? (
        <div>
          <p className="text-[10px] font-semibold tracking-wide text-amber-900 uppercase">
            Cảnh báo trang trắng
          </p>
          <p className="mt-0.5 text-xs font-medium text-amber-950">
            {blankPageWarningPages.length > 0
              ? `Trang ${blankPageWarningPages.join(", ")}`
              : "Có cảnh báo cần kiểm tra"}
          </p>
        </div>
      ) : hasRemovedBlankPages ? (
        <div>
          <p className="text-[10px] font-semibold tracking-wide text-sky-800 uppercase">
            Đã xóa trang trắng
          </p>
          <p className="mt-0.5 text-xs text-sky-900">
            Trang {removedBlankPages.join(", ")}
          </p>
        </div>
      ) : null}
    </div>
  )
}

function MetadataTagBadge({
  title,
  className,
  icon,
  label,
}: {
  title: string
  className: string
  icon: ReactNode
  label: string
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-5 max-w-full items-center gap-1 rounded-full border px-1.5 text-[10px] font-semibold @max-[22rem]/metadata-card:gap-0 @max-[22rem]/metadata-card:px-1",
        className
      )}
    >
      {icon}
      <span className="@max-[22rem]/metadata-card:hidden">{label}</span>
    </span>
  )
}

function MetadataCompactTags({
  signatureTag,
  hasMetadataEdits,
  hasBlankPageWarnings,
  blankPageWarningPages,
  hasRemovedBlankPages,
  removedBlankPages,
  expertReviewed,
  autoVerified,
  metadataFailed,
  metadataPending,
  hasWarnings,
  metadataReady,
}: {
  signatureTag: SignatureTagInfo | null
  hasMetadataEdits: boolean
  hasBlankPageWarnings: boolean
  blankPageWarningPages: number[]
  hasRemovedBlankPages: boolean
  removedBlankPages: number[]
  expertReviewed: boolean
  autoVerified: boolean
  metadataFailed: boolean
  metadataPending: boolean
  hasWarnings: boolean
  metadataReady: boolean
}) {
  const primaryStatus = expertReviewed
    ? {
        label: "Xác thực",
        title: "Chuyên gia xác thực",
        className:
          "border-transparent bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] text-white",
        icon: <Check className="size-2.5" />,
      }
    : autoVerified
      ? {
          label: "Tự động",
          title: "Tự động xác thực",
          className: "border-emerald-300 bg-emerald-50 text-emerald-700",
          icon: <CheckCircle2 className="size-2.5" />,
        }
      : metadataFailed
        ? {
            label: "Lỗi",
            title: "Lỗi metadata",
            className: "border-red-300 bg-red-50 text-red-700",
            icon: <AlertTriangle className="size-2.5" />,
          }
        : metadataPending
          ? {
              label: "Extract",
              title: "Đang extract metadata",
              className: "border-slate-300 bg-slate-50 text-slate-600",
              icon: <Loader2 className="size-2.5" />,
            }
          : hasWarnings
            ? {
                label: "Xác minh",
                title: "Cần xác minh metadata",
                className: "border-amber-300 bg-amber-50 text-amber-700",
                icon: <AlertTriangle className="size-2.5" />,
              }
            : metadataReady
              ? {
                  label: "Sẵn sàng",
                  title: "Metadata sẵn sàng",
                  className: "border-emerald-300 bg-emerald-50 text-emerald-700",
                  icon: <CheckCircle2 className="size-2.5" />,
                }
              : {
                  label: "Extract",
                  title: "Đang extract metadata",
                  className: "border-slate-300 bg-slate-50 text-slate-600",
                  icon: <Loader2 className="size-2.5" />,
                }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <MetadataTagBadge
        title={primaryStatus.title}
        className={primaryStatus.className}
        icon={primaryStatus.icon}
        label={primaryStatus.label}
      />
      {signatureTag ? (
        <MetadataTagBadge
          title={signatureTag.title || signatureTag.label}
          className={signatureTagClass(signatureTag.kind)}
          icon={<Signature className="size-2.5" />}
          label={signatureTag.label}
        />
      ) : null}
      {hasBlankPageWarnings ? (
        <MetadataTagBadge
          title={
            blankPageWarningPages.length > 0
              ? `Cảnh báo trang trắng: ${blankPageWarningPages.join(", ")}`
              : "Cảnh báo trang trắng"
          }
          className="border-amber-500 bg-amber-200 text-amber-950"
          icon={<AlertTriangle className="size-2.5" />}
          label="Cảnh báo trang trắng"
        />
      ) : hasRemovedBlankPages ? (
        <MetadataTagBadge
          title={`Đã xóa trang trắng: ${removedBlankPages.join(", ")}`}
          className="border-sky-400 bg-sky-50 text-sky-800"
          icon={<Trash2 className="size-2.5" />}
          label="Đã xóa trang trắng"
        />
      ) : null}
      {hasMetadataEdits ? (
        <span
          title="Metadata đã được chỉnh sửa"
          className="inline-flex h-5 items-center rounded-full border border-amber-300 bg-amber-50 px-1.5 text-amber-700 @max-[22rem]/metadata-card:px-1"
        >
          <Edit2 className="size-2.5" />
        </span>
      ) : null}
    </div>
  )
}

function blankPageWarningOriginalPages(item: PdfMetadata): number[] {
  const preprocessing = item.pdf_preprocessing
  if (!preprocessing || typeof preprocessing !== "object") return []
  const pages = new Set<number>()
  const imageWarningPages = preprocessing.image_warning_pages
  if (Array.isArray(imageWarningPages)) {
    imageWarningPages.forEach((value) => {
      const page = Number(value)
      if (Number.isInteger(page) && page > 0) pages.add(page)
    })
  }
  const warnings = preprocessing.blank_page_warnings
  if (Array.isArray(warnings)) {
    warnings.forEach((warning) => {
      if (!warning || typeof warning !== "object") return
      const page = Number(
        (warning as Record<string, unknown>).page_number
      )
      if (Number.isInteger(page) && page > 0) pages.add(page)
    })
  }
  return [...pages].sort((left, right) => left - right)
}

function hasBlankPageWarningEntries(item: PdfMetadata): boolean {
  const preprocessing = item.pdf_preprocessing
  if (!preprocessing || typeof preprocessing !== "object") return false
  const warnings = preprocessing.blank_page_warnings
  return Array.isArray(warnings) && warnings.length > 0
}

function blankPageRemovedPages(item: PdfMetadata): number[] {
  const preprocessing = item.pdf_preprocessing
  if (!preprocessing || typeof preprocessing !== "object") return []
  const removedPages =
    "removed_pages" in preprocessing
      ? preprocessing.removed_pages
      : preprocessing.blank_pages
  if (!Array.isArray(removedPages)) return []
  return [
    ...new Set(
      removedPages
        .map(Number)
        .filter((page) => Number.isInteger(page) && page > 0)
    ),
  ].sort((left, right) => left - right)
}
