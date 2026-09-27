import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type {
  ProvisionalDossier,
  SessionClusterSummary,
} from "@/features/upload/api/sessionApi"
import { HomogeneousDocumentReviewDialog } from "./HomogeneousDocumentReviewDialog"

vi.mock("@/features/upload/components/DocumentPdfPreview", () => ({
  DocumentPdfPreview: ({ document }: { document: { fileName: string } }) => (
    <div data-testid="document-pdf-preview">{document.fileName}</div>
  ),
}))

const cluster: SessionClusterSummary = {
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
  placements: [
    {
      id: 101,
      session_document_id: 501,
      document_id: "doc-1",
      file_name: "bao-cao.pdf",
      data_path: "remote/bao-cao.pdf",
      position_index: 0,
      placement_status: "assigned",
      requires_review: false,
      page_count: 1,
      sheet_count: null,
      metadata: {
        document_summary: "Báo cáo tình hình thu chi ngân sách.",
      },
    },
  ],
}

const owner: ProvisionalDossier = {
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
}

describe("HomogeneousDocumentReviewDialog", () => {
  it("shows a provisional dossier document preview only after requested", () => {
    render(
      <HomogeneousDocumentReviewDialog
        sessionId="session-1"
        cluster={cluster}
        owner={owner}
        open
        onOpenChange={vi.fn()}
        onSelectDossierCluster={vi.fn()}
      />
    )

    expect(screen.queryByTestId("document-pdf-preview")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Xem tài liệu" }))

    expect(screen.getByTestId("document-pdf-preview")).toHaveTextContent(
      "bao-cao.pdf"
    )
  })
})
