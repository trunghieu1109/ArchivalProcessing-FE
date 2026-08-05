import assert from "node:assert/strict"
import test from "node:test"

import {
  hasExpertReviewedDocuments,
  missingDossierBuildInputs,
} from "../src/pages/UploadPage.requirements.ts"

test("không tính tài liệu tự động xác thực là đầu vào lập hồ sơ", () => {
  assert.equal(
    hasExpertReviewedDocuments({
      reviewedCount: 0,
      documents: [
        {
          metadata_ready: true,
          is_reviewed: false,
          review_status: "verified",
        },
      ],
    }),
    false
  )
})

test("tính tài liệu đã được chuyên gia xác thực là đầu vào lập hồ sơ", () => {
  assert.equal(
    hasExpertReviewedDocuments({
      reviewedCount: 0,
      documents: [{ metadata_ready: true, is_reviewed: true }],
    }),
    true
  )
})

test("không chặn lập hồ sơ chỉ vì cache cây active plan không có dữ liệu", () => {
  assert.deepEqual(
    missingDossierBuildInputs({
      hasArrangementPlan: true,
      hasRetentionSchedule: true,
      hasVerifiedDocuments: true,
      hasActivePlan: true,
    }),
    []
  )
})

test("vẫn chặn khi chưa có active plan", () => {
  assert.deepEqual(
    missingDossierBuildInputs({
      hasArrangementPlan: true,
      hasRetentionSchedule: true,
      hasVerifiedDocuments: true,
      hasActivePlan: false,
    }),
    ["active_plan"]
  )
})

test("vẫn chặn khi chưa có tài liệu đã xác thực", () => {
  assert.deepEqual(
    missingDossierBuildInputs({
      hasArrangementPlan: true,
      hasRetentionSchedule: true,
      hasVerifiedDocuments: false,
      hasActivePlan: true,
    }),
    ["verified_documents"]
  )
})
