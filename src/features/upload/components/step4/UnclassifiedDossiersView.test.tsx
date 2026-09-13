import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ApiRequestError } from "@/features/upload/api/sessionApi.http"
import { UnclassifiedDossiersView } from "./UnclassifiedDossiersView"

const apiMocks = vi.hoisted(() => ({
  listUnclassifiedSessionDossiers: vi.fn(),
}))

vi.mock("@/features/upload/api/sessionApi", () => ({
  listUnclassifiedSessionDossiers: apiMocks.listUnclassifiedSessionDossiers,
}))

describe("UnclassifiedDossiersView", () => {
  beforeEach(() => {
    apiMocks.listUnclassifiedSessionDossiers.mockReset()
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
})
