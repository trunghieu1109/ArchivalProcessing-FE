import assert from "node:assert/strict"
import test from "node:test"

import {
  canNavigateDirectlyToMetadata,
  resolveExistingSessionWorkflowAction,
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
