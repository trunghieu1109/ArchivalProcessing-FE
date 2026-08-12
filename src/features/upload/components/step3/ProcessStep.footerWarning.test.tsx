import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ProcessStepFooter } from "./ProcessStep.viewParts"

describe("ProcessStepFooter metadata warning", () => {
  it("uses one compact status block for ready and unverified documents", () => {
    render(
      <ProcessStepFooter
        pendingReadyItems={[]}
        pendingReadyCount={24}
        dossierReadyItems={[]}
        dossierReadyCount={6}
        warningCount={24}
        readyItems={[{ id: 1 }]}
        metadataMessage="Đang xử lý metadata"
        canContinue
        buildBlockedMessage=""
        onContinue={() => undefined}
      />
    )

    expect(
      screen.getByText("Còn 24 tài liệu cần chuyên gia xác thực")
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Có thể lập hồ sơ với 6 tài liệu đã được chuyên gia xác thực; 24 tài liệu còn lại chưa được ghi nhận vào hồ sơ."
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Lập hồ sơ (6 tài liệu)" })
    ).toBeEnabled()
  })
})
