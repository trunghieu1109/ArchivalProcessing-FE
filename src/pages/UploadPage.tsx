import { useEffect, useMemo, useRef, useState } from "react"
import { useCallback } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import {
  CheckCircle2,
  Loader2,
  Play,
  ArrowRight,
  ArrowLeft,
  Home,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { cn } from "@/shared/lib/utils"
import { DocxSection } from "@/features/upload/components/step1/DocxSection"
import { ZipSection } from "@/features/upload/components/step1/ZipSection"
import { FolderTree } from "@/features/upload/components/step2/FolderTree"
import { ProcessStep } from "@/features/upload/components/step3/ProcessStep"
import { FinalResult } from "@/features/upload/components/step4/FinalResult"
import { FinalizeArtifactsStep } from "@/pages/FinalizeArtifactsPage"
import { ProgressTimeline } from "@/features/upload/components/ProgressTimeline"
import {
  SessionMetadataBar,
  type SessionMetadataValues,
} from "@/features/upload/components/SessionMetadataBar"
import { useOcrFolder } from "@/features/upload/hooks/useOcrFolder"
import { buildDisplayMetadata } from "@/features/upload/lib/metadata"
import {
  createSession,
  enqueueClusterBuild,
  enqueuePlanAnalysis,
  getActivePlan,
  getActiveClusters,
  getClusterBuildStatus,
  getSession,
  listSessionEvents,
  normalizeDocumentReviewStatus,
  patchActivePlan,
  patchSessionMetadata,
  uploadSessionInput,
  waitForActivePlan,
  type ActivePlanResponse,
  type ClusterVersionResponse,
  type DossierBuildStrategy,
  type SessionInputFileType,
  type SessionInputUploadResponse,
  type UploadProgressSnapshot,
} from "@/features/upload/api/sessionApi"
import type {
  ProcessState,
  SectionHandle,
  ArchiveEntry,
  FolderNode,
  PlanGroup,
  PlanCriterionSet,
  PlanLeafCandidate,
  PlanLeafGroupCandidates,
  FileRegisterConfig,
  ParsedPlan,
  PdfMetadata,
  AppStep,
} from "@/features/upload/types"
import type { ClusterGroup } from "@/features/upload/lib/clusterGroups"

const easeOut = [0.16, 1, 0.3, 1] as const
const DEFAULT_DOSSIER_BUILD_STRATEGY: DossierBuildStrategy = "incremental"
const DEFAULT_FILE_REGISTER_CONFIG: FileRegisterConfig = {
  analysis_status: "not_detected",
  summary: "",
  evidence: [],
  steps: [
    { criterion: "document_type" },
    { criterion: "issued_date", granularity: "year" },
  ],
  merge_small_dossiers: true,
}

const EMPTY_PARSED_PLAN: ParsedPlan = {
  summary: "",
  fonds_name: "",
  groups: [],
  criterias: [],
  leaf_group_candidates: [],
  file_register_config: DEFAULT_FILE_REGISTER_CONFIG,
}

let _nodeId = 1000
function nid() {
  return String(++_nodeId)
}

function planToTree(plan: ParsedPlan): FolderNode[] {
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

function treeToPlanGroups(nodes: FolderNode[], depth = 1): PlanGroup[] {
  return nodes.map((node) => ({
    id: node.id || nid(),
    name: node.name,
    type: node.type || `level-${depth}`,
    definition: node.definition ?? "",
    children: treeToPlanGroups(node.children, depth + 1),
  }))
}

function treeToFlatGroups(
  nodes: FolderNode[]
): Array<{
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

function activePlanToParsedPlan(plan: ActivePlanResponse): ParsedPlan {
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
    file_register_config: normalizeFileRegisterConfig(plan.file_register_config),
  }
}

function normalizeFileRegisterConfig(
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
  const groupByDocumentType =
    value.steps?.[0]?.criterion === "document_type"
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

function normalizePlanCriterias(
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

function normalizePlanGroups(values: unknown[] | undefined): PlanGroup[] {
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

function flatGroupsToNested(values: unknown[] | undefined): PlanGroup[] {
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
      existing.parentRefs = mergePlanParentRefs(
        existing.parentRefs,
        parentRefs
      )
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
        targetNodes.push(...descendantPlanGroupsByDepth(ancestor, previousDepth))
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

function activePlanBuildStrategy(
  plan: ActivePlanResponse
): DossierBuildStrategy {
  return (
    dossierBuildStrategyValue(plan.dossier_build_strategy) ??
    DEFAULT_DOSSIER_BUILD_STRATEGY
  )
}

function activeClusterBuildStrategy(
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

function dossierBuildStrategyValue(
  value: unknown
): DossierBuildStrategy | null {
  return value === "incremental" || value === "file_register" ? value : null
}

function normalizeLeafGroupCandidates(
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

function normalizeLeafCandidates(values: unknown[]): PlanLeafCandidate[] {
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
  leafCandidateMap: Map<string, PlanLeafCandidate[]>
): PlanGroup[] {
  return groups.map((group) => {
    const children = attachLeafCandidates(group.children, leafCandidateMap)
    const directCandidates = group.candidates ?? []
    const mappedCandidates =
      leafCandidateMap.get(groupCandidateRef(group)) ??
      leafCandidateMap.get(group.id) ??
      []
    return {
      ...group,
      children,
      candidates:
        children.length === 0
          ? mappedCandidates.length > 0
            ? mappedCandidates
            : directCandidates
          : [],
    }
  })
}

function groupCandidateRef(group: PlanGroup): string {
  return group.type && group.id ? `${group.type}-${group.id}` : group.id
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function stringValue(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : ""
}

function stageInput(
  fileType: SessionInputFileType,
  file: File
): SessionInputUploadResponse {
  if (fileType === "arrangement_plan") _draftArrangementPlanFile = file
  if (fileType === "retention_schedule") _draftRetentionFile = file
  if (fileType === "raw_zip") _draftZipFile = file
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

function folderPathFromZipName(fileName: string): string {
  const stem = fileName.replace(/\.zip$/i, "").trim()
  return stem
    .split("_")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/")
}

const STEP_LABELS = ["Tải lên", "Cấu trúc", "Xử lý", "Kết quả", "Tạo mục lục"]
const PLAN_ANALYSIS_TIMEOUT_MS = 10 * 60 * 1000
const LAST_SESSION_KEY = "archival-processing:last-session-id"
const PLAN_PROGRESS_PHASES = [
  { id: "upload_inputs", label: "Nạp dữ liệu đầu vào" },
  { id: "preparing_plan_file", label: "Chuẩn bị file phương án chỉnh lý" },
  { id: "classification_criteria", label: "Phân tích tiêu chí phân loại" },
  { id: "file_register_analysis", label: "Phân tích quy tắc tập lưu" },
  { id: "group_definitions", label: "Xác định định nghĩa nhóm" },
  { id: "retention_period", label: "Xác định thời hạn bảo quản" },
]
const PLAN_DONE_VISIBLE_MS = 1_200

let _doc1Has = false
let _doc2Has = false
let _zipHas = false
let _zipEntries: ArchiveEntry[] = []
let _folderTree: FolderNode[] = planToTree(EMPTY_PARSED_PLAN)
let _parsedPlan: ParsedPlan = EMPTY_PARSED_PLAN
let _clusterGroups: ClusterGroup[] = []
let _doc1State: ProcessState = "idle"
let _doc2State: ProcessState = "idle"
let _zipState: ProcessState = "idle"
let _planAnalysisState: ProcessState = "idle"
let _dossierBuildStrategy: DossierBuildStrategy = DEFAULT_DOSSIER_BUILD_STRATEGY
let _persistedDossierBuildStrategy: DossierBuildStrategy =
  DEFAULT_DOSSIER_BUILD_STRATEGY
let _sessionId: string | null = null
let _sessionMetadata: SessionMetadataValues = {
  archive_name: null,
  fonds_name: null,
}
let _zipUpload: SessionInputUploadResponse | null = null
let _arrangementPlanUpload: SessionInputUploadResponse | null = null
let _retentionUpload: SessionInputUploadResponse | null = null
let _zipFolderPath = ""
let _zipMaxFiles = ""
let _activePlanVersionId = ""
let _activeClusterVersionId: string | null | undefined = undefined
let _draftArrangementPlanFile: File | null = null
let _draftRetentionFile: File | null = null
let _draftZipFile: File | null = null
let _zipUploadProgress: UploadProgressSnapshot | null = null
let _arrangementPlanReuploaded = false
let _retentionReuploaded = false

export function UploadPage() {
  const navigate = useNavigate()
  const { step, sessionId: routeSessionId } = useParams<{
    step: string
    sessionId?: string
  }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const existingSessionMode = Boolean(routeSessionId)
  const currentStep = Math.min(
    Math.max(parseInt(step ?? "1", 10), 1),
    5
  ) as AppStep

  const goTo = (s: AppStep, targetSessionId = routeSessionId ?? _sessionId) => {
    if (targetSessionId)
      navigate(`/sessions/${encodeURIComponent(targetSessionId)}/step/${s}`)
    else navigate(`/sessions/new/step/${s}`)
  }

  const handleFinalizeAutoStartHandled = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete("start")
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])

  const doc1Ref = useRef<SectionHandle>(null)
  const doc2Ref = useRef<SectionHandle>(null)
  const zipRef = useRef<SectionHandle>(null)

  const [doc1State, setDoc1State] = useState<ProcessState>(_doc1State)
  const [doc2State, setDoc2State] = useState<ProcessState>(_doc2State)
  const [zipState, setZipState] = useState<ProcessState>(_zipState)
  const [planAnalysisState, setPlanAnalysisState] =
    useState<ProcessState>(_planAnalysisState)
  const [dossierBuildStrategy, setDossierBuildStrategy] =
    useState<DossierBuildStrategy>(_dossierBuildStrategy)

  const [doc1Has, setDoc1Has] = useState(_doc1Has)
  const [doc2Has, setDoc2Has] = useState(_doc2Has)
  const [zipHas, setZipHas] = useState(_zipHas)

  const [, setZipEntries] = useState<ArchiveEntry[]>(_zipEntries)
  const [folderTree, setFolderTree] = useState<FolderNode[]>(_folderTree)
  const [parsedPlan, setParsedPlan] = useState<ParsedPlan>(_parsedPlan)
  const [clusterGroups, setClusterGroups] =
    useState<ClusterGroup[]>(_clusterGroups)
  const [sessionId, setSessionId] = useState<string | null>(_sessionId)
  const [sessionMetadata, setSessionMetadata] =
    useState<SessionMetadataValues>(_sessionMetadata)
  const [zipFolderPath, setZipFolderPath] = useState(_zipFolderPath)
  const [zipMaxFiles, setZipMaxFiles] = useState(_zipMaxFiles)
  const [zipUploadProgress, setZipUploadProgress] =
    useState<UploadProgressSnapshot | null>(_zipUploadProgress)
  const [sessionLoading, setSessionLoading] = useState(false)
  const [confirmingPlan, setConfirmingPlan] = useState(false)
  const [planProgressPhase, setPlanProgressPhase] = useState<string | null>(
    null
  )
  const [planProgressMessage, setPlanProgressMessage] = useState("")
  const [planCompletedPhases, setPlanCompletedPhases] = useState<Set<string>>(
    () => new Set()
  )
  const [planReuploadState, setPlanReuploadState] = useState(() => ({
    arrangement: _arrangementPlanReuploaded,
    retention: _retentionReuploaded,
  }))

  const applyWorkflowState = (nextSessionId: string | null) => {
    setDoc1State(_doc1State)
    setDoc2State(_doc2State)
    setZipState(_zipState)
    setPlanAnalysisState(_planAnalysisState)
    setDossierBuildStrategy(_dossierBuildStrategy)
    setDoc1Has(_doc1Has)
    setDoc2Has(_doc2Has)
    setZipHas(_zipHas)
    setZipEntries(_zipEntries)
    setFolderTree(_folderTree)
    setParsedPlan(_parsedPlan)
    setClusterGroups(_clusterGroups)
    setSessionId(nextSessionId)
    setSessionMetadata(_sessionMetadata)
    setZipFolderPath(_zipFolderPath)
    setZipMaxFiles(_zipMaxFiles)
    setZipUploadProgress(_zipUploadProgress)
    setPlanReuploadState({
      arrangement: _arrangementPlanReuploaded,
      retention: _retentionReuploaded,
    })
    if (_planAnalysisState !== "processing") {
      setPlanProgressPhase(null)
      setPlanProgressMessage("")
      setPlanCompletedPhases(new Set())
    }
  }

  const resetWorkflowState = (nextSessionId: string | null) => {
    _doc1Has = false
    _doc2Has = false
    _zipHas = false
    _zipEntries = []
    _folderTree = planToTree(EMPTY_PARSED_PLAN)
    _parsedPlan = EMPTY_PARSED_PLAN
    _clusterGroups = []
    _doc1State = "idle"
    _doc2State = "idle"
    _zipState = "idle"
    _planAnalysisState = "idle"
    _dossierBuildStrategy = DEFAULT_DOSSIER_BUILD_STRATEGY
    _persistedDossierBuildStrategy = DEFAULT_DOSSIER_BUILD_STRATEGY
    _sessionId = nextSessionId
    _sessionMetadata = {
      archive_name: null,
      fonds_name: null,
    }
    _zipUpload = null
    _arrangementPlanUpload = null
    _retentionUpload = null
    _zipFolderPath = ""
    _zipMaxFiles = ""
    _activePlanVersionId = ""
    _activeClusterVersionId = undefined
    _draftArrangementPlanFile = null
    _draftRetentionFile = null
    _draftZipFile = null
    _zipUploadProgress = null
    _arrangementPlanReuploaded = false
    _retentionReuploaded = false
    applyWorkflowState(nextSessionId)
  }

  const syncSessionMetadata = (metadata: SessionMetadataValues) => {
    _sessionMetadata = {
      archive_name: metadata.archive_name ?? null,
      fonds_name: metadata.fonds_name ?? null,
    }
    setSessionMetadata(_sessionMetadata)
  }

  const ocr = useOcrFolder(sessionId)
  const ocrMetadataItems = useMemo<PdfMetadata[]>(
    () =>
      ocr.status?.jobs.map((job) => {
        const lightMetadata = buildDisplayMetadata(job)
        const reviewStatus = normalizeDocumentReviewStatus(job, lightMetadata)
        return {
          id: job.id,
          document_id: job.document_id,
          data_path: job.data_path,
          status: job.status,
          remote_metadata_status: job.remote_metadata_status,
          review_status: reviewStatus,
          metadata_ready: job.metadata_ready,
          metadata_final: job.metadata_final,
          metadata_version_count: job.metadata_version_count,
          metadata_user_edited: job.metadata_user_edited,
          error: job.error,
          light_metadata: lightMetadata,
          normalized_metadata: job.normalized_metadata,
          raw_metadata: job.raw_metadata,
          applied: reviewStatus === "verified",
        }
      }) ?? [],
    [ocr.status]
  )
  const ocrPdfPaths = useMemo(
    () => ocrMetadataItems.map((item) => item.data_path),
    [ocrMetadataItems]
  )
  const ocrSignatureStatus = useMemo(
    () => ({
      extracted: ocr.status?.signature_extracted_documents ?? 0,
      pending: ocr.status?.signature_pending_documents ?? 0,
      failed: ocr.status?.signature_failed_documents ?? 0,
    }),
    [ocr.status]
  )
  const ocrMessage =
    ocr.state === "error"
      ? ocr.error || "Không thể lấy kết quả số hóa."
      : ocr.state === "done"
        ? ocrMetadataItems.length > 0
          ? `Đã nhận ${ocrMetadataItems.length} tài liệu từ backend.`
          : "Backend chưa trả về tài liệu số hóa."
        : "Đang chờ kết quả số hóa từ remote folder..."
  const ocrLoading = ocr.state === "starting" || ocr.state === "polling"

  useEffect(() => {
    if (!sessionId || planAnalysisState !== "processing") return

    let cancelled = false
    let afterId = 0
    let timeoutId: number | undefined

    const poll = async () => {
      try {
        const response = await listSessionEvents(sessionId, {
          afterId,
          limit: 100,
        })
        if (cancelled) return
        for (const event of response.events) {
          afterId = Math.max(afterId, event.id)
          if (event.event_type === "plan.analysis.progress") {
            const phase = normalizePlanProgressPhase(event.payload?.phase)
            if (phase) {
              setPlanProgressPhase(phase)
              setPlanCompletedPhases((previous) => {
                const next = new Set(previous)
                const phaseIndex = PLAN_PROGRESS_PHASES.findIndex(
                  (item) => item.id === phase
                )
                PLAN_PROGRESS_PHASES.slice(0, Math.max(phaseIndex, 0)).forEach(
                  (item) => next.add(item.id)
                )
                return next
              })
            }
            if (phase)
              setPlanProgressMessage(planProgressMessageForPhase(phase))
          }
          if (event.event_type === "plan.analysis.completed") {
            setPlanProgressPhase(null)
            setPlanCompletedPhases(
              new Set(PLAN_PROGRESS_PHASES.map((phase) => phase.id))
            )
            setPlanProgressMessage("Đã phân tích xong phương án chỉnh lý.")
          }
        }
      } catch {
        // Progress events are best-effort; the active-plan polling owns errors.
      }
      if (!cancelled) {
        timeoutId = window.setTimeout(poll, 1_500)
      }
    }

    void poll()
    return () => {
      cancelled = true
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [planAnalysisState, sessionId])

  useEffect(() => {
    const isCurrentDraftSession = Boolean(
      routeSessionId && _sessionId === routeSessionId
    )
    if (!isCurrentDraftSession) {
      resetWorkflowState(routeSessionId ?? null)
    } else {
      setSessionId(routeSessionId ?? null)
    }
    if (!routeSessionId) return

    let cancelled = false
    const loadExistingSession = async () => {
      setSessionLoading(true)
      try {
        const [sessionDetail, activePlan] = await Promise.all([
          getSession(routeSessionId),
          getActivePlan(routeSessionId),
        ])
        if (cancelled) return

        syncSessionMetadata(sessionDetail)
        _activeClusterVersionId = sessionDetail.active_cluster_version_id ?? null
        const files = sessionDetail.files ?? []
        const arrangementPlanFile = files.find(
          (file) => file.file_type === "arrangement_plan"
        )
        const retentionFile = files.find(
          (file) => file.file_type === "retention_schedule"
        )
        const zipFile = files.find((file) => file.file_type === "raw_zip")
        _doc1Has = Boolean(arrangementPlanFile)
        _doc2Has = Boolean(retentionFile)
        _zipHas = Boolean(zipFile)
        _doc1State = arrangementPlanFile ? "done" : "idle"
        _doc2State = retentionFile ? "done" : "idle"
        _zipState = zipFile ? "done" : "idle"
        _arrangementPlanUpload = arrangementPlanFile ?? null
        _retentionUpload = retentionFile ?? null
        _arrangementPlanReuploaded = false
        _retentionReuploaded = false
        _zipUpload = zipFile ?? null
        _zipFolderPath = zipFile?.folder_path ?? zipFile?.data_path ?? ""
        setDoc1Has(_doc1Has)
        setDoc2Has(_doc2Has)
        setZipHas(_zipHas)
        setDoc1State(_doc1State)
        setDoc2State(_doc2State)
        setZipState(_zipState)
        setPlanReuploadState({ arrangement: false, retention: false })
        setZipFolderPath(_zipFolderPath)

        if (activePlan) {
          const plan = activePlanToParsedPlan(activePlan)
          const buildStrategy = activePlanBuildStrategy(activePlan)
          _activePlanVersionId = activePlan.id ?? ""
          _parsedPlan = plan
          _folderTree = planToTree(plan)
          _planAnalysisState = "done"
          _dossierBuildStrategy = buildStrategy
          _persistedDossierBuildStrategy = buildStrategy
          setParsedPlan(plan)
          setFolderTree(_folderTree)
          setPlanAnalysisState("done")
          setDossierBuildStrategy(buildStrategy)
        }
        window.localStorage.setItem(LAST_SESSION_KEY, routeSessionId)
      } catch (err) {
        if (!cancelled) {
          toast.error(
            err instanceof Error
              ? err.message
              : "Không thể tải session đã chọn."
          )
        }
      } finally {
        if (!cancelled) setSessionLoading(false)
      }
    }
    void loadExistingSession()
    return () => {
      cancelled = true
    }
  }, [routeSessionId])

  const ensureSession = async () => {
    if (_sessionId) return _sessionId
    const created = await createSession()
    _sessionId = created.session_id
    _activeClusterVersionId = null
    setSessionId(created.session_id)
    syncSessionMetadata(created)
    window.localStorage.setItem(LAST_SESSION_KEY, created.session_id)
    return created.session_id
  }

  const saveSessionMetadata = async (metadata: SessionMetadataValues) => {
    const currentSessionId = sessionId ?? routeSessionId ?? _sessionId
    if (!currentSessionId) {
      throw new Error("Chưa có session để lưu thông tin kho/phông.")
    }
    const updated = await patchSessionMetadata(currentSessionId, metadata)
    syncSessionMetadata(updated)
  }

  const uploadInput = async (fileType: SessionInputFileType, file: File) => {
    if (!_sessionId) {
      const staged = stageInput(fileType, file)
      if (
        fileType === "arrangement_plan" ||
        fileType === "retention_schedule"
      ) {
        _planAnalysisState = "idle"
        setPlanAnalysisState("idle")
      }
      return staged
    }
    const currentSessionId = _sessionId
    if (fileType === "raw_zip") {
      syncZipUploadProgress(zipUploadProgressForFile(file, "uploading"))
    }
    let uploaded: SessionInputUploadResponse
    try {
      uploaded = await uploadSessionInput(currentSessionId, fileType, file, {
        onProgress: fileType === "raw_zip" ? syncZipUploadProgress : undefined,
      })
    } catch (err) {
      if (fileType === "raw_zip") {
        syncZipUploadProgress(
          zipUploadProgressForFile(
            file,
            "error",
            _zipUploadProgress?.loadedBytes ?? 0
          )
        )
      }
      throw err
    }
    if (fileType === "raw_zip") {
      syncZipUploadProgress(zipUploadProgressForFile(file, "done", file.size))
    }
    if (fileType === "raw_zip") _zipUpload = uploaded
    if (fileType === "arrangement_plan" || fileType === "retention_schedule") {
      if (fileType === "arrangement_plan") {
        _arrangementPlanUpload = uploaded
        if (existingSessionMode) {
          _arrangementPlanReuploaded = true
          setPlanReuploadState((previous) => ({
            ...previous,
            arrangement: true,
          }))
          _doc1State = "done"
          setDoc1State("done")
        }
      }
      if (fileType === "retention_schedule") {
        _retentionUpload = uploaded
        if (existingSessionMode) {
          _retentionReuploaded = true
          setPlanReuploadState((previous) => ({
            ...previous,
            retention: true,
          }))
          _doc2State = "done"
          setDoc2State("done")
        }
      }
      _planAnalysisState = "idle"
      setPlanAnalysisState("idle")
      setPlanProgressPhase(null)
      setPlanProgressMessage("")
      setPlanCompletedPhases(new Set())
    }
    return uploaded
  }

  // Sync module-level state so it survives navigation
  const syncZipFolderPath = (value: string) => {
    _zipFolderPath = value
    setZipFolderPath(value)
  }
  const syncZipMaxFiles = (value: string) => {
    _zipMaxFiles = value
    setZipMaxFiles(value)
  }
  const syncZipUploadProgress = (progress: UploadProgressSnapshot | null) => {
    _zipUploadProgress = progress
    setZipUploadProgress(progress)
  }
  const zipUploadProgressForFile = (
    file: File,
    phase: UploadProgressSnapshot["phase"],
    loadedBytes = 0
  ): UploadProgressSnapshot => ({
    phase,
    loadedBytes,
    totalBytes: file.size,
    loadedMb: Math.round((loadedBytes / (1024 * 1024)) * 100) / 100,
    totalMb: Math.round((file.size / (1024 * 1024)) * 100) / 100,
    percent:
      file.size > 0
        ? Math.min(100, Math.round((loadedBytes / file.size) * 1000) / 10)
        : null,
  })
  const syncPlanAnalysisState = (s: ProcessState) => {
    _planAnalysisState = s
    setPlanAnalysisState(s)
  }
  const applyPersistedDossierBuildStrategy = (
    strategy: DossierBuildStrategy
  ) => {
    _dossierBuildStrategy = strategy
    _persistedDossierBuildStrategy = strategy
    setDossierBuildStrategy(strategy)
  }
  const selectDossierBuildStrategy = (strategy: DossierBuildStrategy) => {
    _dossierBuildStrategy = strategy
    setDossierBuildStrategy(strategy)
  }
  const syncDoc1Has = (v: boolean) => {
    _doc1Has = v
    if (!v) {
      _draftArrangementPlanFile = null
      _arrangementPlanReuploaded = false
      setPlanReuploadState((previous) => ({
        ...previous,
        arrangement: false,
      }))
      syncPlanAnalysisState("idle")
    }
    setDoc1Has(v)
  }
  const syncDoc2Has = (v: boolean) => {
    _doc2Has = v
    if (!v) {
      _draftRetentionFile = null
      _retentionReuploaded = false
      setPlanReuploadState((previous) => ({
        ...previous,
        retention: false,
      }))
      syncPlanAnalysisState("idle")
    }
    setDoc2Has(v)
  }
  const syncZipHas = (v: boolean) => {
    _zipHas = v
    if (!v) {
      _zipUpload = null
      _draftZipFile = null
      syncZipUploadProgress(null)
      syncZipFolderPath("")
      syncZipMaxFiles("")
    }
    setZipHas(v)
  }
  const syncZipEntries = (e: ArchiveEntry[]) => {
    _zipEntries = e
    setZipEntries(e)
  }
  const syncFolderTree = (t: FolderNode[]) => {
    _folderTree = t
    setFolderTree(t)
  }
  const savePlanChanges = async (
    nextTree = _folderTree,
    nextCriterias = _parsedPlan.criterias
  ) => {
    if (!_sessionId) {
      _folderTree = nextTree
      _parsedPlan = { ..._parsedPlan, criterias: nextCriterias }
      setFolderTree(nextTree)
      setParsedPlan(_parsedPlan)
      toast.success("Đã lưu thay đổi trên màn hình.")
      return
    }

    const planResponse = await patchActivePlan(_sessionId, {
      groups: treeToPlanGroups(nextTree),
      flat_groups: treeToFlatGroups(nextTree),
      criterias: nextCriterias,
    })
    const updatedPlan = activePlanToParsedPlan(planResponse)
    _activePlanVersionId = planResponse.id ?? ""
    _parsedPlan = updatedPlan
    _folderTree = planToTree(updatedPlan)
    setParsedPlan(updatedPlan)
    setFolderTree(_folderTree)
    toast.success("Đã lưu phương án chỉnh lý vào session.")
  }

  const savePlanCriterias = async (criterias: PlanCriterionSet[]) => {
    _parsedPlan = { ..._parsedPlan, criterias }
    setParsedPlan(_parsedPlan)
    await savePlanChanges(_folderTree, criterias)
  }

  const saveFileRegisterConfig = async (config: FileRegisterConfig) => {
    _parsedPlan = { ..._parsedPlan, file_register_config: config }
    setParsedPlan(_parsedPlan)
    if (!_sessionId) return

    const planResponse = await patchActivePlan(_sessionId, {
      file_register_config: config,
    })
    const updatedPlan = activePlanToParsedPlan(planResponse)
    _activePlanVersionId = planResponse.id ?? ""
    _parsedPlan = updatedPlan
    _folderTree = planToTree(updatedPlan)
    setParsedPlan(updatedPlan)
    setFolderTree(_folderTree)
    toast.success("Đã lưu cấu hình lập hồ sơ tập lưu.")
  }

  const saveFolderTree = async (tree: FolderNode[]) => {
    _folderTree = tree
    setFolderTree(tree)
    await savePlanChanges(tree, _parsedPlan.criterias)
  }
  const syncDoc1State = (s: ProcessState) => {
    _doc1State = s
    setDoc1State(s)
  }
  const syncDoc2State = (s: ProcessState) => {
    _doc2State = s
    setDoc2State(s)
  }
  const syncZipState = (s: ProcessState) => {
    _zipState = s
    setZipState(s)
  }

  const parseZipMaxFiles = () => {
    const value = zipMaxFiles.trim()
    if (!value) return undefined
    const parsed = Number(value)
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new Error("Số lượng tài liệu cần số hóa phải là số nguyên dương.")
    }
    return parsed
  }

  const planInputsReuploaded =
    planReuploadState.arrangement || planReuploadState.retention
  const planReanalysisReady = existingSessionMode && planInputsReuploaded
  const hasAnyFile = doc1Has || doc2Has || zipHas
  const readyCount = (
    existingSessionMode
      ? planInputsReuploaded
        ? [planInputsReuploaded]
        : [zipHas]
      : [doc1Has, doc2Has, zipHas]
  ).filter(Boolean).length
  const requiredFileCount = existingSessionMode ? 1 : 3
  const statusItems = existingSessionMode
    ? [
        {
          label: "Phương án",
          has: planAnalysisState === "done",
          state: planAnalysisState,
        },
        { label: "Tệp phương án", has: doc1Has, state: doc1State },
        { label: "Thời hạn", has: doc2Has, state: doc2State },
        { label: "Kho lưu trữ", has: zipHas, state: zipState },
      ]
    : [
        { label: "Phương án", has: doc1Has, state: doc1State },
        { label: "Thời hạn", has: doc2Has, state: doc2State },
        { label: "Kho lưu trữ", has: zipHas, state: zipState },
      ]
  const planAnalyzing = planAnalysisState === "processing"
  const allProcessing =
    planAnalyzing ||
    doc1State === "processing" ||
    doc2State === "processing" ||
    zipState === "processing"
  const allDone = planAnalysisState === "done" && !planInputsReuploaded
  const primaryActionDisabled = allProcessing || sessionLoading

  const syncLatestPlanProgress = async (currentSessionId: string) => {
    try {
      const response = await listSessionEvents(currentSessionId, { limit: 200 })
      let latestMessage = "Đã phân tích xong phương án chỉnh lý."

      response.events.forEach((event) => {
        if (event.event_type !== "plan.analysis.progress") return
        if (event.message) latestMessage = event.message
      })

      setPlanCompletedPhases(
        new Set(PLAN_PROGRESS_PHASES.map((phase) => phase.id))
      )
      setPlanProgressPhase(null)
      setPlanProgressMessage(latestMessage)
    } catch {
      setPlanProgressPhase(null)
      setPlanProgressMessage("Đã phân tích xong phương án chỉnh lý.")
      setPlanCompletedPhases(
        new Set(PLAN_PROGRESS_PHASES.map((phase) => phase.id))
      )
    }
  }

  const resetPlanReuploadState = () => {
    _arrangementPlanReuploaded = false
    _retentionReuploaded = false
    setPlanReuploadState({ arrangement: false, retention: false })
  }

  const handleReanalyzeExistingSessionPlan = async () => {
    const currentSessionId = sessionId ?? routeSessionId ?? _sessionId
    if (!currentSessionId) {
      toast.error("Chưa có session để phân tích lại phương án.")
      return
    }
    if (!planReanalysisReady) {
      toast.error("Vui lòng tải lại phương án chỉnh lý hoặc thời hạn bảo quản.")
      return
    }

    const planFile = planReuploadState.arrangement
      ? _arrangementPlanUpload?.local_cached_path
      : undefined
    const retentionFile = planReuploadState.retention
      ? _retentionUpload?.local_cached_path
      : undefined
    if (planReuploadState.arrangement && !planFile) {
      toast.error(
        "Backend chưa trả về đường dẫn local cho file phương án vừa tải lại."
      )
      return
    }
    if (planReuploadState.retention && !retentionFile) {
      toast.error(
        "Backend chưa trả về đường dẫn local cho file thời hạn bảo quản vừa tải lại."
      )
      return
    }
    if (!planFile && !retentionFile) {
      toast.error(
        "Chưa có file phương án hoặc thời hạn bảo quản để phân tích lại."
      )
      return
    }

    const previousPlanId = _activePlanVersionId || undefined
    try {
      syncPlanAnalysisState("processing")
      syncDoc1State("processing")
      syncDoc2State("processing")
      setPlanCompletedPhases(new Set(["upload_inputs"]))
      setPlanProgressPhase("preparing_plan_file")
      setPlanProgressMessage(planProgressMessageForPhase("preparing_plan_file"))

      await enqueuePlanAnalysis(currentSessionId, {
        ...(planFile ? { plan_file: planFile } : {}),
        ...(retentionFile ? { retention_file: retentionFile } : {}),
        dossier_build_strategy: dossierBuildStrategy,
      })
      const planResponse = await waitForActivePlan(
        currentSessionId,
        PLAN_ANALYSIS_TIMEOUT_MS,
        2_000,
        { previousPlanId }
      )
      const plan = activePlanToParsedPlan(planResponse)
      _activePlanVersionId = planResponse.id ?? ""
      applyPersistedDossierBuildStrategy(activePlanBuildStrategy(planResponse))
      _parsedPlan = plan
      _folderTree = planToTree(plan)
      setParsedPlan(plan)
      setFolderTree(_folderTree)
      const sessionAfterPlan = await getSession(currentSessionId)
      _activeClusterVersionId =
        sessionAfterPlan.active_cluster_version_id ?? null
      syncSessionMetadata(sessionAfterPlan)
      await syncLatestPlanProgress(currentSessionId)
      syncPlanAnalysisState("done")
      syncDoc1State("done")
      syncDoc2State("done")
      resetPlanReuploadState()

      setPlanProgressMessage(
        "Đã phân tích xong phương án mới. Đang gửi task lập lại hồ sơ."
      )
      try {
        await enqueueClusterBuild(currentSessionId, {
          source: "plan_reanalysis",
          dossier_build_strategy: dossierBuildStrategy,
        })
      } catch (err) {
        toast.error(
          err instanceof Error
            ? `Đã lưu phương án mới nhưng chưa gửi được task lập lại hồ sơ: ${err.message}`
            : "Đã lưu phương án mới nhưng chưa gửi được task lập lại hồ sơ."
        )
        goTo(2, currentSessionId)
        return
      }
      _clusterGroups = []
      setClusterGroups([])
      toast.success("Đã phân tích lại phương án và gửi task lập lại hồ sơ.")
      goTo(4, currentSessionId)
    } catch (err) {
      syncPlanAnalysisState("idle")
      syncDoc1State("done")
      syncDoc2State("done")
      setPlanProgressPhase(null)
      setPlanProgressMessage("")
      setPlanCompletedPhases(new Set())
      toast.error(
        err instanceof Error
          ? err.message
          : "Không thể phân tích lại phương án."
      )
    }
  }

  const handleStartAll = async () => {
    if (allDone) {
      goTo(2)
      return
    }
    if (existingSessionMode) {
      if (planInputsReuploaded) {
        await handleReanalyzeExistingSessionPlan()
        return
      }
      goTo(2)
      return
    }

    if (!doc1Has || !_draftArrangementPlanFile) {
      toast.error("Vui lòng tải lên phương án phân loại.")
      return
    }
    if (!doc2Has || !_draftRetentionFile) {
      toast.error("Vui lòng tải lên thông tư thời hạn bảo quản.")
      return
    }
    if (!zipHas || !_draftZipFile) {
      toast.error("Vui lòng chọn file ZIP dữ liệu.")
      return
    }
    try {
      syncPlanAnalysisState("processing")
      setPlanProgressPhase("upload_inputs")
      setPlanProgressMessage(planProgressMessageForPhase("upload_inputs"))
      setPlanCompletedPhases(new Set())
      const currentSessionId = await ensureSession()
      syncZipState("processing")
      syncZipUploadProgress(
        zipUploadProgressForFile(_draftZipFile, "uploading")
      )
      const arrangementPlan = await uploadSessionInput(
        currentSessionId,
        "arrangement_plan",
        _draftArrangementPlanFile
      )
      const [retentionPlan, zipInput] = await Promise.all([
        uploadSessionInput(
          currentSessionId,
          "retention_schedule",
          _draftRetentionFile
        ),
        uploadSessionInput(currentSessionId, "raw_zip", _draftZipFile, {
          onProgress: syncZipUploadProgress,
        }),
      ])
      _arrangementPlanUpload = arrangementPlan
      _retentionUpload = retentionPlan
      syncZipUploadProgress(
        zipUploadProgressForFile(_draftZipFile, "done", _draftZipFile.size)
      )
      syncZipState("done")
      _zipUpload = zipInput
      syncZipFolderPath(zipInput.folder_path ?? zipInput.data_path ?? "")

      const planFile = arrangementPlan.local_cached_path
      const retentionFile = retentionPlan.local_cached_path
      if (!planFile || !retentionFile) {
        throw new Error(
          "Backend chưa trả về đường dẫn local cho hồ sơ phương án."
        )
      }

      const documentTasks = [
        doc1Ref.current?.hasFile() ? doc1Ref.current.process() : null,
        doc2Ref.current?.hasFile() ? doc2Ref.current.process() : null,
      ].filter(Boolean) as Promise<void>[]
      const planJob = enqueuePlanAnalysis(currentSessionId, {
        plan_file: planFile,
        retention_file: retentionFile,
        dossier_build_strategy: dossierBuildStrategy,
      })
      setPlanCompletedPhases((previous) =>
        addSetValue(previous, "upload_inputs")
      )
      setPlanProgressPhase("preparing_plan_file")
      setPlanProgressMessage(planProgressMessageForPhase("preparing_plan_file"))
      await Promise.all([...documentTasks, planJob])
      const planResponse = await waitForActivePlan(
        currentSessionId,
        PLAN_ANALYSIS_TIMEOUT_MS,
        2_000,
        {
          previousPlanId: undefined,
          afterVersionNumber: undefined,
        }
      )
      const plan = activePlanToParsedPlan(planResponse)
      _activePlanVersionId = planResponse.id ?? ""
      applyPersistedDossierBuildStrategy(activePlanBuildStrategy(planResponse))
      _parsedPlan = plan
      _folderTree = planToTree(plan)
      setParsedPlan(plan)
      setFolderTree(_folderTree)
      const sessionAfterPlan = await getSession(currentSessionId)
      _activeClusterVersionId =
        sessionAfterPlan.active_cluster_version_id ?? null
      syncSessionMetadata(sessionAfterPlan)
      await syncLatestPlanProgress(currentSessionId)
      syncPlanAnalysisState("done")
      toast.success("Đã tạo session và phân tích phương án chỉnh lý.")
      await wait(PLAN_DONE_VISIBLE_MS)
      navigate(`/sessions/${encodeURIComponent(currentSessionId)}/step/2`)
    } catch (err) {
      syncPlanAnalysisState("idle")
      setPlanProgressPhase(null)
      setPlanProgressMessage("")
      setPlanCompletedPhases(new Set())
      syncZipState("idle")
      if (_draftZipFile) {
        syncZipUploadProgress(
          zipUploadProgressForFile(
            _draftZipFile,
            "error",
            _zipUploadProgress?.loadedBytes ?? 0
          )
        )
      }
      toast.error(
        err instanceof Error
          ? err.message
          : "Không thể bắt đầu phân tích phương án."
      )
    }
  }

  const handleConfirmPlan = async () => {
    if (confirmingPlan) return
    if (!_sessionId) {
      toast.error("Chưa có session xử lý.")
      return
    }
    if (planAnalysisState !== "done") {
      toast.error(
        "Phải phân tích xong phương án chỉnh lý trước khi lấy metadata."
      )
      return
    }
    if (_folderTree.length === 0) {
      toast.error("Chưa có phương án chỉnh lý để xác nhận.")
      return
    }
    let confirmedPlanVersionId = _activePlanVersionId.trim()
    if (!confirmedPlanVersionId) {
      toast.error("Chưa có phiên bản phương án đã xác nhận.")
      return
    }

    setConfirmingPlan(true)
    let folderPath = ""
    let maxFilesToProcess: number | undefined
    try {
      const selectedStrategy = dossierBuildStrategy
      const strategyChangedBeforeSave =
        selectedStrategy !== _persistedDossierBuildStrategy
      if (strategyChangedBeforeSave) {
        const planResponse = await patchActivePlan(_sessionId, {
          dossier_build_strategy: selectedStrategy,
        })
        const plan = activePlanToParsedPlan(planResponse)
        confirmedPlanVersionId = planResponse.id ?? ""
        _activePlanVersionId = confirmedPlanVersionId
        applyPersistedDossierBuildStrategy(
          activePlanBuildStrategy(planResponse)
        )
        _parsedPlan = plan
        _folderTree = planToTree(plan)
        setParsedPlan(plan)
        setFolderTree(_folderTree)
      }

      let activeClusterVersionId = _activeClusterVersionId
      if (!activeClusterVersionId) {
        const sessionDetail = await getSession(_sessionId)
        activeClusterVersionId = sessionDetail.active_cluster_version_id ?? null
        _activeClusterVersionId = activeClusterVersionId
      }

      if (activeClusterVersionId) {
        const [activeClusters, clusterBuildStatus] = await Promise.all([
          getActiveClusters(_sessionId),
          getClusterBuildStatus(_sessionId),
        ])
        const activeStrategy = activeClusterBuildStrategy(activeClusters)
        const queuedStrategy = dossierBuildStrategyValue(
          clusterBuildStatus.job?.payload.dossier_build_strategy
        )
        const matchingBuildActive =
          clusterBuildStatus.active && queuedStrategy === selectedStrategy
        const rebuildRequired =
          strategyChangedBeforeSave ||
          activeStrategy === null ||
          activeStrategy !== selectedStrategy

        if (rebuildRequired) {
          if (!matchingBuildActive) {
            await enqueueClusterBuild(_sessionId, {
              source: "plan_reanalysis",
              dossier_build_strategy: selectedStrategy,
            })
          }
          _clusterGroups = []
          setClusterGroups([])
          toast.success(
            matchingBuildActive
              ? "Task lập lại hồ sơ đang được xử lý."
              : "Đã lưu cách thức lập hồ sơ và gửi task lập lại hồ sơ."
          )
          goTo(4, _sessionId)
          return
        }
      }

      folderPath =
        zipFolderPath || _zipUpload?.folder_path || _zipUpload?.data_path || ""
      if (!folderPath) {
        if (existingSessionMode) {
          toast.info(
            "Session này chưa có dữ liệu ZIP mới. Bạn có thể tiếp tục xem lại phương án chỉnh lý."
          )
          return
        }
        toast.error("Chưa có folder_path để bắt đầu lấy metadata.")
        return
      }
      if (_zipUpload && !_zipUpload.remote_batch_id) {
        toast.error(
          "File ZIP chưa được upload lên Chỉnh Lý/MinIO. Vui lòng tải lại file ZIP."
        )
        return
      }

      try {
        maxFilesToProcess = parseZipMaxFiles()
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Số lượng tài liệu không hợp lệ."
        )
        return
      }

      const existingStatus = ocr.status ?? (await ocr.refresh())
      if ((existingStatus?.jobs.length ?? 0) > 0) {
        const hasReadyMetadata = existingStatus?.jobs.some(
          (job) => job.metadata_ready
        )
        syncZipState(hasReadyMetadata ? "done" : "processing")
        toast.info(
          "Session đã có dữ liệu metadata. Không gọi lại bước lấy metadata."
        )
        goTo(3)
        return
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Không thể xác nhận phương án chỉnh lý."
      )
      return
    } finally {
      setConfirmingPlan(false)
    }

    syncZipState("processing")
    toast.success("Đã xác nhận phương án. Bắt đầu lấy metadata.")
    void ocr
      .start(folderPath, {
        maxFiles: maxFilesToProcess,
        confirmedPlanVersionId,
      })
      .then(() => {
        syncZipState("done")
        toast.success("Đã hoàn tất lấy metadata từ remote folder.")
      })
      .catch((err) => {
        syncZipState("idle")
        toast.error(
          err instanceof Error ? err.message : "Không thể bắt đầu OCR."
        )
      })
    goTo(3)
  }

  return (
    <div className="min-h-svh bg-[#F0F4F8]">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#EEF2FF] via-[#F0F4FF] to-[#E8EEFF] px-3 py-4 shadow-sm sm:px-4 sm:py-5">
        <div
          className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(0,82,255,0.08) 0%, transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-[1560px]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-8">
            {/* Left: badge + title + description */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: easeOut }}
            >
              <button
                type="button"
                onClick={() => navigate("/sessions")}
                className="block rounded-xl focus-visible:ring-2 focus-visible:ring-[#0052FF] focus-visible:ring-offset-2 focus-visible:outline-none"
                aria-label="Quay lại danh sách session"
                title="Quay lại danh sách session"
              >
                <img
                  src="/assets/mbfs.png"
                  alt="MBFS Logo"
                  className="h-14 w-auto object-contain sm:h-16 lg:h-20"
                />
              </button>
            </motion.div>

            <div className="rounded-2xl border border-[#CBD5E1]/70 bg-white/70 px-3 py-2 shadow-sm md:hidden">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold tracking-[0.14em] text-[#64748B] uppercase">
                    Bước {currentStep}/5
                  </p>
                  <p className="truncate text-sm font-semibold text-[#0F172A]">
                    {STEP_LABELS[currentStep - 1]}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {STEP_LABELS.map((_, index) => {
                    const stepNumber = index + 1
                    return (
                      <span
                        key={index}
                        className={cn(
                          "h-1.5 rounded-full transition-all",
                          stepNumber <= currentStep
                            ? "w-6 bg-[#0052FF]"
                            : "w-3 bg-[#CBD5E1]"
                        )}
                      />
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Right: step indicators */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: easeOut, delay: 0.15 }}
              className="hidden max-w-full shrink-0 items-center overflow-x-auto pt-2 md:flex"
            >
              {STEP_LABELS.map((label, i) => {
                const s = (i + 1) as AppStep
                const isActive = currentStep === s
                const isDone = currentStep > s
                const canNav = isDone
                return (
                  <div key={i} className="flex items-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <button
                        onClick={() => canNav && goTo(s)}
                        className={cn(
                          "flex size-10 items-center justify-center rounded-full text-sm font-bold transition-all duration-300",
                          isDone
                            ? "text-white hover:scale-105"
                            : isActive
                              ? "text-white"
                              : "border-2 border-[#CBD5E1] bg-white text-[#94A3B8]",
                          canNav ? "cursor-pointer" : "cursor-default"
                        )}
                        style={
                          isDone
                            ? {
                                background:
                                  "linear-gradient(135deg, #0052FF, #4D7CFF)",
                                boxShadow: "0 4px 12px rgba(0,82,255,0.3)",
                              }
                            : isActive
                              ? {
                                  background:
                                    "linear-gradient(135deg, #0052FF, #4D7CFF)",
                                  boxShadow: "0 4px 12px rgba(0,82,255,0.3)",
                                }
                              : {}
                        }
                      >
                        {isDone ? "✓" : s}
                      </button>
                      <span
                        className={cn(
                          "text-[11px] font-medium",
                          isActive
                            ? "font-semibold text-[#0052FF]"
                            : isDone
                              ? "text-[#64748B]"
                              : "text-[#94A3B8]"
                        )}
                      >
                        {label}
                      </span>
                    </div>
                    {i < STEP_LABELS.length - 1 && (
                      <div className="mx-2 mb-5 h-px w-5 bg-[#CBD5E1] lg:w-8" />
                    )}
                  </div>
                )
              })}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div
        className={cn(
          "mx-auto px-3 py-5 sm:px-6 sm:py-8 lg:px-8",
          currentStep >= 3 ? "max-w-[1560px]" : "max-w-6xl"
        )}
      >
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <motion.button
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            onClick={() => navigate("/sessions")}
            className="flex items-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-4 py-2 text-sm font-medium text-[#475569] shadow-sm transition-all hover:border-[#0052FF]/30 hover:text-[#0052FF]"
          >
            <Home className="size-4" /> Danh sách session
          </motion.button>
          {currentStep > 1 && (
            <motion.button
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => goTo((currentStep - 1) as AppStep)}
              className="flex items-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-4 py-2 text-sm font-medium text-[#475569] shadow-sm transition-all hover:border-[#0052FF]/30 hover:text-[#0052FF]"
            >
              <ArrowLeft className="size-4" /> Quay lại
            </motion.button>
          )}
        </div>

        {(sessionId || routeSessionId) && (
          <SessionMetadataBar
            sessionId={sessionId ?? routeSessionId ?? null}
            metadata={sessionMetadata}
            onSave={saveSessionMetadata}
            className="mb-5"
          />
        )}

        <AnimatePresence mode="wait">
          {/* Bước 1: Tải lên */}
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: easeOut }}
              className="flex flex-col gap-4"
            >
              <div className="rounded-2xl border border-[#D8E1EC] bg-white px-5 py-4 shadow-sm">
                <p className="text-sm font-semibold text-[#0F172A]">
                  {existingSessionMode
                    ? "Bổ sung dữ liệu cho session"
                    : "Tạo session mới"}
                </p>
                <p className="mt-1 text-sm text-[#64748B]">
                  {existingSessionMode
                    ? "Bạn có thể tải thêm ZIP, hoặc tải lại phương án chỉnh lý và thời hạn bảo quản để phân tích lại rồi lập lại hồ sơ mà không extract metadata lại."
                    : "Chọn đủ phương án chỉnh lý, thông tư thời hạn bảo quản và file ZIP. Session chỉ được tạo khi bạn bấm bắt đầu phân tích."}
                </p>
              </div>

              {(planAnalyzing || planProgressMessage) && (
                <ProgressTimeline
                  phases={PLAN_PROGRESS_PHASES}
                  activePhase={planProgressPhase}
                  completedPhases={planCompletedPhases}
                  title="Phân tích phương án"
                  message={
                    planProgressMessage ||
                    "Backend đang phân tích phương án chỉnh lý."
                  }
                />
              )}

              {/* ZIP */}
              <ZipSection
                ref={zipRef}
                processState={zipState}
                onProcessStateChange={syncZipState}
                onHasFileChange={syncZipHas}
                onEntriesChange={syncZipEntries}
                onFolderPathChange={syncZipFolderPath}
                maxFiles={zipMaxFiles}
                onMaxFilesChange={syncZipMaxFiles}
                onUploadFile={(file) => uploadInput("raw_zip", file)}
                uploadProgress={zipUploadProgress}
                ocr={ocr}
              />

              {/* DOCX */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <DocxSection
                  ref={doc1Ref}
                  index={1}
                  label="Phương án phân loại"
                  sublabel={
                    existingSessionMode
                      ? "Tải lại file Word chứa phương án phân loại để phân tích lại session."
                      : "Tải lên file Word chứa phương án phân loại tài liệu."
                  }
                  processState={doc1State}
                  onProcessStateChange={syncDoc1State}
                  onHasFileChange={syncDoc1Has}
                  onUploadFile={(file) =>
                    uploadInput("arrangement_plan", file).then(() => undefined)
                  }
                />
                <DocxSection
                  ref={doc2Ref}
                  index={2}
                  label="Thời hạn bảo quản"
                  sublabel={
                    existingSessionMode
                      ? "Tải lại file Word chứa thời hạn bảo quản để phân loại lại hồ sơ."
                      : "Tải lên file Word chứa thời hạn bảo quản."
                  }
                  processState={doc2State}
                  onProcessStateChange={syncDoc2State}
                  onHasFileChange={syncDoc2Has}
                  onUploadFile={(file) =>
                    uploadInput("retention_schedule", file).then(
                      () => undefined
                    )
                  }
                />
              </div>

              {/* Action bar */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: easeOut, delay: 0.3 }}
                className="flex flex-col items-stretch gap-4 rounded-2xl border border-border bg-card px-4 py-4 shadow-sm sm:px-6 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
                  <div className="flex flex-wrap gap-2">
                    {statusItems.map((s, i) => (
                      <div
                        key={i}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full px-3 py-1 font-roboto text-[11px] font-semibold tracking-[0.1em] uppercase transition-all duration-200",
                          s.state === "done"
                            ? "text-primary-foreground"
                            : s.has
                              ? "border border-border bg-muted text-foreground"
                              : "border border-border bg-transparent text-muted-foreground"
                        )}
                        style={
                          s.state === "done"
                            ? {
                                background:
                                  "linear-gradient(to right, #0052FF, #4D7CFF)",
                              }
                            : {}
                        }
                      >
                        <div
                          className={cn(
                            "size-1.5 rounded-full",
                            s.state === "done"
                              ? "bg-white"
                              : s.has
                                ? "bg-primary"
                                : "bg-muted-foreground/40"
                          )}
                        />
                        {s.label}
                      </div>
                    ))}
                  </div>
                  <div className="text-sm font-medium">
                    {sessionLoading ? (
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin text-primary" />{" "}
                        Đang tải lại trạng thái session...
                      </span>
                    ) : allDone ? (
                      <span className="flex items-center gap-1.5 text-primary">
                        <CheckCircle2 className="size-4" /> Phương án đã sẵn
                        sàng
                      </span>
                    ) : planAnalyzing ? (
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin text-primary" />{" "}
                        Đang phân tích phương án...
                      </span>
                    ) : allProcessing ? (
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin text-primary" />{" "}
                        Đang xử lý tệp...
                      </span>
                    ) : hasAnyFile ? (
                      <span className="text-muted-foreground">
                        <span className="font-bold text-foreground">
                          {readyCount}
                        </span>{" "}
                        / {requiredFileCount} mục sẵn sàng
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        {existingSessionMode
                          ? "Có thể bỏ qua bước tải ZIP để xem phương án"
                          : "Tải lên đủ 3 file để bắt đầu"}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  disabled={primaryActionDisabled}
                  onClick={handleStartAll}
                  className={cn(
                    "group flex w-full min-w-44 items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all duration-200 sm:w-auto",
                    !primaryActionDisabled
                      ? "text-primary-foreground hover:-translate-y-0.5 active:scale-[0.98]"
                      : "cursor-not-allowed bg-muted text-muted-foreground"
                  )}
                  style={
                    !primaryActionDisabled
                      ? {
                          background:
                            "linear-gradient(to right, #0052FF, #4D7CFF)",
                          boxShadow: "0 4px 14px rgba(0,82,255,0.25)",
                        }
                      : {}
                  }
                >
                  {allProcessing || sessionLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : allDone ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <Play className="size-4" />
                  )}
                  <span>
                    {sessionLoading
                      ? "Đang tải..."
                      : planAnalyzing
                        ? "Đang phân tích..."
                        : allProcessing
                          ? "Đang xử lý..."
                          : planInputsReuploaded
                            ? "Phân tích lại và lập hồ sơ"
                            : allDone
                              ? "Tiếp tục"
                              : existingSessionMode
                                ? "Tiếp tục"
                                : "Bắt đầu phân tích"}
                  </span>
                  {!primaryActionDisabled && (
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  )}
                </button>
              </motion.div>

              {/* Footer security note */}
              <p className="flex items-center justify-center gap-1.5 text-xs text-[#94A3B8]">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Dữ liệu của bạn được bảo mật và chỉ sử dụng cho mục đích xử lý
                tài liệu.
              </p>
            </motion.div>
          )}

          {/* Bước 2: Cây thư mục */}
          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: easeOut }}
            >
              <FolderTree
                tree={folderTree}
                parsedPlan={parsedPlan}
                readOnly={false}
                dossierBuildStrategy={dossierBuildStrategy}
                onDossierBuildStrategyChange={selectDossierBuildStrategy}
                onFileRegisterConfigChange={saveFileRegisterConfig}
                onChange={syncFolderTree}
                onSaveTree={saveFolderTree}
                onCriteriaChange={savePlanCriterias}
                onConfirm={handleConfirmPlan}
                confirming={confirmingPlan}
              />
            </motion.div>
          )}

          {/* Bước 3: Xử lý */}
          {currentStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: easeOut }}
            >
              <ProcessStep
                sessionId={sessionId}
                pdfPaths={ocrPdfPaths}
                metadataItems={ocrMetadataItems}
                metadataLoading={ocrLoading}
                metadataMessage={ocrMessage}
                signatureStatus={ocrSignatureStatus}
                onDocumentsVerified={ocr.mergeVerifiedDocuments}
                onRetryMetadata={ocr.restartMetadata}
                onContinue={(groups) => {
                  _clusterGroups = groups
                  setClusterGroups(groups)
                  goTo(4)
                }}
              />
            </motion.div>
          )}

          {/* Bước 4: Kết quả */}
          {currentStep === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: easeOut }}
            >
              <FinalResult
                sessionId={sessionId}
                groups={clusterGroups}
                metadataItems={ocrMetadataItems}
                onFinish={() => {
                  const currentSessionId = sessionId ?? routeSessionId
                  if (!currentSessionId) {
                    toast.error("Chưa có session để tạo mục lục.")
                    return
                  }
                  navigate(
                    `/sessions/${encodeURIComponent(currentSessionId)}/step/5?start=1`
                  )
                }}
              />
            </motion.div>
          )}

          {/* Bước 5: Tạo mục lục */}
          {currentStep === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: easeOut }}
            >
              <FinalizeArtifactsStep
                sessionId={sessionId ?? routeSessionId ?? null}
                autoStart={searchParams.get("start") === "1"}
                onAutoStartHandled={handleFinalizeAutoStartHandled}
                embedded
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function addSetValue<T>(values: Set<T>, value: T): Set<T> {
  const next = new Set(values)
  next.add(value)
  return next
}

function normalizePlanProgressPhase(value: unknown): string {
  const phase = typeof value === "string" ? value : ""
  if (phase === "resolving_inputs" || phase === "upload_inputs") {
    return "upload_inputs"
  }
  if (
    phase === "retention_schedule" ||
    phase === "plan_text" ||
    phase === "extracting_outline"
  ) {
    return "preparing_plan_file"
  }
  if (phase === "classification_criteria" || phase === "normalizing_tree") {
    return "classification_criteria"
  }
  if (phase === "file_register_analysis") return "file_register_analysis"
  if (phase === "group_definitions") return "group_definitions"
  if (phase === "persisting_plan" || phase === "validating_result") {
    return "retention_period"
  }
  return ""
}

function planProgressMessageForPhase(phase: string): string {
  switch (phase) {
    case "upload_inputs":
      return "Đang nạp dữ liệu đầu vào lên backend."
    case "preparing_plan_file":
      return "Đang chuẩn bị file phương án chỉnh lý để phân tích."
    case "classification_criteria":
      return "Đang phân tích tiêu chí phân loại trong phương án."
    case "file_register_analysis":
      return "Đang phân tích thứ tự và đơn vị thời gian lập hồ sơ tập lưu."
    case "group_definitions":
      return "Đang xác định định nghĩa cho các nhóm phân loại."
    case "retention_period":
      return "Đang xác định thời hạn bảo quản từ thông tư đã tải lên."
    default:
      return "Backend đang phân tích phương án chỉnh lý."
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}
