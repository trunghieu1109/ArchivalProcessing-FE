import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("manual dossier classification is wired to a leaf-only tree dialog", async () => {
  const [
    apiSource,
    dialogSource,
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
  assert.match(dialogSource, /const hasChildren = node\.children\.length > 0/)
  assert.match(
    dialogSource,
    /hasChildren \? onToggle\(currentPath\) : onSelect\(currentPath\)/
  )
  assert.match(dialogSource, /Thời hạn bảo quản\s+hiện tại được giữ nguyên/)
  assert.match(dialogSource, /Dialog\.Overlay className="[^"]*z-50[^"]*"/)
  assert.match(dialogSource, /Dialog\.Content className="[^"]*z-\[51\][^"]*"/)
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
