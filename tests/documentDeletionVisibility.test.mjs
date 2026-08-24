import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  SHOW_DOCUMENT_DELETION,
  SHOW_DOCUMENT_DELETION_IN_DOSSIER_STEP,
} from "../src/features/upload/components/step4/temporaryFeatureVisibility.ts"

const processStepViewSource = readFileSync(
  new URL(
    "../src/features/upload/components/step3/ProcessStep.view.tsx",
    import.meta.url
  ),
  "utf8"
)
const reviewControlsSource = readFileSync(
  new URL(
    "../src/features/upload/components/step3/ProcessStep.reviewControls.tsx",
    import.meta.url
  ),
  "utf8"
)

test("keeps standalone and dossier-step deletion rollout flags disabled", () => {
  assert.equal(SHOW_DOCUMENT_DELETION, false)
  assert.equal(SHOW_DOCUMENT_DELETION_IN_DOSSIER_STEP, false)
})

test("exposes bulk document deletion to coordinators in multi-select mode", () => {
  assert.match(processStepViewSource, /canDeleteDocuments=\{isCoordinator\}/)
  assert.match(
    processStepViewSource,
    /onDeleteSelected=\{\(\) => openDocumentDeletion\(bulkSelectedItems\)\}/
  )
  assert.match(reviewControlsSource, /Xóa đã chọn \(\{bulkSelectionCount\}\)/)
})
