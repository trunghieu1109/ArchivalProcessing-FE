import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const readSource = (relativePath) =>
  readFile(new URL("../" + relativePath, import.meta.url), "utf8")

test("warning review identifies active warnings and keeps a metadata fallback", async () => {
  const source = await readSource(
    "src/features/upload/components/step4/FinalResult.warningReview.ts"
  )

  assert.match(source, /sourceGroup\.documents\.flatMap\(\(document\) =>/)
  assert.match(source, /warningDocumentEntries/)
  assert.match(source, /warningReviewSuggestionCandidates/)
  assert.match(source, /pendingAction !== "manual_move"/)
  assert.match(source, /document\.dossierSuggestions\?\.length/)
  assert.match(source, /nearestOtherClusterSimilarity/)
  assert.doesNotMatch(
    source,
    /requestJson|fetch\(|method:\s*["'](?:POST|PATCH|DELETE)/
  )
})

test("warning review expands suggested dossiers with document metadata and can move a document", async () => {
  const [
    viewSource,
    reviewSource,
    suggestionSource,
    warningPanelSource,
    warningUtilsSource,
    controllerSource,
    apiSource,
  ] = await Promise.all([
    readSource("src/features/upload/components/step4/FinalResult.view.tsx"),
    readSource(
      "src/features/upload/components/step4/FinalResult.warningReviewView.tsx"
    ),
    readSource(
      "src/features/upload/components/step4/FinalResult.warningSuggestionList.tsx"
    ),
    readSource(
      "src/features/upload/components/step4/FinalResult.warningPanel.tsx"
    ),
    readSource(
      "src/features/upload/components/step4/FinalResult.warningUtils.ts"
    ),
    readSource("src/features/upload/components/step4/FinalResult.tsx"),
    readSource("src/features/upload/api/sessionApi.clusters.ts"),
  ])

  assert.match(viewSource, /Gợi ý điều chỉnh hồ sơ/)
  assert.match(viewSource, /<WarningDocumentsReview/)
  assert.match(
    viewSource,
    /suggestions=\{selectedDossierSuggestionCandidates\}/
  )
  assert.match(
    viewSource,
    /onMoveSuggestion=\{handleMoveWarningDossierSuggestion\}/
  )
  assert.match(
    viewSource,
    /resultViewMode === "default" \? \(\s*<FinalResultFeedbackPanel/
  )
  assert.match(
    viewSource,
    /SHOW_DOSSIER_SUGGESTIONS &&\s*resultViewMode === "default"/
  )
  assert.match(reviewSource, /Tài liệu cần xem xét/)
  assert.doesNotMatch(reviewSource, /bị cảnh báo|cần xử lý/)
  assert.match(reviewSource, /Rà soát các gợi ý điều chỉnh/)
  assert.match(warningPanelSource, /Gợi ý rà soát hồ sơ/)
  assert.match(warningUtilsSource, /Cần kiểm tra/)
  assert.match(warningUtilsSource, /border-amber-300 bg-amber-50/)
  assert.match(reviewSource, /Đã chuyển/)
  assert.match(reviewSource, /Đã điều chỉnh/)
  assert.match(reviewSource, /Hồ sơ được gợi ý/)
  assert.doesNotMatch(reviewSource, /Cây hồ sơ và tài liệu/)
  assert.doesNotMatch(viewSource, /tree=\{tree\}/)
  assert.match(
    reviewSource,
    /xl:grid-cols-\[minmax\(320px,0\.72fr\)_minmax\(560px,1\.48fr\)\]/
  )
  assert.match(suggestionSource, /Danh sách tài liệu và metadata/)
  assert.match(suggestionSource, /mentioned_subjects/)
  assert.match(suggestionSource, /aria-expanded=\{expanded\}/)
  assert.doesNotMatch(suggestionSource, /label="Mã hồ sơ"/)
  assert.match(suggestionSource, /border-blue-200 bg-blue-50/)
  assert.match(suggestionSource, /bg-\[#EEF3F8\]/)
  assert.match(suggestionSource, /text-\[#0F172A\]/)
  assert.match(suggestionSource, /Chuyển tới hồ sơ này/)
  assert.match(
    controllerSource,
    /await suggestSelectedDocumentDossiers\(sessionId/
  )
  assert.match(
    controllerSource,
    /await handleMoveDossierSuggestion\(suggestion\)/
  )
  assert.match(apiSource, /clusters\/selected-documents\/dossier-suggestions/)
})

test("a warned document moved to another dossier gets a distinct tag", async () => {
  const [tagSource, documentRowSource, pendingFeedbackSource] =
    await Promise.all([
      readSource(
        "src/features/upload/components/step4/FinalResult.documentStatusTags.tsx"
      ),
      readSource(
        "src/features/upload/components/step4/FinalResult.documentRow.tsx"
      ),
      readSource(
        "src/features/upload/components/step4/FinalResult.pendingFeedback.ts"
      ),
    ])

  assert.match(
    tagSource,
    /clusterWarning && document\.pendingFeedback\?\.action === "manual_move"/
  )
  assert.match(tagSource, /Đã chuyển theo gợi ý/)
  assert.match(tagSource, /pendingFeedbackActionLabel/)
  assert.match(documentRowSource, /<DocumentStatusTags/)
  assert.match(
    pendingFeedbackSource,
    /action === "move_selected_documents" \? "manual_move" : action/
  )
})
