import type { DocumentTransferClassificationLeaf } from "@/features/upload/api/sessionApi"

export interface ClassificationTreeNode {
  key: string
  groupId: string
  name: string
  children: ClassificationTreeNode[]
  leaf?: DocumentTransferClassificationLeaf
}

export function classificationLeafKey(
  leaf: DocumentTransferClassificationLeaf
): string {
  return JSON.stringify(leaf.group_ids)
}

export function buildClassificationTree(
  leaves: DocumentTransferClassificationLeaf[]
): ClassificationTreeNode[] {
  const roots: ClassificationTreeNode[] = []
  leaves.forEach((leaf) => {
    let siblings = roots
    leaf.group_ids.forEach((groupId, index) => {
      const key = JSON.stringify(leaf.group_ids.slice(0, index + 1))
      let node = siblings.find((candidate) => candidate.key === key)
      if (!node) {
        node = {
          key,
          groupId,
          name: leaf.group_path[index] || groupId,
          children: [],
        }
        siblings.push(node)
      }
      if (index === leaf.group_ids.length - 1) node.leaf = leaf
      siblings = node.children
    })
  })
  return roots
}
