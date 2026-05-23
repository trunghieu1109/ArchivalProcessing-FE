import { forwardRef, useState, useImperativeHandle } from "react"
import * as React from "react"
import JSZip from "jszip"
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
import { cn } from "@/shared/lib/utils"
import { DropZone } from "./DropZone"
import { FileChip } from "./FileChip"
import type { UseOcrFolderResult } from "@/features/upload/hooks/useOcrFolder"
import type { ProcessState, SectionHandle, ArchiveEntry } from "@/features/upload/types"

const HARDCODED_FOLDER_PATH = "HC/UBND/PNV"

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
        <Folder className="size-3.5 text-[#0052FF]" />
      ) : (
        <File className="size-3.5 text-[#64748B]" />
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
        className="-ml-2 h-7 gap-1 px-2 font-roboto text-[11px] font-semibold uppercase tracking-[0.1em] text-[#64748B]"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Tên
        <ArrowUpDown className="size-3" />
      </Button>
    ),
    cell: ({ row }) => (
      <span
        className={cn(
          "block truncate font-roboto text-[12px]",
          row.original.isDir
            ? "font-semibold text-[#0F172A]"
            : "text-[#475569]"
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
        className="-mr-2 ml-auto flex h-7 gap-1 px-2 font-roboto text-[11px] font-semibold uppercase tracking-[0.1em] text-[#64748B]"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Kích thước
        <ArrowUpDown className="size-3" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="block text-right font-roboto text-[11px] text-[#94A3B8]">
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
  ocr: UseOcrFolderResult
}

export const ZipSection = forwardRef<SectionHandle, ZipSectionProps>(
  ({ processState, onProcessStateChange, onHasFileChange, onEntriesChange, ocr }, ref) => {
    const [fileName, setFileName] = useState("")
    const [entries, setEntries] = useState<ArchiveEntry[]>([])
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
        onProcessStateChange("processing")
        await ocr.start(HARDCODED_FOLDER_PATH)
        onProcessStateChange("done")
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
        const zip = await JSZip.loadAsync(file)
        const list: ArchiveEntry[] = []
        zip.forEach((path, entry) => list.push({ name: path, size: 0, isDir: entry.dir }))
        await Promise.all(
          list.map(async (entry, i) => {
            if (!entry.isDir) {
              const data = await zip.file(entry.name)?.async("uint8array")
              list[i].size = data?.length ?? 0
            }
          })
        )
        list.sort((a, b) => {
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
          return a.name.localeCompare(b.name)
        })
        setEntries(list)
        onHasFileChange(true)
        onEntriesChange(list)
      } catch {
        setError("Không thể đọc file nén.")
        setFileName("")
        onHasFileChange(false)
      } finally {
        setLoading(false)
      }
    }

    const clear = () => {
      setEntries([])
      setFileName("")
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
            ? "border-[#0052FF]/20 shadow-[0_4px_24px_rgba(0,82,255,0.08)]"
            : "border-[#E2E8F0]"
        )}
        style={{ fontFamily: "'Roboto', sans-serif" }}
      >
        {isDone && (
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-[#0052FF]/[0.04] to-transparent" />
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#64748B]/50">03</span>
            <div>
              <p className="text-sm font-semibold leading-none text-[#0F172A]">Kho lưu trữ</p>
              <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.12em] text-[#64748B]">.zip / .rar</p>
            </div>
          </div>
          {isDone && (
            <span
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold text-white"
              style={{ background: "linear-gradient(to right, #0052FF, #4D7CFF)" }}
            >
              <CheckCircle2 className="size-3" /> Xong
            </span>
          )}
          {isProcessing && (
            <span className="flex items-center gap-1.5 rounded-full border border-[#0052FF]/20 bg-[#0052FF]/5 px-3 py-1 text-[11px] font-semibold text-[#0052FF]">
              <Loader2 className="size-3 animate-spin" /> Đang xử lý
            </span>
          )}
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
          <DropZone accept=".zip,.rar" onFile={handleFile} label="File nén ZIP / RAR" hint=".zip, .rar" />
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
            <AlertCircle className="size-3.5 shrink-0" /> {error}
          </div>
        )}

        {entries.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                Nội dung
              </span>
              <span className="rounded-full border border-[#E2E8F0] bg-[#F1F5F9] px-2 py-0.5 text-[10px] text-[#64748B]">
                {fileCount} file{dirCount > 0 ? `, ${dirCount} thư mục` : ""}
              </span>
            </div>

            <div className="overflow-hidden rounded-xl border border-[#E2E8F0]">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((hg) => (
                    <TableRow key={hg.id} className="bg-[#F8FAFC] hover:bg-[#F8FAFC]">
                      {hg.headers.map((header) => (
                        <TableHead
                          key={header.id}
                          style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                          className="py-2"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} className="hover:bg-[#F8FAFC]">
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="py-2">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#94A3B8]">
                Trang {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
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
