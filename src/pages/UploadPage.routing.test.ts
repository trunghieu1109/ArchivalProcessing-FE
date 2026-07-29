import { describe, expect, it } from "vitest"

import { workflowStepFromLocation } from "./UploadPage.routing"

describe("workflowStepFromLocation", () => {
  it("uses the URL pathname when the route param is stale", () => {
    expect(workflowStepFromLocation("5", "/sessions/session-1/step/6")).toBe(6)
  })

  it("normalizes invalid and out-of-range steps", () => {
    expect(
      workflowStepFromLocation(undefined, "/sessions/session-1/step/nope")
    ).toBe(1)
    expect(workflowStepFromLocation("9", "/sessions/session-1/step/9")).toBe(7)
  })
})
