import assert from "node:assert/strict"
import test from "node:test"

import {
  canNavigateDirectlyToMetadata,
  resolveExistingSessionWorkflowAction,
  resolvePlanInputsReuploaded,
  shouldAnalyzePlanInputsAfterDataUpload,
} from "../src/pages/UploadPage.workflowPolicy.ts"

const baseState = {
  hasPlanInputs: true,
  planInputsChanged: false,
  planAnalysisRunning: false,
  hasPlanAnalysisResult: false,
}

test("existing session analyzes stored PAPL/THBQ before metadata", () => {
  assert.equal(
    resolveExistingSessionWorkflowAction(baseState),
    "analyze_plan"
  )
})

test("existing session analyzes re-uploaded PAPL/THBQ again", () => {
  assert.equal(
    resolveExistingSessionWorkflowAction({
      ...baseState,
      planInputsChanged: true,
      hasPlanAnalysisResult: true,
    }),
    "analyze_plan"
  )
})

test("existing session resumes an active plan analysis", () => {
  assert.equal(
    resolveExistingSessionWorkflowAction({
      ...baseState,
      planAnalysisRunning: true,
    }),
    "monitor_plan_analysis"
  )
})

test("existing session opens an available analysis result", () => {
  assert.equal(
    resolveExistingSessionWorkflowAction({
      ...baseState,
      hasPlanAnalysisResult: true,
    }),
    "view_plan"
  )
})

test("existing session without PAPL/THBQ goes to metadata", () => {
  assert.equal(
    resolveExistingSessionWorkflowAction({
      ...baseState,
      hasPlanInputs: false,
    }),
    "extract_metadata"
  )
})

test("raw upload can auto-navigate only when PAPL/THBQ are absent", () => {
  assert.equal(canNavigateDirectlyToMetadata(false, false), true)
  assert.equal(canNavigateDirectlyToMetadata(true, false), false)
  assert.equal(canNavigateDirectlyToMetadata(false, true), false)
  assert.equal(canNavigateDirectlyToMetadata(true, true), false)
})

test("analyzes retention inputs after a supplemental ZIP upload succeeds", () => {
  assert.equal(
    shouldAnalyzePlanInputsAfterDataUpload({
      dataUploadSucceeded: true,
      planInputsReuploaded: true,
    }),
    true
  )
})

test("uses the live cache when a retention upload completes during ZIP upload", () => {
  assert.equal(
    resolvePlanInputsReuploaded({
      renderedState: false,
      arrangementCached: false,
      retentionCached: true,
    }),
    true
  )
})

test("does not analyze after a ZIP-only or failed supplemental upload", () => {
  assert.equal(
    shouldAnalyzePlanInputsAfterDataUpload({
      dataUploadSucceeded: true,
      planInputsReuploaded: false,
    }),
    false
  )
  assert.equal(
    shouldAnalyzePlanInputsAfterDataUpload({
      dataUploadSucceeded: false,
      planInputsReuploaded: true,
    }),
    false
  )
})
