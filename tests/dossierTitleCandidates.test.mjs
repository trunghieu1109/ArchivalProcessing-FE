import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8")

const typesSource = read(
  "src/features/upload/api/sessionApi.clusterTypes.ts"
)
const groupSource = read("src/features/upload/lib/clusterGroups.ts")
const metadataSource = read(
  "src/features/upload/components/step4/FinalResult.metadataUtils.ts"
)
const sidePanelSource = read(
  "src/features/upload/components/step4/FinalResult.sidePanel.tsx"
)
const candidatePanelSource = read(
  "src/features/upload/components/step4/DossierTitleCandidatePanel.tsx"
)

test("dossier responses expose persisted title candidates", () => {
  assert.match(typesSource, /interface DossierTitleCandidate/)
  assert.match(
    typesSource,
    /title_candidates\?: DossierTitleCandidate\[\] \| null/
  )
  assert.match(
    groupSource,
    /titleCandidates: isTemporary \? null : \(dossier\?\.title_candidates \?\? null\)/
  )
  assert.match(
    metadataSource,
    /titleCandidates:\s*dossier\.title_candidates \?\? group\.titleCandidates \?\? null/
  )
})

test("metadata panel lets users choose a persisted candidate as the main title", () => {
  assert.match(sidePanelSource, /DossierTitleCandidatePanel/)
  assert.match(sidePanelSource, /Gợi ý tiêu đề/)
  assert.match(sidePanelSource, /new Set<keyof DossierMetadataDraft>\(\["title"\]\)/)
  assert.match(candidatePanelSource, /Đề xuất chính ban đầu/)
  assert.match(candidatePanelSource, /Đang được dùng làm tiêu đề chính/)
  assert.match(candidatePanelSource, /disabled=\{saving \|\| isCurrent\}/)
})
