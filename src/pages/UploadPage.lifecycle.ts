import { useEffect } from "react"
import { toast } from "sonner"
import {
  cancelRawZipUpload,
  getActivePlan,
  getWorkingPlan,
  getSession,
  type ActiveJobSummary,
  type SessionInputUploadResponse,
} from "@/features/upload/api/sessionApi"
import {
  cancelFolderUpload,
  folderUploadManager,
  type FolderUploadSummary,
} from "@/features/folder-upload"
import { zipUploadManager } from "@/features/zip-upload"
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

function isUsableCompletedZipUpload(file: SessionInputUploadResponse): boolean {
  return file.upload_status === "completed"
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
    setLatestZipUploadAttempt,
    setUploadModeState,
    setPlanReuploadState,
    setZipSupplementUploaded,
    setPlanProgressPhase,
    setPlanProgressMessage,
    setPlanCompletedPhases,
    setSessionLoading,
    restoreFolderUploadSummary,
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
    setLatestZipUploadAttempt(null)
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
        let activePlanLoadError: unknown = null
        const [sessionDetail, initialWorkingPlan, fetchedActivePlan] =
          await Promise.all([
            getSession(routeSessionId),
            getWorkingPlan(routeSessionId),
            getActivePlan(routeSessionId).catch((err: unknown) => {
              activePlanLoadError = err
              return null
            }),
          ])
        let workingPlan = initialWorkingPlan
        if (cancelled) return
        const sessionActivePlanVersionId = String(
          sessionDetail.active_plan_version_id ?? ""
        ).trim()
        const fetchedActivePlanVersionId = String(
          fetchedActivePlan?.id ?? ""
        ).trim()
        const loadedActivePlan =
          fetchedActivePlan &&
          (!sessionActivePlanVersionId ||
            fetchedActivePlanVersionId === sessionActivePlanVersionId)
            ? fetchedActivePlan
            : null
        const fallbackActivePlan =
          !loadedActivePlan &&
          sessionActivePlanVersionId &&
          String(workingPlan?.id ?? "").trim() === sessionActivePlanVersionId
            ? workingPlan
            : null
        const activePlanForDisplay = loadedActivePlan ?? fallbackActivePlan
        const effectiveActivePlanVersionId =
          sessionActivePlanVersionId ||
          String(loadedActivePlan?.id ?? "").trim()

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
        const zipFiles = files
          .filter((file) => file.file_type === "raw_zip")
          .sort(
            (left, right) =>
              uploadAttemptTime(right.created_at, right.updated_at) -
              uploadAttemptTime(left.created_at, left.updated_at)
          )
        let latestZipAttempt = zipFiles[0] ?? null
        const zipFile = zipFiles.find(isUsableCompletedZipUpload) ?? null
        const liveZipJob = latestLiveJobForSession(
          zipUploadManager.getSnapshot(),
          routeSessionId
        )
        const liveFolderJob = latestLiveJobForSession(
          folderUploadManager.getSnapshot(),
          routeSessionId
        )
        const interruptedAttemptClosure = closeInterruptedAttempts({
          sessionId: routeSessionId,
          zipAttempt: latestZipAttempt,
          folderAttempt: sessionDetail.latest_folder_upload ?? null,
          hasLiveZipAttempt: matchesLiveZipAttempt(
            liveZipJob,
            latestZipAttempt
          ),
          hasLiveFolderAttempt: matchesLiveFolderAttempt(
            liveFolderJob,
            sessionDetail.latest_folder_upload
          ),
        })
        if (
          sessionDetail.latest_folder_upload &&
          typeof restoreFolderUploadSummary === "function"
        ) {
          restoreFolderUploadSummary(sessionDetail.latest_folder_upload)
        }
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
        setLatestZipUploadAttempt(latestZipAttempt)
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
        if (interruptedAttemptClosure) {
          void interruptedAttemptClosure.then((closed) => {
            if (cancelled) return
            latestZipAttempt = closed.zipAttempt ?? latestZipAttempt
            setLatestZipUploadAttempt(latestZipAttempt)
            if (closed.folderAttempt) {
              restoreFolderUploadSummary(closed.folderAttempt)
            }
          })
        }

        cache.activePlanVersionId = effectiveActivePlanVersionId
        setActivePlanVersionId(cache.activePlanVersionId)
        if (activePlanForDisplay) {
          const activeParsedPlan = activePlanToParsedPlan(activePlanForDisplay)
          const activePlanSettings = {
            dossierBuildStrategy: activePlanBuildStrategy(activePlanForDisplay),
            documentNumberingMode:
              activePlanDocumentNumberingMode(activePlanForDisplay),
            documentNumberingStylePreset:
              activePlanDocumentNumberingStylePreset(activePlanForDisplay),
            documentNumberingStyleOverrides:
              activePlanDocumentNumberingStyleOverrides(activePlanForDisplay),
          }
          cache.activePlanResponse = activePlanForDisplay
          cache.activePlanSignature =
            planResponseMaterialSignature(activePlanForDisplay)
          cache.activeParsedPlan = activeParsedPlan
          cache.activeFolderTree = planToTree(activeParsedPlan)
          cache.activePlanSettings = activePlanSettings
          setActiveParsedPlan(activeParsedPlan)
          setActiveFolderTree(cache.activeFolderTree)
          setActivePlanSettings(activePlanSettings)
        } else {
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
          setActiveParsedPlan(cache.activeParsedPlan)
          setActiveFolderTree(cache.activeFolderTree)
          setActivePlanSettings(cache.activePlanSettings)
        }

        if (effectiveActivePlanVersionId && !loadedActivePlan) {
          toast.warning(
            fallbackActivePlan
              ? "Chưa tải được phiên bản active từ backend. Đang dùng working plan cùng phiên bản làm dữ liệu dự phòng."
              : "Session đã có phương án được duyệt nhưng chưa tải được dữ liệu cây của phiên bản active."
          )
        } else if (activePlanLoadError) {
          toast.warning(
            activePlanLoadError instanceof Error
              ? activePlanLoadError.message
              : "Không thể kiểm tra phương án active của session."
          )
        }

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
          cache.planAnalysisJobId =
            hasPendingPlanAnalysis && activePlanAnalysisJob
              ? activePlanAnalysisJob.id
              : null
          cache.planViewTab =
            effectiveActivePlanVersionId &&
            String(workingPlan.id ?? "").trim() ===
              effectiveActivePlanVersionId &&
            workingPlan.status !== "draft"
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
          setPlanAnalysisJobId(cache.planAnalysisJobId)
          setPlanViewTab(cache.planViewTab)
          setDossierBuildStrategy(buildStrategy)
          setDocumentNumberingMode(numberingMode)
          setDocumentNumberingStylePreset(numberingStylePreset)
          setDocumentNumberingStyleOverrides(numberingStyleOverrides)
          if (hasPendingPlanAnalysis && activePlanAnalysisJob) {
            setPlanCompletedPhases(new Set(["upload_inputs"]))
            setPlanProgressPhase("preparing_plan_file")
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
          cache.planViewTab = effectiveActivePlanVersionId ? "active" : "draft"
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
          cache.planAnalysisJobId =
            hasPendingPlanAnalysis && activePlanAnalysisJob
              ? activePlanAnalysisJob.id
              : null
          setParsedPlan(cache.parsedPlan)
          setFolderTree(cache.folderTree)
          setWorkingPlanVersionId(cache.workingPlanVersionId)
          setWorkingPlanStatus(cache.workingPlanStatus)
          setPlanDraftDirty(cache.planDraftDirty)
          setPlanViewTab(cache.planViewTab)
          setDoc1State(cache.doc1State)
          setDoc2State(cache.doc2State)
          setPlanAnalysisState(cache.planAnalysisState)
          setPlanAnalysisJobId(cache.planAnalysisJobId)
          setDossierBuildStrategy(cache.dossierBuildStrategy)
          setDocumentNumberingMode(cache.documentNumberingMode)
          if (hasPendingPlanAnalysis && activePlanAnalysisJob) {
            setPlanCompletedPhases(new Set(["upload_inputs"]))
            setPlanProgressPhase("preparing_plan_file")
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

function uploadAttemptTime(
  createdAt: string | null | undefined,
  updatedAt: string | null | undefined
): number {
  const value = createdAt || updatedAt
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function latestLiveJobForSession<
  T extends { sessionId: string; status: string; startedAt: number },
>(jobs: readonly T[], sessionId: string): T | null {
  return (
    jobs
      .filter(
        (job) =>
          job.sessionId === sessionId &&
          !["completed", "cancelled"].includes(job.status)
      )
      .sort((left, right) => right.startedAt - left.startedAt)[0] ?? null
  )
}

function matchesLiveZipAttempt(
  job: { id: string; sessionId: string } | null,
  attempt: SessionInputUploadResponse | null | undefined
): boolean {
  if (!job || !attempt || job.sessionId !== attempt.session_id) return false
  const clientUploadId = String(attempt.client_upload_id ?? "").trim()
  return !clientUploadId || clientUploadId === job.id
}

function matchesLiveFolderAttempt(
  job: {
    id: string
    folderUploadId: string | null
    sessionId: string
  } | null,
  attempt: FolderUploadSummary | null | undefined
): boolean {
  if (!job || !attempt || job.sessionId !== attempt.session_id) return false
  return (
    job.folderUploadId === attempt.folder_upload_id ||
    job.id === attempt.client_upload_id
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

const interruptedAttemptClosures = new Map<string, Promise<void>>()

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

  const tasks: Promise<void>[] = []
  if (shouldCloseFolder && folderAttempt) {
    tasks.push(
      closeInterruptedAttemptOnce(
        `folder:${folderAttempt.folder_upload_id}`,
        async () => {
          await cancelFolderUpload(
            sessionId,
            folderAttempt.folder_upload_id,
            "page_closed"
          )
        }
      )
    )
  }
  if (shouldCloseZip && zipAttempt?.client_upload_id) {
    tasks.push(
      closeInterruptedAttemptOnce(
        `zip:${zipAttempt.client_upload_id}`,
        async () => {
          await cancelRawZipUpload(
            sessionId,
            zipAttempt.client_upload_id as string,
            "page_closed"
          )
        }
      )
    )
  }

  return Promise.allSettled(tasks).then(async () => {
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
      return {
        zipAttempt: zipAttempt ?? null,
        folderAttempt,
      }
    }
  })
}

function closeInterruptedAttemptOnce(
  key: string,
  taskFactory: () => Promise<void>
): Promise<void> {
  const existing = interruptedAttemptClosures.get(key)
  if (existing) return existing
  const task = taskFactory().finally(() => {
    interruptedAttemptClosures.delete(key)
  })
  interruptedAttemptClosures.set(key, task)
  return task
}
