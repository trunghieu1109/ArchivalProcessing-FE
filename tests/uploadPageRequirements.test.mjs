import assert from "node:assert/strict"
import test from "node:test"

import { missingDossierBuildInputs } from "../src/pages/UploadPage.requirements.ts"

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
