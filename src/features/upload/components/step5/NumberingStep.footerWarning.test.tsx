import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
  NumberingStepFooter,
  NumberingTimelineWorkingActions,
} from "./NumberingStep.parts"

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
    expect(screen.getByText("Còn thiếu số hộp").closest(".sticky")).toHaveClass(
      "rounded-2xl",
      "border"
    )
  })

  it("renders timeline and continue actions inside one sticky panel", () => {
    render(
      <NumberingStepFooter
        active={false}
        metadataBusy={false}
        canContinue
        blockedReason={null}
        dossiersWithoutBoxCount={0}
        doneCount={10}
        totalDocuments={10}
        failedCount={0}
        unresolvedCount={0}
        workingActions={
          <NumberingTimelineWorkingActions
            embedded
            busy={false}
            canDiscard
            canSave
            onDiscard={() => undefined}
            onSave={() => undefined}
          />
        }
        onContinue={() => undefined}
      />
    )

    const panel = screen.getByText("Đã sẵn sàng tạo mục lục").closest(".sticky")
    expect(panel).not.toBeNull()
    expect(panel).toContainElement(
      screen.getByRole("button", { name: "Bỏ thay đổi" })
    )
    expect(panel).toContainElement(
      screen.getByRole("button", { name: "Lưu trạng thái" })
    )
    expect(panel).toContainElement(
      screen.getByRole("button", { name: "Tạo mục lục" })
    )
  })
})
