import { AnimatePresence, motion } from "framer-motion"
import { ArrowLeft, FileText, Home } from "lucide-react"
import { toast } from "sonner"
import { FolderTree } from "@/features/upload/components/step2/FolderTree"
import { RetentionAppendicesPanel } from "@/features/upload/components/step2/FolderTree.nodes"
import { ProgressTimeline } from "@/features/upload/components/ProgressTimeline"
import { ProcessStep } from "@/features/upload/components/step3/ProcessStep"
import { FinalResult } from "@/features/upload/components/step4/FinalResult"
import { NumberingStep } from "@/features/upload/components/step5/NumberingStep"
import { PublicationStep } from "@/features/upload/components/step7/PublicationStep"
import { FinalizeArtifactsStep } from "@/pages/FinalizeArtifactsPage"
import { SessionMetadataBar } from "@/features/upload/components/SessionMetadataBar"
import { cn } from "@/shared/lib/utils"
import type { AppStep } from "@/features/upload/types"
import { easeOut } from "./UploadPage.planUtils"
import { UploadPageHeader } from "./UploadPage.header"
import { UploadPageStepOne } from "./UploadPage.step1"

export function UploadPageView(props: Record<string, any>) {
  const {
    currentStep,
    highestVisitedStep,
    existingSessionMode,
    routeSessionId,
    sessionId,
    sessionMetadata,
    syncSessionMetadataDraft,
    saveSessionMetadata,
    sessionLoading,
    STEP_LABELS,
    PLAN_PROGRESS_PHASES,
    goTo,
    statusItems,
    readyCount,
    requiredFileCount,
    selectedInputLabels,
    hasAnyFile,
    allProcessing,
    allDone,
    primaryActionDisabled,
    handleStartAll,
    doc1Ref,
    doc2Ref,
    zipRef,
    doc2Has,
    zipHas,
    hasAnalyzedArrangementPlan,
    doc1State,
    doc2State,
    zipState,
    planAnalyzing,
    planProgressPhase,
    planCompletedPhases,
    planProgressMessage,
    ocr,
    syncDoc1Has,
    syncDoc2Has,
    syncZipHas,
    uploadInput,
    uploadRetentionInputs,
    syncDoc1State,
    syncDoc2State,
    syncZipState,
    syncZipEntries,
    syncZipFolderPath,
    zipMaxFiles,
    syncZipMaxFiles,
    uploadMode,
    syncUploadMode,
    zipUploadProgress,
    planReuploadState,
    planInputsReuploaded,
    zipSupplementUploaded,
    parsedPlan,
    folderTree,
    dossierBuildStrategy,
    selectDossierBuildStrategy,
    documentNumberingMode,
    selectDocumentNumberingModeDraft,
    selectDocumentNumberingMode,
    documentNumberingStylePreset,
    documentNumberingStyleOverrides,
    selectDocumentNumberingStylePreset,
    selectDocumentNumberingStyleOverrides,
    applyPersistedDocumentNumberingStylePreset,
    applyPersistedDocumentNumberingStyleOverrides,
    saveFileRegisterConfig,
    syncFolderTree,
    saveFolderTree,
    savePlanCriterias,
    handleConfirmPlan,
    confirmingPlan,
    ocrPdfPaths,
    ocrMetadataItems,
    ocrLoading,
    ocrIsReextracting,
    ocrPendingIngestionCount,
    ocrPendingIngestionMessage,
    ocrMessage,
    ocrSignatureStatus,
    handleContinueToResults,
    dossierBuildBlockedMessage,
    clusterGroups,
    handleFinalizeAutoStartHandled,
    searchParams,
    isWorkerUser,
    navigate,
  } = props
  const hasAnalyzedPlan = Boolean(hasAnalyzedArrangementPlan)
  const planProcessingTitle =
    doc1State === "processing" && doc2State === "processing"
      ? "Đang phân tích phương án chỉnh lý và thời hạn bảo quản"
      : doc2State === "processing" && doc1State !== "processing"
        ? "Đang phân tích thời hạn bảo quản"
        : "Đang phân tích phương án chỉnh lý"
  const planProcessingMessage =
    planProgressMessage || `${planProcessingTitle}. Kết quả sẽ tự hiển thị khi backend xử lý xong.`
  const hasAnalyzedRetentionSchedule =
    doc2Has &&
    (parsedPlan.retention_appendices.length > 0 ||
      parsedPlan.retention_sources.length > 0)
  const goToMetadataStep = () => {
    const targetSessionId = sessionId ?? routeSessionId
    if (targetSessionId) {
      navigate(
        `/sessions/${encodeURIComponent(targetSessionId)}/step/3?extract=1`
      )
      return
    }
    goTo(3)
  }

  return (
    <div className="min-h-svh bg-[#F0F4F8]">
      <UploadPageHeader
        currentStep={currentStep}
        highestVisitedStep={highestVisitedStep}
        STEP_LABELS={STEP_LABELS}
        goTo={goTo}
        isWorkerUser={isWorkerUser}
        navigate={navigate}
      />

      {/* Main content */}
      <div
        className={cn(
          "mx-auto px-3 py-5 sm:px-6 sm:py-8 lg:px-8",
          currentStep >= 3 ? "max-w-[1560px]" : "max-w-6xl"
        )}
      >
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <motion.button
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            onClick={() => navigate("/sessions")}
            className="flex items-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-4 py-2 text-sm font-medium text-[#475569] shadow-sm transition-all hover:border-[#0052FF]/30 hover:text-[#0052FF]"
          >
            <Home className="size-4" /> Danh sách session
          </motion.button>
          {currentStep > 1 && !isWorkerUser && (
            <motion.button
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => goTo((currentStep - 1) as AppStep)}
              className="flex items-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-4 py-2 text-sm font-medium text-[#475569] shadow-sm transition-all hover:border-[#0052FF]/30 hover:text-[#0052FF]"
            >
              <ArrowLeft className="size-4" /> Quay lại
            </motion.button>
          )}
        </div>

        {(sessionId || routeSessionId) && currentStep !== 1 && (
          <SessionMetadataBar
            sessionId={sessionId ?? routeSessionId ?? null}
            metadata={sessionMetadata}
            onSave={saveSessionMetadata}
            readOnly={isWorkerUser}
            className="mb-5"
          />
        )}

        <AnimatePresence mode="wait">
          {isWorkerUser && currentStep !== 3 && (
            <motion.div
              key="worker-redirect"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25, ease: easeOut }}
              className="rounded-2xl border border-[#D8E1EC] bg-white px-5 py-4 text-sm text-[#475569] shadow-sm"
            >
              Đang chuyển bạn về màn hình extract metadata được phân công...
            </motion.div>
          )}

          {/* Bước 1: Tải lên */}
          {!isWorkerUser && currentStep === 1 && (
            <UploadPageStepOne
              existingSessionMode={existingSessionMode}
              planAnalyzing={planAnalyzing}
              planProgressMessage={planProgressMessage}
              PLAN_PROGRESS_PHASES={PLAN_PROGRESS_PHASES}
              planProgressPhase={planProgressPhase}
              planCompletedPhases={planCompletedPhases}
              zipRef={zipRef}
              zipState={zipState}
              syncZipState={syncZipState}
              syncZipHas={syncZipHas}
              syncZipEntries={syncZipEntries}
              syncZipFolderPath={syncZipFolderPath}
              zipMaxFiles={zipMaxFiles}
              syncZipMaxFiles={syncZipMaxFiles}
              uploadInput={uploadInput}
              uploadRetentionInputs={uploadRetentionInputs}
              zipUploadProgress={zipUploadProgress}
              planReuploadState={planReuploadState}
              ocr={ocr}
              zipHas={zipHas}
              allProcessing={allProcessing}
              sessionLoading={sessionLoading}
              uploadMode={uploadMode}
              syncUploadMode={syncUploadMode}
              doc1Ref={doc1Ref}
              doc2Ref={doc2Ref}
              doc1State={doc1State}
              doc2State={doc2State}
              syncDoc1State={syncDoc1State}
              syncDoc2State={syncDoc2State}
              syncDoc1Has={syncDoc1Has}
              syncDoc2Has={syncDoc2Has}
              statusItems={statusItems}
              allDone={allDone}
              zipSupplementUploaded={zipSupplementUploaded}
              hasAnyFile={hasAnyFile}
              hasActivePlan={hasAnalyzedPlan}
              readyCount={readyCount}
              requiredFileCount={requiredFileCount}
              selectedInputLabels={selectedInputLabels}
              primaryActionDisabled={primaryActionDisabled}
              handleStartAll={handleStartAll}
              planInputsReuploaded={planInputsReuploaded}
              sessionMetadata={sessionMetadata}
              syncSessionMetadataDraft={syncSessionMetadataDraft}
              parsedPlan={parsedPlan}
            />
          )}

          {/* Bước 2: Cây thư mục */}
          {!isWorkerUser && currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: easeOut }}
            >
              {hasAnalyzedPlan ? (
                <FolderTree
                  tree={folderTree}
                  parsedPlan={parsedPlan}
                  fondsName={sessionMetadata?.fonds_name}
                  readOnly={false}
                  hasRetentionSchedule={doc2Has}
                  dossierBuildStrategy={dossierBuildStrategy}
                  onDossierBuildStrategyChange={selectDossierBuildStrategy}
                  documentNumberingMode={documentNumberingMode}
                  onDocumentNumberingModeChange={selectDocumentNumberingModeDraft}
                  documentNumberingStylePreset={documentNumberingStylePreset}
                  documentNumberingStyleOverrides={documentNumberingStyleOverrides}
                  onDocumentNumberingStylePresetChange={
                    selectDocumentNumberingStylePreset
                  }
                  onDocumentNumberingStyleOverridesChange={selectDocumentNumberingStyleOverrides}
                  onFileRegisterConfigChange={saveFileRegisterConfig}
                  onChange={syncFolderTree}
                  onSaveTree={saveFolderTree}
                  onCriteriaChange={savePlanCriterias}
                  onConfirm={handleConfirmPlan}
                  confirming={confirmingPlan}
                />
              ) : planAnalyzing ? (
                <div className="flex flex-col gap-4">
                  <ProgressTimeline
                    phases={PLAN_PROGRESS_PHASES}
                    activePhase={planProgressPhase}
                    completedPhases={planCompletedPhases}
                    title={planProcessingTitle}
                    message={planProcessingMessage}
                  />
                  <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white px-6 py-8 text-center shadow-sm">
                    <FileText className="mx-auto size-9 text-[#94A3B8]" />
                    <h2 className="mt-3 text-xl font-semibold text-[#0F172A]">
                      {planProcessingTitle}
                    </h2>
                    <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#64748B]">
                      Hệ thống đã nhận file và đang chờ kết quả phân tích. Khi
                      job hoàn tất, cây phương án hoặc thời hạn bảo quản sẽ tự
                      cập nhật tại màn hình này.
                    </p>
                    {zipHas && (
                      <button
                        type="button"
                        onClick={goToMetadataStep}
                        className="mt-5 rounded-xl bg-[#0052FF] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0047DB]"
                      >
                        Đi tới extract metadata
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white px-6 py-8 text-center shadow-sm">
                  <FileText className="mx-auto size-9 text-[#94A3B8]" />
                  <h2 className="mt-3 text-xl font-semibold text-[#0F172A]">
                    {hasAnalyzedRetentionSchedule
                      ? "Đã phân tích thời hạn bảo quản"
                      : "Chưa có phương án chỉnh lý"}
                  </h2>
                  <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#64748B]">
                    {hasAnalyzedRetentionSchedule
                      ? "Kết quả thời hạn bảo quản đã sẵn sàng. Bạn vẫn có thể upload phương án chỉnh lý ở Step 1 để xem cây phân loại."
                      : "Hãy upload phương án chỉnh lý ở Step 1 để xem cây phân loại và tiêu chí phân tích. Các phần dữ liệu khác vẫn có thể xử lý độc lập."}
                  </p>
                  {(parsedPlan.retention_appendices.length > 0 ||
                    parsedPlan.retention_sources.length > 0) && (
                    <div className="mx-auto mt-6 max-w-4xl text-left">
                      <RetentionAppendicesPanel
                        appendices={parsedPlan.retention_appendices}
                        sources={parsedPlan.retention_sources}
                        hasRetentionSchedule={doc2Has}
                      />
                    </div>
                  )}
                  {zipHas && (
                    <button
                      type="button"
                      onClick={goToMetadataStep}
                      className="mt-5 rounded-xl bg-[#0052FF] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0047DB]"
                    >
                      Đi tới extract metadata
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* Bước 3: Xử lý */}
          {currentStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: easeOut }}
            >
              <ProcessStep
                sessionId={sessionId}
                pdfPaths={ocrPdfPaths}
                metadataTotal={
                  ocr.status?.total_files ?? ocrMetadataItems.length
                }
                metadataItems={ocrMetadataItems}
                metadataBatchSummaries={ocr.status?.metadata_batches ?? []}
                metadataLoading={ocrLoading}
                metadataReloading={ocrIsReextracting}
                pendingIngestionCount={ocrPendingIngestionCount}
                pendingIngestionMessage={ocrPendingIngestionMessage}
                metadataMessage={ocrMessage}
                metadataReadyTotal={ocr.status?.metadata_ready_documents ?? 0}
                metadataProcessingTotal={
                  ocr.status?.metadata_processing_documents ?? 0
                }
                metadataFailedTotal={
                  ocr.status?.metadata_failed_documents ??
                  (ocr.status?.status_counts?.failed ?? 0) +
                    (ocr.status?.status_counts?.final_failed ?? 0) +
                    (ocr.status?.status_counts?.signature_failed ?? 0) +
                    (ocr.status?.status_counts?.skipped ?? 0) +
                    (ocr.status?.status_counts?.cancelled ?? 0) +
                    (ocr.status?.status_counts?.missing_task ?? 0)
                }
                metadataReviewedTotal={ocr.status?.metadata_reviewed_documents ?? 0}
                metadataWarningTotal={ocr.status?.metadata_warning_documents ?? 0}
                metadataPagination={{
                  pagination: ocr.status?.pagination ?? null,
                  pageIndex: ocr.documentPageIndex,
                  pageSize: ocr.documentPageSize,
                  onPageChange: (pageIndex: number) => {
                    ocr.setDocumentPageIndex(pageIndex)
                    void ocr.refreshDocumentsPage({ pageIndex })
                  },
                }}
                metadataDocumentScope={ocr.metadataDocumentScope}
                onMetadataDocumentScopeChange={(scope) => {
                  ocr.setMetadataDocumentScope(scope)
                }}
                onMetadataDocumentsChanged={() => {
                  void ocr.refreshDocumentsPage({
                    pageIndex: 0,
                    force: true,
                  })
                }}
                hasDataInput={
                  zipHas ||
                  ocrLoading ||
                  ocrMetadataItems.length > 0 ||
                  ocrPdfPaths.length > 0 ||
                  Boolean(ocr.status?.total_files)
                }
                buildBlockedMessage={dossierBuildBlockedMessage}
                signatureStatus={ocrSignatureStatus}
                onDocumentsVerified={ocr.mergeVerifiedDocuments}
                onRetryMetadata={ocr.restartMetadata}
                onContinue={handleContinueToResults}
              />
            </motion.div>
          )}

          {/* Bước 4: Kết quả */}
          {!isWorkerUser && currentStep === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: easeOut }}
            >
              <FinalResult
                sessionId={sessionId}
                groups={clusterGroups}
                fondsName={sessionMetadata?.fonds_name}
                onFinish={() => {
                  const currentSessionId = sessionId ?? routeSessionId
                  if (!currentSessionId) {
                    toast.error("Chưa có session để đánh số trang.")
                    return
                  }
                  navigate(
                    `/sessions/${encodeURIComponent(currentSessionId)}/step/5`
                  )
                }}
              />
            </motion.div>
          )}

          {/* Bước 5: Đánh số trang */}
          {!isWorkerUser && currentStep === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: easeOut }}
            >
              <NumberingStep
                sessionId={sessionId ?? routeSessionId ?? null}
                documentNumberingMode={documentNumberingMode}
                onDocumentNumberingModeChange={selectDocumentNumberingMode}
                documentNumberingStylePreset={documentNumberingStylePreset}
                documentNumberingStyleOverrides={documentNumberingStyleOverrides}
                onDocumentNumberingStyleApplied={(stylePreset, overrides) => {
                  applyPersistedDocumentNumberingStylePreset(stylePreset)
                  applyPersistedDocumentNumberingStyleOverrides(overrides)
                }}
                autoStart={searchParams.get("start") === "1"}
                onAutoStartHandled={
                  searchParams.get("start") === "1"
                    ? handleFinalizeAutoStartHandled
                    : undefined
                }
                onContinue={() => {
                  const currentSessionId = sessionId ?? routeSessionId
                  if (!currentSessionId) {
                    toast.error("Chưa có session để tạo mục lục.")
                    return
                  }
                  navigate(
                    `/sessions/${encodeURIComponent(currentSessionId)}/step/6?start=1`
                  )
                }}
              />
            </motion.div>
          )}

          {/* Bước 6: Tạo mục lục */}
          {!isWorkerUser && currentStep === 6 && (
            <motion.div
              key="step6"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: easeOut }}
            >
              <FinalizeArtifactsStep
                sessionId={sessionId ?? routeSessionId ?? null}
                sessionMetadata={sessionMetadata}
                autoStart={searchParams.get("start") === "1"}
                onAutoStartHandled={handleFinalizeAutoStartHandled}
                embedded
                onContinue={() => {
                  const currentSessionId = sessionId ?? routeSessionId
                  if (!currentSessionId) {
                    toast.error("Chưa có session để xuất bản.")
                    return
                  }
                  navigate(
                    `/sessions/${encodeURIComponent(currentSessionId)}/step/7`
                  )
                }}
              />
            </motion.div>
          )}

          {/* Bước 7: Xuất bản */}
          {!isWorkerUser && currentStep === 7 && (
            <motion.div
              key="step7"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: easeOut }}
            >
              <PublicationStep
                sessionId={sessionId ?? routeSessionId ?? null}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
