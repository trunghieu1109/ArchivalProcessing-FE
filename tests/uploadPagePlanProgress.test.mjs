import assert from "node:assert/strict"
import test from "node:test"

import {
  normalizePlanProgressPhase,
  planAnalysisEventBelongsToJob,
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
