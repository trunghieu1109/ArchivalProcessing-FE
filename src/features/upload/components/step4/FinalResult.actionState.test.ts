import { describe, expect, it } from "vitest"

import { resolveFinalResultActionState } from "./FinalResult.actionState"

const stable = {
  hasPendingClusterVersion: false,
  pendingClusterVersionStatus: null,
  pendingClusterVersionNeedsRefresh: false,
  pendingFeedbackCount: 0,
  supplementalVerificationPendingCount: 0,
  supplementalPendingDocumentCount: 0,
  supplementalPendingUpdateDocumentCount: 0,
  clusterVersionStale: false,
  busy: false,
  viewingHistoricalClusterVersion: false,
  hasSession: true,
  totalFiles: 10,
  totalDossiers: 3,
}

describe("final result action state", () => {
  it("blocks update, approval, and finish while a supplemental intake is incomplete", () => {
    const state = resolveFinalResultActionState({
      ...stable,
      hasPendingClusterVersion: true,
      pendingClusterVersionStatus: "draft",
      supplementalVerificationPendingCount: 1,
    })

    expect(state.canApprovePendingVersion).toBe(false)
    expect(state.canUpdateDossiers).toBe(false)
    expect(state.canFinish).toBe(false)
  })

  it("allows update but blocks approval when verified documents are missing from the draft", () => {
    const state = resolveFinalResultActionState({
      ...stable,
      hasPendingClusterVersion: true,
      pendingClusterVersionStatus: "draft",
      pendingClusterVersionNeedsRefresh: true,
      supplementalPendingDocumentCount: 2,
      supplementalPendingUpdateDocumentCount: 2,
    })

    expect(state.canUpdateDossiers).toBe(true)
    expect(state.canApprovePendingVersion).toBe(false)
    expect(state.canFinish).toBe(false)
  })

  it("allows update but blocks approval when feedback is newer than the draft", () => {
    const state = resolveFinalResultActionState({
      ...stable,
      hasPendingClusterVersion: true,
      pendingClusterVersionStatus: "draft",
      pendingFeedbackCount: 1,
    })

    expect(state.canUpdateDossiers).toBe(true)
    expect(state.canApprovePendingVersion).toBe(false)
  })

  it("allows feedback update while a supplemental intake is still awaiting verification", () => {
    const state = resolveFinalResultActionState({
      ...stable,
      hasPendingClusterVersion: true,
      pendingClusterVersionStatus: "draft",
      pendingFeedbackCount: 1,
      supplementalVerificationPendingCount: 1,
    })

    expect(state.canUpdateDossiers).toBe(true)
    expect(state.canApprovePendingVersion).toBe(false)
    expect(state.canFinish).toBe(false)
  })

  it("allows approval only after the current draft contains every change", () => {
    const state = resolveFinalResultActionState({
      ...stable,
      hasPendingClusterVersion: true,
      pendingClusterVersionStatus: "draft",
      supplementalPendingDocumentCount: 2,
      supplementalPendingUpdateDocumentCount: 0,
    })

    expect(state.canApprovePendingVersion).toBe(true)
    expect(state.showUpdateAction).toBe(true)
    expect(state.canUpdateDossiers).toBe(false)
    expect(state.canFinish).toBe(false)
  })

  it("enables update when active is missing verified documents and no draft exists", () => {
    const state = resolveFinalResultActionState({
      ...stable,
      supplementalPendingDocumentCount: 2,
      supplementalPendingUpdateDocumentCount: 2,
    })

    expect(state.canUpdateDossiers).toBe(true)
    expect(state.showUpdateAction).toBe(true)
    expect(state.canFinish).toBe(false)
  })

  it("allows finishing only for a stable active version", () => {
    const state = resolveFinalResultActionState(stable)

    expect(state.showUpdateAction).toBe(true)
    expect(state.canUpdateDossiers).toBe(false)
    expect(state.canFinish).toBe(true)
  })
})
