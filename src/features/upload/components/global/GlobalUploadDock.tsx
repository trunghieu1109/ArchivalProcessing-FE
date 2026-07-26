import { useMemo, useState, useSyncExternalStore } from "react"
import { useNavigate } from "react-router-dom"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CloudUpload,
  FileArchive,
  Folder,
  FolderOpen,
  Loader2,
  RefreshCw,
  Square,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  folderUploadManager,
  type FolderUploadJob,
} from "@/features/upload/lib/folderUploadManager"
import {
  zipUploadManager,
  type ZipUploadJob,
} from "@/features/upload/lib/zipUploadManager"
import { cn } from "@/shared/lib/utils"

type GlobalUploadJob = FolderUploadJob | ZipUploadJob

export function GlobalUploadDock() {
  const navigate = useNavigate()
  const folderJobs = useSyncExternalStore(
    folderUploadManager.subscribe,
    folderUploadManager.getSnapshot,
    folderUploadManager.getSnapshot
  )
  const zipJobs = useSyncExternalStore(
    zipUploadManager.subscribe,
    zipUploadManager.getSnapshot,
    zipUploadManager.getSnapshot
  )
  const jobs = useMemo(
    () =>
      [...folderJobs, ...zipJobs]
        .filter((job) => !["completed", "cancelled"].includes(job.status))
        .sort((left, right) => right.createdAt - left.createdAt),
    [folderJobs, zipJobs]
  )
  const needsAttention = jobs.some((job) =>
    ["attention_required", "failed"].includes(job.status)
  )
  const [expanded, setExpanded] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<GlobalUploadJob | null>(null)
  const [cancelBusy, setCancelBusy] = useState(false)
  const displayExpanded = expanded || needsAttention

  if (jobs.length === 0) return null

  const retry = async (job: GlobalUploadJob) => {
    try {
      if (job.kind === "folder") {
        await folderUploadManager.retry(job.id)
      } else {
        await zipUploadManager.retry(job.id)
      }
      toast.success(
        `Đã hoàn tất upload ${job.kind === "folder" ? "folder" : "ZIP"}.`
      )
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const confirmCancel = async () => {
    const job = cancelTarget
    if (!job || cancelBusy) return
    setCancelBusy(true)
    try {
      if (job.kind === "folder") {
        await folderUploadManager.cancel(job.id)
      } else {
        await zipUploadManager.cancel(job.id)
      }
      toast.info(
        job.kind === "folder"
          ? "Đã hủy phần còn lại; các PDF đã xác nhận vẫn được giữ."
          : "Đã hủy ZIP chưa hoàn tất."
      )
      setCancelTarget(null)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setCancelBusy(false)
    }
  }

  return (
    <>
      <aside
        className={cn(
          "fixed right-4 bottom-4 z-[100] overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-[0_20px_60px_-18px_rgba(15,23,42,0.45)] transition-[width] duration-200",
          displayExpanded
            ? "w-[min(27rem,calc(100vw-2rem))]"
            : "w-[min(18rem,calc(100vw-2rem))]"
        )}
        aria-label="Tiến trình upload"
      >
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 bg-slate-950 px-4 py-3 text-left text-white transition-colors hover:bg-slate-900"
          aria-expanded={displayExpanded}
          onClick={() => setExpanded((value) => !value)}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="relative flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
              <CloudUpload className="size-4" />
              {!needsAttention && (
                <span className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full bg-blue-400 ring-2 ring-slate-950" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">
                {needsAttention ? "Upload cần xử lý" : "Đang upload"}
              </span>
              <span className="block text-[11px] text-slate-300">
                {jobs.length} tác vụ đang được theo dõi
              </span>
            </span>
          </span>
          {displayExpanded ? (
            <ChevronDown className="size-4 shrink-0" />
          ) : (
            <ChevronUp className="size-4 shrink-0" />
          )}
        </button>

        {displayExpanded && (
          <div className="max-h-[min(66vh,35rem)] space-y-3 overflow-y-auto bg-slate-50/80 p-3">
            {jobs.map((job) => (
              <UploadJobCard
                key={job.id}
                job={job}
                onOpen={() =>
                  navigate(
                    `/sessions/${encodeURIComponent(job.sessionId)}/step/1`
                  )
                }
                onRetry={() => void retry(job)}
                onCancel={() => setCancelTarget(job)}
              />
            ))}
          </div>
        )}
      </aside>

      {cancelTarget && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={(event) => {
            if (!cancelBusy && event.target === event.currentTarget) {
              setCancelTarget(null)
            }
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="cancel-upload-title"
            aria-describedby="cancel-upload-description"
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <AlertTriangle className="size-5" />
              </span>
              <div>
                <h2
                  id="cancel-upload-title"
                  className="text-lg font-bold text-slate-950"
                >
                  Hủy upload {cancelTarget.kind === "folder" ? "folder" : "ZIP"}
                  ?
                </h2>
                <p
                  id="cancel-upload-description"
                  className="mt-1.5 text-sm leading-6 text-slate-600"
                >
                  {cancelTarget.kind === "folder"
                    ? "Các PDF đã xác nhận hoặc được bỏ qua vẫn được giữ. File đang PUT và phần chưa hoàn tất sẽ bị hủy; hệ thống tiếp tục đối soát phần thành công."
                    : `File ${cancelTarget.fileName} chưa hoàn tất sẽ không được đưa vào xử lý metadata.`}
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={cancelBusy}
                onClick={() => setCancelTarget(null)}
              >
                Quay lại
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={cancelBusy}
                onClick={() => void confirmCancel()}
              >
                {cancelBusy && <Loader2 className="size-4 animate-spin" />}
                {cancelBusy ? "Đang hủy..." : "Hủy upload"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function UploadJobCard({
  job,
  onOpen,
  onRetry,
  onCancel,
}: {
  job: GlobalUploadJob
  onOpen: () => void
  onRetry: () => void
  onCancel: () => void
}) {
  const attention = ["attention_required", "failed"].includes(job.status)
  const progress = Math.max(0, Math.min(100, Math.round(job.percent)))

  return (
    <article
      className={cn(
        "rounded-xl border bg-white p-3 shadow-sm",
        attention ? "border-amber-300" : "border-slate-200"
      )}
    >
      <div className="flex items-start gap-2.5">
        <JobIcon job={job} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-950">
                {job.kind === "folder" ? job.rootName : job.fileName}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {job.kind === "folder" ? "Folder PDF" : "File ZIP"} ·{" "}
                {job.mode === "overwrite" ? "Ghi đè" : "Bổ sung"} · Session{" "}
                {job.sessionId.slice(0, 8)}
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
                attention
                  ? "bg-amber-100 text-amber-800"
                  : "bg-blue-50 text-blue-700"
              )}
            >
              {progress}%
            </span>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-300",
                attention ? "bg-amber-500" : "bg-blue-600"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-2 flex items-start justify-between gap-3 text-[11px]">
            <span
              className={cn(
                "font-semibold",
                attention ? "text-amber-800" : "text-slate-700"
              )}
            >
              {jobStatusLabel(job)}
            </span>
            {job.kind === "zip" && (
              <span className="shrink-0 text-slate-500">
                {formatBytes(job.loadedBytes)}/{formatBytes(job.totalBytes)}
              </span>
            )}
          </div>

          {job.error && (
            <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-xs leading-5 text-amber-800">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span className="line-clamp-3">{job.error}</span>
            </div>
          )}

          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
              onClick={onOpen}
            >
              <FolderOpen className="size-3.5" /> Mở màn upload
            </Button>
            {canRetry(job) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={onRetry}
              >
                <RefreshCw className="size-3.5" /> Thử lại
              </Button>
            )}
            {canCancel(job) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={onCancel}
              >
                <Square className="size-3" /> Hủy
              </Button>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

function JobIcon({ job }: { job: GlobalUploadJob }) {
  if (job.status === "completed") {
    return <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
  }
  if (["attention_required", "failed"].includes(job.status)) {
    return <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
  }
  if (job.status === "cancelled") {
    return <X className="mt-0.5 size-5 shrink-0 text-slate-500" />
  }
  if (job.kind === "folder" && job.status === "creating") {
    return <Folder className="mt-0.5 size-5 shrink-0 text-blue-600" />
  }
  if (job.kind === "zip" && job.status === "creating") {
    return <FileArchive className="mt-0.5 size-5 shrink-0 text-blue-600" />
  }
  return (
    <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-blue-600" />
  )
}

function jobStatusLabel(job: GlobalUploadJob): string {
  switch (job.status) {
    case "creating":
      return "Đang khởi tạo"
    case "uploading":
      return job.kind === "folder"
        ? "Đang ghi nhận tài liệu"
        : `Đang tải lên · ${Math.round(job.percent)}%`
    case "attention_required":
      return "Cần xử lý"
    case "sealing":
      return "Đang chốt danh sách file"
    case "syncing":
      return "Đang đồng bộ tài liệu"
    case "completing":
      return "Đang xác nhận và giải nén ZIP"
    case "completed":
      return "Hoàn tất"
    case "cancelling":
      return "Đang hủy"
    case "cancelled":
      return "Đã hủy"
    case "failed":
      return "Upload thất bại"
  }
}

function canRetry(job: GlobalUploadJob): boolean {
  if (job.status !== "attention_required") return false
  return true
}

function canCancel(job: GlobalUploadJob): boolean {
  return ["creating", "uploading", "attention_required"].includes(job.status)
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const index = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024))
  )
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Không thể cập nhật trạng thái upload."
}
