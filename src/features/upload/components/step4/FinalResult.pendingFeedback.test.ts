import { describe, expect, it } from "vitest"
import type {
  ClusterFeedbackListResponse,
  ClusterVersionResponse,
} from "@/features/upload/api/sessionApi"
import type {
  ClusterDocument,
  ClusterGroup,
} from "@/features/upload/lib/clusterGroups"
import { resolveFinalResultActionState } from "./FinalResult.actionState"
import { projectPendingHomogeneousDossiers } from "./FinalResult.pendingFeedback"

describe("pending homogeneous dossier results", () => {
  it("shows promoted documents as a pending dossier before a classic version exists", () => {
    const document = {
      documentId: "document-1",
      sessionDocumentId: 11,
      filePath: "/documents/document-1.pdf",
      fileName: "document-1.pdf",
      pageCount: 2,
      sheetCount: 2,
    } as ClusterDocument
    const sourceGroups: ClusterGroup[] = [
      {
        id: "homogeneous-1",
        clusterId: "homogeneous-1",
        dossierId: null,
        label: "Cụm nguồn",
        files: [document.filePath],
        documents: [document],
      },
    ]
    const response = {
      session_id: "session-1",
      feedback: [],
      pending_feedback: [
        {
          id: 5,
          session_id: "session-1",
          session_document_id: 11,
          document_id: "document-1",
          feedback_type: "temporary_dossier",
          source_cluster_id: "homogeneous-1",
          target_cluster_id: "temporary-dossier-1",
          status: "active",
          details: { action: "promote_selected_documents" },
          created_at: "2026-09-30T08:00:00Z",
        },
      ],
      pending_feedback_count: 1,
      dossier_drafts: [
        {
          id: 8,
          session_id: "session-1",
          target_cluster_id: "temporary-dossier-1",
          source: "promote_selected_documents",
          status: "pending",
          session_document_ids: [11],
          metadata: { title: "Hồ sơ đã ghi nhận" },
          manual_metadata_fields: [],
          metadata_revision: 0,
          created_at: "2026-09-30T08:00:00Z",
          updated_at: "2026-09-30T08:00:00Z",
        },
      ],
    } satisfies ClusterFeedbackListResponse

    const projected = projectPendingHomogeneousDossiers(
      sourceGroups,
      { id: "homogeneous-version" } as ClusterVersionResponse,
      response
    )

    expect(projected.groups).toHaveLength(1)
    expect(projected.groups[0]).toMatchObject({
      clusterId: "temporary-dossier-1",
      label: "Hồ sơ đã ghi nhận",
      isPendingDossier: true,
      draftId: 8,
    })
    expect(projected.groups[0].documents).toMatchObject([
      {
        documentId: "document-1",
        pendingFeedback: { id: 5 },
      },
    ])
    expect(projected.pendingFeedbackCount).toBe(1)

    const actions = resolveFinalResultActionState({
      hasPendingClusterVersion: false,
      pendingClusterVersionStatus: null,
      pendingClusterVersionNeedsRefresh: false,
      pendingFeedbackCount: projected.pendingFeedbackCount,
      supplementalVerificationPendingCount: 0,
      supplementalPendingDocumentCount: 0,
      supplementalPendingUpdateDocumentCount: 0,
      clusterVersionStale: false,
      busy: false,
      viewingHistoricalClusterVersion: false,
      hasSession: true,
      totalFiles: projected.groups[0].documents.length,
      totalDossiers: projected.groups.length,
    })
    expect(actions.showUpdateAction).toBe(true)
    expect(actions.canUpdateDossiers).toBe(true)
  })
})
