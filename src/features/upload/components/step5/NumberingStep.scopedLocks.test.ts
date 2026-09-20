import { describe, expect, it } from "vitest"
import type {
  NumberingDocumentStatus,
  NumberingStatusResponse,
} from "@/features/upload/api/sessionApi"
import {
  isNumberingDocumentLocked,
  isNumberingDossierLocked,
} from "./NumberingStep.utils"

function statusWithLocks(
  ...locks: Array<{
    scope: "session" | "dossier" | "document"
    dossier_id?: string
    session_document_id?: number
  }>
): NumberingStatusResponse {
  return {
    session_id: "session-1",
    active: locks.length > 0,
    active_jobs: locks.map((lock, index) => ({
      id: index + 1,
      job_type: "number_documents",
      status: "running",
      retry_count: 0,
      payload: {},
      lock: { session_id: "session-1", ...lock },
    })),
    job: null,
  } as unknown as NumberingStatusResponse
}

function document(
  sessionDocumentId: number,
  dossierId: string
): NumberingDocumentStatus {
  return {
    session_document_id: sessionDocumentId,
    dossier_id: dossierId,
  } as NumberingDocumentStatus
}

describe("numbering scoped locks", () => {
  it("allows documents outside a document lock", () => {
    const status = statusWithLocks({
      scope: "document",
      dossier_id: "dossier-A",
      session_document_id: 11,
    })

    expect(isNumberingDocumentLocked(status, document(11, "dossier-A"))).toBe(
      true
    )
    expect(isNumberingDocumentLocked(status, document(12, "dossier-A"))).toBe(
      false
    )
  })

  it("locks only documents in an active dossier", () => {
    const status = statusWithLocks({
      scope: "dossier",
      dossier_id: "dossier-A",
    })

    expect(isNumberingDossierLocked(status, "dossier-A")).toBe(true)
    expect(isNumberingDossierLocked(status, "dossier-B")).toBe(false)
    expect(isNumberingDocumentLocked(status, document(12, "dossier-A"))).toBe(
      true
    )
    expect(isNumberingDocumentLocked(status, document(21, "dossier-B"))).toBe(
      false
    )
  })

  it("applies a session lock to every dossier and document", () => {
    const status = statusWithLocks({ scope: "session" })

    expect(isNumberingDossierLocked(status, "dossier-B")).toBe(true)
    expect(isNumberingDocumentLocked(status, document(21, "dossier-B"))).toBe(
      true
    )
  })
})
