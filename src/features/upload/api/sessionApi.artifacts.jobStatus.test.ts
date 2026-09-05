import { afterEach, describe, expect, it, vi } from "vitest"

import { getFinalizeArtifactsStatus } from "./sessionApi.artifacts"

describe("getFinalizeArtifactsStatus compatibility", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("requests the latest finalize job without a job_id query", async () => {
    const payload = {
      session_id: "session-1",
      job_type: "finalize_artifacts",
      active: true,
      job: { id: 23, status: "running" },
      progress: null,
      result: null,
    }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(getFinalizeArtifactsStatus("session-1")).resolves.toEqual(
      payload
    )
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sessions/session-1/artifacts/finalize/status",
      {}
    )
  })
})
