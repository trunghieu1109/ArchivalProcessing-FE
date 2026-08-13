import assert from "node:assert/strict"
import test from "node:test"

import {
  isPlanAnalysisEventForJob,
  normalizePlanProgressPhase,
  planAnalysisFailureDomain,
  planAnalysisFailureFromEvent,
  planAnalysisFailureMessage,
  planAnalysisEventBelongsToJob,
  planAnalysisResultVersionId,
  planAnalysisScopeForInputs,
  planAnalysisTerminalState,
  shouldApplyPlanAnalysisResult,
} from "../src/pages/UploadPage.progress.ts"

test("plan progress ignores events from an older analysis job", () => {
  assert.equal(planAnalysisEventBelongsToJob({ job_id: 41 }, 42), false)
  assert.equal(planAnalysisEventBelongsToJob({ job_id: 42 }, 42), true)
  assert.equal(planAnalysisEventBelongsToJob({ job_id: "42" }, 42), true)
  assert.equal(planAnalysisEventBelongsToJob(undefined, 42), false)
})

test("retention follow-up phases keep the timeline moving", () => {
  assert.equal(
    normalizePlanProgressPhase("retention_indexing"),
    "retention_period"
  )
  assert.equal(
    normalizePlanProgressPhase("retention_candidate_versions"),
    "retention_period"
  )
})

test("recognizes failed and superseded plan analysis terminal events", () => {
  assert.equal(planAnalysisTerminalState("job.failed"), "failed")
  assert.equal(
    planAnalysisTerminalState("plan.analysis.superseded"),
    "superseded"
  )
  assert.equal(planAnalysisTerminalState("job.retrying"), null)
})

test("keeps backend failure details and analysis scope", () => {
  assert.equal(
    planAnalysisFailureMessage(
      { error: "Không tìm thấy nhóm phân loại." },
      "Job failed"
    ),
    "Không tìm thấy nhóm phân loại."
  )
  assert.deepEqual(
    planAnalysisFailureFromEvent(
      {
        error: "Không tìm thấy nhóm phân loại.",
        retry_count: 3,
        max_attempts: 3,
      },
      "Failed job analyze_plan.",
      "classification_criteria",
      "plan"
    ),
    {
      message: "Không tìm thấy nhóm phân loại.",
      retryCount: 3,
      maxAttempts: 3,
      failedPhase: "classification_criteria",
      scope: "plan",
    }
  )
})

test("derives plan, retention and combined scopes from selected inputs", () => {
  assert.equal(
    planAnalysisScopeForInputs({ analyzePlan: true, analyzeRetention: false }),
    "plan"
  )
  assert.equal(
    planAnalysisScopeForInputs({ analyzePlan: false, analyzeRetention: true }),
    "retention"
  )
  assert.equal(
    planAnalysisScopeForInputs({ analyzePlan: true, analyzeRetention: true }),
    "combined"
  )
})

test("maps failures to the correct UI domain", () => {
  assert.equal(
    planAnalysisFailureDomain({
      message: "Retention failed",
      retryCount: 3,
      maxAttempts: 3,
      failedPhase: "preparing_plan_file",
      scope: "retention",
    }),
    "retention"
  )
  assert.equal(
    planAnalysisFailureDomain({
      message: "Combined failed while parsing retention",
      retryCount: 3,
      maxAttempts: 3,
      failedPhase: "retention_period",
      scope: "combined",
    }),
    "retention"
  )
})

test("reads job IDs and result version IDs without accepting old jobs", () => {
  assert.equal(isPlanAnalysisEventForJob({ job_id: 42 }, 42), true)
  assert.equal(isPlanAnalysisEventForJob({ job_id: "42" }, 42), true)
  assert.equal(isPlanAnalysisEventForJob({ job_id: 41 }, 42), false)
  assert.equal(planAnalysisResultVersionId({ plan_version_id: "plan-v2" }), "plan-v2")
  assert.equal(planAnalysisResultVersionId({}), "")
})

test("does not finish from the stale working plan before completed", () => {
  assert.equal(
    shouldApplyPlanAnalysisResult({
      currentPlanVersionId: "plan-v1",
      nextPlanVersionId: "plan-v1",
      completedPlanVersionId: "",
    }),
    false
  )
  assert.equal(
    shouldApplyPlanAnalysisResult({
      currentPlanVersionId: "plan-v2",
      nextPlanVersionId: "plan-v2",
      completedPlanVersionId: "plan-v2",
    }),
    true
  )
})
