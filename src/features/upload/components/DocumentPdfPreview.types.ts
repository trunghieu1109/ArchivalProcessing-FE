export interface PreviewVariantState {
  key: string
  label: string
  dataPath: string
  url: string
  status: string
  processingStatus: string
  error: string
  note: string
  sameAsOriginal: boolean
  blankPages: number[]
  removedPages: number[]
  sourcePageCount: number | null
  outputPageCount: number | null
}

export interface PreviewState {
  status: "idle" | "loading" | "ready" | "error"
  variants: PreviewVariantState[]
  activeVariantKey: string
  error: string
}
