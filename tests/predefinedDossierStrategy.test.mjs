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
const planDefaultsSource = await readFile(
  new URL("../src/pages/UploadPage.planDefaults.ts", import.meta.url),
  "utf8"
)
const planUtilsSource = await readFile(
  new URL("../src/pages/UploadPage.planUtils.ts", import.meta.url),
  "utf8"
)
const progressSource = await readFile(
  new URL(
    "../src/features/upload/components/step4/FinalResult.progress.ts",
    import.meta.url
  ),
  "utf8"
)
const finalResultSource = await readFile(
  new URL(
    "../src/features/upload/components/step4/FinalResult.tsx",
    import.meta.url
  ),
  "utf8"
)
const finalResultViewSource = await readFile(
  new URL(
    "../src/features/upload/components/step4/FinalResult.view.tsx",
    import.meta.url
  ),
  "utf8"
)

test("issue-based mode uses hybrid and quick dossier keeps its own strategy", () => {
  assert.match(sessionTypesSource, /\| "predefined"/)
  assert.match(strategySource, /onDossierBuildStrategyChange\("hybrid"\)/)
  assert.match(strategySource, /onDossierBuildStrategyChange\("predefined"\)/)
  assert.match(strategySource, /Lập hồ sơ theo vụ việc/)
  assert.doesNotMatch(strategySource, /Lập hồ sơ kết hợp/)
  assert.match(strategySource, /Lập hồ sơ nhanh/)
  assert.doesNotMatch(
    strategySource,
    /folder nguồn|cấu trúc thư mục|giữ nguyên/i
  )
  assert.match(
    planDefaultsSource,
    /DEFAULT_DOSSIER_BUILD_STRATEGY[\s\S]*"hybrid"/
  )
  assert.match(
    planUtilsSource,
    /dossierBuildStrategy === "incremental" \? "hybrid"/
  )
})

test("legacy incremental is upgraded and predefined is presented as quick mode", () => {
  assert.match(planParsingSource, /value === "predefined"/)
  assert.match(planParsingSource, /value === "incremental"\) return "hybrid"/)
  assert.match(
    progressSource,
    /payload\?\.dossier_build_strategy === "predefined"/
  )
  assert.match(progressSource, /Đang lập hồ sơ nhanh/)
  assert.match(finalResultSource, /Đang lập hồ sơ nhanh/)
  assert.match(finalResultViewSource, /Tiến độ lập hồ sơ nhanh/)
  assert.doesNotMatch(
    `${progressSource}\n${finalResultSource}\n${finalResultViewSource}`,
    /folder nguồn|theo folder|cấu trúc folder|cùng folder/i
  )
})
