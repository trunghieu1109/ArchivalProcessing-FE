import assert from "node:assert/strict"
import test from "node:test"

import {
  SHOW_DOCUMENT_DELETION,
  SHOW_DOCUMENT_DELETION_IN_DOSSIER_STEP,
} from "../src/features/upload/components/step4/temporaryFeatureVisibility.ts"

test("keeps pre-clustering deletion available while hiding it in dossier step", () => {
  assert.equal(SHOW_DOCUMENT_DELETION, true)
  assert.equal(SHOW_DOCUMENT_DELETION_IN_DOSSIER_STEP, false)
})
