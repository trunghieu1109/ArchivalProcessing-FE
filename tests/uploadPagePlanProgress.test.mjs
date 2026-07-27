import assert from "node:assert/strict"
import test from "node:test"

import {
  isPlanAnalysisEventForJob,
  normalizePlanProgressPhase,
  planAnalysisResultVersionId,
  shouldApplyPlanAnalysisResult,
} from "../src/pages/UploadPage.progress.ts"

test("ánh xạ phase lập chỉ mục THBQ vào bước thời hạn bảo quản", () => {
  assert.equal(
    normalizePlanProgressPhase("retention_indexing"),
    "retention_period"
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
