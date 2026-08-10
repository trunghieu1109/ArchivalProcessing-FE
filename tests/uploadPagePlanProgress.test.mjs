import assert from "node:assert/strict"
import test from "node:test"

import {
  isPlanAnalysisEventForJob,
  normalizePlanProgressPhase,
  planAnalysisFailureDomain,
  planAnalysisFailureFromEvent,
  planAnalysisFailureMessage,
  planAnalysisResultVersionId,
  planAnalysisScopeForInputs,
  planAnalysisTerminalState,
  shouldApplyPlanAnalysisResult,
} from "../src/pages/UploadPage.progress.ts"

test("ánh xạ phase lập chỉ mục THBQ vào bước thời hạn bảo quản", () => {
  assert.equal(
    normalizePlanProgressPhase("retention_indexing"),
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

test("shows the backend plan analysis error", () => {
  assert.equal(
    planAnalysisFailureMessage(
      { error: "Không tìm thấy nhóm phân loại." },
      "Job failed"
    ),
    "Không tìm thấy nhóm phân loại."
  )
})

test("builds a persistent failure state with exhausted retry details", () => {
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

test("phân biệt scope PAPL, THBQ và combined từ input FE", () => {
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

test("gắn lỗi vào đúng phần PAPL hoặc THBQ", () => {
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

test("ánh xạ phase tạo phiên bản THBQ vào bước thời hạn bảo quản", () => {
  assert.equal(
    normalizePlanProgressPhase("retention_candidate_versions"),
    "retention_period"
  )
})

test("chấp nhận event có job_id số hoặc chuỗi khớp job hiện tại", () => {
  assert.equal(isPlanAnalysisEventForJob({ job_id: 42 }, 42), true)
  assert.equal(isPlanAnalysisEventForJob({ job_id: "42" }, 42), true)
})

test("bỏ qua event của job cũ", () => {
  assert.equal(isPlanAnalysisEventForJob({ job_id: 41 }, 42), false)
})

test("bỏ qua event khi chưa biết job hiện tại hoặc event thiếu job_id", () => {
  assert.equal(isPlanAnalysisEventForJob({ job_id: 42 }, null), false)
  assert.equal(isPlanAnalysisEventForJob({}, 42), false)
})

test("đọc phiên bản kết quả từ event completed", () => {
  assert.equal(
    planAnalysisResultVersionId({ plan_version_id: "plan-v2" }),
    "plan-v2"
  )
  assert.equal(planAnalysisResultVersionId({ plan_version_id: 12 }), "12")
  assert.equal(planAnalysisResultVersionId({}), "")
})

test("hoàn tất sau reload khi working plan đã là kết quả của job", () => {
  assert.equal(
    shouldApplyPlanAnalysisResult({
      currentPlanVersionId: "plan-v2",
      nextPlanVersionId: "plan-v2",
      completedPlanVersionId: "plan-v2",
    }),
    true
  )
})

test("không kết luận hoàn tất với working plan cũ trước event completed", () => {
  assert.equal(
    shouldApplyPlanAnalysisResult({
      currentPlanVersionId: "plan-v1",
      nextPlanVersionId: "plan-v1",
      completedPlanVersionId: "",
    }),
    false
  )
})
