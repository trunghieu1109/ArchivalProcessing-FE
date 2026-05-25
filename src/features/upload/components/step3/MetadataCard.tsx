import { useState } from "react"
import {
  FileText,
  Edit2,
  Check,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { cn } from "@/shared/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { PdfMetadata } from "@/features/upload/types"

export const METADATA_LABELS: Record<string, string> = {
  loai_van_ban: "Loại văn bản",
  so_hieu_tai_lieu: "Số hiệu",
  co_quan_ban_hanh: "Cơ quan ban hành",
  ngay_ban_hanh: "Ngày ban hành",
  trich_yeu_tai_lieu: "Trích yếu",
  mentioned_subjects: "Đối tượng đề cập",
  direct_target_subject: "Đối tượng hướng tới",
  "nguoi ky": "Người ký",
}

export function getWarningFields(meta: Record<string, unknown>): Set<string> {
  const warnings = meta["_warnings"]
  if (!warnings || typeof warnings !== "object") return new Set()
  return new Set(Object.keys(warnings as Record<string, unknown>))
}

export function mockOcrResponse(data_path: string, index: number): PdfMetadata {
  const hasWarnings = index % 2 === 0
  return {
    data_path,
    status: "done",
    applied: false,
    light_metadata: {
      loai_van_ban: "Quyết định",
      so_hieu_tai_lieu: `${29 + index}/QĐ-UBND`,
      co_quan_ban_hanh: "ỦY BAN NHÂN DÂN QUẬN DƯƠNG KINH",
      ngay_ban_hanh: "04/01/2021",
      trich_yeu_tai_lieu: "Về việc bổ nhiệm chức danh nghề nghiệp",
      mentioned_subjects: ["Bà Ngô Thị Điểm", "Trường THCS Anh Dũng"],
      direct_target_subject: "Bà Ngô Thị Điểm",
      "nguoi ky": "Nguyễn Văn A",
      _warnings: hasWarnings
        ? { mentioned_subjects: "low confidence", "nguoi ky": "unverified" }
        : {},
    },
  }
}

interface MetadataCardProps {
  item: PdfMetadata
  onApply: (data_path: string, meta: Record<string, unknown>) => void
}

export function MetadataCard({ item, onApply }: MetadataCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const warningFields = getWarningFields(item.light_metadata)
  const hasWarnings = warningFields.size > 0

  const startEdit = () => {
    const d: Record<string, string> = {}
    Object.keys(METADATA_LABELS).forEach((k) => {
      const v = item.light_metadata[k]
      d[k] = Array.isArray(v) ? (v as string[]).join(", ") : String(v ?? "")
    })
    setDraft(d)
    setEditing(true)
    setExpanded(true)
  }

  const commitEdit = () => {
    const updated: Record<string, unknown> = { ...item.light_metadata }
    Object.entries(draft).forEach(([k, v]) => {
      if (k === "mentioned_subjects")
        updated[k] = v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      else updated[k] = v
    })
    updated["_warnings"] = {}
    onApply(item.data_path, updated)
    setEditing(false)
    toast.success("Metadata đã được cập nhật.")
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card transition-all duration-200",
        item.applied
          ? "border-primary/30 shadow-[0_2px_12px_rgba(0,82,255,0.08)]"
          : hasWarnings
            ? "border-amber-300"
            : "border-border"
      )}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
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
          {item.applied ? (
            <span
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-primary-foreground"
              style={{
                background: "linear-gradient(to right, #0052FF, #4D7CFF)",
              }}
            >
              <Check className="size-2.5" /> Xác nhận
            </span>
          ) : hasWarnings ? (
            <span className="flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              <AlertTriangle className="size-2.5" /> Cần xác minh
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              <CheckCircle2 className="size-2.5" /> Tin cậy
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
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
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, [key]: e.target.value }))
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
                    >
                      Hủy
                    </Button>
                    <Button size="sm" onClick={commitEdit}>
                      Lưu & Xác nhận
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {Object.entries(METADATA_LABELS).map(([key, label]) => {
                    const v = item.light_metadata[key]
                    if (!v) return null
                    const display = Array.isArray(v)
                      ? (v as string[]).join(", ")
                      : String(v)
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
                    <Button variant="outline" size="sm" onClick={startEdit}>
                      <Edit2 data-icon="inline-start" /> Sửa
                    </Button>
                    {!item.applied && (
                      <Button
                        size="sm"
                        onClick={() =>
                          onApply(item.data_path, item.light_metadata)
                        }
                      >
                        <Check data-icon="inline-start" /> Xác nhận
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
