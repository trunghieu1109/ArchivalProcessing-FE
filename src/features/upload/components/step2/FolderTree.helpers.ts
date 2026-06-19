import type { FolderNode, PlanCriterionSet } from "@/features/upload/types"

let _idCounter = 100
export function newId() {
  return String(++_idCounter)
}

export const MAX_DEPTH = 2
export const DEPTH_LABELS = ["lớn", "vừa", "nhỏ"]

export interface CriteriaDraft {
  id: string
  groupLevel: string
  criteriaText: string
}

export function addNode(
  nodes: FolderNode[],
  parentId: string,
  newNode: FolderNode
): FolderNode[] {
  return nodes.map((node) => {
    if (node.id === parentId)
      return { ...node, children: [...node.children, newNode] }
    return { ...node, children: addNode(node.children, parentId, newNode) }
  })
}

export function renameNode(
  nodes: FolderNode[],
  id: string,
  name: string
): FolderNode[] {
  return nodes.map((node) => {
    if (node.id === id) return { ...node, name }
    return { ...node, children: renameNode(node.children, id, name) }
  })
}

export function updateDefinition(
  nodes: FolderNode[],
  id: string,
  definition: string
): FolderNode[] {
  return nodes.map((node) => {
    if (node.id === id) return { ...node, definition }
    return {
      ...node,
      children: updateDefinition(node.children, id, definition),
    }
  })
}

export function deleteNode(nodes: FolderNode[], id: string): FolderNode[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) => ({ ...node, children: deleteNode(node.children, id) }))
}

export function planCriteriasToDrafts(
  criterias: PlanCriterionSet[]
): CriteriaDraft[] {
  if (criterias.length === 0) {
    return [
      { id: newId(), groupLevel: "Nhóm lớn", criteriaText: "" },
      { id: newId(), groupLevel: "Nhóm vừa", criteriaText: "" },
    ]
  }
  return criterias.map((criterion) => ({
    id: newId(),
    groupLevel: criterion.group_level,
    criteriaText: criterion.criteria.join("\n"),
  }))
}

export function splitCriteria(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}
