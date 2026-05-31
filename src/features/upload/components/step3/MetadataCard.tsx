import { useState } from "react"
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
} from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import { cn } from "@/shared/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  getWarningEntries,
  getWarningFields,
  hasMetadataWarning,
} from "@/features/upload/lib/metadata"
import type { PdfMetadata } from "@/features/upload/types"

export const METADATA_LABELS: Record<string, string> = {
  document_summary: "Trích yếu",
  trich_yeu_tai_lieu: "Trích yếu",
  document_type: "Loại văn bản",
  loai_van_ban: "Loại văn bản",
  document_number: "Số hiệu",
  so_hieu_tai_lieu: "Số hiệu",
  issuing_agency: "Cơ quan ban hành",
  co_quan_ban_hanh: "Cơ quan ban hành",
  issued_date: "Ngày ban hành",
  ngay_ban_hanh: "Ngày ban hành",
  signer: "Người ký",
  nguoi_ky: "Người ký",
  "nguoi ky": "Người ký",
}

function isMetadataFailed(status: string): boolean {
  return ["failed", "final_failed", "signature_failed"].includes(status)
}

function warningLabel(field: string): string {
  return METADATA_LABELS[field] ?? field.replace(/[_-]+/g, " ")
}

interface MetadataCardProps {
  item: PdfMetadata
  submitting?: boolean
  retrying?: boolean
  selected?: boolean
  onSelect?: () => void
  onRetry?: () => void
  onApply: (
    dataPath: string,
    meta: Record<string, unknown>
  ) => Promise<void> | void
}

export function MetadataCard({
  item,
  submitting = false,
  retrying = false,
  selected = false,
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
  const verified = item.review_status === "verified"
  const metadataFailed = isMetadataFailed(item.status)
  const metadataUnavailable = item.status === "failed" && !item.metadata_ready

  const startEdit = () => {
    const nextDraft: Record<string, string> = {}
    Object.keys(METADATA_LABELS).forEach((key) => {
      const value = item.light_metadata[key]
      nextDraft[key] = Array.isArray(value)
        ? value.map(String).join(", ")
        : String(value ?? "")
    })
    setDraft(nextDraft)
    setEditing(true)
    setExpanded(true)
  }

  const commitEdit = async () => {
    const updated: Record<string, unknown> = { ...item.light_metadata }
    Object.entries(draft).forEach(([key, value]) => {
      updated[key] = value
    })
    updated["_warnings"] = {}
    await applyMetadata(updated)
    setEditing(false)
  }

  const applyMetadata = async (metadata: Record<string, unknown>) => {
    try {
      await onApply(item.data_path, metadata)
      toast.success("Metadata đã được xác nhận.")
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Không thể xác nhận metadata."
      )
    }
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card transition-all duration-200",
        selected
          ? "border-[#0052FF] shadow-[0_6px_18px_rgba(0,82,255,0.14)]"
          : verified
            ? "border-primary/30 shadow-[0_2px_12px_rgba(0,82,255,0.08)]"
            : hasWarnings
              ? "border-amber-300"
              : "border-border"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3",
          onSelect && "cursor-pointer"
        )}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (!onSelect || (event.key !== "Enter" && event.key !== " ")) return
          event.preventDefault()
          onSelect()
        }}
        role={onSelect ? "button" : undefined}
        tabIndex={onSelect ? 0 : undefined}
      >
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
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {verified ? (
            <span
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-primary-foreground"
              style={{
                background: "linear-gradient(to right, #0052FF, #4D7CFF)",
              }}
            >
              <Check className="size-2.5" /> Xác nhận
            </span>
          ) : metadataFailed ? (
            <span className="flex items-center gap-1 rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
              <AlertTriangle className="size-2.5" /> Lỗi metadata
            </span>
          ) : hasWarnings ? (
            <span className="flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              <AlertTriangle className="size-2.5" /> Cần xác minh
            </span>
          ) : item.metadata_ready ? (
            <span className="flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              <CheckCircle2 className="size-2.5" /> Sẵn sàng
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              Đang lấy metadata
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((value) => !value)}
            className="size-7 p-0 text-muted-foreground"
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
                  {Object.entries(METADATA_LABELS).map(([key, label]) => (
                    <div key={key} className="flex items-start gap-2">
                      <span className="w-32 shrink-0 pt-2 text-[11px] font-medium text-muted-foreground">
                        {label}
                      </span>
                      <Input
                        value={draft[key] ?? ""}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            [key]: event.target.value,
                          }))
                        }
                        className="h-7 flex-1 text-xs"
                      />
                    </div>
                  ))}
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(false)}
                      disabled={submitting || retrying || metadataUnavailable}
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
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {metadataFailed && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {item.error ||
                        "Trích xuất metadata thất bại. Có thể chạy lại metadata cho tài liệu này."}
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
                              {warning.message && <span>{warning.message}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {Object.entries(METADATA_LABELS).map(([key, label]) => {
                    const value = item.light_metadata[key]
                    if (!value) return null
                    const display = Array.isArray(value)
                      ? value.map(String).join(", ")
                      : String(value)
                    const isWarning = warningFields.has(key)
                    return (
                      <div
                        key={key}
                        className={cn(
                          "flex gap-2 rounded-md px-2 py-1 text-xs",
                          isWarning && "bg-amber-50"
                        )}
                      >
                        <span
                          className={cn(
                            "w-32 shrink-0 font-medium",
                            isWarning
                              ? "text-amber-700"
                              : "text-muted-foreground"
                          )}
                        >
                          {label}
                          {isWarning && (
                            <AlertTriangle className="ml-1 inline size-2.5 text-amber-500" />
                          )}
                        </span>
                        <span
                          className={cn(
                            "flex-1",
                            isWarning ? "text-amber-900" : "text-foreground"
                          )}
                        >
                          {display}
                        </span>
                      </div>
                    )
                  })}
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={startEdit}
                      disabled={submitting || retrying || metadataUnavailable}
                    >
                      <Edit2 data-icon="inline-start" /> Sửa
                    </Button>
                    {metadataFailed && onRetry && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onRetry}
                        disabled={retrying}
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
                    {!verified && (
                      <Button
                        size="sm"
                        disabled={
                          submitting ||
                          retrying ||
                          !item.metadata_ready ||
                          metadataUnavailable
                        }
                        onClick={() => void applyMetadata(item.light_metadata)}
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
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
