import assert from "node:assert/strict"
import test from "node:test"

import { missingDossierBuildInputs } from "../src/pages/UploadPage.requirements.ts"

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
