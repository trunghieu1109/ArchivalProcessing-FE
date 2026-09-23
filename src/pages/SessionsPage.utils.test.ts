import { describe, expect, it } from "vitest"

import { sessionMergeCardAction, sessionOpenTarget } from "./SessionsPage.utils"

describe("sessionOpenTarget", () => {
  it("opens a locked source through its merged session", () => {
    expect(
      sessionOpenTarget({
        session_id: "source-1",
        session_type: "standard",
        active_merged_session_id: "merge-1",
        active_merged_session_status: "pending",
      })
    ).toEqual({
      sessionId: "merge-1",
      path: "/sessions/merge-1/step/4",
    })
  })

  it("opens the source itself after it becomes source_changed", () => {
    expect(
      sessionOpenTarget({
        session_id: "source-1",
        session_type: "standard",
        active_merged_session_id: "merge-1",
        active_merged_session_status: "source_changed",
      })
    ).toEqual({
      sessionId: "source-1",
      path: "/sessions/source-1/step/1",
    })
  })

  it("opens a merged session on its merge workspace", () => {
    expect(
      sessionOpenTarget({
        session_id: "merge-1",
        session_type: "merged",
      })
    ).toEqual({
      sessionId: "merge-1",
      path: "/sessions/merge-1/step/4",
    })
  })
})

describe("sessionMergeCardAction", () => {
  it("shows sync for pending sources even after artifact creation", () => {
    expect(
      sessionMergeCardAction(
        {
          session_type: "merged",
          status: "artifact_ready",
        },
        ["pending", "pending"]
      )
    ).toBe("sync")
  })

  it("does not offer sync again after all sources were synced", () => {
    expect(
      sessionMergeCardAction(
        {
          session_type: "merged",
          status: "artifact_ready",
        },
        ["synced", "synced"]
      )
    ).toBeNull()
  })

  it("prioritizes refreshing when a source changed", () => {
    expect(
      sessionMergeCardAction(
        {
          session_type: "merged",
          status: "source_changed",
        },
        ["source_changed", "synced"]
      )
    ).toBe("refresh")
  })
})
