import type { PointerEvent as ReactPointerEvent } from "react"
import { toast } from "sonner"
import {
  bulkVerifyDocumentMetadata,
  closeMetadataBatch,
  createMetadataBatch,
  downloadSessionMetadataReviewXlsx,
  getDigitizationStatus,
  verifyDocumentMetadata,
  type SessionDocumentResponse,
} from "@/features/upload/api/sessionApi"
import type { PdfMetadata } from "@/features/upload/types"
import type {
  MetadataBatchGroup,
  MetadataBatchMode,
  MetadataDocumentScope,
  MetadataReviewMode,
} from "./ProcessStep.types"
import {
  isMetadataFailedItem,
  isMetadataConfirmable,
  metadataSortScore,
  replaceMetadataItem,
  replaceDocument,
  replaceDocuments,
  replaceVerifiedDocument,
  replaceVerifiedDocuments,
  resetMetadataItemForReextract,
  resetMetadataItemsForReextract,
} from "./ProcessStep.metadataUtils"
import {
  addId,
  addTextId,
  buildManualMetadataBatchGroups,
  buildManualMetadataBatchGroupsFromSummaries,
  buildMetadataBatchGroups,
  buildMetadataBatchGroupsFromSummaries,
  canUserEditMetadataItem,
  chinhlyUserId,
  findUnassignedBatchIndex,
  firstPreferredMetadataItem,
  metadataDocumentScopeForGroup,
  normalizeBatchSize,
  normalizedMetadataBatchId,
  removeId,
  removeTextId,
  saveBlob,
  selectedRange,
} from "./ProcessStep.batchUtils"
import { EMPTY_METADATA_ITEMS } from "./ProcessStep.types"
import type { useProcessStepModel } from "./useProcessStepModel"
import { resizeProcessPreviewFromPointer } from "./ProcessStep.resize"

type ProcessStepActionContext = ReturnType<typeof useProcessStepModel> & {
  sessionId: string | null
  onDocumentsVerified?: (documents: SessionDocumentResponse[]) => void
  onRetryMetadata?: (documentId: number) => Promise<SessionDocumentResponse>
  onMetadataDocumentScopeChange?: (scope: MetadataDocumentScope) => void
  onMetadataDocumentsChanged?: () => void
}

const BULK_ACTION_BATCH_SIZE = readPositiveEnvInt(
  "VITE_ARCHIVAL_BULK_ACTION_BATCH_SIZE",
  32,
  100
)
const BULK_ACTION_CONCURRENCY = readPositiveEnvInt(
  "VITE_ARCHIVAL_BULK_ACTION_CONCURRENCY",
  4,
  32
)
const MAX_MANUAL_METADATA_BATCH_DOCUMENTS = 1000

export function createProcessStepActions(context: ProcessStepActionContext) {
  const {
    sessionId,
    items,
    setItems,
    setVerifyingIds,
    bulkVerifyItems,
    bulkRetryItems,
    onDocumentsVerified,
    onMetadataDocumentScopeChange,
    onMetadataDocumentsChanged,
    setBulkVerifying,
    setReviewMode,
    setManualSplitActive,
    setManualSelectedIds,
    setManualSelectedOnly,
    setManualSelectedItemSnapshots,
    setSelectedDocumentId,
    activeBatch,
    batchScopeItems,
    metadataBatchSummaries,
    metadataDocumentScope,
    setBatchSize,
    setActiveBatchIndex,
    setBatchSizeInput,
    batchSizeInput,
    batchSize,
    setBatchMode,
    sortedItems,
    displayedItems,
    manualSelectedKnownItems,
    manualSelectedDocumentIds,
    manualLastSelectedIdRef,
    setSelectedAssigneeId,
    setBulkReviewSelectionActive,
    setBulkSelectedIds,
    setBulkSelectedItemSnapshots,
    bulkLastSelectedIdRef,
    bulkReviewSelectionActive,
    displayedBulkSelectableItems,
    setCreatingManualBatch,
    manualSelectedIds,
    selectedAssigneeId,
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
    workers,
    setClosingBatchIds,
    canManageMetadataBatches,
    setRetryingIds,
    onRetryMetadata,
    canExportMetadataReview,
    canRestartMetadata,
    setExportingMetadataReview,
    previewLayoutRef,
    setPreviewWidthPercent,
    currentUserIdentity,
    autoBatchPlan,
    setAutoBatchPlanRequested,
    autoBatchAssigneeIds,
    autoBatchConfirmations,
    setAutoBatchConfirmations,
    confirmingAutoBatchIndexes,
    setConfirmingAutoBatchIndexes,
    confirmingAllAutoBatches,
    setConfirmingAllAutoBatches,
  } = context
  const autoAssignmentInProgress =
    confirmingAllAutoBatches || confirmingAutoBatchIndexes.size > 0
  const manualQuickAssignmentInProgress =
    confirmingAllManualQuickBatches || confirmingManualQuickWorkerIds.size > 0
  const assignmentInProgress =
    autoAssignmentInProgress || manualQuickAssignmentInProgress

  const handleApply = async (
    dataPath: string,
    meta?: Record<string, unknown>
  ) => {
    const item =
      items.find((candidate) => candidate.data_path === dataPath) ??
      manualSelectedKnownItems.find(
        (candidate) => candidate.data_path === dataPath
      )
    if (!item) throw new Error("Không tìm thấy tài liệu trong session.")
    if (!sessionId) throw new Error("Chưa có session để xác nhận metadata.")
    const manualFillAllowed =
      Boolean(meta && Object.keys(meta).length > 0) &&
      isMetadataFailedItem(item)
    if (!item.metadata_ready && !manualFillAllowed) {
      throw new Error("Metadata của tài liệu này chưa sẵn sàng để xác nhận.")
    }
    if (!canUserEditMetadataItem(item, currentUserIdentity)) {
      throw new Error(
        "Bạn chỉ có thể sửa/xác nhận tài liệu trong lô được giao."
      )
    }

    setVerifyingIds((previous) => addId(previous, item.id))
    try {
      const verified = await verifyDocumentMetadata(sessionId, item.id, meta)
      const nextItems = replaceVerifiedDocument(items, verified)
      const nextDisplayedItems = replaceVerifiedDocument(
        displayedItems,
        verified
      )
      const nextSelectedItem = firstPreferredMetadataItem(
        [...nextDisplayedItems].sort(
          (a, b) => metadataSortScore(a) - metadataSortScore(b)
        )
      )
      setItems(nextItems)
      setSelectedDocumentId(nextSelectedItem?.id ?? null)
      onDocumentsVerified?.([verified])
      onMetadataDocumentsChanged?.()
    } finally {
      setVerifyingIds((previous) => removeId(previous, item.id))
    }
  }

  const handleVerifyAllReady = async () => {
    if (!sessionId) {
      toast.error("Chưa có session để xác nhận metadata.")
      return
    }
    if (bulkVerifyItems.length === 0) return

    setBulkVerifying(true)
    setVerifyingIds((previous) => {
      const next = new Set(previous)
      bulkVerifyItems.forEach((item) => next.add(item.id))
      return next
    })
    try {
      const requestGroups = chunkItems(bulkVerifyItems, BULK_ACTION_BATCH_SIZE)
      const results = await runSettledWithConcurrency(
        requestGroups,
        (group) =>
          bulkVerifyDocumentMetadata(
            sessionId,
            group.map((item) => item.id)
          ),
        BULK_ACTION_CONCURRENCY
      )
      const verified = results
        .filter(
          (
            result
          ): result is PromiseFulfilledResult<
            Awaited<ReturnType<typeof bulkVerifyDocumentMetadata>>
          > => result.status === "fulfilled"
        )
        .flatMap((result) => result.value.documents)
      if (verified.length > 0) {
        const nextItems = replaceVerifiedDocuments(items, verified)
        setItems(nextItems)
        onDocumentsVerified?.(verified)
        onMetadataDocumentsChanged?.()
        const verifiedIds = new Set(verified.map((document) => document.id))
        setBulkSelectedIds((previous) => {
          const next = new Set(previous)
          verifiedIds.forEach((id) => next.delete(id))
          return next
        })
        setBulkSelectedItemSnapshots((previous) => {
          const next = new Map(previous)
          verifiedIds.forEach((id) => next.delete(id))
          return next
        })
      }

      const failedCount = results.reduce((count, result, index) => {
        if (result.status === "fulfilled") {
          return count + result.value.failed_count
        }
        return count + (requestGroups[index]?.length ?? 0)
      }, 0)
      const failedDetails = results.flatMap((result) => {
        if (result.status === "fulfilled") {
          return (result.value.errors ?? [])
            .map((error) => String(error.detail ?? "").trim())
            .filter(Boolean)
        }
        const reason =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason ?? "").trim()
        return reason ? [reason] : []
      })
      if (failedCount > 0) {
        toast.error(
          failedDetails[0]
            ? `${failedCount} tài liệu chưa xác nhận được. ${failedDetails[0]}`
            : `${failedCount} tài liệu chưa xác nhận được. Vui lòng kiểm tra lại.`
        )
      }
      if (verified.length > 0) {
        toast.success(`Đã xác nhận ${verified.length} tài liệu.`)
      }
    } finally {
      setBulkVerifying(false)
      setVerifyingIds((previous) => {
        const next = new Set(previous)
        bulkVerifyItems.forEach((item) => next.delete(item.id))
        return next
      })
    }
  }

  const resetBulkReviewSelection = () => {
    setBulkReviewSelectionActive(false)
    setBulkSelectedIds(new Set())
    setBulkSelectedItemSnapshots(new Map())
    bulkLastSelectedIdRef.current = null
  }

  const resetManualQuickAssignment = () => {
    setSelectedManualWorkerIds(new Set())
    setManualQuickCounts(new Map())
    setManualQuickConfirmations(new Map())
    setConfirmingManualQuickWorkerIds(new Set())
    setConfirmingAllManualQuickBatches(false)
  }

  const handleReviewModeChange = (mode: MetadataReviewMode) => {
    if (assignmentInProgress) {
      toast.info("Đợi hoàn tất xác nhận phân công hiện tại.")
      return
    }
    setReviewMode(mode)
    setManualSplitActive(false)
    setManualSelectedIds(new Set())
    setManualSelectedOnly(false)
    setManualSelectedItemSnapshots(new Map())
    resetManualQuickAssignment()
    resetBulkReviewSelection()
    if (mode === "batch") {
      if (activeBatch) {
        onMetadataDocumentScopeChange?.(
          metadataDocumentScopeForGroup(activeBatch)
        )
      }
      setSelectedDocumentId(
        firstPreferredMetadataItem(activeBatch?.items ?? EMPTY_METADATA_ITEMS)
          ?.id ?? null
      )
    } else {
      onMetadataDocumentScopeChange?.({ scope: "all" })
    }
  }

  const handleBatchSizeChange = (value: number) => {
    if (assignmentInProgress) return
    setBatchSize(normalizeBatchSize(value))
  }

  const handleBatchSizeInputChange = (value: string) => {
    setBatchSizeInput(value)
    const trimmed = value.trim()
    if (!/^\d+$/.test(trimmed)) return
    handleBatchSizeChange(Number(trimmed))
  }

  const handleBatchSizeInputBlur = () => {
    const trimmed = batchSizeInput.trim()
    if (!/^\d+$/.test(trimmed)) {
      setBatchSizeInput(String(batchSize))
      return
    }
    const nextBatchSize = normalizeBatchSize(Number(trimmed))
    handleBatchSizeChange(nextBatchSize)
    setBatchSizeInput(String(nextBatchSize))
  }

  const handleSelectBatch = (group: MetadataBatchGroup) => {
    setActiveBatchIndex(group.index)
    setManualSplitActive(false)
    setManualSelectedIds(new Set())
    setManualSelectedOnly(false)
    setManualSelectedItemSnapshots(new Map())
    setSelectedAssigneeId("")
    resetManualQuickAssignment()
    resetBulkReviewSelection()
    onMetadataDocumentScopeChange?.(metadataDocumentScopeForGroup(group))
    setSelectedDocumentId(firstPreferredMetadataItem(group.items)?.id ?? null)
  }

  const handleBatchModeChange = (mode: MetadataBatchMode) => {
    if (assignmentInProgress) {
      toast.info("Đợi hoàn tất xác nhận phân công hiện tại.")
      return
    }
    setBatchMode(mode)
    setAutoBatchPlanRequested(false)
    setManualSplitActive(false)
    setManualSelectedIds(new Set())
    setManualSelectedOnly(false)
    setManualSelectedItemSnapshots(new Map())
    setSelectedAssigneeId("")
    resetManualQuickAssignment()
    resetBulkReviewSelection()
    setActiveBatchIndex(0)
    const nextGroups =
      mode === "manual"
        ? metadataBatchSummaries.length > 0
          ? buildManualMetadataBatchGroupsFromSummaries(
              metadataBatchSummaries,
              batchScopeItems
            )
          : buildManualMetadataBatchGroups(batchScopeItems)
        : metadataBatchSummaries.length > 0
          ? buildMetadataBatchGroupsFromSummaries(
              metadataBatchSummaries,
              batchScopeItems,
              batchSize,
              metadataDocumentScope
            )
          : buildMetadataBatchGroups(batchScopeItems, batchSize)
    const targetGroup = nextGroups[0] ?? null
    onMetadataDocumentScopeChange?.(
      targetGroup
        ? metadataDocumentScopeForGroup(targetGroup)
        : { scope: "all" }
    )
    setSelectedDocumentId(
      firstPreferredMetadataItem(targetGroup?.items ?? batchScopeItems)?.id ??
        null
    )
  }

  const startManualSplit = () => {
    if (!canManageMetadataBatches) return
    setReviewMode("batch")
    setBatchMode("manual")
    setAutoBatchPlanRequested(false)
    setManualSplitActive(true)
    setManualSelectedIds(new Set())
    setManualSelectedOnly(false)
    setManualSelectedItemSnapshots(new Map())
    resetManualQuickAssignment()
    resetBulkReviewSelection()
    const nextGroups =
      metadataBatchSummaries.length > 0
        ? buildManualMetadataBatchGroupsFromSummaries(
            metadataBatchSummaries,
            sortedItems
          )
        : buildManualMetadataBatchGroups(sortedItems)
    const unassignedIndex = findUnassignedBatchIndex(nextGroups)
    const targetGroup = nextGroups[unassignedIndex] ?? nextGroups[0] ?? null
    setActiveBatchIndex(unassignedIndex >= 0 ? unassignedIndex : 0)
    setSelectedDocumentId(
      firstPreferredMetadataItem(targetGroup?.items ?? [])?.id ?? null
    )
    onMetadataDocumentScopeChange?.({ scope: "unassigned" })
    manualLastSelectedIdRef.current = null
  }

  const cancelManualSplit = () => {
    setManualSplitActive(false)
    setManualSelectedIds(new Set())
    setManualSelectedOnly(false)
    setManualSelectedItemSnapshots(new Map())
    setSelectedAssigneeId("")
    resetManualQuickAssignment()
    manualLastSelectedIdRef.current = null
  }

  const toggleManualSelection = (
    item: PdfMetadata,
    checked: boolean,
    shiftKey: boolean
  ) => {
    setManualSelectedIds((previous) => {
      const next = new Set(previous)
      const lastSelectedId = manualLastSelectedIdRef.current
      if (shiftKey && lastSelectedId !== null) {
        selectedRange(displayedItems, lastSelectedId, item.id).forEach(
          (rangeItem) => {
            if (checked) next.add(rangeItem.id)
            else next.delete(rangeItem.id)
          }
        )
      } else if (checked) {
        next.add(item.id)
      } else {
        next.delete(item.id)
      }
      return next
    })
    manualLastSelectedIdRef.current = item.id
  }

  const selectAllDisplayedForManualSplit = () => {
    setManualSelectedIds((previous) => {
      const next = new Set(previous)
      displayedItems.forEach((item) => next.add(item.id))
      return next
    })
    manualLastSelectedIdRef.current =
      displayedItems[displayedItems.length - 1]?.id ?? null
  }

  const clearManualSelection = () => {
    setManualSelectedIds(new Set())
    setManualSelectedOnly(false)
    setManualSelectedItemSnapshots(new Map())
    manualLastSelectedIdRef.current = null
  }

  const toggleManualSelectedOnly = () => {
    setManualSelectedOnly((previous) => !previous)
  }

  const toggleBulkReviewSelectionMode = () => {
    if (bulkReviewSelectionActive) {
      resetBulkReviewSelection()
      return
    }
    setBulkReviewSelectionActive(true)
    setBulkSelectedIds(new Set())
    setBulkSelectedItemSnapshots(new Map())
    bulkLastSelectedIdRef.current = null
  }

  const toggleBulkReviewSelection = (
    item: PdfMetadata,
    checked: boolean,
    shiftKey: boolean
  ) => {
    if (!isMetadataConfirmable(item) && !isMetadataFailedItem(item)) return
    if (!canUserEditMetadataItem(item, currentUserIdentity)) return
    setBulkSelectedIds((previous) => {
      const next = new Set(previous)
      const lastSelectedId = bulkLastSelectedIdRef.current
      if (shiftKey && lastSelectedId !== null) {
        selectedRange(
          displayedBulkSelectableItems,
          lastSelectedId,
          item.id
        ).forEach((rangeItem) => {
          if (checked) next.add(rangeItem.id)
          else next.delete(rangeItem.id)
        })
      } else if (checked) {
        next.add(item.id)
      } else {
        next.delete(item.id)
      }
      return next
    })
    bulkLastSelectedIdRef.current = item.id
  }

  const selectAllDisplayedForBulkReview = () => {
    setBulkSelectedIds((previous) => {
      const next = new Set(previous)
      displayedBulkSelectableItems.forEach((item) => next.add(item.id))
      return next
    })
    bulkLastSelectedIdRef.current =
      displayedBulkSelectableItems[displayedBulkSelectableItems.length - 1]
        ?.id ?? null
  }

  const clearBulkReviewSelection = () => {
    setBulkSelectedIds(new Set())
    setBulkSelectedItemSnapshots(new Map())
    bulkLastSelectedIdRef.current = null
  }

  const confirmAutoBatch = async (groupIndex: number) => {
    if (!sessionId || !autoBatchPlan) return
    const group = autoBatchPlan.groups.find(
      (candidate) => candidate.index === groupIndex
    )
    if (!group || autoBatchConfirmations.has(groupIndex)) return
    const assignedToUserId = autoBatchAssigneeIds.get(groupIndex) ?? ""
    if (!assignedToUserId) {
      toast.error("Chọn người phụ trách trước khi xác nhận lô.")
      return
    }
    const completesPlan = autoBatchPlan.groups.every(
      (candidate) =>
        candidate.index === groupIndex ||
        autoBatchConfirmations.has(candidate.index)
    )

    setConfirmingAutoBatchIndexes((previous) => addId(previous, groupIndex))
    try {
      const response = await createMetadataBatch(
        sessionId,
        group.document_ids,
        assignedToUserId
      )
      const refreshedDocuments = [
        ...(response.documents ?? []),
        ...(response.skipped_documents ?? []),
      ]
      if (refreshedDocuments.length > 0) {
        setItems((previous) => replaceDocuments(previous, refreshedDocuments))
      }
      if (response.documents.length > 0) {
        onDocumentsVerified?.(response.documents)
      }
      const responseBatchId = normalizedMetadataBatchId(
        response.metadata_batch_id ?? response.batch_id
      )
      if (completesPlan && responseBatchId && response.documents.length > 0) {
        onMetadataDocumentScopeChange?.({
          scope: "batch",
          batchId: responseBatchId,
        })
        setManualSplitActive(false)
        setSelectedDocumentId(response.documents[0]?.id ?? null)
      }
      setAutoBatchConfirmations((previous) => {
        const next = new Map(previous)
        next.set(groupIndex, response)
        return next
      })
      onMetadataDocumentsChanged?.()
      const skippedCount =
        response.skipped_count ?? response.skipped_documents?.length ?? 0
      if (skippedCount > 0) {
        toast.warning(
          `Đã xác nhận lô với ${response.updated_count} tài liệu; bỏ qua ${skippedCount} tài liệu đã được phân công hoặc xác nhận trước đó.`
        )
      } else {
        toast.success(
          `Đã xác nhận phân công ${response.updated_count} tài liệu.`
        )
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Không thể xác nhận phân công lô."
      )
    } finally {
      setConfirmingAutoBatchIndexes((previous) =>
        removeId(previous, groupIndex)
      )
    }
  }

  const confirmAllAutoBatches = async () => {
    if (!sessionId || !autoBatchPlan) return
    const pendingGroups = autoBatchPlan.groups.filter(
      (group) => !autoBatchConfirmations.has(group.index)
    )
    if (pendingGroups.length === 0) {
      toast.info("Tất cả các lô trong đề xuất đã được xác nhận.")
      return
    }
    const missingAssignment = pendingGroups.some(
      (group) => !(autoBatchAssigneeIds.get(group.index) ?? "")
    )
    if (missingAssignment) {
      toast.error("Chọn người phụ trách cho tất cả các lô trước khi xác nhận.")
      return
    }

    setConfirmingAllAutoBatches(true)
    setConfirmingAutoBatchIndexes(
      new Set(pendingGroups.map((group) => group.index))
    )
    const refreshedDocuments: SessionDocumentResponse[] = []
    const assignedDocuments: SessionDocumentResponse[] = []
    let selectedBatchId: string | null = null
    let selectedBatchDocumentId: number | null = null
    let updatedCount = 0
    let skippedCount = 0
    let failedCount = 0
    try {
      for (const group of pendingGroups) {
        try {
          const response = await createMetadataBatch(
            sessionId,
            group.document_ids,
            autoBatchAssigneeIds.get(group.index) ?? ""
          )
          refreshedDocuments.push(
            ...(response.documents ?? []),
            ...(response.skipped_documents ?? [])
          )
          assignedDocuments.push(...(response.documents ?? []))
          const responseBatchId = normalizedMetadataBatchId(
            response.metadata_batch_id ?? response.batch_id
          )
          if (
            !selectedBatchId &&
            responseBatchId &&
            response.documents.length > 0
          ) {
            selectedBatchId = responseBatchId
            selectedBatchDocumentId = response.documents[0]?.id ?? null
          }
          updatedCount += response.updated_count
          skippedCount +=
            response.skipped_count ?? response.skipped_documents?.length ?? 0
          setAutoBatchConfirmations((previous) => {
            const next = new Map(previous)
            next.set(group.index, response)
            return next
          })
        } catch {
          failedCount += 1
        } finally {
          setConfirmingAutoBatchIndexes((previous) =>
            removeId(previous, group.index)
          )
        }
      }

      if (refreshedDocuments.length > 0) {
        setItems((previous) => replaceDocuments(previous, refreshedDocuments))
      }
      if (assignedDocuments.length > 0) {
        onDocumentsVerified?.(assignedDocuments)
      }
      if (selectedBatchId) {
        onMetadataDocumentScopeChange?.({
          scope: "batch",
          batchId: selectedBatchId,
        })
        setManualSplitActive(false)
        setSelectedDocumentId(selectedBatchDocumentId)
      }
      onMetadataDocumentsChanged?.()
      if (failedCount > 0 || skippedCount > 0) {
        toast.warning(
          `Đã phân công ${updatedCount} tài liệu; bỏ qua ${skippedCount} tài liệu; ${failedCount} lô chưa xác nhận được.`
        )
      } else {
        toast.success(
          `Đã xác nhận tất cả ${pendingGroups.length} lô với ${updatedCount} tài liệu.`
        )
      }
    } finally {
      setConfirmingAllAutoBatches(false)
      setConfirmingAutoBatchIndexes(new Set())
    }
  }

  const orderedManualQuickWorkerIds = () =>
    workers
      .map((worker) => chinhlyUserId(worker))
      .filter((workerId) => workerId && selectedManualWorkerIds.has(workerId))

  const manualQuickDocumentCount = (workerId: string) => {
    const value = String(manualQuickCounts.get(workerId) ?? "").trim()
    if (!/^\d+$/.test(value)) return 0
    return Math.floor(Number(value))
  }

  const nextUnassignedDocuments = async (
    count: number
  ): Promise<{ documentIds: number[]; availableCount: number }> => {
    if (!sessionId) return { documentIds: [], availableCount: 0 }
    const response = await getDigitizationStatus(sessionId, {
      includeDocuments: true,
      limit: count,
      offset: 0,
      metadataDocumentScope: { scope: "unassigned" },
    })
    const documentIds = (response?.documents ?? [])
      .map((document) => document.id)
      .filter((documentId) => Number.isFinite(documentId))
      .slice(0, count)
    const availableCount = Math.max(
      0,
      Math.floor(Number(response?.pagination?.total ?? documentIds.length) || 0)
    )
    return { documentIds, availableCount }
  }

  const unassignedDocumentCount = async (): Promise<number> => {
    if (!sessionId) return 0
    const response = await getDigitizationStatus(sessionId, {
      includeDocuments: false,
      summaryOnly: true,
      limit: 1,
      offset: 0,
      metadataDocumentScope: { scope: "unassigned" },
    })
    return Math.max(
      0,
      Math.floor(Number(response?.pagination?.total ?? 0) || 0)
    )
  }

  const warnNotEnoughUnassignedDocuments = (
    requestedCount: number,
    availableCount: number
  ) => {
    toast.warning(
      `Chỉ còn ${availableCount} tài liệu chưa chia, không đủ để giao ${requestedCount} tài liệu. Điều chỉnh số lượng rồi xác nhận lại.`
    )
  }

  const applyMetadataBatchResponse = (response: {
    documents?: SessionDocumentResponse[]
    skipped_documents?: SessionDocumentResponse[]
  }) => {
    const updatedDocuments = response.documents ?? []
    const skippedDocuments = response.skipped_documents ?? []
    const refreshedDocuments = [...updatedDocuments, ...skippedDocuments]
    if (refreshedDocuments.length > 0) {
      setItems((previous) => replaceDocuments(previous, refreshedDocuments))
    }
    if (updatedDocuments.length > 0) {
      onDocumentsVerified?.(updatedDocuments)
    }
    onMetadataDocumentsChanged?.()
  }

  const confirmManualQuickBatch = async (workerId: string) => {
    if (!sessionId) {
      toast.error("Chưa có session để tạo lô metadata.")
      return
    }
    if (manualQuickConfirmations.has(workerId)) return
    if (!selectedManualWorkerIds.has(workerId)) return

    const requestedCount = manualQuickDocumentCount(workerId)
    if (requestedCount < 1) {
      toast.error("Nhập số tài liệu cần giao cho worker.")
      return
    }
    if (requestedCount > MAX_MANUAL_METADATA_BATCH_DOCUMENTS) {
      toast.error(
        `Mỗi lô metadata tối đa ${MAX_MANUAL_METADATA_BATCH_DOCUMENTS} tài liệu.`
      )
      return
    }

    setCreatingManualBatch(true)
    setConfirmingManualQuickWorkerIds((previous) =>
      addTextId(previous, workerId)
    )
    try {
      const { documentIds, availableCount } =
        await nextUnassignedDocuments(requestedCount)
      if (documentIds.length === 0) {
        toast.warning("Không còn tài liệu chưa chia.")
        return
      }
      if (
        availableCount < requestedCount ||
        documentIds.length < requestedCount
      ) {
        warnNotEnoughUnassignedDocuments(
          requestedCount,
          Math.max(availableCount, documentIds.length)
        )
        return
      }
      const response = await createMetadataBatch(
        sessionId,
        documentIds,
        workerId
      )
      applyMetadataBatchResponse(response)
      setManualQuickConfirmations((previous) => {
        const next = new Map(previous)
        next.set(workerId, response)
        return next
      })
      onMetadataDocumentScopeChange?.({ scope: "unassigned" })
      setSelectedDocumentId(null)
      const skippedCount =
        response.skipped_count ?? response.skipped_documents?.length ?? 0
      const shortageCount = Math.max(0, requestedCount - documentIds.length)
      if (response.updated_count > 0) {
        toast.success(`Đã phân công ${response.updated_count} tài liệu.`)
      }
      if (skippedCount > 0 || shortageCount > 0) {
        toast.warning(
          `Bỏ qua ${skippedCount} tài liệu; thiếu ${shortageCount} tài liệu so với số lượng đã nhập.`
        )
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Không thể xác nhận phân công nhanh."
      )
    } finally {
      setCreatingManualBatch(false)
      setConfirmingManualQuickWorkerIds((previous) =>
        removeTextId(previous, workerId)
      )
    }
  }

  const confirmAllManualQuickBatches = async () => {
    if (!sessionId) {
      toast.error("Chưa có session để tạo lô metadata.")
      return
    }
    const pendingWorkerIds = orderedManualQuickWorkerIds().filter(
      (workerId) => !manualQuickConfirmations.has(workerId)
    )
    if (pendingWorkerIds.length === 0) {
      toast.info("Tất cả phân công nhanh đã được xác nhận.")
      return
    }
    const invalidWorkerId = pendingWorkerIds.find((workerId) => {
      const count = manualQuickDocumentCount(workerId)
      return count < 1 || count > MAX_MANUAL_METADATA_BATCH_DOCUMENTS
    })
    if (invalidWorkerId) {
      toast.error(
        `Nhập số tài liệu từ 1 đến ${MAX_MANUAL_METADATA_BATCH_DOCUMENTS} cho tất cả worker.`
      )
      return
    }
    const totalRequestedCount = pendingWorkerIds.reduce(
      (total, workerId) => total + manualQuickDocumentCount(workerId),
      0
    )
    let availableCount = 0
    try {
      availableCount = await unassignedDocumentCount()
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Không thể kiểm tra số tài liệu chưa chia."
      )
      return
    }
    if (availableCount < totalRequestedCount) {
      warnNotEnoughUnassignedDocuments(totalRequestedCount, availableCount)
      return
    }

    setCreatingManualBatch(true)
    setConfirmingAllManualQuickBatches(true)
    setConfirmingManualQuickWorkerIds(new Set(pendingWorkerIds))
    let updatedCount = 0
    let skippedCount = 0
    let shortageCount = 0
    let failedCount = 0
    try {
      for (const workerId of pendingWorkerIds) {
        const requestedCount = manualQuickDocumentCount(workerId)
        try {
          const { documentIds, availableCount } =
            await nextUnassignedDocuments(requestedCount)
          if (documentIds.length === 0) {
            shortageCount += requestedCount
            break
          }
          if (
            availableCount < requestedCount ||
            documentIds.length < requestedCount
          ) {
            shortageCount += Math.max(
              0,
              requestedCount - Math.max(availableCount, documentIds.length)
            )
            break
          }
          const response = await createMetadataBatch(
            sessionId,
            documentIds,
            workerId
          )
          applyMetadataBatchResponse(response)
          setManualQuickConfirmations((previous) => {
            const next = new Map(previous)
            next.set(workerId, response)
            return next
          })
          updatedCount += response.updated_count
          skippedCount +=
            response.skipped_count ?? response.skipped_documents?.length ?? 0
          shortageCount += Math.max(0, requestedCount - documentIds.length)
        } catch {
          failedCount += 1
        } finally {
          setConfirmingManualQuickWorkerIds((previous) =>
            removeTextId(previous, workerId)
          )
        }
      }
      onMetadataDocumentScopeChange?.({ scope: "unassigned" })
      setSelectedDocumentId(null)
      if (failedCount > 0 || skippedCount > 0 || shortageCount > 0) {
        toast.warning(
          `Đã phân công ${updatedCount} tài liệu; bỏ qua ${skippedCount}; thiếu ${shortageCount}; ${failedCount} lô chưa xác nhận được.`
        )
      } else {
        toast.success(
          `Đã xác nhận ${pendingWorkerIds.length} lô với ${updatedCount} tài liệu.`
        )
      }
    } finally {
      setCreatingManualBatch(false)
      setConfirmingAllManualQuickBatches(false)
      setConfirmingManualQuickWorkerIds(new Set())
    }
  }

  const createManualBatchFromSelection = async () => {
    if (!sessionId) {
      toast.error("Chưa có session để tạo lô metadata.")
      return
    }
    if (manualSelectedIds.size === 0) {
      toast.error("Chọn ít nhất một tài liệu để tạo lô mới.")
      return
    }
    if (!selectedAssigneeId) {
      toast.error("Chon nhan vien phu trach lo truoc khi tao.")
      return
    }
    if (manualSelectedIds.size > MAX_MANUAL_METADATA_BATCH_DOCUMENTS) {
      toast.error(
        `Moi lo metadata toi da ${MAX_MANUAL_METADATA_BATCH_DOCUMENTS} tai lieu.`
      )
      return
    }
    const orderedSelectedIds = manualSelectedDocumentIds
    if (orderedSelectedIds.length === 0) return

    setCreatingManualBatch(true)
    try {
      const response = await createMetadataBatch(
        sessionId,
        orderedSelectedIds,
        selectedAssigneeId
      )
      const updatedDocuments = response.documents ?? []
      const skippedDocuments = response.skipped_documents ?? []
      const refreshedDocuments = [...updatedDocuments, ...skippedDocuments]
      if (refreshedDocuments.length > 0) {
        setItems((previous) => replaceDocuments(previous, refreshedDocuments))
      }
      if (updatedDocuments.length > 0) {
        onDocumentsVerified?.(updatedDocuments)
      }
      setManualSelectedIds(new Set())
      setManualSelectedOnly(false)
      setManualSelectedItemSnapshots(new Map())
      setSelectedAssigneeId("")
      manualLastSelectedIdRef.current = null
      setManualSplitActive(true)
      setBatchMode("manual")
      setSelectedDocumentId(null)
      const skippedCount = response.skipped_count ?? skippedDocuments.length
      if (response.updated_count > 0) {
        const batchDocumentCount = Number(response.batch_document_count)
        toast.success(
          Number.isFinite(batchDocumentCount) && batchDocumentCount > 0
            ? `Đã gán ${response.updated_count} tài liệu. Lô hiện có ${Math.floor(batchDocumentCount)} tài liệu.`
            : `Đã gán ${response.updated_count} tài liệu.`
        )
      }
      if (skippedCount > 0) {
        toast.warning(
          `${skippedCount} tai lieu da duoc assign hoac xac nhan tu truoc nen duoc bo qua.`
        )
      }
      onMetadataDocumentsChanged?.()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Không thể tạo lô metadata."
      )
    } finally {
      setCreatingManualBatch(false)
    }
  }

  const finishMetadataBatch = async (group: MetadataBatchGroup) => {
    if (!sessionId) {
      toast.error("Chưa có session để kết thúc lô metadata.")
      return
    }
    if (!canManageMetadataBatches) return
    const batchId = normalizedMetadataBatchId(group.batchId)
    if (!batchId || group.kind !== "manual") return

    setClosingBatchIds((previous) => addTextId(previous, batchId))
    try {
      const response = await closeMetadataBatch(sessionId, batchId)
      const updatedDocuments = response.documents ?? []
      if (updatedDocuments.length > 0) {
        setItems((previous) => replaceDocuments(previous, updatedDocuments))
        onDocumentsVerified?.(updatedDocuments)
      }
      setManualSelectedIds(new Set())
      setManualSelectedOnly(false)
      setManualSelectedItemSnapshots(new Map())
      manualLastSelectedIdRef.current = null
      setManualSplitActive(false)
      setBatchMode("manual")
      onMetadataDocumentScopeChange?.({ scope: "reviewed" })
      setSelectedDocumentId(updatedDocuments[0]?.id ?? null)
      onMetadataDocumentsChanged?.()
      toast.success(
        `Đã kết thúc lô: ${response.reviewed_count ?? response.verified_count ?? 0} tài liệu đã review, ${response.unassigned_count} tài liệu quay lại chưa chia.`
      )
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Không thể kết thúc lô metadata."
      )
    } finally {
      setClosingBatchIds((previous) => removeTextId(previous, batchId))
    }
  }

  const handleRetryMetadata = async (item: PdfMetadata) => {
    if (!canRestartMetadata) {
      toast.error("Chỉ admin hoặc coordinator được chạy lại metadata.")
      return
    }
    if (!onRetryMetadata) {
      toast.error("Backend chưa bật chức năng chạy lại metadata.")
      return
    }
    setRetryingIds((previous) => addId(previous, item.id))
    setItems((previous) =>
      replaceMetadataItem(previous, resetMetadataItemForReextract(item))
    )
    try {
      const restarted = await onRetryMetadata(item.id)
      setItems((previous) => replaceDocument(previous, restarted))
      toast.success("Đã gửi yêu cầu chạy lại metadata cho tài liệu.")
    } catch (err) {
      setItems((previous) => replaceMetadataItem(previous, item))
      toast.error(
        err instanceof Error
          ? err.message
          : "Không thể chạy lại metadata cho tài liệu."
      )
    } finally {
      setRetryingIds((previous) => removeId(previous, item.id))
    }
  }

  const handleRetrySelectedMetadata = async () => {
    if (!canRestartMetadata) {
      toast.error("Chỉ admin hoặc coordinator được chạy lại metadata.")
      return
    }
    if (!onRetryMetadata) {
      toast.error("Backend chưa bật chức năng chạy lại metadata.")
      return
    }
    if (bulkRetryItems.length === 0) return

    setBulkVerifying(true)
    const retryIds = new Set(bulkRetryItems.map((item) => item.id))
    setItems((previous) => resetMetadataItemsForReextract(previous, retryIds))
    setRetryingIds((previous) => {
      const next = new Set(previous)
      bulkRetryItems.forEach((item) => next.add(item.id))
      return next
    })
    try {
      const results = await runSettledInBatches(bulkRetryItems, (item) =>
        onRetryMetadata(item.id)
      )
      const restarted = results
        .filter(
          (result): result is PromiseFulfilledResult<SessionDocumentResponse> =>
            result.status === "fulfilled"
        )
        .map((result) => result.value)
      if (restarted.length > 0) {
        setItems((previous) => replaceDocuments(previous, restarted))
      }

      const failedCount = results.length - restarted.length
      if (failedCount > 0) {
        setItems((previous) => {
          let next = previous
          results.forEach((result, index) => {
            if (result.status === "fulfilled") return
            const original = bulkRetryItems[index]
            if (!original) return
            next = replaceMetadataItem(next, original)
          })
          return next
        })
        toast.error(
          `${failedCount} tài liệu chưa gửi extract lại được. Vui lòng kiểm tra lại.`
        )
      }
      if (restarted.length > 0) {
        toast.success(
          `Đã gửi yêu cầu extract lại ${restarted.length} tài liệu.`
        )
      }
    } finally {
      setBulkVerifying(false)
      setRetryingIds((previous) => {
        const next = new Set(previous)
        bulkRetryItems.forEach((item) => next.delete(item.id))
        return next
      })
    }
  }

  const handleExportMetadataReview = async () => {
    if (!sessionId || !canExportMetadataReview) return
    setExportingMetadataReview(true)
    try {
      const result = await downloadSessionMetadataReviewXlsx(sessionId)
      saveBlob(result.blob, result.fileName)
      toast.success("Đã xuất XLSX metadata và người xác thực.")
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Không thể xuất XLSX metadata và người xác thực."
      )
    } finally {
      setExportingMetadataReview(false)
    }
  }

  const handlePreviewResizePointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>
  ) => {
    resizeProcessPreviewFromPointer(
      event,
      previewLayoutRef.current,
      setPreviewWidthPercent
    )
  }

  return {
    handleApply,
    handleVerifyAllReady,
    handleReviewModeChange,
    handleBatchSizeInputChange,
    handleBatchSizeInputBlur,
    handleSelectBatch,
    handleBatchModeChange,
    startManualSplit,
    cancelManualSplit,
    toggleManualSelection,
    selectAllDisplayedForManualSplit,
    clearManualSelection,
    toggleManualSelectedOnly,
    toggleBulkReviewSelectionMode,
    toggleBulkReviewSelection,
    selectAllDisplayedForBulkReview,
    clearBulkReviewSelection,
    confirmAutoBatch,
    confirmAllAutoBatches,
    confirmManualQuickBatch,
    confirmAllManualQuickBatches,
    createManualBatchFromSelection,
    finishMetadataBatch,
    handleRetryMetadata,
    handleRetrySelectedMetadata,
    handleExportMetadataReview,
    handlePreviewResizePointerDown,
  }
}

function readPositiveEnvInt(
  name: string,
  fallback: number,
  maxValue: number
): number {
  const env = import.meta.env as unknown as Record<string, string | undefined>
  const parsed = Number(env[name])
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.min(maxValue, Math.floor(parsed))
}

function chunkItems<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let start = 0; start < items.length; start += size) {
    chunks.push(items.slice(start, start + size))
  }
  return chunks
}

async function runSettledInBatches<T, R>(
  items: readonly T[],
  worker: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = []
  for (let start = 0; start < items.length; start += BULK_ACTION_BATCH_SIZE) {
    const batch = items.slice(start, start + BULK_ACTION_BATCH_SIZE)
    results.push(
      ...(await runSettledWithConcurrency(
        batch,
        worker,
        BULK_ACTION_CONCURRENCY
      ))
    )
  }
  return results
}

async function runSettledWithConcurrency<T, R>(
  items: readonly T[],
  worker: (item: T) => Promise<R>,
  concurrency: number
): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(items.length)
  let nextIndex = 0
  const runNext = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      const item = items[index] as T
      try {
        results[index] = {
          status: "fulfilled",
          value: await worker(item),
        }
      } catch (reason) {
        results[index] = { status: "rejected", reason }
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runNext())
  )
  return results
}
