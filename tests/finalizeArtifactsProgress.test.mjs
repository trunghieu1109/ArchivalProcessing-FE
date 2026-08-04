import assert from "node:assert/strict"
import test from "node:test"

import {
  FINALIZE_PROGRESS_PHASES,
  buildFinalizeProgressViewState,
} from "../src/pages/FinalizeArtifactsPage.utils.ts"

test("ánh xạ phase finalize đang chạy vào timeline", () => {
  const state = buildFinalizeProgressViewState("writing_manifest", "running")

  assert.equal(state.activePhase, "writing_manifest")
  assert.equal(state.failedPhase, null)
  assert.deepEqual(
    [...state.completedPhases],
    ["loading_data", "creating_xlsx"]
  )
})

test("đánh dấu toàn bộ phase khi finalize hoàn tất", () => {
  const state = buildFinalizeProgressViewState("completed", "done")

  assert.equal(state.activePhase, null)
  assert.equal(state.failedPhase, null)
  assert.deepEqual(
    [...state.completedPhases],
    FINALIZE_PROGRESS_PHASES.map((phase) => phase.id)
  )
})

test("đánh dấu đúng phase cuối khi finalize thất bại", () => {
  const state = buildFinalizeProgressViewState("writing_manifest", "failed")

  assert.equal(state.activePhase, null)
  assert.equal(state.failedPhase, "writing_manifest")
  assert.deepEqual(
    [...state.completedPhases],
    ["loading_data", "creating_xlsx"]
  )
})
