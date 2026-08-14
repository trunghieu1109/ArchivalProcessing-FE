import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("single-dossier classification refresh is wired from API to dossier row", async () => {
  const apiSource = await readFile(
    new URL(
      "../src/features/upload/api/sessionApi.clusters.ts",
      import.meta.url
    ),
    "utf8"
  )
  const actionSource = await readFile(
    new URL(
      "../src/features/upload/components/step4/useFinalResultTreeActions.ts",
      import.meta.url
    ),
    "utf8"
  )
  const rowSource = await readFile(
    new URL(
      "../src/features/upload/components/step4/FinalResult.resultNode.tsx",
      import.meta.url
    ),
    "utf8"
  )

  assert.match(
    apiSource,
    /dossiers\/\$\{encodeURIComponent\(dossierId\)\}\/classification\/refresh/
  )
  assert.match(
    actionSource,
    /refreshSessionDossierClassification\([\s\S]*updateDossierGroupFromResponse\([\s\S]*updateClusterVersionDossier/
  )
  assert.match(rowSource, /Phân loại lại hồ sơ vào các nhóm/)
  assert.match(rowSource, /classificationRefreshBusy/)
})
