import type {
  ClusterFeedbackResponse,
  ClusterVersionResponse,
} from "@/features/upload/api/sessionApi"
import {
  TEMPORARY_CLUSTER_ID,
  type ClusterDocument,
  type ClusterGroup,
} from "@/features/upload/lib/clusterGroups"

const PENDING_FEEDBACK_TYPES = new Set([
  "manual_move",
  "temporary_dossier",
  "metadata_edit_keep_cluster",
])

export interface PendingFeedbackOverlayResult {
  groups: ClusterGroup[]
  pendingFeedbackCount: number
}

export function applyPendingFeedbackOverlay(
  baseGroups: ClusterGroup[],
  feedbackItems: ClusterFeedbackResponse[],
  activeVersion: ClusterVersionResponse | null | undefined,
  serverFiltered = false
): PendingFeedbackOverlayResult {
  const pendingFeedback = serverFiltered
    ? activeSupportedFeedbackItems(feedbackItems)
    : pendingClusterFeedbackItems(feedbackItems, activeVersion)
  const groups = cloneGroupsWithoutPendingMarkers(baseGroups)
  const groupIndex = indexGroups(groups)

  pendingFeedback.forEach((feedback) => {
    if (feedback.feedback_type === "metadata_edit_keep_cluster") {
      markFeedbackDocument(groups, feedback)
      return
    }

    const targetClusterId = feedbackTargetClusterId(feedback)
    if (!targetClusterId) return

    let targetGroup = findGroupByClusterId(groupIndex, targetClusterId)
    if (!targetGroup && feedback.feedback_type === "temporary_dossier") {
      targetGroup = createPendingDossierGroup(targetClusterId, feedback)
      groups.unshift(targetGroup)
      addGroupToIndex(groupIndex, targetGroup)
    }
    if (!targetGroup) return

    const documentMatch = takeFeedbackDocument(groups, feedback)
    if (!documentMatch) return

    const action = feedbackAction(feedback)
    targetGroup.documents.push({
      ...documentMatch.document,
      positionIndex: targetGroup.documents.length,
      pendingFeedback: {
        id: feedback.id,
        action,
        sourceClusterId: feedback.source_cluster_id ?? null,
        targetClusterId,
        createdAt: feedback.created_at,
      },
    })
    targetGroup.pendingFeedbackCount =
      (targetGroup.pendingFeedbackCount ?? 0) + 1
    targetGroup.hasPendingFeedback = true
  })

  return {
    groups: groups.map(finalizeGroup),
    pendingFeedbackCount: pendingFeedback.length,
  }
}

export function clearPendingFeedbackMarkers(
  groups: ClusterGroup[]
): ClusterGroup[] {
  return groups.map((group) =>
    finalizeGroup({
      ...group,
      pendingFeedbackCount: 0,
      hasPendingFeedback: false,
      documents: group.documents.map((document) =>
        document.pendingFeedback
          ? { ...document, pendingFeedback: null }
          : document
      ),
    })
  )
}

export function pendingFeedbackActionLabel(
  _action: string | null | undefined
): string {
  return "Chờ cập nhật"
}

function pendingClusterFeedbackItems(
  feedbackItems: ClusterFeedbackResponse[],
  activeVersion: ClusterVersionResponse | null | undefined
): ClusterFeedbackResponse[] {
  const cutoff = activeVersion?.created_at
    ? Date.parse(activeVersion.created_at)
    : Number.NaN
  if (!Number.isFinite(cutoff)) return []

  return feedbackItems
    .filter((feedback) => {
      if (feedback.status !== "active") return false
      if (!PENDING_FEEDBACK_TYPES.has(feedback.feedback_type)) return false
      const createdAt = Date.parse(feedback.created_at)
      return Number.isFinite(createdAt) && createdAt > cutoff
    })
    .sort((a, b) => a.id - b.id)
}

function activeSupportedFeedbackItems(
  feedbackItems: ClusterFeedbackResponse[]
): ClusterFeedbackResponse[] {
  return feedbackItems
    .filter(
      (feedback) =>
        feedback.status === "active" &&
        PENDING_FEEDBACK_TYPES.has(feedback.feedback_type)
    )
    .sort((a, b) => a.id - b.id)
}

function cloneGroupsWithoutPendingMarkers(
  groups: ClusterGroup[]
): ClusterGroup[] {
  return groups.map((group) => ({
    ...group,
    pendingFeedbackCount: 0,
    hasPendingFeedback: false,
    documents: group.documents.map((document) => ({
      ...document,
      pendingFeedback: null,
    })),
  }))
}

function indexGroups(groups: ClusterGroup[]): Map<string, ClusterGroup> {
  const index = new Map<string, ClusterGroup>()
  groups.forEach((group) => addGroupToIndex(index, group))
  return index
}

function addGroupToIndex(
  index: Map<string, ClusterGroup>,
  group: ClusterGroup
) {
  ;[group.id, group.clusterId, group.dossierId].forEach((key) => {
    if (key && !index.has(key)) index.set(key, group)
  })
}

function findGroupByClusterId(
  index: Map<string, ClusterGroup>,
  clusterId: string
): ClusterGroup | null {
  return index.get(clusterId) ?? null
}

function takeFeedbackDocument(
  groups: ClusterGroup[],
  feedback: ClusterFeedbackResponse
): { group: ClusterGroup; document: ClusterDocument } | null {
  for (const group of groups) {
    const documentIndex = group.documents.findIndex((document) =>
      feedbackMatchesDocument(feedback, document)
    )
    if (documentIndex < 0) continue
    const [document] = group.documents.splice(documentIndex, 1)
    if (document.pendingFeedback) {
      group.pendingFeedbackCount = Math.max(
        0,
        (group.pendingFeedbackCount ?? 1) - 1
      )
      group.hasPendingFeedback = (group.pendingFeedbackCount ?? 0) > 0
    }
    group.files = group.documents.map((item) => item.filePath)
    return { group, document }
  }
  return null
}

function markFeedbackDocument(
  groups: ClusterGroup[],
  feedback: ClusterFeedbackResponse
) {
  for (const group of groups) {
    const documentIndex = group.documents.findIndex((document) =>
      feedbackMatchesDocument(feedback, document)
    )
    if (documentIndex < 0) continue
    const document = group.documents[documentIndex]
    group.documents[documentIndex] = {
      ...document,
      pendingFeedback: {
        id: feedback.id,
        action: feedbackAction(feedback),
        sourceClusterId: feedback.source_cluster_id ?? null,
        targetClusterId: feedbackTargetClusterId(feedback),
        createdAt: feedback.created_at,
      },
    }
    group.pendingFeedbackCount = (group.pendingFeedbackCount ?? 0) + 1
    group.hasPendingFeedback = true
    return
  }
}

function feedbackMatchesDocument(
  feedback: ClusterFeedbackResponse,
  document: ClusterDocument
): boolean {
  if (
    feedback.session_document_id !== null &&
    document.sessionDocumentId === feedback.session_document_id
  ) {
    return true
  }
  return Boolean(
    feedback.document_id && document.documentId === feedback.document_id
  )
}

function feedbackTargetClusterId(
  feedback: ClusterFeedbackResponse
): string | null {
  return (
    textValue(feedback.target_cluster_id) ??
    textValue(feedback.details?.target_cluster_id) ??
    null
  )
}

function feedbackAction(feedback: ClusterFeedbackResponse): string {
  return (
    textValue(feedback.details?.action) ??
    (feedback.target_cluster_id === TEMPORARY_CLUSTER_ID
      ? "move_to_temporary_folder"
      : feedback.feedback_type)
  )
}

function createPendingDossierGroup(
  targetClusterId: string,
  feedback: ClusterFeedbackResponse
): ClusterGroup {
  const action = feedbackAction(feedback)
  return {
    id: targetClusterId,
    clusterId: targetClusterId,
    dossierId: targetClusterId,
    label: "Hồ sơ tạm thời",
    files: [],
    documents: [],
    isPendingDossier: true,
    createdFromTemporaryFolder: action === "promote_temporary_folder",
    classificationPath: [],
    requiresReview: false,
    hasPendingFeedback: true,
    pendingFeedbackCount: 0,
    pageCount: 0,
    sheetCount: 0,
  }
}

function finalizeGroup(group: ClusterGroup): ClusterGroup {
  const pageCount = group.documents.reduce(
    (sum, document) => sum + (document.pageCount ?? 0),
    0
  )
  const sheetCount = group.documents.reduce(
    (sum, document) => sum + (document.sheetCount ?? 0),
    0
  )
  return {
    ...group,
    files: group.documents.map((document) => document.filePath),
    pageCount,
    sheetCount,
  }
}

function textValue(value: unknown): string | null {
  if (typeof value !== "string") return null
  const text = value.trim()
  return text || null
}
