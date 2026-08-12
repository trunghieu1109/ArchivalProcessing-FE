import { useEffect } from "react"
import { toast } from "sonner"
import {
  cancelFolderUpload,
  cancelRawZipUpload,
  getActivePlan,
  getWorkingPlan,
  getSession,
  type ActiveJobSummary,
  type FolderUploadSummary,
  type SessionInputUploadResponse,
} from "@/features/upload/api/sessionApi"
import { folderUploadManager } from "@/features/upload/lib/folderUploadManager"
import {
  zipUploadManager,
  zipUploadProgressFromJob,
} from "@/features/upload/lib/zipUploadManager"
import {
  resolveLatestUploadInterruption,
  uploadAttemptTime,
} from "@/features/upload/lib/uploadInterruption"
import type { SessionMetadataValues } from "@/features/upload/components/SessionMetadataBar"
import { uploadPageCache as cache } from "./UploadPage.cache"
import {
  LAST_SESSION_KEY,
  planAnalysisScopeForInputs,
} from "./UploadPage.progress"
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
  planDraftPayloadSignature,
  planResponseMaterialSignature,
  planResponseToDraftPayload,
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
  const status = String(job.status ?? "")
    .trim()
    .toLowerCase()
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
    setPlanAnalysisJobId,
    syncPlanAnalysisFailure,
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
    setActivePlanSettings,
    setWorkingPlanVersionId,
    setWorkingPlanStatus,
    setPlanDraftDirty,
    setActivePlanVersionId,
    setPlanViewTab,
    setClusterGroups,
    setSessionId,
    setSessionMetadata,
    setZipFolderPath,
    setZipMaxFiles,
    setZipUploadProgress,
    setLatestUploadInterruption,
    setLatestUploadWarning,
    setUploadModeState,
    setPlanReuploadState,
    setZipSupplementUploaded,
    setPlanProgressPhase,
    setPlanProgressMessage,
    setPlanCompletedPhases,
    setSessionLoading,
    setDossierTitleCatalogDraftFile,
    setDossierTitleCatalogUpload,
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
    setPlanAnalysisJobId(cache.planAnalysisJobId)
    syncPlanAnalysisFailure(cache.planAnalysisFailure)
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
    setActivePlanSettings(cache.activePlanSettings)
    setWorkingPlanVersionId(cache.workingPlanVersionId)
    setWorkingPlanStatus(cache.workingPlanStatus)
    setPlanDraftDirty(cache.planDraftDirty)
    setActivePlanVersionId(cache.activePlanVersionId)
    setPlanViewTab(cache.planViewTab)
    setClusterGroups(cache.clusterGroups)
    setSessionId(nextSessionId)
    setSessionMetadata(cache.sessionMetadata)
    setZipFolderPath(cache.zipFolderPath)
    setZipMaxFiles(cache.zipMaxFiles)
    setZipUploadProgress(cache.zipUploadProgress)
    setLatestUploadInterruption(cache.latestUploadInterruption)
    setLatestUploadWarning(cache.latestUploadWarning)
    setUploadModeState(cache.uploadMode)
    setPlanReuploadState({
      arrangement: cache.arrangementPlanReuploaded,
      retention: cache.retentionReuploaded,
    })
    setZipSupplementUploaded(cache.rawZipReuploaded)
    setDossierTitleCatalogDraftFile(cache.draftDossierTitleCatalogFile)
    setDossierTitleCatalogUpload(cache.dossierTitleCatalogUpload)
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
    cache.activePlanSettings = {
      dossierBuildStrategy: DEFAULT_DOSSIER_BUILD_STRATEGY,
      documentNumberingMode: DEFAULT_DOCUMENT_NUMBERING_MODE,
      documentNumberingStylePreset: DEFAULT_DOCUMENT_NUMBERING_STYLE_PRESET,
      documentNumberingStyleOverrides: {
        ...DEFAULT_NUMBERING_STYLE_OVERRIDES,
      },
    }
    cache.clusterGroups = []
    cache.doc1State = "idle"
    cache.doc2State = "idle"
    cache.zipState = "idle"
    cache.planAnalysisState = "idle"
    cache.planAnalysisJobId = null
    cache.planAnalysisScope = null
    cache.planAnalysisFailure = null
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
    cache.workingPlanSavePromise = null
    cache.planDraftDirty = false
    cache.planDraftRevision = 0
    cache.planDraftBaseSignature = ""
    cache.workingPlanSignature = ""
    cache.activePlanSignature = ""
    cache.workingPlanResponse = null
    cache.activePlanResponse = null
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
    cache.dossierTitleCatalogUpload = null
    cache.zipFolderPath = ""
    cache.zipMaxFiles = ""
    cache.uploadMode = "append"
    cache.workingPlanVersionId = ""
    cache.workingPlanStatus = ""
    cache.activePlanVersionId = ""
    cache.planViewTab = "draft"
    cache.activeClusterVersionId = undefined
    cache.draftArrangementPlanFile = null
    cache.draftRetentionFile = null
    cache.draftRetentionFiles = []
    cache.draftZipFile = null
    cache.draftFolderSources = []
    cache.draftFolderRootName = ""
    cache.draftDossierTitleCatalogFile = null
    cache.latestZipAttempt = null
    cache.latestFolderUpload = null
    cache.latestUploadInterruption = null
    cache.latestUploadWarning = null
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
        const [sessionDetail, initialWorkingPlan, initialActivePlan] =
          await Promise.all([
            getSession(routeSessionId),
            getWorkingPlan(routeSessionId),
            getActivePlan(routeSessionId),
          ])
        let workingPlan = initialWorkingPlan
        const referencedActivePlanVersionId = String(
          sessionDetail.active_plan_version_id ?? ""
        ).trim()
        const activePlan =
          initialActivePlan ??
          (referencedActivePlanVersionId &&
          initialWorkingPlan?.id === referencedActivePlanVersionId
            ? initialWorkingPlan
            : null)
        if (cancelled) return

        cache.planDraftDirty = false
        cache.planDraftRevision = 0
        /*
        const localPlanDraft = null
        if (localPlanDraft) {
          try {
            const baselinePayload = workingPlan
              ? planResponseToDraftPayload(workingPlan)
              : null
            const baselineSignature = baselinePayload
              ? planDraftPayloadSignature(baselinePayload)
              : ""
            const localSignature = planDraftPayloadSignature(
              localPlanDraft.payload
            )
            if (baselineSignature && localSignature === baselineSignature) {
              void routeSessionId
              cache.planDraftDirty = false
              cache.planDraftRevision = 0
            } else {
              workingPlan = await Promise.resolve(
                routeSessionId,
                localPlanDraft.payload
              )
              void routeSessionId
              cache.planDraftDirty = false
              cache.planDraftRevision = 0
            toast.info("Đã khôi phục thay đổi thành bản nháp chưa duyệt.")
            }
          } catch {
            if (workingPlan) {
              workingPlan = {
                ...workingPlan,
                ...localPlanDraft.payload,
              }
            }
            cache.planDraftDirty = true
            cache.planDraftRevision = 1
            toast.error(
              "Chưa thể lưu bản nháp đã khôi phục. Thay đổi vẫn được giữ trên trình duyệt."
            )
          }
        } else {
          cache.planDraftDirty = false
          cache.planDraftRevision = 0
        }
        */
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
        const dossierTitleCatalogFile = files.find(
          (file) => file.file_type === "dossier_title_catalog"
        )
        const zipFiles = files
          .filter(
            (file) =>
              file.file_type === "raw_zip" &&
              (file.upload_status == null || file.upload_status === "completed")
          )
          .sort(
            (left, right) =>
              uploadAttemptTime(right.created_at, right.updated_at) -
              uploadAttemptTime(left.created_at, left.updated_at)
          )
        const zipFile = zipFiles[0]
        const preserveRawZipReuploaded = Boolean(
          cache.rawZipReuploaded &&
          cache.zipUpload &&
          zipFile &&
          sameUploadAttempt(cache.zipUpload, zipFile)
        )
        let latestFolderUpload = sessionDetail.latest_folder_upload ?? null
        let latestZipAttempt = files
          .filter((file) => file.file_type === "raw_zip")
          .sort(
            (left, right) =>
              uploadAttemptTime(right.created_at, right.updated_at) -
              uploadAttemptTime(left.created_at, left.updated_at)
          )[0]
        const liveZipJob = latestLiveJobForSession(
          zipUploadManager.getSnapshot(),
          routeSessionId
        )
        const liveFolderJob = latestLiveJobForSession(
          folderUploadManager.getSnapshot(),
          routeSessionId
        )
        const hasLiveDataUpload = Boolean(liveZipJob || liveFolderJob)
        const hasLiveZipAttempt = matchesLiveZipAttempt(
          liveZipJob,
          latestZipAttempt
        )
        const hasLiveFolderAttempt = matchesLiveFolderAttempt(
          liveFolderJob,
          latestFolderUpload
        )
        const interruptedAttemptClosure = closeInterruptedAttempts({
          sessionId: routeSessionId,
          zipAttempt: latestZipAttempt,
          folderAttempt: latestFolderUpload,
          hasLiveZipAttempt,
          hasLiveFolderAttempt,
        })
        // Route changes do not terminate an upload. The manager snapshot is
        // checked before restoring server-only reconciliation so a live
        // binary upload is never mistaken for a reload interruption.
        if (latestFolderUpload) {
          folderUploadManager.restoreFromSummary(latestFolderUpload)
        }
        const latestUploadInterruption = resolveLatestUploadInterruption(
          latestZipAttempt,
          latestFolderUpload,
          { hasLiveZipAttempt, hasLiveFolderAttempt }
        )
        const latestUploadWarning = latestUploadInterruption?.message ?? null
        const folderInputReady = Boolean(
          latestFolderUpload &&
          ["sealed", "cancelled"].includes(latestFolderUpload.status) &&
          latestFolderUpload.document_sync_status === "ready" &&
          latestFolderUpload.counts.effective > 0
        )
        const useFolderInput =
          folderInputReady &&
          (!zipFile ||
            uploadAttemptTime(
              latestFolderUpload?.created_at,
              latestFolderUpload?.updated_at
            ) >= uploadAttemptTime(zipFile.created_at, zipFile.updated_at))
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
        cache.planAnalysisJobId = activePlanAnalysisJob?.id ?? null
        cache.planAnalysisScope = activePlanAnalysisJob
          ? planAnalysisScopeForInputs({
              analyzePlan:
                activeJobHasArrangementFile || !activeJobHasKnownPlanInput,
              analyzeRetention:
                activeJobHasRetentionFile || !activeJobHasKnownPlanInput,
            })
          : null
        cache.doc1Has = Boolean(arrangementPlanFile)
        cache.doc2Has = Boolean(retentionFile)
        cache.zipHas = Boolean(zipFile) || folderInputReady
        cache.doc1State = arrangementPlanFile ? "done" : "idle"
        cache.doc2State = retentionFile ? "done" : "idle"
        cache.zipState = hasLiveDataUpload
          ? "processing"
          : zipFile || folderInputReady
            ? "done"
            : "idle"
        cache.arrangementPlanUpload = arrangementPlanFile ?? null
        cache.retentionUpload = retentionFile ?? null
        cache.retentionUploads = retentionFiles
        cache.dossierTitleCatalogUpload = dossierTitleCatalogFile ?? null
        cache.arrangementPlanReuploaded = false
        cache.retentionReuploaded = false
        cache.rawZipReuploaded = preserveRawZipReuploaded
        cache.zipUpload = zipFile ?? null
        cache.latestZipAttempt = latestZipAttempt ?? null
        cache.latestFolderUpload = latestFolderUpload
        cache.latestUploadInterruption = latestUploadInterruption
        cache.latestUploadWarning = latestUploadWarning
        cache.zipFolderPath = useFolderInput
          ? (latestFolderUpload?.root_name ?? "")
          : (zipFile?.folder_path ?? zipFile?.data_path ?? "")
        cache.draftArrangementPlanFile = null
        cache.draftRetentionFile = null
        cache.draftRetentionFiles = []
        cache.draftZipFile = null
        cache.draftFolderSources = []
        cache.draftFolderRootName = ""
        cache.draftDossierTitleCatalogFile = null
        cache.zipUploadProgress = liveZipJob
          ? zipUploadProgressFromJob(liveZipJob)
          : null
        setDoc1Has(cache.doc1Has)
        setDoc2Has(cache.doc2Has)
        setZipHas(cache.zipHas)
        setDoc1State(cache.doc1State)
        setDoc2State(cache.doc2State)
        setZipState(cache.zipState)
        setPlanAnalysisJobId(cache.planAnalysisJobId)
        setPlanReuploadState({ arrangement: false, retention: false })
        setZipSupplementUploaded(preserveRawZipReuploaded)
        setZipFolderPath(cache.zipFolderPath)
        setZipUploadProgress(cache.zipUploadProgress)
        setLatestUploadInterruption(latestUploadInterruption)
        setLatestUploadWarning(latestUploadWarning)
        setDossierTitleCatalogDraftFile(null)
        setDossierTitleCatalogUpload(cache.dossierTitleCatalogUpload)

        if (interruptedAttemptClosure) {
          void interruptedAttemptClosure.then((closed) => {
            if (cancelled) return
            latestZipAttempt = closed.zipAttempt ?? latestZipAttempt
            latestFolderUpload = closed.folderAttempt ?? latestFolderUpload
            const currentLiveZipJob = latestLiveJobForSession(
              zipUploadManager.getSnapshot(),
              routeSessionId
            )
            const currentLiveFolderJob = latestLiveJobForSession(
              folderUploadManager.getSnapshot(),
              routeSessionId
            )
            const currentInterruption = resolveLatestUploadInterruption(
              latestZipAttempt,
              latestFolderUpload,
              {
                hasLiveZipAttempt: matchesLiveZipAttempt(
                  currentLiveZipJob,
                  latestZipAttempt
                ),
                hasLiveFolderAttempt: matchesLiveFolderAttempt(
                  currentLiveFolderJob,
                  latestFolderUpload
                ),
              }
            )
            cache.latestZipAttempt = latestZipAttempt ?? null
            cache.latestFolderUpload = latestFolderUpload
            cache.latestUploadInterruption = currentInterruption
            cache.latestUploadWarning = currentInterruption?.message ?? null
            setLatestUploadInterruption(currentInterruption)
            setLatestUploadWarning(currentInterruption?.message ?? null)

            const zipIsLatest =
              Boolean(latestZipAttempt) &&
              uploadAttemptTime(
                latestZipAttempt?.created_at,
                latestZipAttempt?.updated_at
              ) >
                uploadAttemptTime(
                  latestFolderUpload?.created_at,
                  latestFolderUpload?.updated_at
                )
            if (
              zipIsLatest &&
              latestZipAttempt?.upload_status === "completed"
            ) {
              cache.zipUpload = latestZipAttempt
              cache.zipHas = true
              cache.zipState = "done"
              cache.zipFolderPath =
                latestZipAttempt.folder_path ?? latestZipAttempt.data_path ?? ""
              setZipHas(true)
              setZipState("done")
              setZipFolderPath(cache.zipFolderPath)
            }

            if (latestFolderUpload) {
              folderUploadManager.restoreFromSummary(latestFolderUpload)
              const folderIsLatest =
                uploadAttemptTime(
                  latestFolderUpload.created_at,
                  latestFolderUpload.updated_at
                ) >=
                uploadAttemptTime(
                  latestZipAttempt?.created_at,
                  latestZipAttempt?.updated_at
                )
              const folderInputReady =
                ["sealed", "cancelled"].includes(latestFolderUpload.status) &&
                latestFolderUpload.document_sync_status === "ready" &&
                latestFolderUpload.counts.effective > 0
              if (folderIsLatest && folderInputReady) {
                cache.zipHas = true
                cache.zipState = "done"
                cache.zipFolderPath = latestFolderUpload.root_name
                setZipHas(true)
                setZipState("done")
                setZipFolderPath(latestFolderUpload.root_name)
              }
            }
          })
        }

        if (activePlan) {
          const activeParsedPlan = activePlanToParsedPlan(activePlan)
          const activePlanSettings = {
            dossierBuildStrategy: activePlanBuildStrategy(activePlan),
            documentNumberingMode: activePlanDocumentNumberingMode(activePlan),
            documentNumberingStylePreset:
              activePlanDocumentNumberingStylePreset(activePlan),
            documentNumberingStyleOverrides:
              activePlanDocumentNumberingStyleOverrides(activePlan),
          }
          cache.activePlanVersionId = activePlan.id ?? ""
          cache.activePlanResponse = activePlan
          cache.activePlanSignature = planResponseMaterialSignature(activePlan)
          cache.activeParsedPlan = activeParsedPlan
          cache.activeFolderTree = planToTree(activeParsedPlan)
          cache.activePlanSettings = activePlanSettings
          setActivePlanVersionId(cache.activePlanVersionId)
          setActiveParsedPlan(activeParsedPlan)
          setActiveFolderTree(cache.activeFolderTree)
          setActivePlanSettings(activePlanSettings)
        } else {
          cache.activePlanVersionId = referencedActivePlanVersionId
          cache.activePlanResponse = null
          cache.activePlanSignature = ""
          cache.activeParsedPlan = EMPTY_PARSED_PLAN
          cache.activeFolderTree = planToTree(EMPTY_PARSED_PLAN)
          cache.activePlanSettings = {
            dossierBuildStrategy: DEFAULT_DOSSIER_BUILD_STRATEGY,
            documentNumberingMode: DEFAULT_DOCUMENT_NUMBERING_MODE,
            documentNumberingStylePreset:
              DEFAULT_DOCUMENT_NUMBERING_STYLE_PRESET,
            documentNumberingStyleOverrides: {
              ...DEFAULT_NUMBERING_STYLE_OVERRIDES,
            },
          }
          setActivePlanVersionId(cache.activePlanVersionId)
          setActiveParsedPlan(cache.activeParsedPlan)
          setActiveFolderTree(cache.activeFolderTree)
          setActivePlanSettings(cache.activePlanSettings)
          if (referencedActivePlanVersionId) {
            toast.warning(
              "Session đã có phương án được duyệt nhưng backend chưa trả được nội dung phiên bản active. Hãy tải lại session; nếu vẫn còn lỗi, cần kiểm tra dữ liệu phiên bản active."
            )
          }
        }

        if (workingPlan) {
          const plan = activePlanToParsedPlan(workingPlan)
          const workingDraftPayload = planResponseToDraftPayload(workingPlan)
          const buildStrategy = activePlanBuildStrategy(workingPlan)
          const numberingMode = activePlanDocumentNumberingMode(workingPlan)
          const numberingStylePreset =
            activePlanDocumentNumberingStylePreset(workingPlan)
          const numberingStyleOverrides =
            activePlanDocumentNumberingStyleOverrides(workingPlan)
          cache.workingPlanVersionId = workingPlan.id ?? ""
          cache.workingPlanStatus = workingPlan.status ?? ""
          cache.workingPlanResponse = workingPlan
          cache.workingPlanSignature =
            planResponseMaterialSignature(workingPlan)
          cache.planDraftBaseSignature =
            planDraftPayloadSignature(workingDraftPayload)
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
          cache.planViewTab =
            workingPlan.status === "draft"
              ? "draft"
              : cache.activePlanVersionId
                ? "active"
                : "draft"
          cache.dossierBuildStrategy = buildStrategy
          cache.persistedDossierBuildStrategy = buildStrategy
          cache.documentNumberingMode = numberingMode
          cache.persistedDocumentNumberingMode = numberingMode
          cache.documentNumberingStylePreset = numberingStylePreset
          cache.persistedDocumentNumberingStylePreset = numberingStylePreset
          cache.documentNumberingStyleOverrides = numberingStyleOverrides
          cache.persistedDocumentNumberingStyleOverrides =
            numberingStyleOverrides
          setWorkingPlanVersionId(cache.workingPlanVersionId)
          setWorkingPlanStatus(cache.workingPlanStatus)
          setPlanDraftDirty(cache.planDraftDirty)
          setParsedPlan(plan)
          setFolderTree(cache.folderTree)
          setDoc1State(cache.doc1State)
          setDoc2State(cache.doc2State)
          setPlanAnalysisState(cache.planAnalysisState)
          setPlanViewTab(cache.planViewTab)
          setDossierBuildStrategy(buildStrategy)
          setDocumentNumberingMode(numberingMode)
          setDocumentNumberingStylePreset(numberingStylePreset)
          setDocumentNumberingStyleOverrides(numberingStyleOverrides)
          if (hasPendingPlanAnalysis && activePlanAnalysisJob) {
            setPlanCompletedPhases(new Set(["upload_inputs"]))
            setPlanProgressPhase(
              processingRetention && !processingArrangement
                ? "retention_period"
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
          cache.workingPlanVersionId = ""
          cache.workingPlanStatus = ""
          cache.workingPlanResponse = null
          cache.workingPlanSignature = ""
          cache.planDraftBaseSignature = ""
          cache.parsedPlan = EMPTY_PARSED_PLAN
          cache.folderTree = planToTree(EMPTY_PARSED_PLAN)
          cache.planViewTab = cache.activePlanVersionId ? "active" : "draft"
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
          setWorkingPlanVersionId(cache.workingPlanVersionId)
          setWorkingPlanStatus(cache.workingPlanStatus)
          setPlanDraftDirty(cache.planDraftDirty)
          setPlanViewTab(cache.planViewTab)
          setDoc1State(cache.doc1State)
          setDoc2State(cache.doc2State)
          setPlanAnalysisState(cache.planAnalysisState)
          setDossierBuildStrategy(cache.dossierBuildStrategy)
          setDocumentNumberingMode(cache.documentNumberingMode)
          if (hasPendingPlanAnalysis && activePlanAnalysisJob) {
            setPlanCompletedPhases(new Set(["upload_inputs"]))
            setPlanProgressPhase(
              processingRetention && !processingArrangement
                ? "retention_period"
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
  }, [currentStep, routeSessionId])

  return { syncSessionMetadata }
}

function latestLiveJobForSession<
  T extends { sessionId: string; status: string; createdAt: number },
>(jobs: T[], sessionId: string): T | null {
  return (
    jobs
      .filter(
        (job) =>
          job.sessionId === sessionId &&
          !["completed", "cancelled"].includes(job.status)
      )
      .sort((left, right) => right.createdAt - left.createdAt)[0] ?? null
  )
}

function matchesLiveZipAttempt(
  job: {
    clientUploadId: string
    sessionId: string
  } | null,
  attempt: SessionInputUploadResponse | null | undefined
): boolean {
  if (!job || !attempt || job.sessionId !== attempt.session_id) return false
  const clientUploadId = String(attempt.client_upload_id ?? "").trim()
  return !clientUploadId || clientUploadId === job.clientUploadId
}

function matchesLiveFolderAttempt(
  job: {
    clientUploadId: string
    folderUploadId: string | null
    sessionId: string
  } | null,
  attempt: FolderUploadSummary | null | undefined
): boolean {
  if (!job || !attempt || job.sessionId !== attempt.session_id) return false
  return (
    job.folderUploadId === attempt.folder_upload_id ||
    job.clientUploadId === attempt.client_upload_id
  )
}

interface CloseInterruptedAttemptsOptions {
  sessionId: string
  zipAttempt: SessionInputUploadResponse | null | undefined
  folderAttempt: FolderUploadSummary | null
  hasLiveZipAttempt: boolean
  hasLiveFolderAttempt: boolean
}

interface ClosedInterruptedAttempts {
  zipAttempt: SessionInputUploadResponse | null
  folderAttempt: FolderUploadSummary | null
}

const interruptedAttemptClosures = new Map<
  string,
  Promise<SessionInputUploadResponse | FolderUploadSummary | null>
>()

function closeInterruptedAttempts({
  sessionId,
  zipAttempt,
  folderAttempt,
  hasLiveZipAttempt,
  hasLiveFolderAttempt,
}: CloseInterruptedAttemptsOptions): Promise<ClosedInterruptedAttempts> | null {
  const folderStatus = String(folderAttempt?.status ?? "").toLowerCase()
  const shouldCloseFolder =
    Boolean(folderAttempt) &&
    !hasLiveFolderAttempt &&
    ["open", "uploading", "attention_required", "cancelling"].includes(
      folderStatus
    )
  const zipStatus = String(zipAttempt?.upload_status ?? "").toLowerCase()
  const shouldCloseZip =
    Boolean(zipAttempt?.client_upload_id) &&
    !hasLiveZipAttempt &&
    Boolean(zipStatus) &&
    !["completed", "completing", "cancelled"].includes(zipStatus)

  if (!shouldCloseFolder && !shouldCloseZip) return null

  const folderTask =
    shouldCloseFolder && folderAttempt
      ? closeInterruptedAttemptOnce(
          `folder:${folderAttempt.folder_upload_id}`,
          () =>
            cancelFolderUpload(
              sessionId,
              folderAttempt.folder_upload_id,
              "page_closed"
            )
        ).then((result) => result as FolderUploadSummary | null)
      : Promise.resolve(folderAttempt)
  const zipTask =
    shouldCloseZip && zipAttempt?.client_upload_id
      ? closeInterruptedAttemptOnce(`zip:${zipAttempt.client_upload_id}`, () =>
          cancelRawZipUpload(
            sessionId,
            zipAttempt.client_upload_id!,
            "page_closed"
          )
        ).then((result) => result as SessionInputUploadResponse | null)
      : Promise.resolve(zipAttempt ?? null)

  return Promise.allSettled([zipTask, folderTask]).then(
    async ([zipResult, folderResult]) => {
      if (
        zipResult.status === "rejected" ||
        folderResult.status === "rejected"
      ) {
        try {
          const refreshed = await getSession(sessionId)
          const refreshedZipAttempt =
            (refreshed.files ?? [])
              .filter((file) => file.file_type === "raw_zip")
              .sort(
                (left, right) =>
                  uploadAttemptTime(right.created_at, right.updated_at) -
                  uploadAttemptTime(left.created_at, left.updated_at)
              )[0] ?? null
          return {
            zipAttempt: refreshedZipAttempt,
            folderAttempt: refreshed.latest_folder_upload ?? null,
          }
        } catch {
          // Keep the original server snapshot. A later session refresh retries
          // cancellation; Folder additionally has the lease watchdog fallback.
        }
      }
      return {
        zipAttempt:
          zipResult.status === "fulfilled"
            ? zipResult.value
            : (zipAttempt ?? null),
        folderAttempt:
          folderResult.status === "fulfilled"
            ? folderResult.value
            : folderAttempt,
      }
    }
  )
}

function closeInterruptedAttemptOnce<
  T extends SessionInputUploadResponse | FolderUploadSummary,
>(key: string, taskFactory: () => Promise<T>): Promise<T> {
  const existing = interruptedAttemptClosures.get(key)
  if (existing) return existing as Promise<T>
  const task = taskFactory().finally(() => {
    interruptedAttemptClosures.delete(key)
  })
  interruptedAttemptClosures.set(key, task)
  return task
}

function sameUploadAttempt(
  left: {
    id?: string | number | null
    client_upload_id?: string | null
    remote_file_id?: string | number | null
  },
  right: {
    id?: string | number | null
    client_upload_id?: string | null
    remote_file_id?: string | number | null
  }
): boolean {
  const identifiers: Array<keyof typeof left> = [
    "id",
    "client_upload_id",
    "remote_file_id",
  ]
  return identifiers.some((key) => {
    const leftValue = String(left[key] ?? "").trim()
    const rightValue = String(right[key] ?? "").trim()
    return Boolean(leftValue && rightValue && leftValue === rightValue)
  })
}
