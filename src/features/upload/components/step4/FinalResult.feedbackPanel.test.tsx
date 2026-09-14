import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { FinalResultFeedbackPanel } from "./FinalResult.feedbackPanel"

describe("FinalResultFeedbackPanel draft editing", () => {
  it("keeps update and cancel-feedback actions enabled for the working draft", () => {
    render(
      <FinalResultFeedbackPanel
        canDeleteDocuments={false}
        canTransferDocuments={true}
        canRestoreFileRegisterVersion={false}
        cancelingPendingFeedback={false}
        clusterJobMode="update"
        clusterVersionStale={false}
        deleteSelectedDocumentsDisabled={true}
        transferSelectedDocumentsDisabled={true}
        handleCancelPendingFeedback={() => undefined}
        handleCreateDossierFromSelection={async () => true}
        handleDeleteSelectedDocuments={() => undefined}
        handleTransferSelectedDocuments={() => undefined}
        handleFinish={() => undefined}
        hasUsableActiveClusterVersion={false}
        handleRebuildClusters={() => undefined}
        handleRestorePreviousClusterVersion={() => undefined}
        handleSelectDossierSuggestionsFromSelection={() => undefined}
        loading={false}
        movingSelectedDocumentsTargetId={null}
        pendingClusterVersion={{ id: "cluster-draft-2" }}
        pendingFeedbackCount={1}
        promotingSelectedDocuments={false}
        promotingTemporaryFolder={false}
        rebuildBaselineVersionId={null}
        rebuildSubmitting={false}
        restoringClusterVersion={false}
        selectedDocumentCount={0}
        selectedDocumentsActionDisabled={true}
        sourceHasActiveClusterVersion={false}
        sessionId="session-source"
        totalDossiers={2}
        totalFiles={3}
        viewingHistoricalClusterVersion={false}
      />
    )

    expect(screen.getByRole("button", { name: "Cập nhật hồ sơ" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Hủy feedback" })).toBeEnabled()
  })

  it("keeps selection actions enabled on a working draft after selecting a document", () => {
    render(
      <FinalResultFeedbackPanel
        canDeleteDocuments={false}
        canTransferDocuments={true}
        canRestoreFileRegisterVersion={false}
        cancelingPendingFeedback={false}
        clusterJobMode="update"
        clusterVersionStale={false}
        deleteSelectedDocumentsDisabled={false}
        transferSelectedDocumentsDisabled={false}
        handleCancelPendingFeedback={() => undefined}
        handleCreateDossierFromSelection={async () => true}
        handleDeleteSelectedDocuments={() => undefined}
        handleTransferSelectedDocuments={() => undefined}
        handleFinish={() => undefined}
        hasUsableActiveClusterVersion={false}
        handleRebuildClusters={() => undefined}
        handleRestorePreviousClusterVersion={() => undefined}
        handleSelectDossierSuggestionsFromSelection={() => undefined}
        loading={false}
        movingSelectedDocumentsTargetId={null}
        pendingClusterVersion={{ id: "cluster-draft-2" }}
        pendingFeedbackCount={0}
        promotingSelectedDocuments={false}
        promotingTemporaryFolder={false}
        rebuildBaselineVersionId={null}
        rebuildSubmitting={false}
        restoringClusterVersion={false}
        selectedDocumentCount={1}
        selectedDocumentsActionDisabled={false}
        sourceHasActiveClusterVersion={false}
        sessionId="session-source"
        totalDossiers={2}
        totalFiles={3}
        viewingHistoricalClusterVersion={false}
      />
    )

    expect(screen.getByRole("button", { name: "Gợi ý hồ sơ" })).toBeEnabled()
    expect(
      screen.getByRole("button", { name: "Tạo hồ sơ từ lựa chọn" })
    ).toBeEnabled()
    expect(screen.getByRole("button", { name: "Chuyển phông" })).toBeEnabled()
  })

  it("blocks outbound transfer after the source cluster version is active", () => {
    render(
      <FinalResultFeedbackPanel
        canDeleteDocuments={false}
        canTransferDocuments={true}
        canRestoreFileRegisterVersion={false}
        cancelingPendingFeedback={false}
        clusterJobMode="update"
        clusterVersionStale={false}
        deleteSelectedDocumentsDisabled={true}
        transferSelectedDocumentsDisabled={true}
        handleCancelPendingFeedback={() => undefined}
        handleCreateDossierFromSelection={async () => true}
        handleDeleteSelectedDocuments={() => undefined}
        handleTransferSelectedDocuments={() => undefined}
        handleFinish={() => undefined}
        hasUsableActiveClusterVersion={true}
        handleRebuildClusters={() => undefined}
        handleRestorePreviousClusterVersion={() => undefined}
        handleSelectDossierSuggestionsFromSelection={() => undefined}
        loading={false}
        movingSelectedDocumentsTargetId={null}
        pendingClusterVersion={null}
        pendingFeedbackCount={0}
        promotingSelectedDocuments={false}
        promotingTemporaryFolder={false}
        rebuildBaselineVersionId={null}
        rebuildSubmitting={false}
        restoringClusterVersion={false}
        selectedDocumentCount={1}
        selectedDocumentsActionDisabled={false}
        sourceHasActiveClusterVersion={true}
        sessionId="session-source"
        totalDossiers={2}
        totalFiles={3}
        viewingHistoricalClusterVersion={false}
      />
    )

    const transferButton = screen.getByRole("button", { name: "Chuyển phông" })
    expect(transferButton).toBeDisabled()
    expect(transferButton).toHaveAttribute(
      "title",
      "Phông nguồn đã có kết quả phân loại được duyệt nên không thể chuyển tài liệu đi"
    )
  })
})
