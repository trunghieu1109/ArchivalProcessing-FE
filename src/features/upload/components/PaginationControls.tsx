import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DEFAULT_PAGE_SIZE_OPTIONS } from "@/features/upload/hooks/usePagedItems"
import { cn } from "@/shared/lib/utils"

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
  onPageSizeChange: (pageSize: number) => void
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-[#D8E1EC] bg-white px-3 py-2 text-xs text-[#475569] sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-[#0F172A]">
          {startNumber}-{endNumber} / {total} {itemLabel}
        </span>
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
      </div>
      <div className="flex items-center gap-2 sm:justify-end">
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
        <span className="min-w-20 text-center font-medium text-[#0F172A]">
          Trang {pageIndex + 1}/{pageCount}
        </span>
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
