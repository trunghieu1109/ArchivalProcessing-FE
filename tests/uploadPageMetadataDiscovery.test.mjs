import assert from "node:assert/strict"
import test from "node:test"

import { isMetadataDiscoveryPending } from "../src/pages/UploadPage.metadataDiscovery.ts"

const pendingStatus = {
  ingestion_runs: [{ id: 7, status: "ready" }],
  updating_ingestion_runs: 1,
  updating_ingestion_run_ids: [7],
}

test("hiển thị discovery khi target run ready và batch còn cập nhật", () => {
  assert.equal(
    isMetadataDiscoveryPending({
      currentStep: 3,
      targetIngestionRunId: 7,
      status: pendingStatus,
    }),
    true
  )
})

test("không hiển thị discovery ngoài bước metadata", () => {
  assert.equal(
    isMetadataDiscoveryPending({
      currentStep: 2,
      targetIngestionRunId: 7,
      status: pendingStatus,
    }),
    false
  )
})

test("không hiển thị discovery khi không có target run", () => {
  assert.equal(
    isMetadataDiscoveryPending({
      currentStep: 3,
      targetIngestionRunId: null,
      status: pendingStatus,
    }),
    false
  )
})

test("không hiển thị discovery khi target run chưa ready", () => {
  assert.equal(
    isMetadataDiscoveryPending({
      currentStep: 3,
      targetIngestionRunId: 7,
      status: {
        ingestion_runs: [{ id: 7, status: "extracting" }],
        updating_ingestion_runs: 1,
      },
    }),
    false
  )
})

test("không hiển thị discovery khi batch đã cập nhật xong", () => {
  assert.equal(
    isMetadataDiscoveryPending({
      currentStep: 3,
      targetIngestionRunId: 7,
      status: {
        ingestion_runs: [{ id: 7, status: "ready" }],
        updating_ingestion_runs: 0,
        updating_ingestion_run_ids: [],
      },
    }),
    false
  )
})

test("không dùng trạng thái discovery của ingestion run khác", () => {
  assert.equal(
    isMetadataDiscoveryPending({
      currentStep: 3,
      targetIngestionRunId: 7,
      status: {
        ingestion_runs: [
          { id: 7, status: "ready" },
          { id: 8, status: "ready" },
        ],
        updating_ingestion_runs: 1,
        updating_ingestion_run_ids: [8],
      },
    }),
    false
  )
})
