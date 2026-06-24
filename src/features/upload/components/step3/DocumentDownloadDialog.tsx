import { useMemo, useState } from "react"
import { Check, Download, FileArchive, Loader2, X } from "lucide-react"
import { Dialog } from "radix-ui"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PaginationControls } from "@/features/upload/components/PaginationControls"
import { usePagedItems } from "@/features/upload/hooks/usePagedItems"
import { downloadSessionDocuments } from "@/features/upload/api/sessionApi"
import type { PdfMetadata } from "@/features/upload/types"

interface DocumentDownloadDialogProps {
  sessionId: string | null
  items: PdfMetadata[]
}

export function DocumentDownloadDialog({
  sessionId,
  items,
}: DocumentDownloadDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set())
  const [downloading, setDownloading] = useState(false)
  const downloadableItems = useMemo(
    () =>
      items
        .filter((item) => item.metadata_ready)
        .sort(compareDownloadableItems),
    [items]
  )
  const pagination = usePagedItems(downloadableItems, {
    defaultPageSize: 100,
    resetKey: open ? "open" : "closed",
    storageKey: "archival-processing.metadata-download-page-size",
  })
  const visibleDownloadableItems = pagination.items
  const allSelected =
    visibleDownloadableItems.length > 0 &&
    visibleDownloadableItems.every((item) => selectedIds.has(item.id))

  const handleOpenChange = (nextOpen: boolean) => {
    if (downloading) return
    setOpen(nextOpen)
    if (nextOpen) {
      pagination.setPageIndex(0)
      setSelectedIds(
        new Set(
          downloadableItems.slice(0, pagination.pageSize).map((item) => item.id)
        )
      )
    }
  }

  const toggleDocument = (documentId: number) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(documentId)) {
        next.delete(documentId)
      } else {
        next.add(documentId)
      }
      return next
    })
  }

  const toggleAll = () => {
    setSelectedIds(
      allSelected
        ? removeSelectedIds(selectedIds, visibleDownloadableItems)
        : addSelectedIds(selectedIds, visibleDownloadableItems)
    )
  }

  const handleDownload = async () => {
    if (!sessionId || selectedIds.size === 0) return
    setDownloading(true)
    try {
      const result = await downloadSessionDocuments(
        sessionId,
        downloadableItems
          .filter((item) => selectedIds.has(item.id))
          .map((item) => item.id)
      )
      saveBlob(result.blob, result.fileName)
      toast.success(`Đã tạo ZIP cho ${selectedIds.size} tài liệu.`)
      setOpen(false)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Không thể tải các tài liệu đã chọn."
      )
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!sessionId || downloadableItems.length === 0}
          className="h-8 gap-1.5 text-xs"
        >
          <Download className="size-3" />
          Tải PDF & metadata
        </Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#0F172A]/45 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex h-[min(88svh,720px)] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-[#CBD5E1] bg-white shadow-2xl outline-none data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=closed]:fade-out data-[state=open]:animate-in data-[state=open]:zoom-in-95 data-[state=open]:fade-in">
          <div className="flex items-start justify-between gap-4 border-b border-[#E2E8F0] px-5 py-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#EAF1FF] text-[#0052FF]">
                <FileArchive className="size-4" />
              </div>
              <div className="min-w-0">
                <Dialog.Title className="text-base font-semibold text-[#0F172A]">
                  Tải tài liệu đã trích xuất
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-[#64748B]">
                  ZIP gồm PDF và file JSONL metadata tương ứng của từng tài
                  liệu.
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                title="Đóng"
                disabled={downloading}
              >
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="flex items-center justify-between gap-3 border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3">
            <label className="flex min-w-0 items-center gap-2 text-sm font-medium text-[#334155]">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="size-4 shrink-0 accent-[#0052FF]"
              />
              Chọn tất cả
            </label>
            <span className="shrink-0 text-xs text-[#64748B]">
              Đã chọn {selectedIds.size}/{downloadableItems.length}
            </span>
          </div>

          <ScrollArea className="min-h-0 flex-1 overflow-y-auto">
            <div className="divide-y divide-[#E2E8F0] px-5">
              {visibleDownloadableItems.map((item) => {
                const selected = selectedIds.has(item.id)
                const fileName = fileNameFromPath(item.data_path)
                return (
                  <label
                    key={item.id}
                    className="flex min-h-16 cursor-pointer items-center gap-3 py-3"
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleDocument(item.id)}
                      className="size-4 shrink-0 accent-[#0052FF]"
                    />
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#D8E1EC] bg-white text-[#0052FF]">
                      {selected ? (
                        <Check className="size-4" />
                      ) : (
                        <FileArchive className="size-4" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[#0F172A]">
                        {fileName}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-[#64748B]">
                        PDF + {fileNameWithoutExtension(fileName)}.jsonl
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </ScrollArea>
          {downloadableItems.length > 0 && (
            <div className="border-t border-[#E2E8F0] px-5 py-3">
              <PaginationControls
                total={pagination.total}
                pageIndex={pagination.pageIndex}
                pageSize={pagination.pageSize}
                pageCount={pagination.pageCount}
                startNumber={pagination.startNumber}
                endNumber={pagination.endNumber}
                itemLabel="tài liệu"
                onPageChange={pagination.setPageIndex}
              />
            </div>
          )}

          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-[#E2E8F0] px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
            <Dialog.Close asChild>
              <Button
                type="button"
                variant="outline"
                disabled={downloading}
                className="sm:min-w-24"
              >
                Hủy
              </Button>
            </Dialog.Close>
            <Button
              type="button"
              onClick={() => void handleDownload()}
              disabled={!sessionId || selectedIds.size === 0 || downloading}
              className="sm:min-w-36"
            >
              {downloading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {downloading
                ? "Đang tạo ZIP..."
                : `Tải ${selectedIds.size} tài liệu`}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function fileNameFromPath(path: string): string {
  return path.replace(/\\/g, "/").split("/").filter(Boolean).pop() || path
}

function fileNameWithoutExtension(fileName: string): string {
  const extensionIndex = fileName.lastIndexOf(".")
  return extensionIndex > 0 ? fileName.slice(0, extensionIndex) : fileName
}

function compareDownloadableItems(a: PdfMetadata, b: PdfMetadata): number {
  const byFileName = fileNameFromPath(a.data_path).localeCompare(
    fileNameFromPath(b.data_path),
    "vi",
    { numeric: true, sensitivity: "base" }
  )
  return byFileName || a.id - b.id
}

function addSelectedIds(
  selectedIds: Set<number>,
  items: PdfMetadata[]
): Set<number> {
  const next = new Set(selectedIds)
  items.forEach((item) => next.add(item.id))
  return next
}

function removeSelectedIds(
  selectedIds: Set<number>,
  items: PdfMetadata[]
): Set<number> {
  const next = new Set(selectedIds)
  items.forEach((item) => next.delete(item.id))
  return next
}

function saveBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = objectUrl
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000)
}
