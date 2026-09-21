import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  acceptSessionDocumentTransferRequest,
  getSessionClassificationContext,
  getSessionDocumentTransferRequest,
  listSessionDocumentTransferRequests,
} from "@/features/upload/api/sessionApi"
import { ApiRequestError } from "@/features/upload/api/sessionApi.http"
import { DocumentTransferRequestsPanel } from "./DocumentTransferRequestsPanel"

vi.mock("@/features/upload/api/sessionApi", () => ({
  acceptSessionDocumentTransferRequest: vi.fn(),
  getSessionClassificationContext: vi.fn(),
  getSessionDocumentTransferRequest: vi.fn(),
  getSessionDocumentTransferTargetContext: vi.fn(),
  listSessionDocumentTransferRequests: vi.fn(),
  rejectSessionDocumentTransferRequest: vi.fn(),
  resubmitSessionDocumentTransferRequest: vi.fn(),
}))

const requestSummary = {
  request_id: "transfer-request-case-4",
  transfer_case: "case_4_classification_approved",
  status: "pending_target_approval",
  source_session_id: "session-source",
  target_session_id: "session-target",
  document_count: 1,
  dossier_title: "Hồ sơ nhận mới",
  group_path: ["Tài chính", "Năm 2026"],
}

const requestDetail = {
  ...requestSummary,
  client_request_id: "client-case-4",
  source_session_document_ids: [10],
  target_session_document_ids: [],
  target_snapshot: {
    workflow_revision: 3,
    plan_version_id: "plan-1",
    cluster_version_id: "cluster-active-1",
    classification_review_id: null,
    classification_review_status: "approved",
  },
  target_dossier_draft: {
    draft_id: "draft-1",
    dossier_id: "dossier-new",
    status: "pending",
    metadata: { title: "Hồ sơ nhận mới" },
    classification: {
      plan_version_id: "plan-1",
      cluster_version_id: "cluster-active-1",
      group_ids: ["finance", "2026"],
      leaf_group_id: "2026",
      group_path: ["Tài chính", "Năm 2026"],
    },
    materialized_session_dossier_id: null,
  },
  approval: {
    required: true,
    status: "pending",
    handled_by: null,
    handled_at: null,
    reason: null,
  },
  transfer_operation_id: null,
  error: null,
  documents: [
    {
      source_session_document_id: 10,
      target_session_document_id: null,
      document_id: "document-10",
      file_name: "document-10.pdf",
      request_item_status: "locked_at_source",
    },
  ],
}

const classificationContext = {
  target_session_id: requestSummary.target_session_id,
  selectable: true,
  unavailable_reason: null,
  transfer_case: "case_4_classification_approved",
  workflow_stage: "classification_approved",
  requires_target_approval: true,
  required_form_fields: ["dossier"],
  target_snapshot: requestDetail.target_snapshot,
  classification_optional: true,
  classification_available: true,
  classification_leafs: [
    {
      group_id: "2026",
      group_ids: ["finance", "2026"],
      group_path: ["Tài chính", "Năm 2026"],
    },
  ],
}

describe("DocumentTransferRequestsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listSessionDocumentTransferRequests).mockResolvedValue({
      items: [requestSummary],
      total: 1,
      limit: 50,
      offset: 0,
    } as never)
    vi.mocked(getSessionDocumentTransferRequest).mockResolvedValue(
      requestDetail as never
    )
    vi.mocked(getSessionClassificationContext).mockResolvedValue(
      classificationContext as never
    )
  })

  it("warns the target leader when manually classifying a case 4 request", async () => {
    render(
      <DocumentTransferRequestsPanel
        sessionId="session-target"
        canManageTarget={true}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /Yêu cầu chuyển/i }))
    fireEvent.click(
      await screen.findByRole("button", { name: /Hồ sơ nhận mới/i })
    )
    fireEvent.click(
      await screen.findByRole("button", { name: /^Chọn nhóm đích/ })
    )
    fireEvent.click(await screen.findByRole("treeitem", { name: "Năm 2026" }))

    await waitFor(() => {
      expect(
        screen.getByRole("alert", {
          name: "",
        })
      ).toHaveTextContent("Phông đích đang có kết quả phân loại active")
    })
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Chấp nhận" })).toBeEnabled()
    })
    expect(getSessionClassificationContext).toHaveBeenCalledWith(
      "session-target"
    )
  })

  it("sends the classification selected by the receiving user", async () => {
    vi.mocked(acceptSessionDocumentTransferRequest).mockResolvedValue({
      request_id: requestSummary.request_id,
      status: "accepting",
    } as never)

    render(
      <DocumentTransferRequestsPanel
        sessionId="session-target"
        canManageTarget={true}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /Yêu cầu chuyển/i }))
    fireEvent.click(
      await screen.findByRole("button", { name: /Hồ sơ nhận mới/i })
    )
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^Chọn nhóm đích/ })
      ).toBeEnabled()
    })
    fireEvent.click(screen.getByRole("button", { name: /^Chọn nhóm đích/ }))
    fireEvent.click(await screen.findByRole("treeitem", { name: "Năm 2026" }))
    fireEvent.click(screen.getByRole("button", { name: "Chấp nhận" }))

    await waitFor(() => {
      expect(acceptSessionDocumentTransferRequest).toHaveBeenCalledWith(
        "session-target",
        requestSummary.request_id,
        expect.any(String),
        {
          plan_version_id: "plan-1",
          cluster_version_id: "cluster-active-1",
          group_ids: ["finance", "2026"],
          leaf_group_id: "2026",
          group_path: ["Tài chính", "Năm 2026"],
        },
        classificationContext.target_snapshot
      )
    })
  })

  it("shows live progress while the worker is transferring documents", async () => {
    vi.mocked(getSessionDocumentTransferRequest).mockResolvedValue({
      ...requestDetail,
      status: "accepting",
      approval: { ...requestDetail.approval, status: "accepted" },
      documents: requestDetail.documents.map((document) => ({
        ...document,
        request_item_status: "transferring",
      })),
    } as never)

    render(
      <DocumentTransferRequestsPanel
        sessionId="session-target"
        canManageTarget={true}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /Yêu cầu chuyển/i }))
    fireEvent.click(
      await screen.findByRole("button", { name: /Hồ sơ nhận mới/i })
    )

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Giao diện sẽ tự làm mới ngay khi worker hoàn tất"
    )
  })

  it("describes an accept validation error in plain Vietnamese", async () => {
    vi.mocked(acceptSessionDocumentTransferRequest).mockRejectedValue(
      new ApiRequestError("Technical backend message", 409, {
        code: "TARGET_PLAN_VERSION_CHANGED",
      })
    )

    render(
      <DocumentTransferRequestsPanel
        sessionId="session-target"
        canManageTarget={true}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /Yêu cầu chuyển/i }))
    fireEvent.click(
      await screen.findByRole("button", { name: /Hồ sơ nhận mới/i })
    )
    const acceptButton = await screen.findByRole("button", {
      name: "Chấp nhận",
    })
    await waitFor(() => expect(acceptButton).toBeEnabled())
    fireEvent.click(acceptButton)

    expect(
      await screen.findByText(
        /Phương án phân loại của Phông đích đã thay đổi.*Yêu cầu vẫn ở trạng thái chờ duyệt/
      )
    ).toBeInTheDocument()
  })
})
