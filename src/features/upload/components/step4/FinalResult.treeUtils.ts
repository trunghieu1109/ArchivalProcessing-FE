import type {
  ClusterDocument,
  ClusterGroup,
  PendingClusterFeedbackMarker,
} from "@/features/upload/lib/clusterGroups"
import { clusterDocumentTotals } from "@/features/upload/lib/clusterGroups"
import {
  UNKNOWN_YEAR_LABEL,
  dossierPageCount,
  dossierYearLabel,
} from "./FinalResult.metadataUtils"
import type { DraggedDocument, ResultTreeNode } from "./FinalResult.types"
import { SHOW_DOSSIER_CODE } from "./temporaryFeatureVisibility"

const UNKNOWN_FONDS_LABEL = "Ch\u01b0a \u0111\u1eb7t t\u00ean ph\u00f4ng"
export const PERMANENT_RETENTION_LABEL = "V\u0129nh vi\u1ec5n"
export const TIMED_RETENTION_LABEL = "C\u00f3 th\u1eddi h\u1ea1n"
export const DISCARDED_RETENTION_LABEL = "T\u00e0i li\u1ec7u lo\u1ea1i"
const RETENTION_LABELS = [
  PERMANENT_RETENTION_LABEL,
  TIMED_RETENTION_LABEL,
  DISCARDED_RETENTION_LABEL,
]

const UNCLASSIFIED_LABEL = "Chưa phân loại"

export function buildResultTree(
  groups: ClusterGroup[],
  fondsName?: string | null
): ResultTreeNode[] {
  const roots: ResultTreeNode[] = []
  const fondsByLabel = new Map<string, ResultTreeNode>()
  const sessionFondsLabel = fondsName?.trim() || ""
  const fallbackFondsLabel = sessionFondsLabel || UNKNOWN_FONDS_LABEL

  const getOrCreateFondsNode = (fondsLabel: string): ResultTreeNode => {
    let fondsNode = fondsByLabel.get(fondsLabel) ?? null
    if (!fondsNode) {
      fondsNode = createTreeNode(`fonds:${fondsLabel}`, fondsLabel, "fonds")
      RETENTION_LABELS.forEach((label) => {
        fondsNode!.children.push(
          createTreeNode(
            `${fondsNode!.id}/retention:${label}`,
            label,
            "retention"
          )
        )
      })
      fondsByLabel.set(fondsLabel, fondsNode)
      roots.push(fondsNode)
    }
    return fondsNode
  }

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
    .filter((group) => group.isPendingDossier)
    .forEach((group) => {
      roots.push({
        id: `pending-dossier:${group.id}`,
        label: group.label,
        type: "pending_dossier",
        children: [],
        group,
        documentCount: group.documents.length,
        pageCount: dossierPageCount(group),
      })
    })

  groups
    .filter((group) => !group.isTemporary && !group.isPendingDossier)
    .forEach((group) => {
      const fondsLabel =
        sessionFondsLabel || resultTreeFondsLabel(group, fallbackFondsLabel)
      const fondsNode = getOrCreateFondsNode(fondsLabel)

      const path = resultTreePath(group)
      let current =
        fondsNode.children.find(
          (node) => node.label === resultTreeRetentionLabel(group)
        ) ?? fondsNode.children[1]
      path.forEach((segment) => {
        const label = segment.trim() || UNCLASSIFIED_LABEL
        const id = `${current.id}/class:${label}`
        let child = current.children.find((candidate) => candidate.id === id)
        if (!child) {
          child = createTreeNode(
            id,
            label,
            isYearPathSegment(label) ? "year" : "classification"
          )
          current.children.push(child)
        }
        current = child
      })

      current.children.push({
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

export function resultTreeFondsLabel(
  group: ClusterGroup,
  fallbackFondsLabel = UNKNOWN_FONDS_LABEL
): string {
  return group.fondsName?.trim() || fallbackFondsLabel
}

export function resultTreeRetentionLabel(group: ClusterGroup): string {
  return isPermanentRetention(group.retentionPeriod)
    ? PERMANENT_RETENTION_LABEL
    : TIMED_RETENTION_LABEL
}

export function isPermanentRetention(
  value: string | null | undefined
): boolean {
  const normalized = normalizePathSegment(value ?? "")
  const compact = normalized.replace(/\s+/g, "")
  return normalized.includes("vinh vien") || compact === "vv"
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

export interface ResultTreeSearchMatch {
  nodeId: string
  ancestorIds: string[]
}

export function findResultTreeDossierMatches(
  nodes: ResultTreeNode[],
  query: string
): ResultTreeSearchMatch[] {
  const normalizedQuery = normalizePathSegment(query)
  if (!normalizedQuery) return []
  const matches: ResultTreeSearchMatch[] = []
  collectResultTreeDossierMatches(nodes, normalizedQuery, [], matches)
  return matches
}

function collectResultTreeDossierMatches(
  nodes: ResultTreeNode[],
  normalizedQuery: string,
  ancestorIds: string[],
  matches: ResultTreeSearchMatch[]
) {
  nodes.forEach((node) => {
    if (
      isSearchableResultTreeNode(node) &&
      resultTreeNodeMatchesSearch(node, normalizedQuery)
    ) {
      matches.push({ nodeId: node.id, ancestorIds })
    }
    collectResultTreeDossierMatches(
      node.children,
      normalizedQuery,
      [...ancestorIds, node.id],
      matches
    )
  })
}

function isSearchableResultTreeNode(node: ResultTreeNode): boolean {
  return (
    node.type === "dossier" ||
    node.type === "pending_dossier" ||
    node.type === "temporary"
  )
}

function resultTreeNodeMatchesSearch(
  node: ResultTreeNode,
  normalizedQuery: string
): boolean {
  const group = node.group
  return normalizePathSegment(
    [
      node.label,
      group?.label,
      group?.dossierId,
      group?.dossierNumber,
      ...(SHOW_DOSSIER_CODE ? [group?.dossierCode] : []),
      group?.boxNumber,
    ].join(" ")
  ).includes(normalizedQuery)
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
  if (a.type === "pending_dossier" && b.type !== "pending_dossier") return -1
  if (b.type === "pending_dossier" && a.type !== "pending_dossier") return 1
  if (a.type === "retention" && b.type === "retention") {
    return retentionSortValue(a.label) - retentionSortValue(b.label)
  }

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

function retentionSortValue(label: string): number {
  const normalized = normalizePathSegment(label)
  const index = RETENTION_LABELS.findIndex(
    (item) => normalizePathSegment(item) === normalized
  )
  return index >= 0 ? index : RETENTION_LABELS.length
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
  targetClusterId: string,
  pendingFeedback?: PendingClusterFeedbackMarker
): ClusterGroup[] {
  return groups.map((group) => {
    if (group.id === moving.fromClusterId) {
      const documents = group.documents.filter(
        (document) => document.documentId !== moving.document.documentId
      )
      return groupWithDocuments(group, documents)
    }
    if (group.id === targetClusterId) {
      const documents = [
        ...group.documents,
        {
          ...moving.document,
          positionIndex: group.documents.length,
          ...(pendingFeedback ? { pendingFeedback } : {}),
        },
      ]
      return groupWithDocuments(group, documents)
    }
    return group
  })
}

export function moveSelectedDocumentsLocally(
  groups: ClusterGroup[],
  sessionDocumentIds: Iterable<number>,
  targetGroupId: string,
  pendingFeedback?: PendingClusterFeedbackMarker
): ClusterGroup[] {
  const selectedIds = new Set(sessionDocumentIds)
  if (selectedIds.size === 0) return groups

  const movingDocuments: ClusterGroup["documents"] = []
  const movedSessionDocumentIds = new Set<number>()
  const groupsWithoutSelected = groups.map((group) => {
    if (group.id === targetGroupId) return group
    const documents = group.documents.filter((document) => {
      const sessionDocumentId = document.sessionDocumentId
      if (sessionDocumentId === null || !selectedIds.has(sessionDocumentId)) {
        return true
      }
      if (!movedSessionDocumentIds.has(sessionDocumentId)) {
        movingDocuments.push(document)
        movedSessionDocumentIds.add(sessionDocumentId)
      }
      return false
    })
    if (documents.length === group.documents.length) return group
    return groupWithDocuments(group, documents)
  })

  if (movingDocuments.length === 0) return groups

  return groupsWithoutSelected.map((group) => {
    if (group.id !== targetGroupId) return group
    const existingSessionDocumentIds = new Set(
      group.documents
        .map((document) => document.sessionDocumentId)
        .filter((id): id is number => id !== null)
    )
    const documentsToAppend = movingDocuments.filter((document) => {
      const sessionDocumentId = document.sessionDocumentId
      return (
        sessionDocumentId === null ||
        !existingSessionDocumentIds.has(sessionDocumentId)
      )
    })
    if (documentsToAppend.length === 0) return group
    const documents = [
      ...group.documents,
      ...documentsToAppend.map((document, index) => ({
        ...document,
        positionIndex: group.documents.length + index,
        ...(pendingFeedback ? { pendingFeedback } : {}),
      })),
    ]
    return groupWithDocuments(group, documents)
  })
}

function groupWithDocuments(
  group: ClusterGroup,
  documents: ClusterDocument[]
): ClusterGroup {
  const pendingFeedbackCount = documents.filter(
    (document) => document.pendingFeedback
  ).length
  const totals = clusterDocumentTotals(documents)
  return {
    ...group,
    documents,
    files: documents.map((document) => document.filePath),
    pageCount: totals.pageCount,
    sheetCount: totals.sheetCount,
    pendingFeedbackCount,
    hasPendingFeedback: pendingFeedbackCount > 0,
  }
}
