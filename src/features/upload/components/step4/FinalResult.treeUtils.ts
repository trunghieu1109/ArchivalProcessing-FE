import type { ClusterGroup } from "@/features/upload/lib/clusterGroups"
import {
  UNKNOWN_YEAR_LABEL,
  dossierPageCount,
  dossierYearLabel,
} from "./FinalResult.metadataUtils"
import type { DraggedDocument, ResultTreeNode } from "./FinalResult.types"

const UNCLASSIFIED_LABEL = "Chưa phân loại"

export function buildResultTree(groups: ClusterGroup[]): ResultTreeNode[] {
  const roots: ResultTreeNode[] = []
  const rootByLabel = new Map<string, ResultTreeNode>()

  groups
    .filter((group) => group.isTemporary)
    .forEach((group) => {
      roots.push({
        id: `temporary:${group.id}`,
        label: group.label,
        type: "temporary",
        children: [],
        group,
        documentCount: group.documents.length,
        pageCount: dossierPageCount(group),
      })
    })

  groups
    .filter((group) => !group.isTemporary)
    .forEach((group) => {
      const path = resultTreePath(group)
      let current: ResultTreeNode | null = null
      path.forEach((segment, index) => {
        const label = segment.trim() || UNCLASSIFIED_LABEL
        if (index === 0) {
          current = rootByLabel.get(label) ?? null
          if (!current) {
            current = createTreeNode(
              `root:${label}`,
              label,
              isYearPathSegment(label) ? "year" : "classification"
            )
            rootByLabel.set(label, current)
            roots.push(current)
          }
          return
        }

        const id = `${current!.id}/class:${index}:${label}`
        let child = current!.children.find((candidate) => candidate.id === id)
        if (!child) {
          child = createTreeNode(
            id,
            label,
            isYearPathSegment(label) ? "year" : "classification"
          )
          current!.children.push(child)
        }
        current = child
      })

      current!.children.push({
        id: `dossier:${group.id}`,
        label: group.label,
        type: "dossier",
        children: [],
        group,
        documentCount: group.documents.length,
        pageCount: dossierPageCount(group),
      })
    })

  roots.forEach(updateTreeCounts)
  return sortResultTreeNodes(roots)
}

export function resultTreePath(group: ClusterGroup): string[] {
  const classificationPath = (group.classificationPath ?? [])
    .map((segment) => segment.trim())
    .filter(Boolean)
  const yearLabel = dossierYearLabel(group)
  const hasKnownYear =
    normalizePathSegment(yearLabel) !== normalizePathSegment(UNKNOWN_YEAR_LABEL)
  const hasClassificationYear = classificationPath.some(isYearPathSegment)

  if (hasClassificationYear) {
    let yearSegmentUsed = false
    const deduped = classificationPath.flatMap((segment) => {
      if (!isYearPathSegment(segment)) return [segment]
      if (yearSegmentUsed) return []
      yearSegmentUsed = true
      return [hasKnownYear ? yearLabel : segment]
    })
    return deduped.length > 0 ? deduped : [UNCLASSIFIED_LABEL]
  }

  const tail =
    classificationPath.length > 0 ? classificationPath : [UNCLASSIFIED_LABEL]
  return [yearLabel, ...tail]
}

export function isYearPathSegment(value: string): boolean {
  const normalized = normalizePathSegment(value)
  return (
    normalized === normalizePathSegment(UNKNOWN_YEAR_LABEL) ||
    /^nam\s+(?:19|20)\d{2}\b/.test(normalized) ||
    /^year\s+(?:19|20)\d{2}\b/.test(normalized)
  )
}

export function normalizePathSegment(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

export function createTreeNode(
  id: string,
  label: string,
  type: ResultTreeNode["type"]
): ResultTreeNode {
  return {
    id,
    label,
    type,
    children: [],
    documentCount: 0,
    pageCount: 0,
  }
}

export function updateTreeCounts(node: ResultTreeNode): ResultTreeNode {
  if (node.group) return node
  node.children.forEach(updateTreeCounts)
  node.documentCount = node.children.reduce(
    (sum, child) => sum + child.documentCount,
    0
  )
  node.pageCount = node.children.reduce(
    (sum, child) => sum + child.pageCount,
    0
  )
  return node
}

export function sortResultTreeNodes(nodes: ResultTreeNode[]): ResultTreeNode[] {
  nodes.forEach((node) => {
    node.children = sortResultTreeNodes(node.children)
  })
  return nodes.sort(compareResultTreeNodes)
}

export function compareResultTreeNodes(
  a: ResultTreeNode,
  b: ResultTreeNode
): number {
  if (a.type === "temporary" && b.type !== "temporary") return -1
  if (b.type === "temporary" && a.type !== "temporary") return 1

  const aIsYearNode = a.type === "year" || isYearPathSegment(a.label)
  const bIsYearNode = b.type === "year" || isYearPathSegment(b.label)
  if (aIsYearNode && bIsYearNode) {
    const aYear = resultTreeYearValue(a.label)
    const bYear = resultTreeYearValue(b.label)
    if (aYear !== null && bYear !== null && aYear !== bYear) {
      return aYear - bYear
    }
    if (aYear !== null && bYear === null) return -1
    if (aYear === null && bYear !== null) return 1
  }

  if (a.type === "dossier" && b.type === "dossier") {
    const periodComparison = compareResultTreePeriodSortValues(
      resultTreePeriodSortValue(a),
      resultTreePeriodSortValue(b)
    )
    if (periodComparison !== 0) return periodComparison

    const aDossierNumber = resultTreeDossierNumberValue(a.group?.dossierNumber)
    const bDossierNumber = resultTreeDossierNumberValue(b.group?.dossierNumber)
    if (
      aDossierNumber !== null &&
      bDossierNumber !== null &&
      aDossierNumber !== bDossierNumber
    ) {
      return aDossierNumber - bDossierNumber
    }
  }

  return a.label.localeCompare(b.label, "vi")
}

export function resultTreeYearValue(value: string): number | null {
  const match = normalizePathSegment(value).match(/\b(?:19|20)\d{2}\b/)
  return match ? Number(match[0]) : null
}

interface ResultTreePeriodSortValue {
  year: number
  month: number
  day: number
}

export function compareResultTreePeriodSortValues(
  a: ResultTreePeriodSortValue | null,
  b: ResultTreePeriodSortValue | null
): number {
  if (!a && !b) return 0
  if (a && !b) return -1
  if (!a && b) return 1
  if (!a || !b) return 0
  if (a.year !== b.year) return a.year - b.year
  if (a.month !== b.month) return a.month - b.month
  return a.day - b.day
}

export function resultTreePeriodSortValue(
  node: ResultTreeNode
): ResultTreePeriodSortValue | null {
  return (
    resultTreePeriodSortValueFromDate(node.group?.startDate) ??
    resultTreePeriodSortValueFromDate(node.group?.endDate) ??
    resultTreePeriodSortValueFromLabel(node.label)
  )
}

export function resultTreePeriodSortValueFromDate(
  value: string | null | undefined
): ResultTreePeriodSortValue | null {
  const text = String(value ?? "").trim()
  if (!text) return null
  const match = text.match(
    /\b((?:19|20)\d{2})(?:[-/](\d{1,2}))?(?:[-/](\d{1,2}))?\b/
  )
  if (!match) return null
  const year = Number(match[1])
  const month = clampPeriodNumber(Number(match[2] ?? 0), 0, 12)
  const day = clampPeriodNumber(Number(match[3] ?? 0), 0, 31)
  return { year, month, day }
}

export function resultTreePeriodSortValueFromLabel(
  value: string
): ResultTreePeriodSortValue | null {
  const year = resultTreeYearValue(value)
  if (year === null) return null
  const normalized = normalizePathSegment(value)
  const monthMatch = normalized.match(/\bthang\s+(\d{1,2})\b/)
  if (monthMatch) {
    return {
      year,
      month: clampPeriodNumber(Number(monthMatch[1]), 1, 12),
      day: 0,
    }
  }

  const quarterMatch = normalized.match(/\bquy\s+([ivxlcdm]+|\d{1,2})\b/)
  if (quarterMatch) {
    const quarter = quarterValue(quarterMatch[1])
    if (quarter !== null) {
      return {
        year,
        month: (quarter - 1) * 3 + 1,
        day: 0,
      }
    }
  }

  return { year, month: 0, day: 0 }
}

export function quarterValue(value: string): number | null {
  const normalized = value.toLowerCase()
  const numeric = Number(normalized)
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 4) {
    return numeric
  }
  const roman: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4 }
  return roman[normalized] ?? null
}

export function clampPeriodNumber(
  value: number,
  min: number,
  max: number
): number {
  if (!Number.isFinite(value)) return min
  return Math.min(Math.max(value, min), max)
}

export function resultTreeDossierNumberValue(
  value: string | null | undefined
): number | null {
  const match = String(value ?? "").match(/\d+/)
  return match ? Number(match[0]) : null
}

export function flattenNodeIds(nodes: ResultTreeNode[]): string[] {
  return nodes.flatMap((node) => [node.id, ...flattenNodeIds(node.children)])
}

export function findResultTreeNode(
  nodes: ResultTreeNode[],
  nodeId: string
): ResultTreeNode | null {
  for (const node of nodes) {
    if (node.id === nodeId) return node
    const child = findResultTreeNode(node.children, nodeId)
    if (child) return child
  }
  return null
}

export function dossierGroupsFromNode(node: ResultTreeNode): ClusterGroup[] {
  const groups: ClusterGroup[] = []
  if (node.group && !node.group.isTemporary) {
    groups.push(node.group)
  }
  node.children.forEach((child) => {
    groups.push(...dossierGroupsFromNode(child))
  })
  return groups
}

export function moveDocumentLocally(
  groups: ClusterGroup[],
  moving: DraggedDocument,
  targetClusterId: string
): ClusterGroup[] {
  return groups.map((group) => {
    if (group.id === moving.fromClusterId) {
      const documents = group.documents.filter(
        (document) => document.documentId !== moving.document.documentId
      )
      return {
        ...group,
        documents,
        files: documents.map((document) => document.filePath),
      }
    }
    if (group.id === targetClusterId) {
      const documents = [
        ...group.documents,
        { ...moving.document, positionIndex: group.documents.length },
      ]
      return {
        ...group,
        documents,
        files: documents.map((document) => document.filePath),
      }
    }
    return group
  })
}
