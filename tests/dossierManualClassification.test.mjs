import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("manual dossier classification is wired to a leaf-only tree dialog", async () => {
  const [apiSource, dialogSource, resultNodeSource, uploadViewSource] =
    await Promise.all([
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
})
