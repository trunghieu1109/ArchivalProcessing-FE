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

describe("SessionCard backup action", () => {
  it("renders backup only for an authorized role", () => {
    const { rerender } = renderCard({ canBackup: false })
    expect(
      screen.queryByRole("button", { name: "Backup JSON" })
    ).not.toBeInTheDocument()

    rerender(card({ canBackup: true }))
    expect(
      screen.getByRole("button", { name: "Backup JSON" })
    ).toBeInTheDocument()
  })

  it("invokes backup and shows document progress", () => {
    const onBackup = vi.fn()
    renderCard({
      canBackup: true,
      onBackup,
      backupProgress: {
        stage: "documents",
        processedDocuments: 25,
        totalDocuments: 100,
        batchNumber: 1,
      },
    })

    const button = screen.getByRole("button", { name: "Backup 25/100" })
    fireEvent.click(button)

    expect(onBackup).toHaveBeenCalledTimes(1)
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
      canBackup={false}
      backupDisabled={false}
      onBackup={vi.fn()}
      backupProgress={null}
      isAdmin={false}
      coordinators={[]}
      analysisStatuses={fallbackAnalysisStatuses(session)}
      assigning={false}
      onAssignCoordinator={vi.fn()}
      {...overrides}
    />
  )
}
