import { describe, expect, it } from "vitest"

import type {
  ClusterDocument,
  ClusterGroup,
  PendingClusterFeedbackMarker,
} from "@/features/upload/lib/clusterGroups"
import { moveSelectedDocumentsLocally } from "./FinalResult.treeUtils"

function document(id: number): ClusterDocument {
  return {
    documentId: `doc-${id}`,
    sessionDocumentId: id,
    filePath: `HC/UBND/doc-${id}.pdf`,
    fileName: `doc-${id}.pdf`,
    remoteMetadataStatus: null,
    ocrStatus: "done",
    signatureStatus: "none",
    positionIndex: id,
    pageCount: 1,
    sheetCount: 1,
    requiresReview: false,
    metadata: {},
    clusterWarning: null,
  }
}

function group(
  id: string,
  documents: ClusterDocument[],
  options: Partial<ClusterGroup> = {}
): ClusterGroup {
  return {
    id,
    clusterId: id,
    label: id,
    files: documents.map((item) => item.filePath),
    documents,
    ...options,
  }
}

describe("moveSelectedDocumentsLocally", () => {
  it("optimistically moves multiple documents into a pending dossier", () => {
    const marker: PendingClusterFeedbackMarker = {
      id: -1,
      action: "manual_move",
      targetClusterId: "pending-dossier",
      createdAt: "2026-08-05T00:00:00.000Z",
    }
    const groups = [
      group("source-a", [document(1), document(2)]),
      group("source-b", [document(3)]),
      group("pending-dossier", [document(4)], { isPendingDossier: true }),
    ]

    const moved = moveSelectedDocumentsLocally(
      groups,
      [2, 3],
      "pending-dossier",
      marker
    )

    expect(moved[0].documents.map((item) => item.sessionDocumentId)).toEqual([
      1,
    ])
    expect(moved[1].documents).toEqual([])
    expect(
      moved[2].documents.map((item) => item.sessionDocumentId)
    ).toEqual([4, 2, 3])
    expect(moved[2].documents[1].pendingFeedback).toBe(marker)
    expect(moved[2].documents[2].pendingFeedback).toBe(marker)
    expect(moved[2].isPendingDossier).toBe(true)
    expect(groups[0].documents.map((item) => item.sessionDocumentId)).toEqual([
      1,
      2,
    ])
  })
})
