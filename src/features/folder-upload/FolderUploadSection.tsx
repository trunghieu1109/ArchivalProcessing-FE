import { useMemo, useRef, useState } from "react"
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  File,
  FolderOpen,
  Loader2,
  UploadCloud,
} from "lucide-react"
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { UploadMode } from "@/features/upload/api/sessionApi"
import { cn } from "@/shared/lib/utils"
import type { FolderUploadFileState } from "./types"
import { useFolderUploadJobs, useFolderUploadManager } from "./useFolderUpload"

const FOLDER_UPLOAD_FILE_PAGE_SIZE = 10

const folderFileColumns: ColumnDef<FolderUploadFileState>[] = [
  {
    id: "icon",
    cell: () => <File className="size-3.5 text-[#94A3B8]" />,
    enableSorting: false,
    size: 36,
  },
  {
    accessorKey: "relativePath",
    header: ({ column }) => (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-2 h-7 gap-1 px-2 text-[11px] font-semibold tracking-wide text-[#64748B] uppercase"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Đường dẫn <ArrowUpDown className="size-3" />
      </Button>
    ),
    cell: ({ row }) => (
      <span
        className="block max-w-[36rem] truncate text-xs text-[#475569]"
        title={row.original.relativePath}
      >
        {row.original.relativePath}
      </span>
    ),
  },
  {
    accessorKey: "sizeBytes",
    header: ({ column }) => (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="ml-auto flex h-7 gap-1 px-2 text-[11px] font-semibold tracking-wide text-[#64748B] uppercase"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Kích thước <ArrowUpDown className="size-3" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="block text-right text-[11px] text-[#64748B]">
        {formatBytes(row.original.sizeBytes)}
      </span>
    ),
    size: 110,
  },
  {
    id: "status",
    header: () => (
      <span className="text-[11px] font-semibold tracking-wide text-[#64748B] uppercase">
        Tiến trình
      </span>
    ),
    cell: ({ row }) => <FolderFileStatus file={row.original} />,
    enableSorting: false,
    size: 170,
  },
]

export function FolderUploadSection({
  sessionId,
  ensureSession,
  uploadMode,
  disabled = false,
  embedded = false,
  showPicker = true,
  showInterruptionNotice = true,
}: {
  sessionId: string | null
  ensureSession: () => Promise<string>
  uploadMode: UploadMode
  disabled?: boolean
  embedded?: boolean
  showPicker?: boolean
  showInterruptionNotice?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const manager = useFolderUploadManager()
  const jobs = useFolderUploadJobs()
  const [starting, setStarting] = useState(false)
  const [ignoredFileCount, setIgnoredFileCount] = useState(0)
  const [sorting, setSorting] = useState<SortingState>([])
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
  const reviewedFileCount = confirmedCount + skippedCount
  const failedCount = currentJob
    ? currentJob.files.length > 0
      ? currentJob.files.filter((file) => file.status === "failed").length
      : (currentJob.summary?.counts.failed ?? 0)
    : 0
  const waitingCount = Math.max(
    0,
    displayedFileCount - reviewedFileCount - failedCount
  )
  const uploadPercent = currentJob
    ? ["sealing", "reconciling", "completed"].includes(currentJob.status)
      ? 100
      : Math.min(
          100,
          Math.round(
            (reviewedFileCount / Math.max(1, displayedFileCount)) * 100
          )
        )
    : 0
  // TanStack Table exposes imperative getters by design; the component itself
  // remains driven by the manager snapshot and explicit table state.
  // eslint-disable-next-line react-hooks/incompatible-library
  const fileTable = useReactTable({
    data: currentJob?.files ?? [],
    columns: folderFileColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
    initialState: {
      pagination: { pageSize: FOLDER_UPLOAD_FILE_PAGE_SIZE },
    },
    autoResetPageIndex: false,
  })

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
    <section
      className={cn(
        embedded
          ? ""
          : "rounded-2xl border border-[#D8E1EC] bg-white p-5 shadow-sm"
      )}
    >
      {!embedded && (
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
          {showPicker && (
            <button
              type="button"
              disabled={
                disabled ||
                starting ||
                hasActiveJob ||
                interruptedUploadStillOpen
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
          )}
        </div>
      )}
      {showPicker && (
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
      )}

      {showPicker && (
        <div className="mt-4 rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] px-4 py-3 text-xs leading-5 text-[#1E3A8A]">
          Mỗi lượt register tối đa 200 file. Toàn ứng dụng dùng tối đa 8 kết nối
          PUT đồng thời; presigned URL được cấp lại khi retry.
          {ignoredFileCount > 0 && (
            <span className="mt-1 block font-semibold">
              Đã bỏ qua {ignoredFileCount.toLocaleString("vi-VN")} file không
              phải PDF hoặc file rỗng.
            </span>
          )}
        </div>
      )}

      {showInterruptionNotice && interruptedSummary && (
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
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[#334155]">
              {currentJob.rootName} ·{" "}
              {displayedFileCount.toLocaleString("vi-VN")} file
            </p>
            <p className="text-xs text-[#64748B]">
              {confirmedCount} thành công · {skippedCount} bỏ qua
            </p>
          </div>
          <div className="mt-3 rounded-xl border border-primary/15 bg-primary/[0.03] p-3">
            <div className="flex items-center justify-between gap-3 text-xs font-semibold text-[#0F172A]">
              <span className="truncate">
                {folderUploadStatusLabel(currentJob.status)}
              </span>
              <span className="shrink-0 font-roboto text-[11px] text-[#0052FF]">
                {uploadPercent}%
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#D8E1EC]">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-200",
                  currentJob.status === "attention_required"
                    ? "bg-destructive"
                    : "bg-[#0052FF]"
                )}
                style={{ width: `${uploadPercent}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 font-roboto text-[11px] text-[#64748B]">
              <span>
                {reviewedFileCount.toLocaleString("vi-VN")} /{" "}
                {displayedFileCount.toLocaleString("vi-VN")} file đã duyệt
              </span>
              <span>Tính theo file đã xác nhận hoặc bỏ qua</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <ProgressCount label="Đã duyệt" value={confirmedCount} />
              <ProgressCount label="Đã có / bỏ qua" value={skippedCount} />
              <ProgressCount label="Đang chờ" value={waitingCount} />
              <ProgressCount
                label="Lỗi"
                value={failedCount}
                tone={failedCount > 0 ? "error" : "default"}
              />
            </div>
          </div>
          {currentJob.files.length > 0 ? (
            <div className="mt-3 overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
              <Table>
                <TableHeader className="bg-[#F8FAFC]">
                  {fileTable.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead
                          key={header.id}
                          style={{ width: header.getSize() }}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {fileTable.getRowModel().rows.map((row) => (
                    <TableRow key={row.original.clientFileId}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
                <span className="text-[11px] text-[#64748B]">
                  Trang {fileTable.getState().pagination.pageIndex + 1} /{" "}
                  {Math.max(1, fileTable.getPageCount())} · Tối đa{" "}
                  {FOLDER_UPLOAD_FILE_PAGE_SIZE} file mỗi trang
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 px-2"
                    onClick={() => fileTable.previousPage()}
                    disabled={!fileTable.getCanPreviousPage()}
                  >
                    <ChevronLeft className="size-3.5" />
                    Trang trước
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 px-2"
                    onClick={() => fileTable.nextPage()}
                    disabled={!fileTable.getCanNextPage()}
                  >
                    Trang sau
                    <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-2 rounded-xl border border-[#DCFCE7] bg-[#F0FDF4] px-3 py-2 text-xs font-medium text-[#166534]">
              Upload đã hoàn tất; danh sách file chi tiết đã được giải phóng
              khỏi bộ nhớ của tab.
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function folderUploadStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    preparing: "Đang khởi tạo upload folder",
    uploading: "Đang upload các file PDF",
    sealing: "Đang chốt danh sách file",
    reconciling: "Đang đồng bộ tài liệu",
    completed: "Upload folder hoàn tất",
    attention_required: "Upload folder cần xử lý",
    cancelling: "Đang hủy upload folder",
    cancelled: "Upload folder đã hủy",
  }
  return labels[status] ?? status
}

function fileStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    queued: "Chờ",
    registering: "Đăng ký",
    registered: "Đã đăng ký",
    presigned: "Đã cấp URL",
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

function FolderFileStatus({ file }: { file: FolderUploadFileState }) {
  const percent =
    file.sizeBytes > 0
      ? Math.min(100, Math.round((file.uploadedBytes / file.sizeBytes) * 100))
      : 0
  const isUploading = file.status === "uploading"
  return (
    <div className="min-w-32">
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "text-[11px] font-semibold",
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
        {isUploading && (
          <span className="text-[10px] font-semibold text-[#0052FF]">
            {percent}%
          </span>
        )}
      </div>
      {isUploading && (
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-[#DBEAFE]">
          <div
            className="h-full rounded-full bg-[#0052FF]"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  )
}

function ProgressCount({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: number
  tone?: "default" | "error"
}) {
  return (
    <div className="rounded-lg border border-white/80 bg-white/80 px-3 py-2">
      <p className="text-[10px] font-semibold tracking-wide text-[#64748B] uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-sm font-bold",
          tone === "error" ? "text-[#B91C1C]" : "text-[#0F172A]"
        )}
      >
        {value.toLocaleString("vi-VN")}
      </p>
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

function folderCancelReasonLabel(reason: string): string {
  if (reason === "lease_expired" || reason === "page_closed") {
    return "Upload bị gián đoạn do tab đã đóng hoặc tải lại."
  }
  if (reason === "logout") return "Upload bị gián đoạn do người dùng đăng xuất."
  if (reason === "user_cancelled") return "Upload đã được người dùng hủy."
  return `Lý do: ${reason}`
}
