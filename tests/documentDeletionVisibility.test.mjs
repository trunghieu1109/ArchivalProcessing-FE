import assert from "node:assert/strict"
import test from "node:test"

import {
  SHOW_DOCUMENT_DELETION,
  SHOW_DOCUMENT_DELETION_IN_DOSSIER_STEP,
} from "../src/features/upload/components/step4/temporaryFeatureVisibility.ts"

test("shows deletion before clustering and hides it in the dossier step", () => {
  assert.equal(SHOW_DOCUMENT_DELETION, true)
  assert.equal(SHOW_DOCUMENT_DELETION_IN_DOSSIER_STEP, false)
})
