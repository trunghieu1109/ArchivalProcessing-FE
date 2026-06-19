import { type CSSProperties } from "react"
import { Download, FileArchive, Loader2 } from "lucide-react"
import { motion } from "framer-motion"
import {
  ProcessStepFooter,
  ProcessStepSummaryPanel,
} from "./ProcessStep.viewParts"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { DocumentPdfPreview } from "@/features/upload/components/DocumentPdfPreview"
import { DocumentDownloadDialog } from "./DocumentDownloadDialog"
import { MetadataCard } from "./MetadataCard"
import { ProcessStepReviewControls } from "./ProcessStep.reviewControls"
import { MAX_LOADING_PLACEHOLDERS } from "./ProcessStep.types"
import { isMetadataConfirmable } from "./ProcessStep.metadataUtils"
import { canUserEditMetadataItem } from "./ProcessStep.batchUtils"
import type { ClusterGroup } from "@/features/upload/lib/clusterGroups"
import type { createProcessStepActions } from "./ProcessStep.actions"
import type { useProcessStepModel } from "./useProcessStepModel"

type ProcessStepViewProps = ReturnType<typeof useProcessStepModel> &
  ReturnType<typeof createProcessStepActions> & {
    metadataTotal: number
    metadataLoading: boolean
    metadataReloading: boolean
    metadataMessage: string
    hasDataInput: boolean
    buildBlockedMessage: string
    signatureStatus: {
      extracted: number
      pending: number
      failed: number
    }
    sessionId: string | null
    onContinue: (groups: ClusterGroup[]) => void
  }

export function ProcessStepView(props: ProcessStepViewProps) {
  const {
    activeBatch,
    batchGroups,
    batchMode,
    batchSizeInput,
    bulkReviewSelectionActive,
    bulkSelectedIds,
    bulkSelectionCount,
    bulkVerifyItems,
    bulkVerifying,
    canBulkSelectMetadata,
    canExportMetadataReview,
    canManageMetadataBatches,
    cancelManualSplit,
    clearBulkReviewSelection,
    clearManualSelection,
    closingBatchIds,
    createManualBatchFromSelection,
    creatingManualBatch,
    currentUserIdentity,
    displayedConfirmableItems,
    displayedItems,
    dossierReadyItems,
    exportingMetadataReview,
    failedMetadataItems,
    finishMetadataBatch,
    handleApply,
    handleBatchModeChange,
    handleBatchSizeInputBlur,
    handleBatchSizeInputChange,
    handleExportMetadataReview,
    handlePreviewResizePointerDown,
    handleRetryMetadata,
    handleReviewModeChange,
    handleSelectBatch,
    handleVerifyAllReady,
    isCoordinator,
    items,
    manualSelectedIds,
    manualSplitActive,
    metadataLoading,
    metadataMessage,
    metadataReloading,
    hasDataInput,
    buildBlockedMessage,
    metadataTotal,
    needsReviewItems,
    onContinue,
    paths,
    pendingExtractionItems,
    pendingReadyItems,
    previewDocument,
    previewLayoutRef,
    previewWidthPercent,
    readyItems,
    retryingIds,
    reviewMode,
    reviewedItems,
    selectAllDisplayedForBulkReview,
    selectAllDisplayedForManualSplit,
    selectedAssigneeId,
    selectedDocumentId,
    sessionId,
    setSelectedAssigneeId,
    setSelectedDocumentId,
    signatureStatus,
    sortedItems,
    startManualSplit,
    toggleBulkReviewSelection,
    toggleBulkReviewSelectionMode,
    toggleManualSelection,
    verifyingIds,
    workers,
    workersLoading,
    autoVerifiedItems,
  } = props

  const warningCount = needsReviewItems.length
  const rawExpectedCount = Math.max(metadataTotal, paths.length, items.length)
  const metadataStartingWithoutCount =
    (metadataLoading || metadataReloading) && rawExpectedCount === 0
  const expectedCount = metadataStartingWithoutCount ? 1 : rawExpectedCount
  const pendingMetadataCount = Math.max(
    pendingExtractionItems.length,
    metadataStartingWithoutCount
      ? 1
      : expectedCount - readyItems.length - failedMetadataItems.length
  )
  const metadataInProgress = metadataLoading || pendingMetadataCount > 0
  const loadingPlaceholderCount = Math.max(
    metadataInProgress && items.length === 0 ? 1 : 0,
    Math.max(expectedCount - items.length, 0)
  )
  const visibleLoadingPlaceholderCount = Math.min(
    loadingPlaceholderCount,
    MAX_LOADING_PLACEHOLDERS
  )
  const readyPercent =
    expectedCount > 0
      ? Math.min(100, (readyItems.length / expectedCount) * 100)
      : 0
  const reviewedPercent =
    expectedCount > 0
      ? Math.min(100, (reviewedItems.length / expectedCount) * 100)
      : 0
  const canAttemptContinue = isCoordinator && dossierReadyItems.length > 0
  const canContinue = canAttemptContinue && !buildBlockedMessage

  if (!hasDataInput) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white px-6 py-10 text-center shadow-sm"
      >
        <FileArchive className="mx-auto size-10 text-[#94A3B8]" />
        <h2 className="mt-3 text-xl font-semibold text-[#0F172A]">
          Chưa có file data nào cả
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#64748B]">
          Hãy upload file data ZIP ở Step 1 để hệ thống extract metadata.
        </p>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-4"
    >
      <ProcessStepSummaryPanel
        warningCount={warningCount}
        pendingMetadataCount={pendingMetadataCount}
        metadataReloading={metadataReloading}
        readyItems={readyItems}
        expectedCount={expectedCount}
        needsReviewItems={needsReviewItems}
        autoVerifiedItems={autoVerifiedItems}
        reviewedItems={reviewedItems}
        metadataMessage={metadataMessage}
        signatureStatus={signatureStatus}
        readyPercent={readyPercent}
        reviewedPercent={reviewedPercent}
        metadataStartingWithoutCount={metadataStartingWithoutCount}
      />

      <div
        ref={previewLayoutRef}
        className="grid min-w-0 gap-4 xl:[grid-template-columns:var(--process-preview-columns)]"
        style={
          {
            "--process-preview-columns": `minmax(0, ${
              100 - previewWidthPercent
            }fr) minmax(360px, ${previewWidthPercent}fr)`,
          } as CSSProperties
        }
      >
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <span className="font-roboto text-[11px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">
              Metadata tài liệu
            </span>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {metadataInProgress && (
                <span className="flex items-center gap-1.5 text-xs text-[#64748B]">
                  <Loader2 className="size-3 animate-spin text-[#0052FF]" />
                  {metadataReloading ? "Đang extract lại" : "Đã extract"}{" "}
                  {readyItems.length}/{expectedCount || "..."}
                </span>
              )}
              {canExportMetadataReview && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleExportMetadataReview()}
                  disabled={!sessionId || exportingMetadataReview}
                  className="h-8 gap-1.5 text-xs"
                >
                  {exportingMetadataReview ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Download className="size-3" />
                  )}
                  Xuất metadata review
                </Button>
              )}
              <DocumentDownloadDialog sessionId={sessionId} items={items} />
            </div>
          </div>
          <ProcessStepReviewControls
            activeBatch={activeBatch}
            batchGroups={batchGroups}
            batchMode={batchMode}
            bulkReviewSelectionActive={bulkReviewSelectionActive}
            bulkSelectionCount={bulkSelectionCount}
            bulkVerifyItems={bulkVerifyItems}
            bulkVerifying={bulkVerifying}
            canBulkSelectMetadata={canBulkSelectMetadata}
            canExportMetadataReview={canExportMetadataReview}
            canManageMetadataBatches={canManageMetadataBatches}
            cancelManualSplit={cancelManualSplit}
            clearBulkReviewSelection={clearBulkReviewSelection}
            clearManualSelection={clearManualSelection}
            closingBatchIds={closingBatchIds}
            createManualBatchFromSelection={createManualBatchFromSelection}
            creatingManualBatch={creatingManualBatch}
            displayedConfirmableItems={displayedConfirmableItems}
            displayedItems={displayedItems}
            exportingMetadataReview={exportingMetadataReview}
            finishMetadataBatch={finishMetadataBatch}
            handleBatchModeChange={handleBatchModeChange}
            handleBatchSizeInputBlur={handleBatchSizeInputBlur}
            handleBatchSizeInputChange={handleBatchSizeInputChange}
            handleExportMetadataReview={handleExportMetadataReview}
            handleReviewModeChange={handleReviewModeChange}
            handleSelectBatch={handleSelectBatch}
            handleVerifyAllReady={handleVerifyAllReady}
            manualSelectedIds={manualSelectedIds}
            manualSplitActive={manualSplitActive}
            metadataInProgress={metadataInProgress}
            metadataReloading={metadataReloading}
            readyItems={readyItems}
            expectedCount={expectedCount}
            reviewMode={reviewMode}
            selectAllDisplayedForBulkReview={selectAllDisplayedForBulkReview}
            selectAllDisplayedForManualSplit={selectAllDisplayedForManualSplit}
            selectedAssigneeId={selectedAssigneeId}
            sessionId={sessionId}
            setSelectedAssigneeId={setSelectedAssigneeId}
            startManualSplit={startManualSplit}
            toggleBulkReviewSelectionMode={toggleBulkReviewSelectionMode}
            workers={workers}
            workersLoading={workersLoading}
            sortedItems={sortedItems}
            batchSizeInput={batchSizeInput}
          />
          <ScrollArea className="h-[min(70svh,640px)] min-h-[360px]">
            <div className="flex flex-col gap-2 pr-1">
              {displayedItems.map((item) => {
                const canEditItem = canUserEditMetadataItem(
                  item,
                  currentUserIdentity
                )
                const bulkSelectionDisabled =
                  bulkReviewSelectionActive &&
                  (!isMetadataConfirmable(item) || !canEditItem)
                return (
                  <MetadataCard
                    key={item.id}
                    item={item}
                    selected={item.id === selectedDocumentId}
                    selectionMode={
                      manualSplitActive || bulkReviewSelectionActive
                    }
                    selectionChecked={
                      manualSplitActive
                        ? manualSelectedIds.has(item.id)
                        : bulkSelectedIds.has(item.id)
                    }
                    selectionDisabled={bulkSelectionDisabled}
                    readOnly={!canEditItem}
                    onSelectionChange={(checked, shiftKey) =>
                      manualSplitActive
                        ? toggleManualSelection(item, checked, shiftKey)
                        : toggleBulkReviewSelection(item, checked, shiftKey)
                    }
                    submitting={verifyingIds.has(item.id)}
                    retrying={retryingIds.has(item.id)}
                    onSelect={(expanded) =>
                      setSelectedDocumentId((current) =>
                        expanded
                          ? item.id
                          : current === item.id
                            ? null
                            : current
                      )
                    }
                    onApply={handleApply}
                    onRetry={
                      canEditItem
                        ? () => void handleRetryMetadata(item)
                        : undefined
                    }
                  />
                )
              })}
              {Array.from({ length: visibleLoadingPlaceholderCount }).map(
                (_, i) => (
                  <div
                    key={`skel-${i}`}
                    className="h-14 animate-pulse rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]"
                  />
                )
              )}
              {manualSplitActive && displayedItems.length === 0 && (
                <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-white p-6 text-center text-sm text-muted-foreground">
                  Không còn tài liệu chưa chia.
                </div>
              )}
              {!manualSplitActive &&
                !metadataInProgress &&
                displayedItems.length === 0 &&
                items.length > 0 && (
                  <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-white p-6 text-center text-sm text-muted-foreground">
                    Không có tài liệu trong phạm vi này.
                  </div>
                )}
              {!metadataInProgress && items.length === 0 && (
                <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-white p-6 text-center text-sm text-muted-foreground">
                  Chưa có metadata từ backend.
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
        <div className="relative min-w-0 self-stretch xl:h-full">
          <button
            type="button"
            aria-label="Kéo để đổi kích thước preview"
            title="Kéo để đổi kích thước preview"
            onPointerDown={handlePreviewResizePointerDown}
            className="group absolute top-0 bottom-0 -left-3 z-20 hidden w-5 cursor-col-resize items-center justify-center xl:flex"
          >
            <span className="h-16 w-1 rounded-full bg-[#0052FF] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
          </button>
          <DocumentPdfPreview
            sessionId={sessionId}
            document={previewDocument}
            className="h-[min(72svh,678px)] min-h-[420px] min-w-0 xl:h-full xl:min-h-0"
          />
        </div>
      </div>

      <ProcessStepFooter
        pendingReadyItems={pendingReadyItems}
        dossierReadyItems={dossierReadyItems}
        readyItems={readyItems}
        metadataMessage={metadataMessage}
        canContinue={canContinue}
        canAttemptContinue={canAttemptContinue}
        buildBlockedMessage={buildBlockedMessage}
        onContinue={onContinue}
      />
    </motion.div>
  )
}
