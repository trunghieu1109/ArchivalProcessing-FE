export interface PendingDataUploadSummary {
  kind: "zip" | "folder"
  label: string
  fileCount: number
  totalBytes: number
}

export interface UnifiedDataUploadHandle {
  startPending: () => Promise<"workflow" | "started" | null>
  acceptPending: () => void
}

export function PendingDataUploadNotice({
  summary,
}: {
  summary: PendingDataUploadSummary
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-2.5 text-xs">
      <span className="min-w-0 truncate font-semibold text-[#1E3A8A]">
        Đã chọn: {summary.label}
      </span>
      <span className="shrink-0 text-[#475569]">
        {summary.kind === "folder"
          ? `${summary.fileCount.toLocaleString("vi-VN")} PDF · `
          : ""}
        {formatBytes(summary.totalBytes)} · Chờ bắt đầu
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
