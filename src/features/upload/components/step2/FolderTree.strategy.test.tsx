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
        useTemporaryCodeAsDossierNumber={false}
        fileRegisterConfig={{
          analysis_status: "not_detected",
          summary: "",
          evidence: [],
          steps: [{ criterion: "issued_date", granularity: "year" }],
          merge_small_dossiers: false,
        }}
        onDossierBuildStrategyChange={onStrategyChange}
        onUseTemporaryCodeAsDossierNumberChange={vi.fn()}
        onFileRegisterConfigChange={vi.fn()}
      />
    )

    const issueBased = screen.getAllByRole("radio")[0]
    expect(issueBased).toHaveAttribute("aria-checked", "true")
    fireEvent.click(issueBased)
    expect(onStrategyChange).toHaveBeenCalledWith("hybrid")
  })

  it("temporarily hides the quick predefined strategy", () => {
    const onStrategyChange = vi.fn()
    render(
      <DossierBuildStrategySection
        readOnly={false}
        dossierBuildStrategy="incremental"
        useTemporaryCodeAsDossierNumber={false}
        fileRegisterConfig={{
          analysis_status: "not_detected",
          summary: "",
          evidence: [],
          steps: [{ criterion: "issued_date", granularity: "year" }],
          merge_small_dossiers: false,
        }}
        onDossierBuildStrategyChange={onStrategyChange}
        onUseTemporaryCodeAsDossierNumberChange={vi.fn()}
        onFileRegisterConfigChange={vi.fn()}
      />
    )

    expect(screen.getAllByRole("radio")).toHaveLength(2)
    expect(
      screen.queryByRole("radio", { name: /Lập hồ sơ nhanh/i })
    ).not.toBeInTheDocument()
    expect(onStrategyChange).not.toHaveBeenCalledWith("predefined")
  })
})
