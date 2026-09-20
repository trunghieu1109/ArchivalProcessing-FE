import { afterEach, describe, expect, it, vi } from "vitest"

import {
  getFinalizeArtifactsStatus,
  getNumberingDocumentStatus,
  getNumberingDossierStatus,
} from "./sessionApi.artifacts"

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

describe("numbering scoped status clients", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("loads one document status by session document id", async () => {
    const payload = { session_id: "session one", document: {} }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      getNumberingDocumentStatus("session one", 17)
    ).resolves.toEqual(payload)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sessions/session%20one/numbering/documents/17/status",
      {}
    )
  })

  it("loads a dossier status with document pagination", async () => {
    const payload = { session_id: "session one", dossier: {}, documents: [] }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      getNumberingDossierStatus("session one", "dossier/A", {
        limit: 20,
        offset: 40,
      })
    ).resolves.toEqual(payload)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sessions/session%20one/numbering/dossiers/dossier%2FA/status?limit=20&offset=40",
      {}
    )
  })
})
