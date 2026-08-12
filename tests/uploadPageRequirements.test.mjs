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

test("an approved backend plan is not blocked by an empty frontend plan cache", () => {
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

test("dossier build still reports authoritative missing inputs", () => {
  assert.deepEqual(
    missingDossierBuildInputs({
      hasArrangementPlan: true,
      hasRetentionSchedule: false,
      hasVerifiedDocuments: false,
      hasActivePlan: false,
    }),
    ["active_plan", "retention_schedule", "verified_documents"]
  )
})
