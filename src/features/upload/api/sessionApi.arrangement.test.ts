import { afterEach, describe, expect, it, vi } from "vitest"

import {
  getClusteringPendingDocuments,
  listSupplementalIntakes,
  prepareSupplementalIntake,
  sortDossierDocuments,
  validateSupplementalClassificationPath,
} from "./sessionApi.arrangement"

describe("supplemental intake API", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("prepares an intake using the session-scoped endpoint", async () => {
    const payload = { intake_id: "intake-1" }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    await prepareSupplementalIntake("session one", {
      client_request_id: "request-1",
      intake_mode: "existing_dossier",
      base_cluster_version_id: "version-1",
      target_dossier_id: "dossier/1",
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("/api/sessions/session%20one/supplemental-intakes")
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body)).toMatchObject({
      intake_mode: "existing_dossier",
      target_dossier_id: "dossier/1",
    })
  })

  it("lists active intake documents for reload recovery", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    await listSupplementalIntakes("session-1", {
      status: "active",
      includeDocuments: true,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sessions/session-1/supplemental-intakes?status=active&include_documents=true",
      { cache: "no-store" }
    )
  })

  it("validates a TH3 path before reserving the intake", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ valid: true, resolved_path: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    await validateSupplementalClassificationPath("session-1", {
      base_plan_version_id: "plan-1",
      classification_path: [
        {
          kind: "new",
          client_group_id: "year-2025",
          type: "year",
          name: "Năm 2025",
        },
      ],
    })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("/api/sessions/session-1/classification-paths/validate")
    expect(JSON.parse(init.body)).toMatchObject({
      base_plan_version_id: "plan-1",
      classification_path: [{ kind: "new", name: "Năm 2025" }],
    })
  })

  it("sends a snapshot-based document sort request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "completed" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    await sortDossierDocuments(
      "session-1",
      "dossier/1",
      "cluster_dossier",
      "version-3"
    )

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(
      "/api/sessions/session-1/dossiers/dossier%2F1/documents/sort"
    )
    expect(JSON.parse(init.body)).toMatchObject({
      dossier_kind: "cluster_dossier",
      base_cluster_version_id: "version-3",
      strategy: "chronological",
      created_by: "ui",
    })
  })

  it("reads the current clustering-pending response contract", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          session_id: "session-1",
          active_cluster_version_id: "version-1",
          summary: {
            pending_document_count: 1,
            has_pending_documents: true,
            can_update_dossiers: false,
            blocked_reasons: ["cluster_build_in_progress"],
          },
          items: [
            {
              session_document_id: 501,
              document_id: "doc-501",
              file_name: "document.pdf",
              dossier_id: "dossier-1",
              supplemental_intake_id: "intake-1",
              arrangement_status: "active",
              review_status: "verified",
              metadata_ready: true,
              metadata_verified_at: "2026-09-24T10:00:00+00:00",
              pending_reason: "not_in_active_cluster_version",
            },
          ],
          page: { limit: 200, next_after_id: null, has_more: false },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    )
    vi.stubGlobal("fetch", fetchMock)

    const response = await getClusteringPendingDocuments("session-1")

    expect(response.summary.blocked_reasons).toEqual([
      "cluster_build_in_progress",
    ])
    expect(response.items[0]?.session_document_id).toBe(501)
    expect(response.page).toEqual({
      limit: 200,
      next_after_id: null,
      has_more: false,
    })
  })

  it("normalizes the legacy flat clustering-pending response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          session_id: "session-1",
          active_cluster_version_id: null,
          has_pending_documents: true,
          can_update_dossiers: true,
          count: 1,
          documents: [
            {
              session_document_id: 502,
              document_id: "doc-502",
              file_name: "legacy.pdf",
              dossier_id: "dossier-2",
              supplemental_intake_id: "intake-2",
              arrangement_status: "active",
              review_status: "verified",
              metadata_ready: true,
              metadata_verified_at: null,
              pending_reason: "not_in_active_cluster_version",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    )
    vi.stubGlobal("fetch", fetchMock)

    const response = await getClusteringPendingDocuments("session-1")

    expect(response.summary).toEqual({
      pending_document_count: 1,
      has_pending_documents: true,
      can_update_dossiers: true,
      blocked_reasons: [],
    })
    expect(response.items[0]?.session_document_id).toBe(502)
  })
})
