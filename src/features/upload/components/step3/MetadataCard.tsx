import { useEffect, useState } from "react"
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
import { signatureTagInfo } from "@/features/upload/lib/signatureStatus"
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
        "overflow-hidden rounded-xl border bg-card transition-all duration-200",
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
          "flex items-center gap-3 px-4 py-2.5",
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
          className="flex size-8 shrink-0 items-center justify-center rounded-lg shadow-[0_4px_14px_rgba(0,82,255,0.2)]"
          style={{ background: "linear-gradient(135deg, #0052FF, #4D7CFF)" }}
        >
          <FileText className="size-3.5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-foreground">
            {item.data_path.split("/").pop()}
          </p>
          <p className="truncate font-roboto text-[10px] text-muted-foreground">
            {item.data_path}
          </p>
          {expertReviewed &&
            (item.metadata_review_note || expertReviewerName) && (
              <p className="mt-0.5 truncate text-[10px] font-semibold text-[#0052FF]">
                {item.metadata_review_note ||
                  `Đã review bởi: ${expertReviewerName}`}
              </p>
            )}
        </div>
        <div className="ml-auto flex shrink-0 items-center justify-end gap-1.5 whitespace-nowrap">
          {signatureTag && (
            <span
              title={signatureTag.title}
              className={cn(
                "flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 text-[10px] font-semibold",
                signatureTagClass(signatureTag.kind)
              )}
            >
              <Signature className="size-2.5" /> {signatureTag.label}
            </span>
          )}
          {hasMetadataEdits && (
            <span className="flex h-6 shrink-0 items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 text-[10px] font-semibold text-amber-700">
              <Edit2 className="size-2.5" /> Đã sửa
            </span>
          )}
          {expertReviewed ? (
            <span
              className="flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-[10px] font-semibold text-primary-foreground"
              style={{
                background: "linear-gradient(to right, #0052FF, #4D7CFF)",
              }}
            >
              <Check className="size-2.5" /> Chuyên gia xác thực
            </span>
          ) : autoVerified ? (
            <span className="flex h-6 shrink-0 items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 text-[10px] font-semibold text-emerald-700">
              <CheckCircle2 className="size-2.5" /> Tự động xác thực
            </span>
          ) : metadataFailed ? (
            <span className="flex h-6 shrink-0 items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2 text-[10px] font-semibold text-red-700">
              <AlertTriangle className="size-2.5" /> Lỗi metadata
            </span>
          ) : metadataPending ? (
            <span className="flex h-6 shrink-0 items-center gap-1 rounded-full border border-slate-300 bg-slate-50 px-2 text-[10px] font-semibold text-slate-600">
              Đang extract metadata
            </span>
          ) : hasWarnings ? (
            <span className="flex h-6 shrink-0 items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 text-[10px] font-semibold text-amber-700">
              <AlertTriangle className="size-2.5" /> Cần xác minh
            </span>
          ) : item.metadata_ready ? (
            <span className="flex h-6 shrink-0 items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 text-[10px] font-semibold text-emerald-700">
              <CheckCircle2 className="size-2.5" /> Sẵn sàng
            </span>
          ) : (
            <span className="flex h-6 shrink-0 items-center gap-1 rounded-full border border-slate-300 bg-slate-50 px-2 text-[10px] font-semibold text-slate-600">
              Đang extract metadata
            </span>
          )}
          {canRetryMetadata && (
            <Button
              variant="outline"
              size="sm"
              onClick={(event) => {
                event.stopPropagation()
                onRetry?.()
              }}
              disabled={retrying || submitting}
              className="h-6 shrink-0 rounded-full px-2 text-[10px]"
            >
              {retrying ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <RefreshCw data-icon="inline-start" />
              )}
              Chạy lại
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
