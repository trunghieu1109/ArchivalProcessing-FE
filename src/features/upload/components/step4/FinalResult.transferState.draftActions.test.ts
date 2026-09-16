import { describe, expect, it } from "vitest"

import type { ClusterDocument } from "@/features/upload/lib/clusterGroups"
import { usesDraftDocumentActions } from "./FinalResult.transferState"

function document(metadata: Record<string, unknown> = {}): ClusterDocument {
  return {
    documentId: "document-1",
    sessionDocumentId: 1,
    filePath: "document-1.pdf",
    fileName: "document-1.pdf",
    remoteMetadataStatus: "done",
    ocrStatus: "done",
    signatureStatus: "signed",
    positionIndex: 0,
    pageCount: 1,
    sheetCount: 1,
    requiresReview: false,
    metadata,
    clusterWarning: null,
    lifecycleStatus: "active",
  }
}

describe("draft document row actions", () => {
  it("restricts supplemental documents that are not in the cluster snapshot", () => {
    expect(
      usesDraftDocumentActions(
        document({ supplemental_intake_id: "intake-1" }),
        false
      )
    ).toBe(true)
  })

  it("restricts documents inside a draft dossier", () => {
    expect(usesDraftDocumentActions(document(), true)).toBe(true)
  })

  it("keeps the complete action set for an official document", () => {
    expect(usesDraftDocumentActions(document(), false)).toBe(false)
  })
})
