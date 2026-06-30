import {
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
import {
  BatchMetric,
  MetadataBatchButton,
  ReviewModeButton,
} from "./ProcessStep.parts"
import {
  METADATA_BATCH_SIZE_OPTIONS,
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
  confirmAutoBatch: (groupIndex: number) => Promise<void>
  confirmingAllAutoBatches: boolean
  confirmingAutoBatchIndexes: Set<number>
  closingBatchIds: Set<string>
  createManualBatchFromSelection: () => Promise<void>
  creatingManualBatch: boolean
  displayedBulkSelectableItems: PdfMetadata[]
  displayedItems: PdfMetadata[]
  finishMetadataBatch: (group: MetadataBatchGroup) => Promise<void>
  handleBatchModeChange: (mode: MetadataBatchMode) => void
  handleBatchSizeInputBlur: () => void
  handleBatchSizeInputChange: (value: string) => void
  handleReviewModeChange: (mode: MetadataReviewMode) => void
  handleSelectBatch: (group: MetadataBatchGroup) => void
  handleRetrySelectedMetadata: () => Promise<void>
  handleVerifyAllReady: () => Promise<void>
  hasServerPagination: boolean
  manualSelectedIds: Set<number>
  manualSelectedOnly: boolean
  manualSelectedVisibleItems: PdfMetadata[]
  manualSplitActive: boolean
  metadataFileFilter: string
  reviewMode: MetadataReviewMode
  selectAllDisplayedForBulkReview: () => void
  selectAllDisplayedForManualSplit: () => void
  selectedAssigneeId: string
  setAutoBatchAssignee: (groupIndex: number, assignedToUserId: string) => void
  setMetadataFileFilter: (value: string) => void
  setSelectedAssigneeId: (value: string) => void
  sortedItems: PdfMetadata[]
  startManualSplit: () => void
  toggleBulkReviewSelectionMode: () => void
  toggleManualSelectedOnly: () => void
  workers: ChinhlyUser[]
  workersLoading: boolean
  batchSizeInput: string
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
    confirmAutoBatch,
    confirmingAllAutoBatches,
    confirmingAutoBatchIndexes,
    closingBatchIds,
    createManualBatchFromSelection,
    creatingManualBatch,
    displayedBulkSelectableItems,
    displayedItems,
    finishMetadataBatch,
    handleBatchModeChange,
    handleBatchSizeInputBlur,
    handleBatchSizeInputChange,
    handleReviewModeChange,
    handleSelectBatch,
    handleRetrySelectedMetadata,
    handleVerifyAllReady,
    hasServerPagination,
    manualSelectedIds,
    manualSelectedOnly,
    manualSelectedVisibleItems,
    manualSplitActive,
    metadataFileFilter,
    reviewMode,
    selectAllDisplayedForBulkReview,
    selectAllDisplayedForManualSplit,
    selectedAssigneeId,
    setMetadataFileFilter,
    setAutoBatchAssignee,
    setSelectedAssigneeId,
    startManualSplit,
    toggleBulkReviewSelectionMode,
    toggleManualSelectedOnly,
    workers,
    workersLoading,
    sortedItems,
    batchSizeInput,
  } = props
  const manualSelectionLimit = 1000
  const manualSelectedCount = manualSelectedIds.size
  const manualSelectionOverLimit = manualSelectedCount > manualSelectionLimit
  const manualSelectedVisibleCount = manualSelectedVisibleItems?.length ?? 0
  const activeBatchPageCount = activeBatch?.items.length ?? 0
  const activeBatchTotalCount = activeBatch?.totalCount ?? activeBatchPageCount
  const pageScopedBatchMode =
    hasServerPagination &&
    reviewMode === "batch" &&
    activeBatchTotalCount > activeBatchPageCount
  const pageScopeNote = pageScopedBatchMode
    ? `Đang hiển thị ${activeBatchPageCount}/${activeBatchTotalCount} tài liệu trong lô này. Chuyển trang để xem hoặc chọn tiếp.`
    : ""
  const batchMetricScopeLabel =
    activeBatch?.kind === "auto" && pageScopedBatchMode ? " (trang)" : ""
  const activeBatchDescription = activeBatch
    ? getMetadataBatchDescription(activeBatch, sortedItems.length)
    : ""
  const pendingAutoBatchCount =
    autoBatchPlan?.groups.filter(
      (group: { index: number }) => !autoBatchConfirmations.has(group.index)
    ).length ?? 0

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
                onClick={() => handleReviewModeChange("list")}
              />
              <ReviewModeButton
                active={reviewMode === "batch"}
                icon={<FolderOpen className="size-3.5" />}
                label="Theo lô"
                onClick={() => handleReviewModeChange("batch")}
              />
            </div>
            {canManageMetadataBatches && reviewMode === "batch" && (
              <div className="inline-flex rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] p-1">
                <ReviewModeButton
                  active={batchMode === "manual"}
                  label="Thủ công"
                  onClick={() => handleBatchModeChange("manual")}
                />
                <ReviewModeButton
                  active={batchMode === "auto"}
                  label="Tự động"
                  onClick={() => handleBatchModeChange("auto")}
                />
              </div>
            )}
            {canManageMetadataBatches &&
              reviewMode === "batch" &&
              batchMode === "auto" && (
                <label className="flex h-8 items-center gap-2 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] px-2 text-xs font-medium text-[#475569]">
                  Cỡ lô
                  <input
                    type="text"
                    inputMode="numeric"
                    value={batchSizeInput}
                    onChange={(event) =>
                      handleBatchSizeInputChange(event.target.value)
                    }
                    onBlur={handleBatchSizeInputBlur}
                    disabled={
                      confirmingAllAutoBatches ||
                      confirmingAutoBatchIndexes.size > 0
                    }
                    className="h-6 w-14 rounded-md border border-[#CBD5E1] bg-white px-2 text-xs text-[#0F172A] outline-none focus-visible:border-[#0052FF] focus-visible:ring-2 focus-visible:ring-[#0052FF]/20"
                    list="metadata-batch-size-options"
                  />
                  <datalist id="metadata-batch-size-options">
                    {METADATA_BATCH_SIZE_OPTIONS.map((value) => (
                      <option key={value} value={value} />
                    ))}
                  </datalist>
                </label>
              )}
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
            {reviewMode === "batch" &&
              canManageMetadataBatches &&
              batchMode === "manual" &&
              !manualSplitActive && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={startManualSplit}
                  className="h-8 gap-1.5 text-xs"
                >
                  <Scissors data-icon="inline-start" className="size-3" />
                  Chia lô
                </Button>
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
                        return (
                          <option key={id} value={id}>
                            {chinhlyUserLabel(worker)}
                          </option>
                        )
                      })}
                    </select>
                  </label>
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
                    Tạo lô mới
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
        {bulkReviewSelectionActive && !manualSplitActive && (
          <div className="rounded-lg border border-[#BFD3FF] bg-[#EFF6FF] px-3 py-2 text-xs font-medium text-[#0F172A]">
            Đã chọn {bulkSelectionCount} tài liệu để xác nhận hàng loạt. Giữ
            Shift khi chọn để chọn một dải.
          </div>
        )}
      </div>
      {reviewMode === "batch" && batchGroups.length > 0 && activeBatch && (
        <div className="flex flex-col gap-2 rounded-xl border border-[#D8E1EC] bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#0F172A]">
                {activeBatch.label}
              </p>
              <p className="text-[11px] text-[#64748B]">
                {activeBatchDescription}
              </p>
              {pageScopeNote ? (
                <p className="mt-0.5 text-[11px] font-medium text-[#475569]">
                  {pageScopeNote}
                </p>
              ) : null}
              {activeBatch.assigneeName || activeBatch.assigneeEmail ? (
                <p className="mt-0.5 text-[11px] text-[#475569]">
                  Phụ trách:{" "}
                  <span className="font-semibold text-[#0F172A]">
                    {activeBatch.assigneeName ?? activeBatch.assigneeEmail}
                  </span>
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#475569]">
              <BatchMetric
                label={`Sẵn sàng${batchMetricScopeLabel}`}
                value={activeBatch.readyCount}
              />
              <BatchMetric
                label={`Cảnh báo${batchMetricScopeLabel}`}
                value={activeBatch.warningCount}
              />
              <BatchMetric
                label={`Còn lại${batchMetricScopeLabel}`}
                value={activeBatch.pendingReadyCount}
              />
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {batchGroups.map((group: MetadataBatchGroup) => (
              <MetadataBatchButton
                key={group.index}
                group={group}
                active={group.index === activeBatch.index}
                onClick={() => handleSelectBatch(group)}
              />
            ))}
          </div>
        </div>
      )}
      {reviewMode === "batch" &&
        batchMode === "auto" &&
        canManageMetadataBatches && (
          <div className="flex flex-col gap-2 rounded-xl border border-[#D8E1EC] bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-[#0F172A]">
                  Phân công đề xuất
                </p>
                <p className="text-[11px] text-[#64748B]">
                  {autoBatchPlan
                    ? `${autoBatchPlan.groups.length} lô · ${autoBatchPlan.total_count} tài liệu`
                    : "Chưa có kế hoạch phân công"}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => void confirmAllAutoBatches()}
                disabled={
                  autoBatchPlanLoading ||
                  workersLoading ||
                  confirmingAllAutoBatches ||
                  !autoBatchPlan ||
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
            </div>

            {autoBatchPlanLoading ? (
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
                        <select
                          value={
                            autoBatchAssigneeIds.get(planGroup.index) ?? ""
                          }
                          onChange={(event) =>
                            setAutoBatchAssignee(
                              planGroup.index,
                              event.target.value
                            )
                          }
                          disabled={
                            workersLoading ||
                            confirming ||
                            Boolean(confirmation)
                          }
                          className="h-8 min-w-0 rounded-md border border-[#CBD5E1] bg-white px-2 text-xs text-[#0F172A] outline-none focus:border-[#0052FF]"
                          aria-label={`Người phụ trách lô ${planDisplayIndex}`}
                        >
                          <option value="">
                            {workersLoading
                              ? "Đang tải nhân viên..."
                              : "Chọn người phụ trách"}
                          </option>
                          {workers.map((worker: ChinhlyUser) => {
                            const workerId = chinhlyUserId(worker)
                            return (
                              <option key={workerId} value={workerId}>
                                {chinhlyUserLabel(worker)}
                              </option>
                            )
                          })}
                        </select>
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
                              : "Đã xác nhận"}
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
                              !autoBatchAssigneeIds.get(planGroup.index)
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
            )}
          </div>
        )}
    </>
  )
}

function getMetadataBatchDescription(
  group: MetadataBatchGroup,
  loadedBatchItemCount: number
) {
  if (group.kind === "manual") {
    return `${group.totalCount} tài liệu trong lô thủ công`
  }
  if (group.kind === "reviewed") {
    return `${group.totalCount} tài liệu đã review`
  }
  if (group.kind === "unassigned") {
    return `${group.totalCount} tài liệu chưa chia`
  }
  return `${group.totalCount || loadedBatchItemCount} tài liệu trong lô tự động, vị trí ${group.start}-${group.end} trong toàn bộ danh sách chưa review`
}

function EyeIcon({ active }: { active: boolean }) {
  return active ? (
    <CheckCircle2 data-icon="inline-start" className="size-3" />
  ) : (
    <Eye data-icon="inline-start" className="size-3" />
  )
}
