import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { listChinhlyUsers, type ChinhlyUser } from "@/features/auth/api/authApi"
import { useAuth } from "@/features/auth/lib/AuthContext"
import { hasMetadataWarning } from "@/features/upload/lib/metadata"
import type { DocumentPreviewTarget } from "@/features/upload/components/DocumentPdfPreview"
import type { PdfMetadata } from "@/features/upload/types"
import {
  EMPTY_METADATA_ITEMS,
  type MetadataActorIdentity,
  type MetadataBatchMode,
  type MetadataReviewMode,
} from "./ProcessStep.types"
import {
  isAutomaticallyVerifiedMetadata,
  isMetadataConfirmable,
  isMetadataExtractionPending,
  isMetadataFailedItem,
  mergeIncomingMetadata,
  metadataSortScore,
  needsMetadataReview,
} from "./ProcessStep.metadataUtils"
import {
  buildManualMetadataBatchGroups,
  buildMetadataBatchGroups,
  canUserEditMetadataItem,
  chinhlyUserId,
  fileNameFromPath,
  findUnassignedBatchIndex,
  firstPreferredMetadataItem,
  isMetadataItemAssignedToUser,
  readStoredBatchSize,
  writeStoredBatchSize,
  writeStoredReviewMode,
} from "./ProcessStep.batchUtils"

interface UseProcessStepModelParams {
  sessionId: string | null
  pdfPaths: string[]
  metadataItems: PdfMetadata[]
}

export function useProcessStepModel({
  sessionId,
  pdfPaths,
  metadataItems,
}: UseProcessStepModelParams) {
  const { user } = useAuth()
  const [items, setItems] = useState<PdfMetadata[]>([])
  const [verifyingIds, setVerifyingIds] = useState<Set<number>>(() => new Set())
  const [retryingIds, setRetryingIds] = useState<Set<number>>(() => new Set())
  const [bulkVerifying, setBulkVerifying] = useState(false)
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(
    null
  )
  const [previewWidthPercent, setPreviewWidthPercent] = useState(48)
  const [reviewMode, setReviewMode] = useState<MetadataReviewMode>("list")
  const [batchSize, setBatchSize] = useState(() => readStoredBatchSize())
  const [batchSizeInput, setBatchSizeInput] = useState(() =>
    String(readStoredBatchSize())
  )
  const [batchMode, setBatchMode] = useState<MetadataBatchMode>("manual")
  const [manualSplitActive, setManualSplitActive] = useState(false)
  const [creatingManualBatch, setCreatingManualBatch] = useState(false)
  const [closingBatchIds, setClosingBatchIds] = useState<Set<string>>(
    () => new Set()
  )
  const [manualSelectedIds, setManualSelectedIds] = useState<Set<number>>(
    () => new Set()
  )
  const [bulkReviewSelectionActive, setBulkReviewSelectionActive] =
    useState(false)
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<number>>(
    () => new Set()
  )
  const [exportingMetadataReview, setExportingMetadataReview] = useState(false)
  const [workers, setWorkers] = useState<ChinhlyUser[]>([])
  const [workersLoading, setWorkersLoading] = useState(false)
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("")
  const [activeBatchIndex, setActiveBatchIndex] = useState(0)
  const previewLayoutRef = useRef<HTMLDivElement | null>(null)
  const didAutoSelectRef = useRef(false)
  const manualLastSelectedIdRef = useRef<number | null>(null)
  const bulkLastSelectedIdRef = useRef<number | null>(null)
  const metadataSessionIdRef = useRef(sessionId)
  const currentUserRole = String(user?.role ?? "")
    .trim()
    .toLowerCase()
  const currentUserId = String(user?.id ?? user?.user_id ?? "").trim()
  const currentUserEmail = String(user?.email ?? user?.username ?? "").trim()
  const currentUserName = String(user?.display_name ?? user?.name ?? "").trim()
  const isCoordinator =
    currentUserRole === "admin" || currentUserRole === "coordinator"
  const currentUserIdentity = useMemo<MetadataActorIdentity>(
    () => ({
      id: currentUserId,
      email: currentUserEmail,
      name: currentUserName,
      isCoordinator,
    }),
    [currentUserEmail, currentUserId, currentUserName, isCoordinator]
  )
  const canManageMetadataBatches = isCoordinator
  const canExportMetadataReview = isCoordinator

  const metadataKey = useMemo(
    () =>
      metadataItems
        .map(
          (item) =>
            `${item.id}:${item.ocr_batch_id ?? ""}:${item.import_action ?? ""}:${item.status}:${item.remote_metadata_status ?? ""}:${item.review_status}:${String(item.is_reviewed ?? false)}:${String(item.metadata_ready)}:${String(item.metadata_final)}:${String(item.metadata_user_edited ?? false)}:${item.metadata_batch_id ?? ""}:${item.metadata_batch_assigned_to_user_id ?? ""}:${item.metadata_batch_assigned_to_email ?? ""}:${item.metadata_batch_assigned_to_name ?? ""}:${item.metadata_verified_by_user_id ?? ""}:${item.metadata_verified_by_email ?? ""}:${item.metadata_verified_by_name ?? ""}`
        )
        .join("\n"),
    [metadataItems]
  )

  useEffect(() => {
    const sessionChanged = metadataSessionIdRef.current !== sessionId
    if (sessionChanged) {
      metadataSessionIdRef.current = sessionId
    }
    setItems((previous) =>
      mergeIncomingMetadata(sessionChanged ? [] : previous, metadataItems)
    )
  }, [metadataItems, metadataKey, sessionId])

  const paths = useMemo(
    () =>
      metadataItems.length > 0
        ? metadataItems.map((item) => item.data_path)
        : pdfPaths,
    [metadataItems, pdfPaths]
  )

  const readyItems = useMemo(
    () => items.filter((item) => item.metadata_ready),
    [items]
  )
  const reviewedItems = useMemo(
    () => items.filter((item) => item.is_reviewed === true),
    [items]
  )
  const failedMetadataItems = useMemo(
    () => items.filter(isMetadataFailedItem),
    [items]
  )
  const pendingExtractionItems = useMemo(
    () => items.filter(isMetadataExtractionPending),
    [items]
  )
  const needsReviewItems = useMemo(
    () => items.filter(needsMetadataReview),
    [items]
  )
  const autoVerifiedItems = useMemo(
    () => items.filter(isAutomaticallyVerifiedMetadata),
    [items]
  )
  const dossierReadyItems = useMemo(
    () =>
      items.filter(
        (item) => item.is_reviewed === true || item.review_status === "verified"
      ),
    [items]
  )
  const pendingReadyItems = useMemo(
    () => readyItems.filter(needsMetadataReview),
    [readyItems]
  )
  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => metadataSortScore(a) - metadataSortScore(b)),
    [items]
  )
  const sortedItemIdsKey = useMemo(
    () => sortedItems.map((item) => item.id).join("|"),
    [sortedItems]
  )
  const batchScopeItems = useMemo(
    () =>
      isCoordinator
        ? sortedItems
        : sortedItems.filter((item) =>
            isMetadataItemAssignedToUser(item, currentUserIdentity)
          ),
    [currentUserIdentity, isCoordinator, sortedItems]
  )
  const batchGroups = useMemo(
    () =>
      batchMode === "manual"
        ? buildManualMetadataBatchGroups(batchScopeItems)
        : buildMetadataBatchGroups(batchScopeItems, batchSize),
    [batchMode, batchSize, batchScopeItems]
  )
  const unassignedBatch = useMemo(
    () => batchGroups.find((group) => group.kind === "unassigned") ?? null,
    [batchGroups]
  )
  const activeBatch = batchGroups[activeBatchIndex] ?? batchGroups[0] ?? null
  const displayedItems =
    reviewMode === "batch"
      ? manualSplitActive
        ? (unassignedBatch?.items ?? EMPTY_METADATA_ITEMS)
        : (activeBatch?.items ?? EMPTY_METADATA_ITEMS)
      : batchScopeItems
  const displayedItemIdsKey = useMemo(
    () => displayedItems.map((item) => item.id).join("|"),
    [displayedItems]
  )
  const displayedConfirmableItems = useMemo(
    () =>
      displayedItems.filter(
        (item) =>
          isMetadataConfirmable(item) &&
          canUserEditMetadataItem(item, currentUserIdentity)
      ),
    [currentUserIdentity, displayedItems]
  )
  const bulkSelectedItems = useMemo(
    () =>
      displayedConfirmableItems.filter((item) => bulkSelectedIds.has(item.id)),
    [bulkSelectedIds, displayedConfirmableItems]
  )
  const bulkVerifyItems = bulkReviewSelectionActive
    ? bulkSelectedItems
    : reviewMode === "batch" && !manualSplitActive
      ? displayedConfirmableItems
      : EMPTY_METADATA_ITEMS
  const bulkSelectionCount = bulkSelectedItems.length
  const canBulkSelectMetadata =
    !manualSplitActive && displayedConfirmableItems.length > 0
  const selectedItem = useMemo(
    () => displayedItems.find((item) => item.id === selectedDocumentId) ?? null,
    [displayedItems, selectedDocumentId]
  )
  const previewDocument = useMemo<DocumentPreviewTarget | null>(
    () =>
      selectedItem
        ? {
            id: selectedItem.id,
            fileName: fileNameFromPath(selectedItem.data_path),
            dataPath: selectedItem.data_path,
          }
        : null,
    [selectedItem]
  )

  useEffect(() => {
    writeStoredReviewMode(reviewMode)
  }, [reviewMode])

  useEffect(() => {
    writeStoredBatchSize(batchSize)
  }, [batchSize])

  useEffect(() => {
    if (!canManageMetadataBatches) {
      setManualSplitActive(false)
      setManualSelectedIds(new Set())
      setSelectedAssigneeId("")
      setWorkers([])
      return
    }

    let cancelled = false
    setWorkersLoading(true)
    listChinhlyUsers({ role: "worker", active: true, limit: 500 })
      .then((nextWorkers) => {
        if (cancelled) return
        setWorkers(nextWorkers)
        setSelectedAssigneeId((current) => {
          if (
            current &&
            nextWorkers.some((worker) => chinhlyUserId(worker) === current)
          ) {
            return current
          }
          return ""
        })
      })
      .catch((err) => {
        if (cancelled) return
        setWorkers([])
        toast.error(
          err instanceof Error
            ? err.message
            : "Khong the tai danh sach nhan vien."
        )
      })
      .finally(() => {
        if (!cancelled) setWorkersLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [canManageMetadataBatches])

  useEffect(() => {
    const availableItems = manualSplitActive ? displayedItems : batchScopeItems
    const availableIds = new Set(availableItems.map((item) => item.id))
    setManualSelectedIds((previous) => {
      const next = new Set<number>()
      let changed = false
      previous.forEach((id) => {
        if (availableIds.has(id)) {
          next.add(id)
        } else {
          changed = true
        }
      })
      return changed ? next : previous
    })
  }, [
    displayedItems,
    displayedItemIdsKey,
    manualSplitActive,
    batchScopeItems,
    sortedItemIdsKey,
  ])

  useEffect(() => {
    if (batchGroups.length === 0) {
      if (activeBatchIndex !== 0) {
        setActiveBatchIndex(0)
      }
      return
    }
    if (activeBatchIndex > batchGroups.length - 1) {
      setActiveBatchIndex(batchGroups.length - 1)
    }
  }, [activeBatchIndex, batchGroups.length])

  useEffect(() => {
    if (
      reviewMode !== "batch" ||
      batchMode !== "manual" ||
      !manualSplitActive
    ) {
      return
    }
    const unassignedIndex = findUnassignedBatchIndex(batchGroups)
    if (unassignedIndex >= 0 && activeBatchIndex !== unassignedIndex) {
      setActiveBatchIndex(unassignedIndex)
      return
    }
    if (unassignedIndex < 0 && activeBatchIndex !== 0) {
      setActiveBatchIndex(0)
    }
  }, [activeBatchIndex, batchGroups, batchMode, manualSplitActive, reviewMode])

  useEffect(() => {
    if (reviewMode !== "batch") return
    if (!activeBatch) {
      if (selectedDocumentId !== null) setSelectedDocumentId(null)
      return
    }
    if (batchMode === "manual" && manualSplitActive) {
      if (!unassignedBatch) {
        if (selectedDocumentId !== null) setSelectedDocumentId(null)
        return
      }
      if (activeBatch.kind !== "unassigned") return
    }
    if (
      selectedDocumentId !== null &&
      activeBatch.items.some((item) => item.id === selectedDocumentId)
    ) {
      return
    }
    setSelectedDocumentId(
      firstPreferredMetadataItem(activeBatch.items)?.id ?? null
    )
  }, [
    activeBatch,
    batchMode,
    manualSplitActive,
    reviewMode,
    selectedDocumentId,
    unassignedBatch,
  ])

  useEffect(() => {
    if (reviewMode !== "list") return
    if (batchScopeItems.length === 0) {
      setSelectedDocumentId(null)
      didAutoSelectRef.current = false
      return
    }
    if (
      selectedDocumentId !== null &&
      batchScopeItems.some((item) => item.id === selectedDocumentId)
    ) {
      return
    }
    if (selectedDocumentId !== null) {
      setSelectedDocumentId(null)
      return
    }
    if (didAutoSelectRef.current) {
      return
    }
    const firstWarning =
      batchScopeItems.find(
        (item) => item.is_reviewed !== true && hasMetadataWarning(item)
      ) ?? batchScopeItems[0]
    setSelectedDocumentId(firstWarning.id)
    didAutoSelectRef.current = true
  }, [batchScopeItems, reviewMode, selectedDocumentId])

  return {
    items,
    setItems,
    verifyingIds,
    setVerifyingIds,
    retryingIds,
    setRetryingIds,
    bulkVerifying,
    setBulkVerifying,
    selectedDocumentId,
    setSelectedDocumentId,
    previewWidthPercent,
    setPreviewWidthPercent,
    reviewMode,
    setReviewMode,
    batchSize,
    setBatchSize,
    batchSizeInput,
    setBatchSizeInput,
    batchMode,
    setBatchMode,
    manualSplitActive,
    setManualSplitActive,
    creatingManualBatch,
    setCreatingManualBatch,
    closingBatchIds,
    setClosingBatchIds,
    manualSelectedIds,
    setManualSelectedIds,
    bulkReviewSelectionActive,
    setBulkReviewSelectionActive,
    bulkSelectedIds,
    setBulkSelectedIds,
    exportingMetadataReview,
    setExportingMetadataReview,
    workers,
    setWorkers,
    workersLoading,
    setWorkersLoading,
    selectedAssigneeId,
    setSelectedAssigneeId,
    activeBatchIndex,
    setActiveBatchIndex,
    previewLayoutRef,
    didAutoSelectRef,
    manualLastSelectedIdRef,
    bulkLastSelectedIdRef,
    metadataSessionIdRef,
    currentUserIdentity,
    isCoordinator,
    canManageMetadataBatches,
    canExportMetadataReview,
    paths,
    readyItems,
    reviewedItems,
    failedMetadataItems,
    pendingExtractionItems,
    needsReviewItems,
    autoVerifiedItems,
    dossierReadyItems,
    pendingReadyItems,
    sortedItems,
    sortedItemIdsKey,
    batchScopeItems,
    batchGroups,
    unassignedBatch,
    activeBatch,
    displayedItems,
    displayedItemIdsKey,
    displayedConfirmableItems,
    bulkSelectedItems,
    bulkVerifyItems,
    bulkSelectionCount,
    canBulkSelectMetadata,
    selectedItem,
    previewDocument,
  }
}
