import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8")

const typesSource = read("src/features/upload/api/sessionApi.sessionTypes.ts")
const uploadApiSource = read("src/features/upload/api/sessionApi.upload.ts")
const workflowSource = read("src/pages/UploadPage.workflow.ts")
const stepOneSource = read("src/pages/UploadPage.step1.tsx")
const componentSource = read(
  "src/features/upload/components/step1/DossierTitleCatalogSection.tsx"
)
const previewSource = read(
  "src/features/upload/components/step2/DossierTitleMappingPreview.tsx"
)
const strategySource = read(
  "src/features/upload/components/step2/FolderTree.strategy.tsx"
)

test("dossier title catalog has a dedicated session input API", () => {
  assert.match(typesSource, /"dossier_title_catalog"/)
  assert.match(uploadApiSource, /inputs\/dossier-title-catalog/)
  assert.match(uploadApiSource, /method: "DELETE"/)
})

test("new-session workflow waits for the staged title catalog upload", () => {
  assert.match(workflowSource, /draftDossierTitleCatalogFile/)
  assert.match(workflowSource, /dossierTitleCatalogUploadTask/)
  assert.match(workflowSource, /uploadDossierTitleCatalog/)
})

test("upload page renders the optional xlsx title catalog box", () => {
  assert.match(stepOneSource, /DossierTitleCatalogSection/)
  assert.match(componentSource, /accept="\.xlsx"/)
  assert.match(componentSource, /Upload dữ liệu/)
  assert.match(componentSource, /Tải file dữ liệu/)
  assert.doesNotMatch(componentSource, /tiêu đề hồ sơ/i)
  assert.match(componentSource, /mapping_count/)
  assert.match(componentSource, /Đã phân tích thành công file dữ liệu/)
})

test("quick dossier mode lazily previews paginated title mappings", () => {
  assert.match(uploadApiSource, /getDossierTitleCatalogMappings/)
  assert.match(uploadApiSource, /dossier-title-catalog\/mappings/)
  assert.match(strategySource, /dossierBuildStrategy === "predefined"/)
  assert.match(strategySource, /DossierTitleMappingPreview/)
  assert.match(previewSource, /Mã tạm/)
  assert.match(previewSource, /Tiêu đề hồ sơ/)
  assert.match(previewSource, /retention_period/)
  assert.match(typesSource, /retention_period: string \| null/)
  assert.match(previewSource, /PaginationControls/)
})
