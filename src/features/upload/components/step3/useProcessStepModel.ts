import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { listChinhlyUsers, type ChinhlyUser } from "@/features/auth/api/authApi"
import { useAuth } from "@/features/auth/lib/AuthContext"
import {
  getAutoMetadataBatchPlan,
  type AutoMetadataBatchPlanResponse,
  type CreateMetadataBatchResponse,
} from "@/features/upload/api/sessionApi"
import { usePagedItems } from "@/features/upload/hooks/usePagedItems"
import { hasMetadataWarning } from "@/features/upload/lib/metadata"
import type { DocumentPreviewTarget } from "@/features/upload/components/DocumentPdfPreview"
import type { PdfMetadata } from "@/features/upload/types"
import {
  EMPTY_METADATA_ITEMS,
  type MetadataActorIdentity,
  type MetadataBatchSummary,
  type MetadataBatchMode,
  type MetadataDocumentScope,
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
  buildManualMetadataBatchGroupsFromSummaries,
  buildMetadataBatchGroups,
  buildMetadataBatchGroupsFromSummaries,
  canUserEditMetadataItem,
  canUserRestartMetadata,
  chinhlyUserId,
  fileNameFromPath,
  findUnassignedBatchIndex,
  firstPreferredMetadataItem,
  isMetadataItemAssignedToUser,
  normalizedMetadataBatchId,
  readStoredBatchSize,
  writeStoredBatchSize,
  writeStoredReviewMode,
} from "./ProcessStep.batchUtils"

const METADATA_PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200, 500, 1000]
const DEFAULT_METADATA_PAGE_SIZE = 50
const MIN_METADATA_PAGE_SIZE = 1
const MAX_METADATA_PAGE_SIZE = 1000

interface UseProcessStepModelParams {
  sessionId: string | null
  pdfPaths: string[]
  metadataItems: PdfMetadata[]
  metadataBatchSummaries?: MetadataBatchSummary[]
  metadataDocumentScope?: MetadataDocumentScope
  metadataPagination?: MetadataServerPaginationControls
}

export function useProcessStepModel({
  sessionId,
  pdfPaths,
  metadataItems,
  metadataBatchSummaries = [],
  metadataDocumentScope = { scope: "all" },
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
  const [manualSelectedOnly, setManualSelectedOnly] = useState(false)
  const [manualSelectedItemSnapshots, setManualSelectedItemSnapshots] =
    useState<Map<number, PdfMetadata>>(() => new Map())
  const [bulkReviewSelectionActive, setBulkReviewSelectionActive] =
    useState(false)
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<number>>(
    () => new Set()
  )
  const [bulkSelectedItemSnapshots, setBulkSelectedItemSnapshots] = useState<
    Map<number, PdfMetadata>
  >(() => new Map())
  const [exportingMetadataReview, setExportingMetadataReview] = useState(false)
  const [workers, setWorkers] = useState<ChinhlyUser[]>([])
  const [workersLoading, setWorkersLoading] = useState(false)
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("")
  const [selectedAutoWorkerIds, setSelectedAutoWorkerIds] = useState<
    Set<string>
  >(() => new Set())
  const [selectedManualWorkerIds, setSelectedManualWorkerIds] = useState<
    Set<string>
  >(() => new Set())
  const [manualQuickCounts, setManualQuickCounts] = useState<
    Map<string, string>
  >(() => new Map())
  const [manualQuickConfirmations, setManualQuickConfirmations] = useState<
    Map<string, CreateMetadataBatchResponse>
  >(() => new Map())
  const [confirmingManualQuickWorkerIds, setConfirmingManualQuickWorkerIds] =
    useState<Set<string>>(() => new Set())
  const [confirmingAllManualQuickBatches, setConfirmingAllManualQuickBatches] =
    useState(false)
  const [autoBatchPlan, setAutoBatchPlan] =
    useState<AutoMetadataBatchPlanResponse | null>(null)
  const [autoBatchPlanRequested, setAutoBatchPlanRequested] = useState(false)
  const [autoBatchPlanLoading, setAutoBatchPlanLoading] = useState(false)
  const [autoBatchPlanError, setAutoBatchPlanError] = useState("")
  const [autoBatchAssigneeIds, setAutoBatchAssigneeIds] = useState<
    Map<number, string>
  >(() => new Map())
  const [autoBatchConfirmations, setAutoBatchConfirmations] = useState<
    Map<number, CreateMetadataBatchResponse>
  >(() => new Map())
  const [confirmingAutoBatchIndexes, setConfirmingAutoBatchIndexes] = useState<
    Set<number>
  >(() => new Set())
  const [confirmingAllAutoBatches, setConfirmingAllAutoBatches] =
    useState(false)
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
  const canRestartMetadata = canUserRestartMetadata(currentUserIdentity)
  const hasServerPagination = Boolean(metadataPagination)

  const metadataKey = useMemo(
    () =>
      metadataItems
        .map(
          (item) =>
            `${item.id}:${item.ocr_batch_id ?? ""}:${item.import_action ?? ""}:${item.status}:${item.remote_metadata_status ?? ""}:${item.signature_status ?? ""}:${item.review_status}:${String(item.is_reviewed ?? false)}:${String(item.metadata_ready)}:${String(item.metadata_final)}:${String(item.metadata_user_edited ?? false)}:${item.metadata_batch_id ?? ""}:${item.metadata_batch_name ?? ""}:${item.metadata_batch_assigned_to_user_id ?? ""}:${item.metadata_batch_assigned_to_email ?? ""}:${item.metadata_batch_assigned_to_name ?? ""}:${item.metadata_verified_by_user_id ?? ""}:${item.metadata_verified_by_email ?? ""}:${item.metadata_verified_by_name ?? ""}`
        )
        .join("\n"),
    [metadataItems]
  )

  useEffect(() => {
    const sessionChanged = metadataSessionIdRef.current !== sessionId
    if (sessionChanged) {
      metadataSessionIdRef.current = sessionId
      setManualSelectedIds(new Set())
      setManualSelectedOnly(false)
      setManualSelectedItemSnapshots(new Map())
      setSelectedManualWorkerIds(new Set())
      setManualQuickCounts(new Map())
      setManualQuickConfirmations(new Map())
      setConfirmingManualQuickWorkerIds(new Set())
      setConfirmingAllManualQuickBatches(false)
      setBulkSelectedIds(new Set())
      setBulkSelectedItemSnapshots(new Map())
    }
    setItems((previous) =>
      mergeIncomingMetadata(
        sessionChanged || !isCoordinator ? [] : previous,
        metadataItems,
        { keepMissing: !hasServerPagination }
      )
    )
  }, [
    hasServerPagination,
    isCoordinator,
    metadataItems,
    metadataKey,
    sessionId,
  ])

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
    () => items.filter((item) => item.metadata_ready && item.is_reviewed === true),
    [items]
  )
  const pendingReadyItems = useMemo(
    () => readyItems.filter((item) => item.is_reviewed !== true),
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
  const scopedMetadataBatchSummaries = useMemo(
    () =>
      isCoordinator
        ? metadataBatchSummaries
        : metadataBatchSummaries.filter((summary) => {
            if (summary.kind !== "manual") return false
            const assigneeId = String(summary.assignee_user_id ?? "").trim()
            const assigneeEmail = String(summary.assignee_email ?? "")
              .trim()
              .toLowerCase()
            const assigneeName = String(summary.assignee_name ?? "").trim()
            if (
              currentUserIdentity.id &&
              assigneeId === currentUserIdentity.id
            ) {
              return true
            }
            if (
              currentUserIdentity.email &&
              assigneeEmail === currentUserIdentity.email.toLowerCase()
            ) {
              return true
            }
            return Boolean(
              currentUserIdentity.name &&
              assigneeName === currentUserIdentity.name
            )
          }),
    [currentUserIdentity, isCoordinator, metadataBatchSummaries]
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
        ? metadataBatchSummaries.length > 0
          ? buildManualMetadataBatchGroupsFromSummaries(
              scopedMetadataBatchSummaries,
              batchScopeItems
            )
          : buildManualMetadataBatchGroups(batchScopeItems)
        : metadataBatchSummaries.length > 0
          ? buildMetadataBatchGroupsFromSummaries(
              scopedMetadataBatchSummaries,
              batchScopeItems,
              batchSize,
              metadataDocumentScope
            )
          : buildMetadataBatchGroups(batchScopeItems, batchSize),
    [
      batchMode,
      batchSize,
      batchScopeItems,
      metadataDocumentScope,
      metadataBatchSummaries.length,
      scopedMetadataBatchSummaries,
    ]
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
  const loadedItemsById = useMemo(
    () => new Map(items.map((item) => [item.id, item] as const)),
    [items]
  )
  const loadedItemIdsKey = useMemo(
    () => items.map((item) => item.id).join("|"),
    [items]
  )
  const manualSelectedKnownItems = useMemo(
    () =>
      Array.from(manualSelectedIds)
        .map((id) => manualSelectedItemSnapshots.get(id))
        .filter((item): item is PdfMetadata => Boolean(item)),
    [manualSelectedIds, manualSelectedItemSnapshots]
  )
  const manualSelectedVisibleItems = useMemo(
    () =>
      filterMetadataItemsByFileName(
        manualSelectedKnownItems,
        normalizedMetadataFileFilter
      ),
    [manualSelectedKnownItems, normalizedMetadataFileFilter]
  )
  const manualSplitDisplayItems = manualSelectedOnly
    ? manualSelectedVisibleItems
    : unassignedBatchVisibleItems
  const manualSelectedDocumentIds = useMemo(() => {
    const remainingIds = new Set(manualSelectedIds)
    const orderedIds: number[] = []
    sortedItems.forEach((item) => {
      if (!remainingIds.has(item.id)) return
      orderedIds.push(item.id)
      remainingIds.delete(item.id)
    })
    remainingIds.forEach((id) => orderedIds.push(id))
    return orderedIds
  }, [manualSelectedIds, sortedItems])
  const unpagedDisplayedItems =
    reviewMode === "batch"
      ? manualSplitActive
        ? manualSplitDisplayItems
        : activeBatchVisibleItems
      : filteredListScopeItems
  const clientDisplayedPagination = usePagedItems(unpagedDisplayedItems, {
    defaultPageSize: DEFAULT_METADATA_PAGE_SIZE,
    pageSizeOptions: METADATA_PAGE_SIZE_OPTIONS,
    allowCustomPageSize: true,
    minPageSize: MIN_METADATA_PAGE_SIZE,
    maxPageSize: MAX_METADATA_PAGE_SIZE,
    resetKey: `${sessionId ?? ""}:${reviewMode}:${batchMode}:${manualSplitActive ? "split" : "normal"}:${manualSelectedOnly ? "selected" : "all"}:${activeBatch?.index ?? "list"}:${normalizedMetadataFileFilter}`,
    storageKey: "archival-processing.metadata-display-page-size",
  })
  const serverPagination = metadataPagination?.pagination ?? null
  const useServerPaginationForDisplay =
    Boolean(metadataPagination) && !(manualSplitActive && manualSelectedOnly)
  const setDisplayedPageSize = (pageSize: number) => {
    clientDisplayedPagination.setPageSize(pageSize)
    metadataPagination?.onPageSizeChange(pageSize)
  }
  const clientDisplayedPaginationForControls = {
    ...clientDisplayedPagination,
    minPageSize: MIN_METADATA_PAGE_SIZE,
    maxPageSize: MAX_METADATA_PAGE_SIZE,
    setPageSize: setDisplayedPageSize,
  }
  const displayedItems = useServerPaginationForDisplay
    ? unpagedDisplayedItems
    : clientDisplayedPagination.items
  const displayedPagination =
    useServerPaginationForDisplay && metadataPagination
      ? serverPaginationForControls(
          metadataPagination,
          serverPagination,
          displayedItems.length,
          setDisplayedPageSize
        )
      : clientDisplayedPaginationForControls
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
        (item) => isMetadataFailedItem(item) && canRestartMetadata
      ),
    [canRestartMetadata, displayedItems]
  )
  const displayedBulkSelectableItems = useMemo(() => {
    const byId = new Map<number, PdfMetadata>()
    displayedConfirmableItems.forEach((item) => byId.set(item.id, item))
    displayedRetryableItems.forEach((item) => byId.set(item.id, item))
    return displayedItems.filter((item) => byId.has(item.id))
  }, [displayedConfirmableItems, displayedItems, displayedRetryableItems])
  const bulkSelectedKnownItems = useMemo(
    () =>
      Array.from(bulkSelectedIds)
        .map((id) => bulkSelectedItemSnapshots.get(id))
        .filter((item): item is PdfMetadata => Boolean(item)),
    [bulkSelectedIds, bulkSelectedItemSnapshots]
  )
  const bulkSelectedItems = useMemo(
    () =>
      bulkSelectedKnownItems.filter(
        (item) =>
          (isMetadataConfirmable(item) || isMetadataFailedItem(item)) &&
          canUserEditMetadataItem(item, currentUserIdentity)
      ),
    [bulkSelectedKnownItems, currentUserIdentity]
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
      setManualSelectedOnly(false)
      setManualSelectedItemSnapshots(new Map())
      setSelectedAssigneeId("")
      setSelectedAutoWorkerIds(new Set())
      setSelectedManualWorkerIds(new Set())
      setManualQuickCounts(new Map())
      setManualQuickConfirmations(new Map())
      setConfirmingManualQuickWorkerIds(new Set())
      setConfirmingAllManualQuickBatches(false)
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
        setSelectedAutoWorkerIds((current) => {
          const validWorkerIds = new Set(
            nextWorkers.map((worker) => chinhlyUserId(worker)).filter(Boolean)
          )
          return new Set(
            Array.from(current).filter((workerId) =>
              validWorkerIds.has(workerId)
            )
          )
        })
        setSelectedManualWorkerIds((current) => {
          const validWorkerIds = new Set(
            nextWorkers.map((worker) => chinhlyUserId(worker)).filter(Boolean)
          )
          return new Set(
            Array.from(current).filter((workerId) =>
              validWorkerIds.has(workerId)
            )
          )
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

  const selectedAutoWorkerCount = selectedAutoWorkerIds.size

  useEffect(() => {
    if (
      !sessionId ||
      !canManageMetadataBatches ||
      reviewMode !== "batch" ||
      !autoBatchPlanRequested ||
      selectedAutoWorkerCount < 1
    ) {
      setAutoBatchPlan(null)
      setAutoBatchPlanLoading(false)
      setAutoBatchPlanError("")
      setAutoBatchAssigneeIds(new Map())
      setAutoBatchConfirmations(new Map())
      setConfirmingAutoBatchIndexes(new Set())
      setConfirmingAllAutoBatches(false)
      return
    }

    let cancelled = false
    setAutoBatchPlanLoading(true)
    setAutoBatchPlanError("")
    getAutoMetadataBatchPlan(sessionId, selectedAutoWorkerCount)
      .then((plan) => {
        if (cancelled) return
        setAutoBatchPlan(plan)
        setAutoBatchConfirmations(new Map())
        setConfirmingAutoBatchIndexes(new Set())
      })
      .catch((err) => {
        if (cancelled) return
        setAutoBatchPlan(null)
        setAutoBatchPlanError(
          err instanceof Error
            ? err.message
            : "Không thể tạo đề xuất phân công tự động."
        )
      })
      .finally(() => {
        if (!cancelled) setAutoBatchPlanLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [
    autoBatchPlanRequested,
    canManageMetadataBatches,
    reviewMode,
    selectedAutoWorkerCount,
    sessionId,
  ])

  const selectedAutoWorkerIdsKey = useMemo(
    () => Array.from(selectedAutoWorkerIds).join("|"),
    [selectedAutoWorkerIds]
  )
  const selectedManualWorkerIdsKey = useMemo(
    () => Array.from(selectedManualWorkerIds).join("|"),
    [selectedManualWorkerIds]
  )
  const workerIdsKey = useMemo(
    () => workers.map((worker) => chinhlyUserId(worker)).join("|"),
    [workers]
  )

  useEffect(() => {
    setManualQuickCounts((previous) => {
      const next = new Map<string, string>()
      selectedManualWorkerIds.forEach((workerId) => {
        if (previous.has(workerId)) next.set(workerId, previous.get(workerId) ?? "")
      })
      if (next.size !== previous.size) return next
      for (const [workerId, value] of next) {
        if (previous.get(workerId) !== value) return next
      }
      return previous
    })
    setManualQuickConfirmations((previous) => {
      const next = new Map<string, CreateMetadataBatchResponse>()
      selectedManualWorkerIds.forEach((workerId) => {
        const response = previous.get(workerId)
        if (response) next.set(workerId, response)
      })
      if (next.size !== previous.size) return next
      for (const [workerId, response] of next) {
        if (previous.get(workerId) !== response) return next
      }
      return previous
    })
    setConfirmingManualQuickWorkerIds((previous) => {
      const next = new Set<string>()
      previous.forEach((workerId) => {
        if (selectedManualWorkerIds.has(workerId)) next.add(workerId)
      })
      return next.size === previous.size ? previous : next
    })
  }, [selectedManualWorkerIds, selectedManualWorkerIdsKey])

  useEffect(() => {
    if (!autoBatchPlan) return
    const workerIds = workers
      .map((worker) => chinhlyUserId(worker))
      .filter((workerId) => workerId && selectedAutoWorkerIds.has(workerId))
    setAutoBatchAssigneeIds((previous) => {
      return new Map(
        autoBatchPlan.groups.map((group, index) => [
          group.index,
          autoBatchConfirmations.has(group.index)
            ? (previous.get(group.index) ?? "")
            : workerIds.length > 0
            ? workerIds[index % workerIds.length]
            : "",
        ])
      )
    })
  }, [
    autoBatchConfirmations,
    autoBatchPlan,
    selectedAutoWorkerIds,
    selectedAutoWorkerIdsKey,
    workerIdsKey,
    workers,
  ])

  useEffect(() => {
    const availableItems = manualSplitActive
      ? (unassignedBatch?.items ?? EMPTY_METADATA_ITEMS)
      : filteredListScopeItems
    const availableIds = new Set(availableItems.map((item) => item.id))
    const loadedIds = new Set(items.map((item) => item.id))
    setManualSelectedIds((previous) => {
      const next = new Set<number>()
      let changed = false
      previous.forEach((id) => {
        const keepUnloadedServerSelection =
          hasServerPagination && manualSplitActive && !loadedIds.has(id)
        if (availableIds.has(id) || keepUnloadedServerSelection) {
          next.add(id)
        } else {
          changed = true
        }
      })
      return changed ? next : previous
    })
  }, [
    filteredListScopeItems,
    hasServerPagination,
    items,
    loadedItemIdsKey,
    manualSplitActive,
    sortedItemIdsKey,
    unassignedBatch,
  ])

  useEffect(() => {
    setManualSelectedItemSnapshots((previous) => {
      const next = new Map<number, PdfMetadata>()
      manualSelectedIds.forEach((id) => {
        const item = loadedItemsById.get(id) ?? previous.get(id)
        if (item) next.set(id, item)
      })
      if (next.size !== previous.size) return next
      for (const [id, item] of next) {
        if (previous.get(id) !== item) return next
      }
      return previous
    })
  }, [loadedItemsById, manualSelectedIds])

  useEffect(() => {
    setBulkSelectedItemSnapshots((previous) => {
      const next = new Map<number, PdfMetadata>()
      bulkSelectedIds.forEach((id) => {
        const item = loadedItemsById.get(id) ?? previous.get(id)
        if (item) next.set(id, item)
      })
      if (next.size !== previous.size) return next
      for (const [id, item] of next) {
        if (previous.get(id) !== item) return next
      }
      return previous
    })
  }, [bulkSelectedIds, loadedItemsById])

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
    if (reviewMode !== "batch" || manualSplitActive) return
    let targetIndex = -1
    if (metadataDocumentScope.scope === "batch") {
      const targetBatchId = normalizedMetadataBatchId(
        metadataDocumentScope.batchId
      )
      if (targetBatchId) {
        targetIndex = batchGroups.findIndex(
          (group) =>
            group.kind === "manual" &&
            normalizedMetadataBatchId(group.batchId) === targetBatchId
        )
      }
    } else if (metadataDocumentScope.scope === "unassigned") {
      targetIndex = findUnassignedBatchIndex(batchGroups)
    } else if (metadataDocumentScope.scope === "reviewed") {
      targetIndex = batchGroups.findIndex((group) => group.kind === "reviewed")
    }
    if (targetIndex >= 0 && targetIndex !== activeBatchIndex) {
      setActiveBatchIndex(targetIndex)
    }
  }, [
    activeBatchIndex,
    batchGroups,
    manualSplitActive,
    metadataDocumentScope,
    reviewMode,
  ])

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
    manualSelectedOnly,
    setManualSelectedOnly,
    manualSelectedItemSnapshots,
    setManualSelectedItemSnapshots,
    bulkReviewSelectionActive,
    setBulkReviewSelectionActive,
    bulkSelectedIds,
    setBulkSelectedIds,
    bulkSelectedItemSnapshots,
    setBulkSelectedItemSnapshots,
    exportingMetadataReview,
    setExportingMetadataReview,
    workers,
    setWorkers,
    workersLoading,
    setWorkersLoading,
    selectedAssigneeId,
    setSelectedAssigneeId,
    selectedAutoWorkerIds,
    setSelectedAutoWorkerIds,
    selectedManualWorkerIds,
    setSelectedManualWorkerIds,
    manualQuickCounts,
    setManualQuickCounts,
    manualQuickConfirmations,
    setManualQuickConfirmations,
    confirmingManualQuickWorkerIds,
    setConfirmingManualQuickWorkerIds,
    confirmingAllManualQuickBatches,
    setConfirmingAllManualQuickBatches,
    autoBatchPlan,
    setAutoBatchPlan,
    autoBatchPlanRequested,
    setAutoBatchPlanRequested,
    autoBatchPlanLoading,
    setAutoBatchPlanLoading,
    autoBatchPlanError,
    setAutoBatchPlanError,
    autoBatchAssigneeIds,
    setAutoBatchAssigneeIds,
    autoBatchConfirmations,
    setAutoBatchConfirmations,
    confirmingAutoBatchIndexes,
    setConfirmingAutoBatchIndexes,
    confirmingAllAutoBatches,
    setConfirmingAllAutoBatches,
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
    metadataBatchSummaries: scopedMetadataBatchSummaries,
    metadataDocumentScope,
    canManageMetadataBatches,
    canExportMetadataReview,
    canRestartMetadata,
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
    unassignedBatchVisibleItems,
    manualSelectedKnownItems,
    manualSelectedVisibleItems,
    manualSplitDisplayItems,
    manualSelectedDocumentIds,
    unpagedDisplayedItems,
    displayedPagination,
    displayedItems,
    displayedItemIdsKey,
    displayedConfirmableItems,
    displayedRetryableItems,
    displayedBulkSelectableItems,
    bulkSelectedItems,
    bulkSelectedKnownItems,
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
  visibleItemCount: number,
  onPageSizeChange: (pageSize: number) => void
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
    pageSizeOptions: METADATA_PAGE_SIZE_OPTIONS,
    minPageSize: MIN_METADATA_PAGE_SIZE,
    maxPageSize: MAX_METADATA_PAGE_SIZE,
    setPageIndex: controls.onPageChange,
    setPageSize: onPageSizeChange,
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
