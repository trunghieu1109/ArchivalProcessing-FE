import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { listChinhlyUsers, type ChinhlyUser } from "@/features/auth/api/authApi"
import { useAuth } from "@/features/auth/lib/AuthContext"
import { usePagedItems } from "@/features/upload/hooks/usePagedItems"
import { hasMetadataWarning } from "@/features/upload/lib/metadata"
import type { DocumentPreviewTarget } from "@/features/upload/components/DocumentPdfPreview"
import type { PdfMetadata } from "@/features/upload/types"
import {
  EMPTY_METADATA_ITEMS,
  type MetadataActorIdentity,
  type MetadataBatchMode,
  type MetadataReviewMode,
  type MetadataServerPaginationControls,
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

const METADATA_PAGE_SIZE_OPTIONS = [50]
const DEFAULT_METADATA_PAGE_SIZE = 50

interface UseProcessStepModelParams {
  sessionId: string | null
  pdfPaths: string[]
  metadataItems: PdfMetadata[]
  metadataPagination?: MetadataServerPaginationControls
}

export function useProcessStepModel({
  sessionId,
  pdfPaths,
  metadataItems,
  metadataPagination,
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
  const [metadataFileFilter, setMetadataFileFilter] = useState("")
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
  const hasServerPagination = Boolean(metadataPagination)

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
      mergeIncomingMetadata(
        sessionChanged || !isCoordinator ? [] : previous,
        metadataItems,
        { keepMissing: !hasServerPagination }
      )
    )
  }, [hasServerPagination, isCoordinator, metadataItems, metadataKey, sessionId])

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
  const listScopeItems = sortedItems
  const batchScopeItems = useMemo(
    () =>
      isCoordinator
        ? sortedItems
        : sortedItems.filter((item) =>
            isMetadataItemAssignedToUser(item, currentUserIdentity)
          ),
    [currentUserIdentity, isCoordinator, sortedItems]
  )
  const normalizedMetadataFileFilter = useMemo(
    () => normalizeSearchText(metadataFileFilter),
    [metadataFileFilter]
  )
  const filteredListScopeItems = useMemo(
    () =>
      filterMetadataItemsByFileName(
        listScopeItems,
        normalizedMetadataFileFilter
      ),
    [listScopeItems, normalizedMetadataFileFilter]
  )
  const filteredBatchScopeItems = useMemo(
    () =>
      filterMetadataItemsByFileName(
        batchScopeItems,
        normalizedMetadataFileFilter
      ),
    [batchScopeItems, normalizedMetadataFileFilter]
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
  const activeBatchVisibleItems = useMemo(
    () =>
      filterMetadataItemsByFileName(
        activeBatch?.items ?? EMPTY_METADATA_ITEMS,
        normalizedMetadataFileFilter
      ),
    [activeBatch, normalizedMetadataFileFilter]
  )
  const unassignedBatchVisibleItems = useMemo(
    () =>
      filterMetadataItemsByFileName(
        unassignedBatch?.items ?? EMPTY_METADATA_ITEMS,
        normalizedMetadataFileFilter
      ),
    [normalizedMetadataFileFilter, unassignedBatch]
  )
  const unpagedDisplayedItems =
    reviewMode === "batch"
      ? manualSplitActive
        ? unassignedBatchVisibleItems
        : activeBatchVisibleItems
      : filteredListScopeItems
  const clientDisplayedPagination = usePagedItems(unpagedDisplayedItems, {
    defaultPageSize: DEFAULT_METADATA_PAGE_SIZE,
    pageSizeOptions: METADATA_PAGE_SIZE_OPTIONS,
    resetKey: `${sessionId ?? ""}:${reviewMode}:${batchMode}:${manualSplitActive ? "split" : "normal"}:${activeBatch?.index ?? "list"}:${normalizedMetadataFileFilter}`,
    storageKey: "archival-processing.metadata-display-page-size",
  })
  const serverPagination = metadataPagination?.pagination ?? null
  const displayedItems = metadataPagination
    ? unpagedDisplayedItems
    : clientDisplayedPagination.items
  const displayedPagination = metadataPagination
    ? serverPaginationForControls(
        metadataPagination,
        serverPagination,
        displayedItems.length
      )
    : clientDisplayedPagination
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
  const displayedRetryableItems = useMemo(
    () =>
      displayedItems.filter(
        (item) =>
          isMetadataFailedItem(item) &&
          canUserEditMetadataItem(item, currentUserIdentity)
      ),
    [currentUserIdentity, displayedItems]
  )
  const displayedBulkSelectableItems = useMemo(() => {
    const byId = new Map<number, PdfMetadata>()
    displayedConfirmableItems.forEach((item) => byId.set(item.id, item))
    displayedRetryableItems.forEach((item) => byId.set(item.id, item))
    return displayedItems.filter((item) => byId.has(item.id))
  }, [displayedConfirmableItems, displayedItems, displayedRetryableItems])
  const bulkSelectedItems = useMemo(
    () =>
      displayedBulkSelectableItems.filter((item) =>
        bulkSelectedIds.has(item.id)
      ),
    [bulkSelectedIds, displayedBulkSelectableItems]
  )
  const bulkRetryItems = bulkReviewSelectionActive
    ? bulkSelectedItems.filter(isMetadataFailedItem)
    : EMPTY_METADATA_ITEMS
  const bulkVerifyItems = bulkReviewSelectionActive
    ? bulkSelectedItems.filter(isMetadataConfirmable)
    : reviewMode === "batch" && !manualSplitActive
      ? displayedConfirmableItems
      : EMPTY_METADATA_ITEMS
  const bulkSelectionCount = bulkSelectedItems.length
  const canBulkSelectMetadata =
    !manualSplitActive && displayedBulkSelectableItems.length > 0
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
    const availableItems = manualSplitActive
      ? displayedItems
      : filteredListScopeItems
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
    filteredListScopeItems,
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
    const activeItems = manualSplitActive
      ? unassignedBatchVisibleItems
      : activeBatchVisibleItems
    if (!activeBatch || activeItems.length === 0) {
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
      activeItems.some((item) => item.id === selectedDocumentId)
    ) {
      return
    }
    setSelectedDocumentId(firstPreferredMetadataItem(activeItems)?.id ?? null)
  }, [
    activeBatch,
    activeBatchVisibleItems,
    batchMode,
    manualSplitActive,
    reviewMode,
    selectedDocumentId,
    unassignedBatch,
    unassignedBatchVisibleItems,
  ])

  useEffect(() => {
    if (reviewMode !== "list") return
    if (filteredListScopeItems.length === 0) {
      setSelectedDocumentId(null)
      didAutoSelectRef.current = false
      return
    }
    if (
      selectedDocumentId !== null &&
      filteredListScopeItems.some((item) => item.id === selectedDocumentId)
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
      filteredListScopeItems.find(
        (item) => item.is_reviewed !== true && hasMetadataWarning(item)
      ) ?? filteredListScopeItems[0]
    setSelectedDocumentId(firstWarning.id)
    didAutoSelectRef.current = true
  }, [filteredListScopeItems, reviewMode, selectedDocumentId])

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
    metadataFileFilter,
    setMetadataFileFilter,
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
    hasServerPagination,
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
    listScopeItems,
    filteredListScopeItems,
    batchScopeItems,
    filteredBatchScopeItems,
    batchGroups,
    unassignedBatch,
    activeBatch,
    unpagedDisplayedItems,
    displayedPagination,
    displayedItems,
    displayedItemIdsKey,
    displayedConfirmableItems,
    displayedRetryableItems,
    displayedBulkSelectableItems,
    bulkSelectedItems,
    bulkRetryItems,
    bulkVerifyItems,
    bulkSelectionCount,
    canBulkSelectMetadata,
    selectedItem,
    previewDocument,
  }
}

function serverPaginationForControls(
  controls: MetadataServerPaginationControls,
  pagination: MetadataServerPaginationControls["pagination"],
  visibleItemCount: number
) {
  const pageSize = Math.max(1, Math.floor(Number(controls.pageSize) || 1))
  const total = Math.max(
    0,
    Math.floor(Number(pagination?.total ?? visibleItemCount) || 0)
  )
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const pageIndex = Math.min(
    Math.max(0, Math.floor(Number(controls.pageIndex) || 0)),
    pageCount - 1
  )
  const offset = Math.max(
    0,
    Math.floor(Number(pagination?.offset ?? pageIndex * pageSize) || 0)
  )
  const returned = Math.max(
    visibleItemCount,
    Math.floor(Number(pagination?.returned ?? 0) || 0)
  )
  return {
    total,
    pageIndex,
    pageSize,
    pageCount,
    startNumber: total === 0 ? 0 : offset + 1,
    endNumber: total === 0 ? 0 : Math.min(total, offset + returned),
    setPageIndex: controls.onPageChange,
  }
}

function filterMetadataItemsByFileName(
  items: PdfMetadata[],
  normalizedFilter: string
): PdfMetadata[] {
  if (!normalizedFilter) return items
  return items.filter((item) =>
    normalizeSearchText(
      [fileNameFromPath(item.data_path), item.data_path, item.document_id].join(
        " "
      )
    ).includes(normalizedFilter)
  )
}

function normalizeSearchText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}
