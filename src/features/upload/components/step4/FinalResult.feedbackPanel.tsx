import {
  Archive,
  CheckCircle2,
  CircleX,
  FolderPlus,
  Loader2,
  RefreshCw,
  Undo2,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

export function FinalResultFeedbackPanel(props: Record<string, any>) {
  const {
    canRestoreFileRegisterVersion,
    cancelingPendingFeedback,
    clusterJobMode,
    handleCancelPendingFeedback,
    handleCreateDossierFromSelection,
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

  const finishBlockedReason =
    viewingHistoricalClusterVersion
      ? "Bạn đang xem phiên bản cũ. Hãy kích hoạt phiên bản này trước khi tạo mục lục."
      : pendingFeedbackCount > 0
        ? `Bạn vẫn còn ${pendingFeedbackCount} feedback chưa được cập nhật vào hồ sơ. Hãy Cập nhật hồ sơ hoặc Hủy feedback trước khi sang bước Đánh số trang.`
        : pendingClusterVersion
          ? "Có phiên bản hồ sơ mới đang chờ áp dụng. Hãy áp dụng trước khi sang bước Đánh số trang."
          : totalDossiers === 0
            ? "Chưa có hồ sơ để chuyển sang bước Đánh số trang."
            : loading ||
                rebuildSubmitting ||
                restoringClusterVersion ||
                promotingTemporaryFolder ||
                promotingSelectedDocuments ||
                Boolean(movingSelectedDocumentsTargetId) ||
                Boolean(rebuildBaselineVersionId)
              ? "Đang cập nhật hồ sơ. Vui lòng chờ xong rồi sang bước Đánh số trang."
              : null

  const handleFinishBlockedClick = () => {
    toast.error(
      finishBlockedReason ?? "Không thể chuyển sang bước Đánh số trang lúc này."
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#D8E1EC] bg-white px-4 py-3 shadow-sm xl:flex-row xl:items-center xl:justify-between">
        <p className="min-w-0 flex-1 text-sm text-[#64748B]">
          {selectedDocumentCount > 0
            ? `Đã chọn ${selectedDocumentCount} tài liệu.`
            : pendingFeedbackCount > 0
              ? `Có ${pendingFeedbackCount} feedback đã lưu và đang chờ cập nhật hồ sơ.`
              : "Chọn tài liệu bằng checkbox hoặc kéo tài liệu vào Thư mục tạm để xử lý sau."}
        </p>
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5 xl:flex xl:w-auto xl:flex-wrap xl:items-center xl:justify-end">
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
          <div className="relative w-full xl:w-auto">
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
          {finishBlockedReason ? (
            <button
              type="button"
              aria-label="Xem lý do không thể sang bước Đánh số trang"
              onClick={handleFinishBlockedClick}
              className="absolute inset-0 h-full w-full rounded-lg cursor-not-allowed bg-transparent"
            />
          ) : null}
          </div>
        </div>
    </div>
  )
}
