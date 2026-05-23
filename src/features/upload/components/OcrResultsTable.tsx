import { CheckCircle2, Loader2, AlertCircle, Clock, FileText } from "lucide-react"
import { motion } from "framer-motion"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/shared/lib/utils"
import type { FolderStatusResponse, JobSummary } from "@/features/upload/api/ocrApi"

const STATUS_LABELS: Record<string, string> = {
  pending: "Chờ xử lý",
  running: "Đang OCR",
  ocr_done: "OCR xong",
  metadata_priority_running: "Đang trích xuất",
  chinhly_available: "Sẵn sàng",
  done: "Hoàn thành",
  failed: "Lỗi",
  final_failed: "Lỗi cuối",
  cancel_requested: "Đang dừng",
  cancelled: "Đã dừng",
  signature_pending: "Chờ chữ ký",
  signature_failed: "Lỗi chữ ký",
}

function statusStyle(status: string): string {
  if (status === "done") return "bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] text-white"
  if (status === "failed" || status === "final_failed" || status === "signature_failed")
    return "bg-red-50 text-red-600 border border-red-200"
  if (status === "chinhly_available") return "bg-amber-50 text-amber-700 border border-amber-200"
  if (["pending", "running", "ocr_done", "metadata_priority_running"].includes(status))
    return "bg-[#0052FF]/5 text-[#0052FF] border border-[#0052FF]/20"
  return "bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]"
}

function StatusIcon({ status }: { status: string }) {
  if (status === "done") return <CheckCircle2 className="size-3.5 text-[#0052FF]" />
  if (status === "failed" || status === "final_failed") return <AlertCircle className="size-3.5 text-red-500" />
  if (["pending", "running", "ocr_done", "metadata_priority_running"].includes(status))
    return <Loader2 className="size-3.5 animate-spin text-[#0052FF]" />
  return <Clock className="size-3.5 text-[#64748B]" />
}

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

function JobCard({ job, index }: { job: JobSummary; index: number }) {
  const meta = job.light_metadata ?? {}
  const visibleMeta = Object.entries(METADATA_LABELS)
    .map(([key, label]) => ({ key, label, value: meta[key] }))
    .filter((e) => e.value !== undefined && e.value !== null && e.value !== "")

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: index * 0.05 }}
      className="flex flex-col gap-3 rounded-xl border border-[#E2E8F0] bg-white p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="size-3.5 shrink-0 text-[#64748B]" />
          <span className="truncate font-mono text-xs font-medium text-[#0F172A]">{job.data_path}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <StatusIcon status={job.status} />
          <span className={cn("rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em]", statusStyle(job.status))}>
            {STATUS_LABELS[job.status] ?? job.status}
          </span>
        </div>
      </div>

      {visibleMeta.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-lg bg-[#FAFAFA] p-3">
          {visibleMeta.map((e) => {
            const display = Array.isArray(e.value) ? (e.value as unknown[]).join(", ") : String(e.value)
            return (
              <div key={e.key} className="flex gap-3 text-xs">
                <span className="w-32 shrink-0 font-medium text-[#64748B]">{e.label}</span>
                <span className="flex-1 text-[#0F172A]">{display}</span>
              </div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}

interface OcrResultsTableProps {
  status: FolderStatusResponse
  isPolling: boolean
}

export function OcrResultsTable({ status, isPolling }: OcrResultsTableProps) {
  const counts = status.status_counts ?? {}
  const doneCount = counts["done"] ?? 0
  const total = status.total_files
  const progress = total > 0 ? (doneCount / total) * 100 : 0

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#64748B]">Kết quả</span>
          {isPolling && (
            <span className="flex items-center gap-1 rounded-full border border-[#0052FF]/20 bg-[#0052FF]/5 px-2 py-0.5 font-mono text-[10px] text-[#0052FF]">
              <Loader2 className="size-2.5 animate-spin" /> Live
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {Object.entries(counts).map(([s, n]) => (
            <span key={s} className={cn("rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold", statusStyle(s))}>
              {STATUS_LABELS[s] ?? s}: {n}
            </span>
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E2E8F0]">
        <motion.div
          className={cn(
            "h-full rounded-full",
            doneCount === total && total > 0
              ? "bg-gradient-to-r from-[#0052FF] to-[#4D7CFF]"
              : "bg-gradient-to-r from-[#0052FF] to-[#4D7CFF]",
          )}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{ boxShadow: progress > 0 ? "0 0 8px rgba(0,82,255,0.4)" : "none" }}
        />
      </div>

      {/* Job cards */}
      {status.jobs.length > 0 && (
        <ScrollArea className="max-h-80">
          <div className="flex flex-col gap-2 pr-1">
            {status.jobs.map((job, i) => (
              <JobCard key={job.id} job={job} index={i} />
            ))}
          </div>
        </ScrollArea>
      )}

      {status.missing_files.length > 0 && (
        <p className="font-mono text-[11px] text-[#64748B]">
          {status.missing_files.length} file chưa được start
        </p>
      )}
    </div>
  )
}
