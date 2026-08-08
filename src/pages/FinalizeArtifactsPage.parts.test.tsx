import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { FinalizeToolbar } from "./FinalizeArtifactsPage.parts"

describe("FinalizeToolbar", () => {
  it("forces a new job when the user clicks Tạo lại", () => {
    const onStartFinalize = vi.fn()

    render(
      <FinalizeToolbar
        embedded
        sessionId="session-1"
        loading={false}
        finalizing={false}
        visibleArtifactCount={2}
        downloadingAll={false}
        metadataExportMode="combined"
        onBack={vi.fn()}
        onRefreshArtifacts={vi.fn()}
        onStartFinalize={onStartFinalize}
        onDownloadAll={vi.fn()}
        onMetadataExportModeChange={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Tạo lại" }))

    expect(onStartFinalize).toHaveBeenCalledOnce()
    expect(onStartFinalize).toHaveBeenCalledWith({ force: true })
  })
})
