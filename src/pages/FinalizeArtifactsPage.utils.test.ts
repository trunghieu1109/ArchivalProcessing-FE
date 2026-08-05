import { describe, expect, it } from "vitest"

import { buildFinalizeProgressViewState } from "./FinalizeArtifactsPage.utils"

describe("buildFinalizeProgressViewState", () => {
  it("marks earlier phases complete while the current phase is active", () => {
    const state = buildFinalizeProgressViewState("writing_manifest", "running")

    expect(state.activePhase).toBe("writing_manifest")
    expect(state.failedPhase).toBeNull()
    expect([...state.completedPhases]).toEqual([
      "loading_data",
      "creating_xlsx",
    ])
  })

  it("marks every phase complete when the job is done", () => {
    const state = buildFinalizeProgressViewState("completed", "done")

    expect(state.activePhase).toBeNull()
    expect(state.failedPhase).toBeNull()
    expect([...state.completedPhases]).toEqual([
      "loading_data",
      "creating_xlsx",
      "writing_manifest",
      "completed",
    ])
  })

  it("keeps earlier phases complete and marks the failed phase", () => {
    const state = buildFinalizeProgressViewState("writing_manifest", "failed")

    expect(state.activePhase).toBeNull()
    expect(state.failedPhase).toBe("writing_manifest")
    expect([...state.completedPhases]).toEqual([
      "loading_data",
      "creating_xlsx",
    ])
  })

  it("does not infer progress for an unknown backend phase", () => {
    const state = buildFinalizeProgressViewState("future_phase", "running")

    expect(state.activePhase).toBeNull()
    expect(state.failedPhase).toBeNull()
    expect(state.completedPhases.size).toBe(0)
  })
})
