import type { CSSProperties } from "react"
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/shared/lib/utils"
import { DocumentPdfPreview } from "@/features/upload/components/DocumentPdfPreview"
import { ProgressTimeline } from "@/features/upload/components/ProgressTimeline"
import { Metric } from "./FinalResult.documentRow"
import { FinalResultFeedbackPanel } from "./FinalResult.feedbackPanel"
import { ClusterGroupInformationPanel } from "./FinalResult.groupInfoPanel"
import { DossierMetadataSidePanel } from "./FinalResult.sidePanel"
import { DossierSuggestionsModal } from "./DossierSuggestionsModal"
import { ResultNode } from "./FinalResult.resultNode"
import {
  CLUSTER_PROGRESS_PHASES,
  clusterVersionSourceLabel,
  clusterVersionOptionLabel,
} from "./FinalResult.progress"

export function FinalResultView(props: Record<string, any>) {
  const {
    activeClusterVersionId,
    activeResultTreeSearchNodeId,
    canRestoreFileRegisterVersion,
    cancelingPendingFeedback,
    checkingClusters,
    clusterCompletedPhases,
    clusterJobMode,
    clusterProgressMessage,
    clusterProgressPhase,
    clusterVersionNavigationBusy,
    displayedClusterVersion,
    displayedClusterVersionId,
    draggedDocument,
    dropTargetId,
    handleActivateDisplayedClusterVersion,
    handleApplyPendingClusterVersion,
    handleCancelPendingFeedback,
    handleCreateDossierFromSelection,
    handleCreateDossierFromSuggestions,
    handleDropOnDossier,
    handleFinish,
    handleMoveSelectionToDossier,
    handlePreviewResizePointerDown,
    handlePromoteTemporaryFolder,
    handleRebuildClusters,
    handleRestorePreviousClusterVersion,
    handleResultTreeDragOver,
    handleSaveDossierMetadata,
    handleSaveDocumentMetadata,
    handleSelectDossierMetadata,
    handleSelectDossierSuggestions,
    handleSelectDossierSuggestionsFromSelection,
    handleSelectGroupInformation,
    handleSelectPreviewDocument,
    handleToggleDocumentSelection,
    handleToggleGroupSelection,
    handleViewClusterVersion,
    groupInformationError,
    groupInformationLoading,
    groupInformationTable,
    handleCloseGroupInformation,
    handleCloseDossierSuggestions,
    handleRefreshDossierSuggestions,
    handleMoveDossierSuggestion,
    handleSelectGroupInfoDossier,
    handleSelectGroupInfoDocument,
    handleSelectRetentionCandidate,
    loading,
    loadingClusterVersionId,
    movingSelectedDocumentsTargetId,
    nextDisplayVersion,
    openNodeIds,
    pendingClusterDocumentCount,
    pendingClusterVersion,
    pendingDossierCount,
    pendingFeedbackCount,
    previewDocument,
    selectedDossierSuggestionsDocuments,
    selectedDossierSuggestionCandidates,
    dossierSuggestionRepresentativeDocuments,
    dossierSuggestionDossiers,
    selectedDossierSuggestionsDocumentId,
    dossierSuggestionsLoading,
    dossierSuggestionsRefreshing,
    dossierSuggestionsError,
    previewLayoutRef,
    previewWidthPercent,
    previousDisplayVersion,
    promotingSelectedDocuments,
    promotingTemporaryFolder,
    rebuildBaselineVersionId,
    rebuildSubmitting,
    resultStatusText,
    resultTreeSearch,
    resultTreeSearchIndex,
    resultTreeScrollRef,
    resultTreeSearchTotal,
    restoringClusterVersion,
    savingDossierMetadataId,
    selectedDocumentCount,
    selectedDocumentsActionDisabled,
    selectedGroupInfoNode,
    selectedGroupInfoNodeId,
    selectedMetadataGroup,
    selectedMetadataGroupId,
    selectedPreviewDocumentId,
    selectedSessionDocumentIds,
    sessionId,
    setDraggedDocument,
    setDropTargetId,
    setResultTreeSearch,
    setSelectedMetadataGroupId,
    setSelectedPreviewDocumentId,
    showClusterProgress,
    sidePreviewOpen,
    sortedClusterVersions,
    stopResultTreeAutoScroll,
    temporaryFolderUpdateDisabled,
    totalDossiers,
    totalFiles,
    totalPages,
    tree,
    toggleNode,
    updatingClusterVersion,
    viewingHistoricalClusterVersion,
    onResultTreeSearchNavigate,
  } = props
  const previewColumns = selectedGroupInfoNode
    ? "minmax(340px,0.34fr) minmax(760px,0.66fr)"
    : `minmax(0, ${100 - previewWidthPercent}fr) minmax(460px, ${previewWidthPercent}fr)`

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="font-sans text-2xl font-semibold tracking-normal text-[#0F172A]">
            Kết quả
          </h2>
          <p className="mt-1 text-sm text-[#475569]">
            Tài liệu đã được gắn vào phông lưu trữ. Các hồ sơ có thể được điều
            chỉnh bằng kéo thả.
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm text-[#475569]">
            {loading || checkingClusters ? (
              <Loader2 className="size-4 animate-spin text-[#0052FF]" />
            ) : (
              <CheckCircle2 className="size-4 text-emerald-600" />
            )}
            {resultStatusText}
          </p>
        </div>
        <div className="ml-auto grid w-full max-w-[22rem] shrink-0 grid-cols-3 justify-end gap-2 sm:w-auto">
          <Metric label="Hồ sơ" value={totalDossiers} />
          <Metric label="Tài liệu" value={totalFiles} />
          <Metric label="Trang" value={totalPages} />
        </div>
      </div>

      {sortedClusterVersions.length > 0 && displayedClusterVersion && (
        <div className="flex flex-col gap-3 rounded-2xl border border-[#D8E1EC] bg-white px-4 py-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#0F172A]">
              Phiên bản hồ sơ
            </p>
            <p className="mt-1 text-xs text-[#64748B]">
              Đang xem phiên bản {displayedClusterVersion.version_number}
              {displayedClusterVersion.id === activeClusterVersionId
                ? " · đang dùng"
                : " · chỉ xem"}
              {" · "}
              {clusterVersionSourceLabel(displayedClusterVersion.source)}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                previousDisplayVersion &&
                void handleViewClusterVersion(previousDisplayVersion.id)
              }
              disabled={!previousDisplayVersion || clusterVersionNavigationBusy}
              className="h-9 gap-1.5"
            >
              {loadingClusterVersionId === previousDisplayVersion?.id ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <ChevronLeft data-icon="inline-start" />
              )}
              Lùi
            </Button>
            <select
              value={displayedClusterVersionId ?? ""}
              onChange={(event) =>
                void handleViewClusterVersion(event.target.value)
              }
              disabled={clusterVersionNavigationBusy}
              className="h-9 min-w-[15rem] rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm text-[#0F172A] transition-colors outline-none focus-visible:border-[#0052FF] focus-visible:ring-3 focus-visible:ring-[#0052FF]/20"
            >
              {[...sortedClusterVersions].reverse().map((version) => (
                <option key={version.id} value={version.id}>
                  {clusterVersionOptionLabel(version, activeClusterVersionId)}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                nextDisplayVersion &&
                void handleViewClusterVersion(nextDisplayVersion.id)
              }
              disabled={!nextDisplayVersion || clusterVersionNavigationBusy}
              className="h-9 gap-1.5"
            >
              {loadingClusterVersionId === nextDisplayVersion?.id ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <ChevronRight data-icon="inline-start" />
              )}
              Tiến
            </Button>
            {viewingHistoricalClusterVersion && (
              <Button
                size="sm"
                onClick={() => void handleActivateDisplayedClusterVersion()}
                disabled={
                  clusterVersionNavigationBusy || Boolean(pendingClusterVersion)
                }
                className="h-9"
              >
                {restoringClusterVersion ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                ) : (
                  <Check data-icon="inline-start" />
                )}
                Đặt làm đang dùng
              </Button>
            )}
          </div>
        </div>
      )}

      {showClusterProgress && (
        <ProgressTimeline
          phases={CLUSTER_PROGRESS_PHASES}
          activePhase={clusterProgressPhase}
          completedPhases={clusterCompletedPhases}
          title={
            clusterJobMode === "plan_reanalysis"
              ? "Tiến độ lập lại hồ sơ"
              : clusterJobMode === "file_register"
                ? "Tiến độ lập hồ sơ theo tập lưu"
                : clusterJobMode === "update"
                  ? "Tiến độ cập nhật hồ sơ"
                  : "Tiến độ lập hồ sơ"
          }
          message={
            clusterProgressMessage ||
            "Backend đang lập hồ sơ từ các tài liệu đã xác nhận."
          }
        />
      )}

      {updatingClusterVersion && !pendingClusterVersion && (
        <div className="flex flex-col gap-3 rounded-2xl border border-[#BFD3FF] bg-[#F8FAFF] px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#0F172A]">
              Đang cập nhật hồ sơ
            </p>
            {clusterJobMode === "plan_reanalysis" ? (
              <p className="mt-1 text-sm text-[#475569]">
                Backend đang lập lại hồ sơ và phân loại theo phương án chỉnh lý
                cùng thời hạn bảo quản mới. Nút áp dụng sẽ bật khi phiên bản mới
                sẵn sàng.
              </p>
            ) : clusterJobMode === "file_register" ? (
              <p className="mt-1 text-sm text-[#475569]">
                Backend đang bỏ qua cách lập hồ sơ của phương án hiện tại và sắp
                xếp tài liệu theo dạng tập lưu. Nút áp dụng sẽ bật khi phiên bản
                mới sẵn sàng.
              </p>
            ) : (
              <p className="mt-1 text-sm text-[#475569]">
                Backend đang tạo phiên bản hồ sơ mới từ feedback đã lưu. Nút áp
                dụng sẽ bật khi phiên bản mới sẵn sàng.
              </p>
            )}
          </div>
          <Button disabled>
            <Loader2 data-icon="inline-start" className="animate-spin" />
            Đang cập nhật
          </Button>
        </div>
      )}

      {pendingClusterVersion && (
        <div className="flex flex-col gap-3 rounded-2xl border border-[#BFD3FF] bg-[#F8FAFF] px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#0F172A]">
              Đã có cập nhật hồ sơ mới
            </p>
            <p className="mt-1 text-sm text-[#475569]">
              Phiên bản {pendingClusterVersion.version_number} có{" "}
              {pendingDossierCount} hồ sơ và {pendingClusterDocumentCount} tài
              liệu. Bấm áp dụng để chuyển giao diện sang phiên bản mới.
            </p>
          </div>
          <Button onClick={handleApplyPendingClusterVersion}>
            <RefreshCw data-icon="inline-start" />
            Áp dụng phiên bản mới
          </Button>
        </div>
      )}

      <div
        ref={previewLayoutRef}
        className={cn(
          "grid min-w-0 gap-4",
          sidePreviewOpen &&
            "xl:[grid-template-columns:var(--result-preview-columns)]"
        )}
        style={
          sidePreviewOpen
            ? ({
                "--result-preview-columns": previewColumns,
              } as CSSProperties)
            : undefined
        }
      >
        <div className="min-w-0 overflow-hidden rounded-2xl border border-[#D8E1EC] bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-[#E2E8F0] bg-[#F8FAFC] p-3 sm:flex-row sm:items-center">
            <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-3 transition-colors focus-within:border-[#0052FF] focus-within:ring-2 focus-within:ring-[#0052FF]/15">
              <Search className="size-4 shrink-0 text-[#94A3B8]" />
              <input
                value={resultTreeSearch}
                onChange={(event) => setResultTreeSearch(event.target.value)}
                placeholder="Tìm hồ sơ trong cây"
                className="min-w-0 flex-1 bg-transparent text-sm text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
              />
              {resultTreeSearch ? (
                <button
                  type="button"
                  onClick={() => setResultTreeSearch("")}
                  title="Xóa tìm kiếm"
                  aria-label="Xóa tìm kiếm"
                  className="flex size-6 shrink-0 items-center justify-center rounded-md text-[#64748B] hover:bg-[#F1F5F9]"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </label>
            <div className="flex items-center justify-end gap-1.5">
              <span className="min-w-16 text-right text-xs font-medium text-[#64748B]">
                {resultTreeSearch
                  ? resultTreeSearchTotal > 0
                    ? `${resultTreeSearchIndex + 1}/${resultTreeSearchTotal}`
                    : "0/0"
                  : ""}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                title="Kết quả trước"
                disabled={resultTreeSearchTotal === 0}
                onClick={() => onResultTreeSearchNavigate(-1)}
              >
                <ChevronUp className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                title="Kết quả tiếp theo"
                disabled={resultTreeSearchTotal === 0}
                onClick={() => onResultTreeSearchNavigate(1)}
              >
                <ChevronRight className="size-3.5 rotate-90" />
              </Button>
            </div>
          </div>
          <div
            ref={resultTreeScrollRef}
            onDragOver={handleResultTreeDragOver}
            className="h-[min(70svh,560px)] min-h-[360px] min-w-0 overflow-x-hidden overflow-y-auto p-2 pr-3 sm:p-3 sm:pr-4"
          >
            <div className="flex w-full max-w-full min-w-0 flex-col gap-1 overflow-hidden pr-2 pb-2">
              {tree.map((node: any) => (
                <ResultNode
                  key={node.id}
                  node={node}
                  depth={0}
                  openNodeIds={openNodeIds}
                  draggedDocument={draggedDocument}
                  dropTargetId={dropTargetId}
                  compact={sidePreviewOpen}
                  selectedPreviewDocumentId={selectedPreviewDocumentId}
                  selectedDossierSuggestionsDocumentId={
                    selectedDossierSuggestionsDocumentId
                  }
                  selectedGroupInfoNodeId={selectedGroupInfoNodeId}
                  selectedMetadataGroupId={selectedMetadataGroupId}
                  selectedSessionDocumentIds={selectedSessionDocumentIds}
                  selectedDocumentCount={selectedDocumentCount}
                  selectedDocumentsActionDisabled={
                    selectedDocumentsActionDisabled
                  }
                  activeFindNodeId={activeResultTreeSearchNodeId}
                  movingSelectedDocumentsTargetId={
                    movingSelectedDocumentsTargetId
                  }
                  promotingTemporaryFolder={promotingTemporaryFolder}
                  temporaryFolderUpdateDisabled={temporaryFolderUpdateDisabled}
                  onToggle={toggleNode}
                  onToggleDocumentSelection={handleToggleDocumentSelection}
                  onToggleGroupSelection={handleToggleGroupSelection}
                  onMoveSelectionToDossier={handleMoveSelectionToDossier}
                  onDragStart={(document, fromClusterId) => {
                    if (viewingHistoricalClusterVersion) {
                      toast.error(
                        "Bạn đang xem phiên bản cũ. Hãy kích hoạt phiên bản này trước khi kéo thả tài liệu."
                      )
                      return
                    }
                    setDraggedDocument({ document, fromClusterId })
                  }}
                  onDragEnd={() => {
                    stopResultTreeAutoScroll()
                    setDraggedDocument(null)
                    setDropTargetId(null)
                  }}
                  onDragEnter={setDropTargetId}
                  onDropOnDossier={handleDropOnDossier}
                  onSelectGroupInformation={handleSelectGroupInformation}
                  onSelectPreview={handleSelectPreviewDocument}
                  onSelectDossierSuggestions={handleSelectDossierSuggestions}
                  onSelectDossierMetadata={handleSelectDossierMetadata}
                  onSaveDocumentMetadata={handleSaveDocumentMetadata}
                  onPromoteTemporaryFolder={handlePromoteTemporaryFolder}
                />
              ))}
              {tree.length === 0 && (
                <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-8 text-center text-sm text-muted-foreground">
                  {checkingClusters
                    ? "Đang kiểm tra kết quả lập hồ sơ từ backend."
                    : loading
                      ? "Đang chờ kết quả lập hồ sơ từ backend."
                      : "Chưa có kết quả lập hồ sơ từ backend."}
                </div>
              )}
            </div>
          </div>
        </div>
        {sidePreviewOpen && (
          <div className="relative min-w-0">
            <button
              type="button"
              aria-label="Kéo để đổi kích thước khung xem"
              title="Kéo để đổi kích thước khung xem"
              onPointerDown={handlePreviewResizePointerDown}
              className="group absolute top-0 bottom-0 -left-3 z-20 hidden w-5 cursor-col-resize items-center justify-center xl:flex"
            >
              <span className="h-16 w-1 rounded-full bg-[#0052FF] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
            </button>
            {previewDocument ? (
              <DocumentPdfPreview
                sessionId={sessionId}
                document={previewDocument}
                presentation="dossier_review"
                className="h-[min(70svh,560px)] min-h-[420px] min-w-0"
                onClose={() => setSelectedPreviewDocumentId(null)}
              />
            ) : selectedMetadataGroup ? (
              <DossierMetadataSidePanel
                sessionId={sessionId}
                group={selectedMetadataGroup}
                saving={
                  savingDossierMetadataId ===
                  (selectedMetadataGroup.dossierId ?? selectedMetadataGroup.id)
                }
                className="h-[calc(min(70svh,560px)+65px)] min-h-[425px] min-w-0"
                onSave={handleSaveDossierMetadata}
                onSelectRetentionCandidate={handleSelectRetentionCandidate}
                onClose={() => setSelectedMetadataGroupId(null)}
              />
            ) : selectedGroupInfoNode ? (
              <ClusterGroupInformationPanel
                table={groupInformationTable}
                groupLabel={selectedGroupInfoNode.label}
                loading={groupInformationLoading}
                error={groupInformationError}
                className="h-[calc(min(70svh,560px)+65px)] min-h-[425px] max-w-full min-w-0"
                sessionId={sessionId}
                onClose={handleCloseGroupInformation}
                onSelectDossier={handleSelectGroupInfoDossier}
                onSelectDocument={handleSelectGroupInfoDocument}
                onSelectRetentionCandidate={handleSelectRetentionCandidate}
                retentionSelectionDisabled={viewingHistoricalClusterVersion}
              />
            ) : null}
          </div>
        )}
      </div>
      {selectedDossierSuggestionsDocuments.length > 0 && (
        <DossierSuggestionsModal
          key={selectedDossierSuggestionsDocuments
            .map(
              (document: { sessionDocumentId: string | number }) =>
                document.sessionDocumentId
            )
            .join(":")}
          documents={selectedDossierSuggestionsDocuments}
          suggestions={selectedDossierSuggestionCandidates}
          dossiers={dossierSuggestionDossiers}
          representativeDocuments={dossierSuggestionRepresentativeDocuments}
          loading={dossierSuggestionsLoading}
          refreshing={dossierSuggestionsRefreshing}
          creatingDossier={promotingSelectedDocuments}
          moveDisabled={temporaryFolderUpdateDisabled}
          error={dossierSuggestionsError}
          onClose={handleCloseDossierSuggestions}
          onRefresh={handleRefreshDossierSuggestions}
          onCreateDossier={handleCreateDossierFromSuggestions}
          onMoveToDossier={handleMoveDossierSuggestion}
        />
      )}
      <FinalResultFeedbackPanel
        canRestoreFileRegisterVersion={canRestoreFileRegisterVersion}
        cancelingPendingFeedback={cancelingPendingFeedback}
        clusterJobMode={clusterJobMode}
        handleCancelPendingFeedback={handleCancelPendingFeedback}
        handleCreateDossierFromSelection={handleCreateDossierFromSelection}
        handleSelectDossierSuggestionsFromSelection={
          handleSelectDossierSuggestionsFromSelection
        }
        handleFinish={handleFinish}
        handleRebuildClusters={handleRebuildClusters}
        handleRestorePreviousClusterVersion={
          handleRestorePreviousClusterVersion
        }
        loading={loading}
        movingSelectedDocumentsTargetId={movingSelectedDocumentsTargetId}
        pendingClusterVersion={pendingClusterVersion}
        pendingFeedbackCount={pendingFeedbackCount}
        promotingSelectedDocuments={promotingSelectedDocuments}
        promotingTemporaryFolder={promotingTemporaryFolder}
        rebuildBaselineVersionId={rebuildBaselineVersionId}
        rebuildSubmitting={rebuildSubmitting}
        restoringClusterVersion={restoringClusterVersion}
        selectedDocumentCount={selectedDocumentCount}
        selectedDocumentsActionDisabled={selectedDocumentsActionDisabled}
        sessionId={sessionId}
        totalDossiers={totalDossiers}
        totalFiles={totalFiles}
        viewingHistoricalClusterVersion={viewingHistoricalClusterVersion}
      />
    </motion.div>
  )
}
