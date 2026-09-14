import { describe, expect, it } from "vitest"

import type { ClusterVersionResponse } from "@/features/upload/api/sessionApi"
import {
  TRANSFER_PENDING_CLUSTER_ID,
  versionToGroups,
} from "./clusterGroups"

describe("versionToGroups transfer pending projection", () => {
  it("moves locked documents into one synthetic top-level group", () => {
    const version = {
      id: "cluster-version-2",
      session_id: "session-source",
      version_number: 2,
      source: "user_feedback",
      status: "draft",
      previous_version_id: "cluster-version-1",
      plan_version_id: "plan-1",
      summary: {},
      affected_clusters: [],
      batch_snapshot_count: 0,
      created_at: "2026-09-14T00:00:00Z",
      clusters: [
        {
          id: 1,
          cluster_id: "dossier-1",
          dossier_id: "dossier-1",
          title: "Hồ sơ 1",
          dossier: null,
          dossiers: [],
          status: "unchanged",
          notes: [],
          document_ids: ["doc-1"],
          page_count: 1,
          sheet_count: 1,
          start_date: null,
          end_date: null,
          placements: [
            {
              id: 1,
              session_document_id: 11,
              document_id: "doc-1",
              dossier_id: "dossier-1",
              position_index: 1,
              placement_status: "transfer_pending",
              requires_review: true,
              page_count: 1,
              sheet_count: 1,
              metadata: { file_path: "source/doc-1.pdf" },
              active_transfer_request_id: "transfer-request-1",
              active_transfer_request_status: "pending_target_approval",
            },
          ],
        },
      ],
      pending_transfer_documents: [
        {
          id: -11,
          session_document_id: 11,
          document_id: "doc-1",
          dossier_id: null,
          position_index: 1,
          placement_status: "transfer_pending",
          requires_review: true,
          page_count: 1,
          sheet_count: null,
          metadata: { file_path: "source/doc-1.pdf" },
          active_transfer_request_id: "transfer-request-1",
          active_transfer_request_status: "pending_target_approval",
        },
      ],
    } as ClusterVersionResponse

    const groups = versionToGroups(version, [])

    expect(groups[0].id).toBe(TRANSFER_PENDING_CLUSTER_ID)
    expect(groups[0].isTransferPending).toBe(true)
    expect(groups[0].documents.map((document) => document.documentId)).toEqual([
      "doc-1",
    ])
    expect(
      groups.find((group) => group.id === "dossier-1")?.documents
    ).toEqual([])
  })
})
