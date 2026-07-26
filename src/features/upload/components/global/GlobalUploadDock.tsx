import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
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
import { getSession } from "@/features/upload/api/sessionApi"
import {
  folderUploadManager,
  isTerminalFolderUploadJob,
  type FolderUploadJob,
} from "@/features/upload/lib/folderUploadManager"
import {
  isTerminalZipUploadJob,
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
        .filter((job) => !job.dockHidden)
        .sort((left, right) => right.createdAt - left.createdAt),
    [folderJobs, zipJobs]
  )
  const hasOutstandingUpload =
    folderJobs.some((job) => !isTerminalFolderUploadJob(job)) ||
    zipJobs.some((job) => !isTerminalZipUploadJob(job))
  const needsAttention = jobs.some((job) =>
    ["attention_required", "failed"].includes(job.status)
  )
  const [expanded, setExpanded] = useState(false)
  const [closedJobIdentity, setClosedJobIdentity] = useState<string | null>(
    null
  )
  const [cancelTarget, setCancelTarget] = useState<GlobalUploadJob | null>(null)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [fondsNames, setFondsNames] = useState<Record<string, string | null>>(
    {}
  )
  const requestedSessionIds = useRef(new Set<string>())
  const visibleJobIdentity = useMemo(
    () =>
      jobs
        .map((job) => `${job.kind}:${job.id}`)
        .sort()
        .join("|"),
    [jobs]
  )
  const visibleSessionIds = useMemo(
    () => [...new Set(jobs.map((job) => job.sessionId))].sort(),
    [jobs]
  )
  const displayExpanded = expanded || needsAttention

  useEffect(() => {
    for (const sessionId of visibleSessionIds) {
      if (
        requestedSessionIds.current.has(sessionId) ||
        Object.prototype.hasOwnProperty.call(fondsNames, sessionId)
      ) {
        continue
      }
      requestedSessionIds.current.add(sessionId)
      void getSession(sessionId)
        .then((session) => {
          const fondsName = session.fonds_name?.trim() || null
          setFondsNames((current) => ({
            ...current,
            [sessionId]: fondsName,
          }))
        })
        .catch(() => {
          setFondsNames((current) => ({
            ...current,
            [sessionId]: null,
          }))
        })
    }
  }, [fondsNames, visibleSessionIds])

  if (
    jobs.length === 0 ||
    (closedJobIdentity !== null && closedJobIdentity === visibleJobIdentity)
  ) {
    return null
  }

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

  const dismiss = (job: GlobalUploadJob) => {
    if (job.kind === "folder") {
      folderUploadManager.dismiss(job.id)
    } else {
      zipUploadManager.dismiss(job.id)
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
        <div className="flex items-stretch bg-slate-950 text-white">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-900"
            aria-expanded={displayExpanded}
            onClick={() => setExpanded((value) => !value)}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="relative flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                <CloudUpload className="size-4" />
                {hasOutstandingUpload && !needsAttention && (
                  <span className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full bg-blue-400 ring-2 ring-slate-950" />
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">
                  {needsAttention
                    ? "Upload cần xử lý"
                    : hasOutstandingUpload
                      ? "Đang upload"
                      : "Lịch sử upload"}
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
          {!hasOutstandingUpload && (
            <button
              type="button"
              className="flex w-11 shrink-0 items-center justify-center border-l border-white/10 text-slate-300 transition-colors hover:bg-slate-900 hover:text-white"
              aria-label="Đóng lịch sử upload"
              title="Đóng lịch sử upload"
              onClick={() => setClosedJobIdentity(visibleJobIdentity)}
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {displayExpanded && (
          <div className="max-h-[min(66vh,35rem)] space-y-3 overflow-y-auto bg-slate-50/80 p-3">
            {jobs.map((job) => (
              <UploadJobCard
                key={job.id}
                job={job}
                onOpen={() => navigate(uploadJobPath(job))}
                onRetry={() => void retry(job)}
                onCancel={() => setCancelTarget(job)}
                onDismiss={() => dismiss(job)}
                fondsName={fondsNames[job.sessionId]}
                fondsNameLoaded={Object.prototype.hasOwnProperty.call(
                  fondsNames,
                  job.sessionId
                )}
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
  onDismiss,
  fondsName,
  fondsNameLoaded,
}: {
  job: GlobalUploadJob
  onOpen: () => void
  onRetry: () => void
  onCancel: () => void
  onDismiss: () => void
  fondsName: string | null | undefined
  fondsNameLoaded: boolean
}) {
  const cancelled = isCancelledPresentation(job)
  const completed = job.status === "completed"
  const terminal = isTerminalUploadJob(job)
  const attention =
    !cancelled && ["attention_required", "failed"].includes(job.status)
  const progress = Math.max(0, Math.min(100, Math.round(job.percent)))
  const folderCounts =
    job.kind === "folder"
      ? job.records.length > 0
        ? {
            confirmed: job.confirmedFileCount,
            skipped: job.skippedFileCount,
          }
        : {
            confirmed: job.summary?.counts.confirmed ?? job.confirmedFileCount,
            skipped: job.summary?.counts.skipped ?? job.skippedFileCount,
          }
      : null
  const fondsLabel = fondsNameLoaded
    ? (fondsName ?? "Chưa đặt tên phông")
    : "Đang tải tên phông..."

  return (
    <article
      className={cn(
        "rounded-xl border bg-white p-3 shadow-sm",
        attention
          ? "border-amber-300"
          : completed
            ? "border-emerald-200"
            : "border-slate-200"
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
              <p
                className="mt-0.5 truncate text-[11px] font-medium text-slate-600"
                title={fondsLabel}
              >
                Phông: {fondsLabel}
              </p>
              <p
                className="mt-0.5 truncate text-[11px] text-slate-500"
                title={`Session ${job.sessionId}`}
              >
                {job.kind === "folder" ? "Folder PDF" : "File ZIP"} ·{" "}
                {job.mode === "overwrite" ? "Ghi đè" : "Bổ sung"} · Session{" "}
                {job.sessionId}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-bold",
                  attention
                    ? "bg-amber-100 text-amber-800"
                    : completed
                      ? "bg-emerald-100 text-emerald-800"
                      : cancelled
                        ? "bg-slate-200 text-slate-700"
                        : "bg-blue-50 text-blue-700"
                )}
              >
                {progress}%
              </span>
              {terminal && (
                <button
                  type="button"
                  className="flex size-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label={`Bỏ ${job.kind === "folder" ? job.rootName : job.fileName} khỏi lịch sử upload`}
                  title="Bỏ khỏi Upload Dock"
                  onClick={onDismiss}
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-300",
                attention
                  ? "bg-amber-500"
                  : completed
                    ? "bg-emerald-600"
                    : cancelled
                      ? "bg-slate-500"
                      : "bg-blue-600"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-2 flex items-start justify-between gap-3 text-[11px]">
            <span
              className={cn(
                "font-semibold",
                attention
                  ? "text-amber-800"
                  : completed
                    ? "text-emerald-700"
                    : "text-slate-700"
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

          {folderCounts && (
            <p className="mt-1.5 text-[11px] text-slate-500">
              Đã xác nhận {folderCounts.confirmed} · Bỏ qua{" "}
              {folderCounts.skipped}
            </p>
          )}

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
              <FolderOpen className="size-3.5" /> Mở session
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
  const SourceIcon = job.kind === "folder" ? Folder : FileArchive
  const completed = job.status === "completed"
  const cancelled = isCancelledPresentation(job)
  const attention =
    !cancelled && ["attention_required", "failed"].includes(job.status)
  return (
    <span
      className={cn(
        "relative mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
        completed
          ? "bg-emerald-50 text-emerald-700"
          : attention
            ? "bg-amber-50 text-amber-700"
            : cancelled
              ? "bg-slate-100 text-slate-600"
              : "bg-blue-50 text-blue-700"
      )}
    >
      <SourceIcon className="size-4" />
      {completed && (
        <CheckCircle2 className="absolute -right-1 -bottom-1 size-3.5 rounded-full bg-white text-emerald-600" />
      )}
      {attention && (
        <AlertTriangle className="absolute -right-1 -bottom-1 size-3.5 rounded-full bg-white text-amber-600" />
      )}
      {cancelled && (
        <X className="absolute -right-1 -bottom-1 size-3.5 rounded-full bg-white text-slate-500" />
      )}
    </span>
  )
}

function jobStatusLabel(job: GlobalUploadJob): string {
  if (isCancelledPresentation(job)) {
    return job.kind === "folder"
      ? "Đã hủy; file thành công được giữ lại"
      : "Đã hủy"
  }
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
  if (job.status !== "attention_required" || isCancelledPresentation(job)) {
    return false
  }
  return true
}

function canCancel(job: GlobalUploadJob): boolean {
  return (
    !isCancelledPresentation(job) &&
    ["creating", "uploading", "attention_required"].includes(job.status)
  )
}

function isTerminalUploadJob(job: GlobalUploadJob): boolean {
  return job.kind === "folder"
    ? isTerminalFolderUploadJob(job)
    : isTerminalZipUploadJob(job)
}

function isCancelledPresentation(job: GlobalUploadJob): boolean {
  return (
    job.status === "cancelled" ||
    (job.kind === "folder" && job.summary?.status === "cancelled")
  )
}

function uploadJobPath(job: GlobalUploadJob): string {
  const params = new URLSearchParams({
    upload: job.kind,
    [job.kind === "folder" ? "folderUpload" : "zipUpload"]: job.id,
    focus: `${job.kind}:${job.id}`,
  })
  return `/sessions/${encodeURIComponent(job.sessionId)}/step/1?${params.toString()}`
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
