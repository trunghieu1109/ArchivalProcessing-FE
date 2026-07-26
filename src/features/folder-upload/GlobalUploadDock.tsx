import {
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleX,
  CloudUpload,
  FileArchive,
  FolderOpen,
  Loader2,
  RotateCcw,
  Square,
  X,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { getSession } from "@/features/upload/api/sessionApi"
import { UploadConfirmDialog } from "@/features/upload/components/UploadConfirmDialog"
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
  const hasInterruptibleUpload =
    folderJobs.some(isInterruptibleFolderJob) ||
    zipJobs.some(isInterruptibleZipJob)
  useEffect(() => {
    if (!hasInterruptibleUpload) return
    // Trình duyệt không cho ứng dụng thay nội dung cảnh báo đóng tab bằng
    // modal tùy biến; beforeunload là lớp cảnh báo duy nhất cho thao tác này.
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warnBeforeLeaving)
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving)
  }, [hasInterruptibleUpload])
  const visibleFolderJobs = useMemo(
    () =>
      folderJobs
        .filter((job) => !job.dockHidden)
        .sort((left, right) => right.startedAt - left.startedAt),
    [folderJobs]
  )
  const visibleZipJobs = useMemo(
    () =>
      zipJobs
        .filter((job) => !job.dockHidden)
        .sort((left, right) => right.startedAt - left.startedAt),
    [zipJobs]
  )
  const trackedSessionIdsKey = useMemo(
    () =>
      [
        ...new Set(
          [...visibleFolderJobs, ...visibleZipJobs].map((job) => job.sessionId)
        ),
      ]
        .sort()
        .join("\u0000"),
    [visibleFolderJobs, visibleZipJobs]
  )
  const [sessionFondsNames, setSessionFondsNames] = useState<
    Record<string, string | null>
  >({})
  useEffect(() => {
    const sessionIds = trackedSessionIdsKey
      ? trackedSessionIdsKey.split("\u0000")
      : []
    if (sessionIds.length === 0) return
    let cancelled = false
    void Promise.all(
      sessionIds.map(async (sessionId) => {
        try {
          const session = await getSession(sessionId)
          return [sessionId, session.fonds_name?.trim() || null] as const
        } catch {
          return [sessionId, null] as const
        }
      })
    ).then((entries) => {
      if (cancelled) return
      setSessionFondsNames((current) => ({
        ...current,
        ...Object.fromEntries(entries),
      }))
    })
    return () => {
      cancelled = true
    }
  }, [trackedSessionIdsKey])
  const hasOutstandingUpload =
    folderJobs.some((job) => !isTerminalFolderJob(job)) ||
    zipJobs.some((job) => !isTerminalZipJob(job))
  const visibleJobIdentity = [
    ...visibleFolderJobs.map((job) => `folder:${job.id}`),
    ...visibleZipJobs.map((job) => `zip:${job.id}`),
  ]
    .sort()
    .join("|")
  const [closedDockIdentity, setClosedDockIdentity] = useState<string | null>(
    null
  )
  if (!visibleFolderJobs.length && !visibleZipJobs.length) return null
  if (!hasOutstandingUpload && closedDockIdentity === visibleJobIdentity) {
    return null
  }
  return (
    <UploadDockContent
      visibleFolderJobs={visibleFolderJobs}
      visibleZipJobs={visibleZipJobs}
      sessionFondsNames={sessionFondsNames}
      hasOutstandingUpload={hasOutstandingUpload}
      onClose={() => setClosedDockIdentity(visibleJobIdentity)}
    />
  )
}

function UploadDockContent({
  visibleFolderJobs,
  visibleZipJobs,
  sessionFondsNames,
  hasOutstandingUpload,
  onClose,
}: {
  visibleFolderJobs: FolderUploadJob[]
  visibleZipJobs: ZipUploadJob[]
  sessionFondsNames: Record<string, string | null>
  hasOutstandingUpload: boolean
  onClose: () => void
}) {
  const navigate = useNavigate()
  const folderManager = useFolderUploadManager()
  const zipManager = useZipUploadManager()
  const [expanded, setExpanded] = useState(false)
  const [pendingCancel, setPendingCancel] = useState<
    | { kind: "zip"; job: ZipUploadJob }
    | { kind: "folder"; job: FolderUploadJob }
    | null
  >(null)
  const visibleCount = visibleFolderJobs.length + visibleZipJobs.length
  const needsAttention =
    visibleFolderJobs.some((job) => job.status === "attention_required") ||
    visibleZipJobs.some((job) => job.status === "attention_required")
  const displayExpanded = expanded || needsAttention
  const dockTitle = needsAttention
    ? "Upload cần xử lý"
    : hasOutstandingUpload
      ? "Đang upload"
      : "Upload đã hoàn tất"

  const confirmCancel = async () => {
    if (!pendingCancel) return
    if (pendingCancel.kind === "zip") {
      const cancelled = await zipManager.cancel(pendingCancel.job.id)
      if (cancelled?.status === "cancelled") {
        toast.info(
          `Đã hủy upload. File ${cancelled.fileName} chưa hoàn thành và không được đưa vào xử lý.`
        )
      }
    } else {
      const summary = await folderManager.cancel(pendingCancel.job.id)
      if (summary?.status === "cancelled") {
        toast.info(
          `Đã hủy upload folder. Tạm tính: ${summary.counts.confirmed} thành công, ${summary.counts.skipped} bỏ qua, ${summary.counts.unfinished} chưa hoàn thành.`
        )
      }
    }
    setPendingCancel(null)
  }

  return (
    <>
      <aside
        className={cn(
          "fixed right-4 bottom-4 z-[90] overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-[0_20px_60px_-18px_rgba(15,23,42,0.45)] transition-[width] duration-200",
          displayExpanded
            ? "w-[min(27rem,calc(100vw-2rem))]"
            : "w-[min(18rem,calc(100vw-2rem))]"
        )}
        aria-label="Tiến trình upload"
      >
        <div className="flex items-stretch bg-slate-950 text-white">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={displayExpanded}
            className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-900"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="relative flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                <CloudUpload className="size-4" />
                {!needsAttention && (
                  <span
                    className={cn(
                      "absolute -right-0.5 -bottom-0.5 size-2 rounded-full ring-2 ring-slate-950",
                      hasOutstandingUpload ? "bg-blue-400" : "bg-emerald-400"
                    )}
                  />
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">
                  {dockTitle}
                </span>
                <span className="block text-[11px] text-slate-300">
                  {visibleCount} tác vụ đang được theo dõi
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
              onClick={onClose}
              className="flex w-11 shrink-0 items-center justify-center border-l border-white/10 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              aria-label="Đóng Upload Dock"
              title="Đóng Upload Dock"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        {displayExpanded && (
          <div className="max-h-[min(66vh,35rem)] space-y-3 overflow-y-auto bg-slate-50/80 p-3">
            {visibleZipJobs.map((job) => (
              <ZipUploadJobCard
                key={job.id}
                job={job}
                fondsName={sessionFondsNames[job.sessionId]}
                onOpen={() =>
                  navigate(
                    `/sessions/${encodeURIComponent(job.sessionId)}/step/1?upload=zip&zipUpload=${encodeURIComponent(job.id)}&focus=${Date.now()}`
                  )
                }
                onRetry={() => void zipManager.retry(job.id)}
                onCancel={() => setPendingCancel({ kind: "zip", job })}
                onDismiss={() => zipManager.dismiss(job.id)}
              />
            ))}
            {visibleFolderJobs.map((job) => (
              <FolderUploadJobCard
                key={job.id}
                job={job}
                fondsName={sessionFondsNames[job.sessionId]}
                onOpen={() =>
                  navigate(
                    `/sessions/${encodeURIComponent(job.sessionId)}/step/1?upload=folder&folderUpload=${encodeURIComponent(job.id)}&focus=${Date.now()}`
                  )
                }
                onRetry={() => void folderManager.retry(job.id)}
                onCancel={() => setPendingCancel({ kind: "folder", job })}
                onDismiss={() => folderManager.dismiss(job.id)}
              />
            ))}
          </div>
        )}
      </aside>
      <UploadConfirmDialog
        open={pendingCancel !== null}
        onOpenChange={(open) => {
          if (!open) setPendingCancel(null)
        }}
        title={
          pendingCancel?.kind === "folder"
            ? "Hủy upload folder?"
            : "Hủy upload ZIP?"
        }
        description={
          pendingCancel?.kind === "folder" ? (
            <>
              File đã xác nhận và file được bỏ qua vẫn được giữ. PUT đang chạy,
              file chưa register và file chưa xác nhận sẽ bị hủy; hệ thống tiếp
              tục đối soát phần thành công trong nền.
            </>
          ) : (
            <>
              File <strong>{pendingCancel?.job.fileName}</strong> chưa hoàn
              thành sẽ không được đưa vào extract-job hoặc pipeline xử lý.
            </>
          )
        }
        confirmLabel="Hủy upload"
        busyLabel="Đang hủy..."
        danger
        onConfirm={confirmCancel}
      />
    </>
  )
}

function FolderUploadJobCard({
  job,
  fondsName,
  onOpen,
  onRetry,
  onCancel,
  onDismiss,
}: {
  job: FolderUploadJob
  fondsName: string | null | undefined
  onOpen: () => void
  onRetry: () => void
  onCancel: () => void | Promise<void>
  onDismiss: () => void
}) {
  const counts = countFileStates(job)
  const percent = folderJobPercent(job)
  const terminal = isTerminalFolderJob(job)
  const displayStatus = folderDockStatus(job)
  const failedFiles = job.files
    .filter((file) => file.status === "failed")
    .slice(0, 3)

  return (
    <article
      className={cn(
        "rounded-xl border bg-white p-3 shadow-sm",
        displayStatus === "attention_required"
          ? "border-amber-300"
          : displayStatus === "completed"
            ? "border-emerald-200"
            : "border-slate-200"
      )}
    >
      <div className="flex items-start gap-2.5">
        <DockJobIcon status={displayStatus} kind="folder" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-950">
                {job.rootName}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Folder PDF · {job.mode === "overwrite" ? "Ghi đè" : "Bổ sung"}
              </p>
              <SessionJobIdentity
                sessionId={job.sessionId}
                fondsName={fondsName}
              />
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <PercentBadge
                percent={percent}
                attention={displayStatus === "attention_required"}
              />
              {terminal && <DockDismissButton onClick={onDismiss} />}
            </div>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-300",
                displayStatus === "attention_required"
                  ? "bg-amber-500"
                  : "bg-blue-600"
              )}
              style={{ width: `${percent}%` }}
            />
          </div>

          <div className="mt-2 flex items-start justify-between gap-3 text-[11px]">
            <span
              className={cn(
                "font-semibold",
                job.status === "attention_required"
                  ? "text-amber-800"
                  : "text-slate-700"
              )}
            >
              {jobStatusLabel(job)}
            </span>
            <span className="shrink-0 text-slate-500">
              {counts.confirmed} xong
              {counts.skipped ? ` · ${counts.skipped} bỏ qua` : ""}
            </span>
          </div>

          {job.error && <DockError message={job.error} />}
          {failedFiles.length > 0 && (
            <ul className="mt-2 space-y-1 text-[11px] text-slate-500">
              {failedFiles.map((file) => (
                <li key={file.clientFileId} className="truncate">
                  {file.relativePath}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <DockActionButton icon={<FolderOpen />} onClick={onOpen}>
              Mở session
            </DockActionButton>
            {job.status === "attention_required" && (
              <DockActionButton icon={<RotateCcw />} onClick={onRetry}>
                Thử lại
              </DockActionButton>
            )}
            {isInterruptibleFolderJob(job) && (
              <DockActionButton icon={<Square />} onClick={onCancel} danger>
                Hủy
              </DockActionButton>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

function ZipUploadJobCard({
  job,
  fondsName,
  onOpen,
  onRetry,
  onCancel,
  onDismiss,
}: {
  job: ZipUploadJob
  fondsName: string | null | undefined
  onOpen: () => void
  onRetry: () => void
  onCancel: () => void | Promise<void>
  onDismiss: () => void
}) {
  const percent = Math.max(
    0,
    Math.min(100, Math.round(job.progress?.percent ?? 0))
  )
  const terminal = isTerminalZipJob(job)
  return (
    <article
      className={cn(
        "rounded-xl border bg-white p-3 shadow-sm",
        job.status === "attention_required"
          ? "border-amber-300"
          : job.status === "completed"
            ? "border-emerald-200"
            : "border-slate-200"
      )}
    >
      <div className="flex items-start gap-2.5">
        <DockJobIcon status={job.status} kind="zip" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-950">
                {job.fileName}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                File ZIP · {job.mode === "overwrite" ? "Ghi đè" : "Bổ sung"}
              </p>
              <SessionJobIdentity
                sessionId={job.sessionId}
                fondsName={fondsName}
              />
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <PercentBadge
                percent={job.status === "completing" ? 100 : percent}
                attention={job.status === "attention_required"}
              />
              {terminal && <DockDismissButton onClick={onDismiss} />}
            </div>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-300",
                job.status === "attention_required"
                  ? "bg-amber-500"
                  : "bg-blue-600"
              )}
              style={{
                width: `${job.status === "completing" ? 100 : percent}%`,
              }}
            />
          </div>

          <div className="mt-2 flex items-start justify-between gap-3 text-[11px]">
            <span
              className={cn(
                "font-semibold",
                job.status === "attention_required"
                  ? "text-amber-800"
                  : "text-slate-700"
              )}
            >
              {zipJobStatusLabel(job)}
            </span>
            <span className="shrink-0 text-slate-500">
              {job.progress?.loadedMb.toFixed(1) ?? "0.0"} /{" "}
              {(job.fileSize / (1024 * 1024)).toFixed(1)} MB
            </span>
          </div>

          {job.error && <DockError message={job.error} />}

          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <DockActionButton icon={<FolderOpen />} onClick={onOpen}>
              Mở session
            </DockActionButton>
            {job.status === "attention_required" && (
              <DockActionButton icon={<RotateCcw />} onClick={onRetry}>
                Thử lại
              </DockActionButton>
            )}
            {isInterruptibleZipJob(job) && (
              <DockActionButton icon={<Square />} onClick={onCancel} danger>
                Hủy
              </DockActionButton>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

function SessionJobIdentity({
  sessionId,
  fondsName,
}: {
  sessionId: string
  fondsName: string | null | undefined
}) {
  const displayFondsName =
    fondsName === undefined
      ? "Đang tải tên phông..."
      : fondsName || "Chưa đặt tên phông"
  return (
    <div className="mt-1 space-y-0.5 text-[11px] leading-4 text-slate-500">
      <p className="truncate" title={displayFondsName}>
        Phông:{" "}
        <span className="font-semibold text-slate-700">{displayFondsName}</span>
      </p>
      <p className="truncate font-mono text-[10px]" title={sessionId}>
        Session: {sessionId}
      </p>
    </div>
  )
}

function DockDismissButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex size-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
      aria-label="Bỏ tác vụ khỏi Upload Dock"
      title="Bỏ tác vụ khỏi Upload Dock"
    >
      <X className="size-3.5" />
    </button>
  )
}

function DockJobIcon({
  status,
  kind,
}: {
  status: string
  kind: "folder" | "zip"
}) {
  if (status === "attention_required") {
    return <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
  }
  if (status === "completed") {
    return <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
  }
  if (status === "cancelled") {
    return <CircleX className="mt-0.5 size-5 shrink-0 text-slate-500" />
  }
  if (status === "preparing") {
    return kind === "zip" ? (
      <FileArchive className="mt-0.5 size-5 shrink-0 text-blue-600" />
    ) : (
      <FolderOpen className="mt-0.5 size-5 shrink-0 text-blue-600" />
    )
  }
  return (
    <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-blue-600" />
  )
}

function PercentBadge({
  percent,
  attention,
}: {
  percent: number
  attention: boolean
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
        attention ? "bg-amber-100 text-amber-800" : "bg-blue-50 text-blue-700"
      )}
    >
      {percent}%
    </span>
  )
}

function DockError({ message }: { message: string }) {
  return (
    <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-xs leading-5 text-amber-800">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <span className="line-clamp-3">{message}</span>
    </div>
  )
}

function DockActionButton({
  children,
  icon,
  onClick,
  danger = false,
}: {
  children: ReactNode
  icon: ReactElement<{ className?: string }>
  onClick: () => void | Promise<void>
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition",
        danger
          ? "border-transparent text-red-600 hover:bg-red-50 hover:text-red-700"
          : "border-blue-200 bg-white text-blue-700 hover:bg-blue-50 hover:text-blue-800",
        "[&_svg]:size-3.5 [&_svg]:shrink-0"
      )}
    >
      {icon}
      {children}
    </button>
  )
}

function zipJobStatusLabel(job: ZipUploadJob): string {
  switch (job.status) {
    case "preparing":
      return "Đang chuẩn bị upload"
    case "uploading":
      return `Đang upload · ${Math.round(job.progress?.percent ?? 0)}%`
    case "completing":
      return "Đang extract file ZIP..."
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
  if (job.files.length === 0 && job.summary) {
    return {
      confirmed: job.summary.counts.confirmed,
      skipped: job.summary.counts.skipped,
    }
  }
  let confirmed = 0
  let skipped = 0
  for (const file of job.files) {
    if (file.status === "confirmed") confirmed += 1
    if (file.status === "skipped") skipped += 1
  }
  return { confirmed, skipped }
}

function folderJobPercent(job: FolderUploadJob): number {
  if (
    job.summary?.status !== "cancelled" &&
    ["sealing", "reconciling", "completed"].includes(job.status)
  ) {
    return 100
  }
  const counts = countFileStates(job)
  const totalFiles = job.files.length || job.summary?.expected_file_count || 0
  return totalFiles > 0
    ? Math.min(
        100,
        Math.round(((counts.confirmed + counts.skipped) / totalFiles) * 100)
      )
    : 0
}

function jobStatusLabel(job: FolderUploadJob): string {
  if (job.summary?.status === "cancelled") {
    return "Đã hủy; file thành công được giữ lại"
  }
  switch (job.status) {
    case "preparing":
      return "Đang khởi tạo"
    case "uploading":
      return `Đang tải lên · ${folderJobPercent(job)}%`
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

function isInterruptibleFolderJob(job: FolderUploadJob): boolean {
  return (
    ![
      "completed",
      "cancelled",
      "sealing",
      "reconciling",
      "cancelling",
    ].includes(job.status) &&
    !["sealed", "cancelled"].includes(job.summary?.status ?? "")
  )
}

function isInterruptibleZipJob(job: ZipUploadJob): boolean {
  return !["completed", "cancelled", "completing", "cancelling"].includes(
    job.status
  )
}

function isTerminalFolderJob(job: FolderUploadJob): boolean {
  return (
    ["completed", "cancelled"].includes(job.status) ||
    job.summary?.status === "cancelled"
  )
}

function isTerminalZipJob(job: ZipUploadJob): boolean {
  return ["completed", "cancelled"].includes(job.status)
}

function folderDockStatus(job: FolderUploadJob): string {
  return job.summary?.status === "cancelled" ? "cancelled" : job.status
}
