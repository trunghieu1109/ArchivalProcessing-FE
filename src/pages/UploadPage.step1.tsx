import { motion } from "framer-motion"
import { ArrowRight, CheckCircle2, Loader2, Play } from "lucide-react"
import { ProgressTimeline } from "@/features/upload/components/ProgressTimeline"
import { PlanAnalysisFailureAlert } from "@/features/upload/components/PlanAnalysisFailureAlert"
import { DocxSection } from "@/features/upload/components/step1/DocxSection"
import { UnifiedDataUploadSection } from "@/features/upload/components/step1/UnifiedDataUploadSection"
import { UploadSessionSetupPanel } from "@/features/upload/components/step1/UploadSessionSetupPanel"
import { DossierTitleCatalogSection } from "@/features/upload/components/step1/DossierTitleCatalogSection"
import { cn } from "@/shared/lib/utils"
import { easeOut } from "./UploadPage.planUtils"
import { planAnalysisFailureDomain } from "./UploadPage.progress"
import type { UploadPageStepOneProps } from "./UploadPage.step1.types"
import { canNavigateDirectlyToMetadata } from "./UploadPage.workflowPolicy"

const FOLDER_UPLOAD_ENABLED =
  String(import.meta.env.VITE_FOLDER_UPLOAD_ENABLED ?? "true").toLowerCase() !==
  "false"

export function UploadPageStepOne(props: UploadPageStepOneProps) {
  const {
    existingSessionMode,
    planAnalyzing,
    planAnalysisFailure,
    planProgressMessage,
    PLAN_PROGRESS_PHASES,
    planProgressPhase,
    planCompletedPhases,
    zipRef,
    zipState,
    syncZipState,
    syncZipHas,
    syncZipEntries,
    syncZipFolderPath,
    zipMaxFiles,
    syncZipMaxFiles,
    uploadInput,
    stageZipInput,
    discardStagedZipInput,
    uploadRetentionInputs,
    dossierTitleCatalogDraftFile,
    dossierTitleCatalogUpload,
    handleDossierTitleCatalogSelect,
    handleDossierTitleCatalogClear,
    zipUploadProgress,
    zipUploadFileName,
    zipInterruptionNotice,
    folderInterruptionNotice,
    planReuploadState,
    ocr,
    zipHas,
    allProcessing,
    postUploadDiscoveryPending,
    postUploadDiscoveryMessage,
    sessionLoading,
    uploadMode,
    syncUploadMode,
    doc1Ref,
    doc2Ref,
    doc1State,
    doc2State,
    syncDoc1State,
    syncDoc2State,
    syncDoc1Has,
    syncDoc2Has,
    doc1Has,
    doc2Has,
    statusItems,
    allDone,
    zipSupplementUploaded,
    folderUploadReady,
    folderUploadMetadataNavigationReady,
    folderUploadWasCancelled,
    folderUploadEffectiveCount,
    hasAnyFile,
    hasPlanReady,
    readyCount,
    requiredFileCount,
    selectedInputLabels,
    primaryActionDisabled,
    primaryActionAvailable,
    primaryActionPending,
    handleStartAll,
    planInputsReuploaded,
    sessionMetadata,
    syncSessionMetadataDraft,
    sessionId,
    ensureSession,
    openZipUpload,
    zipUploadFocusKey,
    openFolderUpload,
    folderUploadFocusKey,
    dataUploadRef,
    pendingDataUpload,
    onPendingDataUploadChange,
  } = props
  const zipUploadStatus = zipUploadProgress
    ? zipUploadProgress.phase === "error"
      ? "Upload ZIP thất bại"
      : zipUploadProgress.phase === "done"
        ? "Đã extract file ZIP xong."
        : zipUploadProgress.phase === "processing"
          ? "Đang extract file ZIP..."
          : "Đang upload ZIP..."
    : ""
  const zipUploadDetail = zipUploadProgress
    ? zipUploadProgress.percent !== null
      ? `${zipUploadProgress.percent}%`
      : `${zipUploadProgress.loadedMb.toFixed(2)} MB`
    : ""
  const planReanalysisActionLabel = planReuploadState?.retention
    ? planReuploadState?.arrangement
      ? "Phân tích lại phương án và thời hạn"
      : "Phân tích thời hạn bảo quản"
    : "Phân tích lại phương án"
  const retentionOnlyProcessing =
    planAnalyzing && doc2State === "processing" && doc1State !== "processing"
  const progressTitle =
    retentionOnlyProcessing ||
    (planReuploadState?.retention && !planReuploadState?.arrangement)
      ? "Phân tích thời hạn bảo quản"
      : "Phân tích phương án"
  const failureDomain = planAnalysisFailureDomain(planAnalysisFailure)
  const failureTitle =
    failureDomain === "retention"
      ? "Phân tích thời hạn bảo quản thất bại"
      : "Phân tích phương án phân loại thất bại"
  const hasPlanInputs = doc1Has || doc2Has
  const metadataIsNextStep = canNavigateDirectlyToMetadata(doc1Has, doc2Has)
  const planStepActionLabel = hasPlanReady
    ? "Xem phương án phân loại"
    : doc1Has && doc2Has
      ? "Phân tích phương án và thời hạn"
      : doc1Has
        ? "Phân tích phương án phân loại"
        : "Phân tích thời hạn bảo quản"
  return (
    <motion.div
      key="step1"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.4, ease: easeOut }}
      className="flex flex-col gap-4"
    >
      <UploadSessionSetupPanel
        existingSessionMode={existingSessionMode}
        allProcessing={allProcessing}
        sessionLoading={sessionLoading}
        sessionMetadata={sessionMetadata}
        syncSessionMetadataDraft={syncSessionMetadataDraft}
        uploadMode={uploadMode}
        syncUploadMode={syncUploadMode}
      />

      {planAnalysisFailure && (
        <div className="flex flex-col gap-3">
          <ProgressTimeline
            phases={PLAN_PROGRESS_PHASES}
            activePhase={null}
            failedPhase={planAnalysisFailure.failedPhase}
            completedPhases={planCompletedPhases}
            title={failureTitle}
            message="Job đã dừng sau khi thử lại nhưng vẫn không thành công."
          />
          <PlanAnalysisFailureAlert failure={planAnalysisFailure} />
        </div>
      )}

      {!planAnalysisFailure && (planAnalyzing || planProgressMessage) && (
        <ProgressTimeline
          phases={PLAN_PROGRESS_PHASES}
          activePhase={planProgressPhase}
          completedPhases={planCompletedPhases}
          title={progressTitle}
          message={
            planProgressMessage || "Backend đang phân tích phương án chỉnh lý."
          }
        />
      )}

      <UnifiedDataUploadSection
        ref={dataUploadRef}
        folderUploadEnabled={FOLDER_UPLOAD_ENABLED}
        sessionId={sessionId}
        ensureSession={ensureSession}
        uploadMode={uploadMode}
        disabled={allProcessing || sessionLoading}
        zipRef={zipRef}
        zipState={zipState}
        syncZipState={syncZipState}
        syncZipHas={syncZipHas}
        syncZipEntries={syncZipEntries}
        syncZipFolderPath={syncZipFolderPath}
        zipMaxFiles={zipMaxFiles}
        syncZipMaxFiles={syncZipMaxFiles}
        uploadZip={stageZipInput}
        discardStagedZip={discardStagedZipInput}
        zipUploadProgress={zipUploadProgress}
        zipUploadFileName={zipUploadFileName}
        zipInterruptionNotice={zipInterruptionNotice}
        folderInterruptionNotice={folderInterruptionNotice}
        ocr={ocr}
        openZipUpload={openZipUpload}
        zipUploadFocusKey={zipUploadFocusKey}
        openFolderUpload={openFolderUpload}
        folderUploadFocusKey={folderUploadFocusKey}
        onPendingUploadChange={onPendingDataUploadChange}
      />

      {/* DOCX */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DocxSection
          ref={doc1Ref}
          index={1}
          label="Phương án phân loại"
          sublabel={
            existingSessionMode
              ? "Tải lại file Word chứa phương án phân loại để phân tích lại session."
              : "Tải lên file Word chứa phương án phân loại tài liệu."
          }
          processState={doc1State}
          onProcessStateChange={syncDoc1State}
          onHasFileChange={syncDoc1Has}
          uploadCompleteState={existingSessionMode ? "done" : "idle"}
          onUploadFile={(file) =>
            uploadInput("arrangement_plan", file).then(() => undefined)
          }
        />
        <DocxSection
          ref={doc2Ref}
          index={2}
          label="Thêm thông tư thời hạn bảo quản"
          sublabel={
            existingSessionMode
              ? "Bổ sung file Word chứa thông tư thời hạn bảo quản."
              : "Thêm file Word chứa thông tư thời hạn bảo quản."
          }
          processState={doc2State}
          onProcessStateChange={syncDoc2State}
          onHasFileChange={syncDoc2Has}
          uploadCompleteState={existingSessionMode ? "done" : "idle"}
          multiple
          onUploadFiles={(files) =>
            uploadRetentionInputs(files).then(() => undefined)
          }
        />
      </div>

      <DossierTitleCatalogSection
        draftFile={dossierTitleCatalogDraftFile}
        upload={dossierTitleCatalogUpload}
        disabled={allProcessing || sessionLoading}
        onSelect={handleDossierTitleCatalogSelect}
        onClear={handleDossierTitleCatalogClear}
      />

      {/* Action bar */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: easeOut, delay: 0.3 }}
        className="grid grid-cols-1 items-stretch gap-4 rounded-2xl border border-border bg-card px-4 py-4 shadow-sm sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
      >
        <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:gap-4">
          <div className="flex shrink-0 flex-wrap gap-2">
            {statusItems.map(
              (
                s: {
                  label: string
                  has: boolean
                  state: string
                },
                i: number
              ) => (
                <div
                  key={i}
                  className={cn(
                    "flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 font-roboto text-[11px] font-semibold tracking-[0.1em] whitespace-nowrap uppercase transition-all duration-200",
                    s.state === "done"
                      ? "text-primary-foreground"
                      : s.has
                        ? "border border-border bg-muted text-foreground"
                        : "border border-border bg-transparent text-muted-foreground"
                  )}
                  style={
                    s.state === "done"
                      ? {
                          background:
                            "linear-gradient(to right, #0052FF, #4D7CFF)",
                        }
                      : {}
                  }
                >
                  <div
                    className={cn(
                      "size-1.5 rounded-full",
                      s.state === "done"
                        ? "bg-white"
                        : s.has
                          ? "bg-primary"
                          : "bg-muted-foreground/40"
                    )}
                  />
                  {s.label}
                </div>
              )
            )}
          </div>
          <div className="min-w-0 text-sm font-medium [&>span]:max-w-full [&>span]:min-w-0">
            {sessionLoading ? (
              <span className="flex min-w-0 items-center gap-1.5 truncate text-muted-foreground">
                <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />{" "}
                Đang tải lại trạng thái session...
              </span>
            ) : postUploadDiscoveryPending ? (
              <span className="flex min-w-0 items-center gap-1.5 truncate text-muted-foreground">
                <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
                {postUploadDiscoveryMessage}
              </span>
            ) : pendingDataUpload ? (
              <span className="block truncate text-muted-foreground">
                Đã chọn{" "}
                <span className="font-bold text-foreground">
                  {pendingDataUpload.label}
                </span>
                . Nhấn nút bên phải để bắt đầu upload.
              </span>
            ) : allDone ? (
              <span className="flex min-w-0 items-center gap-1.5 truncate text-primary">
                <CheckCircle2 className="size-4 shrink-0" /> Phương án đã sẵn
                sàng
              </span>
            ) : planAnalyzing ? (
              <span className="flex min-w-0 items-center gap-1.5 truncate text-muted-foreground">
                <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />{" "}
                {retentionOnlyProcessing
                  ? "Đang phân tích thời hạn bảo quản..."
                  : "Đang phân tích phương án..."}
              </span>
            ) : zipUploadProgress ? (
              <span className="flex min-w-0 items-center gap-1.5 overflow-hidden text-muted-foreground">
                {zipUploadProgress.phase === "done" ? (
                  <CheckCircle2 className="size-4 shrink-0 text-primary" />
                ) : (
                  <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
                )}
                <span className="min-w-0 truncate">{zipUploadStatus}</span>
                {zipUploadDetail ? (
                  <span className="min-w-0 truncate font-bold text-foreground">
                    {zipUploadDetail}
                  </span>
                ) : null}
              </span>
            ) : allProcessing ? (
              <span className="flex min-w-0 items-center gap-1.5 truncate text-muted-foreground">
                <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />{" "}
                Đang xử lý tệp...
              </span>
            ) : existingSessionMode &&
              folderUploadReady &&
              folderUploadWasCancelled ? (
              <span className="block truncate text-muted-foreground">
                Lần upload đã hủy nhưng có {folderUploadEffectiveCount} tài liệu
                sẵn sàng xử lý.
              </span>
            ) : folderUploadMetadataNavigationReady ? (
              <span className="block truncate text-muted-foreground">
                Folder đã upload xong. Nhấn nút bên phải để chuyển sang màn hình
                Extract Metadata.
              </span>
            ) : existingSessionMode &&
              metadataIsNextStep &&
              zipSupplementUploaded ? (
              <span className="block truncate text-muted-foreground">
                ZIP bổ sung đã upload xong. Nhấn nút bên phải để extract
                metadata.
              </span>
            ) : hasAnyFile ? (
              <span className="block truncate text-muted-foreground">
                Đã chọn:{" "}
                <span className="font-bold text-foreground">
                  {(selectedInputLabels ?? []).join(", ")}
                </span>
              </span>
            ) : Boolean(readyCount) && !readyCount ? (
              <span className="block truncate text-muted-foreground">
                <span className="font-bold text-foreground">{readyCount}</span>{" "}
                / {requiredFileCount} mục sẵn sàng
              </span>
            ) : (
              <span className="block truncate text-muted-foreground">
                {existingSessionMode
                  ? "Có thể bỏ qua bước tải ZIP để xem phương án"
                  : "Chọn ít nhất 1 file để bắt đầu"}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          disabled={primaryActionDisabled}
          onClick={handleStartAll}
          className={cn(
            "group flex h-12 w-full min-w-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-all duration-200 sm:w-auto sm:min-w-44 lg:max-w-[16rem]",
            !primaryActionDisabled
              ? "text-primary-foreground hover:-translate-y-0.5 active:scale-[0.98]"
              : "cursor-not-allowed bg-muted text-muted-foreground"
          )}
          style={
            !primaryActionDisabled
              ? {
                  background: "linear-gradient(to right, #0052FF, #4D7CFF)",
                  boxShadow: "0 4px 14px rgba(0,82,255,0.25)",
                }
              : {}
          }
        >
          {primaryActionPending ||
          allProcessing ||
          postUploadDiscoveryPending ||
          sessionLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : allDone && !pendingDataUpload ? (
            <CheckCircle2 className="size-4" />
          ) : (
            <Play className="size-4" />
          )}
          <span className="min-w-0 truncate whitespace-nowrap">
            {sessionLoading
              ? "Đang tải..."
              : postUploadDiscoveryPending
                ? postUploadDiscoveryMessage
                : primaryActionPending
                  ? "Đang xử lý..."
                  : !primaryActionAvailable
                    ? "Chọn dữ liệu để bắt đầu"
                    : planAnalyzing
                      ? existingSessionMode
                        ? "Xem trạng thái phân tích"
                        : "Đang phân tích..."
                      : allProcessing
                        ? "Đang xử lý..."
                        : pendingDataUpload?.kind === "zip"
                          ? "Bắt đầu upload ZIP"
                          : pendingDataUpload?.kind === "folder"
                            ? `Bắt đầu upload ${pendingDataUpload.fileCount} PDF`
                            : planInputsReuploaded
                              ? planReanalysisActionLabel
                              : metadataIsNextStep &&
                                  folderUploadReady &&
                                  folderUploadWasCancelled
                                ? `Xử lý ${folderUploadEffectiveCount} tài liệu đã tải thành công`
                                : folderUploadMetadataNavigationReady
                                  ? "Chuyển sang Extract Metadata"
                                  : existingSessionMode &&
                                      metadataIsNextStep &&
                                      zipSupplementUploaded
                                    ? "Chuyển sang Extract Metadata"
                                    : existingSessionMode &&
                                        metadataIsNextStep &&
                                        zipHas &&
                                        !hasPlanReady
                                      ? "Chuyển sang Extract Metadata"
                                      : existingSessionMode && hasPlanInputs
                                        ? planStepActionLabel
                                        : allDone
                                          ? "Tiếp tục"
                                          : existingSessionMode
                                            ? "Tiếp tục"
                                            : "Bắt đầu xử lý"}
          </span>
          {!primaryActionDisabled && (
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          )}
        </button>
      </motion.div>

      {/* Footer security note */}
      <p className="flex items-center justify-center gap-1.5 text-xs text-[#94A3B8]">
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        Dữ liệu của bạn được bảo mật và chỉ sử dụng cho mục đích xử lý tài liệu.
      </p>
    </motion.div>
  )
}
