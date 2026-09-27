import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ProvisionalDossiersPage } from "./ProvisionalDossiersPage"

const mocks = vi.hoisted(() => ({
  getCached: vi.fn(),
  listProvisionalDossiers: vi.fn(),
  loadClusterDetail: vi.fn(),
  navigate: vi.fn(),
  prefetchClusterDetails: vi.fn(),
}))

vi.mock("react-router-dom", () => ({
  useNavigate: () => mocks.navigate,
  useParams: () => ({ sessionId: "session-1" }),
}))

vi.mock("@/features/auth/lib/AuthContext", () => ({
  useAuth: () => ({ user: { role: "admin" } }),
}))

vi.mock("@/features/upload/api/sessionApi", () => ({
  listProvisionalDossiers: mocks.listProvisionalDossiers,
  promoteAllProvisionalDossiers: vi.fn(),
  promoteProvisionalDossier: vi.fn(),
  promoteSelectedProvisionalDossiers: vi.fn(),
  removeClusterFromProvisionalDossier: vi.fn(),
}))

vi.mock("@/features/upload/hooks/useHomogeneousClusterDetailCache", () => ({
  useHomogeneousClusterDetailCache: () => ({
    getCached: mocks.getCached,
    loadClusterDetail: mocks.loadClusterDetail,
    prefetchClusterDetails: mocks.prefetchClusterDetails,
  }),
}))

vi.mock("@/features/upload/lib/documentPreviewCache", () => ({
  prefetchDocumentPreview: vi.fn(),
}))

vi.mock("@/features/upload/components/HomogeneousDocumentReviewDialog", () => ({
  HomogeneousDocumentReviewDialog: ({
    cluster,
    open,
    owner,
  }: {
    cluster: { cluster_id?: string } | null
    open: boolean
    owner: { id?: number } | null
  }) =>
    open ? (
      <div role="dialog">
        Hồ sơ {owner?.id} · Cụm {cluster?.cluster_id}
      </div>
    ) : null,
}))

vi.mock("@/pages/UploadPage.header", () => ({
  UploadPageHeader: () => null,
}))

vi.mock("@/pages/SessionWorkflowContext", () => ({
  SessionWorkflowContext: () => null,
}))

vi.mock("@/pages/homogeneousWorkflow", () => ({
  HOMOGENEOUS_WORKFLOW_LABELS: [],
  homogeneousWorkflowRoute: () => "/workflow",
  markHomogeneousWorkflow: vi.fn(),
}))

describe("ProvisionalDossiersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const cluster = {
      id: 27,
      cluster_id: "cluster-27",
      dossier_id: "34",
      title: "cluster-27",
      content_summary: "Tóm tắt nội dung cụm.",
      statistics: { document_count: 1 },
      cohesion_mean: 0.7,
      dossier: null,
      status: "draft",
      notes: [],
      document_ids: ["doc-1"],
      page_count: 1,
      sheet_count: null,
      start_date: null,
      end_date: null,
      placements: [],
    }
    mocks.getCached.mockReturnValue(cluster)
    mocks.loadClusterDetail.mockResolvedValue(cluster)
    mocks.listProvisionalDossiers.mockResolvedValue({
      session_id: "session-1",
      composition: {
        eligible_cluster_count: 1,
        assigned_cluster_count: 1,
        unassigned_cluster_count: 0,
      },
      dossiers: [
        {
          id: 34,
          session_id: "session-1",
          source_cluster_version_id: "version-1",
          generated_title: "Hồ sơ tạm",
          title_override: null,
          title: "Hồ sơ tạm #34",
          content_summary: "Tóm tắt nội dung hồ sơ.",
          status: "draft",
          revision: 1,
          statistics: {
            cluster_count: 1,
            document_count: 1,
            cohesion_mean: 0.7,
            start_date: null,
            end_date: null,
          },
          created_at: "2026-09-20T00:00:00Z",
          updated_at: "2026-09-20T00:00:00Z",
          clusters: [
            {
              cluster_id: "cluster-27",
              title: "cluster-27",
              content_summary: "Tóm tắt nội dung cụm.",
              document_count: 1,
              cohesion_mean: 0.7,
              position_index: 0,
            },
          ],
        },
      ],
    })
  })

  it("opens a dossier that contains only one cluster", async () => {
    render(<ProvisionalDossiersPage />)

    fireEvent.click(await screen.findByRole("button", { name: "Xem hồ sơ" }))

    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Hồ sơ 34 · Cụm cluster-27"
    )
  })
})
