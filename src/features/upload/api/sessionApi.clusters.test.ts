import { afterEach, describe, expect, it, vi } from "vitest"

import {
  getClusterVersionChanges,
  listSessionDossierRetentionCandidates,
  listUnclassifiedSessionDossiers,
  classifyUnclassifiedSessionDossiers,
} from "./sessionApi.clusters"

describe("listUnclassifiedSessionDossiers", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("requests only dossiers that have not entered a cluster version", async () => {
    const payload = {
      session_id: "session one",
      scope: "unclassified",
      cluster_version_id: null,
      version_number: null,
      dossiers: [],
    }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      listUnclassifiedSessionDossiers("session one")
    ).resolves.toEqual(payload)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sessions/session%20one/dossiers?scope=unclassified",
      { cache: "no-store" }
    )
  })
})

describe("classifyUnclassifiedSessionDossiers", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("omits dossier_ids so the backend updates the complete waiting folder", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ selected_dossier_count: 2 }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    await classifyUnclassifiedSessionDossiers("session one")

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sessions/session%20one/unclassified-dossiers/classify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }
    )
  })
})

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

describe("getClusterVersionChanges", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("uses the target's previous version when against is omitted", async () => {
    const payload = {
      session_id: "session one",
      from: {
        cluster_version_id: "v1",
        version_number: 1,
        plan_version_id: null,
      },
      to: {
        cluster_version_id: "version/2",
        version_number: 2,
        plan_version_id: null,
        source: "feedback_rebuild",
      },
      summary: {
        created_group_count: 0,
        removed_group_count: 0,
        changed_dossier_count: 0,
        changed_document_count: 0,
      },
      classification_groups: [],
      dossiers: [],
      documents: [],
      affected_tree_paths: [],
      created_at: "2026-09-12T00:00:00Z",
    }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      getClusterVersionChanges("session one", "version/2")
    ).resolves.toEqual(payload)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sessions/session%20one/clusters/versions/version%2F2/changes",
      { cache: "no-store" }
    )
  })

  it("sends an explicit comparison version", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response("{}", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    vi.stubGlobal("fetch", fetchMock)

    await getClusterVersionChanges("session", "v2", "version one")
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sessions/session/clusters/versions/v2/changes?against=version+one",
      { cache: "no-store" }
    )
  })
})
