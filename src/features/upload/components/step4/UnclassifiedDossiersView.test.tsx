import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ApiRequestError } from "@/features/upload/api/sessionApi.http"
import { UnclassifiedDossiersView } from "./UnclassifiedDossiersView"

const apiMocks = vi.hoisted(() => ({
  classifyUnclassifiedSessionDossiers: vi.fn(),
  listUnclassifiedSessionDossiers: vi.fn(),
  patchSessionDossier: vi.fn(),
}))

vi.mock("@/features/upload/api/sessionApi", () => ({
  classifyUnclassifiedSessionDossiers:
    apiMocks.classifyUnclassifiedSessionDossiers,
  listUnclassifiedSessionDossiers: apiMocks.listUnclassifiedSessionDossiers,
  patchSessionDossier: apiMocks.patchSessionDossier,
}))

describe("UnclassifiedDossiersView", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("treats a missing cluster version as an empty state", async () => {
    apiMocks.listUnclassifiedSessionDossiers.mockRejectedValue(
      new ApiRequestError(
        "Session has no cluster version: session-without-cluster",
        404
      )
    )

    render(
      <UnclassifiedDossiersView
        sessionId="session-without-cluster"
        onBack={() => undefined}
      />
    )

    expect(
      await screen.findByText("Không có hồ sơ chờ phân loại")
    ).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("lets the user collapse and reopen the optional section", async () => {
    apiMocks.listUnclassifiedSessionDossiers.mockResolvedValue({
      session_id: "session-1",
      scope: "unclassified",
      cluster_version_id: null,
      version_number: null,
      dossiers: [],
    })

    render(
      <UnclassifiedDossiersView
        sessionId="session-1"
        onBack={() => undefined}
      />
    )

    const emptyState = await screen.findByText("Không có hồ sơ chờ phân loại")
    const toggle = screen.getByRole("button", {
      name: /Hồ sơ chờ phân loại/,
    })
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(emptyState).toBeVisible()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(
      screen.queryByText("Không có hồ sơ chờ phân loại")
    ).not.toBeInTheDocument()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("Không có hồ sơ chờ phân loại")).toBeVisible()
  })

  it("queues every dossier in the waiting folder without per-dossier selection", async () => {
    const onUpdateQueued = vi.fn()
    apiMocks.listUnclassifiedSessionDossiers.mockResolvedValue({
      session_id: "session-1",
      scope: "unclassified",
      cluster_version_id: null,
      version_number: null,
      dossiers: [
        {
          id: 11,
          dossier_id: "transfer-dossier-1",
          title: "Hồ sơ chuyển đến",
          title_override: null,
          generated_title: "Hồ sơ chuyển đến",
          retention_period: null,
          document_ids: ["doc-1"],
          documents: [
            {
              id: 1,
              document_id: "doc-1",
              file_name: "document-1.pdf",
              title: "Tài liệu 1",
            },
          ],
        },
      ],
    })
    apiMocks.classifyUnclassifiedSessionDossiers.mockResolvedValue({
      session_id: "session-1",
      job_id: 9,
      status: "queued",
      selected_dossier_count: 1,
      dossier_ids: ["transfer-dossier-1"],
    })

    render(
      <UnclassifiedDossiersView
        sessionId="session-1"
        onBack={() => undefined}
        onUpdateQueued={onUpdateQueued}
      />
    )

    expect(
      await screen.findByText(/Sẽ cập nhật toàn bộ 1 hồ sơ/i)
    ).toBeInTheDocument()
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /^Cập nhật hồ sơ$/i }))

    await waitFor(() => {
      expect(apiMocks.classifyUnclassifiedSessionDossiers).toHaveBeenCalledWith(
        "session-1"
      )
      expect(onUpdateQueued).toHaveBeenCalledOnce()
    })
  })
})
