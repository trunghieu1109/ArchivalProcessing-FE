import { describe, expect, it } from "vitest"

import type { SupplementalIntakeResponse } from "@/features/upload/api/sessionApi"
import type {
  ClusterDocument,
  ClusterGroup,
} from "@/features/upload/lib/clusterGroups"
import { applySupplementalIntakeOverlay } from "./FinalResult.supplementalOverlay"

function document(id: number): ClusterDocument {
  return {
    documentId: `doc-${id}`,
    sessionDocumentId: id,
    filePath: `doc-${id}.pdf`,
    fileName: `doc-${id}.pdf`,
    remoteMetadataStatus: null,
    ocrStatus: "done",
    signatureStatus: "done",
    positionIndex: id - 1,
    pageCount: 1,
    sheetCount: 1,
    requiresReview: false,
    metadata: {},
    clusterWarning: null,
  }
}

function intake(
  overrides: Partial<SupplementalIntakeResponse> = {}
): SupplementalIntakeResponse {
  return {
    intake_id: "intake-1",
    session_id: "session-1",
    client_request_id: "request-1",
    intake_mode: "existing_dossier",
    status: "waiting_for_review",
    base_cluster_version_id: "version-1",
    base_plan_version_id: "plan-1",
    target: {
      state: "existing",
      cluster_id: "cluster-1",
      dossier_id: "dossier-1",
      leaf_group_id: "leaf-1",
      group_ids: ["root-1", "leaf-1"],
      group_path: ["Hành chính", "Năm 2021"],
    },
    folder_upload_id: "upload-1",
    counts: {
      file_count: 1,
      draft_count: 1,
      verified_count: 0,
      failed_count: 0,
    },
    documents: [
      {
        session_document_id: 2,
        document_id: "doc-2",
        file_name: "doc-2.pdf",
        dossier_id: "dossier-1",
        arrangement_status: "draft",
        ocr_status: "done",
        review_status: "pending",
        is_reviewed: false,
        draft_sequence: 0,
        error: null,
      },
    ],
    created_at: "2026-09-15T00:00:00Z",
    updated_at: "2026-09-15T00:00:00Z",
    error: null,
    ...overrides,
  }
}

describe("supplemental intake overlay", () => {
  it("keeps a TH1 draft at the end of its selected dossier", () => {
    const groups: ClusterGroup[] = [
      {
        id: "dossier-1",
        clusterId: "cluster-1",
        dossierId: "dossier-1",
        label: "Hồ sơ một",
        files: ["doc-1.pdf"],
        documents: [document(1)],
      },
    ]

    const result = applySupplementalIntakeOverlay(groups, [intake()], [])

    expect(result[0].documents.map((item) => item.sessionDocumentId)).toEqual([
      1, 2,
    ])
    expect(result[0].documents[1].metadata).toMatchObject({
      arrangement_status: "draft",
      supplemental_intake_id: "intake-1",
    })
  })

  it("shows persisted OCR metadata for a draft without classifying it", () => {
    const response = intake({
      documents: [
        {
          ...intake().documents[0],
          metadata_ready: true,
          remote_metadata_status: "done",
          data_path: "supplemental/doc-2.pdf",
          light_metadata: {
            document_summary: "Báo cáo đề xuất xây dựng hạ tầng",
            document_type: "Báo cáo",
            document_number_part: "08",
            document_notation_part: "BC-UBND",
            issued_date: "15/06/2015",
            issuing_agency: "ỦY BAN NHÂN DÂN PHƯỜNG HÒA NGHĨA",
          },
        },
      ],
    })
    const groups: ClusterGroup[] = [
      {
        id: "dossier-1",
        clusterId: "cluster-1",
        dossierId: "dossier-1",
        label: "Hồ sơ một",
        files: ["doc-1.pdf"],
        documents: [document(1)],
      },
    ]

    const result = applySupplementalIntakeOverlay(groups, [response], [])
    const draft = result[0].documents[1]

    expect(draft.metadata).toMatchObject({
      document_summary: "Báo cáo đề xuất xây dựng hạ tầng",
      document_type: "Báo cáo",
      issued_date: "15/06/2015",
      issuing_agency: "ỦY BAN NHÂN DÂN PHƯỜNG HÒA NGHĨA",
      arrangement_status: "draft",
      supplemental_intake_id: "intake-1",
    })
    expect(draft.filePath).toBe("supplemental/doc-2.pdf")
    expect(draft.requiresReview).toBe(true)
  })

  it("creates a TH2 pending dossier on the selected classification path", () => {
    const response = intake({
      intake_mode: "new_dossier_existing_leaf",
      target: {
        state: "materialized",
        cluster_id: "temporary-intake-2",
        dossier_id: "dossier-2",
        leaf_group_id: "leaf-1",
        group_ids: ["root-1", "leaf-1"],
        group_path: ["Hành chính", "Năm 2021"],
      },
      dossier: { title: "Hồ sơ mới", status: "pending" },
    })

    const result = applySupplementalIntakeOverlay([], [response], [])

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: "dossier-2",
      label: "Hồ sơ mới",
      isPendingDossier: true,
      supplementalIntakeId: "intake-1",
      classificationPath: ["Hành chính", "Năm 2021"],
    })
  })
})
