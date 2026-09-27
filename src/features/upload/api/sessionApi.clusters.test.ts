import { afterEach, describe, expect, it, vi } from "vitest"

import {
  addClustersToProvisionalDossier,
  getHomogeneousClusterNeighbors,
  getClusterVersionChanges,
  listSessionDossierRetentionCandidates,
  listUnclassifiedSessionDossiers,
  promoteAllProvisionalDossiers,
  promoteSelectedProvisionalDossiers,
  startHomogeneousClustering,
} from "./sessionApi.clusters"

describe("homogeneous dossier workflow", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("starts the homogeneous clustering workflow", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "queued" }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(startHomogeneousClustering("session one")).resolves.toEqual({
      status: "queued",
    })
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sessions/session%20one/homogeneous-clustering/build",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "homogeneous_cluster_review" }),
      }
    )
  })

  it("marks an explicit homogeneous rebuild as forced", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "queued" }), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    await startHomogeneousClustering("session one", { forceRebuild: true })

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sessions/session%20one/homogeneous-clustering/build",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "homogeneous_cluster_review",
          force_rebuild: true,
        }),
      }
    )
  })

  it("records every provisional dossier as pending an explicit update", async () => {
    const payload = {
      promoted_count: 2,
      pending_update: true,
      update_required: true,
    }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(promoteAllProvisionalDossiers("session/1")).resolves.toEqual(
      payload
    )
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sessions/session%2F1/provisional-dossiers/promote-all",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ created_by: "ui" }),
      }
    )
  })

  it("records selected provisional dossiers in one request", async () => {
    const payload = {
      promoted_count: 2,
      promoted_provisional_dossier_ids: [7, 9],
      pending_update: true,
      update_required: true,
    }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 202,
        headers: { "Content-Type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      promoteSelectedProvisionalDossiers("session/1", [7, 9])
    ).resolves.toEqual(payload)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sessions/session%2F1/provisional-dossiers/promote-selected",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provisional_dossier_ids: [7, 9],
          created_by: "ui",
        }),
      }
    )
  })

  it("loads the nearest homogeneous clusters with an explicit limit", async () => {
    const payload = {
      session_id: "session one",
      cluster_version_id: "version-1",
      cluster_id: "cluster/1",
      neighbors: [],
      provisional_dossiers: [],
    }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      getHomogeneousClusterNeighbors("session one", "cluster/1", 10)
    ).resolves.toEqual(payload)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sessions/session%20one/homogeneous-clusters/cluster%2F1/neighbors?limit=10",
      { cache: "no-store" }
    )
  })

  it("adds a group of clusters to one provisional dossier", async () => {
    const payload = { id: 7, status: "draft", clusters: [] }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      addClustersToProvisionalDossier("session one", 7, [
        "cluster-1",
        "cluster-2",
      ])
    ).resolves.toEqual(payload)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sessions/session%20one/provisional-dossiers/7/clusters",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cluster_ids: ["cluster-1", "cluster-2"] }),
      }
    )
  })
})

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
    const fetchMock = vi.fn().mockResolvedValue(
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
