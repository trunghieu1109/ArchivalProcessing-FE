import { useEffect } from "react"
import { toast } from "sonner"
import {
  getActivePlan,
  getReviewPlan,
  getSession,
  type ActiveJobSummary,
} from "@/features/upload/api/sessionApi"
import type { SessionMetadataValues } from "@/features/upload/components/SessionMetadataBar"
import { uploadPageCache as cache } from "./UploadPage.cache"
import { LAST_SESSION_KEY } from "./UploadPage.progress"
import {
  DEFAULT_DOCUMENT_NUMBERING_MODE,
  DEFAULT_DOCUMENT_NUMBERING_STYLE_PRESET,
  DEFAULT_DOSSIER_BUILD_STRATEGY,
  DEFAULT_NUMBERING_STYLE_OVERRIDES,
  EMPTY_PARSED_PLAN,
  activePlanBuildStrategy,
  activePlanDocumentNumberingMode,
  activePlanDocumentNumberingStyleOverrides,
  activePlanDocumentNumberingStylePreset,
  activePlanToParsedPlan,
  planToTree,
} from "./UploadPage.planUtils"

const ACTIVE_PLAN_JOB_STATUSES = new Set(["scheduled", "queued", "running"])

function isActivePlanAnalysisJob(
  job: ActiveJobSummary | null | undefined
): job is ActiveJobSummary {
  return (
    Boolean(job) &&
    job?.job_type === "analyze_plan" &&
    ACTIVE_PLAN_JOB_STATUSES.has(String(job?.status ?? ""))
  )
}

function jobPayloadHasFile(job: ActiveJobSummary, key: string) {
  const value = job.payload?.[key]
  if (Array.isArray(value)) {
    return value.some(
      (item) => typeof item === "string" && item.trim().length > 0
    )
  }
  return typeof value === "string" && value.trim().length > 0
}

function pendingPlanAnalysisMessage({
  job,
  processingArrangement,
  processingRetention,
}: {
  job: ActiveJobSummary
  processingArrangement: boolean
  processingRetention: boolean
}) {
  const status = String(job.status ?? "").trim().toLowerCase()
  const waiting =
    status === "queued" || status === "scheduled"
      ? " đang chờ worker xử lý."
      : " đang được xử lý."
  if (processingArrangement && processingRetention) {
    return `Phương án chỉnh lý và thời hạn bảo quản${waiting}`
  }
  if (processingRetention) return `Thời hạn bảo quản${waiting}`
  return `Phương án chỉnh lý${waiting}`
}

export function useUploadPageLifecycle(context: Record<string, any>) {
  const {
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
    setDocumentNumberingStylePreset,
    setDocumentNumberingStyleOverrides,
    setDoc1Has,
    setDoc2Has,
    setZipHas,
    setZipEntries,
    setFolderTree,
    setParsedPlan,
    setActiveFolderTree,
    setActiveParsedPlan,
    setActivePlanVersionId,
    setReviewPlanVersionId,
    setReviewPlanDirty,
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
  } = context

  useEffect(() => {
    const targetSessionId = routeSessionId ?? sessionId ?? cache.sessionId
    if (!isWorkerUser || currentStep === 3 || !targetSessionId) return
    navigate(`/sessions/${encodeURIComponent(targetSessionId)}/step/3`, {
      replace: true,
    })
  }, [currentStep, isWorkerUser, navigate, routeSessionId, sessionId])

  const applyWorkflowState = (nextSessionId: string | null) => {
    setDoc1State(cache.doc1State)
    setDoc2State(cache.doc2State)
    setZipState(cache.zipState)
    setPlanAnalysisState(cache.planAnalysisState)
    setDossierBuildStrategy(cache.dossierBuildStrategy)
    setDocumentNumberingMode(cache.documentNumberingMode)
    setDocumentNumberingStylePreset(cache.documentNumberingStylePreset)
    setDocumentNumberingStyleOverrides(cache.documentNumberingStyleOverrides)
    setDoc1Has(cache.doc1Has)
    setDoc2Has(cache.doc2Has)
    setZipHas(cache.zipHas)
    setZipEntries(cache.zipEntries)
    setFolderTree(cache.folderTree)
    setParsedPlan(cache.parsedPlan)
    setActiveFolderTree(cache.activeFolderTree)
    setActiveParsedPlan(cache.activeParsedPlan)
    setActivePlanVersionId(cache.activePlanVersionId)
    setReviewPlanVersionId(cache.reviewPlanVersionId)
    setReviewPlanDirty(cache.reviewPlanDirty)
    setClusterGroups(cache.clusterGroups)
    setSessionId(nextSessionId)
    setSessionMetadata(cache.sessionMetadata)
    setZipFolderPath(cache.zipFolderPath)
    setZipMaxFiles(cache.zipMaxFiles)
    setZipUploadProgress(cache.zipUploadProgress)
    setUploadModeState(cache.uploadMode)
    setPlanReuploadState({
      arrangement: cache.arrangementPlanReuploaded,
      retention: cache.retentionReuploaded,
    })
    setZipSupplementUploaded(cache.rawZipReuploaded)
    if (cache.planAnalysisState !== "processing") {
      setPlanProgressPhase(null)
      setPlanProgressMessage("")
      setPlanCompletedPhases(new Set())
    }
  }

  const resetWorkflowState = (nextSessionId: string | null) => {
    cache.doc1Has = false
    cache.doc2Has = false
    cache.zipHas = false
    cache.zipEntries = []
    cache.folderTree = planToTree(EMPTY_PARSED_PLAN)
    cache.parsedPlan = EMPTY_PARSED_PLAN
    cache.activeFolderTree = planToTree(EMPTY_PARSED_PLAN)
    cache.activeParsedPlan = EMPTY_PARSED_PLAN
    cache.activePlanResponse = null
    cache.clusterGroups = []
    cache.doc1State = "idle"
    cache.doc2State = "idle"
    cache.zipState = "idle"
    cache.planAnalysisState = "idle"
    cache.dossierBuildStrategy = DEFAULT_DOSSIER_BUILD_STRATEGY
    cache.persistedDossierBuildStrategy = DEFAULT_DOSSIER_BUILD_STRATEGY
    cache.documentNumberingMode = DEFAULT_DOCUMENT_NUMBERING_MODE
    cache.persistedDocumentNumberingMode = DEFAULT_DOCUMENT_NUMBERING_MODE
    cache.documentNumberingStylePreset = DEFAULT_DOCUMENT_NUMBERING_STYLE_PRESET
    cache.persistedDocumentNumberingStylePreset =
      DEFAULT_DOCUMENT_NUMBERING_STYLE_PRESET
    cache.documentNumberingStyleOverrides = {
      ...DEFAULT_NUMBERING_STYLE_OVERRIDES,
    }
    cache.persistedDocumentNumberingStyleOverrides = {
      ...DEFAULT_NUMBERING_STYLE_OVERRIDES,
    }
    cache.documentNumberingModeSavePromise = null
    cache.sessionId = nextSessionId
    cache.sessionMetadata = {
      archive_name: null,
      archive_code: null,
      fonds_name: null,
      fonds_creator_code: null,
    }
    cache.zipUpload = null
    cache.arrangementPlanUpload = null
    cache.retentionUpload = null
    cache.retentionUploads = []
    cache.zipFolderPath = ""
    cache.zipMaxFiles = ""
    cache.uploadMode = "append"
    cache.activePlanVersionId = ""
    cache.reviewPlanVersionId = ""
    cache.reviewPlanDirty = false
    cache.activeClusterVersionId = undefined
    cache.draftArrangementPlanFile = null
    cache.draftRetentionFile = null
    cache.draftRetentionFiles = []
    cache.draftZipFile = null
    cache.zipUploadProgress = null
    cache.arrangementPlanReuploaded = false
    cache.retentionReuploaded = false
    cache.rawZipReuploaded = false
    applyWorkflowState(nextSessionId)
  }

  const syncSessionMetadata = (metadata: SessionMetadataValues) => {
    cache.sessionMetadata = {
      archive_name: metadata.archive_name ?? null,
      archive_code: metadata.archive_code ?? null,
      fonds_name: metadata.fonds_name ?? null,
      fonds_creator_code: metadata.fonds_creator_code ?? null,
    }
    setSessionMetadata(cache.sessionMetadata)
  }

  useEffect(() => {
    const isCurrentDraftSession = Boolean(
      routeSessionId && cache.sessionId === routeSessionId
    )
    if (!isCurrentDraftSession) {
      resetWorkflowState(routeSessionId ?? null)
    } else {
      setSessionId(routeSessionId ?? null)
    }
    if (!routeSessionId) return

    let cancelled = false
    const loadExistingSession = async () => {
      setSessionLoading(true)
      try {
        const [sessionDetail, reviewPlan, activePlan] = await Promise.all([
          getSession(routeSessionId),
          getReviewPlan(routeSessionId),
          getActivePlan(routeSessionId),
        ])
        if (cancelled) return

        syncSessionMetadata(sessionDetail)
        cache.activeClusterVersionId =
          sessionDetail.active_cluster_version_id ?? null
        const files = sessionDetail.files ?? []
        const arrangementPlanFile = files.find(
          (file) => file.file_type === "arrangement_plan"
        )
        const retentionFiles = files.filter(
          (file) => file.file_type === "retention_schedule"
        )
        const retentionFile = retentionFiles[retentionFiles.length - 1]
        const zipFiles = files.filter((file) => file.file_type === "raw_zip")
        const zipFile = zipFiles[zipFiles.length - 1]
        const maybeActivePlanAnalysisJob =
          sessionDetail.active_plan_analysis_job
        const activePlanAnalysisJob = isActivePlanAnalysisJob(
          maybeActivePlanAnalysisJob
        )
          ? maybeActivePlanAnalysisJob
          : null
        const activeJobHasArrangementFile = activePlanAnalysisJob
          ? jobPayloadHasFile(activePlanAnalysisJob, "plan_file")
          : false
        const activeJobHasRetentionFile = activePlanAnalysisJob
          ? jobPayloadHasFile(activePlanAnalysisJob, "retention_file") ||
            jobPayloadHasFile(activePlanAnalysisJob, "retention_files")
          : false
        const activeJobHasKnownPlanInput =
          activeJobHasArrangementFile || activeJobHasRetentionFile
        const hasPendingPlanAnalysis =
          activePlanAnalysisJob !== null &&
          (Boolean(arrangementPlanFile) || Boolean(retentionFile))
        const processingArrangement =
          hasPendingPlanAnalysis &&
          Boolean(arrangementPlanFile) &&
          (activeJobHasArrangementFile || !activeJobHasKnownPlanInput)
        const processingRetention =
          hasPendingPlanAnalysis &&
          Boolean(retentionFile) &&
          (activeJobHasRetentionFile || !activeJobHasKnownPlanInput)
        cache.doc1Has = Boolean(arrangementPlanFile)
        cache.doc2Has = Boolean(retentionFile)
        cache.zipHas = Boolean(zipFile)
        cache.doc1State = arrangementPlanFile ? "done" : "idle"
        cache.doc2State = retentionFile ? "done" : "idle"
        cache.zipState = zipFile ? "done" : "idle"
        cache.arrangementPlanUpload = arrangementPlanFile ?? null
        cache.retentionUpload = retentionFile ?? null
        cache.retentionUploads = retentionFiles
        cache.arrangementPlanReuploaded = false
        cache.retentionReuploaded = false
        cache.rawZipReuploaded = false
        cache.zipUpload = zipFile ?? null
        cache.zipFolderPath = zipFile?.folder_path ?? zipFile?.data_path ?? ""
        cache.draftArrangementPlanFile = null
        cache.draftRetentionFile = null
        cache.draftRetentionFiles = []
        cache.draftZipFile = null
        cache.zipUploadProgress = null
        setDoc1Has(cache.doc1Has)
        setDoc2Has(cache.doc2Has)
        setZipHas(cache.zipHas)
        setDoc1State(cache.doc1State)
        setDoc2State(cache.doc2State)
        setZipState(cache.zipState)
        setPlanReuploadState({ arrangement: false, retention: false })
        setZipSupplementUploaded(false)
        setZipFolderPath(cache.zipFolderPath)
        setZipUploadProgress(null)

        cache.activePlanVersionId = activePlan?.id ?? ""
        cache.activePlanResponse = activePlan
        cache.activeParsedPlan = activePlan
          ? activePlanToParsedPlan(activePlan)
          : EMPTY_PARSED_PLAN
        cache.activeFolderTree = planToTree(cache.activeParsedPlan)
        setActivePlanVersionId(cache.activePlanVersionId)
        setActiveParsedPlan(cache.activeParsedPlan)
        setActiveFolderTree(cache.activeFolderTree)

        if (reviewPlan) {
          const plan = activePlanToParsedPlan(reviewPlan)
          const buildStrategy = activePlanBuildStrategy(reviewPlan)
          const numberingMode = activePlanDocumentNumberingMode(reviewPlan)
          const numberingStylePreset =
            activePlanDocumentNumberingStylePreset(reviewPlan)
          const numberingStyleOverrides =
            activePlanDocumentNumberingStyleOverrides(reviewPlan)
          cache.reviewPlanVersionId = reviewPlan.id ?? ""
          cache.reviewPlanDirty = false
          cache.parsedPlan = plan
          cache.folderTree = planToTree(plan)
          cache.doc1State = arrangementPlanFile
            ? processingArrangement
              ? "processing"
              : "done"
            : "idle"
          cache.doc2State = retentionFile
            ? processingRetention
              ? "processing"
              : "done"
            : "idle"
          cache.planAnalysisState = hasPendingPlanAnalysis
            ? "processing"
            : "done"
          cache.dossierBuildStrategy = buildStrategy
          cache.persistedDossierBuildStrategy = buildStrategy
          cache.documentNumberingMode = numberingMode
          cache.persistedDocumentNumberingMode = numberingMode
          cache.documentNumberingStylePreset = numberingStylePreset
          cache.persistedDocumentNumberingStylePreset = numberingStylePreset
          cache.documentNumberingStyleOverrides = numberingStyleOverrides
          cache.persistedDocumentNumberingStyleOverrides =
            numberingStyleOverrides
          setParsedPlan(plan)
          setFolderTree(cache.folderTree)
          setReviewPlanVersionId(cache.reviewPlanVersionId)
          setReviewPlanDirty(false)
          setDoc1State(cache.doc1State)
          setDoc2State(cache.doc2State)
          setPlanAnalysisState(cache.planAnalysisState)
          setDossierBuildStrategy(buildStrategy)
          setDocumentNumberingMode(numberingMode)
          setDocumentNumberingStylePreset(numberingStylePreset)
          setDocumentNumberingStyleOverrides(numberingStyleOverrides)
          if (hasPendingPlanAnalysis && activePlanAnalysisJob) {
            setPlanCompletedPhases(new Set(["upload_inputs"]))
            setPlanProgressPhase(
              processingRetention && !processingArrangement
                ? "retention_schedule"
                : "preparing_plan_file"
            )
            setPlanProgressMessage(
              pendingPlanAnalysisMessage({
                job: activePlanAnalysisJob,
                processingArrangement,
                processingRetention,
              })
            )
          } else {
            setPlanProgressPhase(null)
            setPlanProgressMessage("")
            setPlanCompletedPhases(new Set())
          }
        } else {
          cache.reviewPlanVersionId = ""
          cache.reviewPlanDirty = false
          cache.parsedPlan = EMPTY_PARSED_PLAN
          cache.folderTree = planToTree(EMPTY_PARSED_PLAN)
          cache.dossierBuildStrategy = DEFAULT_DOSSIER_BUILD_STRATEGY
          cache.persistedDossierBuildStrategy = DEFAULT_DOSSIER_BUILD_STRATEGY
          cache.documentNumberingMode = DEFAULT_DOCUMENT_NUMBERING_MODE
          cache.persistedDocumentNumberingMode = DEFAULT_DOCUMENT_NUMBERING_MODE
          cache.doc1State = arrangementPlanFile
            ? processingArrangement
              ? "processing"
              : "done"
            : "idle"
          cache.doc2State = retentionFile
            ? processingRetention
              ? "processing"
              : "done"
            : "idle"
          cache.planAnalysisState = hasPendingPlanAnalysis
            ? "processing"
            : "idle"
          setParsedPlan(cache.parsedPlan)
          setFolderTree(cache.folderTree)
          setReviewPlanVersionId("")
          setReviewPlanDirty(false)
          setDoc1State(cache.doc1State)
          setDoc2State(cache.doc2State)
          setPlanAnalysisState(cache.planAnalysisState)
          setDossierBuildStrategy(cache.dossierBuildStrategy)
          setDocumentNumberingMode(cache.documentNumberingMode)
          if (hasPendingPlanAnalysis && activePlanAnalysisJob) {
            setPlanCompletedPhases(new Set(["upload_inputs"]))
            setPlanProgressPhase(
              processingRetention && !processingArrangement
                ? "retention_schedule"
                : "preparing_plan_file"
            )
            setPlanProgressMessage(
              pendingPlanAnalysisMessage({
                job: activePlanAnalysisJob,
                processingArrangement,
                processingRetention,
              })
            )
          } else {
            setPlanProgressPhase(null)
            setPlanProgressMessage("")
            setPlanCompletedPhases(new Set())
          }
        }
        window.localStorage.setItem(LAST_SESSION_KEY, routeSessionId)
      } catch (err) {
        if (!cancelled) {
          toast.error(
            err instanceof Error
              ? err.message
              : "Không thể tải session đã chọn."
          )
        }
      } finally {
        if (!cancelled) setSessionLoading(false)
      }
    }
    void loadExistingSession()
    return () => {
      cancelled = true
    }
  }, [routeSessionId])

  return { syncSessionMetadata }
}
