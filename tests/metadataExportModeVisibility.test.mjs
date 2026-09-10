import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const numberingSource = await readFile(
  new URL(
    "../src/features/upload/components/step5/NumberingStep.tsx",
    import.meta.url
  ),
  "utf8"
)
const finalizeSource = await readFile(
  new URL("../src/pages/FinalizeArtifactsPage.tsx", import.meta.url),
  "utf8"
)
const finalizeToolbarSource = await readFile(
  new URL("../src/pages/FinalizeArtifactsPage.parts.tsx", import.meta.url),
  "utf8"
)
const numberingPartsSource = await readFile(
  new URL(
    "../src/features/upload/components/step5/NumberingStep.parts.tsx",
    import.meta.url
  ),
  "utf8"
)

test("both metadata export flows use the mixed/combined mode", () => {
  assert.match(
    numberingSource,
    /metadata_export_mode: DEFAULT_METADATA_EXPORT_MODE/
  )
  assert.match(
    finalizeSource,
    /metadata_export_mode: DEFAULT_METADATA_EXPORT_MODE/
  )
})

test("metadata export mode selectors are not rendered", () => {
  assert.doesNotMatch(finalizeToolbarSource, /role="radiogroup"/)
  assert.doesNotMatch(numberingPartsSource, /MetadataExportDialog/)
  assert.doesNotMatch(numberingPartsSource, /mode: "separated"/)
})
