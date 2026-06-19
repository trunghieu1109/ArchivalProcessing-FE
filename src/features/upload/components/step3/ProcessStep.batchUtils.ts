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
  type MetadataBatchGroup,
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
    groups.push(
      buildMetadataBatchGroup({
        kind: "auto",
        index,
        label: `Lô ${String(index + (reviewedItems.length ? 0 : 1)).padStart(2, "0")}`,
        start: start + 1,
        end: start + groupItems.length,
        batchId: null,
        items: groupItems,
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
        label: `Lô ${String(manualGroupNumber).padStart(2, "0")}`,
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

export function normalizedMetadataBatchId(
  value: string | null | undefined
): string | null {
  const text = String(value ?? "").trim()
  return text || null
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
    (item.is_reviewed === true && !batchId)
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
  label,
  start,
  end,
  batchId,
  items,
}: {
  kind: MetadataBatchGroup["kind"]
  index: number
  label: string
  start: number
  end: number
  batchId?: string | null
  items: PdfMetadata[]
}): MetadataBatchGroup {
  const reviewedCount = items.filter((item) => item.is_reviewed === true).length
  const readyCount = items.filter((item) => item.metadata_ready).length
  const warningCount = items.filter(needsMetadataReview).length
  const pendingReadyCount = items.filter(isMetadataConfirmable).length
  const assignedItem = items.find(
    (item) =>
      item.metadata_batch_assigned_to_user_id ||
      item.metadata_batch_assigned_to_email ||
      item.metadata_batch_assigned_to_name
  )

  return {
    kind,
    index,
    label,
    start,
    end,
    batchId: batchId ?? null,
    items,
    readyCount,
    reviewedCount,
    warningCount,
    pendingReadyCount,
    assigneeName: assignedItem?.metadata_batch_assigned_to_name ?? null,
    assigneeEmail: assignedItem?.metadata_batch_assigned_to_email ?? null,
    assigneeUserId: assignedItem?.metadata_batch_assigned_to_user_id ?? null,
  }
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
