import { fireEvent, render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { describe, expect, it, vi } from "vitest"

import type { SessionSummary } from "@/features/upload/api/sessionApi"
import { SessionCard } from "./SessionsPage.components"
import { fallbackAnalysisStatuses } from "./SessionsPage.utils"

const session = {
  session_id: "session-1",
  status: "created",
  created_at: "2026-08-13T00:00:00Z",
} as SessionSummary

describe("SessionCard backup visibility", () => {
  it("does not expose the Backup JSON action", () => {
    renderCard()
    expect(
      screen.queryByRole("button", { name: "Backup JSON" })
    ).not.toBeInTheDocument()
  })

  it("runs the merged-fonds action from the session card", () => {
    const onClick = vi.fn()
    renderCard({
      isAdmin: true,
      mergeAction: {
        label: "Cập nhật từ nguồn",
        pending: false,
        kind: "refresh",
        onClick,
      },
    })

    fireEvent.click(
      screen.getByRole("button", { name: "Cập nhật từ nguồn" })
    )
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

function renderCard(
  overrides: Partial<ComponentProps<typeof SessionCard>> = {}
) {
  return render(card(overrides))
}

function card(overrides: Partial<ComponentProps<typeof SessionCard>>) {
  return (
    <SessionCard
      session={session}
      index={0}
      onOpen={vi.fn()}
      onDelete={vi.fn()}
      deleting={false}
      isAdmin={false}
      coordinators={[]}
      analysisStatuses={fallbackAnalysisStatuses(session)}
      assigning={false}
      onAssignCoordinator={vi.fn()}
      {...overrides}
    />
  )
}
