import * as pdfjsLib from "pdfjs-dist"
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist"

const pdfJsAssetBase = `${import.meta.env.BASE_URL}pdfjs/`
const PDF_TO_CSS_UNITS = 96 / 72
const PDF_PAGE_RENDER_CONCURRENCY = 3
const BLANK_PAGE_REVIEW_MAX_PIXEL_RATIO = 1.25

export const PDFJS_WORKER_URL = `${pdfJsAssetBase}pdf.worker.js`
export const PDFJS_WASM_URL = `${pdfJsAssetBase}wasm/`
export const PDFJS_STANDARD_FONT_DATA_URL = `${pdfJsAssetBase}standard_fonts/`
export const PDFJS_CMAP_URL = `${pdfJsAssetBase}cmaps/`

export type OptionalContentConfigPromise = ReturnType<
  PDFDocumentProxy["getOptionalContentConfig"]
>

export interface RenderedPdfPage {
  imageBitmap: ImageBitmap
  cssWidth: number
  cssHeight: number
  aspectRatio: number
}

export interface RenderPdfPageCanvasParams {
  pdfDocument: PDFDocumentProxy
  pageNumber: number
  targetWidth: number
  optionalContentConfigPromise?: OptionalContentConfigPromise | null
}

let workerConfigured = false

export function configurePdfJsWorker(): void {
  if (workerConfigured) return
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL
  workerConfigured = true
}

export function createPdfDocumentLoadingTask(data: Uint8Array) {
  configurePdfJsWorker()
  return pdfjsLib.getDocument({
    data,
    cMapUrl: PDFJS_CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: PDFJS_STANDARD_FONT_DATA_URL,
    wasmUrl: PDFJS_WASM_URL,
  })
}

class PdfPageRenderQueue {
  private active = 0
  private sequence = 0
  private readonly maxConcurrent: number
  private readonly pending: Array<{
    priority: number
    sequence: number
    execute: () => Promise<void>
  }> = []

  constructor(maxConcurrent = PDF_PAGE_RENDER_CONCURRENCY) {
    this.maxConcurrent = maxConcurrent
  }

  run<T>(task: () => Promise<T>, priority = 0): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pending.push({
        priority,
        sequence: this.sequence++,
        execute: async () => {
          try {
            resolve(await task())
          } catch (error) {
            reject(error)
          }
        },
      })
      this.pending.sort(
        (left, right) =>
          right.priority - left.priority || left.sequence - right.sequence
      )
      this.pump()
    })
  }

  private pump(): void {
    while (this.active < this.maxConcurrent && this.pending.length > 0) {
      const job = this.pending.shift()
      if (!job) return
      this.active += 1
      job.execute().finally(() => {
        this.active -= 1
        this.pump()
      })
    }
  }
}

const pdfPageRenderQueue = new PdfPageRenderQueue()

function buildCacheKey(
  sessionId: string,
  pageNumber: number,
  targetWidth: number
): string {
  return `${sessionId}:${pageNumber}:${targetWidth}`
}

class PdfPageRenderCache {
  private readonly entries = new Map<string, Promise<RenderedPdfPage>>()
  private readonly resolved = new Map<string, RenderedPdfPage>()

  clear(): void {
    for (const rendered of this.resolved.values()) {
      rendered.imageBitmap.close()
    }
    this.entries.clear()
    this.resolved.clear()
  }

  has(sessionId: string, pageNumber: number, targetWidth: number): boolean {
    return this.resolved.has(
      buildCacheKey(sessionId, pageNumber, targetWidth)
    )
  }

  getOrRender(
    sessionId: string,
    params: RenderPdfPageCanvasParams,
    priority = 0
  ): Promise<RenderedPdfPage> {
    const key = buildCacheKey(sessionId, params.pageNumber, params.targetWidth)
    const cached = this.resolved.get(key)
    if (cached) return Promise.resolve(cached)

    const existing = this.entries.get(key)
    if (existing) return existing

    const promise = pdfPageRenderQueue
      .run(() => renderPdfPage(params), priority)
      .then((rendered) => {
        this.resolved.set(key, rendered)
        return rendered
      })
    this.entries.set(key, promise)
    promise.catch(() => {
      if (this.entries.get(key) === promise) {
        this.entries.delete(key)
      }
    })
    return promise
  }
}

export const pdfPageRenderCache = new PdfPageRenderCache()

export function computePdfPreviewTargetWidth(
  containerWidth: number,
  scale = 1,
  maxWidth = 1800
): number {
  const width = Math.floor(containerWidth - 16)
  return Math.min(
    maxWidth,
    Math.max(260, Math.max(240, width) * scale)
  )
}

function createBlankPageReviewOutputScale(): pdfjsLib.OutputScale {
  const outputScale = new pdfjsLib.OutputScale()
  const cappedRatio = Math.min(
    pdfjsLib.OutputScale.pixelRatio,
    BLANK_PAGE_REVIEW_MAX_PIXEL_RATIO
  )
  outputScale.sx = cappedRatio
  outputScale.sy = cappedRatio
  return outputScale
}

export async function renderPdfPage({
  pdfDocument,
  pageNumber,
  targetWidth,
  optionalContentConfigPromise = null,
}: RenderPdfPageCanvasParams): Promise<RenderedPdfPage> {
  const page = await pdfDocument.getPage(pageNumber)
  const baseViewport = page.getViewport({ scale: 1 })
  const scale = targetWidth / (baseViewport.width * PDF_TO_CSS_UNITS)
  const viewport = page.getViewport({
    scale: scale * PDF_TO_CSS_UNITS,
  })
  const outputScale = createBlankPageReviewOutputScale()
  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d", { alpha: false })
  if (!context) {
    throw new Error("Trình duyệt không hỗ trợ canvas 2D.")
  }

  const cssWidth = Math.floor(viewport.width)
  const cssHeight = Math.floor(viewport.height)
  canvas.width = Math.floor(viewport.width * outputScale.sx)
  canvas.height = Math.floor(viewport.height * outputScale.sy)

  const renderTask = page.render({
    canvas,
    canvasContext: context,
    viewport,
    transform: outputScale.scaled
      ? [outputScale.sx, 0, 0, outputScale.sy, 0, 0]
      : undefined,
    optionalContentConfigPromise: optionalContentConfigPromise ?? undefined,
  })
  await renderTask.promise

  const imageBitmap = await createImageBitmap(canvas)
  canvas.width = 0
  canvas.height = 0

  return {
    imageBitmap,
    cssWidth,
    cssHeight,
    aspectRatio: cssWidth / cssHeight,
  }
}

export function createCanvasFromRenderedPage(
  rendered: RenderedPdfPage,
  options?: { fitContainer?: boolean }
): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.className = "block h-auto w-full max-w-full rounded bg-white shadow"
  canvas.width = rendered.imageBitmap.width
  canvas.height = rendered.imageBitmap.height
  if (!options?.fitContainer) {
    canvas.style.width = `${rendered.cssWidth}px`
    canvas.style.height = `${rendered.cssHeight}px`
  }
  const context = canvas.getContext("2d", { alpha: false })
  if (!context) {
    throw new Error("Trình duyệt không hỗ trợ canvas 2D.")
  }
  context.drawImage(rendered.imageBitmap, 0, 0)
  return canvas
}

export function prefetchPdfPageNumbers({
  sessionId,
  pdfDocument,
  pageNumbers,
  targetWidth,
  optionalContentConfigPromise = null,
  basePriority = 10,
}: {
  sessionId: string
  pdfDocument: PDFDocumentProxy
  pageNumbers: number[]
  targetWidth: number
  optionalContentConfigPromise?: OptionalContentConfigPromise | null
  basePriority?: number
}): void {
  const uniquePages = [...new Set(pageNumbers)].sort((left, right) => left - right)
  for (const pageNumber of uniquePages) {
    void pdfPageRenderCache.getOrRender(
      sessionId,
      {
        pdfDocument,
        pageNumber,
        targetWidth,
        optionalContentConfigPromise,
      },
      basePriority + Math.max(0, 20 - pageNumber)
    )
  }
}

export function buildPrefetchWindow(
  anchorPages: Iterable<number>,
  pageCount: number,
  behind = 3,
  ahead = 14
): number[] {
  const pages = new Set<number>()
  for (let page = 1; page <= Math.min(6, pageCount); page += 1) {
    pages.add(page)
  }
  for (const anchorPage of anchorPages) {
    for (let offset = -behind; offset <= ahead; offset += 1) {
      const pageNumber = anchorPage + offset
      if (pageNumber >= 1 && pageNumber <= pageCount) {
        pages.add(pageNumber)
      }
    }
  }
  return [...pages].sort((left, right) => left - right)
}

export function isPdfRenderCancelled(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return /cancel/i.test(error.message)
}

export function cancelPdfRenderTask(task: RenderTask | null | undefined): void {
  task?.cancel()
}

export { pdfjsLib }
