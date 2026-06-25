import type {
  SessionInputFileType,
  SessionInputUploadResponse,
} from "@/features/upload/api/sessionApi"
import type { FolderNode, ParsedPlan, PlanGroup } from "@/features/upload/types"

export * from "./UploadPage.planDefaults"
export {
  activeClusterBuildStrategy,
  activePlanBuildStrategy,
  activePlanDocumentNumberingMode,
  activePlanDocumentNumberingStyleOverrides,
  activePlanDocumentNumberingStylePreset,
  activePlanToParsedPlan,
  documentNumberingModeValue,
  documentNumberingStylePresetValue,
  dossierBuildStrategyValue,
} from "./UploadPage.planParsing"

let _nodeId = 1000
export function nid() {
  return String(++_nodeId)
}

export function planToTree(plan: ParsedPlan): FolderNode[] {
  return plan.groups.map(groupToTreeNode)
}

function groupToTreeNode(group: PlanGroup): FolderNode {
  return {
    id: group.id || nid(),
    name: group.name,
    type: group.type,
    definition: group.definition,
    candidates: group.candidates ?? [],
    children: group.children.map(groupToTreeNode),
    criteria: [],
  }
}

export function treeToPlanGroups(nodes: FolderNode[], depth = 1): PlanGroup[] {
  return nodes.map((node) => ({
    id: node.id || nid(),
    name: node.name,
    type: node.type || `level-${depth}`,
    definition: node.definition ?? "",
    children: treeToPlanGroups(node.children, depth + 1),
  }))
}

export function treeToFlatGroups(nodes: FolderNode[]): Array<{
  id: string
  name: string
  type: string
  parent: Array<string | number>
  definition: string
}> {
  type FlatGroupDraft = {
    id: string
    name: string
    type: string
    depth: number
    parentRefs: Set<string | number>
    definition: string
  }
  const byGroup = new Map<string, FlatGroupDraft>()

  const visit = (
    values: FolderNode[],
    depth = 1,
    parentId: string | null = null
  ) => {
    values.forEach((node) => {
      const type = node.type || `level-${depth}`
      const id = node.id || nid()
      const key = `${type}:${id}`
      const parentRef: string | number = parentId
        ? `level-${depth - 1}-${parentId}`
        : -1
      const existing = byGroup.get(key)
      if (existing) {
        existing.parentRefs.add(parentRef)
        if (node.name) existing.name = node.name
        if (node.definition !== undefined) {
          existing.definition = node.definition ?? ""
        }
      } else {
        byGroup.set(key, {
          id,
          name: node.name,
          type,
          depth,
          parentRefs: new Set([parentRef]),
          definition: node.definition ?? "",
        })
      }
      visit(node.children, depth + 1, id)
    })
  }

  visit(nodes)

  return Array.from(byGroup.values()).map((group) => ({
    id: group.id,
    name: group.name,
    type: group.type,
    parent:
      group.depth > 1 && group.parentRefs.size > 1
        ? [-1]
        : Array.from(group.parentRefs),
    definition: group.definition,
  }))
}

export function stageInput(
  fileType: SessionInputFileType,
  file: File
): SessionInputUploadResponse {
  const folderPath =
    fileType === "raw_zip" ? folderPathFromZipName(file.name) : undefined
  return {
    id: 0,
    session_id: "draft",
    file_type: fileType,
    file_name: file.name,
    local_cached_path: null,
    data_path: folderPath,
    checksum: null,
    folder_path: folderPath,
  }
}

export function folderPathFromZipName(fileName: string): string {
  const stem = fileName.replace(/\.zip$/i, "").trim()
  return stem
    .split("_")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/")
}
