import { describe, expect, it } from "vitest"

import type {
  ClusterDocument,
  ClusterGroup,
  PendingClusterFeedbackMarker,
} from "@/features/upload/lib/clusterGroups"
import { buildResultTree, moveSelectedDocumentsLocally } from "./FinalResult.treeUtils"
import type { UnclassifiedSessionDossierSummary } from "@/features/upload/api/sessionApi"

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

describe("buildResultTree", () => {
  it("keeps classified results alongside a waiting folder with document metadata", () => {
    const waiting = {
      dossier_id: "waiting-1",
      title: "Hồ sơ chờ",
      documents: [{
        id: 12,
        document_id: "doc-12",
        file_name: "van-ban.pdf",
        title: "Văn bản thử",
        document_number: "12/QD",
        issued_date: "2026-01-01",
        page_count: 3,
        review_status: "reviewed",
        is_reviewed: true,
        document_type: "Quyết định",
        normalized_metadata: { signer: "Nguyễn Văn A" },
      }],
    } as unknown as UnclassifiedSessionDossierSummary

    const tree = buildResultTree(
      [group("classified-1", [document(1)], { classificationPath: ["Nhóm A"] })],
      "Phông A",
      undefined,
      [waiting]
    )

    expect(tree.map((node) => node.type)).toEqual(["unclassified_folder", "fonds"])
    expect(tree[0].documentCount).toBe(1)
    expect(tree[0].pageCount).toBe(3)
    expect(tree[0].children[0].unclassifiedDossier?.documents[0].normalized_metadata).toEqual({ signer: "Nguyễn Văn A" })
    expect(tree[1].children.flatMap((retention) => retention.children).length).toBeGreaterThan(0)
  })
})

describe("moveSelectedDocumentsLocally", () => {
  it("does not move documents into a pending dossier", () => {
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

    expect(moved).toBe(groups)
    expect(moved[0].documents.map((item) => item.sessionDocumentId)).toEqual([1, 2])
    expect(moved[1].documents.map((item) => item.sessionDocumentId)).toEqual([3])
    expect(moved[2].documents.map((item) => item.sessionDocumentId)).toEqual([4])
  })
})
