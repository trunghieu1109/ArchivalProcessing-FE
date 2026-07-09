import type { PreviewVariantState } from "./DocumentPdfPreview.types"

export interface BlankPageReviewMapping {
  processedToOriginal: Map<number, number>
  originalToProcessed: Map<number, number>
  warningOriginalPages: number[]
  visibleWarningOriginalPages: number[]
  removedWarningOriginalPages: number[]
  initialDeletedOriginalPages: number[]
  sourcePageCount: number
  outputPageCount: number
}

export function buildBlankPageReviewMapping(
  variant: PreviewVariantState,
  renderedPageCount = 0
): BlankPageReviewMapping {
  const removedPages = normalizedPageList(variant.removedPages)
  const removedSet = new Set(removedPages)
  const warningOriginalPages = blankPageWarningOriginalPages(variant)
  const sourcePageCount = Math.max(
    variant.sourcePageCount ?? 0,
    renderedPageCount + removedPages.length,
    ...removedPages,
    ...warningOriginalPages
  )
  const outputPageCount = Math.max(
    variant.outputPageCount ?? 0,
    renderedPageCount,
    Math.max(0, sourcePageCount - removedPages.length)
  )
  const processedToOriginal = new Map<number, number>()
  const originalToProcessed = new Map<number, number>()
  let processedPage = 0
  for (let originalPage = 1; originalPage <= sourcePageCount; originalPage += 1) {
    if (removedSet.has(originalPage)) continue
    processedPage += 1
    if (outputPageCount > 0 && processedPage > outputPageCount) break
    processedToOriginal.set(processedPage, originalPage)
    originalToProcessed.set(originalPage, processedPage)
  }

  const visibleWarningOriginalPages = warningOriginalPages.filter((page) =>
    originalToProcessed.has(page)
  )
  const removedWarningOriginalPages = warningOriginalPages.filter(
    (page) => !originalToProcessed.has(page)
  )
  const initialDeletedOriginalPages = normalizedPageList(
    removedPages.length > 0 ? removedPages : variant.blankPages
  )

  return {
    processedToOriginal,
    originalToProcessed,
    warningOriginalPages,
    visibleWarningOriginalPages,
    removedWarningOriginalPages,
    initialDeletedOriginalPages,
    sourcePageCount,
    outputPageCount,
  }
}

export function blankPageWarningOriginalPages(
  variant: PreviewVariantState
): number[] {
  const pages = new Set<number>()
  for (const page of variant.imageWarningPages) {
    if (Number.isInteger(page) && page > 0) pages.add(page)
  }
  for (const warning of variant.blankPageWarnings) {
    const page = Number(warning.page_number)
    if (Number.isInteger(page) && page > 0) pages.add(page)
  }
  return [...pages].sort((left, right) => left - right)
}

export function sortedPageSet(set: Set<number>): number[] {
  return [...set].sort((left, right) => left - right)
}

export function resolveWarningPageDisplayIndex(
  originalPage: number,
  mapping: BlankPageReviewMapping,
  rendersOriginalPages: boolean
): number | null {
  if (!Number.isInteger(originalPage) || originalPage <= 0) return null
  if (rendersOriginalPages) return originalPage
  return mapping.originalToProcessed.get(originalPage) ?? null
}

function normalizedPageList(value: number[]): number[] {
  return [...new Set(value.filter((page) => Number.isInteger(page) && page > 0))]
    .sort((left, right) => left - right)
}
