import { describe, expect, it } from "vitest"

import {
  resolvePlanInputsReuploaded,
  shouldAnalyzePlanInputsAfterDataUpload,
} from "./UploadPage.workflowPolicy"

describe("supplemental data upload workflow policy", () => {
  it("analyzes re-uploaded plan inputs after data upload succeeds", () => {
    expect(
      shouldAnalyzePlanInputsAfterDataUpload({
        dataUploadSucceeded: true,
        planInputsReuploaded: true,
      })
    ).toBe(true)
  })

  it("uses the live cache when React render state is stale", () => {
    expect(
      resolvePlanInputsReuploaded({
        renderedState: false,
        arrangementCached: false,
        retentionCached: true,
      })
    ).toBe(true)
  })

  it("does not analyze ZIP-only or failed supplemental uploads", () => {
    expect(
      shouldAnalyzePlanInputsAfterDataUpload({
        dataUploadSucceeded: true,
        planInputsReuploaded: false,
      })
    ).toBe(false)
    expect(
      shouldAnalyzePlanInputsAfterDataUpload({
        dataUploadSucceeded: false,
        planInputsReuploaded: true,
      })
    ).toBe(false)
  })
})
