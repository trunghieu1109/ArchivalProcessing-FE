import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const readSource = (relativePath) =>
  readFile(new URL("../" + relativePath, import.meta.url), "utf8")

test("membership explanation opens in the right panel from the document action", async () => {
  const [apiSource, controllerSource, viewSource, rowSource, panelSource] =
    await Promise.all([
      readSource("src/features/upload/api/sessionApi.clusters.ts"),
      readSource("src/features/upload/components/step4/FinalResult.tsx"),
      readSource("src/features/upload/components/step4/FinalResult.view.tsx"),
      readSource(
        "src/features/upload/components/step4/FinalResult.documentRow.tsx"
      ),
      readSource(
        "src/features/upload/components/step4/DossierMembershipExplanationPanel.tsx"
      ),
    ])

  assert.match(apiSource, /documents\/.*dossier-explanation/)
  assert.match(controllerSource, /handleExplainDocumentMembership/)
  assert.match(controllerSource, /await explainDocumentDossierMembership/)
  assert.doesNotMatch(
    controllerSource,
    /useEffect\([\s\S]{0,300}explainDocumentDossierMembership/
  )
  assert.match(rowSource, /onExplainMembership\(document\)/)
  assert.match(rowSource, /BrainCircuit/)
  assert.match(viewSource, /<DossierMembershipExplanationPanel/)
  assert.match(
    viewSource,
    /presentation="dossier_review"[\s\S]{0,120}className="h-\[calc\(min\(70svh,560px\)\+65px\)\]/
  )
  assert.doesNotMatch(controllerSource, /DossierMembershipExplanationModal/)
  assert.match(panelSource, /nearest_documents/)
  assert.match(panelSource, /Đang phân tích mối liên hệ/)
  assert.match(panelSource, /NeighborDocumentDetails/)
  assert.match(panelSource, /document_summary/)
  assert.match(panelSource, /humanExplanationText/)
  assert.match(panelSource, /documentContentLabel\(result\.document\)/)
  assert.match(panelSource, /Lý do xếp tài liệu vào hồ sơ này/)
  assert.match(panelSource, /Mối quan hệ với các tài liệu gần nhất/)
  assert.match(panelSource, /Thuộc hồ sơ: \{result\.dossier\.title/)
  assert.match(panelSource, /metadataExpanded/)
  assert.match(panelSource, /Xem thông tin tài liệu/)
  assert.match(panelSource, /aria-expanded=\{metadataExpanded\}/)
  assert.match(panelSource, /neighbor\.file_name/)
  assert.match(panelSource, /Ngày ban hành/)
  assert.match(panelSource, /Loại văn bản/)
  assert.match(panelSource, /Cơ quan ban hành/)
  assert.doesNotMatch(panelSource, /Số, ký hiệu/)
  assert.doesNotMatch(panelSource, /Metadata tài liệu đang giải thích/)
  assert.doesNotMatch(panelSource, /Điểm cần lưu ý/)
  assert.doesNotMatch(panelSource, /ConfidenceBadge/)
  assert.doesNotMatch(panelSource, /Tin cậy trung bình/)
  assert.doesNotMatch(
    panelSource,
    /relationship\.relationship_type\.replaceAll/
  )
  assert.doesNotMatch(panelSource, /mentioned_subjects/)
  assert.doesNotMatch(panelSource, /Dialog\./)
})
