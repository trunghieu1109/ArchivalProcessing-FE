import type { PointerEvent as ReactPointerEvent } from "react"
import { toast } from "sonner"
import {
  closeMetadataBatch,
  createMetadataBatch,
  downloadSessionMetadataReviewXlsx,
  verifyDocumentMetadata,
  type SessionDocumentResponse,
} from "@/features/upload/api/sessionApi"
import type { PdfMetadata } from "@/features/upload/types"
import type {
  MetadataBatchGroup,
  MetadataBatchMode,
  MetadataReviewMode,
} from "./ProcessStep.types"
import {
  isMetadataFailedItem,
  isMetadataConfirmable,
  replaceDocument,
  replaceDocuments,
  replaceVerifiedDocument,
  replaceVerifiedDocuments,
} from "./ProcessStep.metadataUtils"
import {
  addId,
  addTextId,
  buildManualMetadataBatchGroups,
  buildMetadataBatchGroups,
  canUserEditMetadataItem,
  findUnassignedBatchIndex,
  firstPreferredMetadataItem,
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
}

const BULK_ACTION_BATCH_SIZE = readPositiveEnvInt(
  "VITE_ARCHIVAL_BULK_ACTION_BATCH_SIZE",
  32,
  500
)
const BULK_ACTION_CONCURRENCY = readPositiveEnvInt(
  "VITE_ARCHIVAL_BULK_ACTION_CONCURRENCY",
  4,
  32
)

export function createProcessStepActions(context: ProcessStepActionContext) {
  const {
    sessionId,
    items,
    setItems,
    setVerifyingIds,
    bulkVerifyItems,
    bulkRetryItems,
    onDocumentsVerified,
    setBulkVerifying,
    setReviewMode,
    setManualSplitActive,
    setManualSelectedIds,
    setSelectedDocumentId,
    activeBatch,
    batchScopeItems,
    setBatchSize,
    setActiveBatchIndex,
    setBatchSizeInput,
    batchSizeInput,
    batchSize,
    setBatchMode,
    sortedItems,
    displayedItems,
    manualLastSelectedIdRef,
    setSelectedAssigneeId,
    setBulkReviewSelectionActive,
    setBulkSelectedIds,
    bulkLastSelectedIdRef,
    bulkReviewSelectionActive,
    displayedBulkSelectableItems,
    setCreatingManualBatch,
    manualSelectedIds,
    selectedAssigneeId,
    setClosingBatchIds,
    canManageMetadataBatches,
    setRetryingIds,
    onRetryMetadata,
    canExportMetadataReview,
    setExportingMetadataReview,
    previewLayoutRef,
    setPreviewWidthPercent,
    currentUserIdentity,
  } = context

  const handleApply = async (
    dataPath: string,
    meta?: Record<string, unknown>
  ) => {
    const item = items.find((candidate) => candidate.data_path === dataPath)
    if (!item) throw new Error("Không tìm thấy tài liệu trong session.")
    if (!sessionId) throw new Error("Chưa có session để xác nhận metadata.")
    if (!item.metadata_ready) {
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
      setItems(nextItems)
      onDocumentsVerified?.([verified])
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
      const results = await runSettledInBatches(bulkVerifyItems, (item) =>
        verifyDocumentMetadata(sessionId, item.id)
      )
      const verified = results
        .filter(
          (result): result is PromiseFulfilledResult<SessionDocumentResponse> =>
            result.status === "fulfilled"
        )
        .map((result) => result.value)
      if (verified.length > 0) {
        const nextItems = replaceVerifiedDocuments(items, verified)
        setItems(nextItems)
        onDocumentsVerified?.(verified)
      }

      const failedCount = results.length - verified.length
      if (failedCount > 0) {
        toast.error(
          `${failedCount} tài liệu chưa xác nhận được. Vui lòng kiểm tra lại.`
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
    bulkLastSelectedIdRef.current = null
  }

  const handleReviewModeChange = (mode: MetadataReviewMode) => {
    setReviewMode(mode)
    setManualSplitActive(false)
    setManualSelectedIds(new Set())
    resetBulkReviewSelection()
    if (mode === "batch") {
      setSelectedDocumentId(
        firstPreferredMetadataItem(activeBatch?.items ?? EMPTY_METADATA_ITEMS)
          ?.id ?? null
      )
    }
  }

  const handleBatchSizeChange = (value: number) => {
    const nextBatchSize = normalizeBatchSize(value)
    setBatchSize(nextBatchSize)
    setActiveBatchIndex(0)
    setSelectedDocumentId(
      firstPreferredMetadataItem(batchScopeItems.slice(0, nextBatchSize))?.id ??
        null
    )
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
    setSelectedAssigneeId("")
    resetBulkReviewSelection()
    setSelectedDocumentId(firstPreferredMetadataItem(group.items)?.id ?? null)
  }

  const handleBatchModeChange = (mode: MetadataBatchMode) => {
    setBatchMode(mode)
    setManualSplitActive(false)
    setManualSelectedIds(new Set())
    setSelectedAssigneeId("")
    resetBulkReviewSelection()
    setActiveBatchIndex(0)
    const nextGroups =
      mode === "manual"
        ? buildManualMetadataBatchGroups(batchScopeItems)
        : buildMetadataBatchGroups(batchScopeItems, batchSize)
    setSelectedDocumentId(
      firstPreferredMetadataItem(nextGroups[0]?.items ?? batchScopeItems)?.id ??
        null
    )
  }

  const startManualSplit = () => {
    if (!canManageMetadataBatches) return
    setReviewMode("batch")
    setBatchMode("manual")
    setManualSplitActive(true)
    setManualSelectedIds(new Set())
    resetBulkReviewSelection()
    const nextGroups = buildManualMetadataBatchGroups(sortedItems)
    const unassignedIndex = findUnassignedBatchIndex(nextGroups)
    const targetGroup = nextGroups[unassignedIndex] ?? nextGroups[0] ?? null
    setActiveBatchIndex(unassignedIndex >= 0 ? unassignedIndex : 0)
    setSelectedDocumentId(
      firstPreferredMetadataItem(targetGroup?.items ?? [])?.id ?? null
    )
    manualLastSelectedIdRef.current = null
  }

  const cancelManualSplit = () => {
    setManualSplitActive(false)
    setManualSelectedIds(new Set())
    setSelectedAssigneeId("")
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
    setManualSelectedIds(new Set(displayedItems.map((item) => item.id)))
    manualLastSelectedIdRef.current =
      displayedItems[displayedItems.length - 1]?.id ?? null
  }

  const clearManualSelection = () => {
    setManualSelectedIds(new Set())
    manualLastSelectedIdRef.current = null
  }

  const toggleBulkReviewSelectionMode = () => {
    if (bulkReviewSelectionActive) {
      resetBulkReviewSelection()
      return
    }
    setBulkReviewSelectionActive(true)
    setBulkSelectedIds(new Set())
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
    setBulkSelectedIds(
      new Set(displayedBulkSelectableItems.map((item) => item.id))
    )
    bulkLastSelectedIdRef.current =
      displayedBulkSelectableItems[displayedBulkSelectableItems.length - 1]
        ?.id ?? null
  }

  const clearBulkReviewSelection = () => {
    setBulkSelectedIds(new Set())
    bulkLastSelectedIdRef.current = null
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
    const selectedIds = new Set(manualSelectedIds)
    const orderedSelectedIds = displayedItems
      .filter((item) => selectedIds.has(item.id))
      .map((item) => item.id)
    if (orderedSelectedIds.length === 0) return

    setCreatingManualBatch(true)
    try {
      const response = await createMetadataBatch(
        sessionId,
        orderedSelectedIds,
        selectedAssigneeId
      )
      const updatedDocuments = response.documents ?? []
      if (updatedDocuments.length > 0) {
        setItems((previous) => replaceDocuments(previous, updatedDocuments))
        onDocumentsVerified?.(updatedDocuments)
      }
      setManualSelectedIds(new Set())
      setSelectedAssigneeId("")
      manualLastSelectedIdRef.current = null
      setManualSplitActive(true)
      setBatchMode("manual")
      setSelectedDocumentId(null)
      toast.success(`Đã tạo lô mới với ${response.updated_count} tài liệu.`)
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
      manualLastSelectedIdRef.current = null
      setManualSplitActive(true)
      setBatchMode("manual")
      setSelectedDocumentId(null)
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
    if (!canUserEditMetadataItem(item, currentUserIdentity)) {
      toast.error("Bạn chỉ có thể chạy lại metadata trong lô được giao.")
      return
    }
    if (!onRetryMetadata) {
      toast.error("Backend chưa bật chức năng chạy lại metadata.")
      return
    }
    setRetryingIds((previous) => addId(previous, item.id))
    try {
      const restarted = await onRetryMetadata(item.id)
      setItems((previous) => replaceDocument(previous, restarted))
      toast.success("Đã gửi yêu cầu chạy lại metadata cho tài liệu.")
    } catch (err) {
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
    if (!onRetryMetadata) {
      toast.error("Backend chưa bật chức năng chạy lại metadata.")
      return
    }
    if (bulkRetryItems.length === 0) return

    setBulkVerifying(true)
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
    toggleBulkReviewSelectionMode,
    toggleBulkReviewSelection,
    selectAllDisplayedForBulkReview,
    clearBulkReviewSelection,
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
