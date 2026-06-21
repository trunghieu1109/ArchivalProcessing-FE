import { useEffect, useRef, useState } from "react"
import { useCallback } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { useAuth } from "@/features/auth/lib/AuthContext"
import type { SessionMetadataValues } from "@/features/upload/components/SessionMetadataBar"
import {
  ensureClusterBuild,
  listSessionEvents,
  type DossierBuildStrategy,
  type DocumentNumberingMode,
  type UploadMode,
  type UploadProgressSnapshot,
} from "@/features/upload/api/sessionApi"
import type {
  ProcessState,
  SectionHandle,
  ArchiveEntry,
  FolderNode,
  ParsedPlan,
  AppStep,
} from "@/features/upload/types"
import type { ClusterGroup } from "@/features/upload/lib/clusterGroups"

import { UploadPageView } from "./UploadPage.view"
import { createConfirmPlanHandler } from "./UploadPage.confirmPlan"
import { createUploadPageWorkflowActions } from "./UploadPage.workflow"
import { createUploadPageActions } from "./UploadPage.actions"
import { useUploadPageOcr } from "./UploadPage.ocr"
import { useUploadPageLifecycle } from "./UploadPage.lifecycle"
import { uploadPageCache as cache } from "./UploadPage.cache"
import {
  PLAN_PROGRESS_PHASES,
  STEP_LABELS,
  normalizePlanProgressPhase,
  planProgressMessageForPhase,
} from "./UploadPage.progress"
import {
  dossierBuildMissingLabels,
  dossierBuildMissingMessage,
  missingDossierBuildInputs,
  selectedUploadLabels,
} from "./UploadPage.requirements"

export function UploadPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { step, sessionId: routeSessionId } = useParams<{
    step: string
    sessionId?: string
  }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const existingSessionMode = Boolean(routeSessionId)
  const currentStep = Math.min(
    Math.max(parseInt(step ?? "1", 10), 1),
    7
  ) as AppStep
  const currentUserRole = String(user?.role ?? "")
    .trim()
    .toLowerCase()
  const isWorkerUser = currentUserRole === "worker"

  const goTo = (
    s: AppStep,
    targetSessionId = routeSessionId ?? cache.sessionId
  ) => {
    if (targetSessionId)
      navigate(`/sessions/${encodeURIComponent(targetSessionId)}/step/${s}`)
    else navigate(`/sessions/new/step/${s}`)
  }

  const handleContinueToResults = async (groups: ClusterGroup[]) => {
    cache.clusterGroups = groups
    setClusterGroups(groups)
    const currentSessionId = sessionId ?? routeSessionId ?? cache.sessionId
    if (!currentSessionId) {
      toast.error("Chưa có session để lập hồ sơ.")
      return
    }
    const hasAnalyzedPlanForBuild =
      Boolean(cache.activePlanVersionId) &&
      doc1Has &&
      parsedPlan.groups.length > 0
    const missingInputs = missingDossierBuildInputs({
      hasArrangementPlan: doc1Has,
      hasRetentionSchedule: doc2Has,
      hasRawZip: zipHas,
      hasActivePlan: hasAnalyzedPlanForBuild,
    })
    if (missingInputs.length > 0) {
      toast.error(dossierBuildMissingMessage(missingInputs))
      return
    }

    try {
      const response = await ensureClusterBuild(currentSessionId, {
        source: "user_view_results",
        dossier_build_strategy: dossierBuildStrategy,
      })
      if (response.status === "queued") {
        toast.success("Đã gửi task lập hồ sơ từ tài liệu đã xác nhận.")
      } else if (response.status === "already_queued_or_running") {
        toast.info("Task lập hồ sơ đang được xử lý.")
      } else {
        toast.info("Hồ sơ đã được lập với dữ liệu mới nhất.")
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? `Không gửi được task lập hồ sơ: ${err.message}`
          : "Không gửi được task lập hồ sơ."
      )
      return
    }

    goTo(4, currentSessionId)
  }

  const handleFinalizeAutoStartHandled = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete("start")
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])

  const doc1Ref = useRef<SectionHandle>(null)
  const doc2Ref = useRef<SectionHandle>(null)
  const zipRef = useRef<SectionHandle>(null)
  const metadataAutoStartRef = useRef(false)

  const [doc1State, setDoc1State] = useState<ProcessState>(cache.doc1State)
  const [doc2State, setDoc2State] = useState<ProcessState>(cache.doc2State)
  const [zipState, setZipState] = useState<ProcessState>(cache.zipState)
  const [planAnalysisState, setPlanAnalysisState] = useState<ProcessState>(
    cache.planAnalysisState
  )
  const [dossierBuildStrategy, setDossierBuildStrategy] =
    useState<DossierBuildStrategy>(cache.dossierBuildStrategy)
  const [documentNumberingMode, setDocumentNumberingMode] =
    useState<DocumentNumberingMode>(cache.documentNumberingMode)

  const [doc1Has, setDoc1Has] = useState(cache.doc1Has)
  const [doc2Has, setDoc2Has] = useState(cache.doc2Has)
  const [zipHas, setZipHas] = useState(cache.zipHas)

  const [, setZipEntries] = useState<ArchiveEntry[]>(cache.zipEntries)
  const [folderTree, setFolderTree] = useState<FolderNode[]>(cache.folderTree)
  const [parsedPlan, setParsedPlan] = useState<ParsedPlan>(cache.parsedPlan)
  const [clusterGroups, setClusterGroups] = useState<ClusterGroup[]>(
    cache.clusterGroups
  )
  const [sessionId, setSessionId] = useState<string | null>(cache.sessionId)
  const [sessionMetadata, setSessionMetadata] = useState<SessionMetadataValues>(
    cache.sessionMetadata
  )
  const [zipFolderPath, setZipFolderPath] = useState(cache.zipFolderPath)
  const [zipMaxFiles, setZipMaxFiles] = useState(cache.zipMaxFiles)
  const [zipUploadProgress, setZipUploadProgress] =
    useState<UploadProgressSnapshot | null>(cache.zipUploadProgress)
  const [sessionLoading, setSessionLoading] = useState(false)
  const [confirmingPlan, setConfirmingPlan] = useState(false)
  const [planProgressPhase, setPlanProgressPhase] = useState<string | null>(
    null
  )
  const [planProgressMessage, setPlanProgressMessage] = useState("")
  const [planCompletedPhases, setPlanCompletedPhases] = useState<Set<string>>(
    () => new Set()
  )
  const [planReuploadState, setPlanReuploadState] = useState(() => ({
    arrangement: cache.arrangementPlanReuploaded,
    retention: cache.retentionReuploaded,
  }))
  const [zipSupplementUploaded, setZipSupplementUploaded] = useState(
    cache.rawZipReuploaded
  )
  const [uploadMode, setUploadModeState] = useState<UploadMode>(
    cache.uploadMode
  )

  const { syncSessionMetadata } = useUploadPageLifecycle({
    currentStep,
    isWorkerUser,
    navigate,
    routeSessionId,
    sessionId,
    setDoc1State,
    setDoc2State,
    setZipState,
    setPlanAnalysisState,
    setDossierBuildStrategy,
    setDocumentNumberingMode,
    setDoc1Has,
    setDoc2Has,
    setZipHas,
    setZipEntries,
    setFolderTree,
    setParsedPlan,
    setClusterGroups,
    setSessionId,
    setSessionMetadata,
    setZipFolderPath,
    setZipMaxFiles,
    setZipUploadProgress,
    setUploadModeState,
    setPlanReuploadState,
    setZipSupplementUploaded,
    setPlanProgressPhase,
    setPlanProgressMessage,
    setPlanCompletedPhases,
    setSessionLoading,
  })

  const {
    ocr,
    ocrMetadataItems,
    ocrPdfPaths,
    ocrSignatureStatus,
    ocrIsReextracting,
    ocrMessage,
    ocrLoading,
  } = useUploadPageOcr(sessionId, { enabled: currentStep === 3 })

  useEffect(() => {
    if (!sessionId || planAnalysisState !== "processing") return

    let cancelled = false
    let afterId = 0
    let timeoutId: number | undefined

    const poll = async () => {
      try {
        const response = await listSessionEvents(sessionId, {
          afterId,
          limit: 100,
        })
        if (cancelled) return
        for (const event of response.events) {
          afterId = Math.max(afterId, event.id)
          if (event.event_type === "plan.analysis.progress") {
            const phase = normalizePlanProgressPhase(event.payload?.phase)
            if (phase) {
              setPlanProgressPhase(phase)
              setPlanCompletedPhases(() => {
                const next = new Set<string>()
                const phaseIndex = PLAN_PROGRESS_PHASES.findIndex(
                  (item) => item.id === phase
                )
                PLAN_PROGRESS_PHASES.slice(0, Math.max(phaseIndex, 0)).forEach(
                  (item) => next.add(item.id)
                )
                return next
              })
            }
            if (phase)
              setPlanProgressMessage(planProgressMessageForPhase(phase))
          }
          if (event.event_type === "plan.analysis.completed") {
            setPlanProgressPhase(null)
            setPlanCompletedPhases(
              new Set(PLAN_PROGRESS_PHASES.map((phase) => phase.id))
            )
            setPlanProgressMessage("Đã phân tích xong phương án chỉnh lý.")
          }
        }
      } catch {
        // Progress events are best-effort; the active-plan polling owns errors.
      }
      if (!cancelled) {
        timeoutId = window.setTimeout(poll, 1_500)
      }
    }

    void poll()
    return () => {
      cancelled = true
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [planAnalysisState, sessionId])

  const {
    ensureSession,
    saveSessionMetadata,
    uploadInput,
    syncZipFolderPath,
    syncZipMaxFiles,
    syncUploadMode,
    syncZipUploadProgress,
    zipUploadProgressForFile,
    syncPlanAnalysisState,
    applyPersistedDossierBuildStrategy,
    selectDossierBuildStrategy,
    applyPersistedDocumentNumberingMode,
    applyActivePlanResponse,
    selectDocumentNumberingMode,
    syncDoc1Has,
    syncDoc2Has,
    syncZipHas,
    syncZipEntries,
    syncFolderTree,
    savePlanCriterias,
    saveFileRegisterConfig,
    saveFolderTree,
    syncDoc1State,
    syncDoc2State,
    syncZipState,
    parseZipMaxFiles,
  } = createUploadPageActions({
    routeSessionId,
    sessionId,
    existingSessionMode,
    zipMaxFiles,
    syncSessionMetadata,
    setSessionId,
    setPlanAnalysisState,
    setZipSupplementUploaded,
    setPlanReuploadState,
    setDoc1State,
    setDoc2State,
    setZipFolderPath,
    setZipMaxFiles,
    setUploadModeState,
    setZipUploadProgress,
    setDossierBuildStrategy,
    setDocumentNumberingMode,
    setDoc1Has,
    setDoc2Has,
    setZipHas,
    setZipEntries,
    setFolderTree,
    setParsedPlan,
    setZipState,
    setPlanProgressPhase,
    setPlanProgressMessage,
    setPlanCompletedPhases,
  })

  const planInputsReuploaded =
    planReuploadState.arrangement || planReuploadState.retention
  const planReanalysisReady = existingSessionMode && planInputsReuploaded
  const hasAnyFile = doc1Has || doc2Has || zipHas
  const hasActivePlan = Boolean(cache.activePlanVersionId)
  const hasAnalyzedArrangementPlan =
    planAnalysisState === "done" &&
    hasActivePlan &&
    doc1Has &&
    parsedPlan.groups.length > 0
  const missingDossierInputs = missingDossierBuildInputs({
    hasArrangementPlan: doc1Has,
    hasRetentionSchedule: doc2Has,
    hasRawZip: zipHas,
    hasActivePlan: hasAnalyzedArrangementPlan,
  })
  const missingDossierInputLabels =
    dossierBuildMissingLabels(missingDossierInputs)
  const selectedInputLabels = selectedUploadLabels({
    hasArrangementPlan: doc1Has,
    hasRetentionSchedule: doc2Has,
    hasRawZip: zipHas,
  })
  const readyCount = (
    existingSessionMode
      ? planInputsReuploaded
        ? [planInputsReuploaded]
        : [zipHas]
      : [doc1Has, doc2Has, zipHas]
  ).filter(Boolean).length
  const requiredFileCount = existingSessionMode ? 1 : 3
  const statusItems = existingSessionMode
    ? [
        {
          label: "Phương án",
          has: hasAnalyzedArrangementPlan,
          state:
            planAnalysisState === "processing"
              ? "processing"
              : hasAnalyzedArrangementPlan
                ? "done"
                : "idle",
        },
        { label: "Tệp phương án", has: doc1Has, state: doc1State },
        { label: "Thời hạn", has: doc2Has, state: doc2State },
        { label: "Kho lưu trữ", has: zipHas, state: zipState },
      ]
    : [
        { label: "Phương án", has: doc1Has, state: doc1State },
        { label: "Thời hạn", has: doc2Has, state: doc2State },
        { label: "Kho lưu trữ", has: zipHas, state: zipState },
      ]
  const planAnalyzing = planAnalysisState === "processing"
  const zipUploadInProgress =
    zipUploadProgress !== null &&
    zipUploadProgress.phase !== "done" &&
    zipUploadProgress.phase !== "error"
  const zipProcessingBlocksAction =
    zipUploadInProgress || (!existingSessionMode && zipState === "processing")
  const allProcessing =
    planAnalyzing ||
    doc1State === "processing" ||
    doc2State === "processing" ||
    zipProcessingBlocksAction
  const allDone = hasAnalyzedArrangementPlan && !planInputsReuploaded
  const primaryActionDisabled = allProcessing || sessionLoading

  const startMetadataExtractionFromZip = useCallback(async () => {
    const currentSessionId = sessionId ?? routeSessionId ?? cache.sessionId
    if (!currentSessionId) {
      toast.error("Chưa có session để extract metadata.")
      return
    }
    const folderPath =
      zipFolderPath ||
      cache.zipUpload?.folder_path ||
      cache.zipUpload?.data_path ||
      ""
    if (!folderPath) {
      toast.error("Chưa có folder_path để bắt đầu lấy metadata.")
      return
    }
    if (cache.zipUpload && !cache.zipUpload.remote_batch_id) {
      toast.error(
        "File ZIP chưa được upload lên Chỉnh Lý/MinIO. Vui lòng tải lại file ZIP."
      )
      return
    }

    let maxFilesToProcess: number | undefined
    try {
      maxFilesToProcess = parseZipMaxFiles()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Số lượng tài liệu không hợp lệ."
      )
      return
    }

    let existingStatus = ocr.status ?? null
    if (!existingStatus) {
      try {
        existingStatus = await ocr.refresh()
      } catch {
        existingStatus = null
      }
    }
    if ((existingStatus?.jobs.length ?? 0) > 0) {
      const hasPendingMetadata = existingStatus?.jobs.some(
        (job) => !job.metadata_ready && job.status !== "failed"
      )
      syncZipState(hasPendingMetadata ? "processing" : "done")
      toast.info("Session đã có job extract metadata. Không tạo job mới.")
      return
    }

    syncZipState("processing")
    toast.success("Bắt đầu lấy metadata.")
    void ocr
      .start(folderPath, {
        maxFiles: maxFilesToProcess,
        documentNumberingMode,
        sessionFileId: cache.zipUpload?.id,
        remoteFileId: cache.zipUpload?.remote_file_id ?? null,
        uploadMode: cache.zipUpload ? uploadMode : undefined,
        previousStatus: ocr.status ?? null,
      })
      .then(() => {
        syncZipState("done")
        toast.success("Đã hoàn tất lấy metadata từ remote folder.")
      })
      .catch((err: unknown) => {
        syncZipState("idle")
        toast.error(
          err instanceof Error ? err.message : "Không thể bắt đầu OCR."
        )
      })
  }, [
    documentNumberingMode,
    ocr,
    parseZipMaxFiles,
    routeSessionId,
    sessionId,
    syncZipState,
    uploadMode,
    zipFolderPath,
  ])

  useEffect(() => {
    if (currentStep !== 3) return
    if (searchParams.get("extract") !== "1") {
      metadataAutoStartRef.current = false
      return
    }
    if (!sessionId || !zipHas) return
    if (metadataAutoStartRef.current) return

    metadataAutoStartRef.current = true
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete("extract")
    setSearchParams(nextParams, { replace: true })
    void startMetadataExtractionFromZip()
  }, [
    currentStep,
    searchParams,
    sessionId,
    setSearchParams,
    startMetadataExtractionFromZip,
    zipHas,
  ])

  const handleConfirmPlan = createConfirmPlanHandler({
    confirmingPlan,
    planAnalysisState,
    dossierBuildStrategy,
    documentNumberingMode,
    zipFolderPath,
    existingSessionMode,
    uploadMode,
    zipSupplementUploaded,
    ocr,
    applyActivePlanResponse,
    applyPersistedDossierBuildStrategy,
    applyPersistedDocumentNumberingMode,
    parseZipMaxFiles,
    syncZipState,
    goTo,
    setParsedPlan,
    setFolderTree,
    setClusterGroups,
    setConfirmingPlan,
    setZipSupplementUploaded,
  })

  const { handleStartAll } = createUploadPageWorkflowActions({
    sessionId,
    routeSessionId,
    existingSessionMode,
    zipSupplementUploaded,
    planInputsReuploaded,
    allDone,
    hasActivePlan: hasAnalyzedArrangementPlan,
    planReanalysisReady,
    planReuploadState,
    dossierBuildStrategy,
    doc1Has,
    doc2Has,
    zipHas,
    doc1Ref,
    doc2Ref,
    navigate,
    ensureSession,
    handleConfirmPlan,
    syncSessionMetadata,
    syncPlanAnalysisState,
    syncDoc1State,
    syncDoc2State,
    syncZipState,
    syncZipUploadProgress,
    zipUploadProgressForFile,
    syncZipFolderPath,
    applyPersistedDossierBuildStrategy,
    applyPersistedDocumentNumberingMode,
    goTo,
    setPlanCompletedPhases,
    setPlanProgressPhase,
    setPlanProgressMessage,
    setParsedPlan,
    setFolderTree,
    setClusterGroups,
    setPlanReuploadState,
  })

  return (
    <UploadPageView
      currentStep={currentStep}
      existingSessionMode={existingSessionMode}
      routeSessionId={routeSessionId}
      sessionId={sessionId}
      sessionMetadata={sessionMetadata}
      saveSessionMetadata={saveSessionMetadata}
      sessionLoading={sessionLoading}
      STEP_LABELS={STEP_LABELS}
      PLAN_PROGRESS_PHASES={PLAN_PROGRESS_PHASES}
      goTo={goTo}
      statusItems={statusItems}
      readyCount={readyCount}
      requiredFileCount={requiredFileCount}
      selectedInputLabels={selectedInputLabels}
      hasAnyFile={hasAnyFile}
      allProcessing={allProcessing}
      allDone={allDone}
      primaryActionDisabled={primaryActionDisabled}
      handleStartAll={handleStartAll}
      doc1Ref={doc1Ref}
      doc2Ref={doc2Ref}
      zipRef={zipRef}
      doc1Has={doc1Has}
      doc2Has={doc2Has}
      zipHas={zipHas}
      hasActivePlan={hasActivePlan}
      hasAnalyzedArrangementPlan={hasAnalyzedArrangementPlan}
      doc1State={doc1State}
      doc2State={doc2State}
      zipState={zipState}
      planAnalysisState={planAnalysisState}
      planAnalyzing={planAnalyzing}
      planProgressPhase={planProgressPhase}
      planCompletedPhases={planCompletedPhases}
      planProgressMessage={planProgressMessage}
      ocr={ocr}
      syncDoc1Has={syncDoc1Has}
      syncDoc2Has={syncDoc2Has}
      syncZipHas={syncZipHas}
      uploadInput={uploadInput}
      syncDoc1State={syncDoc1State}
      syncDoc2State={syncDoc2State}
      syncZipState={syncZipState}
      syncZipEntries={syncZipEntries}
      zipFolderPath={zipFolderPath}
      syncZipFolderPath={syncZipFolderPath}
      zipMaxFiles={zipMaxFiles}
      syncZipMaxFiles={syncZipMaxFiles}
      uploadMode={uploadMode}
      syncUploadMode={syncUploadMode}
      zipUploadProgress={zipUploadProgress}
      planReuploadState={planReuploadState}
      planInputsReuploaded={planInputsReuploaded}
      zipSupplementUploaded={zipSupplementUploaded}
      parsedPlan={parsedPlan}
      folderTree={folderTree}
      dossierBuildStrategy={dossierBuildStrategy}
      selectDossierBuildStrategy={selectDossierBuildStrategy}
      documentNumberingMode={documentNumberingMode}
      selectDocumentNumberingMode={selectDocumentNumberingMode}
      saveFileRegisterConfig={saveFileRegisterConfig}
      syncFolderTree={syncFolderTree}
      saveFolderTree={saveFolderTree}
      savePlanCriterias={savePlanCriterias}
      handleConfirmPlan={handleConfirmPlan}
      confirmingPlan={confirmingPlan}
      ocrPdfPaths={ocrPdfPaths}
      ocrMetadataItems={ocrMetadataItems}
      ocrLoading={ocrLoading}
      ocrIsReextracting={ocrIsReextracting}
      ocrMessage={ocrMessage}
      ocrSignatureStatus={ocrSignatureStatus}
      handleContinueToResults={handleContinueToResults}
      missingDossierInputs={missingDossierInputs}
      missingDossierInputLabels={missingDossierInputLabels}
      dossierBuildBlockedMessage={dossierBuildMissingMessage(
        missingDossierInputs
      )}
      clusterGroups={clusterGroups}
      handleFinalizeAutoStartHandled={handleFinalizeAutoStartHandled}
      searchParams={searchParams}
      isWorkerUser={isWorkerUser}
      navigate={navigate}
    />
  )
}
