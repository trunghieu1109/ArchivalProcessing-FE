import { afterEach, describe, expect, it, vi } from "vitest"

import { listSessionDossierRetentionCandidates } from "./sessionApi.clusters"

describe("listSessionDossierRetentionCandidates", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("requests candidates from the cluster version being viewed", async () => {
    const payload = {
      session_id: "session one",
      dossier_id: "dossier/1",
      cluster_version_id: "cluster version 4",
      retention_recommendation: {},
      candidates: [],
      versions: [],
      active_candidate_version_id: null,
      candidate_count: 0,
      candidates_truncated: false,
    }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      listSessionDossierRetentionCandidates(
        "session one",
        "dossier/1",
        20,
        "cluster version 4"
      )
    ).resolves.toEqual(payload)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sessions/session%20one/dossiers/dossier%2F1/retention-candidates?limit=20&cluster_version_id=cluster+version+4",
      {}
    )
  })
})
