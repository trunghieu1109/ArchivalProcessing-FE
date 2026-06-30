import type { ChinhlyUser } from "@/features/auth/api/authApi"
import { hasMetadataWarning } from "@/features/upload/lib/metadata"
import type { PdfMetadata } from "@/features/upload/types"
import {
  DEFAULT_METADATA_BATCH_SIZE,
  LEGACY_METADATA_VERIFIED_BATCH_ID,
  BATCH_SIZE_STORAGE_KEY,
  MAX_METADATA_BATCH_SIZE,
  METADATA_REVIEWED_BATCH_ID,
  MIN_METADATA_BATCH_SIZE,
  REVIEW_MODE_STORAGE_KEY,
  type MetadataActorIdentity,
  type MetadataBatchSummary,
  type MetadataBatchGroup,
  type MetadataDocumentScope,
  type MetadataReviewMode,
} from "./ProcessStep.types"
import {
  isMetadataConfirmable,
  needsMetadataReview,
} from "./ProcessStep.metadataUtils"

export function buildMetadataBatchGroups(
  items: PdfMetadata[],
  batchSize: number
): MetadataBatchGroup[] {
  const normalizedBatchSize = normalizeBatchSize(batchSize)
  const groups: MetadataBatchGroup[] = []
  const reviewedItems = items.filter(isReviewedMetadataItem)
  const reviewedIds = new Set(reviewedItems.map((item) => item.id))
  const pendingItems = items.filter((item) => !reviewedIds.has(item.id))

  if (reviewedItems.length > 0) {
    groups.push(
      buildMetadataBatchGroup({
        kind: "reviewed",
        index: groups.length,
        label: "Tài liệu đã review",
        start: 0,
        end: 0,
        batchId: METADATA_REVIEWED_BATCH_ID,
        items: reviewedItems,
      })
    )
  }

  for (
    let start = 0;
    start < pendingItems.length;
    start += normalizedBatchSize
  ) {
    const groupItems = pendingItems.slice(start, start + normalizedBatchSize)
    const index = groups.length
    const displayIndex = index + (reviewedItems.length ? 0 : 1)
    groups.push(
      buildMetadataBatchGroup({
        kind: "auto",
        index,
        displayIndex,
        label: metadataBatchLabel(displayIndex),
        start: start + 1,
        end: start + groupItems.length,
        batchId: null,
        items: groupItems,
      })
    )
  }

  return groups
}

export function buildMetadataBatchGroupsFromSummaries(
  summaries: MetadataBatchSummary[],
  pageItems: PdfMetadata[],
  batchSize: number,
  documentScope: MetadataDocumentScope
): MetadataBatchGroup[] {
  if (summaries.length === 0) return []

  const normalizedBatchSize = normalizeBatchSize(batchSize)
  const groups: MetadataBatchGroup[] = []
  const reviewedSummary = summaries.find(
    (summary) => summary.kind === "reviewed"
  )
  const pageItemsByBucketKey = new Map<string, PdfMetadata[]>()
  pageItems.forEach((item) => {
    const key = metadataBatchBucketKeyFromItem(item)
    const bucketItems = pageItemsByBucketKey.get(key) ?? []
    bucketItems.push(item)
    pageItemsByBucketKey.set(key, bucketItems)
  })

  if (reviewedSummary && reviewedSummary.total_count > 0) {
    const reviewedPageItems =
      documentScope.scope === "reviewed"
        ? pageItems.filter(isReviewedMetadataItem)
        : []
    groups.push(
      buildMetadataBatchGroup({
        kind: "reviewed",
        index: groups.length,
        label: "Tài liệu đã review",
        start: 0,
        end: reviewedSummary.total_count,
        batchId: METADATA_REVIEWED_BATCH_ID,
        items: reviewedPageItems,
        totalCount: reviewedSummary.total_count,
        readyCount: reviewedSummary.ready_count,
        reviewedCount: reviewedSummary.reviewed_count,
        warningCount: reviewedSummary.warning_count,
        pendingReadyCount: reviewedSummary.pending_ready_count,
      })
    )
  }

  const manualSummaries = summaries.filter(
    (summary) =>
      summary.kind === "manual" &&
      Boolean(normalizedMetadataBatchId(summary.batch_id)) &&
      summary.total_count > 0
  )
  let nextFallbackDisplayIndex = 1
  manualSummaries.forEach((summary) => {
    const batchId = normalizedMetadataBatchId(summary.batch_id)
    if (!batchId) return
    const displayIndex = metadataBatchDisplayIndex(
      summary,
      nextFallbackDisplayIndex
    )
    nextFallbackDisplayIndex = Math.max(
      nextFallbackDisplayIndex + 1,
      displayIndex + 1
    )
    const key = metadataBatchBucketKey("manual", batchId)
    groups.push(
      buildMetadataBatchGroup({
        kind: "manual",
        index: groups.length,
        displayIndex,
        label: metadataBatchLabel(displayIndex),
        start: 0,
        end: summary.total_count,
        batchId,
        items: pageItemsByBucketKey.get(key) ?? [],
        totalCount: summary.total_count,
        readyCount: summary.ready_count,
        reviewedCount: summary.reviewed_count,
        warningCount: summary.warning_count,
        pendingReadyCount: summary.pending_ready_count,
        assigneeName: summary.assignee_name ?? null,
        assigneeEmail: summary.assignee_email ?? null,
        assigneeUserId: summary.assignee_user_id ?? null,
      })
    )
  })

  const existingBatchCount = Math.max(
    manualSummaries.length,
    ...manualSummaries.map((summary) => metadataBatchDisplayIndex(summary, 0))
  )
  const unassignedSummary = summaries.find(
    (summary) => summary.kind === "unassigned"
  )
  const pendingTotal = unassignedSummary?.total_count ?? 0
  const activeAutoOffset =
    documentScope.scope === "auto"
      ? Math.max(0, Math.floor(Number(documentScope.offset) || 0))
      : -1

  for (let start = 0; start < pendingTotal; start += normalizedBatchSize) {
    const totalCount = Math.min(normalizedBatchSize, pendingTotal - start)
    const index = groups.length
    const displayIndex =
      existingBatchCount + Math.floor(start / normalizedBatchSize) + 1
    const groupItems =
      activeAutoOffset === start
        ? pageItems.filter(
            (item) =>
              !isReviewedMetadataItem(item) &&
              !normalizedMetadataBatchId(item.metadata_batch_id)
          )
        : []
    groups.push(
      buildMetadataBatchGroup({
        kind: "auto",
        index,
        displayIndex,
        label: metadataBatchLabel(displayIndex),
        start: start + 1,
        end: start + totalCount,
        batchId: null,
        items: groupItems,
        totalCount,
      })
    )
  }

  return groups
}

export function buildManualMetadataBatchGroups(
  items: PdfMetadata[]
): MetadataBatchGroup[] {
  const assignedIds = new Set<number>()
  const groups: MetadataBatchGroup[] = []
  const itemsByBatchId = new Map<string, PdfMetadata[]>()

  items.forEach((item) => {
    const batchId = normalizedMetadataBatchId(item.metadata_batch_id)
    if (!batchId) return
    const groupItems = itemsByBatchId.get(batchId) ?? []
    groupItems.push(item)
    itemsByBatchId.set(batchId, groupItems)
  })

  const reviewedItems = items.filter(isReviewedMetadataBucketItem)
  if (reviewedItems.length > 0) {
    reviewedItems.forEach((item) => assignedIds.add(item.id))
    groups.push(
      buildMetadataBatchGroup({
        kind: "reviewed",
        index: groups.length,
        label: "Tài liệu đã review",
        start: 0,
        end: 0,
        batchId: METADATA_REVIEWED_BATCH_ID,
        items: reviewedItems,
      })
    )
  }

  let manualGroupNumber = 1
  itemsByBatchId.forEach((groupItems, batchId) => {
    if (
      batchId === METADATA_REVIEWED_BATCH_ID ||
      batchId === LEGACY_METADATA_VERIFIED_BATCH_ID
    ) {
      return
    }
    if (groupItems.length === 0) return
    groupItems.forEach((item) => assignedIds.add(item.id))
    const index = groups.length
    groups.push(
      buildMetadataBatchGroup({
        kind: "manual",
        index,
        displayIndex: manualGroupNumber,
        label: metadataBatchLabel(manualGroupNumber),
        start: 0,
        end: 0,
        batchId,
        items: groupItems,
      })
    )
    manualGroupNumber += 1
  })

  const unassignedItems = items.filter((item) => !assignedIds.has(item.id))
  if (unassignedItems.length > 0 || groups.length === 0) {
    groups.push(
      buildMetadataBatchGroup({
        kind: "unassigned",
        index: groups.length,
        label: "Chưa chia",
        start: 1,
        end: unassignedItems.length,
        batchId: null,
        items: unassignedItems,
      })
    )
  }

  return groups
}

export function buildManualMetadataBatchGroupsFromSummaries(
  summaries: MetadataBatchSummary[],
  pageItems: PdfMetadata[]
): MetadataBatchGroup[] {
  if (summaries.length === 0) return []

  const pageItemsByBucketKey = new Map<string, PdfMetadata[]>()
  pageItems.forEach((item) => {
    const key = metadataBatchBucketKeyFromItem(item)
    const bucketItems = pageItemsByBucketKey.get(key) ?? []
    bucketItems.push(item)
    pageItemsByBucketKey.set(key, bucketItems)
  })

  let manualGroupNumber = 1
  return summaries.map((summary, index) => {
    const kind = summary.kind
    const displayIndex =
      kind === "manual"
        ? metadataBatchDisplayIndex(summary, manualGroupNumber)
        : null
    const batchId =
      kind === "reviewed"
        ? METADATA_REVIEWED_BATCH_ID
        : kind === "manual"
          ? normalizedMetadataBatchId(summary.batch_id)
          : null
    const key = metadataBatchBucketKey(kind, batchId)
    const items = pageItemsByBucketKey.get(key) ?? []
    const label =
      kind === "reviewed"
        ? "Tài liệu đã review"
        : kind === "unassigned"
          ? "Chưa chia"
          : metadataBatchLabel(displayIndex ?? manualGroupNumber)
    if (kind === "manual" && displayIndex !== null) {
      manualGroupNumber = Math.max(manualGroupNumber + 1, displayIndex + 1)
    }
    return buildMetadataBatchGroup({
      kind,
      index,
      displayIndex,
      label,
      start: kind === "unassigned" ? 1 : 0,
      end: summary.total_count,
      batchId,
      items,
      totalCount: summary.total_count,
      readyCount: summary.ready_count,
      reviewedCount: summary.reviewed_count,
      warningCount: summary.warning_count,
      pendingReadyCount: summary.pending_ready_count,
      assigneeName: summary.assignee_name ?? null,
      assigneeEmail: summary.assignee_email ?? null,
      assigneeUserId: summary.assignee_user_id ?? null,
    })
  })
}

export function normalizedMetadataBatchId(
  value: string | null | undefined
): string | null {
  const text = String(value ?? "").trim()
  return text || null
}

function metadataBatchDisplayIndex(
  summary: MetadataBatchSummary,
  fallback: number
): number {
  const value = Number(summary.display_index)
  if (Number.isFinite(value) && value > 0) return Math.floor(value)
  return Math.max(1, Math.floor(fallback))
}

function metadataBatchLabel(displayIndex: number): string {
  return `Lô ${String(Math.max(1, displayIndex)).padStart(2, "0")}`
}

export function isReviewedMetadataBatchId(batchId: string | null): boolean {
  return (
    batchId === METADATA_REVIEWED_BATCH_ID ||
    batchId === LEGACY_METADATA_VERIFIED_BATCH_ID
  )
}

export function isReviewedMetadataBucketItem(item: PdfMetadata): boolean {
  const batchId = normalizedMetadataBatchId(item.metadata_batch_id)
  return (
    isReviewedMetadataBatchId(batchId) ||
    (item.is_reviewed === true && !batchId) ||
    (item.review_status === "verified" && !batchId)
  )
}

export function isReviewedMetadataItem(item: PdfMetadata): boolean {
  return (
    item.is_reviewed === true ||
    isReviewedMetadataBatchId(normalizedMetadataBatchId(item.metadata_batch_id))
  )
}

export function canUserEditMetadataItem(
  item: PdfMetadata,
  actor: MetadataActorIdentity
): boolean {
  if (actor.isCoordinator) return true
  return isMetadataItemAssignedToUser(item, actor)
}

export function canUserRestartMetadata(actor: MetadataActorIdentity): boolean {
  return actor.isCoordinator
}

export function isMetadataItemAssignedToUser(
  item: PdfMetadata,
  actor: MetadataActorIdentity
): boolean {
  const assignedTo = String(
    item.metadata_batch_assigned_to_user_id ?? ""
  ).trim()
  const assignedEmail = String(item.metadata_batch_assigned_to_email ?? "")
    .trim()
    .toLowerCase()
  const assignedName = String(item.metadata_batch_assigned_to_name ?? "").trim()
  if (actor.id && assignedTo && assignedTo === actor.id) return true
  if (
    actor.email &&
    assignedEmail &&
    assignedEmail === actor.email.toLowerCase()
  ) {
    return true
  }
  return Boolean(actor.name && assignedName && assignedName === actor.name)
}

export function findUnassignedBatchIndex(groups: MetadataBatchGroup[]): number {
  return groups.findIndex((group) => group.kind === "unassigned")
}

export function chinhlyUserId(user: ChinhlyUser): string {
  return String(user.id ?? user.user_id ?? "").trim()
}

export function chinhlyUserLabel(user: ChinhlyUser): string {
  const name = String(user.display_name ?? user.name ?? "").trim()
  const email = String(user.email ?? user.username ?? "").trim()
  if (name && email) return `${name} (${email})`
  return name || email || chinhlyUserId(user)
}

export function buildMetadataBatchGroup({
  kind,
  index,
  displayIndex,
  label,
  start,
  end,
  batchId,
  items,
  totalCount,
  readyCount,
  reviewedCount,
  warningCount,
  pendingReadyCount,
  assigneeName,
  assigneeEmail,
  assigneeUserId,
}: {
  kind: MetadataBatchGroup["kind"]
  index: number
  displayIndex?: number | null
  label: string
  start: number
  end: number
  batchId?: string | null
  items: PdfMetadata[]
  totalCount?: number
  readyCount?: number
  reviewedCount?: number
  warningCount?: number
  pendingReadyCount?: number
  assigneeName?: string | null
  assigneeEmail?: string | null
  assigneeUserId?: string | number | null
}): MetadataBatchGroup {
  const computedReviewedCount = items.filter(
    (item) => item.is_reviewed === true
  ).length
  const computedReadyCount = items.filter((item) => item.metadata_ready).length
  const computedWarningCount = items.filter(needsMetadataReview).length
  const computedPendingReadyCount = items.filter(isMetadataConfirmable).length
  const assignedItem = items.find(
    (item) =>
      item.metadata_batch_assigned_to_user_id ||
      item.metadata_batch_assigned_to_email ||
      item.metadata_batch_assigned_to_name
  )

  return {
    kind,
    index,
    displayIndex: displayIndex ?? null,
    label,
    start,
    end,
    batchId: batchId ?? null,
    items,
    totalCount: totalCount ?? items.length,
    readyCount: readyCount ?? computedReadyCount,
    reviewedCount: reviewedCount ?? computedReviewedCount,
    warningCount: warningCount ?? computedWarningCount,
    pendingReadyCount: pendingReadyCount ?? computedPendingReadyCount,
    assigneeName:
      assigneeName ?? assignedItem?.metadata_batch_assigned_to_name ?? null,
    assigneeEmail:
      assigneeEmail ?? assignedItem?.metadata_batch_assigned_to_email ?? null,
    assigneeUserId:
      assigneeUserId ??
      assignedItem?.metadata_batch_assigned_to_user_id ??
      null,
  }
}

export function metadataDocumentScopeForGroup(
  group: MetadataBatchGroup
): MetadataDocumentScope {
  if (group.kind === "unassigned") return { scope: "unassigned" as const }
  if (group.kind === "reviewed") return { scope: "reviewed" as const }
  if (group.kind === "auto") {
    return {
      scope: "auto",
      offset: Math.max(0, group.start - 1),
      size: Math.max(1, group.totalCount),
    }
  }
  if (group.kind === "manual" && group.batchId) {
    return { scope: "batch" as const, batchId: group.batchId }
  }
  return { scope: "all" as const }
}

function metadataBatchBucketKeyFromItem(item: PdfMetadata): string {
  if (isReviewedMetadataBucketItem(item)) {
    return metadataBatchBucketKey("reviewed", METADATA_REVIEWED_BATCH_ID)
  }
  const batchId = normalizedMetadataBatchId(item.metadata_batch_id)
  if (batchId) return metadataBatchBucketKey("manual", batchId)
  return metadataBatchBucketKey("unassigned", null)
}

function metadataBatchBucketKey(
  kind: MetadataBatchGroup["kind"],
  batchId: string | null
): string {
  if (kind === "reviewed") return "reviewed"
  if (kind === "manual") return `manual:${batchId ?? ""}`
  if (kind === "unassigned") return "unassigned"
  return "auto"
}

export function selectedRange(
  items: PdfMetadata[],
  fromId: number,
  toId: number
): PdfMetadata[] {
  const fromIndex = items.findIndex((item) => item.id === fromId)
  const toIndex = items.findIndex((item) => item.id === toId)
  if (fromIndex < 0 || toIndex < 0) {
    return items.filter((item) => item.id === toId)
  }
  const start = Math.min(fromIndex, toIndex)
  const end = Math.max(fromIndex, toIndex)
  return items.slice(start, end + 1)
}

export function firstPreferredMetadataItem(
  items: PdfMetadata[]
): PdfMetadata | null {
  return (
    items.find(
      (item) => item.is_reviewed !== true && hasMetadataWarning(item)
    ) ??
    items.find((item) => item.metadata_ready && item.is_reviewed !== true) ??
    items[0] ??
    null
  )
}

export function normalizeBatchSize(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_METADATA_BATCH_SIZE
  return Math.min(
    MAX_METADATA_BATCH_SIZE,
    Math.max(MIN_METADATA_BATCH_SIZE, Math.round(value))
  )
}

export function saveBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = objectUrl
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000)
}

export function writeStoredReviewMode(value: MetadataReviewMode) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(REVIEW_MODE_STORAGE_KEY, value)
  } catch {
    // localStorage can be unavailable in private or restricted browser contexts.
  }
}

export function readStoredBatchSize(): number {
  if (typeof window === "undefined") return DEFAULT_METADATA_BATCH_SIZE
  try {
    const value = Number(window.localStorage.getItem(BATCH_SIZE_STORAGE_KEY))
    return normalizeBatchSize(value)
  } catch {
    return DEFAULT_METADATA_BATCH_SIZE
  }
}

export function writeStoredBatchSize(value: number) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(
      BATCH_SIZE_STORAGE_KEY,
      String(normalizeBatchSize(value))
    )
  } catch {
    // localStorage can be unavailable in private or restricted browser contexts.
  }
}

export function addId(values: Set<number>, id: number): Set<number> {
  const next = new Set(values)
  next.add(id)
  return next
}

export function removeId(values: Set<number>, id: number): Set<number> {
  const next = new Set(values)
  next.delete(id)
  return next
}

export function addTextId(values: Set<string>, id: string): Set<string> {
  const next = new Set(values)
  next.add(id)
  return next
}

export function removeTextId(values: Set<string>, id: string): Set<string> {
  const next = new Set(values)
  next.delete(id)
  return next
}

export function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() || path
}
