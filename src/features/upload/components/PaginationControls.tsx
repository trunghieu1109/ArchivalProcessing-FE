import { useEffect, useId, useMemo, useState } from "react"
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
  allowCustomPageSize = false,
  minPageSize = 1,
  maxPageSize,
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
  allowCustomPageSize?: boolean
  minPageSize?: number
  maxPageSize?: number
  itemLabel?: string
  className?: string
  onPageChange: (pageIndex: number) => void
  onPageSizeChange?: (pageSize: number) => void
}) {
  const pageItems = getPageItems(pageIndex, pageCount)
  const pageSizeBounds = useMemo(
    () => normalizePageSizeBounds(minPageSize, maxPageSize),
    [maxPageSize, minPageSize]
  )
  const normalizedPageSizeOptions = useMemo(
    () =>
      normalizePageSizeOptions(pageSizeOptions).filter((value) =>
        isWithinPageSizeBounds(value, pageSizeBounds)
      ),
    [pageSizeBounds, pageSizeOptions]
  )
  const [pageSizeInput, setPageSizeInput] = useState(String(pageSize))
  const pageSizeListId = useId()

  useEffect(() => {
    setPageSizeInput(String(pageSize))
  }, [pageSize])

  const commitCustomPageSize = () => {
    const trimmedValue = pageSizeInput.trim()
    if (!trimmedValue) {
      setPageSizeInput(String(pageSize))
      return
    }
    const nextPageSize = clampPageSize(Number(trimmedValue), pageSizeBounds)
    setPageSizeInput(String(nextPageSize))
    if (nextPageSize !== pageSize) {
      onPageSizeChange?.(nextPageSize)
    }
  }

  return (
    <div
      className={cn(
        "@container/pagination flex flex-row items-center justify-between gap-3 rounded-lg border border-[#D8E1EC] bg-white px-3 py-2 text-xs text-[#475569]",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <span className="min-w-0 font-medium text-[#0F172A]">
          {startNumber}-{endNumber} / {total} {itemLabel}
        </span>
        {onPageSizeChange && (
          <label className="flex shrink-0 flex-wrap items-center gap-1.5">
            <span>Cỡ trang</span>
            {allowCustomPageSize ? (
              <>
                <input
                  type="text"
                  inputMode="numeric"
                  list={pageSizeListId}
                  value={pageSizeInput}
                  aria-label="Custom page size"
                  onChange={(event) => setPageSizeInput(event.target.value)}
                  onBlur={commitCustomPageSize}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.currentTarget.blur()
                    } else if (event.key === "Escape") {
                      setPageSizeInput(String(pageSize))
                      event.currentTarget.blur()
                    }
                  }}
                  className="h-7 w-20 rounded-md border border-[#CBD5E1] bg-white px-2 text-xs font-medium text-[#0F172A] tabular-nums outline-none focus-visible:border-[#0052FF] focus-visible:ring-2 focus-visible:ring-[#0052FF]/20"
                />
                <datalist id={pageSizeListId}>
                  {normalizedPageSizeOptions.map((value) => (
                    <option key={value} value={value} />
                  ))}
                </datalist>
              </>
            ) : (
              <select
                value={pageSize}
                onChange={(event) =>
                  onPageSizeChange(Number(event.target.value))
                }
                className="h-7 rounded-md border border-[#CBD5E1] bg-white px-2 text-xs font-medium text-[#0F172A] outline-none focus-visible:border-[#0052FF] focus-visible:ring-2 focus-visible:ring-[#0052FF]/20"
              >
                {normalizedPageSizeOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            )}
          </label>
        )}
      </div>
      <div className="ml-auto flex shrink-0 flex-nowrap items-center justify-end gap-1.5">
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
        <span
          className="inline-flex h-7 min-w-[2.75rem] items-center justify-center px-1 text-xs font-semibold text-[#0F172A] tabular-nums @min-[15rem]/pagination:hidden"
          aria-live="polite"
        >
          {pageIndex + 1}/{pageCount}
        </span>
        <div
          className="hidden max-w-full min-w-0 items-center gap-1 overflow-x-auto @min-[15rem]/pagination:flex @min-[15rem]/pagination:flex-nowrap"
          aria-label="Chọn trang"
        >
          {pageItems.map((item, index) =>
            item === "ellipsis" ? (
              <span
                key={`ellipsis-${index}`}
                className="inline-flex size-7 shrink-0 items-center justify-center text-[#94A3B8]"
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
                  "inline-flex size-7 shrink-0 items-center justify-center rounded-md border text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-[#0052FF]/30 focus-visible:outline-none",
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

function normalizePageSizeOptions(options: number[]): number[] {
  const unique = Array.from(
    new Set(
      options
        .map((value) => Math.floor(Number(value)))
        .filter((value) => Number.isFinite(value) && value > 0)
    )
  ).sort((a, b) => a - b)
  return unique.length > 0 ? unique : DEFAULT_PAGE_SIZE_OPTIONS
}

interface PageSizeBounds {
  min: number
  max?: number
}

function normalizePageSizeBounds(
  minPageSize: number,
  maxPageSize: number | undefined
): PageSizeBounds {
  const min = Math.max(1, Math.floor(Number(minPageSize) || 1))
  const rawMax = Math.floor(Number(maxPageSize))
  return {
    min,
    max: Number.isFinite(rawMax) && rawMax >= min ? rawMax : undefined,
  }
}

function isWithinPageSizeBounds(
  value: number,
  { min, max }: PageSizeBounds
): boolean {
  return value >= min && (max === undefined || value <= max)
}

function clampPageSize(value: number, { min, max }: PageSizeBounds): number {
  const floorValue = Math.floor(Number(value))
  if (!Number.isFinite(floorValue)) return min
  const minClamped = Math.max(min, floorValue)
  return max === undefined ? minClamped : Math.min(max, minClamped)
}
