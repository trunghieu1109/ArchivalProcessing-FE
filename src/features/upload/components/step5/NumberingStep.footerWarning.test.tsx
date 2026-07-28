import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { NumberingStepFooter } from "./NumberingStep.parts"

describe("NumberingStepFooter missing box warning", () => {
  it("shows the missing dossier box count in the action bar", () => {
    render(
      <NumberingStepFooter
        active={false}
        metadataBusy={false}
        canContinue={false}
        blockedReason="Chưa nhập số hộp cho 3 hồ sơ."
        dossiersWithoutBoxCount={3}
        doneCount={10}
        totalDocuments={10}
        failedCount={0}
        unresolvedCount={0}
        onContinue={() => undefined}
      />
    )

    expect(screen.getByText("Còn thiếu số hộp")).toBeInTheDocument()
    expect(
      screen.getByText("Chưa nhập số hộp cho 3 hồ sơ.")
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Tạo mục lục" })).toBeDisabled()
  })
})
