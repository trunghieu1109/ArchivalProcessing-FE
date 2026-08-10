import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const strategySource = await readFile(
  new URL(
    "../src/features/upload/components/step2/FolderTree.strategy.tsx",
    import.meta.url
  ),
  "utf8"
)
const sessionTypesSource = await readFile(
  new URL(
    "../src/features/upload/api/sessionApi.sessionTypes.ts",
    import.meta.url
  ),
  "utf8"
)
const planParsingSource = await readFile(
  new URL("../src/pages/UploadPage.planParsing.ts", import.meta.url),
  "utf8"
)
const progressSource = await readFile(
  new URL(
    "../src/features/upload/components/step4/FinalResult.progress.ts",
    import.meta.url
  ),
  "utf8"
)

test("predefined is available as a dossier build strategy in the folder UI", () => {
  assert.match(sessionTypesSource, /\| "predefined"/)
  assert.match(
    strategySource,
    /onDossierBuildStrategyChange\("predefined"\)/
  )
  assert.match(strategySource, /Giữ nguyên hồ sơ theo folder/)
})

test("predefined is restored from plans and reported as the active job mode", () => {
  assert.match(planParsingSource, /value === "predefined"/)
  assert.match(
    progressSource,
    /payload\?\.dossier_build_strategy === "predefined"/
  )
  assert.match(progressSource, /Đang gợi ý tiêu đề từ nội dung tài liệu/)
})
