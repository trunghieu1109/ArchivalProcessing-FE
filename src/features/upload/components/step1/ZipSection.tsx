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
} from "lucide-react"
import { motion } from "framer-motion"
import {
  type ColumnDef,
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
import { DropZone } from "./DropZone"
import { FileChip } from "./FileChip"
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

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

const columns: ColumnDef<ArchiveEntry>[] = [
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
]

interface ZipSectionProps {
  processState: ProcessState
  onProcessStateChange: (s: ProcessState) => void
  onHasFileChange: (v: boolean) => void
  onEntriesChange: (entries: ArchiveEntry[]) => void
  onFolderPathChange: (folderPath: string) => void
  maxFiles: string
  onMaxFilesChange: (value: string) => void
  onUploadFile: (file: File) => Promise<SessionInputUploadResponse>
  uploadProgress: UploadProgressSnapshot | null
  ocr: UseOcrFolderResult
}

export const ZipSection = forwardRef<SectionHandle, ZipSectionProps>(
  (
    {
      processState,
      onProcessStateChange,
      onHasFileChange,
      onEntriesChange,
      onFolderPathChange,
      maxFiles,
      onMaxFilesChange,
      onUploadFile,
      uploadProgress,
      ocr,
    },
    ref
  ) => {
    const [fileName, setFileName] = useState("")
    const [entries, setEntries] = useState<ArchiveEntry[]>([])
    const [folderPath, setFolderPath] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)
    const [sorting, setSorting] = React.useState<SortingState>([])

    const table = useReactTable({
      data: entries,
      columns,
      getCoreRowModel: getCoreRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
      getSortedRowModel: getSortedRowModel(),
      onSortingChange: setSorting,
      state: { sorting },
      initialState: { pagination: { pageSize: 10 } },
    })

    useImperativeHandle(ref, () => ({
      hasFile: () => entries.length > 0,
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
      onProcessStateChange("idle")
      ocr.reset()
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

    const clear = () => {
      setEntries([])
      setFolderPath("")
      onFolderPathChange("")
      setFileName("")
      onMaxFilesChange("")
      setError("")
      onProcessStateChange("idle")
      onHasFileChange(false)
      onEntriesChange([])
      ocr.reset()
    }

    const fileCount = entries.filter((e) => !e.isDir).length
    const dirCount = entries.filter((e) => e.isDir).length
    const isDone = processState === "done"
    const isProcessing = processState === "processing"

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
              Tải lên file nén chứa toàn bộ tài liệu cần xử lý.
            </p>
          </div>
        </div>

        {fileName ? (
          <FileChip
            fileName={fileName}
            loading={loading}
            processState={processState}
            onClear={clear}
            icon={<FileArchive className="size-4" />}
          />
        ) : (
          <DropZone
            accept=".zip"
            onFile={handleFile}
            label="Kéo thả file .zip vào đây"
            hint=".zip"
            maxSize="2GB"
            buttonColor="blue"
          />
        )}

        {fileName && uploadProgress && uploadProgress.phase !== "done" && (
          <div className="rounded-xl border border-primary/15 bg-primary/[0.03] p-3">
            <div className="flex items-center justify-between gap-3 text-xs font-semibold text-[#0F172A]">
              <span className="truncate">
                {uploadProgress.phase === "error"
                  ? "Upload ZIP thất bại"
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
                className="h-full rounded-full bg-[#0052FF] transition-[width] duration-200"
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

        {fileName && (
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

        {entries.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="font-roboto text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                Nội dung
              </span>
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 font-roboto text-[10px] text-muted-foreground">
                {fileCount} file{dirCount > 0 ? `, ${dirCount} thư mục` : ""}
              </span>
            </div>

            <div className="overflow-hidden rounded-xl border border-border">
              <Table>
                <TableHeader>
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

            <div className="flex items-center justify-between">
              <span className="font-roboto text-[11px] text-muted-foreground/60">
                Trang {table.getState().pagination.pageIndex + 1} /{" "}
                {table.getPageCount()}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronLeft className="size-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
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
