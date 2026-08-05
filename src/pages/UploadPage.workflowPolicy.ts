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
