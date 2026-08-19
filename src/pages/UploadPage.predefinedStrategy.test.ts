import { describe, expect, it } from "vitest"

import {
  activeClusterBuildStrategy,
  dossierBuildStrategyValue,
} from "./UploadPage.planParsing"
import {
  clusterJobModeFromPayload,
  clusterProgressMessageForPhase,
} from "@/features/upload/components/step4/FinalResult.progress"
import type { ClusterVersionResponse } from "@/features/upload/api/sessionApi"

describe("predefined dossier strategy", () => {
  it("normalizes legacy incremental builds to hybrid", () => {
    expect(dossierBuildStrategyValue("incremental")).toBe("hybrid")
    expect(dossierBuildStrategyValue("hybrid")).toBe("hybrid")

    const version = {
      summary: { dossier_build_strategy: "hybrid" },
    } as unknown as ClusterVersionResponse
    expect(activeClusterBuildStrategy(version)).toBe("hybrid")
  })

  it("accepts the strategy in plan and cluster summaries", () => {
    expect(dossierBuildStrategyValue("predefined")).toBe("predefined")
    expect(dossierBuildStrategyValue("unknown")).toBeNull()

    const version = {
      summary: { dossier_build_strategy: "predefined" },
    } as unknown as ClusterVersionResponse
    expect(activeClusterBuildStrategy(version)).toBe("predefined")
  })

  it("infers quick-build progress from the backend payload before source", () => {
    expect(
      clusterJobModeFromPayload({
        source: "system",
        dossier_build_strategy: "predefined",
      })
    ).toBe("predefined")
    expect(
      clusterProgressMessageForPhase("updating_dossiers", "predefined")
    ).toContain("nhanh")
    expect(
      clusterProgressMessageForPhase("naming_dossiers", "predefined")
    ).toContain("nhanh")
  })
})
