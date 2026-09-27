import { beforeEach, describe, expect, it } from "vitest"

import {
  HOMOGENEOUS_WORKFLOW_LABELS,
  homogeneousContinuationStep,
  homogeneousHeaderStepForAppStep,
  homogeneousWorkflowRoute,
  isHomogeneousWorkflow,
  markHomogeneousWorkflow,
} from "./homogeneousWorkflow"

describe("homogeneous workflow navigation", () => {
  beforeEach(() => window.sessionStorage.clear())

  it("inserts cluster review and provisional dossiers before official results", () => {
    expect(HOMOGENEOUS_WORKFLOW_LABELS).toHaveLength(9)
    expect(homogeneousHeaderStepForAppStep(3)).toBe(3)
    expect(homogeneousHeaderStepForAppStep(4)).toBe(6)
    expect(homogeneousWorkflowRoute("session one", 4)).toBe(
      "/sessions/session%20one/clusters/review"
    )
    expect(homogeneousWorkflowRoute("session one", 5)).toBe(
      "/sessions/session%20one/dossiers/compose"
    )
    expect(homogeneousWorkflowRoute("session one", 6)).toBe(
      "/sessions/session%20one/step/4"
    )
  })

  it("keeps the extended stepper active for the rest of the session", () => {
    expect(isHomogeneousWorkflow("session-1")).toBe(false)
    markHomogeneousWorkflow("session-1")
    expect(isHomogeneousWorkflow("session-1")).toBe(true)
  })

  it("resumes an existing homogeneous workflow without rebuilding it", () => {
    expect(
      homogeneousContinuationStep({
        hasCurrentVersion: true,
        provisionalDossierStatuses: ["promoted", "draft"],
      })
    ).toBe(5)
    expect(
      homogeneousContinuationStep({
        hasCurrentVersion: true,
        provisionalDossierStatuses: ["promoted"],
      })
    ).toBe(4)
  })

  it("rebuilds when there is no current version or the version is stale", () => {
    expect(
      homogeneousContinuationStep({ hasCurrentVersion: false })
    ).toBeNull()
    expect(
      homogeneousContinuationStep({
        hasCurrentVersion: true,
        versionIsStale: true,
        provisionalDossierStatuses: ["draft"],
      })
    ).toBeNull()
  })
})
