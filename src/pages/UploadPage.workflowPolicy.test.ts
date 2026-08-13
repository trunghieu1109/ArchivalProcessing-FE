import { describe, expect, it } from "vitest"

import {
  hasArrangementPlanResult,
  hasRetentionAnalysisResult,
  resolveExistingPlanAnalysisAction,
  resolvePlanAnalysisInputSelection,
  resolvePlanInputsReuploaded,
  shouldAnalyzePlanInputsAfterDataUpload,
} from "./UploadPage.workflowPolicy"

describe("supplemental data upload workflow policy", () => {
  it("does not treat retention-only output as an arrangement result", () => {
    expect(
      hasArrangementPlanResult({ workingGroupCount: 0, activeGroupCount: 0 })
    ).toBe(false)
    expect(
      hasRetentionAnalysisResult({ appendixCount: 1, sourceCount: 1 })
    ).toBe(true)
  })

  it("selects only retention for a retention-only reupload", () => {
    expect(
      resolvePlanAnalysisInputSelection({
        arrangementReuploaded: false,
        retentionReuploaded: true,
        hasPlanReady: false,
        hasArrangementPlan: true,
        hasRetentionSchedule: true,
      })
    ).toEqual({ analyzeArrangement: false, analyzeRetention: true })
  })

  it("does not reanalyze stored inputs when a plan is already ready", () => {
    expect(
      resolvePlanAnalysisInputSelection({
        arrangementReuploaded: false,
        retentionReuploaded: false,
        hasPlanReady: true,
        hasArrangementPlan: true,
        hasRetentionSchedule: true,
      })
    ).toEqual({ analyzeArrangement: false, analyzeRetention: false })
  })

  it("prefers reanalysis after an explicit upload over the old job", () => {
    expect(
      resolveExistingPlanAnalysisAction({
        planInputsReuploaded: true,
        planAnalysisProcessing: true,
        hasPlanInput: true,
        hasPlanReady: false,
      })
    ).toBe("reanalyze")
  })

  it("resumes progress when an existing job is still running", () => {
    expect(
      resolveExistingPlanAnalysisAction({
        planInputsReuploaded: false,
        planAnalysisProcessing: true,
        hasPlanInput: true,
        hasPlanReady: false,
      })
    ).toBe("view_progress")
  })

  it("analyzes re-uploaded plan inputs after data upload succeeds", () => {
    expect(
      shouldAnalyzePlanInputsAfterDataUpload({
        dataUploadSucceeded: true,
        planInputsReuploaded: true,
      })
    ).toBe(true)
  })

  it("uses the live cache when React render state is stale", () => {
    expect(
      resolvePlanInputsReuploaded({
        renderedState: false,
        arrangementCached: false,
        retentionCached: true,
      })
    ).toBe(true)
  })

  it("does not analyze ZIP-only or failed supplemental uploads", () => {
    expect(
      shouldAnalyzePlanInputsAfterDataUpload({
        dataUploadSucceeded: true,
        planInputsReuploaded: false,
      })
    ).toBe(false)
    expect(
      shouldAnalyzePlanInputsAfterDataUpload({
        dataUploadSucceeded: false,
        planInputsReuploaded: true,
      })
    ).toBe(false)
  })
})
