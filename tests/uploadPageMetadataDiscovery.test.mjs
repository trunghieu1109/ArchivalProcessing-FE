import assert from "node:assert/strict"
import test from "node:test"

import { isMetadataDiscoveryPending } from "../src/pages/UploadPage.metadataDiscovery.ts"
import { hasPendingLatestBatchDiscovery } from "../src/features/upload/hooks/useOcrFolderPolling.ts"

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

test("uses fast polling only while the latest OCR batch is discovering", () => {
  assert.equal(
    hasPendingLatestBatchDiscovery({
      batches: [
        { id: 1, remote_discovery_complete: false },
        { id: 2, remote_discovery_complete: true },
      ],
    }),
    false
  )
  assert.equal(
    hasPendingLatestBatchDiscovery({
      batches: [
        { id: 1, remote_discovery_complete: true },
        { id: 2, remote_discovery_complete: false },
      ],
    }),
    true
  )
  assert.equal(hasPendingLatestBatchDiscovery({ batches: [] }), false)
})
