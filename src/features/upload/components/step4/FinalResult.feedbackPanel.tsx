import {
  Archive,
  CheckCircle2,
  CircleX,
  FolderPlus,
  ListChecks,
  Loader2,
  RefreshCw,
  Undo2,
} from "lucide-react"
import { Button } from "@/components/ui/button"

interface FinalResultFeedbackPanelProps {
  canRestoreFileRegisterVersion: boolean
  cancelingPendingFeedback: boolean
  clusterJobMode: string
  handleCancelPendingFeedback: () => Promise<unknown> | void
  handleCreateDossierFromSelection: () => Promise<boolean>
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
    canRestoreFileRegisterVersion,
    cancelingPendingFeedback,
    clusterJobMode,
    handleCancelPendingFeedback,
    handleCreateDossierFromSelection,
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
          Cập nhật hồ sơ
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
        <Button
          onClick={handleFinish}
          className="w-full xl:w-auto"
          disabled={
            totalDossiers === 0 ||
            pendingFeedbackCount > 0 ||
            loading ||
            rebuildSubmitting ||
            restoringClusterVersion ||
            promotingTemporaryFolder ||
            promotingSelectedDocuments ||
            Boolean(movingSelectedDocumentsTargetId) ||
            viewingHistoricalClusterVersion ||
            Boolean(rebuildBaselineVersionId) ||
            Boolean(pendingClusterVersion)
          }
        >
          <CheckCircle2 data-icon="inline-start" />
          Đánh số trang
        </Button>
      </div>
    </div>
  )
}
