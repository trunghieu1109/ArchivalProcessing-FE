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
    readFile(
      new URL(
        "../src/features/upload/api/sessionApi.clusters.ts",
        import.meta.url
      ),
      "utf8"
    ),
    readFile(
      new URL(
        "../src/features/upload/components/step4/FinalResult.manualClassificationDialog.tsx",
        import.meta.url
      ),
      "utf8"
    ),
    readFile(
      new URL(
        "../src/features/upload/components/step4/FinalResult.tsx",
        import.meta.url
      ),
      "utf8"
    ),
    readFile(
      new URL(
        "../src/features/upload/components/step4/FinalResult.view.tsx",
        import.meta.url
      ),
      "utf8"
    ),
    readFile(
      new URL(
        "../src/features/upload/components/step4/FinalResult.resultNode.tsx",
        import.meta.url
      ),
      "utf8"
    ),
    readFile(
      new URL("../src/pages/UploadPage.view.tsx", import.meta.url),
      "utf8"
    ),
    readFile(
      new URL(
        "../src/features/upload/components/step4/useFinalResultTreeActions.ts",
        import.meta.url
      ),
      "utf8"
    ),
    readFile(
      new URL(
        "../src/features/upload/components/step4/FinalResult.treeUtils.ts",
        import.meta.url
      ),
      "utf8"
    ),
  ])

  assert.match(
    apiSource,
    /dossiers\/\$\{encodeURIComponent\(dossierId\)\}\/classification\/manual/
  )
  assert.match(apiSource, /plan_version_id: string[\s\S]*group_ids: string\[\]/)
  assert.match(panelSource, /const hasChildren = node\.children\.length > 0/)
  assert.match(
    panelSource,
    /hasChildren \? onToggle\(currentPath\) : onSelect\(currentPath\)/
  )
  assert.doesNotMatch(panelSource, /Phân loại hiện tại/)
  assert.doesNotMatch(panelSource, /Thời hạn bảo quản hiện tại/)
  assert.match(panelSource, /Nhóm sẽ chuyển đến/)
  assert.doesNotMatch(panelSource, /Dialog\./)
  assert.match(
    panelSource,
    /export const ManualClassificationPanel = memo\(/
  )
  assert.match(panelSource, /h-\[calc\(min\(70svh,560px\)\+65px\)\]/)
  assert.match(panelSource, /overflow-y-auto/)
  assert.match(panelSource, /name="manual-classification-search"/)
  assert.match(panelSource, /Chuyển đến thư mục này/)
  assert.match(
    finalResultSource,
    /manualClassificationGroup \|\|[\s\S]*previewDocument/
  )
  assert.match(
    finalResultSource,
    /manualClassificationWidthPercent[\s\S]*useState\(30\)/
  )
  assert.match(
    finalResultViewSource,
    /manualClassificationGroup \? \([\s\S]*<ManualClassificationPanel/
  )
  assert.match(
    finalResultViewSource,
    /100 - manualClassificationWidthPercent[\s\S]*minmax\(340px, \$\{manualClassificationWidthPercent\}fr\)/
  )
  assert.match(resultNodeSource, /Phân loại thủ công/)
  assert.match(uploadViewSource, /classificationTree=\{activeFolderTree\}/)
  assert.match(
    uploadViewSource,
    /const resolvedSessionId = routeSessionId \?\? sessionId \?\? null/
  )
  assert.match(
    uploadViewSource,
    /<FinalResult[\s\S]*?sessionId=\{resolvedSessionId\}/
  )

  const manualActionStart = actionSource.indexOf(
    "const handleApplyManualDossierClassification"
  )
  const manualActionEnd = actionSource.indexOf(
    "const handleSaveDocumentMetadata",
    manualActionStart
  )
  assert.notEqual(manualActionStart, -1)
  assert.notEqual(manualActionEnd, -1)
  const manualActionSource = actionSource.slice(
    manualActionStart,
    manualActionEnd
  )
  assert.match(
    manualActionSource,
    /const handleApplyManualDossierClassification = useCallback\(\s*async/
  )
  assert.match(
    manualActionSource,
    /feedbackHydrationRevisionRef\.current \+= 1[\s\S]*setGroups\([\s\S]*setDisplayedClusterVersion\([\s\S]*setPendingFeedbackRefreshKey\(/
  )

  const resultTreePathStart = treeUtilsSource.indexOf(
    "export function resultTreePath"
  )
  const resultTreePathEnd = treeUtilsSource.indexOf(
    "export function isYearPathSegment",
    resultTreePathStart
  )
  assert.notEqual(resultTreePathStart, -1)
  assert.notEqual(resultTreePathEnd, -1)
  const resultTreePathSource = treeUtilsSource.slice(
    resultTreePathStart,
    resultTreePathEnd
  )
  assert.match(
    resultTreePathSource,
    /if \(hasClassificationYear\)[\s\S]*return \[segment\]/
  )
  assert.doesNotMatch(
    resultTreePathSource,
    /hasKnownYear \? yearLabel : segment/
  )
})
