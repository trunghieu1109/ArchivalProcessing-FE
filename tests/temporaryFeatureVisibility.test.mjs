import assert from "node:assert/strict"
import test from "node:test"

import {
  SHOW_DOCUMENT_TRANSFER,
  SHOW_SUPPLEMENTAL_INTAKE,
} from "../src/features/upload/components/step4/temporaryFeatureVisibility.ts"

test("temporarily hides document transfer and supplemental intake", () => {
  assert.equal(SHOW_DOCUMENT_TRANSFER, false)
  assert.equal(SHOW_SUPPLEMENTAL_INTAKE, false)
})
