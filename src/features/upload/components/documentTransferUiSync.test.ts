import { describe, expect, it } from "vitest"

import {
  documentTransferRefreshAffectsSession,
  isDocumentTransferRefreshEventType,
} from "./documentTransferUiSync"

describe("document transfer UI synchronization", () => {
  it("recognizes request and core transfer lifecycle events", () => {
    expect(
      isDocumentTransferRefreshEventType("document_transfer.request.completed")
    ).toBe(true)
    expect(
      isDocumentTransferRefreshEventType("documents.transfer_out_completed")
    ).toBe(true)
    expect(
      isDocumentTransferRefreshEventType("documents.transfer_in_failed")
    ).toBe(true)
    expect(isDocumentTransferRefreshEventType("clustering.progress")).toBe(
      false
    )
  })

  it("refreshes either the source or target session", () => {
    const detail = {
      sourceSessionId: "session-source",
      targetSessionId: "session-target",
    }
    expect(
      documentTransferRefreshAffectsSession(detail, "session-source")
    ).toBe(true)
    expect(
      documentTransferRefreshAffectsSession(detail, "session-target")
    ).toBe(true)
    expect(documentTransferRefreshAffectsSession(detail, "session-other")).toBe(
      false
    )
  })
})
