import {
  CheckCircle2,
  FolderOpen,
  List,
  Loader2,
  Plus,
  RefreshCw,
  Scissors,
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
  type MetadataBatchGroup,
} from "./ProcessStep.types"
import type { ChinhlyUser } from "@/features/auth/api/authApi"
import { chinhlyUserId, chinhlyUserLabel } from "./ProcessStep.batchUtils"

export function ProcessStepReviewControls(props: Record<string, any>) {
  const {
    activeBatch,
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
    manualSelectedIds,
    manualSplitActive,
    reviewMode,
    selectAllDisplayedForBulkReview,
    selectAllDisplayedForManualSplit,
    selectedAssigneeId,
    setSelectedAssigneeId,
    startManualSplit,
    toggleBulkReviewSelectionMode,
    workers,
    workersLoading,
    sortedItems,
    batchSizeInput,
  } = props

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
                {activeBatch.items.length} đã review
              </span>
            )}
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
                  Chọn tất cả
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
                    Chọn tất cả
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearManualSelection}
                    disabled={manualSelectedIds.size === 0}
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
                      manualSelectedIds.size === 0 ||
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
            <div className="rounded-lg border border-[#BFD3FF] bg-[#EFF6FF] px-3 py-2 text-xs font-medium text-[#0F172A]">
              Đã chọn {manualSelectedIds.size} tài liệu để tạo lô mới. Giữ Shift
              khi chọn để chọn một dải.
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
                {activeBatch.kind === "manual"
                  ? `${activeBatch.items.length} tài liệu trong lô thủ công`
                  : activeBatch.kind === "reviewed"
                    ? `${activeBatch.items.length} tài liệu đã review`
                    : activeBatch.kind === "unassigned"
                      ? `${activeBatch.items.length} tài liệu chưa chia`
                      : `Tài liệu ${activeBatch.start}-${activeBatch.end} / ${sortedItems.length}`}
              </p>
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
              <BatchMetric label="Sẵn sàng" value={activeBatch.readyCount} />
              <BatchMetric label="Cảnh báo" value={activeBatch.warningCount} />
              <BatchMetric
                label="Còn lại"
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
    </>
  )
}
