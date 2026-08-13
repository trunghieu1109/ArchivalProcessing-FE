export type ExistingSessionWorkflowAction =
  | "monitor_plan_analysis"
  | "analyze_plan"
  | "view_plan"
  | "extract_metadata"

export interface ExistingSessionWorkflowState {
  hasPlanInputs: boolean
  planInputsChanged: boolean
  planAnalysisRunning: boolean
  hasPlanAnalysisResult: boolean
}

export function resolveExistingSessionWorkflowAction({
  hasPlanInputs,
  planInputsChanged,
  planAnalysisRunning,
  hasPlanAnalysisResult,
}: ExistingSessionWorkflowState): ExistingSessionWorkflowAction {
  if (!hasPlanInputs) return "extract_metadata"
  if (planAnalysisRunning) return "monitor_plan_analysis"
  if (planInputsChanged || !hasPlanAnalysisResult) return "analyze_plan"
  return "view_plan"
}

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

export function hasArrangementPlanResult({
  workingGroupCount,
  activeGroupCount,
}: {
  workingGroupCount: number
  activeGroupCount: number
}): boolean {
  return workingGroupCount > 0 || activeGroupCount > 0
}

export function hasRetentionAnalysisResult({
  appendixCount,
  sourceCount,
}: {
  appendixCount: number
  sourceCount: number
}): boolean {
  return appendixCount > 0 || sourceCount > 0
}

export function resolvePlanAnalysisInputSelection({
  arrangementReuploaded,
  retentionReuploaded,
  hasPlanReady,
  hasArrangementPlan,
  hasRetentionSchedule,
}: {
  arrangementReuploaded: boolean
  retentionReuploaded: boolean
  hasPlanReady: boolean
  hasArrangementPlan: boolean
  hasRetentionSchedule: boolean
}): { analyzeArrangement: boolean; analyzeRetention: boolean } {
  const hasExplicitReupload = arrangementReuploaded || retentionReuploaded
  if (hasExplicitReupload) {
    return {
      analyzeArrangement: arrangementReuploaded,
      analyzeRetention: retentionReuploaded,
    }
  }
  if (hasPlanReady) {
    return { analyzeArrangement: false, analyzeRetention: false }
  }
  return {
    analyzeArrangement: hasArrangementPlan,
    analyzeRetention: hasRetentionSchedule,
  }
}

export type ExistingPlanAnalysisAction = "reanalyze" | "view_progress" | "none"

export function resolveExistingPlanAnalysisAction({
  planInputsReuploaded,
  planAnalysisProcessing,
  hasPlanInput,
  hasPlanReady,
}: {
  planInputsReuploaded: boolean
  planAnalysisProcessing: boolean
  hasPlanInput: boolean
  hasPlanReady: boolean
}): ExistingPlanAnalysisAction {
  if (planInputsReuploaded) return "reanalyze"
  if (planAnalysisProcessing && hasPlanInput) return "view_progress"
  if (!hasPlanReady && hasPlanInput) return "reanalyze"
  return "none"
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
