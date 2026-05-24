import { useState, useEffect } from "react"
import {
  FileText,
  Edit2,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { cn } from "@/shared/lib/utils"
import type { PdfMetadata } from "@/features/upload/types"

const METADATA_LABELS: Record<string, string> = {
  loai_van_ban: "Loại văn bản",
  so_hieu_tai_lieu: "Số hiệu",
  co_quan_ban_hanh: "Cơ quan ban hành",
  ngay_ban_hanh: "Ngày ban hành",
  trich_yeu_tai_lieu: "Trích yếu",
  mentioned_subjects: "Đối tượng đề cập",
  direct_target_subject: "Đối tượng hướng tới",
  "nguoi ky": "Người ký",
}

// Mock OCR response based on API.md example
function mockOcrResponse(data_path: string): PdfMetadata {
  return {
    data_path,
    status: "done",
    applied: false,
    light_metadata: {
      loai_van_ban: "Quyết định",
      so_hieu_tai_lieu: "29/QĐ-UBND",
      co_quan_ban_hanh: "ỦY BAN NHÂN DÂN QUẬN DƯƠNG KINH",
      ngay_ban_hanh: "04/01/2021",
      trich_yeu_tai_lieu: "Về việc bổ nhiệm chức danh nghề nghiệp",
      mentioned_subjects: ["Bà Ngô Thị Điểm", "Trường THCS Anh Dũng"],
      direct_target_subject: "Bà Ngô Thị Điểm",
      "nguoi ky": "Nguyễn Văn A",
    },
  }
}

interface MetadataCardProps {
  item: PdfMetadata
  onApply: (data_path: string, meta: Record<string, unknown>) => void
}

function MetadataCard({ item, onApply }: MetadataCardProps) {
  const [expanded, setExpanded] = useState(true)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})

  const startEdit = () => {
    const d: Record<string, string> = {}
    Object.keys(METADATA_LABELS).forEach((k) => {
      const v = item.light_metadata[k]
      d[k] = Array.isArray(v) ? v.join(", ") : String(v ?? "")
    })
    setDraft(d)
    setEditing(true)
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
    onApply(item.data_path, updated)
    setEditing(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "overflow-hidden rounded-2xl border bg-white transition-all duration-300",
        item.applied
          ? "border-[#0052FF]/20 shadow-[0_4px_24px_rgba(0,82,255,0.08)]"
          : "border-[#E2E8F0]"
      )}
    >
      {item.applied && (
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-[#0052FF]/[0.03] to-transparent" />
      )}

      {/* Card header */}
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-lg"
            style={{
              background: "linear-gradient(135deg, #0052FF, #4D7CFF)",
              boxShadow: "0 4px 14px rgba(0,82,255,0.2)",
            }}
          >
            <FileText className="size-4 text-white" />
          </div>
          <span className="truncate font-roboto text-xs font-medium text-[#0F172A]">
            {item.data_path}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {item.applied && (
            <span
              className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white"
              style={{
                background: "linear-gradient(to right, #0052FF, #4D7CFF)",
              }}
            >
              <Check className="size-3" /> Đã áp dụng
            </span>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#F1F5F9]"
          >
            {expanded ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-[#E2E8F0] px-5 py-4">
              {editing ? (
                <div className="flex flex-col gap-3">
                  {Object.entries(METADATA_LABELS).map(([key, label]) => (
                    <div key={key} className="flex items-start gap-3">
                      <span className="w-40 shrink-0 pt-1.5 text-xs font-medium text-[#64748B]">
                        {label}
                      </span>
                      <input
                        value={draft[key] ?? ""}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, [key]: e.target.value }))
                        }
                        className="flex-1 rounded-lg border border-[#E2E8F0] bg-[#FAFAFA] px-3 py-1.5 text-xs text-[#0F172A] outline-none focus:border-[#0052FF]/40 focus:ring-1 focus:ring-[#0052FF]/20"
                      />
                    </div>
                  ))}
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setEditing(false)}
                      className="rounded-xl border border-[#E2E8F0] px-4 py-2 text-xs font-medium text-[#64748B] hover:bg-[#F1F5F9]"
                    >
                      Hủy
                    </button>
                    <button
                      onClick={commitEdit}
                      className="rounded-xl px-4 py-2 text-xs font-semibold text-white"
                      style={{
                        background:
                          "linear-gradient(to right, #0052FF, #4D7CFF)",
                        boxShadow: "0 4px 14px rgba(0,82,255,0.25)",
                      }}
                    >
                      Lưu & Áp dụng
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {Object.entries(METADATA_LABELS).map(([key, label]) => {
                    const v = item.light_metadata[key]
                    if (!v) return null
                    const display = Array.isArray(v) ? v.join(", ") : String(v)
                    return (
                      <div key={key} className="flex gap-3 text-xs">
                        <span className="w-40 shrink-0 font-medium text-[#64748B]">
                          {label}
                        </span>
                        <span className="flex-1 text-[#0F172A]">{display}</span>
                      </div>
                    )
                  })}
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={startEdit}
                      className="flex items-center gap-1.5 rounded-xl border border-[#E2E8F0] px-4 py-2 text-xs font-medium text-[#0F172A] hover:border-[#0052FF]/30 hover:text-[#0052FF]"
                    >
                      <Edit2 className="size-3" /> Sửa
                    </button>
                    {!item.applied && (
                      <button
                        onClick={() =>
                          onApply(item.data_path, item.light_metadata)
                        }
                        className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white"
                        style={{
                          background:
                            "linear-gradient(to right, #0052FF, #4D7CFF)",
                          boxShadow: "0 4px 14px rgba(0,82,255,0.2)",
                        }}
                      >
                        <Check className="size-3" /> Áp dụng
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

interface MetadataPanelProps {
  pdfPaths: string[]
  onConfirm: (items: PdfMetadata[]) => void
}

export function MetadataPanel({ pdfPaths, onConfirm }: MetadataPanelProps) {
  const [items, setItems] = useState<PdfMetadata[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate API call delay then return mock data
    const timer = setTimeout(() => {
      setItems(pdfPaths.map((p) => mockOcrResponse(p)))
      setLoading(false)
    }, 800)
    return () => clearTimeout(timer)
  }, [pdfPaths])

  const handleApply = (data_path: string, meta: Record<string, unknown>) => {
    setItems((prev) =>
      prev.map((item) =>
        item.data_path === data_path
          ? { ...item, light_metadata: meta, applied: true }
          : item
      )
    )
  }

  const allApplied = items.length > 0 && items.every((i) => i.applied)
  const appliedCount = items.filter((i) => i.applied).length

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-[#0052FF]/30 bg-[#0052FF]/5 px-3 py-1">
            <span className="size-1.5 rounded-full bg-[#0052FF]" />
            <span className="font-roboto text-[11px] tracking-[0.15em] text-[#0052FF] uppercase">
              Bước 3 / 5
            </span>
          </div>
          <h2
            className="text-2xl text-[#0F172A]"
            style={{ fontFamily: "'Calistoga', Georgia, serif" }}
          >
            Metadata tài liệu
          </h2>
          <p className="mt-1 text-sm text-[#64748B]">
            Xem lại metadata OCR cho từng file PDF. Sửa nếu cần rồi bấm Áp dụng.
          </p>
        </div>
        {!loading && (
          <div className="shrink-0 text-right">
            <p className="text-xs text-[#64748B]">Đã áp dụng</p>
            <p className="text-2xl font-bold text-[#0052FF]">
              {appliedCount}
              <span className="font-roboto text-sm text-[#64748B]">
                /{items.length}
              </span>
            </p>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-[#E2E8F0] bg-white py-16">
          <Loader2 className="size-5 animate-spin text-[#0052FF]" />
          <span className="text-sm text-[#64748B]">
            Đang tải metadata từ OCR…
          </span>
        </div>
      ) : items.length === 0 ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-[#E2E8F0] bg-white py-16">
          <AlertCircle className="size-5 text-[#64748B]" />
          <span className="text-sm text-[#64748B]">
            Không tìm thấy file PDF trong kho lưu trữ.
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <MetadataCard
              key={item.data_path}
              item={item}
              onApply={handleApply}
            />
          ))}
        </div>
      )}

      {!loading && (
        <div className="flex items-center justify-between rounded-2xl border border-[#E2E8F0] bg-white px-6 py-4">
          <p className="text-sm text-[#64748B]">
            {allApplied
              ? "Tất cả metadata đã được xác nhận."
              : `Còn ${items.length - appliedCount} file chưa áp dụng.`}
          </p>
          <button
            disabled={!allApplied}
            onClick={() => {
              if (!allApplied) {
                toast.error(
                  `Còn ${items.length - appliedCount} file chưa được áp dụng.`
                )
                return
              }
              toast.success("Metadata đã xác nhận! Bắt đầu phân cụm.")
              onConfirm(items)
            }}
            className={cn(
              "flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all duration-200",
              allApplied
                ? "text-white hover:-translate-y-0.5 active:scale-[0.98]"
                : "cursor-not-allowed bg-[#F1F5F9] text-[#64748B]"
            )}
            style={
              allApplied
                ? {
                    background: "linear-gradient(to right, #0052FF, #4D7CFF)",
                    boxShadow: "0 4px 14px rgba(0,82,255,0.25)",
                  }
                : {}
            }
          >
            Phân cụm tài liệu →
          </button>
        </div>
      )}
    </motion.div>
  )
}
