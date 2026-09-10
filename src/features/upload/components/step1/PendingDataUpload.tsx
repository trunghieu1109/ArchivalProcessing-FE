export interface PendingDataUploadSummary {
  kind: "zip" | "folder"
  label: string
  fileCount: number
  totalBytes: number
}

export interface PendingDataUploadStartResult {
  kind: "zip" | "folder"
  completion?: Promise<void>
}

export interface UnifiedDataUploadHandle {
  startPending: () => Promise<PendingDataUploadStartResult | null>
  acceptPending: () => void
}

export function PendingDataUploadNotice({
  summary,
  onClear,
}: {
  summary: PendingDataUploadSummary
  onClear?: () => void
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2.5 text-xs">
      <span className="min-w-0 truncate font-semibold text-[#1E3A8A]">
        Đã chọn: {summary.label}
      </span>
      <span className="flex shrink-0 items-center gap-2 text-[#475569]">
        <span>
          {summary.kind === "folder"
            ? `${summary.fileCount.toLocaleString("vi-VN")} PDF · `
            : ""}
          {formatBytes(summary.totalBytes)} · Chờ bắt đầu
        </span>
        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#BFDBFE] bg-white px-2 font-semibold text-[#1D4ED8] transition-colors hover:bg-[#EFF6FF]"
          >
            <X className="size-3" />
            Chọn lại
          </button>
        ) : null}
      </span>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  )
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}
import { X } from "lucide-react"
