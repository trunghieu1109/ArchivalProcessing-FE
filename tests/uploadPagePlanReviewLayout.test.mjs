import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const viewSource = await readFile(
  new URL("../src/pages/UploadPage.view.tsx", import.meta.url),
  "utf8"
)
const folderTreeSource = await readFile(
  new URL(
    "../src/features/upload/components/step2/FolderTree.tsx",
    import.meta.url
  ),
  "utf8"
)

test("hiển thị PAPL và THBQ thành hai vùng nội dung độc lập, không có thẻ giới thiệu", () => {
  assert.doesNotMatch(viewSource, /PlanRetentionStatusCards/)
  assert.doesNotMatch(viewSource, /Phần 1/)
  assert.doesNotMatch(viewSource, /Phần 2/)
  assert.doesNotMatch(viewSource, /Hiển thị kết quả PAPL/)
  assert.doesNotMatch(viewSource, /Hiển thị kết quả THBQ/)
  assert.match(viewSource, /<RetentionAppendicesPanel/)
  assert.match(viewSource, /showRetentionSection=\{false\}/)
})

test("hiển thị timeline trong vùng THBQ khi phân tích THBQ riêng", () => {
  assert.match(
    viewSource,
    /planAnalyzing && !planAnalysisFailure[\s\S]*?<ProgressTimeline[\s\S]*?activePhase=\{planProgressPhase\}/
  )
})

test("đặt thanh hành động sau cả vùng PAPL và THBQ", () => {
  const retentionSectionPosition = viewSource.indexOf("<RetentionAppendicesPanel")
  const actionsPosition = viewSource.lastIndexOf("<PlanReviewActions")

  assert.ok(retentionSectionPosition >= 0)
  assert.ok(actionsPosition > retentionSectionPosition)
  assert.match(viewSource, /showActions=\{false\}/)
  assert.match(folderTreeSource, /showActions &&/)
})
