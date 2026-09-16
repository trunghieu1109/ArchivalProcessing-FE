import { describe, expect, it } from "vitest"

import type { ClusterVersionResponse } from "@/features/upload/api/sessionApi"
import {
  selectApplicableDraftClusterVersion,
  shouldDisplayWorkingClusterVersion,
} from "./FinalResult.versionSelection"

function version(
  id: string,
  versionNumber: number,
  status: string,
  previousVersionId: string | null = null
): ClusterVersionResponse {
  return {
    id,
    session_id: "session-1",
    version_number: versionNumber,
    status,
    source: "test",
    previous_version_id: previousVersionId,
    plan_version_id: "plan-1",
    is_stale: false,
    summary: {},
    affected_clusters: [],
    batch_snapshot_count: 0,
    created_at: "2026-09-15T00:00:00Z",
    clusters: [],
  }
}

describe("cluster version selection", () => {
  it("ignores an older draft from the branch superseded by a newer active version", () => {
    const active = version("version-3", 3, "active", "version-1")
    const oldDraft = version("version-2", 2, "draft", "version-1")

    expect(
      selectApplicableDraftClusterVersion([active, oldDraft], active.id)
    ).toBeNull()
  })

  it("selects a draft created directly from the active version", () => {
    const active = version("version-3", 3, "active", "version-1")
    const pendingDraft = version("version-4", 4, "draft", active.id)

    expect(
      selectApplicableDraftClusterVersion([pendingDraft, active], active.id)?.id
    ).toBe(pendingDraft.id)
  })

  it("selects the latest draft even when it continues from another draft", () => {
    const active = version("version-3", 3, "active", "version-1")
    const workingDraft = version("version-5", 5, "draft", "version-4")

    expect(
      selectApplicableDraftClusterVersion(
        [workingDraft, active],
        active.id
      )?.id
    ).toBe(workingDraft.id)
  })

  it("keeps a draft with newer inputs as the working version", () => {
    const active = version("version-3", 3, "active", "version-1")
    const workingDraft = version("version-5", 5, "draft", active.id)
    workingDraft.is_stale = true
    workingDraft.stale_reason = "inputs_updated"

    expect(
      selectApplicableDraftClusterVersion([workingDraft, active], active.id)
        ?.id
    ).toBe(workingDraft.id)
  })

  it("selects the latest draft when the session has no active version yet", () => {
    const first = version("version-1", 1, "draft")
    const second = version("version-2", 2, "draft")

    expect(selectApplicableDraftClusterVersion([first, second], null)?.id).toBe(
      second.id
    )
  })

  it("opens the working draft when the screen is still showing the active baseline", () => {
    expect(
      shouldDisplayWorkingClusterVersion({
        activeClusterVersionId: "version-3",
        displayedClusterVersionId: "version-3",
        hasClusterData: true,
        workingClusterVersionId: "version-5",
      })
    ).toBe(true)
  })

  it("does not interrupt an explicitly selected historical version", () => {
    expect(
      shouldDisplayWorkingClusterVersion({
        activeClusterVersionId: "version-3",
        displayedClusterVersionId: "version-2",
        hasClusterData: true,
        workingClusterVersionId: "version-5",
      })
    ).toBe(false)
  })
})
