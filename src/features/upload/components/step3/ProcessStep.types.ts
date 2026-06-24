import type { PdfMetadata } from "@/features/upload/types"

export type MetadataReviewMode = "list" | "batch"
export type MetadataBatchMode = "auto" | "manual"

export interface MetadataBatchGroup {
  index: number
  kind: "auto" | "manual" | "reviewed" | "unassigned"
  batchId?: string | null
  label: string
  start: number
  end: number
  items: PdfMetadata[]
  readyCount: number
  reviewedCount: number
  warningCount: number
  pendingReadyCount: number
  assigneeName?: string | null
  assigneeEmail?: string | null
  assigneeUserId?: string | number | null
}

export interface MetadataActorIdentity {
  id: string
  email: string
  name: string
  isCoordinator: boolean
}

export interface MetadataServerPagination {
  total: number
  limit: number | null
  offset: number
  returned: number
  has_more: boolean
  next_offset?: number | null
}

export interface MetadataServerPaginationControls {
  pagination?: MetadataServerPagination | null
  pageIndex: number
  pageSize: number
  onPageChange: (pageIndex: number) => void
}

export const DEFAULT_METADATA_BATCH_SIZE = 25
export const MIN_METADATA_BATCH_SIZE = 5
export const MAX_METADATA_BATCH_SIZE = 1000
export const METADATA_BATCH_SIZE_OPTIONS = [25, 50, 100, 200, 500, 1000]
export const MAX_LOADING_PLACEHOLDERS = 12
export const REVIEW_MODE_STORAGE_KEY =
  "archival-processing.metadata-review-mode"
export const BATCH_SIZE_STORAGE_KEY =
  "archival-processing.metadata-review-batch-size"
export const EMPTY_METADATA_ITEMS: PdfMetadata[] = []
export const METADATA_REVIEWED_BATCH_ID = "metadata-reviewed"
export const LEGACY_METADATA_VERIFIED_BATCH_ID = "metadata-verified"
