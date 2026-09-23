import type { MergedSource } from "@/features/upload/api/mergeApi"

const REFRESH_COMPATIBLE_SOURCE_STATUSES = new Set([
  "synced",
  "source_changed",
])

export interface MergeFondsUiState {
  requiresRefresh: boolean
  canRefresh: boolean
  blocksDownstream: boolean
  statusLabel: string
}

export function mergeFondsUiState(
  sources: readonly Pick<MergedSource, "sync_status">[]
): MergeFondsUiState {
  const requiresRefresh = sources.some(
    (source) => source.sync_status === "source_changed"
  )
  const canRefresh =
    requiresRefresh &&
    sources.every((source) =>
      REFRESH_COMPATIBLE_SOURCE_STATUSES.has(source.sync_status)
    )
  const allSynced =
    sources.length > 0 &&
    sources.every((source) => source.sync_status === "synced")

  return {
    requiresRefresh,
    canRefresh,
    blocksDownstream: requiresRefresh,
    statusLabel: requiresRefresh
      ? "Cần cập nhật từ phông nguồn"
      : allSynced
        ? "Đã đồng bộ"
        : "Đang xử lý tại phông gộp",
  }
}
