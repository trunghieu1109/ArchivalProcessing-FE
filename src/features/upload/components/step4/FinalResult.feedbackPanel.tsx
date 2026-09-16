import {
  Archive,
  ArrowRightLeft,
  CheckCircle2,
  CircleX,
  FolderPlus,
  ListChecks,
  Loader2,
  RefreshCw,
  Trash2,
  Undo2,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { WorkflowActionPanel } from "@/features/upload/components/WorkflowActionPanel"
import {
  resolveFinalResultActionState,
  type FinalResultActionState,
} from "./FinalResult.actionState"
import { SHOW_DOSSIER_SUGGESTIONS } from "./temporaryFeatureVisibility"

interface FinalResultFeedbackPanelProps {
  canDeleteDocuments: boolean
  canTransferDocuments: boolean
  canRestoreFileRegisterVersion: boolean
  cancelingPendingFeedback: boolean
  clusterJobMode: string
  clusterActionState?: FinalResultActionState
  clusterVersionStale: boolean
  deleteSelectedDocumentsDisabled: boolean
  transferSelectedDocumentsDisabled: boolean
  handleCancelPendingFeedback: () => Promise<unknown> | void
  handleCreateDossierFromSelection: () => Promise<boolean>
  handleDeleteSelectedDocuments: () => void
  handleTransferSelectedDocuments: () => void
  handleFinish: () => void
  hasUsableActiveClusterVersion: boolean
  handleRebuildClusters: (strategy?: string) => Promise<unknown> | void
  handleRestorePreviousClusterVersion: () => Promise<unknown> | void
  handleSelectDossierSuggestionsFromSelection: () => void
  loading: boolean
  movingSelectedDocumentsTargetId: string | null
  pendingClusterVersion: unknown | null
  pendingClusterVersionNeedsRefresh?: boolean
  pendingFeedbackCount: number
  supplementalPendingDocumentCount?: number
  supplementalPendingUpdateDocumentCount?: number
  supplementalVerificationPendingCount?: number
  promotingSelectedDocuments: boolean
  promotingTemporaryFolder: boolean
  rebuildBaselineVersionId: string | null
  rebuildSubmitting: boolean
  restoringClusterVersion: boolean
  selectedDocumentCount: number
  selectedDocumentsActionDisabled: boolean
  sourceHasActiveClusterVersion: boolean
  sessionId: string | null
  totalDossiers: number
  totalFiles: number
  viewingHistoricalClusterVersion: boolean
}

export function FinalResultFeedbackPanel(props: FinalResultFeedbackPanelProps) {
  const {
    canDeleteDocuments,
    canTransferDocuments,
    canRestoreFileRegisterVersion,
    cancelingPendingFeedback,
    clusterJobMode,
    clusterActionState,
    clusterVersionStale,
    deleteSelectedDocumentsDisabled,
    transferSelectedDocumentsDisabled,
    handleCancelPendingFeedback,
    handleCreateDossierFromSelection,
    handleDeleteSelectedDocuments,
    handleTransferSelectedDocuments,
    handleSelectDossierSuggestionsFromSelection,
    handleFinish,
    handleRebuildClusters,
    handleRestorePreviousClusterVersion,
    loading,
    movingSelectedDocumentsTargetId,
    pendingClusterVersion,
    pendingClusterVersionNeedsRefresh = false,
    pendingFeedbackCount,
    supplementalPendingDocumentCount = 0,
    supplementalPendingUpdateDocumentCount = 0,
    supplementalVerificationPendingCount = 0,
    promotingSelectedDocuments,
    promotingTemporaryFolder,
    rebuildBaselineVersionId,
    rebuildSubmitting,
    restoringClusterVersion,
    selectedDocumentCount,
    selectedDocumentsActionDisabled,
    sourceHasActiveClusterVersion,
    sessionId,
    totalDossiers,
    totalFiles,
    viewingHistoricalClusterVersion,
  } = props

  const effectiveActionState =
    clusterActionState ??
    resolveFinalResultActionState({
      hasPendingClusterVersion: Boolean(pendingClusterVersion),
      pendingClusterVersionStatus: pendingClusterVersion ? "draft" : null,
      pendingClusterVersionNeedsRefresh,
      pendingFeedbackCount,
      supplementalVerificationPendingCount,
      supplementalPendingDocumentCount,
      supplementalPendingUpdateDocumentCount,
      clusterVersionStale,
      busy: Boolean(
        loading ||
        rebuildSubmitting ||
        restoringClusterVersion ||
        promotingTemporaryFolder ||
        promotingSelectedDocuments ||
        movingSelectedDocumentsTargetId ||
        rebuildBaselineVersionId
      ),
      viewingHistoricalClusterVersion,
      hasSession: Boolean(sessionId),
      totalFiles,
      totalDossiers,
    })
  const finishBlockedReason = effectiveActionState.finishBlockedReason

  return (
    <WorkflowActionPanel className="flex flex-col gap-3 px-4 py-4 sm:px-6 xl:flex-row xl:items-center xl:justify-between">
      <p className="min-w-0 flex-1 text-sm text-[#64748B]">
        {selectedDocumentCount > 0
          ? `Đã chọn ${selectedDocumentCount} tài liệu.`
          : pendingFeedbackCount > 0
            ? `Có ${pendingFeedbackCount} feedback đã lưu và đang chờ cập nhật hồ sơ.`
            : supplementalVerificationPendingCount > 0
              ? `Còn ${supplementalVerificationPendingCount} đợt tài liệu bổ sung đang chờ verify đủ.`
              : supplementalPendingUpdateDocumentCount > 0
                ? `Có ${supplementalPendingUpdateDocumentCount} tài liệu bổ sung đã verify đang chờ cập nhật hồ sơ.`
                : "Chọn tài liệu bằng checkbox hoặc kéo tài liệu vào Thư mục tạm để xử lý sau."}
      </p>
      <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6 xl:flex xl:w-auto xl:flex-wrap xl:items-center xl:justify-end">
        <Button
          variant="outline"
          onClick={() =>
            void (canRestoreFileRegisterVersion
              ? handleRestorePreviousClusterVersion()
              : handleRebuildClusters("file_register"))
          }
          className="w-full xl:w-auto"
          title={
            canRestoreFileRegisterVersion
              ? "Quay trở lại phiên bản hồ sơ trước khi lập theo tập lưu"
              : (effectiveActionState.clusterMutationBlockedReason ??
                "Lập lại hồ sơ theo dạng tập lưu, không phụ thuộc phương án chỉnh lý hiện tại")
          }
          disabled={
            rebuildSubmitting ||
            restoringClusterVersion ||
            promotingTemporaryFolder ||
            promotingSelectedDocuments ||
            Boolean(movingSelectedDocumentsTargetId) ||
            loading ||
            !sessionId ||
            totalFiles === 0 ||
            viewingHistoricalClusterVersion ||
            Boolean(
              !canRestoreFileRegisterVersion &&
              effectiveActionState.clusterMutationBlockedReason
            )
          }
        >
          {restoringClusterVersion ||
          (rebuildSubmitting && clusterJobMode === "file_register") ? (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          ) : canRestoreFileRegisterVersion ? (
            <Undo2 data-icon="inline-start" />
          ) : (
            <Archive data-icon="inline-start" />
          )}
          {canRestoreFileRegisterVersion
            ? "Quay trở lại phiên bản ban đầu"
            : "Lập lại theo tập lưu"}
        </Button>
        {SHOW_DOSSIER_SUGGESTIONS && (
          <Button
            variant="outline"
            onClick={handleSelectDossierSuggestionsFromSelection}
            className="w-full xl:w-auto"
            disabled={selectedDocumentsActionDisabled}
            title={
              selectedDocumentCount === 0
                ? "Hãy chọn ít nhất một tài liệu để lấy gợi ý hồ sơ"
                : "Tìm hồ sơ phù hợp cho toàn bộ tài liệu đang chọn"
            }
          >
            <ListChecks data-icon="inline-start" />
            Gợi ý hồ sơ
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => void handleCreateDossierFromSelection()}
          className="w-full xl:w-auto"
          disabled={selectedDocumentsActionDisabled}
          title={
            selectedDocumentCount === 0
              ? "Hãy chọn ít nhất một tài liệu để tạo hồ sơ mới"
              : "Tạo hồ sơ mới từ các tài liệu đang chọn"
          }
        >
          {promotingSelectedDocuments ? (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          ) : (
            <FolderPlus data-icon="inline-start" />
          )}
          {promotingSelectedDocuments
            ? "Đang tạo và gợi ý..."
            : "Tạo hồ sơ từ lựa chọn"}
        </Button>
        {canDeleteDocuments ? (
          <Button
            variant="destructive"
            onClick={handleDeleteSelectedDocuments}
            className="w-full xl:w-auto"
            disabled={deleteSelectedDocumentsDisabled}
            title="Xóa các tài liệu đã chọn khỏi toàn session"
          >
            <Trash2 data-icon="inline-start" />
            Xóa khỏi session
          </Button>
        ) : null}
        {canTransferDocuments ? (
          <Button
            variant="outline"
            onClick={handleTransferSelectedDocuments}
            className="w-full border-[#BFD3FF] text-[#0052FF] hover:bg-[#F3F7FF] xl:w-auto"
            disabled={transferSelectedDocumentsDisabled}
            title={
              sourceHasActiveClusterVersion
                ? "Phông nguồn đã có kết quả phân loại được duyệt nên không thể chuyển tài liệu đi"
                : selectedDocumentCount === 0
                  ? "Hãy chọn ít nhất một tài liệu để chuyển phông"
                  : "Chuyển các tài liệu đã chọn sang một phông khác"
            }
          >
            <ArrowRightLeft data-icon="inline-start" />
            Chuyển phông
          </Button>
        ) : null}
        {effectiveActionState.showUpdateAction ? (
          <Button
            variant="outline"
            onClick={() => void handleRebuildClusters()}
            className="w-full xl:w-auto"
            disabled={!effectiveActionState.canUpdateDossiers}
            title={effectiveActionState.updateBlockedReason ?? undefined}
          >
            {rebuildSubmitting && clusterJobMode === "update" ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <RefreshCw data-icon="inline-start" />
            )}
            Cập nhật hồ sơ
            {supplementalPendingUpdateDocumentCount > 0
              ? ` (${supplementalPendingUpdateDocumentCount})`
              : ""}
          </Button>
        ) : null}
        <Button
          variant="outline"
          onClick={() => void handleCancelPendingFeedback()}
          className="w-full xl:w-auto"
          disabled={
            pendingFeedbackCount <= 0 ||
            cancelingPendingFeedback ||
            rebuildSubmitting ||
            restoringClusterVersion ||
            promotingTemporaryFolder ||
            promotingSelectedDocuments ||
            Boolean(movingSelectedDocumentsTargetId) ||
            loading ||
            !sessionId ||
            viewingHistoricalClusterVersion ||
            Boolean(rebuildBaselineVersionId)
          }
        >
          {cancelingPendingFeedback ? (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          ) : (
            <CircleX data-icon="inline-start" />
          )}
          Hủy feedback
        </Button>
        <div className="relative w-full xl:w-auto">
          <Button
            onClick={handleFinish}
            className="w-full xl:w-auto"
            disabled={Boolean(finishBlockedReason)}
          >
            <CheckCircle2 data-icon="inline-start" />
            Đánh số trang
          </Button>
          {finishBlockedReason ? (
            <button
              type="button"
              aria-label="Xem lý do không thể sang bước Đánh số trang"
              onClick={() => toast.error(finishBlockedReason)}
              className="absolute inset-0 h-full w-full cursor-not-allowed rounded-lg bg-transparent"
            />
          ) : null}
        </div>
      </div>
    </WorkflowActionPanel>
  )
}
