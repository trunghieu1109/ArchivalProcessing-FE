import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const source = readFileSync("src/pages/UploadPage.view.tsx", "utf8")

test("keeps arrangement, retention, and review actions as separate sections", () => {
  assert.match(source, /hasArrangementPlanResult/)
  assert.match(source, /hasRetentionAnalysisResult/)
  assert.match(source, /showRetentionSection=\{false\}/)
  assert.match(source, /showActions=\{false\}/)
  assert.match(source, /<RetentionAppendicesPanel/)
  assert.match(source, /<PlanReviewActions/)
})

test("routes failure state to the matching analysis domain", () => {
  assert.match(source, /planAnalysisFailureDomain/)
  assert.match(source, /failedDomain === "plan"/)
  assert.match(source, /failedDomain === "retention"/)
})
