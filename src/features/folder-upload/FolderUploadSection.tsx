import { useMemo, useRef, useState } from "react"
import { CircleAlert, FolderOpen, Loader2, UploadCloud } from "lucide-react"
import { toast } from "sonner"
import type { UploadMode } from "@/features/upload/api/sessionApi"
import { cn } from "@/shared/lib/utils"
import { useFolderUploadJobs, useFolderUploadManager } from "./useFolderUpload"

export function FolderUploadSection({
  sessionId,
  ensureSession,
  uploadMode,
  disabled = false,
}: {
  sessionId: string | null
  ensureSession: () => Promise<string>
  uploadMode: UploadMode
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const manager = useFolderUploadManager()
  const jobs = useFolderUploadJobs()
  const [starting, setStarting] = useState(false)
  const [ignoredFileCount, setIgnoredFileCount] = useState(0)
  const currentJob = useMemo(
    () =>
      sessionId
        ? ([...jobs].reverse().find((job) => job.sessionId === sessionId) ??
          null)
        : null,
    [jobs, sessionId]
  )
  const interruptedSummary =
    currentJob?.summary &&
    currentJob.summary.status !== "sealed" &&
    currentJob.summary.status !== "completed" &&
    (currentJob.files.length === 0 || currentJob.status === "cancelled")
      ? currentJob.summary
      : null
  const hasActiveJob = Boolean(
    currentJob &&
    !interruptedSummary &&
    !["completed", "cancelled"].includes(currentJob.status)
  )
  const interruptedUploadStillOpen = Boolean(
    interruptedSummary &&
    ["open", "uploading", "attention_required", "cancelling"].includes(
      interruptedSummary.status
    )
  )
  const displayedFileCount =
    currentJob?.files.length || currentJob?.summary?.expected_file_count || 0
  const confirmedCount = currentJob
    ? currentJob.files.length > 0
      ? currentJob.files.filter((file) => file.status === "confirmed").length
      : (currentJob.summary?.counts.confirmed ?? 0)
    : 0
  const skippedCount = currentJob
    ? currentJob.files.length > 0
      ? currentJob.files.filter((file) => file.status === "skipped").length
      : (currentJob.summary?.counts.skipped ?? 0)
    : 0

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return
    let ignored = 0
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]
      if (!file?.name.toLowerCase().endsWith(".pdf") || file.size <= 0) {
        ignored += 1
      }
    }
    setIgnoredFileCount(ignored)
    setStarting(true)
    try {
      const targetSessionId = sessionId ?? (await ensureSession())
      manager.start({
        sessionId: targetSessionId,
        files,
        mode: uploadMode,
      })
      toast.success(
        "Đã bắt đầu upload folder. Bạn có thể chuyển sang màn hình khác."
      )
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Không thể bắt đầu upload folder."
      )
    } finally {
      setStarting(false)
    }
  }

  return (
    <section className="rounded-2xl border border-[#D8E1EC] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#EAF1FF] text-[#0052FF]">
            <FolderOpen className="size-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#0F172A]">
              Upload trực tiếp một folder PDF
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[#64748B]">
              Trình duyệt giữ file trong bộ nhớ của tab và PUT trực tiếp sang
              Chỉnh Lý. Đóng hoặc tải lại tab sẽ hủy phần chưa hoàn tất; các
              file đã xác nhận vẫn được giữ.
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={
            disabled || starting || hasActiveJob || interruptedUploadStillOpen
          }
          onClick={() => {
            if (!inputRef.current) return
            inputRef.current.value = ""
            inputRef.current.click()
          }}
          className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0052FF] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0047DB] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {starting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <UploadCloud className="size-4" />
          )}
          Chọn folder
        </button>
        <input
          ref={(node) => {
            inputRef.current = node
            node?.setAttribute("webkitdirectory", "")
            node?.setAttribute("directory", "")
          }}
          type="file"
          multiple
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(event) => void handleFiles(event.currentTarget.files)}
        />
      </div>

      <div className="mt-4 rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] px-4 py-3 text-xs leading-5 text-[#1E3A8A]">
        Mỗi lượt register tối đa 200 file. Toàn ứng dụng dùng tối đa 8 kết nối
        PUT đồng thời; presigned URL được cấp lại khi retry.
        {ignoredFileCount > 0 && (
          <span className="mt-1 block font-semibold">
            Đã bỏ qua {ignoredFileCount.toLocaleString("vi-VN")} file không phải
            PDF hoặc file rỗng.
          </span>
        )}
      </div>

      {interruptedSummary && (
        <div className="mt-4 rounded-xl border border-[#FCD34D] bg-[#FFFBEB] px-4 py-3 text-sm text-[#92400E]">
          <div className="flex items-start gap-2">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">
                Lần upload folder gần nhất chưa hoàn thành
              </p>
              <p className="mt-1 leading-5">
                Đã ghi nhận{" "}
                <strong>{interruptedSummary.counts.confirmed}</strong> file
                thành công ·{" "}
                <strong>{interruptedSummary.counts.skipped}</strong> file bỏ qua
                · <strong>{interruptedSummary.counts.failed}</strong> file lỗi
                kỹ thuật ·{" "}
                <strong>{interruptedSummary.counts.unfinished}</strong> file
                chưa hoàn thành.
              </p>
              {interruptedSummary.cancel_reason && (
                <p className="mt-1 text-xs">
                  {folderCancelReasonLabel(interruptedSummary.cancel_reason)}
                </p>
              )}
              {(["pending", "running"].includes(
                interruptedSummary.document_sync_status
              ) ||
                interruptedUploadStillOpen) && (
                <p className="mt-1 flex items-center gap-1.5 font-medium">
                  <Loader2 className="size-3.5 animate-spin" />
                  {interruptedUploadStillOpen
                    ? "Đang chờ hệ thống đóng lần upload bị gián đoạn…"
                    : "Đang đối soát kết quả cuối cùng với Chỉnh Lý…"}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {currentJob && hasActiveJob && (
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[#334155]">
              {currentJob.rootName} ·{" "}
              {displayedFileCount.toLocaleString("vi-VN")} file
            </p>
            <p className="text-xs text-[#64748B]">
              {confirmedCount} thành công · {skippedCount} bỏ qua
            </p>
          </div>
          {currentJob.files.length > 0 ? (
            <div className="mt-2 max-h-52 overflow-auto rounded-xl border border-[#E2E8F0]">
              {currentJob.files.slice(0, 200).map((file) => (
                <div
                  key={file.clientFileId}
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-[#F1F5F9] px-3 py-2 text-xs last:border-b-0"
                >
                  <span className="truncate text-[#475569]">
                    {file.relativePath}
                  </span>
                  <span
                    className={cn(
                      "font-semibold",
                      file.status === "confirmed"
                        ? "text-[#15803D]"
                        : file.status === "failed"
                          ? "text-[#B91C1C]"
                          : file.status === "skipped"
                            ? "text-[#A16207]"
                            : "text-[#64748B]"
                    )}
                  >
                    {fileStatusLabel(file.status)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2 rounded-xl border border-[#DCFCE7] bg-[#F0FDF4] px-3 py-2 text-xs font-medium text-[#166534]">
              Upload đã hoàn tất; danh sách file chi tiết đã được giải phóng
              khỏi bộ nhớ của tab.
            </div>
          )}
          {currentJob.files.length > 200 && (
            <p className="mt-2 text-xs text-[#64748B]">
              Đang hiển thị 200 file đầu tiên; toàn bộ tiến trình vẫn được quản
              lý trong Upload Dock.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

function fileStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    queued: "Chờ",
    registering: "Đăng ký",
    registered: "Đã đăng ký",
    skipped: "Bỏ qua",
    uploading: "Đang tải",
    uploaded: "Đã tải, đang xác nhận",
    confirming: "Xác nhận",
    confirmed: "Thành công",
    failed: "Lỗi",
    cancelled: "Đã hủy",
  }
  return labels[status] ?? status
}

function folderCancelReasonLabel(reason: string): string {
  if (reason === "lease_expired" || reason === "page_closed") {
    return "Upload bị gián đoạn do tab đã đóng hoặc tải lại."
  }
  if (reason === "logout") return "Upload bị gián đoạn do người dùng đăng xuất."
  if (reason === "user_cancelled") return "Upload đã được người dùng hủy."
  return `Lý do: ${reason}`
}
