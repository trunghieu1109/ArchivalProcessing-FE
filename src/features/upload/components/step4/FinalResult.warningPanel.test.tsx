import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { ClusterDocumentWarning } from "@/features/upload/lib/clusterGroups"
import { ClusterWarningPanel } from "./FinalResult.warningPanel"

const baseWarning: ClusterDocumentWarning = {
  riskLevel: "low",
  riskScore: 0.2,
  reasons: ["closer_to_another_cluster"],
  message: "",
  displayMessages: ["Tài liệu có thể phù hợp với hồ sơ khác hơn."],
  clusterId: "cluster-1",
  currentDossierTitle: "Hồ sơ hiện tại",
  nearestOtherClusterId: "cluster-2",
  nearestOtherDossierTitle: "Hồ sơ được gợi ý",
  nearestOtherClusterSimilarity: 0.8,
  nearestOtherClusterRepresentativeId: "document-2",
  nearestOtherRepresentativeFileName: "tai-lieu-2.pdf",
  nearestOtherRepresentativeTitle: "Tài liệu đại diện",
  nearestOtherRepresentativeDocuments: [],
  meanSimilarityToCluster: 0.3,
  clusterMedianDocSimilarity: 0.5,
  otherClusterMargin: 0.2,
  documentYear: "2025",
  documentIssuedDate: "01/01/2025",
  dominantClusterYear: "2024",
  dominantYearRatio: 0.75,
  currentDossierDateRange: "2024",
}

describe("ClusterWarningPanel semantic tones", () => {
  it("uses the blue suggestion treatment for a non-blocking warning", () => {
    render(
      <ClusterWarningPanel
        warning={baseWarning}
        expanded={false}
        onToggle={() => undefined}
      />
    )

    const panel = screen.getByText("Gợi ý rà soát hồ sơ").closest("div")
    expect(panel).toHaveClass("border-[#BFD3FF]", "bg-[#F8FAFF]")
  })

  it("keeps the amber warning treatment for a high-risk item", () => {
    render(
      <ClusterWarningPanel
        warning={{ ...baseWarning, riskLevel: "high" }}
        expanded={false}
        onToggle={() => undefined}
      />
    )

    const panel = screen.getByText("Cảnh báo hồ sơ").closest("div")
    expect(panel).toHaveClass("border-amber-300", "bg-amber-50")
  })
})
