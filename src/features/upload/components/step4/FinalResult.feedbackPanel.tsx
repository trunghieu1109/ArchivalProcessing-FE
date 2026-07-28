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
import { SHOW_DOSSIER_SUGGESTIONS } from "./temporaryFeatureVisibility"

interface FinalResultFeedbackPanelProps {
  canDeleteDocuments: boolean
  canTransferDocuments: boolean
  canRestoreFileRegisterVersion: boolean
  cancelingPendingFeedback: boolean
  clusterJobMode: string
  clusterVersionStale: boolean
  deleteSelectedDocumentsDisabled: boolean
  transferSelectedDocumentsDisabled: boolean
  handleCancelPendingFeedback: () => Promise<unknown> | void
  handleCreateDossierFromSelection: () => Promise<boolean>
  handleDeleteSelectedDocuments: () => void
  handleTransferSelectedDocuments: () => void
  handleFinish: () => void
  handleRebuildClusters: (strategy?: string) => Promise<unknown> | void
  handleRestorePreviousClusterVersion: () => Promise<unknown> | void
  handleSelectDossierSuggestionsFromSelection: () => void
  loading: boolean
  movingSelectedDocumentsTargetId: string | null
  pendingClusterVersion: unknown | null
  pendingFeedbackCount: number
  promotingSelectedDocuments: boolean
  promotingTemporaryFolder: boolean
  rebuildBaselineVersionId: string | null
  rebuildSubmitting: boolean
  restoringClusterVersion: boolean
  selectedDocumentCount: number
  selectedDocumentsActionDisabled: boolean
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
    pendingFeedbackCount,
    promotingSelectedDocuments,
    promotingTemporaryFolder,
    rebuildBaselineVersionId,
    rebuildSubmitting,
    restoringClusterVersion,
    selectedDocumentCount,
    selectedDocumentsActionDisabled,
    sessionId,
    totalDossiers,
    totalFiles,
    viewingHistoricalClusterVersion,
  } = props

  const finishBlockedReason = viewingHistoricalClusterVersion
    ? "Bạn đang xem phiên bản hồ sơ cũ. Hãy kích hoạt hoặc quay về phiên bản đang dùng trước khi đánh số trang."
    : clusterVersionStale
      ? "Danh sách tài liệu đã thay đổi. Hãy lập lại hồ sơ trước khi sang bước Đánh số trang."
      : pendingFeedbackCount > 0
        ? `Bạn còn ${pendingFeedbackCount} feedback chưa được cập nhật vào hồ sơ. Hãy cập nhật hồ sơ hoặc hủy feedback trước khi tiếp tục.`
        : pendingClusterVersion
          ? "Có phiên bản hồ sơ mới đang chờ áp dụng. Hãy áp dụng phiên bản đó trước khi đánh số trang."
          : totalDossiers === 0
            ? "Chưa có hồ sơ để chuyển sang bước Đánh số trang."
            : loading ||
                rebuildSubmitting ||
                restoringClusterVersion ||
                promotingTemporaryFolder ||
                promotingSelectedDocuments ||
                Boolean(movingSelectedDocumentsTargetId) ||
                Boolean(rebuildBaselineVersionId)
              ? "Hồ sơ đang được cập nhật. Vui lòng chờ thao tác hoàn tất."
              : null

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#D8E1EC] bg-white px-4 py-3 shadow-sm xl:flex-row xl:items-center xl:justify-between">
      <p className="min-w-0 flex-1 text-sm text-[#64748B]">
        {selectedDocumentCount > 0
          ? `Đã chọn ${selectedDocumentCount} tài liệu.`
          : pendingFeedbackCount > 0
            ? `Có ${pendingFeedbackCount} feedback đã lưu và đang chờ cập nhật hồ sơ.`
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
              : "Lập lại hồ sơ theo dạng tập lưu, không phụ thuộc phương án chỉnh lý hiện tại"
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
            Boolean(pendingClusterVersion)
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
            title="Tìm hồ sơ phù hợp cho toàn bộ tài liệu đang chọn"
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
            title="Chuyển các tài liệu đã chọn sang một phông khác"
          >
            <ArrowRightLeft data-icon="inline-start" />
            Chuyển phông
          </Button>
        ) : null}
        <Button
          variant="outline"
          onClick={() => void handleRebuildClusters()}
          className="w-full xl:w-auto"
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
            Boolean(pendingClusterVersion)
          }
        >
          {rebuildSubmitting && clusterJobMode === "update" ? (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          ) : (
            <RefreshCw data-icon="inline-start" />
          )}
          {clusterVersionStale ? "Lập hồ sơ lại" : "Cập nhật hồ sơ"}
        </Button>
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
            Boolean(rebuildBaselineVersionId) ||
            Boolean(pendingClusterVersion)
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
    </div>
  )
}
