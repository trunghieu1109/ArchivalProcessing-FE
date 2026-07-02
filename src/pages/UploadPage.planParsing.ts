import type {
  ActivePlanResponse,
  ClusterVersionResponse,
  DossierBuildStrategy,
  DocumentNumberingMode,
  DocumentNumberingStylePreset,
} from "@/features/upload/api/sessionApi"
import type {
  FileRegisterConfig,
  ParsedPlan,
  PlanCriterionSet,
  PlanGroup,
  PlanLeafCandidate,
  PlanLeafGroupCandidates,
  RetentionAppendixNode,
} from "@/features/upload/types"
import {
  DEFAULT_DOCUMENT_NUMBERING_MODE,
  DEFAULT_DOCUMENT_NUMBERING_STYLE_PRESET,
  DEFAULT_DOSSIER_BUILD_STRATEGY,
  DEFAULT_NUMBERING_STYLE_OVERRIDES,
  type NumberingStyleOverrides,
  DEFAULT_FILE_REGISTER_CONFIG,
} from "./UploadPage.planDefaults"

export function activePlanToParsedPlan(plan: ActivePlanResponse): ParsedPlan {
  const leafGroupCandidates = normalizeLeafGroupCandidates(
    plan.leaf_group_candidates
  )
  const leafCandidateMap = leafCandidateMapFromGroups(leafGroupCandidates)
  const nestedGroups = normalizePlanGroups(plan.groups)
  const flatPlanGroups = flatGroupsToNested(plan.flat_groups)
  const classificationGroups = flatGroupsToNested(plan.classification_groups)
  const flatGroups =
    nestedGroups.length > 0
      ? nestedGroups
      : flatPlanGroups.length > 0
        ? flatPlanGroups
        : classificationGroups
  return {
    summary: plan.summary || "Phương án phân loại đã được phân tích.",
    fonds_name: plan.fonds_name || "",
    groups: attachLeafCandidates(flatGroups, leafCandidateMap),
    criterias: normalizePlanCriterias(plan.criterias),
    leaf_group_candidates: leafGroupCandidates,
    file_register_config: normalizeFileRegisterConfig(
      plan.file_register_config
    ),
    retention_appendices: normalizeRetentionAppendices(
      plan.retention_appendices
    ),
  }
}

export function normalizeFileRegisterConfig(
  value: ActivePlanResponse["file_register_config"]
): FileRegisterConfig {
  if (!value) return { ...DEFAULT_FILE_REGISTER_CONFIG }
  const issuedDateStep = value.steps?.find(
    (step) => step.criterion === "issued_date"
  )
  const granularity =
    issuedDateStep?.granularity === "month" ||
    issuedDateStep?.granularity === "quarter"
      ? issuedDateStep.granularity
      : "year"
  const groupByDocumentType = value.steps?.[0]?.criterion === "document_type"
  return {
    analysis_status:
      value.analysis_status === "detected" ||
      value.analysis_status === "ambiguous"
        ? value.analysis_status
        : "not_detected",
    summary: value.summary || "",
    evidence: Array.isArray(value.evidence) ? value.evidence : [],
    steps: groupByDocumentType
      ? [
          { criterion: "document_type" },
          { criterion: "issued_date", granularity },
        ]
      : [{ criterion: "issued_date", granularity }],
    merge_small_dossiers: value.merge_small_dossiers !== false,
  }
}

export function normalizePlanCriterias(
  values: unknown[] | undefined
): ParsedPlan["criterias"] {
  if (!Array.isArray(values)) return []
  return values
    .map((value): PlanCriterionSet | null => {
      const record = asRecord(value)
      if (!record) return null
      const groupLevel = stringValue(
        record.group_level || record.level || record.type
      )
      const criteria = arrayValue(record.criteria)
        .map(stringValue)
        .filter(Boolean)
      return groupLevel || criteria.length > 0
        ? { group_level: groupLevel, criteria }
        : null
    })
    .filter((item): item is ParsedPlan["criterias"][number] => Boolean(item))
}

export function normalizePlanGroups(
  values: unknown[] | undefined
): PlanGroup[] {
  if (!Array.isArray(values)) return []
  return values
    .map((value): PlanGroup | null => {
      const record = asRecord(value)
      if (!record) return null
      return {
        id: stringValue(record.id),
        name: stringValue(record.name),
        type: stringValue(record.type) || "level-1",
        definition: stringValue(record.definition),
        candidates: normalizeLeafCandidates(
          arrayValue(record.candidates || record.leaf_candidates)
        ),
        children: normalizePlanGroups(arrayValue(record.children)),
      }
    })
    .filter((group): group is PlanGroup => Boolean(group?.name))
}

export function normalizeRetentionAppendices(
  values: unknown[] | undefined
): RetentionAppendixNode[] {
  if (!Array.isArray(values)) return []
  return values
    .map((value): RetentionAppendixNode | null => normalizeRetentionNode(value))
    .filter((item): item is RetentionAppendixNode => Boolean(item))
    .filter(hasRetentionUnit)
}

function normalizeRetentionNode(value: unknown): RetentionAppendixNode | null {
  const record = asRecord(value)
  if (!record) return null
  const name = stringValue(record.name || record.title || record.label)
  const children = normalizeRetentionAppendices(retentionChildValues(record))
  if (!name && children.length === 0) return null
  return {
    type: stringValue(record.type) || (children.length > 0 ? "group" : "unit"),
    name,
    retention_period: stringValue(
      record.retention_period || record.retention || record.period
    ),
    note: stringValue(record.note || record.notes),
    source_row_index: numberValue(record.source_row_index),
    source_unit_index: numberValue(record.source_unit_index),
    source_file_name: stringValue(record.source_file_name || record.file_name),
    source_title: stringValue(record.source_title || record.title),
    source_order: numberValue(record.source_order),
    source_appendix_index: numberValue(record.source_appendix_index),
    source_appendix_count: numberValue(record.source_appendix_count),
    source_session_file_id: numberValue(record.source_session_file_id),
    children,
  }
}

function retentionChildValues(record: Record<string, unknown>): unknown[] {
  const valueChildren = arrayValue(record.value)
  if (valueChildren.length > 0) return valueChildren
  const children = arrayValue(record.children)
  if (children.length > 0) return children
  return arrayValue(record.items)
}

function hasRetentionUnit(node: RetentionAppendixNode): boolean {
  if (isRetentionUnitNode(node)) return true
  return node.children.some(hasRetentionUnit)
}

function isRetentionUnitNode(node: RetentionAppendixNode): boolean {
  const normalizedType = node.type.trim().toLowerCase()
  if (normalizedType === "unit") return true
  if (node.retention_period) return true
  if (node.children.length > 0) return false
  return !["appendix", "merged", "merge", "group"].includes(normalizedType)
}

type PlanParentRef = string | number

type FlatPlanGroupDraft = {
  id: string
  name: string
  type: string
  definition: string
  candidates: PlanLeafCandidate[]
  depth: number
  parentRefs: PlanParentRef[]
  order: number
}

export function flatGroupsToNested(values: unknown[] | undefined): PlanGroup[] {
  if (!Array.isArray(values)) return []
  const records = values
    .map(asRecord)
    .filter((item): item is Record<string, unknown> => Boolean(item))

  const draftsByKey = new Map<string, FlatPlanGroupDraft>()
  records.forEach((record, index) => {
    const type = normalizePlanGroupType(record.type)
    const depth = planGroupDepth(type) ?? 1
    const id =
      stringValue(record.group_id || record.id) || `flat-group-${index + 1}`
    const name = stringValue(record.name || record.group_name)
    if (!name) return

    const key = `${depth}:${id}`
    const parentRefs = planParentRefs(record.parent ?? record.parent_refs)
    const candidates = normalizeLeafCandidates(
      arrayValue(record.candidates || record.leaf_candidates)
    )
    const existing = draftsByKey.get(key)
    if (existing) {
      existing.parentRefs = mergePlanParentRefs(existing.parentRefs, parentRefs)
      if (name) existing.name = name
      const definition = stringValue(record.definition)
      if (definition) existing.definition = definition
      if (candidates.length > 0) existing.candidates = candidates
      return
    }

    draftsByKey.set(key, {
      id,
      name,
      type,
      definition: stringValue(record.definition),
      candidates,
      depth,
      parentRefs,
      order: index,
    })
  })

  const groupsByDepth = new Map<number, FlatPlanGroupDraft[]>()
  draftsByKey.forEach((group) => {
    const groups = groupsByDepth.get(group.depth) ?? []
    groups.push(group)
    groupsByDepth.set(group.depth, groups)
  })
  groupsByDepth.forEach((groups) =>
    groups.sort((left, right) => left.order - right.order)
  )

  const roots: PlanGroup[] = []
  const nodesByDepth = new Map<number, Map<string, PlanGroup[]>>()
  const availableDepths = Array.from(groupsByDepth.keys()).sort(
    (left, right) => left - right
  )

  availableDepths.forEach((depth) => {
    const previousDepth = depth - 1
    const shouldRoot = depth === 1 || !nodesByDepth.has(previousDepth)
    const depthGroups = groupsByDepth.get(depth) ?? []

    depthGroups.forEach((group) => {
      if (shouldRoot) {
        const node = createPlanGroupNode(group)
        roots.push(node)
        addPlanGroupNode(nodesByDepth, depth, group.id, node)
        return
      }

      const parents = uniquePlanGroupNodes(
        targetPlanParentNodes(group.parentRefs, previousDepth, nodesByDepth)
      )
      if (parents.length === 0) {
        const node = createPlanGroupNode(group)
        roots.push(node)
        addPlanGroupNode(nodesByDepth, depth, group.id, node)
        return
      }

      parents.forEach((parent) => {
        const node = createPlanGroupNode(group)
        parent.children.push(node)
        addPlanGroupNode(nodesByDepth, depth, group.id, node)
      })
    })
  })

  return roots
}

const LEGACY_PLAN_GROUP_DEPTHS: Record<string, number> = {
  large: 1,
  medium: 2,
  small: 3,
}

function normalizePlanGroupType(value: unknown): string {
  const raw = stringValue(value).toLowerCase()
  if (!raw) return "level-1"
  const depth = planGroupDepth(raw)
  if (depth === null) return raw
  if (LEGACY_PLAN_GROUP_DEPTHS[raw]) return raw
  return `level-${depth}`
}

function planGroupDepth(value: unknown): number | null {
  const normalized = stringValue(value).toLowerCase()
  const legacyDepth = LEGACY_PLAN_GROUP_DEPTHS[normalized]
  if (legacyDepth) return legacyDepth

  const match = /^level-(\d+)$/i.exec(normalized)
  if (!match) return null
  const depth = Number(match[1])
  return Number.isInteger(depth) && depth >= 1 ? depth : null
}

function planParentRefs(value: unknown): PlanParentRef[] {
  const rawValues =
    value === undefined || value === null
      ? [-1]
      : Array.isArray(value)
        ? value
        : [value]
  const refs: PlanParentRef[] = []
  rawValues.forEach((item) => {
    if (typeof item === "number") {
      refs.push(item)
      return
    }
    const text = stringValue(item)
    if (text === "-1") refs.push(-1)
    else if (text) refs.push(text)
  })
  return refs.length > 0 ? refs : [-1]
}

function mergePlanParentRefs(
  left: PlanParentRef[],
  right: PlanParentRef[]
): PlanParentRef[] {
  const merged = [...left]
  right.forEach((ref) => {
    if (!merged.some((item) => String(item) === String(ref))) {
      merged.push(ref)
    }
  })
  return merged.length > 0 ? merged : [-1]
}

function createPlanGroupNode(group: FlatPlanGroupDraft): PlanGroup {
  return {
    id: group.id,
    name: group.name,
    type: group.type,
    definition: group.definition,
    candidates: group.candidates,
    children: [],
  }
}

function addPlanGroupNode(
  nodesByDepth: Map<number, Map<string, PlanGroup[]>>,
  depth: number,
  id: string,
  node: PlanGroup
) {
  const nodesById = nodesByDepth.get(depth) ?? new Map<string, PlanGroup[]>()
  const nodes = nodesById.get(id) ?? []
  nodes.push(node)
  nodesById.set(id, nodes)
  nodesByDepth.set(depth, nodesById)
}

function targetPlanParentNodes(
  parentRefs: PlanParentRef[],
  previousDepth: number,
  nodesByDepth: Map<number, Map<string, PlanGroup[]>>
): PlanGroup[] {
  if (parentRefs.some(isPlanRootParentRef)) {
    return allPlanGroupNodes(nodesByDepth.get(previousDepth)?.values())
  }

  const targetNodes: PlanGroup[] = []
  parentRefs.forEach((ref) => {
    const parsed = parsePlanParentRef(ref, previousDepth)
    if (!parsed) return

    if (parsed.depth === previousDepth) {
      targetNodes.push(
        ...(nodesByDepth.get(parsed.depth)?.get(parsed.id) ?? [])
      )
      return
    }

    if (parsed.depth < previousDepth) {
      const ancestors = nodesByDepth.get(parsed.depth)?.get(parsed.id) ?? []
      ancestors.forEach((ancestor) => {
        targetNodes.push(
          ...descendantPlanGroupsByDepth(ancestor, previousDepth)
        )
      })
    }
  })
  return targetNodes
}

function isPlanRootParentRef(ref: PlanParentRef): boolean {
  return ref === -1 || stringValue(ref) === "-1"
}

function parsePlanParentRef(
  ref: PlanParentRef,
  fallbackDepth: number
): { depth: number; id: string } | null {
  if (typeof ref === "number") return null

  const text = stringValue(ref)
  if (!text || text === "-1") return null

  const levelMatch = /^level-(\d+)-(.+)$/i.exec(text)
  if (levelMatch) {
    const depth = Number(levelMatch[1])
    const id = levelMatch[2].trim()
    return Number.isInteger(depth) && depth >= 1 && id ? { depth, id } : null
  }

  const lowered = text.toLowerCase()
  for (const [groupType, depth] of Object.entries(LEGACY_PLAN_GROUP_DEPTHS)) {
    const prefix = `${groupType}-`
    if (lowered.startsWith(prefix)) {
      const id = text.slice(prefix.length).trim()
      return id ? { depth, id } : null
    }
  }

  return fallbackDepth >= 1 ? { depth: fallbackDepth, id: text } : null
}

function allPlanGroupNodes(
  values: Iterable<PlanGroup[]> | undefined
): PlanGroup[] {
  if (!values) return []
  const collected: PlanGroup[] = []
  for (const groups of values) {
    collected.push(...groups)
  }
  return collected
}

function uniquePlanGroupNodes(groups: PlanGroup[]): PlanGroup[] {
  const seen = new Set<PlanGroup>()
  const unique: PlanGroup[] = []
  groups.forEach((group) => {
    if (seen.has(group)) return
    seen.add(group)
    unique.push(group)
  })
  return unique
}

function descendantPlanGroupsByDepth(
  root: PlanGroup,
  depth: number
): PlanGroup[] {
  const matches: PlanGroup[] = []
  root.children.forEach((child) => {
    if (planGroupDepth(child.type) === depth) matches.push(child)
    matches.push(...descendantPlanGroupsByDepth(child, depth))
  })
  return matches
}

export function activePlanBuildStrategy(
  plan: ActivePlanResponse
): DossierBuildStrategy {
  return (
    dossierBuildStrategyValue(plan.dossier_build_strategy) ??
    DEFAULT_DOSSIER_BUILD_STRATEGY
  )
}

export function activePlanDocumentNumberingMode(
  plan: ActivePlanResponse
): DocumentNumberingMode {
  return (
    documentNumberingModeValue(plan.document_numbering_mode) ??
    DEFAULT_DOCUMENT_NUMBERING_MODE
  )
}

export function activePlanDocumentNumberingStylePreset(
  plan: ActivePlanResponse
): DocumentNumberingStylePreset {
  return (
    documentNumberingStylePresetValue(
      plan.document_numbering_style_preset
    ) ?? DEFAULT_DOCUMENT_NUMBERING_STYLE_PRESET
  )
}

export function activePlanDocumentNumberingStyleOverrides(
  plan: ActivePlanResponse
): NumberingStyleOverrides {
  const raw = plan.document_numbering_style_overrides
  if (raw && typeof raw === "object") {
    return {
      font_size: typeof raw.font_size === "number" ? raw.font_size : undefined,
      color: typeof raw.color === "string" ? raw.color : undefined,
      opacity: typeof raw.opacity === "number" ? raw.opacity : undefined,
    }
  }
  return { ...DEFAULT_NUMBERING_STYLE_OVERRIDES }
}

export function activeClusterBuildStrategy(
  clusterVersion: ClusterVersionResponse | null
): DossierBuildStrategy | null {
  if (!clusterVersion) return null

  const summary = clusterVersion.summary
  const selectedStrategy =
    dossierBuildStrategyValue(summary.selected_dossier_build_strategy) ??
    dossierBuildStrategyValue(summary.requested_dossier_build_strategy)
  if (selectedStrategy) return selectedStrategy

  const executedStrategy = stringValue(summary.dossier_build_strategy)
  if (executedStrategy === "chronological_page_split") return "file_register"
  if (executedStrategy === "clustering") return "incremental"
  return null
}

export function dossierBuildStrategyValue(
  value: unknown
): DossierBuildStrategy | null {
  return value === "incremental" || value === "file_register" ? value : null
}

export function documentNumberingModeValue(
  value: unknown
): DocumentNumberingMode | null {
  return value === "page" || value === "sheet" ? value : null
}

export function documentNumberingStylePresetValue(
  value: unknown
): DocumentNumberingStylePreset | null {
  if (
    value === "pencil_miama" ||
    value === "pencil_bradley" ||
    value === "stamp_times_bold"
  ) {
    return value
  }
  if (value === "stamp_time" || value === "stamp") return "stamp_times_bold"
  if (value === "miama" || value === "pencil") return "pencil_miama"
  if (value === "bradley") return "pencil_bradley"
  return null
}

export function normalizeLeafGroupCandidates(
  values: unknown[] | undefined
): PlanLeafGroupCandidates[] {
  if (!Array.isArray(values)) return []
  return values
    .map((value): PlanLeafGroupCandidates | null => {
      const record = asRecord(value)
      if (!record) return null
      const leafGroupRef = stringValue(
        record.leaf_group_ref ||
          record.group_ref ||
          record.group_id ||
          record.id
      )
      const candidates = normalizeLeafCandidates(arrayValue(record.candidates))
      return leafGroupRef ? { leaf_group_ref: leafGroupRef, candidates } : null
    })
    .filter((item): item is PlanLeafGroupCandidates =>
      Boolean(item && item.candidates.length > 0)
    )
}

export function normalizeLeafCandidates(
  values: unknown[]
): PlanLeafCandidate[] {
  return values
    .map((value): PlanLeafCandidate | null => {
      const record = asRecord(value)
      if (!record) return null
      const title = stringValue(record.title || record.name || record.label)
      if (!title) return null
      return {
        title,
        kind: stringValue(record.kind || record.type) || undefined,
        evidence: stringValue(record.evidence || record.source) || undefined,
      }
    })
    .filter((item): item is PlanLeafCandidate => Boolean(item))
}

function leafCandidateMapFromGroups(
  values: PlanLeafGroupCandidates[]
): Map<string, PlanLeafCandidate[]> {
  const result = new Map<string, PlanLeafCandidate[]>()
  values.forEach((item) => {
    result.set(item.leaf_group_ref, item.candidates)
  })
  return result
}

function attachLeafCandidates(
  groups: PlanGroup[],
  leafCandidateMap: Map<string, PlanLeafCandidate[]>,
  inheritedCandidates: PlanLeafCandidate[] = []
): PlanGroup[] {
  return groups.map((group) => {
    const directCandidates = group.candidates ?? []
    const mappedCandidates =
      leafCandidateMap.get(groupCandidateRef(group)) ??
      leafCandidateMap.get(group.id) ??
      []
    const ownCandidates =
      mappedCandidates.length > 0 ? mappedCandidates : directCandidates
    const childInheritedCandidates =
      ownCandidates.length > 0 ? ownCandidates : inheritedCandidates
    const children = attachLeafCandidates(
      group.children,
      leafCandidateMap,
      childInheritedCandidates
    )
    return {
      ...group,
      children,
      candidates:
        children.length === 0
          ? ownCandidates.length > 0
            ? ownCandidates
            : inheritedCandidates
          : [],
    }
  })
}

function groupCandidateRef(group: PlanGroup): string {
  return group.type && group.id ? `${group.type}-${group.id}` : group.id
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null
}

export function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

export function stringValue(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : ""
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value !== "string") return null
  const parsed = Number(value.trim())
  return Number.isFinite(parsed) ? parsed : null
}
