import { useMemo, useState } from "react"
import {
  ChevronDown,
  ChevronUp,
  CircleAlert,
  CloudUpload,
  FileArchive,
  FolderOpen,
  RotateCcw,
  Square,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { cn } from "@/shared/lib/utils"
import {
  useZipUploadJobs,
  useZipUploadManager,
  type ZipUploadJob,
} from "@/features/zip-upload"
import { useFolderUploadJobs, useFolderUploadManager } from "./useFolderUpload"
import type { FolderUploadJob } from "./types"

export function GlobalUploadDock() {
  const folderJobs = useFolderUploadJobs()
  const zipJobs = useZipUploadJobs()
  const visibleFolderJobs = useMemo(
    () =>
      folderJobs
        .filter(
          (job) =>
            !job.dockHidden && !["completed", "cancelled"].includes(job.status)
        )
        .sort((left, right) => right.startedAt - left.startedAt),
    [folderJobs]
  )
  const visibleZipJobs = useMemo(
    () =>
      zipJobs
        .filter(
          (job) =>
            !job.dockHidden && !["completed", "cancelled"].includes(job.status)
        )
        .sort((left, right) => right.startedAt - left.startedAt),
    [zipJobs]
  )
  if (!visibleFolderJobs.length && !visibleZipJobs.length) return null
  return (
    <UploadDockContent
      visibleFolderJobs={visibleFolderJobs}
      visibleZipJobs={visibleZipJobs}
    />
  )
}

function UploadDockContent({
  visibleFolderJobs,
  visibleZipJobs,
}: {
  visibleFolderJobs: FolderUploadJob[]
  visibleZipJobs: ZipUploadJob[]
}) {
  const navigate = useNavigate()
  const folderManager = useFolderUploadManager()
  const zipManager = useZipUploadManager()
  const [expanded, setExpanded] = useState(false)
  const visibleCount = visibleFolderJobs.length + visibleZipJobs.length
  const needsAttention =
    visibleFolderJobs.some((job) => job.status === "attention_required") ||
    visibleZipJobs.some((job) => job.status === "attention_required")
  const displayExpanded = expanded || needsAttention

  return (
    <aside
      className={cn(
        "fixed right-4 bottom-4 z-[90] overflow-hidden rounded-2xl border border-[#CBD5E1] bg-white shadow-2xl transition-[width]",
        displayExpanded
          ? "w-[min(420px,calc(100vw-2rem))]"
          : "w-[min(280px,calc(100vw-2rem))]"
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between bg-[#0F172A] px-4 py-3 text-left text-white"
      >
        <span className="flex items-center gap-2 text-sm font-bold">
          <CloudUpload className="size-4" />
          Đang upload ({visibleCount})
        </span>
        {displayExpanded ? (
          <ChevronDown className="size-4" />
        ) : (
          <ChevronUp className="size-4" />
        )}
      </button>
      {displayExpanded && (
        <div className="max-h-[min(65vh,560px)] space-y-3 overflow-y-auto p-3">
          {visibleZipJobs.map((job) => (
            <ZipUploadJobCard
              key={job.id}
              job={job}
              onOpen={() =>
                navigate(
                  `/sessions/${encodeURIComponent(job.sessionId)}/step/1?upload=zip&zipUpload=${encodeURIComponent(job.id)}&focus=${Date.now()}`
                )
              }
              onRetry={() => void zipManager.retry(job.id)}
              onCancel={async () => {
                const cancelled = await zipManager.cancel(job.id)
                if (cancelled?.status === "cancelled") {
                  toast.info(
                    `Đã hủy upload. File ${cancelled.fileName} chưa hoàn thành và không được đưa vào xử lý.`
                  )
                }
              }}
            />
          ))}
          {visibleFolderJobs.map((job) => (
            <FolderUploadJobCard
              key={job.id}
              job={job}
              onOpen={() =>
                navigate(
                  `/sessions/${encodeURIComponent(job.sessionId)}/step/1?upload=folder&folderUpload=${encodeURIComponent(job.id)}&focus=${Date.now()}`
                )
              }
              onRetry={() => void folderManager.retry(job.id)}
              onCancel={async () => {
                const summary = await folderManager.cancel(job.id)
                if (summary?.status === "cancelled") {
                  toast.info(
                    `Đã hủy upload folder. Tạm tính: ${summary.counts.confirmed} thành công, ${summary.counts.skipped} bỏ qua, ${summary.counts.unfinished} chưa hoàn thành.`
                  )
                }
              }}
            />
          ))}
        </div>
      )}
    </aside>
  )
}

function FolderUploadJobCard({
  job,
  onOpen,
  onRetry,
  onCancel,
}: {
  job: FolderUploadJob
  onOpen: () => void
  onRetry: () => void
  onCancel: () => void | Promise<void>
}) {
  const counts = countFileStates(job)
  const percent =
    job.totalBytes > 0
      ? Math.min(100, Math.round((job.uploadedBytes / job.totalBytes) * 100))
      : 0
  const failedFiles = job.files
    .filter((file) => file.status === "failed")
    .slice(0, 3)

  return (
    <div className="rounded-xl border border-[#D8E1EC] bg-[#F8FAFC] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[#0F172A]">
            {job.rootName}
          </p>
          <p className="mt-0.5 text-xs text-[#64748B]">
            Session {job.sessionId.slice(0, 8)} ·{" "}
            {job.mode === "overwrite" ? "Overwrite" : "Append"} ·{" "}
            {job.files.length.toLocaleString("vi-VN")} PDF
          </p>
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E2E8F0]">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-200",
            job.status === "attention_required"
              ? "bg-[#DC2626]"
              : job.status === "cancelled"
                ? "bg-[#94A3B8]"
                : "bg-[#0052FF]"
          )}
          style={{
            width: `${
              ["sealing", "reconciling", "completed"].includes(job.status)
                ? 100
                : percent
            }%`,
          }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-[#334155]">
          {jobStatusLabel(job)}
        </span>
        <span className="shrink-0 text-[#64748B]">
          {counts.confirmed} xong
          {counts.skipped ? ` · ${counts.skipped} bỏ qua` : ""}
        </span>
      </div>

      {job.error && (
        <div className="mt-2 flex items-start gap-1.5 text-xs text-[#B91C1C]">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>{job.error}</span>
        </div>
      )}
      {failedFiles.length > 0 && (
        <ul className="mt-2 space-y-1 text-[11px] text-[#64748B]">
          {failedFiles.map((file) => (
            <li key={file.clientFileId} className="truncate">
              {file.relativePath}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="flex items-center gap-1.5 rounded-lg border border-[#BFDBFE] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#0052FF] hover:bg-[#EFF6FF]"
        >
          <FolderOpen className="size-3.5" />
          Mở màn upload
        </button>
        {job.status === "attention_required" && (
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-1.5 rounded-lg border border-[#93C5FD] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#0052FF]"
          >
            <RotateCcw className="size-3.5" />
            Thử lại
          </button>
        )}
        {!["sealing", "reconciling", "cancelling"].includes(job.status) &&
          job.summary?.status !== "sealed" && (
            <button
              type="button"
              onClick={onCancel}
              className="flex items-center gap-1.5 rounded-lg border border-[#FCA5A5] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#B91C1C]"
            >
              <Square className="size-3" />
              Hủy
            </button>
          )}
      </div>
    </div>
  )
}

function ZipUploadJobCard({
  job,
  onOpen,
  onRetry,
  onCancel,
}: {
  job: ZipUploadJob
  onOpen: () => void
  onRetry: () => void
  onCancel: () => void | Promise<void>
}) {
  const percent = Math.max(
    0,
    Math.min(100, Math.round(job.progress?.percent ?? 0))
  )
  return (
    <div className="rounded-xl border border-[#D8E1EC] bg-[#F8FAFC] p-3">
      <div className="flex min-w-0 items-start gap-2">
        <FileArchive className="mt-0.5 size-4 shrink-0 text-[#0052FF]" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[#0F172A]">
            {job.fileName}
          </p>
          <p className="mt-0.5 text-xs text-[#64748B]">
            Session {job.sessionId.slice(0, 8)} ·{" "}
            {job.mode === "overwrite" ? "Overwrite" : "Append"} · ZIP
          </p>
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E2E8F0]">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-200",
            job.status === "attention_required"
              ? "bg-[#DC2626]"
              : "bg-[#0052FF]"
          )}
          style={{
            width: `${job.status === "completing" ? 100 : percent}%`,
          }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-[#334155]">
          {zipJobStatusLabel(job)}
        </span>
        <span className="shrink-0 text-[#64748B]">
          {job.progress?.loadedMb.toFixed(1) ?? "0.0"} /{" "}
          {(job.fileSize / (1024 * 1024)).toFixed(1)} MB
        </span>
      </div>

      {job.error && (
        <div className="mt-2 flex items-start gap-1.5 text-xs text-[#B91C1C]">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>{job.error}</span>
        </div>
      )}

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="flex items-center gap-1.5 rounded-lg border border-[#BFDBFE] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#0052FF] hover:bg-[#EFF6FF]"
        >
          <FolderOpen className="size-3.5" />
          Mở màn upload
        </button>
        {job.status === "attention_required" && (
          <button
            type="button"
            onClick={onRetry}
            className="flex items-center gap-1.5 rounded-lg border border-[#93C5FD] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#0052FF]"
          >
            <RotateCcw className="size-3.5" />
            Thử lại
          </button>
        )}
        {!["completing", "cancelling"].includes(job.status) && (
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1.5 rounded-lg border border-[#FCA5A5] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#B91C1C]"
          >
            <Square className="size-3" />
            Hủy
          </button>
        )}
      </div>
    </div>
  )
}

function zipJobStatusLabel(job: ZipUploadJob): string {
  switch (job.status) {
    case "preparing":
      return "Đang chuẩn bị upload"
    case "uploading":
      return `Đang upload · ${Math.round(job.progress?.percent ?? 0)}%`
    case "completing":
      return "Đang xác nhận và giải nén ZIP"
    case "attention_required":
      return "Cần xử lý"
    case "cancelling":
      return "Đang hủy"
    case "cancelled":
      return "Đã hủy"
    case "completed":
      return "Hoàn tất"
  }
}

function countFileStates(job: FolderUploadJob): {
  confirmed: number
  skipped: number
} {
  let confirmed = 0
  let skipped = 0
  for (const file of job.files) {
    if (file.status === "confirmed") confirmed += 1
    if (file.status === "skipped") skipped += 1
  }
  return { confirmed, skipped }
}

function jobStatusLabel(job: FolderUploadJob): string {
  switch (job.status) {
    case "preparing":
      return "Đang khởi tạo"
    case "uploading":
      return `Đang tải lên · ${Math.round(
        (job.uploadedBytes / Math.max(1, job.totalBytes)) * 100
      )}%`
    case "sealing":
      return "Đang chốt danh sách file"
    case "reconciling":
      return "Đã tải xong, đang đồng bộ tài liệu"
    case "completed":
      return "Hoàn tất"
    case "attention_required":
      return "Cần xử lý"
    case "cancelling":
      return "Đang hủy"
    case "cancelled":
      return "Đã hủy; file thành công được giữ lại"
  }
}
