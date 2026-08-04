export function canNavigateDirectlyToMetadata(
  hasArrangementPlan: boolean,
  hasRetentionSchedule: boolean
): boolean {
  return !hasArrangementPlan && !hasRetentionSchedule
}

export function shouldAnalyzePlanInputsAfterDataUpload({
  dataUploadSucceeded,
  planInputsReuploaded,
}: {
  dataUploadSucceeded: boolean
  planInputsReuploaded: boolean
}): boolean {
  return dataUploadSucceeded && planInputsReuploaded
}

export function resolvePlanInputsReuploaded({
  renderedState,
  arrangementCached,
  retentionCached,
}: {
  renderedState: boolean
  arrangementCached: boolean
  retentionCached: boolean
}): boolean {
  return renderedState || arrangementCached || retentionCached
}

export function planWorkflowActionLabel({
  hasPlanReady,
  hasArrangementPlan,
  hasRetentionSchedule,
}: {
  hasPlanReady: boolean
  hasArrangementPlan: boolean
  hasRetentionSchedule: boolean
}): string {
  if (hasPlanReady) return "Xem phương án phân loại"
  if (hasArrangementPlan && hasRetentionSchedule) {
    return "Phân tích phương án và thời hạn"
  }
  if (hasArrangementPlan) return "Phân tích phương án phân loại"
  if (hasRetentionSchedule) return "Phân tích thời hạn bảo quản"
  return "Chuyển sang Extract Metadata"
}
