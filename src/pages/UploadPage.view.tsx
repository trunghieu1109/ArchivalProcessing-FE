import { AnimatePresence, motion } from "framer-motion"
import { ArrowLeft, BadgeCheck, FileText, Home, PenLine } from "lucide-react"
import { toast } from "sonner"
import { FolderTree } from "@/features/upload/components/step2/FolderTree"
import { RetentionAppendicesPanel } from "@/features/upload/components/step2/FolderTree.nodes"
import { PlanReviewActions } from "@/features/upload/components/step2/PlanReviewActions"
import { ProgressTimeline } from "@/features/upload/components/ProgressTimeline"
import { PlanAnalysisFailureAlert } from "@/features/upload/components/PlanAnalysisFailureAlert"
import { ProcessStep } from "@/features/upload/components/step3/ProcessStep"
import { FinalResult } from "@/features/upload/components/step4/FinalResult"
import { NumberingStep } from "@/features/upload/components/step5/NumberingStep"
import { PublicationStep } from "@/features/upload/components/step7/PublicationStep"
import { FinalizeArtifactsStep } from "@/pages/FinalizeArtifactsPage"
import { SessionMetadataBar } from "@/features/upload/components/SessionMetadataBar"
import { cn } from "@/shared/lib/utils"
import type { AppStep } from "@/features/upload/types"
import { easeOut } from "./UploadPage.planUtils"
import { planAnalysisFailureDomain } from "./UploadPage.progress"
import { UploadPageHeader } from "./UploadPage.header"
import { UploadPageStepOne } from "./UploadPage.step1"
import {
  hasArrangementPlanResult,
  hasRetentionAnalysisResult,
} from "./UploadPage.workflowPolicy"

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
    doc1Has,
    doc2Has,
    zipHas,
    hasActivePlan,
    doc1State,
    doc2State,
    zipState,
    planAnalyzing,
    planAnalysisFailure,
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
    latestUploadInterruption,
    planReuploadState,
    planInputsReuploaded,
    zipSupplementUploaded,
    parsedPlan,
    folderTree,
    activeParsedPlan,
    activeFolderTree,
    activePlanSettings,
    workingPlanVersionId,
    workingPlanStatus,
    planDraftDirty,
    draftMatchesActive,
    activePlanVersionId,
    planViewTab,
    setPlanViewTab,
    dossierBuildStrategy,
    selectDossierBuildStrategy,
    documentNumberingMode,
    applyPersistedDocumentNumberingMode,
    selectDocumentNumberingModeDraft,
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
    handleSaveDraft,
    handleConfirmPlan,
    handleContinueToExtractMetadata,
    handlePlanStepNavigation,
    handleNavigateToSessions,
    savingPlanDraft,
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
  const resolvedSessionId = routeSessionId ?? sessionId ?? null
  const hasApprovedPlan =
    Boolean(hasActivePlan) &&
    Boolean(activePlanVersionId) &&
    activeParsedPlan.groups.length > 0
  const hasActivePlanVersion =
    hasApprovedPlan && activeParsedPlan.groups.length > 0
  const hasPlanReady = hasArrangementPlanResult({
    workingGroupCount: parsedPlan.groups.length,
    activeGroupCount: activeParsedPlan.groups.length,
  })
  const showActivePlanTab = planViewTab === "active"
  const draftIsActiveFallback =
    Boolean(activePlanVersionId) &&
    workingPlanVersionId === activePlanVersionId &&
    workingPlanStatus !== "draft"
  const hasPersistedDraft =
    workingPlanStatus === "draft" &&
    Boolean(workingPlanVersionId) &&
    !draftMatchesActive
  const planProcessingTitle =
    doc1State === "processing" && doc2State === "processing"
      ? "Đang phân tích phương án chỉnh lý và thời hạn bảo quản"
      : doc2State === "processing" && doc1State !== "processing"
        ? "Đang phân tích thời hạn bảo quản"
        : "Đang phân tích phương án chỉnh lý"
  const planProcessingMessage =
    planProgressMessage ||
    `${planProcessingTitle}. Kết quả sẽ tự hiển thị khi backend xử lý xong.`
  const hasAnalyzedRetentionSchedule = hasRetentionAnalysisResult({
    appendixCount: parsedPlan.retention_appendices.length,
    sourceCount: parsedPlan.retention_sources.length,
  })
  const failedDomain = planAnalysisFailureDomain(planAnalysisFailure)
  const planFailure = failedDomain === "plan" ? planAnalysisFailure : null
  const retentionFailure =
    failedDomain === "retention" ? planAnalysisFailure : null
  const planProcessing = planAnalyzing && doc1State === "processing"
  const retentionProcessing = planAnalyzing && doc2State === "processing"
  const planFailurePanel = planFailure ? (
    <div className="flex flex-col gap-3">
      <ProgressTimeline
        phases={PLAN_PROGRESS_PHASES}
        activePhase={null}
        failedPhase={planFailure.failedPhase}
        completedPhases={planCompletedPhases}
        title="Phân tích phương án thất bại"
        message="Job đã dừng sau khi thử lại nhưng vẫn không thành công."
      />
      <PlanAnalysisFailureAlert
        failure={planFailure}
        onBackToUpload={() => handlePlanStepNavigation(1)}
      />
    </div>
  ) : null
  const goToMetadataStep = () => {
    if (resolvedSessionId) {
      navigate(
        `/sessions/${encodeURIComponent(resolvedSessionId)}/step/3?extract=1`
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
        goTo={handlePlanStepNavigation}
        isWorkerUser={isWorkerUser}
        navigate={navigate}
        onNavigateSessions={handleNavigateToSessions}
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
            onClick={handleNavigateToSessions}
            className="flex items-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-4 py-2 text-sm font-medium text-[#475569] shadow-sm transition-all hover:border-[#0052FF]/30 hover:text-[#0052FF]"
          >
            <Home className="size-4" /> Danh sách session
          </motion.button>
          {currentStep > 1 && !isWorkerUser && (
            <motion.button
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() =>
                handlePlanStepNavigation((currentStep - 1) as AppStep)
              }
              className="flex items-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-4 py-2 text-sm font-medium text-[#475569] shadow-sm transition-all hover:border-[#0052FF]/30 hover:text-[#0052FF]"
            >
              <ArrowLeft className="size-4" /> Quay lại
            </motion.button>
          )}
        </div>

        {resolvedSessionId && currentStep !== 1 && (
          <SessionMetadataBar
            sessionId={resolvedSessionId}
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
              currentSessionId={resolvedSessionId}
              existingSessionMode={existingSessionMode}
              planAnalyzing={planAnalyzing}
              planAnalysisFailure={planAnalysisFailure}
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
              syncFolderSelection={props.syncFolderSelection}
              pendingFolderCount={props.pendingFolderCount}
              hasPendingZip={props.hasPendingZip}
              uploadRetentionInputs={uploadRetentionInputs}
              zipUploadProgress={zipUploadProgress}
              latestUploadInterruption={latestUploadInterruption}
              planReuploadState={planReuploadState}
              ocr={ocr}
              doc1Has={doc1Has}
              doc2Has={doc2Has}
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
              hasPlanReady={hasPlanReady}
              readyCount={readyCount}
              requiredFileCount={requiredFileCount}
              selectedInputLabels={selectedInputLabels}
              primaryActionDisabled={primaryActionDisabled}
              latestUploadWarning={props.latestUploadWarning}
              partialFolderCount={props.partialFolderCount}
              folderRunNeedsMetadataStart={props.folderRunNeedsMetadataStart}
              handleStartAll={handleStartAll}
              planInputsReuploaded={planInputsReuploaded}
              sessionMetadata={sessionMetadata}
              syncSessionMetadataDraft={syncSessionMetadataDraft}
              parsedPlan={parsedPlan}
              dossierTitleCatalogDraftFile={props.dossierTitleCatalogDraftFile}
              dossierTitleCatalogUpload={props.dossierTitleCatalogUpload}
              handleDossierTitleCatalogSelect={
                props.handleDossierTitleCatalogSelect
              }
              handleDossierTitleCatalogClear={
                props.handleDossierTitleCatalogClear
              }
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
              <div className="flex flex-col gap-4">
                {planAnalyzing && !planAnalysisFailure && (
                  <ProgressTimeline
                    phases={PLAN_PROGRESS_PHASES}
                    activePhase={planProgressPhase}
                    completedPhases={planCompletedPhases}
                    title={planProcessingTitle}
                    message={planProcessingMessage}
                  />
                )}
                <section className="flex flex-col gap-4">
                  {hasPlanReady ? (
                    <div className="flex flex-col gap-4">
                      {planFailure && planFailurePanel}
                      <div className="rounded-2xl border border-[#D8E1EC] bg-white p-3 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-5">
                        <div className="px-1 pb-2 sm:pb-0">
                          <p className="text-[11px] font-semibold text-[#64748B] uppercase">
                            Phiên bản phương án
                          </p>
                          <p className="mt-1 text-xs text-[#94A3B8]">
                            Chọn bản đã duyệt hoặc bản đang chỉnh sửa
                          </p>
                        </div>
                        <div
                          className="grid w-full grid-cols-2 gap-1 rounded-xl bg-[#F1F5F9] p-1 sm:w-auto sm:min-w-[430px]"
                          role="tablist"
                          aria-label="Chọn phiên bản phương án"
                        >
                          <button
                            type="button"
                            onClick={() => setPlanViewTab("active")}
                            role="tab"
                            aria-selected={showActivePlanTab}
                            className={cn(
                              "flex min-h-14 items-center gap-2.5 rounded-lg px-3 py-2 text-left transition sm:px-4",
                              showActivePlanTab
                                ? "bg-white text-[#0F172A] shadow-sm ring-1 ring-[#D8E1EC]"
                                : "text-[#64748B] hover:bg-white/70 hover:text-[#0F172A]"
                            )}
                          >
                            <span
                              className={cn(
                                "flex size-8 shrink-0 items-center justify-center rounded-full",
                                showActivePlanTab
                                  ? "bg-[#DCFCE7] text-[#15803D]"
                                  : "bg-white text-[#64748B]"
                              )}
                            >
                              <BadgeCheck className="size-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold">
                                Phương án đã được duyệt
                              </span>
                              <span className="mt-0.5 block text-[11px] font-medium text-[#94A3B8]">
                                Đã duyệt gần nhất
                              </span>
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPlanViewTab("draft")}
                            role="tab"
                            aria-selected={!showActivePlanTab}
                            className={cn(
                              "flex min-h-14 items-center gap-2.5 rounded-lg px-3 py-2 text-left transition sm:px-4",
                              !showActivePlanTab
                                ? "bg-white text-[#0F172A] shadow-sm ring-1 ring-[#D8E1EC]"
                                : "text-[#64748B] hover:bg-white/70 hover:text-[#0F172A]"
                            )}
                          >
                            <span
                              className={cn(
                                "flex size-8 shrink-0 items-center justify-center rounded-full",
                                !showActivePlanTab
                                  ? "bg-[#DBEAFE] text-[#1D4ED8]"
                                  : "bg-white text-[#64748B]"
                              )}
                            >
                              <PenLine className="size-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold">
                                Phương án nháp
                              </span>
                              <span className="mt-0.5 block text-[11px] font-medium text-[#94A3B8]">
                                Bản đang chỉnh sửa
                              </span>
                            </span>
                          </button>
                        </div>
                      </div>
                      {showActivePlanTab ? (
                        hasActivePlanVersion ? (
                          <FolderTree
                            sessionId={resolvedSessionId}
                            tree={activeFolderTree}
                            parsedPlan={activeParsedPlan}
                            fondsName={sessionMetadata?.fonds_name}
                            readOnly
                            hasRetentionSchedule={doc2Has}
                            showRetentionSection={false}
                            showActions={false}
                            dossierBuildStrategy={
                              activePlanSettings.dossierBuildStrategy
                            }
                            dossierTitleCatalogMappingCount={
                              props.dossierTitleCatalogUpload?.mapping_count ??
                              0
                            }
                            onDossierBuildStrategyChange={() => undefined}
                            documentNumberingMode={
                              activePlanSettings.documentNumberingMode
                            }
                            onDocumentNumberingModeChange={() => undefined}
                            documentNumberingStylePreset={
                              activePlanSettings.documentNumberingStylePreset
                            }
                            documentNumberingStyleOverrides={
                              activePlanSettings.documentNumberingStyleOverrides
                            }
                            onDocumentNumberingStylePresetChange={() =>
                              undefined
                            }
                            onDocumentNumberingStyleOverridesChange={() =>
                              undefined
                            }
                            onFileRegisterConfigChange={() => undefined}
                            onChange={() => undefined}
                            onSaveTree={() => undefined}
                            onCriteriaChange={() => undefined}
                            onConfirm={handleConfirmPlan}
                            onContinueToMetadata={
                              handleContinueToExtractMetadata
                            }
                            confirming={confirmingPlan}
                          />
                        ) : (
                          <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white px-6 py-8 text-center shadow-sm">
                            <FileText className="mx-auto size-9 text-[#94A3B8]" />
                            <h2 className="mt-3 text-xl font-semibold text-[#0F172A]">
                              {hasApprovedPlan
                                ? "Không tải được nội dung phương án đã duyệt"
                                : "Chưa có phương án đã duyệt"}
                            </h2>
                            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#64748B]">
                              {hasApprovedPlan
                                ? "Session đã có phiên bản phương án được duyệt, nhưng dữ liệu cây phân loại chưa được tải về. Hãy tải lại session; nếu vẫn còn lỗi, cần kiểm tra dữ liệu phiên bản active."
                                : "Hãy duyệt phương án nháp trước khi lập hồ sơ."}
                            </p>
                          </div>
                        )
                      ) : (
                        <>
                          {planDraftDirty && (
                            <div className="rounded-xl border border-[#FBBF24] bg-[#FFFBEB] px-4 py-3 text-sm font-medium text-[#92400E]">
                              Bản draft hiện tại đang có sự thay đổi. Hãy lưu
                              lại để tránh bị mất thông tin.
                            </div>
                          )}
                          {hasPersistedDraft && (
                            <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 text-sm font-medium text-[#1E3A8A]">
                              Bản draft đang khác so với bản active. Nhấn duyệt
                              để ghi nhận những thay đổi.
                            </div>
                          )}
                          {draftIsActiveFallback &&
                            !planDraftDirty &&
                            !hasPersistedDraft && (
                              <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 text-sm text-[#1E3A8A]">
                                Chưa có draft riêng. Màn hình đang dùng bản
                                active gần nhất làm nền chỉnh sửa.
                              </div>
                            )}
                          {false &&
                            (draftIsActiveFallback ||
                              hasPersistedDraft ||
                              planDraftDirty) && (
                              <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 text-sm text-[#1E3A8A]">
                                {planDraftDirty
                                  ? draftIsActiveFallback
                                    ? "Chưa có draft riêng trên hệ thống. Các thay đổi đang được lưu tạm trên trình duyệt và sẽ tạo draft mới khi bạn rời màn hình hoặc xác nhận phương án."
                                    : "Các thay đổi đang được lưu tạm trên trình duyệt và sẽ tạo draft mới khi bạn rời màn hình hoặc xác nhận phương án."
                                  : hasPersistedDraft
                                    ? "Đây là bản nháp chưa được duyệt. Bạn có thể tiếp tục chỉnh sửa hoặc xác nhận phương án."
                                    : "Chưa có draft riêng. Màn hình đang dùng bản active gần nhất làm nền chỉnh sửa."}
                              </div>
                            )}
                          <FolderTree
                            sessionId={resolvedSessionId}
                            tree={folderTree}
                            parsedPlan={parsedPlan}
                            fondsName={sessionMetadata?.fonds_name}
                            readOnly={false}
                            hasRetentionSchedule={doc2Has}
                            showRetentionSection={false}
                            showActions={false}
                            dossierBuildStrategy={dossierBuildStrategy}
                            dossierTitleCatalogMappingCount={
                              props.dossierTitleCatalogUpload?.mapping_count ??
                              0
                            }
                            onDossierBuildStrategyChange={
                              selectDossierBuildStrategy
                            }
                            documentNumberingMode={documentNumberingMode}
                            onDocumentNumberingModeChange={
                              selectDocumentNumberingModeDraft
                            }
                            documentNumberingStylePreset={
                              documentNumberingStylePreset
                            }
                            documentNumberingStyleOverrides={
                              documentNumberingStyleOverrides
                            }
                            onDocumentNumberingStylePresetChange={
                              selectDocumentNumberingStylePreset
                            }
                            onDocumentNumberingStyleOverridesChange={
                              selectDocumentNumberingStyleOverrides
                            }
                            onFileRegisterConfigChange={saveFileRegisterConfig}
                            onChange={syncFolderTree}
                            onSaveTree={saveFolderTree}
                            onCriteriaChange={savePlanCriterias}
                            onSaveDraft={handleSaveDraft}
                            onConfirm={handleConfirmPlan}
                            onContinueToMetadata={
                              handleContinueToExtractMetadata
                            }
                            savingDraft={savingPlanDraft}
                            confirming={confirmingPlan}
                            planDraftDirty={planDraftDirty}
                            draftDiffersActive={hasPersistedDraft}
                          />
                        </>
                      )}
                    </div>
                  ) : planFailure ? (
                    planFailurePanel
                  ) : planProcessing ? (
                    <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white px-6 py-8 text-center shadow-sm">
                      <FileText className="mx-auto size-9 text-[#94A3B8]" />
                      <h2 className="mt-3 text-xl font-semibold text-[#0F172A]">
                        {planProcessingTitle}
                      </h2>
                      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#64748B]">
                        Hệ thống đã nhận file PAPL và đang chờ kết quả phân
                        tích. Khi job hoàn tất, cây phương án sẽ tự cập nhật tại
                        phần này.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white px-6 py-8 text-center shadow-sm">
                      <FileText className="mx-auto size-9 text-[#94A3B8]" />
                      <h2 className="mt-3 text-xl font-semibold text-[#0F172A]">
                        Chưa có phương án phân loại
                      </h2>
                      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#64748B]">
                        {doc1Has
                          ? "File PAPL đã được upload nhưng chưa có cây phân loại hợp lệ. Bạn có thể upload lại PAPL ở Step 1."
                          : "Hãy upload PAPL ở Step 1 để xem cây phân loại và tiêu chí phân tích."}
                      </p>
                    </div>
                  )}
                </section>

                <section className="flex flex-col gap-4">
                  {retentionFailure && (
                    <div className="flex flex-col gap-3">
                      <ProgressTimeline
                        phases={PLAN_PROGRESS_PHASES}
                        activePhase={null}
                        failedPhase={retentionFailure.failedPhase}
                        completedPhases={planCompletedPhases}
                        title="Phân tích thời hạn bảo quản thất bại"
                        message="Job THBQ đã dừng sau khi thử lại nhưng vẫn không thành công."
                      />
                      <PlanAnalysisFailureAlert
                        failure={retentionFailure}
                        onBackToUpload={() => handlePlanStepNavigation(1)}
                      />
                    </div>
                  )}

                  {hasAnalyzedRetentionSchedule ? (
                    <RetentionAppendicesPanel
                      appendices={parsedPlan.retention_appendices}
                      sources={parsedPlan.retention_sources}
                      hasRetentionSchedule={doc2Has}
                    />
                  ) : (
                    !retentionProcessing &&
                    !retentionFailure && (
                      <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white px-6 py-7 text-center shadow-sm">
                        <FileText className="mx-auto size-8 text-[#94A3B8]" />
                        <h3 className="mt-3 text-base font-semibold text-[#0F172A]">
                          {doc2Has
                            ? "Chưa có kết quả thời hạn bảo quản"
                            : "Chưa có thời hạn bảo quản"}
                        </h3>
                        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#64748B]">
                          {doc2Has
                            ? "File THBQ đã được upload nhưng chưa có phụ lục hoặc nguồn nào được phân tích thành công."
                            : "Hãy upload THBQ ở Step 1 để phân tích phụ lục và nguồn thời hạn bảo quản."}
                        </p>
                      </div>
                    )
                  )}
                </section>

                {hasPlanReady &&
                  (!showActivePlanTab || hasActivePlanVersion) && (
                    <PlanReviewActions
                      readOnly={showActivePlanTab}
                      treeLength={
                        showActivePlanTab
                          ? activeFolderTree.length
                          : folderTree.length
                      }
                      onSaveDraft={
                        showActivePlanTab ? undefined : handleSaveDraft
                      }
                      onConfirm={handleConfirmPlan}
                      onContinueToMetadata={handleContinueToExtractMetadata}
                      savingDraft={savingPlanDraft}
                      confirming={confirmingPlan}
                      planDraftDirty={planDraftDirty}
                      hasRetentionSchedule={
                        doc2Has || hasAnalyzedRetentionSchedule
                      }
                    />
                  )}

                {zipHas && !hasPlanReady && (
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={goToMetadataStep}
                      className="rounded-xl bg-[#0052FF] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0047DB]"
                    >
                      Đi tới extract metadata
                    </button>
                  </div>
                )}
              </div>
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
                sessionId={resolvedSessionId}
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
                metadataReviewedTotal={
                  ocr.status?.metadata_reviewed_documents ?? 0
                }
                metadataWarningTotal={
                  ocr.status?.metadata_warning_documents ?? 0
                }
                metadataPagination={{
                  pagination: ocr.status?.pagination ?? null,
                  pageIndex: ocr.documentPageIndex,
                  pageSize: ocr.documentPageSize,
                  onPageChange: (pageIndex: number) => {
                    ocr.setDocumentPageIndex(pageIndex)
                    void ocr.refreshDocumentsPage({ pageIndex })
                  },
                  onPageSizeChange: (pageSize: number) => {
                    ocr.setDocumentPageSize(pageSize)
                    void ocr.refreshDocumentsPage({ pageIndex: 0 })
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
                sessionId={resolvedSessionId}
                groups={clusterGroups}
                fondsName={sessionMetadata?.fonds_name}
                activePlanVersionId={activePlanVersionId}
                classificationTree={activeFolderTree}
                onFinish={() => {
                  if (!resolvedSessionId) {
                    toast.error("Chưa có session để đánh số trang.")
                    return
                  }
                  navigate(
                    `/sessions/${encodeURIComponent(resolvedSessionId)}/step/5`
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
                sessionId={resolvedSessionId}
                documentNumberingMode={activePlanSettings.documentNumberingMode}
                onDocumentNumberingModeApplied={
                  applyPersistedDocumentNumberingMode
                }
                documentNumberingStylePreset={
                  activePlanSettings.documentNumberingStylePreset
                }
                documentNumberingStyleOverrides={
                  activePlanSettings.documentNumberingStyleOverrides
                }
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
                  if (!resolvedSessionId) {
                    toast.error("Chưa có session để tạo mục lục.")
                    return
                  }
                  navigate(
                    `/sessions/${encodeURIComponent(resolvedSessionId)}/step/6?start=1`
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
                sessionId={resolvedSessionId}
                autoStart={searchParams.get("start") === "1"}
                onAutoStartHandled={handleFinalizeAutoStartHandled}
                embedded
                onContinue={() => {
                  if (!resolvedSessionId) {
                    toast.error("Chưa có session để xuất bản.")
                    return
                  }
                  navigate(
                    `/sessions/${encodeURIComponent(resolvedSessionId)}/step/7`
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
              <PublicationStep sessionId={resolvedSessionId} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
