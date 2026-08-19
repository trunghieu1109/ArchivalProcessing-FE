import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { DossierBuildStrategySection } from "./FolderTree.strategy"

describe("DossierBuildStrategySection", () => {
  it("selects hybrid for issue-based dossier building", () => {
    const onStrategyChange = vi.fn()
    render(
      <DossierBuildStrategySection
        readOnly={false}
        dossierBuildStrategy="hybrid"
        fileRegisterConfig={{
          analysis_status: "not_detected",
          summary: "",
          evidence: [],
          steps: [{ criterion: "issued_date", granularity: "year" }],
          merge_small_dossiers: false,
        }}
        onDossierBuildStrategyChange={onStrategyChange}
        onFileRegisterConfigChange={vi.fn()}
      />
    )

    const issueBased = screen.getAllByRole("radio")[0]
    expect(issueBased).toHaveAttribute("aria-checked", "true")
    fireEvent.click(issueBased)
    expect(onStrategyChange).toHaveBeenCalledWith("hybrid")
  })

  it("renders and selects the quick predefined strategy", () => {
    const onStrategyChange = vi.fn()
    render(
      <DossierBuildStrategySection
        readOnly={false}
        dossierBuildStrategy="incremental"
        fileRegisterConfig={{
          analysis_status: "not_detected",
          summary: "",
          evidence: [],
          steps: [{ criterion: "issued_date", granularity: "year" }],
          merge_small_dossiers: false,
        }}
        onDossierBuildStrategyChange={onStrategyChange}
        onFileRegisterConfigChange={vi.fn()}
      />
    )

    const quickBuild = screen.getByRole("radio", { name: /Lập hồ sơ nhanh/i })
    expect(quickBuild).toHaveAttribute("aria-checked", "false")
    fireEvent.click(quickBuild)
    expect(onStrategyChange).toHaveBeenCalledWith("predefined")
  })
})
