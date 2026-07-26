import { forwardRef, useState, useImperativeHandle } from "react"
import * as React from "react"
import {
  FileArchive,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Folder,
  File,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Upload,
} from "lucide-react"
import { motion } from "framer-motion"
import {
  type ColumnDef,
  type PaginationState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/shared/lib/utils"
import { FileChip } from "./FileChip"
import {
  folderUploadManager,
  type FolderUploadFileProgress,
  type FolderUploadJob,
  type FolderUploadSource,
} from "@/features/upload/lib/folderUploadManager"
import { zipUploadManager } from "@/features/upload/lib/zipUploadManager"
import type { UploadInterruptionSnapshot } from "@/features/upload/lib/uploadInterruption"
import type {
  SessionInputUploadResponse,
  UploadProgressSnapshot,
} from "@/features/upload/api/sessionApi"
import type { UseOcrFolderResult } from "@/features/upload/hooks/useOcrFolder"
import type {
  ProcessState,
  SectionHandle,
  ArchiveEntry,
} from "@/features/upload/types"

const MAX_FILES_ERROR = "Số lượng tài liệu cần số hóa phải là số nguyên dương."
const FOLDER_UPLOAD_FILE_PAGE_SIZE = 10
const FOLDER_UPLOAD_ENABLED = ["1", "true", "yes", "on"].includes(
  String(import.meta.env.VITE_FOLDER_UPLOAD_ENABLED ?? "false")
    .trim()
    .toLowerCase()
)

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

interface UploadArchiveEntry extends ArchiveEntry {
  clientFileId: string
  uploadRecord?: FolderUploadFileProgress
}

const columns: ColumnDef<UploadArchiveEntry>[] = [
  {
    id: "icon",
    cell: ({ row }) =>
      row.original.isDir ? (
        <Folder className="size-3.5 text-primary" />
      ) : (
        <File className="size-3.5 text-muted-foreground" />
      ),
    enableSorting: false,
    size: 32,
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 h-7 gap-1 px-2 font-roboto text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Tên <ArrowUpDown className="size-3" />
      </Button>
    ),
    cell: ({ row }) => (
      <span
        className={cn(
          "block truncate font-roboto text-[12px]",
          row.original.isDir
            ? "font-semibold text-foreground"
            : "text-muted-foreground"
        )}
      >
        {row.original.name}
      </span>
    ),
  },
  {
    accessorKey: "size",
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-mr-2 ml-auto flex h-7 gap-1 px-2 font-roboto text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Kích thước <ArrowUpDown className="size-3" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="block text-right font-roboto text-[11px] text-muted-foreground/60">
        {row.original.isDir ? "" : formatBytes(row.original.size)}
      </span>
    ),
    size: 100,
  },
  {
    id: "uploadStatus",
    header: () => (
      <span className="font-roboto text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
        Tiến trình
      </span>
    ),
    cell: ({ row }) =>
      row.original.uploadRecord ? (
        <FolderFileStatus record={row.original.uploadRecord} />
      ) : null,
    enableSorting: false,
    size: 170,
  },
]

interface ZipSectionProps {
  sessionId: string | null
  processState: ProcessState
  onProcessStateChange: (s: ProcessState) => void
  onHasFileChange: (v: boolean) => void
  onEntriesChange: (entries: ArchiveEntry[]) => void
  onFolderPathChange: (folderPath: string) => void
  maxFiles: string
  onMaxFilesChange: (value: string) => void
  onUploadFile: (file: File) => Promise<SessionInputUploadResponse>
  uploadProgress: UploadProgressSnapshot | null
  uploadInterruption: UploadInterruptionSnapshot | null
  ocr: UseOcrFolderResult
  onFolderSelection: (sources: FolderUploadSource[], rootName: string) => void
}

export const ZipSection = forwardRef<SectionHandle, ZipSectionProps>(
  (
    {
      sessionId,
      processState,
      onProcessStateChange,
      onHasFileChange,
      onEntriesChange,
      onFolderPathChange,
      maxFiles,
      onMaxFilesChange,
      onUploadFile,
      uploadProgress,
      uploadInterruption,
      onFolderSelection,
    },
    ref
  ) => {
    const [fileName, setFileName] = useState("")
    const [entries, setEntries] = useState<ArchiveEntry[]>([])
    const [folderPath, setFolderPath] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)
    const [sorting, setSorting] = React.useState<SortingState>([])
    const [pagination, setPagination] = React.useState<PaginationState>({
      pageIndex: 0,
      pageSize: FOLDER_UPLOAD_FILE_PAGE_SIZE,
    })
    const [selectionKind, setSelectionKind] = useState<"zip" | "folder" | null>(
      null
    )
    const [ignoredCount, setIgnoredCount] = useState(0)
    const zipInputRef = React.useRef<HTMLInputElement>(null)
    const folderInputRef = React.useRef<HTMLInputElement>(null)

    const folderJobs = React.useSyncExternalStore(
      folderUploadManager.subscribe,
      folderUploadManager.getSnapshot
    )
    const zipJobs = React.useSyncExternalStore(
      zipUploadManager.subscribe,
      zipUploadManager.getSnapshot
    )
    const liveFolderJob = folderJobs
      .filter(
        (job) =>
          job.sessionId === sessionId &&
          job.records.length > 0 &&
          !["completed", "cancelled"].includes(job.status)
      )
      .sort((left, right) => right.createdAt - left.createdAt)[0]
    const liveZipJob = zipJobs
      .filter(
        (job) =>
          job.sessionId === sessionId &&
          !["completed", "cancelled"].includes(job.status)
      )
      .sort((left, right) => right.createdAt - left.createdAt)[0]
    const displayEntries = React.useMemo<UploadArchiveEntry[]>(
      () =>
        liveFolderJob
          ? liveFolderJob.records.map((record) => ({
              clientFileId: record.relativePath,
              name: record.relativePath,
              size: record.sizeBytes,
              isDir: false,
              uploadRecord: record,
            }))
          : entries.map((entry) => ({
              ...entry,
              clientFileId: `${entry.isDir ? "directory" : "file"}:${entry.name}`,
            })),
      [entries, liveFolderJob]
    )
    const displayFileName =
      liveFolderJob?.rootName ?? liveZipJob?.fileName ?? fileName
    const displaySelectionKind = liveFolderJob
      ? "folder"
      : liveZipJob
        ? "zip"
        : selectionKind
    const datasetIdentity = `${sessionId ?? "none"}:${liveFolderJob?.id ?? "none"}`

    React.useEffect(() => {
      setPagination((current) =>
        current.pageIndex === 0 ? current : { ...current, pageIndex: 0 }
      )
    }, [datasetIdentity])

    React.useEffect(() => {
      const maxPageIndex = Math.max(
        0,
        Math.ceil(displayEntries.length / FOLDER_UPLOAD_FILE_PAGE_SIZE) - 1
      )
      setPagination((current) => {
        const nextPageIndex = Math.min(current.pageIndex, maxPageIndex)
        return nextPageIndex === current.pageIndex
          ? current
          : { ...current, pageIndex: nextPageIndex }
      })
    }, [displayEntries.length])

    const table = useReactTable({
      data: displayEntries,
      columns: liveFolderJob ? columns : columns.slice(0, 3),
      getCoreRowModel: getCoreRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
      getSortedRowModel: getSortedRowModel(),
      onSortingChange: setSorting,
      onPaginationChange: setPagination,
      state: { sorting, pagination },
      autoResetPageIndex: false,
      getRowId: (row) => row.clientFileId,
    })

    useImperativeHandle(ref, () => ({
      hasFile: () => displayEntries.length > 0,
      process: async () => {
        if (!folderPath) {
          setError("Chưa có folder_path từ file ZIP.")
          throw new Error("Chưa có folder_path từ file ZIP.")
        }
      },
    }))

    const handleFile = async (file: File) => {
      setError("")
      setEntries([])
      setFileName(file.name)
      setSelectionKind("zip")
      setIgnoredCount(0)
      onFolderSelection([], "")
      onProcessStateChange("idle")
      setLoading(true)
      try {
        const upload = await onUploadFile(file)
        const remoteFolderPath = upload.folder_path ?? upload.data_path ?? ""
        if (!remoteFolderPath) {
          throw new Error("Backend không trả về folder_path cho file ZIP.")
        }
        const list: ArchiveEntry[] = [
          { name: remoteFolderPath, size: file.size, isDir: true },
        ]
        setFolderPath(remoteFolderPath)
        onFolderPathChange(remoteFolderPath)
        setEntries(list)
        onHasFileChange(true)
        onEntriesChange(list)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Không thể đọc hoặc tải lên file nén."
        )
        setFolderPath("")
        onFolderPathChange("")
        setFileName("")
        onHasFileChange(false)
      } finally {
        setLoading(false)
      }
    }

    const handleFolderFiles = (files: File[]) => {
      setError("")
      setLoading(false)
      onProcessStateChange("idle")
      if (!FOLDER_UPLOAD_ENABLED) {
        setError("Chức năng upload folder đang được tắt bởi feature flag.")
        return
      }
      const pdfSources = files
        .map((file) => ({
          file,
          relativePath: String(
            (file as File & { webkitRelativePath?: string })
              .webkitRelativePath || file.name
          )
            .replaceAll("\\", "/")
            .replace(/^\.\/+/, ""),
        }))
        .filter(
          ({ file, relativePath }) =>
            file.size > 0 && relativePath.toLowerCase().endsWith(".pdf")
        )
      setIgnoredCount(files.length - pdfSources.length)
      if (pdfSources.length === 0) {
        setError("Folder không có file PDF hợp lệ và khác rỗng.")
        return
      }
      const firstPath = pdfSources[0].relativePath
      const rootName = firstPath.includes("/")
        ? firstPath.split("/")[0]
        : "Tai-lieu-PDF"
      const list: ArchiveEntry[] = pdfSources.map(({ relativePath, file }) => ({
        name: relativePath,
        size: file.size,
        isDir: false,
      }))
      setSelectionKind("folder")
      setFileName(rootName)
      setFolderPath(rootName)
      setEntries(list)
      onFolderPathChange(rootName)
      onHasFileChange(true)
      onEntriesChange(list)
      onFolderSelection(pdfSources, rootName)
    }

    const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      const files = await droppedFiles(event.dataTransfer)
      if (files.length === 1 && files[0].name.toLowerCase().endsWith(".zip")) {
        await handleFile(files[0])
        return
      }
      handleFolderFiles(files)
    }

    const clear = () => {
      setEntries([])
      setFolderPath("")
      onFolderPathChange("")
      setFileName("")
      onMaxFilesChange("")
      setError("")
      setSelectionKind(null)
      setIgnoredCount(0)
      onFolderSelection([], "")
      onProcessStateChange("idle")
      onHasFileChange(false)
      onEntriesChange([])
    }

    const fileCount = displayEntries.filter((e) => !e.isDir).length
    const dirCount = displayEntries.filter((e) => e.isDir).length
    const isDone = processState === "done"
    const isProcessing =
      processState === "processing" ||
      Boolean(
        liveFolderJob &&
        !["completed", "cancelled"].includes(liveFolderJob.status)
      ) ||
      Boolean(
        liveZipJob && !["completed", "cancelled"].includes(liveZipJob.status)
      )

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.24 }}
        className={cn(
          "relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl border bg-white p-5 transition-all duration-300",
          isDone
            ? "border-primary/20 shadow-[0_4px_24px_rgba(0,82,255,0.08)]"
            : "border-[#E2E8F0] shadow-sm"
        )}
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0052FF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className="text-base font-bold text-[#0F172A]">Kho lưu trữ</p>
              {isDone && (
                <span
                  className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold text-white"
                  style={{
                    background: "linear-gradient(to right, #0052FF, #4D7CFF)",
                  }}
                >
                  <CheckCircle2 className="size-3" /> Xong
                </span>
              )}
              {isProcessing && (
                <span className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-semibold text-primary">
                  <Loader2 className="size-3 animate-spin" /> Đang xử lý
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-[#64748B]">
              {FOLDER_UPLOAD_ENABLED
                ? "Chọn một file ZIP hoặc nguyên folder PDF cần xử lý."
                : "Chọn một file ZIP cần xử lý."}
            </p>
          </div>
        </div>

        {displayFileName ? (
          <FileChip
            fileName={displayFileName}
            loading={loading}
            processState={processState}
            onClear={clear}
            icon={
              displaySelectionKind === "folder" ? (
                <Folder className="size-4" />
              ) : (
                <FileArchive className="size-4" />
              )
            }
          />
        ) : (
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => void handleDrop(event)}
            className="rounded-xl border-2 border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-6"
          >
            <input
              ref={zipInputRef}
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void handleFile(file)
                event.target.value = ""
              }}
            />
            <input
              ref={folderInputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              disabled={!FOLDER_UPLOAD_ENABLED}
              className="hidden"
              {...({
                webkitdirectory: "",
                directory: "",
              } as React.InputHTMLAttributes<HTMLInputElement>)}
              onChange={(event) => {
                handleFolderFiles(Array.from(event.target.files ?? []))
                event.target.value = ""
              }}
            />
            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-[#0F172A]">
              <Upload className="size-5 text-[#0052FF]" />
              {FOLDER_UPLOAD_ENABLED
                ? "Kéo thả ZIP, folder hoặc tập PDF vào đây"
                : "Kéo thả file ZIP vào đây"}
            </div>
            <p className="mt-1 text-center text-xs text-[#94A3B8]">
              Chọn dữ liệu chỉ tạo bản nháp; upload bắt đầu sau khi nhấn nút xử
              lý.
            </p>
            <div
              className={cn(
                "mt-4 grid gap-3",
                FOLDER_UPLOAD_ENABLED && "sm:grid-cols-2"
              )}
            >
              <Button
                type="button"
                variant="outline"
                className="h-11 border-[#0052FF] text-[#0052FF]"
                onClick={() => zipInputRef.current?.click()}
              >
                <FileArchive className="size-4" /> Upload file ZIP
              </Button>
              {FOLDER_UPLOAD_ENABLED && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 border-emerald-600 text-emerald-700"
                  onClick={() => folderInputRef.current?.click()}
                >
                  <Folder className="size-4" /> Upload folder PDF
                </Button>
              )}
            </div>
          </div>
        )}

        {displaySelectionKind === "folder" && (
          <p className="text-xs text-[#64748B]">
            {liveFolderJob
              ? `Đang hiển thị ${liveFolderJob.records.length} / ${liveFolderJob.expectedFileCount} PDF`
              : `Đã chọn ${entries.length} PDF để hiển thị`}
            {ignoredCount > 0
              ? ` · Bỏ qua ${ignoredCount} file không phải PDF hoặc rỗng`
              : ""}
          </p>
        )}

        {uploadInterruption && (
          <InterruptedUploadProgress interruption={uploadInterruption} />
        )}

        {liveFolderJob && !uploadInterruption && (
          <FolderUploadProgress job={liveFolderJob} />
        )}

        {displayFileName &&
          displaySelectionKind !== "folder" &&
          uploadProgress && (
            <div className="rounded-xl border border-primary/15 bg-primary/[0.03] p-3">
              <div className="flex items-center justify-between gap-3 text-xs font-semibold text-[#0F172A]">
                <span className="truncate">
                  {uploadProgress.phase === "error"
                    ? "Upload ZIP thất bại"
                    : uploadProgress.phase === "done"
                      ? "Đã upload ZIP xong"
                      : uploadProgress.phase === "processing"
                        ? "Đang xác nhận upload"
                        : "Đang upload ZIP"}
                </span>
                <span className="shrink-0 font-roboto text-[11px] text-[#0052FF]">
                  {uploadProgress.percent !== null
                    ? `${uploadProgress.percent}%`
                    : `${uploadProgress.loadedMb.toFixed(2)} MB`}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#D8E1EC]">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-200",
                    uploadProgress.phase === "error"
                      ? "bg-destructive"
                      : "bg-[#0052FF]"
                  )}
                  style={{ width: `${uploadProgress.percent ?? 100}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 font-roboto text-[11px] text-[#64748B]">
                <span>{uploadProgress.loadedMb.toFixed(2)} MB</span>
                <span>
                  {uploadProgress.totalMb > 0
                    ? `${uploadProgress.totalMb.toFixed(2)} MB`
                    : "Đang tính dung lượng"}
                </span>
              </div>
            </div>
          )}

        {displayFileName && displaySelectionKind !== "folder" && (
          <div className="grid gap-2 rounded-xl border border-border bg-muted/30 p-3 sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-center">
            <label
              htmlFor="zip-max-files"
              className="font-roboto text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase"
            >
              Số tài liệu cần số hóa
            </label>
            <Input
              id="zip-max-files"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={maxFiles}
              placeholder="Tất cả"
              disabled={loading || isProcessing}
              aria-invalid={error === MAX_FILES_ERROR}
              className="h-8 text-right font-roboto text-sm"
              onChange={(event) => {
                onMaxFilesChange(event.target.value)
                if (error === MAX_FILES_ERROR) setError("")
              }}
            />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
            <AlertCircle className="size-3.5 shrink-0" /> {error}
          </div>
        )}

        {displayEntries.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="font-roboto text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                Nội dung
              </span>
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 font-roboto text-[10px] text-muted-foreground">
                {fileCount} file{dirCount > 0 ? `, ${dirCount} thư mục` : ""}
              </span>
            </div>

            <div className="max-h-[34rem] overflow-auto rounded-xl border border-border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-muted">
                  {table.getHeaderGroups().map((hg) => (
                    <TableRow
                      key={hg.id}
                      className="bg-muted/50 hover:bg-muted/50"
                    >
                      {hg.headers.map((header) => (
                        <TableHead
                          key={header.id}
                          style={{
                            width:
                              header.getSize() !== 150
                                ? header.getSize()
                                : undefined,
                          }}
                          className="py-2"
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} className="hover:bg-muted/30">
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="py-2">
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
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-roboto text-[11px] text-muted-foreground">
                Trang {table.getState().pagination.pageIndex + 1} /{" "}
                {Math.max(1, table.getPageCount())} · Tối đa{" "}
                {FOLDER_UPLOAD_FILE_PAGE_SIZE} file mỗi trang
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 px-2"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronLeft className="size-3.5" />
                  Trang trước
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 px-2"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  Trang sau
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    )
  }
)

function FolderUploadProgress({ job }: { job: FolderUploadJob }) {
  const waiting = Math.max(
    0,
    job.expectedFileCount - job.completedFileCount - job.failedFileCount
  )
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#0F172A]">
            Tiến trình ghi nhận tài liệu
          </p>
          <p className="mt-0.5 text-xs text-[#64748B]">
            Chỉ tài liệu đã xác nhận hoặc được xác định đã tồn tại mới tính vào
            tiến độ.
          </p>
        </div>
        <span className="shrink-0 font-roboto text-sm font-bold text-[#0052FF]">
          {job.completedFileCount}/{job.expectedFileCount} · {job.percent}%
        </span>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-blue-100">
        <div
          className="h-full rounded-full bg-[#0052FF] transition-[width] duration-200"
          style={{ width: `${job.percent}%` }}
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <ProgressCount label="Đã duyệt" value={job.confirmedFileCount} />
        <ProgressCount label="Đã có / bỏ qua" value={job.skippedFileCount} />
        <ProgressCount label="Đang chờ" value={waiting} />
        <ProgressCount
          label="Lỗi"
          value={job.failedFileCount}
          tone={job.failedFileCount > 0 ? "error" : "default"}
        />
      </div>
    </div>
  )
}

function InterruptedUploadProgress({
  interruption,
}: {
  interruption: UploadInterruptionSnapshot
}) {
  if (interruption.kind === "zip") {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-700" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-amber-950">
              Upload ZIP đã bị hủy
            </p>
            <p className="mt-1 truncate text-xs font-semibold text-[#475569]">
              {interruption.fileName}
            </p>
            <p className="mt-1 text-xs leading-5 text-amber-900">
              ZIP chưa complete được xử lý như một input không hợp lệ: không tạo
              ingestion run và không có tài liệu nào được ghi nhận. Hãy chọn lại
              ZIP nếu cần tải lại.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const total = interruption.expectedFileCount ?? 0
  const percent =
    total > 0
      ? Math.min(
          100,
          Math.round((interruption.recordedFileCount / total) * 1_000) / 10
        )
      : 0
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0 text-amber-700" />
            <p className="text-sm font-bold text-amber-950">
              {interruption.status === "cancelled"
                ? "Upload folder đã bị hủy"
                : "Upload folder bị gián đoạn · đang đóng attempt"}
            </p>
          </div>
          <p className="mt-1 truncate text-xs font-semibold text-[#475569]">
            {interruption.fileName}
          </p>
          <p className="mt-1 text-xs leading-5 text-amber-900">
            Các file đã được server xác nhận vẫn được giữ lại; phần binary chưa
            hoàn tất không được khôi phục sau khi tải lại trang.
          </p>
        </div>
        <span className="shrink-0 font-roboto text-sm font-bold text-[#0052FF]">
          {interruption.recordedFileCount}/{total} · {percent}%
        </span>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-blue-100">
        <div
          className="h-full rounded-full bg-[#0052FF]"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <ProgressCount
          label="Đã ghi nhận"
          value={interruption.recordedFileCount}
        />
        <ProgressCount
          label="Có thể xử lý"
          value={interruption.effectiveFileCount}
        />
        <ProgressCount
          label="Đã có / bỏ qua"
          value={interruption.skippedFileCount}
        />
        <ProgressCount
          label="Lỗi"
          value={interruption.failedFileCount}
          tone={interruption.failedFileCount > 0 ? "error" : "default"}
        />
      </div>
      {interruption.unfinishedFileCount > 0 && (
        <p className="mt-2 text-xs text-[#64748B]">
          {interruption.unfinishedFileCount} file chưa hoàn tất đã dừng; hệ
          thống chỉ tạo ingestion run cho {interruption.effectiveFileCount} tài
          liệu hợp lệ của lần upload này.
        </p>
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
          "mt-0.5 font-roboto text-sm font-bold",
          tone === "error" ? "text-destructive" : "text-[#0F172A]"
        )}
      >
        {value}
      </p>
    </div>
  )
}

function FolderFileStatus({ record }: { record: FolderUploadFileProgress }) {
  const percent =
    record.status === "uploading" && record.sizeBytes > 0
      ? Math.min(
          100,
          Math.round((record.uploadedBytes / record.sizeBytes) * 100)
        )
      : null
  const labels: Record<FolderUploadFileProgress["status"], string> = {
    queued: "Chờ đăng ký",
    registering: "Đang đăng ký",
    registered: "Đã đăng ký",
    presigned: "Đã cấp URL tải",
    uploading: `Đang tải${percent === null ? "" : ` · ${percent}%`}`,
    uploaded: "Đã tải · chờ xác nhận",
    confirming: "Đang xác nhận",
    confirmed: "Đã duyệt · hoàn tất",
    skipped: "Đã có · bỏ qua",
    failed: "Lỗi · chờ xử lý",
    cancelled: "Đã hủy",
  }
  const tone =
    record.status === "confirmed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : record.status === "skipped"
        ? "border-sky-200 bg-sky-50 text-sky-700"
        : record.status === "failed"
          ? "border-red-200 bg-red-50 text-red-700"
          : record.status === "uploading" || record.status === "confirming"
            ? "border-blue-200 bg-blue-50 text-blue-700"
            : "border-slate-200 bg-slate-50 text-slate-600"
  return (
    <div className="min-w-36" title={record.error ?? labels[record.status]}>
      <span
        className={cn(
          "inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold whitespace-nowrap",
          tone
        )}
      >
        {labels[record.status]}
      </span>
      {percent !== null && (
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-blue-100">
          <div
            className="h-full rounded-full bg-blue-600 transition-[width] duration-150"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </div>
  )
}

interface LegacyFileEntry {
  isFile: boolean
  isDirectory: boolean
  name: string
  file?: (
    success: (file: File) => void,
    failure?: (error: DOMException) => void
  ) => void
  createReader?: () => {
    readEntries: (
      success: (entries: LegacyFileEntry[]) => void,
      failure?: (error: DOMException) => void
    ) => void
  }
}

async function droppedFiles(dataTransfer: DataTransfer): Promise<File[]> {
  const entries = Array.from(dataTransfer.items)
    .map((item): LegacyFileEntry | null => {
      const legacyItem = item as unknown as {
        webkitGetAsEntry?: () => LegacyFileEntry | null
      }
      return legacyItem.webkitGetAsEntry?.() ?? null
    })
    .filter((entry): entry is LegacyFileEntry => entry !== null)
  if (entries.length === 0) return Array.from(dataTransfer.files)
  const nested = await Promise.all(
    entries.map((entry) => filesFromEntry(entry, ""))
  )
  return nested.flat()
}

async function filesFromEntry(
  entry: LegacyFileEntry,
  parentPath: string
): Promise<File[]> {
  const path = parentPath ? `${parentPath}/${entry.name}` : entry.name
  if (entry.isFile && entry.file) {
    return new Promise((resolve, reject) => {
      entry.file!(
        (file) => {
          try {
            Object.defineProperty(file, "webkitRelativePath", {
              configurable: true,
              value: path,
            })
          } catch {
            // The original file name remains a safe fallback.
          }
          resolve([file])
        },
        (error) => reject(error)
      )
    })
  }
  if (!entry.isDirectory || !entry.createReader) return []
  const reader = entry.createReader()
  const children: LegacyFileEntry[] = []
  while (true) {
    const page = await new Promise<LegacyFileEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject)
    })
    if (page.length === 0) break
    children.push(...page)
  }
  const nested = await Promise.all(
    children.map((child) => filesFromEntry(child, path))
  )
  return nested.flat()
}
