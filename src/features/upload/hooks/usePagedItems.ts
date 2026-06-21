import { useCallback, useMemo, useState } from "react"

export const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100, 200, 500, 1000]

interface UsePagedItemsOptions {
  defaultPageSize?: number
  pageSizeOptions?: number[]
  resetKey?: string | number | null
  storageKey?: string
}

interface PageState {
  pageIndex: number
  pageSize: number
  resetKey: string | number | null
}

export function usePagedItems<T>(
  items: readonly T[],
  {
    defaultPageSize = 50,
    pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
    resetKey = null,
    storageKey,
  }: UsePagedItemsOptions = {}
) {
  const normalizedOptions = useMemo(
    () => normalizePageSizeOptions(pageSizeOptions),
    [pageSizeOptions]
  )
  const [pageState, setPageState] = useState<PageState>(() => ({
    pageIndex: 0,
    pageSize: normalizePageSize(
      readStoredPageSize(storageKey) ?? defaultPageSize,
      normalizedOptions
    ),
    resetKey,
  }))

  const total = items.length
  const pageSize = normalizePageSize(pageState.pageSize, normalizedOptions)
  const rawPageIndex = pageState.resetKey === resetKey ? pageState.pageIndex : 0
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const pageIndex = Math.min(Math.max(0, rawPageIndex), pageCount - 1)
  const startIndex = pageIndex * pageSize
  const endIndex = Math.min(total, startIndex + pageSize)
  const pageItems = useMemo(
    () => items.slice(startIndex, endIndex),
    [endIndex, items, startIndex]
  )

  const setPageIndex = useCallback(
    (nextPageIndex: number) => {
      setPageState((current) => {
        if (
          current.pageIndex === nextPageIndex &&
          current.resetKey === resetKey
        ) {
          return current
        }
        return {
          ...current,
          pageIndex: nextPageIndex,
          resetKey,
        }
      })
    },
    [resetKey]
  )

  const setPageSize = useCallback(
    (value: number) => {
      const nextPageSize = normalizePageSize(value, normalizedOptions)
      writeStoredPageSize(storageKey, nextPageSize)
      setPageState((current) => {
        if (
          current.pageIndex === 0 &&
          current.pageSize === nextPageSize &&
          current.resetKey === resetKey
        ) {
          return current
        }
        return {
          pageIndex: 0,
          pageSize: nextPageSize,
          resetKey,
        }
      })
    },
    [normalizedOptions, resetKey, storageKey]
  )

  return {
    items: pageItems,
    total,
    pageIndex,
    pageSize,
    pageCount,
    startNumber: total === 0 ? 0 : startIndex + 1,
    endNumber: endIndex,
    pageSizeOptions: normalizedOptions,
    setPageIndex,
    setPageSize,
  }
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

function normalizePageSize(value: number, options: number[]): number {
  const numericValue = Math.floor(Number(value))
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return options[0] ?? 50
  }
  return options.includes(numericValue) ? numericValue : options[0]
}

function readStoredPageSize(storageKey: string | undefined): number | null {
  if (!storageKey || typeof window === "undefined") return null
  try {
    const value = Number(window.localStorage.getItem(storageKey))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

function writeStoredPageSize(
  storageKey: string | undefined,
  pageSize: number
) {
  if (!storageKey || typeof window === "undefined") return
  try {
    window.localStorage.setItem(storageKey, String(pageSize))
  } catch {
    // Some browsers block localStorage in restricted contexts.
  }
}
