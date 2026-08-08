import { afterEach, describe, expect, it, vi } from "vitest"

import { getFinalizeArtifactsStatus } from "./sessionApi.artifacts"

describe("getFinalizeArtifactsStatus", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("loads the finalize status contract used by the resume and polling UI", async () => {
    const payload = {
      session_id: "session one",
      job_type: "finalize_artifacts",
      active: true,
      job: { id: 17, status: "running" },
      progress: { event_id: 21, job_id: 17, phase: "writing_manifest" },
      result: null,
      revision: 1,
      documents_revision: 1,
      updated_at: "2026-08-05T00:00:00+00:00",
      last_event_id: 21,
    }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(getFinalizeArtifactsStatus("session one")).resolves.toEqual(
      payload
    )
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sessions/session%20one/artifacts/finalize/status",
      {}
    )
  })
})
