import assert from "node:assert/strict"
import test from "node:test"

import {
  DEFAULT_METADATA_EXPORT_MODE,
  SHOW_DOSSIER_SUGGESTIONS,
  SHOW_DOSSIER_TITLE_CATALOG,
  SHOW_DOCUMENT_DELETION,
  SHOW_DOCUMENT_DELETION_IN_DOSSIER_STEP,
  SHOW_DOCUMENT_TRANSFER,
  SHOW_QUICK_DOSSIER_BUILD,
} from "../src/features/upload/components/step4/temporaryFeatureVisibility.ts"

test("keeps pre-clustering deletion available while hiding it in dossier step", () => {
  assert.equal(SHOW_DOCUMENT_DELETION, true)
  assert.equal(SHOW_DOCUMENT_DELETION_IN_DOSSIER_STEP, false)
})

test("keeps enabled entry points visible while retaining the other temporary UI settings", () => {
  assert.equal(SHOW_QUICK_DOSSIER_BUILD, false)
  assert.equal(SHOW_DOSSIER_TITLE_CATALOG, false)
  assert.equal(SHOW_DOSSIER_SUGGESTIONS, true)
  assert.equal(SHOW_DOCUMENT_TRANSFER, true)
  assert.equal(DEFAULT_METADATA_EXPORT_MODE, "combined")
})
