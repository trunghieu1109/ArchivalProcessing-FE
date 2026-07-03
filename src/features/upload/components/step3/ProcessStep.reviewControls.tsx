import { useMemo, useState } from "react"
import {
  ChevronDown,
  CheckCircle2,
  Eye,
  FolderOpen,
  List,
  Loader2,
  Plus,
  RefreshCw,
  Scissors,
  Search,
  UserRound,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ReviewModeButton } from "./ProcessStep.parts"
import { cn } from "@/shared/lib/utils"
import {
  type MetadataBatchMode,
  type MetadataBatchGroup,
  type MetadataReviewMode,
} from "./ProcessStep.types"
import type {
  AutoMetadataBatchPlanResponse,
  CreateMetadataBatchResponse,
} from "@/features/upload/api/sessionApi"
import type { PdfMetadata } from "@/features/upload/types"
import type { ChinhlyUser } from "@/features/auth/api/authApi"
import { chinhlyUserId, chinhlyUserLabel } from "./ProcessStep.batchUtils"

interface ProcessStepReviewControlsProps {
  activeBatch: MetadataBatchGroup | null
  autoBatchAssigneeIds: Map<number, string>
  autoBatchConfirmations: Map<number, CreateMetadataBatchResponse>
  autoBatchPlan: AutoMetadataBatchPlanResponse | null
  autoBatchPlanError: string
  autoBatchPlanLoading: boolean
  autoBatchPlanRequested: boolean
  batchGroups: MetadataBatchGroup[]
  batchMode: MetadataBatchMode
  bulkReviewSelectionActive: boolean
  bulkRetryItems: PdfMetadata[]
  bulkSelectionCount: number
  bulkVerifyItems: PdfMetadata[]
  bulkVerifying: boolean
  canBulkSelectMetadata: boolean
  canManageMetadataBatches: boolean
  cancelManualSplit: () => void
  clearBulkReviewSelection: () => void
  clearManualSelection: () => void
  confirmAllAutoBatches: () => Promise<void>
  confirmAllManualQuickBatches: () => Promise<void>
  confirmAutoBatch: (groupIndex: number) => Promise<void>
  confirmManualQuickBatch: (workerId: string) => Promise<void>
  confirmingAllAutoBatches: boolean
  confirmingAllManualQuickBatches: boolean
  confirmingAutoBatchIndexes: Set<number>
  confirmingManualQuickWorkerIds: Set<string>
  closingBatchIds: Set<string>
  createManualBatchFromSelection: () => Promise<void>
  creatingManualBatch: boolean
  displayedBulkSelectableItems: PdfMetadata[]
  displayedItems: PdfMetadata[]
  finishMetadataBatch: (group: MetadataBatchGroup) => Promise<void>
  handleReviewModeChange: (mode: MetadataReviewMode) => void
  handleSelectBatch: (group: MetadataBatchGroup) => void
  handleRetrySelectedMetadata: () => Promise<void>
  handleVerifyAllReady: () => Promise<void>
  hasServerPagination: boolean
  manualSelectedIds: Set<number>
  manualSelectedOnly: boolean
  manualSelectedVisibleItems: PdfMetadata[]
  manualQuickConfirmations: Map<string, CreateMetadataBatchResponse>
  manualQuickCounts: Map<string, string>
  manualSplitActive: boolean
  metadataFileFilter: string
  reviewMode: MetadataReviewMode
  selectAllDisplayedForBulkReview: () => void
  selectAllDisplayedForManualSplit: () => void
  selectedAssigneeId: string
  selectedAutoWorkerIds: Set<string>
  selectedManualWorkerIds: Set<string>
  setMetadataFileFilter: (value: string) => void
  setAutoBatchAssigneeIds: (
    updater: (previous: Map<number, string>) => Map<number, string>
  ) => void
  setAutoBatchPlanRequested: (value: boolean) => void
  setManualQuickCounts: (
    updater: (previous: Map<string, string>) => Map<string, string>
  ) => void
  setSelectedAutoWorkerIds: (value: Set<string>) => void
  setSelectedAssigneeId: (value: string) => void
  setSelectedManualWorkerIds: (value: Set<string>) => void
  startManualSplit: () => void
  toggleBulkReviewSelectionMode: () => void
  toggleManualSelectedOnly: () => void
  workers: ChinhlyUser[]
  workersLoading: boolean
}

export function ProcessStepReviewControls(
  props: ProcessStepReviewControlsProps
) {
  const {
    activeBatch,
    autoBatchAssigneeIds,
    autoBatchConfirmations,
    autoBatchPlan,
    autoBatchPlanError,
    autoBatchPlanLoading,
    autoBatchPlanRequested,
    batchGroups,
    batchMode,
    bulkReviewSelectionActive,
    bulkRetryItems,
    bulkSelectionCount,
    bulkVerifyItems,
    bulkVerifying,
    canBulkSelectMetadata,
    canManageMetadataBatches,
    cancelManualSplit,
    clearBulkReviewSelection,
    clearManualSelection,
    confirmAllAutoBatches,
    confirmAllManualQuickBatches,
    confirmAutoBatch,
    confirmManualQuickBatch,
    confirmingAllAutoBatches,
    confirmingAllManualQuickBatches,
    confirmingAutoBatchIndexes,
    confirmingManualQuickWorkerIds,
    closingBatchIds,
    createManualBatchFromSelection,
    creatingManualBatch,
    displayedBulkSelectableItems,
    displayedItems,
    finishMetadataBatch,
    handleReviewModeChange,
    handleSelectBatch,
    handleRetrySelectedMetadata,
    handleVerifyAllReady,
    hasServerPagination,
    manualSelectedIds,
    manualSelectedOnly,
    manualSelectedVisibleItems,
    manualQuickConfirmations,
    manualQuickCounts,
    manualSplitActive,
    metadataFileFilter,
    reviewMode,
    selectAllDisplayedForBulkReview,
    selectAllDisplayedForManualSplit,
    selectedAssigneeId,
    setMetadataFileFilter,
    setAutoBatchAssigneeIds,
    setAutoBatchPlanRequested,
    selectedAutoWorkerIds,
    selectedManualWorkerIds,
    setManualQuickCounts,
    setSelectedAutoWorkerIds,
    setSelectedAssigneeId,
    setSelectedManualWorkerIds,
    startManualSplit,
    toggleBulkReviewSelectionMode,
    toggleManualSelectedOnly,
    workers,
    workersLoading,
  } = props
  const [batchSelectorOpen, setBatchSelectorOpen] = useState(false)
  const [autoSplitPanelOpen, setAutoSplitPanelOpen] = useState(false)
  const manualSelectionLimit = 1000
  const manualSelectedCount = manualSelectedIds.size
  const manualSelectionOverLimit = manualSelectedCount > manualSelectionLimit
  const manualSelectedVisibleCount = manualSelectedVisibleItems?.length ?? 0
  const manualQuickBusy =
    creatingManualBatch ||
    confirmingAllManualQuickBatches ||
    confirmingManualQuickWorkerIds.size > 0
  const pendingAutoBatchCount =
    autoBatchPlan?.groups.filter(
      (group: { index: number }) => !autoBatchConfirmations.has(group.index)
    ).length ?? 0
  const selectedAutoWorkerCount = selectedAutoWorkerIds.size
  const selectedAutoWorkers = workers.filter((worker: ChinhlyUser) => {
    const workerId = chinhlyUserId(worker)
    return Boolean(workerId && selectedAutoWorkerIds.has(workerId))
  })
  const selectedManualWorkers = workers.filter((worker: ChinhlyUser) => {
    const workerId = chinhlyUserId(worker)
    return Boolean(workerId && selectedManualWorkerIds.has(workerId))
  })
  const existingBatchByWorkerId = useMemo(() => {
    const batchByWorkerId = new Map<string, MetadataBatchGroup>()
    batchGroups.forEach((group: MetadataBatchGroup) => {
      if (group.kind !== "manual") return
      const workerId = String(group.assigneeUserId ?? "").trim()
      if (!workerId || batchByWorkerId.has(workerId)) return
      batchByWorkerId.set(workerId, group)
    })
    return batchByWorkerId
  }, [batchGroups])
  const selectedAssigneeBatch = selectedAssigneeId
    ? (existingBatchByWorkerId.get(selectedAssigneeId) ?? null)
    : null
  const manualQuickRows = selectedManualWorkers.map((worker: ChinhlyUser) => {
    const workerId = chinhlyUserId(worker)
    const rawCount = manualQuickCounts.get(workerId) ?? ""
    const requestedCount = /^\d+$/.test(rawCount.trim())
      ? Math.floor(Number(rawCount))
      : 0
    const confirmation = manualQuickConfirmations.get(workerId) ?? null
    return {
      worker,
      workerId,
      rawCount,
      requestedCount,
      confirmation,
      existingBatch: existingBatchByWorkerId.get(workerId) ?? null,
    }
  })
  const pendingManualQuickCount = manualQuickRows.filter(
    (row) => !row.confirmation
  ).length
  const pendingManualQuickDocumentCount = manualQuickRows.reduce(
    (total, row) =>
      row.confirmation ? total : total + Math.max(0, row.requestedCount),
    0
  )
  const manualQuickUnassignedCount =
    activeBatch?.kind === "unassigned" ? activeBatch.totalCount : 0
  const manualQuickRemainingCount = Math.max(
    0,
    manualQuickUnassignedCount - pendingManualQuickDocumentCount
  )
  const manualQuickExcessCount = Math.max(
    0,
    pendingManualQuickDocumentCount - manualQuickUnassignedCount
  )
  const manualQuickHasInvalidCount = manualQuickRows.some(
    (row) =>
      !row.confirmation &&
      (row.requestedCount < 1 || row.requestedCount > manualSelectionLimit)
  )
  const selectedUnassignedBatch =
    reviewMode === "batch" && activeBatch?.kind === "unassigned"
  const showSplitActions =
    canManageMetadataBatches && selectedUnassignedBatch && !manualSplitActive
  const showAutoSplitPanel = showSplitActions && autoSplitPanelOpen
  const toggleAutoWorker = (workerId: string, checked: boolean) => {
    const next = new Set(selectedAutoWorkerIds)
    if (checked) {
      next.add(workerId)
    } else {
      next.delete(workerId)
    }
    setSelectedAutoWorkerIds(next)
    setAutoBatchPlanRequested(false)
  }
  const toggleManualQuickWorker = (workerId: string, checked: boolean) => {
    if (manualQuickConfirmations.has(workerId)) return
    const next = new Set(selectedManualWorkerIds)
    if (checked) {
      next.add(workerId)
    } else {
      next.delete(workerId)
    }
    setSelectedManualWorkerIds(next)
    setManualQuickCounts((previous) => {
      const counts = new Map(previous)
      if (checked) {
        if (!counts.has(workerId)) counts.set(workerId, "")
      } else {
        counts.delete(workerId)
      }
      return counts
    })
  }
  const handleManualQuickCountChange = (workerId: string, value: string) => {
    if (!/^\d*$/.test(value)) return
    setManualQuickCounts((previous) => {
      const next = new Map(previous)
      next.set(workerId, value)
      return next
    })
  }
  const handleReviewModeButtonClick = (mode: MetadataReviewMode) => {
    if (mode === "list") {
      setAutoSplitPanelOpen(false)
      setAutoBatchPlanRequested(false)
    }
    handleReviewModeChange(mode)
  }
  const handleBatchSelectAndClose = (group: MetadataBatchGroup) => {
    setAutoSplitPanelOpen(false)
    setAutoBatchPlanRequested(false)
    handleSelectBatch(group)
    setBatchSelectorOpen(false)
  }
  const handleManualSplitClick = () => {
    setAutoSplitPanelOpen(false)
    setAutoBatchPlanRequested(false)
    startManualSplit()
  }
  const handleAutoSplitClick = () => {
    setBatchSelectorOpen(false)
    setAutoSplitPanelOpen(true)
    setAutoBatchPlanRequested(false)
  }
  const handleAutoPlanRequest = () => {
    setAutoBatchPlanRequested(true)
  }
  const handleConfirmAllAutoBatches = async () => {
    await confirmAllAutoBatches()
    setAutoSplitPanelOpen(false)
    setAutoBatchPlanRequested(false)
  }
  const handleCloseAutoSplitPanel = () => {
    setAutoSplitPanelOpen(false)
    setAutoBatchPlanRequested(false)
  }
  const handleAutoBatchAssigneeChange = (
    groupIndex: number,
    workerId: string
  ) => {
    setAutoBatchAssigneeIds((previous) => {
      const next = new Map(previous)
      next.set(groupIndex, workerId)
      return next
    })
  }

  return (
    <>
      <div className="flex flex-col gap-3 rounded-xl border border-[#D8E1EC] bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] p-1">
              <ReviewModeButton
                active={reviewMode === "list"}
                icon={<List className="size-3.5" />}
                label="Danh sách"
                onClick={() => handleReviewModeButtonClick("list")}
              />
              <ReviewModeButton
                active={reviewMode === "batch"}
                icon={<FolderOpen className="size-3.5" />}
                label="Theo lô"
                onClick={() => handleReviewModeButtonClick("batch")}
              />
            </div>
            {reviewMode === "batch" && activeBatch && (
              <span className="rounded-full bg-[#EFF6FF] px-2.5 py-1 text-xs font-medium text-[#475569]">
                {activeBatch.label}: {activeBatch.reviewedCount}/
                {activeBatch.totalCount} đã review
              </span>
            )}
            <label className="flex h-8 min-w-[14rem] flex-1 items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-2 text-xs text-[#475569] transition-colors focus-within:border-[#0052FF] focus-within:ring-2 focus-within:ring-[#0052FF]/15">
              <Search className="size-3.5 shrink-0 text-[#94A3B8]" />
              <input
                value={metadataFileFilter}
                onChange={(event) => setMetadataFileFilter(event.target.value)}
                placeholder="Lọc theo tên file"
                className="min-w-0 flex-1 bg-transparent text-xs text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
              />
              {metadataFileFilter ? (
                <button
                  type="button"
                  onClick={() => setMetadataFileFilter("")}
                  title="Xóa lọc tên file"
                  aria-label="Xóa lọc tên file"
                  className="flex size-5 shrink-0 items-center justify-center rounded-md text-[#64748B] hover:bg-[#F1F5F9]"
                >
                  <X className="size-3" />
                </button>
              ) : null}
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {!manualSplitActive &&
              (bulkReviewSelectionActive || canBulkSelectMetadata) && (
                <Button
                  type="button"
                  variant={bulkReviewSelectionActive ? "default" : "outline"}
                  size="sm"
                  onClick={toggleBulkReviewSelectionMode}
                  disabled={bulkVerifying}
                  className="h-8 gap-1.5 text-xs"
                >
                  {bulkReviewSelectionActive ? (
                    <X className="size-3" />
                  ) : (
                    <CheckCircle2 className="size-3" />
                  )}
                  {bulkReviewSelectionActive ? "Hủy chọn nhiều" : "Chọn nhiều"}
                </Button>
              )}
            {bulkReviewSelectionActive && !manualSplitActive && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={selectAllDisplayedForBulkReview}
                  disabled={
                    bulkVerifying || displayedBulkSelectableItems.length === 0
                  }
                  className="h-8 gap-1.5 text-xs"
                >
                  <List className="size-3" />
                  Trang này: Chọn tất cả
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearBulkReviewSelection}
                  disabled={bulkVerifying || bulkSelectionCount === 0}
                  className="h-8 gap-1.5 text-xs"
                >
                  Bỏ chọn
                </Button>
              </>
            )}
            {(bulkVerifyItems.length > 0 || bulkReviewSelectionActive) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleVerifyAllReady()}
                disabled={bulkVerifying || bulkVerifyItems.length === 0}
                className="h-8 gap-1.5 text-xs"
              >
                {bulkVerifying ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-3" />
                )}
                {bulkReviewSelectionActive
                  ? `Xác nhận đã chọn (${bulkVerifyItems.length})`
                  : reviewMode === "batch"
                    ? `Xác nhận lô (${bulkVerifyItems.length})`
                    : `Xác nhận tất cả (${bulkVerifyItems.length})`}
              </Button>
            )}
            {bulkReviewSelectionActive && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleRetrySelectedMetadata()}
                disabled={bulkVerifying || bulkRetryItems.length === 0}
                className="h-8 gap-1.5 text-xs"
              >
                {bulkVerifying ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <RefreshCw className="size-3" />
                )}
                Extract lại đã chọn ({bulkRetryItems.length})
              </Button>
            )}
            {reviewMode === "batch" &&
              canManageMetadataBatches &&
              batchMode === "manual" &&
              !manualSplitActive &&
              activeBatch?.kind === "manual" &&
              activeBatch.batchId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void finishMetadataBatch(activeBatch)}
                  disabled={closingBatchIds.has(activeBatch.batchId)}
                  className="h-8 gap-1.5 text-xs"
                >
                  {closingBatchIds.has(activeBatch.batchId) ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-3" />
                  )}
                  Kết thúc lô
                </Button>
              )}
            {showSplitActions && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleManualSplitClick}
                  className="h-8 gap-1.5 text-xs"
                >
                  <Scissors data-icon="inline-start" className="size-3" />
                  Chia lô thủ công
                </Button>
                <Button
                  type="button"
                  variant={autoSplitPanelOpen ? "default" : "outline"}
                  size="sm"
                  onClick={handleAutoSplitClick}
                  className="h-8 gap-1.5 text-xs"
                >
                  <FolderOpen data-icon="inline-start" className="size-3" />
                  Chia lô tự động
                </Button>
              </>
            )}
            {reviewMode === "batch" &&
              canManageMetadataBatches &&
              batchMode === "manual" &&
              manualSplitActive && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={selectAllDisplayedForManualSplit}
                    disabled={displayedItems.length === 0}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <List data-icon="inline-start" className="size-3" />
                    Trang này: Chọn tất cả
                  </Button>
                  <Button
                    type="button"
                    variant={manualSelectedOnly ? "default" : "outline"}
                    size="sm"
                    onClick={toggleManualSelectedOnly}
                    disabled={!manualSelectedOnly && manualSelectedCount === 0}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <EyeIcon active={manualSelectedOnly} />
                    Chỉ đã chọn
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearManualSelection}
                    disabled={manualSelectedCount === 0}
                    className="h-8 gap-1.5 text-xs"
                  >
                    Bỏ chọn
                  </Button>
                  <label className="flex h-8 min-w-[13rem] items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-2 text-xs font-medium text-[#475569]">
                    {workersLoading ? (
                      <Loader2 className="size-3 animate-spin text-[#0052FF]" />
                    ) : (
                      <UserRound className="size-3 text-[#0052FF]" />
                    )}
                    <select
                      value={selectedAssigneeId}
                      onChange={(event) =>
                        setSelectedAssigneeId(event.target.value)
                      }
                      disabled={workersLoading || creatingManualBatch}
                      className="min-w-0 flex-1 bg-transparent text-xs text-[#0F172A] outline-none"
                    >
                      <option value="">Chọn nhân viên</option>
                      {workers.map((worker: ChinhlyUser) => {
                        const id = chinhlyUserId(worker)
                        if (!id) return null
                        const existingBatch = existingBatchByWorkerId.get(id)
                        return (
                          <option key={id} value={id}>
                            {workerOptionLabel(worker, existingBatch)}
                          </option>
                        )
                      })}
                    </select>
                  </label>
                  {selectedAssigneeId ? (
                    <span className="min-w-[12rem] text-[11px] font-medium text-[#64748B]">
                      {workerBatchStatusLabel(selectedAssigneeBatch)}
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void createManualBatchFromSelection()}
                    disabled={
                      manualSelectedCount === 0 ||
                      manualSelectionOverLimit ||
                      !selectedAssigneeId ||
                      creatingManualBatch
                    }
                    className="h-8 gap-1.5 text-xs"
                  >
                    {creatingManualBatch ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Plus data-icon="inline-start" className="size-3" />
                    )}
                    Gán tài liệu
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={cancelManualSplit}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <X data-icon="inline-start" className="size-3" />
                    Hủy
                  </Button>
                </>
              )}
          </div>
        </div>
        {reviewMode === "batch" &&
          canManageMetadataBatches &&
          batchMode === "manual" &&
          manualSplitActive && (
            <div
              className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                manualSelectionOverLimit
                  ? "border-[#FCA5A5] bg-[#FEF2F2] text-[#991B1B]"
                  : "border-[#BFD3FF] bg-[#F8FAFC] text-[#0F172A]"
              }`}
            >
              Đã chọn {manualSelectedCount}/{manualSelectionLimit} tài liệu.
              {manualSelectedOnly
                ? ` Đang hiển thị ${manualSelectedVisibleCount} tài liệu đã chọn.`
                : " Hãy đi qua các trang để chọn thêm tài liệu."}
              {" Giữ Shift khi chọn để chọn một dải."}
              {hasServerPagination
                ? " Lựa chọn được giữ khi chuyển trang."
                : ""}
            </div>
          )}
        {reviewMode === "batch" &&
          canManageMetadataBatches &&
          batchMode === "manual" &&
          manualSplitActive && (
            <div className="flex flex-col gap-3 rounded-xl border border-[#D8E1EC] bg-white p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-[#0F172A]">
                    Phân công nhanh
                  </p>
                  <p className="text-[11px] text-[#64748B]">
                    {manualQuickRows.length > 0
                      ? manualQuickExcessCount > 0
                        ? `${manualQuickRows.length} worker · vượt ${manualQuickExcessCount} tài liệu so với số chưa chia`
                        : `${manualQuickRows.length} worker · ${pendingManualQuickDocumentCount} tài liệu sẽ chia · còn ${manualQuickRemainingCount} chưa chia`
                      : "Chọn worker, nhập số lượng; dòng xác nhận trước sẽ lấy tài liệu kế tiếp"}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void confirmAllManualQuickBatches()}
                  disabled={
                    manualQuickBusy ||
                    manualQuickRows.length === 0 ||
                    pendingManualQuickCount === 0 ||
                    manualQuickHasInvalidCount
                  }
                  className="h-8 gap-1.5 text-xs"
                >
                  {confirmingAllManualQuickBatches ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-3" />
                  )}
                  Xác nhận tất cả ({pendingManualQuickCount})
                </Button>
              </div>

              <div className="flex flex-col gap-2 border-y border-[#E2E8F0] py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-[#0F172A]">
                    Worker tham gia xác thực
                  </p>
                  <span className="text-[11px] font-medium text-[#64748B]">
                    {selectedManualWorkerIds.size}/{workers.length} đã chọn
                  </span>
                </div>
                {workersLoading ? (
                  <div className="flex items-center gap-2 py-1 text-xs text-[#64748B]">
                    <Loader2 className="size-3.5 animate-spin" />
                    Đang tải worker...
                  </div>
                ) : workers.length > 0 ? (
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1 pr-1">
                    {workers.map((worker: ChinhlyUser) => {
                      const workerId = chinhlyUserId(worker)
                      if (!workerId) return null
                      const checked = selectedManualWorkerIds.has(workerId)
                      const confirmed = manualQuickConfirmations.has(workerId)
                      const existingBatch = existingBatchByWorkerId.get(workerId)
                      return (
                        <label
                          key={workerId}
                          className="flex min-w-0 items-start gap-2 rounded-md px-2 py-1.5 text-xs text-[#0F172A] hover:bg-white"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) =>
                              toggleManualQuickWorker(
                                workerId,
                                event.target.checked
                              )
                            }
                            disabled={manualQuickBusy || confirmed}
                            className="mt-0.5 size-3.5 shrink-0"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">
                              {chinhlyUserLabel(worker)}
                            </span>
                            <span className="block truncate text-[10px] text-[#64748B]">
                              {workerBatchStatusLabel(existingBatch)}
                            </span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                ) : (
                  <p className="py-1 text-xs text-[#64748B]">
                    Không có worker đang hoạt động.
                  </p>
                )}
              </div>

              {manualQuickRows.length > 0 ? (
                <div className="max-h-[22rem] overflow-y-auto border-y border-[#E2E8F0]">
                  {manualQuickRows.map((row) => {
                    const skippedCount = row.confirmation
                      ? (row.confirmation.skipped_count ??
                        row.confirmation.skipped_documents?.length ??
                        0)
                      : 0
                    const confirming = confirmingManualQuickWorkerIds.has(
                      row.workerId
                    )
                    const rowExceedsAvailable =
                      row.requestedCount > manualQuickUnassignedCount
                    const canConfirmThisRow =
                      !row.confirmation &&
                      row.requestedCount > 0 &&
                      row.requestedCount <= manualSelectionLimit &&
                      !manualQuickBusy
                    return (
                      <div
                        key={row.workerId}
                        className="grid grid-cols-1 items-center gap-2 border-b border-[#E2E8F0] py-2 last:border-b-0 sm:grid-cols-[minmax(12rem,1.4fr)_minmax(7rem,0.7fr)_minmax(8rem,0.8fr)_auto]"
                      >
                        <div className="min-w-0">
                          <span className="block truncate text-xs font-semibold text-[#0F172A]">
                            {chinhlyUserLabel(row.worker)}
                          </span>
                          <span className="block text-[10px] text-[#64748B]">
                            {workerBatchStatusLabel(row.existingBatch)}
                          </span>
                        </div>
                        <label className="flex min-w-0 items-center gap-2 rounded-md border border-[#CBD5E1] bg-[#F8FAFC] px-2 py-1.5 text-xs text-[#0F172A]">
                          Số lượng
                          <input
                            type="text"
                            inputMode="numeric"
                            value={row.rawCount}
                            onChange={(event) =>
                              handleManualQuickCountChange(
                                row.workerId,
                                event.target.value
                              )
                            }
                            disabled={
                              Boolean(row.confirmation) || manualQuickBusy
                            }
                            className="h-6 w-16 rounded-md border border-[#CBD5E1] bg-white px-2 text-xs text-[#0F172A] outline-none focus-visible:border-[#0052FF] focus-visible:ring-2 focus-visible:ring-[#0052FF]/20"
                          />
                        </label>
                        <span
                          className={cn(
                            "text-[11px]",
                            rowExceedsAvailable && !row.confirmation
                              ? "font-medium text-red-600"
                              : "text-[#64748B]"
                          )}
                        >
                          {row.confirmation
                            ? confirmationBatchStatusLabel(
                                row.confirmation,
                                row.confirmation.updated_count
                              )
                            : rowExceedsAvailable
                              ? `Vượt số còn lại (${manualQuickUnassignedCount})`
                              : row.requestedCount > 0
                                ? `Sẽ lấy ${row.requestedCount} tài liệu kế tiếp`
                                : "Chưa nhập"}
                        </span>
                        {row.confirmation ? (
                          <span
                            className={
                              skippedCount > 0
                                ? "inline-flex h-8 items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 text-[11px] font-semibold whitespace-nowrap text-amber-700"
                                : "inline-flex h-8 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 text-[11px] font-semibold whitespace-nowrap text-emerald-700"
                            }
                          >
                            <CheckCircle2 className="size-3" />
                            {skippedCount > 0
                              ? `${row.confirmation.updated_count}/${row.requestedCount} đã gán`
                              : "Đã xác nhận"}
                          </span>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              void confirmManualQuickBatch(row.workerId)
                            }
                            disabled={!canConfirmThisRow}
                            className="h-8 gap-1 text-xs whitespace-nowrap"
                          >
                            {confirming ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="size-3" />
                            )}
                            Xác nhận
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="py-1 text-xs text-[#64748B]">
                  Chọn worker để nhập số lượng tài liệu cho từng người.
                </p>
              )}
            </div>
          )}
        {bulkReviewSelectionActive && !manualSplitActive && (
          <div className="rounded-lg border border-[#BFD3FF] bg-[#EFF6FF] px-3 py-2 text-xs font-medium text-[#0F172A]">
            Đã chọn {bulkSelectionCount} tài liệu để xác nhận hàng loạt. Giữ
            Shift khi chọn để chọn một dải.
          </div>
        )}
      </div>
      {reviewMode === "batch" && batchGroups.length > 0 && activeBatch && (
        <div className="rounded-xl border border-[#D8E1EC] bg-white p-2.5">
          <button
            type="button"
            aria-expanded={batchSelectorOpen}
            onClick={() => setBatchSelectorOpen((open) => !open)}
            className="grid w-full grid-cols-1 gap-3 rounded-lg border border-[#C7D7EA] bg-white px-3 py-2.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-[#8FB5FF] xl:grid-cols-[minmax(10rem,1fr)_minmax(28rem,2fr)_minmax(10rem,1fr)_auto]"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#0F172A]">
                {activeBatch.label}
              </p>
              <p className="mt-1 text-[11px] text-[#64748B]">
                {activeBatch.totalCount} tài liệu
              </p>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-[11px] text-[#475569]">
              <BatchCountPill
                label="Đã review"
                value={activeBatch.reviewedCount}
                tone="reviewed"
              />
              <BatchCountPill
                label="Tự động xác thực"
                value={activeBatch.autoVerifiedCount}
              />
              <BatchCountPill
                label="Cần xác minh"
                value={activeBatch.warningCount}
                tone="warning"
              />
              <BatchCountPill
                label="Lỗi"
                value={activeBatch.failedCount}
                tone="error"
              />
            </div>
            <div className="min-w-0 text-[11px] text-[#475569]">
              <p className="font-semibold text-[#0F172A]">
                {metadataBatchAssigneeLabel(activeBatch)}
              </p>
              <p className="mt-1">Phụ trách</p>
            </div>
            <div className="flex min-w-0 items-center justify-end">
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-[#64748B] transition-transform",
                  batchSelectorOpen ? "rotate-180" : ""
                )}
              />
            </div>
          </button>
          {batchSelectorOpen ? (
            <div className="mt-2 border-t border-[#E2E8F0] pt-2">
              <div className="hidden grid-cols-[minmax(8rem,1.1fr)_repeat(5,minmax(6.5rem,0.8fr))_minmax(10rem,1fr)] px-3 py-1.5 text-[10px] font-semibold tracking-[0.12em] text-[#64748B] uppercase lg:grid">
                <span>Tên lô</span>
                <span>Tài liệu</span>
                <span>Đã review</span>
                <span>Tự động</span>
                <span>Cần xác minh</span>
                <span>Lỗi</span>
                <span>Phụ trách</span>
              </div>
              <div className="max-h-[19rem] overflow-y-auto border-t border-[#EEF2F7]">
                {batchGroups.map((group: MetadataBatchGroup) => {
                  const active = group.index === activeBatch.index
                  return (
                    <button
                      key={group.index}
                      type="button"
                      onClick={() => handleBatchSelectAndClose(group)}
                      className={cn(
                        "relative grid w-full grid-cols-2 gap-x-3 gap-y-1 border-b border-[#EEF2F7] px-3 py-2.5 text-left text-xs transition-colors last:border-b-0 lg:grid-cols-[minmax(8rem,1.1fr)_repeat(5,minmax(6.5rem,0.8fr))_minmax(10rem,1fr)] lg:items-center",
                        active
                          ? "bg-[#F3F7FF] text-[#0F172A] before:absolute before:top-2 before:bottom-2 before:left-0 before:w-1 before:rounded-r-full before:bg-[#0052FF]"
                          : "bg-white text-[#475569] hover:bg-[#F8FAFC]"
                      )}
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate font-semibold text-[#0F172A]">
                            {group.label}
                          </span>
                        </span>
                      </span>
                      <span className="text-[11px]">
                        <span className="text-[#64748B] lg:hidden">
                          Tài liệu:{" "}
                        </span>
                        {group.totalCount}
                      </span>
                      <span className="text-[11px]">
                        <span className="text-[#64748B] lg:hidden">
                          Đã review:{" "}
                        </span>
                        <span className="font-semibold text-[#0052FF]">
                          {group.reviewedCount}
                        </span>
                      </span>
                      <span className="text-[11px]">
                        <span className="text-[#64748B] lg:hidden">
                          Tự động:{" "}
                        </span>
                        {group.autoVerifiedCount}
                      </span>
                      <span className="text-[11px]">
                        <span className="text-[#64748B] lg:hidden">
                          Cần xác minh:{" "}
                        </span>
                        {group.warningCount}
                      </span>
                      <span className="text-[11px]">
                        <span className="text-[#64748B] lg:hidden">Lỗi: </span>
                        {group.failedCount}
                      </span>
                      <span className="truncate text-[11px]">
                        <span className="text-[#64748B] lg:hidden">
                          Phụ trách:{" "}
                        </span>
                        {metadataBatchAssigneeLabel(group)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}
      {showAutoSplitPanel && (
        <div className="flex flex-col gap-2 rounded-xl border border-[#D8E1EC] bg-white p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-[#0F172A]">
                Phân công đề xuất tự động
              </p>
              <p className="text-[11px] text-[#64748B]">
                {autoBatchPlanRequested && autoBatchPlan
                  ? `${autoBatchPlan.groups.length} lô · ${autoBatchPlan.total_count} tài liệu · ${selectedAutoWorkerCount} worker`
                  : "Số lô sẽ bằng số worker tham gia"}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="flex h-8 items-center gap-2 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] px-2 text-xs font-medium text-[#475569]">
                <Scissors className="size-3 text-[#0052FF]" />
                {selectedAutoWorkerCount} lô
              </div>
              <Button
                type="button"
                variant={autoBatchPlanRequested ? "outline" : "default"}
                size="sm"
                onClick={handleAutoPlanRequest}
                disabled={
                  autoBatchPlanLoading ||
                  workersLoading ||
                  confirmingAllAutoBatches ||
                  confirmingAutoBatchIndexes.size > 0 ||
                  selectedAutoWorkerCount === 0
                }
                className="h-8 gap-1.5 text-xs"
              >
                {autoBatchPlanLoading ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Scissors className="size-3" />
                )}
                Chia lô
              </Button>
              {autoBatchPlanRequested && autoBatchPlan?.groups.length ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleConfirmAllAutoBatches()}
                  disabled={
                    autoBatchPlanLoading ||
                    workersLoading ||
                    confirmingAllAutoBatches ||
                    !autoBatchPlan ||
                    selectedAutoWorkerCount === 0 ||
                    pendingAutoBatchCount === 0
                  }
                  className="h-8 gap-1.5 text-xs"
                >
                  {confirmingAllAutoBatches ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-3" />
                  )}
                  Xác nhận tất cả ({pendingAutoBatchCount})
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCloseAutoSplitPanel}
                disabled={
                  confirmingAllAutoBatches ||
                  confirmingAutoBatchIndexes.size > 0
                }
                className="h-8 gap-1.5 text-xs"
              >
                <X className="size-3" />
                Hủy
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-y border-[#E2E8F0] py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[#0F172A]">
                Worker nhận lô
              </p>
              <span className="text-[11px] font-medium text-[#64748B]">
                {selectedAutoWorkerCount}/{workers.length} đã chọn
              </span>
            </div>
            {workersLoading ? (
              <div className="flex items-center gap-2 py-1 text-xs text-[#64748B]">
                <Loader2 className="size-3.5 animate-spin" />
                Đang tải worker...
              </div>
            ) : workers.length > 0 ? (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-1 pr-1">
                {workers.map((worker: ChinhlyUser) => {
                  const workerId = chinhlyUserId(worker)
                  if (!workerId) return null
                  const checked = selectedAutoWorkerIds.has(workerId)
                  const existingBatch = existingBatchByWorkerId.get(workerId)
                  return (
                    <label
                      key={workerId}
                      className="flex min-w-0 items-start gap-2 rounded-md px-2 py-1.5 text-xs text-[#0F172A] hover:bg-white"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) =>
                          toggleAutoWorker(workerId, event.target.checked)
                        }
                        disabled={
                          confirmingAllAutoBatches ||
                          confirmingAutoBatchIndexes.size > 0
                        }
                        className="mt-0.5 size-3.5 shrink-0"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">
                          {chinhlyUserLabel(worker)}
                        </span>
                        <span className="block truncate text-[10px] text-[#64748B]">
                          {workerBatchStatusLabel(existingBatch)}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
            ) : (
              <p className="py-1 text-xs text-[#64748B]">
                Không có worker đang hoạt động.
              </p>
            )}
          </div>

          {autoBatchPlanRequested ? (
            autoBatchPlanLoading ? (
              <div className="flex items-center gap-2 py-3 text-xs text-[#64748B]">
                <Loader2 className="size-3.5 animate-spin" />
                Đang tạo đề xuất...
              </div>
            ) : autoBatchPlanError ? (
              <p className="py-2 text-xs text-red-600">{autoBatchPlanError}</p>
            ) : autoBatchPlan?.groups.length ? (
              <div className="max-h-[22rem] overflow-y-auto border-y border-[#E2E8F0]">
                {autoBatchPlan.groups.map(
                  (planGroup: {
                    index: number
                    display_index?: number | null
                    start: number
                    end: number
                    total_count: number
                  }) => {
                    const planDisplayIndex =
                      planGroup.display_index ?? planGroup.index + 1
                    const matchingGroup = batchGroups.find(
                      (group: MetadataBatchGroup) =>
                        group.kind === "auto" && group.start === planGroup.start
                    )
                    const confirmation = autoBatchConfirmations.get(
                      planGroup.index
                    )
                    const confirmationSkippedCount = confirmation
                      ? (confirmation.skipped_count ??
                        confirmation.skipped_documents?.length ??
                        0)
                      : 0
                    const confirming = confirmingAutoBatchIndexes.has(
                      planGroup.index
                    )
                    const assignedToUserId =
                      autoBatchAssigneeIds.get(planGroup.index) ?? ""
                    const assignedExistingBatch = assignedToUserId
                      ? (existingBatchByWorkerId.get(assignedToUserId) ?? null)
                      : null
                    return (
                      <div
                        key={planGroup.index}
                        className="grid grid-cols-1 items-center gap-2 border-b border-[#E2E8F0] py-2 last:border-b-0 sm:grid-cols-[minmax(7rem,1fr)_minmax(12rem,1.5fr)_auto]"
                      >
                        <button
                          type="button"
                          className="min-w-0 text-left"
                          onClick={() =>
                            matchingGroup && handleSelectBatch(matchingGroup)
                          }
                          disabled={!matchingGroup}
                        >
                          <span className="block text-xs font-semibold text-[#0F172A]">
                            Lô {String(planDisplayIndex).padStart(2, "0")}
                          </span>
                          <span className="block text-[10px] text-[#64748B]">
                            {planGroup.total_count} tài liệu · {planGroup.start}
                            -{planGroup.end}
                          </span>
                        </button>
                        <div className="min-w-0">
                          <label className="flex min-w-0 items-center gap-2 rounded-md border border-[#CBD5E1] bg-[#F8FAFC] px-2 py-1.5 text-xs text-[#0F172A]">
                            <UserRound className="size-3 shrink-0 text-[#0052FF]" />
                            <select
                              value={assignedToUserId}
                              onChange={(event) =>
                                handleAutoBatchAssigneeChange(
                                  planGroup.index,
                                  event.target.value
                                )
                              }
                              disabled={
                                Boolean(confirmation) ||
                                confirming ||
                                confirmingAllAutoBatches
                              }
                              className="min-w-0 flex-1 bg-transparent text-xs outline-none"
                            >
                              <option value="">Chọn worker</option>
                              {selectedAutoWorkers.map((worker: ChinhlyUser) => {
                                const workerId = chinhlyUserId(worker)
                                if (!workerId) return null
                                const existingBatch =
                                  existingBatchByWorkerId.get(workerId)
                                return (
                                  <option key={workerId} value={workerId}>
                                    {workerOptionLabel(worker, existingBatch)}
                                  </option>
                                )
                              })}
                            </select>
                          </label>
                          {assignedToUserId ? (
                            <span className="mt-1 block truncate text-[10px] text-[#64748B]">
                              {workerBatchStatusLabel(assignedExistingBatch)}
                            </span>
                          ) : null}
                        </div>
                        {confirmation ? (
                          <span
                            className={
                              confirmationSkippedCount > 0
                                ? "inline-flex h-8 items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 text-[11px] font-semibold whitespace-nowrap text-amber-700"
                                : "inline-flex h-8 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 text-[11px] font-semibold whitespace-nowrap text-emerald-700"
                            }
                          >
                            <CheckCircle2 className="size-3" />
                            {confirmationSkippedCount > 0
                              ? `${confirmation.updated_count}/${planGroup.total_count} đã gán`
                              : confirmationBatchStatusLabel(
                                  confirmation,
                                  confirmation.updated_count
                                )}
                          </span>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              void confirmAutoBatch(planGroup.index)
                            }
                            disabled={
                              confirming ||
                              confirmingAllAutoBatches ||
                              !assignedToUserId
                            }
                            className="h-8 gap-1 text-xs whitespace-nowrap"
                          >
                            {confirming ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="size-3" />
                            )}
                            Xác nhận
                          </Button>
                        )}
                      </div>
                    )
                  }
                )}
              </div>
            ) : (
              <p className="py-2 text-xs text-[#64748B]">
                Không có tài liệu cần phân lô.
              </p>
            )
          ) : null}
        </div>
      )}
    </>
  )
}

function workerOptionLabel(
  worker: ChinhlyUser,
  existingBatch: MetadataBatchGroup | null | undefined
): string {
  const label = chinhlyUserLabel(worker)
  if (!existingBatch) return label
  return `${label} - đang có ${existingBatch.totalCount} tài liệu trong ${existingBatch.label}`
}

function workerBatchStatusLabel(
  existingBatch: MetadataBatchGroup | null | undefined
): string {
  if (!existingBatch) return "Chưa có lô; xác nhận sẽ tạo lô mới"
  return `Đã có ${existingBatch.label} · ${existingBatch.totalCount} tài liệu; sẽ cộng dồn`
}

function confirmationBatchStatusLabel(
  confirmation: CreateMetadataBatchResponse,
  fallbackUpdatedCount: number
): string {
  const batchDocumentCount = Number(confirmation.batch_document_count)
  if (Number.isFinite(batchDocumentCount) && batchDocumentCount > 0) {
    return `Đã gán · lô có ${Math.floor(batchDocumentCount)} tài liệu`
  }
  return `${fallbackUpdatedCount} đã gán`
}

function metadataBatchAssigneeLabel(group: MetadataBatchGroup): string {
  if (group.kind === "unassigned" || group.kind === "reviewed") return "-"
  const assignee = String(
    group.assigneeName ?? group.assigneeEmail ?? ""
  ).trim()
  if (assignee) return assignee
  return "Chưa gán"
}

function BatchCountPill({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: number
  tone?: "default" | "reviewed" | "warning" | "error"
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-1",
        tone === "reviewed"
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : tone === "warning"
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : tone === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-[#D8E1EC] bg-white text-[#475569]"
      )}
    >
      {label}: <strong>{value}</strong>
    </span>
  )
}

function EyeIcon({ active }: { active: boolean }) {
  return active ? (
    <CheckCircle2 data-icon="inline-start" className="size-3" />
  ) : (
    <Eye data-icon="inline-start" className="size-3" />
  )
}
