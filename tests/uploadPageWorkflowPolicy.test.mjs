import assert from "node:assert/strict"
import test from "node:test"

import {
  canNavigateDirectlyToMetadata,
  hasArrangementPlanResult,
  hasRetentionAnalysisResult,
  planWorkflowActionLabel,
  resolveExistingPlanAnalysisAction,
  resolvePlanAnalysisInputSelection,
  resolvePlanInputsReuploaded,
  shouldAnalyzePlanInputsAfterDataUpload,
} from "../src/pages/UploadPage.workflowPolicy.ts"

test("retention-only result is not presented as an arrangement plan", () => {
  assert.equal(
    hasArrangementPlanResult({ workingGroupCount: 0, activeGroupCount: 0 }),
    false
  )
  assert.equal(
    hasRetentionAnalysisResult({ appendixCount: 1, sourceCount: 1 }),
    true
  )
})

test("a retention-only reupload does not implicitly analyze a stale arrangement plan", () => {
  assert.deepEqual(
    resolvePlanAnalysisInputSelection({
      arrangementReuploaded: false,
      retentionReuploaded: true,
      hasPlanReady: false,
      hasArrangementPlan: true,
      hasRetentionSchedule: true,
    }),
    { analyzeArrangement: false, analyzeRetention: true }
  )
})

test("stored inputs are both analyzed when no new input was uploaded and no plan is ready", () => {
  assert.deepEqual(
    resolvePlanAnalysisInputSelection({
      arrangementReuploaded: false,
      retentionReuploaded: false,
      hasPlanReady: false,
      hasArrangementPlan: true,
      hasRetentionSchedule: true,
    }),
    { analyzeArrangement: true, analyzeRetention: true }
  )
})

test("explicitly reuploading both plan inputs selects combined analysis", () => {
  assert.deepEqual(
    resolvePlanAnalysisInputSelection({
      arrangementReuploaded: true,
      retentionReuploaded: true,
      hasPlanReady: true,
      hasArrangementPlan: true,
      hasRetentionSchedule: true,
    }),
    { analyzeArrangement: true, analyzeRetention: true }
  )
})

test("ưu tiên xem phương án khi đã có phương án sẵn sàng", () => {
  assert.equal(
    planWorkflowActionLabel({
      hasPlanReady: true,
      hasArrangementPlan: true,
      hasRetentionSchedule: true,
    }),
    "Xem phương án phân loại"
  )
})

test("reanalyzes a newly uploaded plan before viewing the old running job", () => {
  assert.equal(
    resolveExistingPlanAnalysisAction({
      planInputsReuploaded: true,
      planAnalysisProcessing: true,
      hasPlanInput: true,
      hasPlanReady: false,
    }),
    "reanalyze"
  )
})

test("views current progress when no plan input was reuploaded", () => {
  assert.equal(
    resolveExistingPlanAnalysisAction({
      planInputsReuploaded: false,
      planAnalysisProcessing: true,
      hasPlanInput: true,
      hasPlanReady: false,
    }),
    "view_progress"
  )
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

test("hiển thị hành động phân tích cả PAPL và THBQ", () => {
  assert.equal(
    planWorkflowActionLabel({
      hasPlanReady: false,
      hasArrangementPlan: true,
      hasRetentionSchedule: true,
    }),
    "Phân tích phương án và thời hạn"
  )
})

test("hiển thị hành động phân tích PAPL khi chỉ có PAPL", () => {
  assert.equal(
    planWorkflowActionLabel({
      hasPlanReady: false,
      hasArrangementPlan: true,
      hasRetentionSchedule: false,
    }),
    "Phân tích phương án phân loại"
  )
})

test("hiển thị hành động phân tích THBQ khi chỉ có THBQ", () => {
  assert.equal(
    planWorkflowActionLabel({
      hasPlanReady: false,
      hasArrangementPlan: false,
      hasRetentionSchedule: true,
    }),
    "Phân tích thời hạn bảo quản"
  )
})

test("chỉ chuyển thẳng sang metadata khi không có PAPL và THBQ", () => {
  assert.equal(canNavigateDirectlyToMetadata(false, false), true)
  assert.equal(canNavigateDirectlyToMetadata(true, false), false)
  assert.equal(canNavigateDirectlyToMetadata(false, true), false)
  assert.equal(
    planWorkflowActionLabel({
      hasPlanReady: false,
      hasArrangementPlan: false,
      hasRetentionSchedule: false,
    }),
    "Chuyển sang Extract Metadata"
  )
})
