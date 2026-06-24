import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DEFAULT_PAGE_SIZE_OPTIONS } from "@/features/upload/hooks/usePagedItems"
import { cn } from "@/shared/lib/utils"

type PageItem = number | "ellipsis"

export function PaginationControls({
  total,
  pageIndex,
  pageSize,
  pageCount,
  startNumber,
  endNumber,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  itemLabel = "mục",
  className,
  onPageChange,
  onPageSizeChange,
}: {
  total: number
  pageIndex: number
  pageSize: number
  pageCount: number
  startNumber: number
  endNumber: number
  pageSizeOptions?: number[]
  itemLabel?: string
  className?: string
  onPageChange: (pageIndex: number) => void
  onPageSizeChange?: (pageSize: number) => void
}) {
  const pageItems = getPageItems(pageIndex, pageCount)

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-[#D8E1EC] bg-white px-3 py-2 text-xs text-[#475569] lg:flex-row lg:items-center lg:justify-between",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2 lg:min-w-48">
        <span className="font-medium text-[#0F172A]">
          {startNumber}-{endNumber} / {total} {itemLabel}
        </span>
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5">
            <span>Cỡ trang</span>
            <select
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="h-7 rounded-md border border-[#CBD5E1] bg-white px-2 text-xs font-medium text-[#0F172A] outline-none focus-visible:border-[#0052FF] focus-visible:ring-2 focus-visible:ring-[#0052FF]/20"
            >
              {pageSizeOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5 lg:justify-end">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          title="Trang trước"
          disabled={pageIndex <= 0}
          onClick={() => onPageChange(Math.max(0, pageIndex - 1))}
        >
          <ChevronLeft className="size-3.5" />
        </Button>
        <div
          className="flex min-w-0 flex-wrap items-center gap-1"
          aria-label="Chọn trang"
        >
          {pageItems.map((item, index) =>
            item === "ellipsis" ? (
              <span
                key={`ellipsis-${index}`}
                className="inline-flex size-7 items-center justify-center text-[#94A3B8]"
                aria-hidden="true"
              >
                <MoreHorizontal className="size-3.5" />
              </span>
            ) : (
              <button
                key={item}
                type="button"
                aria-current={item === pageIndex ? "page" : undefined}
                className={cn(
                  "inline-flex size-7 items-center justify-center rounded-md border text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-[#0052FF]/30 focus-visible:outline-none",
                  item === pageIndex
                    ? "border-[#0052FF] bg-[#0052FF] text-white"
                    : "border-[#CBD5E1] bg-white text-[#0F172A] hover:border-[#0052FF]/40 hover:bg-[#F8FAFC]"
                )}
                onClick={() => onPageChange(item)}
              >
                {item + 1}
              </button>
            )
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          title="Trang sau"
          disabled={pageIndex >= pageCount - 1}
          onClick={() => onPageChange(Math.min(pageCount - 1, pageIndex + 1))}
        >
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

function getPageItems(pageIndex: number, pageCount: number): PageItem[] {
  const safePageCount = Math.max(1, Math.floor(pageCount))
  const safePageIndex = Math.min(
    Math.max(0, Math.floor(pageIndex)),
    safePageCount - 1
  )
  if (safePageCount <= 7) {
    return Array.from({ length: safePageCount }, (_, index) => index)
  }

  const pages = new Set<number>([
    0,
    1,
    safePageCount - 2,
    safePageCount - 1,
    safePageIndex - 1,
    safePageIndex,
    safePageIndex + 1,
  ])
  const orderedPages = Array.from(pages)
    .filter((page) => page >= 0 && page < safePageCount)
    .sort((a, b) => a - b)

  const items: PageItem[] = []
  for (const page of orderedPages) {
    const previous = items[items.length - 1]
    if (typeof previous === "number" && page - previous > 1) {
      items.push("ellipsis")
    }
    items.push(page)
  }
  return items
}
