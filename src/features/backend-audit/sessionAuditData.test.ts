import { describe, expect, it } from "vitest"

import type { AuditRequestResult } from "./backendAudit"
import {
  buildSessionAuditData,
  documentHasNumberedPdf,
  documentNeedsMetadataReview,
} from "./sessionAuditData"

function result(endpointId: string, data: unknown): AuditRequestResult {
  return {
    endpointId,
    endpointTitle: endpointId,
    path: `/api/${endpointId}`,
    url: `https://example.test/api/${endpointId}`,
    requestedAt: "2026-10-03T00:00:00Z",
    status: 200,
    statusText: "OK",
    ok: true,
    durationMs: 10,
    sizeBytes: 100,
    headers: {},
    data,
    error: null,
  }
}

describe("session audit data", () => {
  it("derives document review, metadata versions and numbered PDF coverage", () => {
    const reviewed = {
      session_document_id: 1,
      file_name: "done.pdf",
      record: { review_status: "verified", metadata_verified_at: "2026-10-03" },
      metadata: { versions: [{ id: 1 }, { id: 2 }] },
      pdfs: { numbered: { available: true, version_id: "pdf-v2" } },
    }
    const pending = {
      session_document_id: 2,
      file_name: "pending.pdf",
      record: { review_status: "pending", metadata_ready: true },
      metadata: { versions: [{ id: 3 }] },
    }
    const data = buildSessionAuditData("session-1", {
      "backup-documents": result("backup-documents", {
        pagination: { total: 7 },
        documents: [reviewed, pending],
      }),
    })

    expect(data.documentTotal).toBe(7)
    expect(data.metadataVersionCount).toBe(3)
    expect(data.pendingMetadataDocuments).toEqual([pending])
    expect(data.numberedDocumentCount).toBe(1)
    expect(documentNeedsMetadataReview(reviewed)).toBe(false)
    expect(documentHasNumberedPdf(reviewed)).toBe(true)
  })

  it("prefers complete core drafts and collects jobs exposed by scoped APIs", () => {
    const data = buildSessionAuditData("session-1", {
      "backup-core": result("backup-core", {
        dossier_formation: { dossier_drafts: [{ id: 1 }, { id: 2 }] },
        numbering: { document_versions: [{ id: 10, session_document_id: 4 }] },
      }),
      "dossier-drafts": result("dossier-drafts", { drafts: [{ id: 1 }] }),
      "session-detail": result("session-detail", {
        active_plan_analysis_job: { id: 20, status: "running" },
      }),
      "cluster-build": result("cluster-build", {
        job: { id: 21, job_type: "build_clusters", status: "queued" },
      }),
      "numbering-status": result("numbering-status", {
        active_jobs: [{ id: 22, status: "running" }],
      }),
    })

    expect(data.dossierDrafts).toHaveLength(2)
    expect(data.numberingDocumentVersions).toHaveLength(1)
    expect(data.relatedJobs.map((job) => job.id)).toEqual([20, 21, 22])
    expect(data.relatedJobs[0]?.job_type).toBe("analyze_plan")
    expect(data.relatedJobs[2]?.job_type).toBe("number_documents")
  })
})
