import assert from "node:assert/strict"
import test from "node:test"

import { isMetadataDiscoveryPending } from "../src/pages/UploadPage.metadataDiscovery.ts"

const readyRun = {
  currentStep: 3,
  targetIngestionRunId: 42,
  targetIngestionRunStatus: "ready",
}

test("shows discovery notice while the target batch is still discovering documents", () => {
  assert.equal(
    isMetadataDiscoveryPending({
      ...readyRun,
      batchDiscoveryComplete: false,
    }),
    true
  )
})

test("keeps document refreshes silent after batch discovery is complete", () => {
  assert.equal(
    isMetadataDiscoveryPending({
      ...readyRun,
      batchDiscoveryComplete: true,
    }),
    false
  )
})

test("does not show discovery notice outside the metadata step", () => {
  assert.equal(
    isMetadataDiscoveryPending({
      ...readyRun,
      currentStep: 2,
      batchDiscoveryComplete: false,
    }),
    false
  )
})
