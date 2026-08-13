import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("manual dossier classification is wired to a leaf-only side panel", async () => {
  const [
    apiSource,
    panelSource,
    finalResultSource,
    finalResultViewSource,
    resultNodeSource,
    uploadViewSource,
    actionSource,
    treeUtilsSource,
  ] = await Promise.all([
    readFile(new URL("../src/features/upload/api/sessionApi.clusters.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/features/upload/components/step4/FinalResult.manualClassificationDialog.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/upload/components/step4/FinalResult.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/upload/components/step4/FinalResult.view.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/upload/components/step4/FinalResult.resultNode.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/pages/UploadPage.view.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/upload/components/step4/useFinalResultTreeActions.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/features/upload/components/step4/FinalResult.treeUtils.ts", import.meta.url), "utf8"),
  ])

  assert.match(apiSource, /classification\/manual/)
  assert.match(apiSource, /plan_version_id: string[\s\S]*group_ids: string\[\]/)
  assert.match(panelSource, /const hasChildren = node\.children\.length > 0/)
  assert.match(panelSource, /hasChildren \? onToggle\(currentPath\) : onSelect\(currentPath\)/)
  assert.doesNotMatch(panelSource, /Dialog\./)
  assert.match(panelSource, /export const ManualClassificationPanel = memo\(/)
  assert.match(panelSource, /overflow-y-auto/)
  assert.match(panelSource, /Chuyển đến thư mục này/)
  assert.match(finalResultSource, /manualClassificationWidthPercent[\s\S]*useState\(30\)/)
  assert.match(finalResultViewSource, /100 - manualClassificationWidthPercent[\s\S]*minmax\(340px, \$\{manualClassificationWidthPercent\}fr\)/)
  assert.match(resultNodeSource, /Phân loại thủ công/)
  assert.match(uploadViewSource, /classificationTree=\{activeFolderTree\}/)
  assert.match(uploadViewSource, /const resolvedSessionId = routeSessionId \?\? sessionId \?\? null/)
  assert.match(uploadViewSource, /<FinalResult[\s\S]*?sessionId=\{resolvedSessionId\}/)
  assert.match(actionSource, /feedbackHydrationRevisionRef\.current \+= 1[\s\S]*setGroups\([\s\S]*setDisplayedClusterVersion\([\s\S]*setPendingFeedbackRefreshKey\(/)

  const resultTreePathSource = treeUtilsSource.slice(
    treeUtilsSource.indexOf("export function resultTreePath"),
    treeUtilsSource.indexOf("export function isYearPathSegment")
  )
  assert.match(resultTreePathSource, /if \(hasClassificationYear\)[\s\S]*return \[segment\]/)
  assert.doesNotMatch(resultTreePathSource, /hasKnownYear \? yearLabel : segment/)
})
