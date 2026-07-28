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
      screen.getByText("Còn 24 tài liệu chưa xác minh metadata")
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "6 tài liệu đã đủ điều kiện. Bạn vẫn có thể lập hồ sơ, nhưng nên xác minh trước để dữ liệu đầy đủ hơn."
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Lập hồ sơ (6 tài liệu)" })
    ).toBeEnabled()
  })
})
