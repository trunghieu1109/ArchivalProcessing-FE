import { useEffect, useRef, useState } from "react"
import { useCallback } from "react"
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom"
import { toast } from "sonner"
import { useAuth } from "@/features/auth/lib/AuthContext"
import {
  useFolderUploadJobs,
  useFolderUploadManager,
} from "@/features/folder-upload"
import { useZipUploadJobs, useZipUploadManager } from "@/features/zip-upload"
import { visibleAwareDelay } from "@/shared/lib/pageVisibility"
import type { SessionMetadataValues } from "@/features/upload/components/SessionMetadataBar"
import type {
  PendingDataUploadSummary,
  UnifiedDataUploadHandle,
} from "@/features/upload/components/step1/PendingDataUpload"
import {
  ensureClusterBuild,
  getActivePlan,
  getSession,
  getWorkingPlan,
  listSessionEvents,
  type DossierBuildStrategy,
  type DocumentNumberingMode,
  type DocumentNumberingStylePreset,
  type PlanVersionStatus,
  type SessionInputUploadResponse,
  type UploadMode,
  type UploadProgressSnapshot,
} from "@/features/upload/api/sessionApi"
import { isOcrWaitSupersededError } from "@/features/upload/hooks/useOcrFolder"
import type { NumberingStyleOverrides } from "./UploadPage.planDefaults"
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
import {
  canNavigateDirectlyToMetadata,
  resolvePlanInputsReuploaded,
} from "./UploadPage.workflowPolicy"
import { createUploadPageActions } from "./UploadPage.actions"
import { isMetadataDiscoveryPending } from "./UploadPage.metadataDiscovery"
import { useUploadPageOcr } from "./UploadPage.ocr"
import { useUploadPageLifecycle } from "./UploadPage.lifecycle"
import { uploadPageCache as cache } from "./UploadPage.cache"
import {
  PLAN_PROGRESS_PHASES,
  PLAN_ANALYSIS_POLL_INTERVAL_MS,
  STEP_LABELS,
  normalizePlanProgressPhase,
  planAnalysisEventBelongsToJob,
  planProgressMessageForPhase,
} from "./UploadPage.progress"
import {
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
import {
  dossierBuildMissingLabels,
  dossierBuildMissingMessage,
  hasExpertReviewedDocuments,
  missingDossierBuildInputs,
  selectedUploadLabels,
} from "./UploadPage.requirements"
import { workflowStepFromLocation } from "./UploadPage.routing"

export function UploadPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const folderUploadJobs = useFolderUploadJobs()
  const folderUploadManager = useFolderUploadManager()
  const zipUploadJobs = useZipUploadJobs()
  const zipUploadManager = useZipUploadManager()
  const { step, sessionId: routeSessionId } = useParams<{
    step: string
    sessionId?: string
  }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const existingSessionMode = Boolean(routeSessionId)
  const currentStep = workflowStepFromLocation(step, location.pathname)
  const visitedStepStorageKey = `archival-processing:highest-visited-step:${routeSessionId ?? "new"}`
  const storedVisitedStep = Number(
    window.sessionStorage.getItem(visitedStepStorageKey)
  )
  const highestVisitedStep = Math.max(
    currentStep,
    Number.isInteger(storedVisitedStep)
      ? Math.min(Math.max(storedVisitedStep, 1), 7)
      : 1
  ) as AppStep

  useEffect(() => {
    window.sessionStorage.setItem(
      visitedStepStorageKey,
      String(highestVisitedStep)
    )
  }, [highestVisitedStep, visitedStepStorageKey])
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
    const hasActivePlanForBuild = Boolean(activePlanVersionId)
    const missingInputs = missingDossierBuildInputs({
      hasArrangementPlan: doc1Has,
      hasRetentionSchedule: doc2Has,
      hasVerifiedDocuments,
      hasActivePlan: hasActivePlanForBuild,
    })
    if (missingInputs.length > 0) {
      toast.error(dossierBuildMissingMessage(missingInputs))
      return
    }

    try {
      let buildStrategy = activePlanSettings.dossierBuildStrategy
      if (hasActivePlanForBuild && activeParsedPlan.groups.length === 0) {
        try {
          const hydratedActivePlan = await getActivePlan(currentSessionId)
          if (hydratedActivePlan) {
            applyActivePlanResponse(hydratedActivePlan)
            buildStrategy = activePlanBuildStrategy(hydratedActivePlan)
          }
        } catch {
          // UI hydration is best-effort. The backend remains authoritative for
          // active-plan validation when ensureClusterBuild is called below.
        }
      }
      const response = await ensureClusterBuild(currentSessionId, {
        source: "user_view_results",
        dossier_build_strategy: buildStrategy,
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
  const dataUploadRef = useRef<UnifiedDataUploadHandle>(null)
  const metadataAutoStartRef = useRef(false)
  const primaryActionLockRef = useRef(false)
  const previousStepRef = useRef(currentStep)
  const folderAutoNavigationRef = useRef<{
    sessionId: string
    jobId: string
    status: string
  } | null>(null)
  const zipAutoNavigationRef = useRef<{
    sessionId: string
    jobId: string
    status: string
  } | null>(null)

  const [doc1State, setDoc1State] = useState<ProcessState>(cache.doc1State)
  const [doc2State, setDoc2State] = useState<ProcessState>(cache.doc2State)
  const [zipState, setZipState] = useState<ProcessState>(cache.zipState)
  const [planAnalysisState, setPlanAnalysisState] = useState<ProcessState>(
    cache.planAnalysisState
  )
  const [planAnalysisJobId, setPlanAnalysisJobId] = useState<number | null>(
    cache.planAnalysisJobId
  )
  const [dossierBuildStrategy, setDossierBuildStrategy] =
    useState<DossierBuildStrategy>(cache.dossierBuildStrategy)
  const [documentNumberingMode, setDocumentNumberingMode] =
    useState<DocumentNumberingMode>(cache.documentNumberingMode)
  const [documentNumberingStylePreset, setDocumentNumberingStylePreset] =
    useState<DocumentNumberingStylePreset>(cache.documentNumberingStylePreset)
  const [documentNumberingStyleOverrides, setDocumentNumberingStyleOverrides] =
    useState<NumberingStyleOverrides>(cache.documentNumberingStyleOverrides)

  const [doc1Has, setDoc1Has] = useState(cache.doc1Has)
  const [doc2Has, setDoc2Has] = useState(cache.doc2Has)
  const [zipHas, setZipHas] = useState(cache.zipHas)

  const [, setZipEntries] = useState<ArchiveEntry[]>(cache.zipEntries)
  const [folderTree, setFolderTree] = useState<FolderNode[]>(cache.folderTree)
  const [parsedPlan, setParsedPlan] = useState<ParsedPlan>(cache.parsedPlan)
  const [activeFolderTree, setActiveFolderTree] = useState<FolderNode[]>(
    cache.activeFolderTree
  )
  const [activeParsedPlan, setActiveParsedPlan] = useState<ParsedPlan>(
    cache.activeParsedPlan
  )
  const [activePlanSettings, setActivePlanSettings] = useState(
    cache.activePlanSettings
  )
  const [clusterGroups, setClusterGroups] = useState<ClusterGroup[]>(
    cache.clusterGroups
  )
  const [workingPlanVersionId, setWorkingPlanVersionId] = useState(
    cache.workingPlanVersionId
  )
  const [workingPlanStatus, setWorkingPlanStatus] = useState<
    PlanVersionStatus | ""
  >(cache.workingPlanStatus)
  const [planDraftDirty, setPlanDraftDirty] = useState(cache.planDraftDirty)
  const [activePlanVersionId, setActivePlanVersionId] = useState(
    cache.activePlanVersionId
  )
  const [planViewTab, setPlanViewTab] = useState<"draft" | "active">(
    cache.planViewTab
  )
  const [sessionId, setSessionId] = useState<string | null>(cache.sessionId)
  const [sessionMetadata, setSessionMetadata] = useState<SessionMetadataValues>(
    cache.sessionMetadata
  )
  const syncSessionMetadataDraft = useCallback(
    (metadata: SessionMetadataValues) => {
      cache.sessionMetadata = metadata
      setSessionMetadata(metadata)
    },
    []
  )
  const [zipFolderPath, setZipFolderPath] = useState(cache.zipFolderPath)
  const [zipMaxFiles, setZipMaxFiles] = useState(cache.zipMaxFiles)
  const [zipUploadProgress, setZipUploadProgress] =
    useState<UploadProgressSnapshot | null>(cache.zipUploadProgress)
  const [latestZipUploadAttempt, setLatestZipUploadAttempt] =
    useState<SessionInputUploadResponse | null>(null)
  const [sessionLoading, setSessionLoading] = useState(false)
  const [primaryActionPending, setPrimaryActionPending] = useState(false)
  const [pendingDataUpload, setPendingDataUpload] =
    useState<PendingDataUploadSummary | null>(null)
  const [handledFolderIngestionRuns, setHandledFolderIngestionRuns] = useState<
    Set<string>
  >(() => new Set())
  const [confirmingPlan, setConfirmingPlan] = useState(false)
  const [savingPlanDraft, setSavingPlanDraft] = useState(false)
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
  const planInputStateRef = useRef({ doc1Has, doc2Has })

  useEffect(() => {
    planInputStateRef.current = { doc1Has, doc2Has }
  }, [doc1Has, doc2Has])

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
    restoreFolderUploadSummary: (
      summary: Parameters<typeof folderUploadManager.restoreFromSummary>[0]
    ) => folderUploadManager.restoreFromSummary(summary),
  })

  useEffect(() => {
    const previousStep = previousStepRef.current
    previousStepRef.current = currentStep
    if (currentStep !== 1 || previousStep === 1 || !routeSessionId) return

    let cancelled = false
    void getSession(routeSessionId)
      .then((sessionDetail) => {
        if (cancelled) return
        const zipFiles = (sessionDetail.files ?? []).filter(
          (file) => file.file_type === "raw_zip"
        )
        const latestZipAttempt = zipFiles[zipFiles.length - 1] ?? null
        const latestCompletedZip =
          [...zipFiles]
            .reverse()
            .find((file) => file.upload_status === "completed") ?? null
        setLatestZipUploadAttempt(latestZipAttempt)
        if (latestCompletedZip) {
          cache.zipHas = true
          cache.zipState = "done"
          cache.zipUpload = latestCompletedZip
          cache.zipFolderPath =
            latestCompletedZip.folder_path ??
            latestCompletedZip.data_path ??
            cache.zipFolderPath
          cache.rawZipReuploaded = false
          setZipHas(true)
          setZipState("done")
          setZipFolderPath(cache.zipFolderPath)
          setZipSupplementUploaded(false)
          const completedJob = [...zipUploadJobs]
            .filter(
              (job) =>
                job.sessionId === routeSessionId && job.status === "completed"
            )
            .sort((left, right) => right.startedAt - left.startedAt)[0]
          if (completedJob) {
            zipUploadManager.markMetadataNavigationHandled(completedJob.id)
          }
        }
        if (sessionDetail.latest_folder_upload) {
          folderUploadManager.restoreFromSummary(
            sessionDetail.latest_folder_upload
          )
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [
    currentStep,
    folderUploadManager,
    routeSessionId,
    zipUploadJobs,
    zipUploadManager,
  ])

  const ocrUploadSessionId = routeSessionId ?? sessionId ?? cache.sessionId
  const latestOcrFolderUploadJob = [...folderUploadJobs]
    .filter((job) => job.sessionId === ocrUploadSessionId)
    .sort((left, right) => right.startedAt - left.startedAt)[0]
  const latestOcrFolderIngestionRun =
    latestOcrFolderUploadJob?.summary?.ingestion_run
  const ocrExternalRefreshKey =
    latestOcrFolderIngestionRun &&
    latestOcrFolderUploadJob?.summary?.document_sync_status === "ready"
      ? [
          ocrUploadSessionId,
          latestOcrFolderUploadJob.id,
          latestOcrFolderIngestionRun.id,
          latestOcrFolderUploadJob.summary.counts.mapped_documents,
          ...(latestOcrFolderIngestionRun.ocr_batch_ids ?? []),
        ].join(":")
      : null

  const {
    ocr,
    ocrMetadataItems,
    ocrPdfPaths,
    ocrSignatureStatus,
    ocrIsReextracting,
    ocrPendingIngestionCount,
    ocrPendingIngestionMessage,
    ocrMessage,
    ocrLoading,
  } = useUploadPageOcr(sessionId, {
    enabled: currentStep === 3,
    externalRefreshKey: ocrExternalRefreshKey,
  })

  useEffect(() => {
    if (
      !sessionId ||
      planAnalysisState !== "processing" ||
      planAnalysisJobId === null
    )
      return

    let cancelled = false
    let afterId = 0
    let jobCompleted = false
    let timeoutId: number | undefined
    const schedule = () => {
      if (!cancelled) {
        timeoutId = window.setTimeout(
          poll,
          visibleAwareDelay(PLAN_ANALYSIS_POLL_INTERVAL_MS)
        )
      }
    }

    const poll = async () => {
      if (document.visibilityState === "hidden") {
        schedule()
        return
      }
      try {
        const response = await listSessionEvents(sessionId, {
          afterId,
          limit: 500,
        })
        if (cancelled) return
        for (const event of response.events) {
          afterId = Math.max(afterId, event.id)
          if (
            !planAnalysisEventBelongsToJob(event.payload, planAnalysisJobId)
          ) {
            continue
          }
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
            if (phase) {
              const eventMessage = String(event.message ?? "").trim()
              setPlanProgressMessage(
                eventMessage || planProgressMessageForPhase(phase)
              )
            }
          }
          if (event.event_type === "plan.analysis.completed") {
            jobCompleted = true
            const finalPhase =
              PLAN_PROGRESS_PHASES[PLAN_PROGRESS_PHASES.length - 1]?.id ?? null
            setPlanProgressPhase(finalPhase)
            setPlanCompletedPhases(
              new Set(
                PLAN_PROGRESS_PHASES.slice(0, -1).map((phase) => phase.id)
              )
            )
            setPlanProgressMessage(
              "Phân tích đã hoàn tất. Đang tải kết quả mới nhất."
            )
          }
        }
      } catch {
        // Progress events are best-effort; the working-plan polling owns errors.
      }
      try {
        const planResponse = await getWorkingPlan(sessionId)
        if (cancelled) return
        const currentPlanVersionId = cache.workingPlanVersionId
        const nextPlanVersionId = planResponse?.id ?? ""
        const nextPlanSignature = planResponse
          ? planResponseMaterialSignature(planResponse)
          : ""
        const nextParsedPlan = planResponse
          ? activePlanToParsedPlan(planResponse)
          : null
        const cachedPlanHasDisplayData =
          cache.parsedPlan.groups.length > 0 ||
          cache.parsedPlan.retention_appendices.length > 0 ||
          cache.parsedPlan.retention_sources.length > 0
        const nextPlanHasDisplayData = Boolean(
          nextParsedPlan &&
          (nextParsedPlan.groups.length > 0 ||
            nextParsedPlan.retention_appendices.length > 0 ||
            nextParsedPlan.retention_sources.length > 0)
        )
        const sameVersionNeedsHydration =
          Boolean(nextPlanVersionId) &&
          nextPlanVersionId === currentPlanVersionId &&
          !cachedPlanHasDisplayData &&
          nextPlanHasDisplayData
        const planMaterialChanged =
          Boolean(nextPlanSignature) &&
          nextPlanSignature !== cache.workingPlanSignature
        const shouldApplyPlan =
          Boolean(planResponse) &&
          (jobCompleted ||
            !currentPlanVersionId ||
            (nextPlanVersionId && nextPlanVersionId !== currentPlanVersionId) ||
            sameVersionNeedsHydration ||
            planMaterialChanged)
        if (planResponse && nextParsedPlan && shouldApplyPlan) {
          const plan = nextParsedPlan
          const draftPayload = planResponseToDraftPayload(planResponse)
          const buildStrategy = activePlanBuildStrategy(planResponse)
          const numberingMode = activePlanDocumentNumberingMode(planResponse)
          const numberingStylePreset =
            activePlanDocumentNumberingStylePreset(planResponse)
          const numberingStyleOverrides =
            activePlanDocumentNumberingStyleOverrides(planResponse)
          const planIsActive = planResponse.status === "active"

          cache.workingPlanVersionId = planResponse.id ?? ""
          cache.workingPlanStatus = planResponse.status ?? ""
          cache.workingPlanResponse = planResponse
          cache.workingPlanSignature =
            planResponseMaterialSignature(planResponse)
          cache.planDraftBaseSignature = planDraftPayloadSignature(draftPayload)
          cache.planDraftDirty = false
          cache.planDraftRevision = 0
          cache.parsedPlan = plan
          cache.folderTree = planToTree(plan)
          cache.planViewTab = planIsActive ? "active" : "draft"
          cache.planAnalysisState = "done"
          cache.planAnalysisJobId = null
          const { doc1Has: currentDoc1Has, doc2Has: currentDoc2Has } =
            planInputStateRef.current
          cache.doc1State = currentDoc1Has ? "done" : "idle"
          cache.doc2State = currentDoc2Has ? "done" : "idle"
          cache.dossierBuildStrategy = buildStrategy
          cache.persistedDossierBuildStrategy = buildStrategy
          cache.documentNumberingMode = numberingMode
          cache.persistedDocumentNumberingMode = numberingMode
          cache.documentNumberingStylePreset = numberingStylePreset
          cache.persistedDocumentNumberingStylePreset = numberingStylePreset
          cache.documentNumberingStyleOverrides = numberingStyleOverrides
          cache.persistedDocumentNumberingStyleOverrides =
            numberingStyleOverrides
          if (planIsActive) {
            const activePlan = activePlanToParsedPlan(planResponse)
            cache.activePlanVersionId = cache.workingPlanVersionId
            cache.activePlanResponse = planResponse
            cache.activePlanSignature = cache.workingPlanSignature
            cache.activeParsedPlan = activePlan
            cache.activeFolderTree = planToTree(activePlan)
            cache.activePlanSettings = {
              dossierBuildStrategy: buildStrategy,
              documentNumberingMode: numberingMode,
              documentNumberingStylePreset: numberingStylePreset,
              documentNumberingStyleOverrides: numberingStyleOverrides,
            }
          }

          setParsedPlan(plan)
          setFolderTree(cache.folderTree)
          setWorkingPlanVersionId(cache.workingPlanVersionId)
          setWorkingPlanStatus(cache.workingPlanStatus)
          setPlanDraftDirty(false)
          setPlanViewTab(cache.planViewTab)
          setPlanAnalysisState("done")
          setPlanAnalysisJobId(null)
          setDoc1State(cache.doc1State)
          setDoc2State(cache.doc2State)
          setDossierBuildStrategy(buildStrategy)
          setDocumentNumberingMode(numberingMode)
          setDocumentNumberingStylePreset(numberingStylePreset)
          setDocumentNumberingStyleOverrides(numberingStyleOverrides)
          if (planIsActive) {
            setActivePlanVersionId(cache.activePlanVersionId)
            setActiveParsedPlan(cache.activeParsedPlan)
            setActiveFolderTree(cache.activeFolderTree)
            setActivePlanSettings(cache.activePlanSettings)
          }
          setPlanProgressPhase(null)
          setPlanCompletedPhases(
            new Set(PLAN_PROGRESS_PHASES.map((phase) => phase.id))
          )
          setPlanProgressMessage("Đã phân tích xong phương án chỉnh lý.")
          return
        }
      } catch {
        // The job may still be queued/running; keep polling quietly.
      }
      schedule()
    }

    const handleVisibilityChange = () => {
      if (cancelled || document.visibilityState === "hidden") return
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
      timeoutId = undefined
      void poll()
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    void poll()
    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [planAnalysisJobId, planAnalysisState, sessionId])

  const {
    ensureSession,
    saveSessionMetadata,
    uploadInput,
    stageZipInput,
    discardStagedZipInput,
    uploadRetentionInputs,
    syncZipFolderPath,
    syncZipMaxFiles,
    syncUploadMode,
    syncZipUploadProgress,
    zipUploadProgressForFile,
    syncPlanAnalysisState,
    applyPersistedDossierBuildStrategy,
    selectDossierBuildStrategy,
    applyPersistedDocumentNumberingMode,
    applyPersistedDocumentNumberingStylePreset,
    applyPersistedDocumentNumberingStyleOverrides,
    applyWorkingPlanResponse,
    applyActivePlanResponse,
    selectDocumentNumberingModeDraft,
    selectDocumentNumberingStylePreset,
    selectDocumentNumberingStyleOverrides,
    syncDoc1Has,
    syncDoc2Has,
    syncZipHas,
    syncZipEntries,
    syncFolderTree,
    savePlanChanges,
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
    setZipState,
    setPlanProgressPhase,
    setPlanProgressMessage,
    setPlanCompletedPhases,
    zipUploadManager,
  })

  const planInputsReuploaded =
    planReuploadState.arrangement || planReuploadState.retention
  // URL session is the source of truth while viewing an existing session.
  // The local session id is only used for the `/sessions/new` flow after
  // ensureSession has created the backing session.
  const currentSessionKey = routeSessionId ?? sessionId ?? cache.sessionId
  const latestZipUploadJob = [...zipUploadJobs]
    .filter((job) => job.sessionId === currentSessionKey)
    .sort((left, right) => right.startedAt - left.startedAt)[0]
  const latestFolderUploadJob = [...folderUploadJobs]
    .filter((job) => job.sessionId === currentSessionKey)
    .sort((left, right) => right.startedAt - left.startedAt)[0]
  const currentFolderUploadJob = [...folderUploadJobs]
    .filter(
      (job) => job.sessionId === currentSessionKey && job.status !== "cancelled"
    )
    .sort((left, right) => right.startedAt - left.startedAt)[0]
  const currentZipUploadJob = [...zipUploadJobs]
    .filter(
      (job) => job.sessionId === currentSessionKey && job.status !== "cancelled"
    )
    .sort((left, right) => right.startedAt - left.startedAt)[0]
  const restoredZipAttemptAt = Date.parse(
    latestZipUploadAttempt?.created_at ?? ""
  )
  const useLiveZipAttempt = Boolean(latestZipUploadJob)
  const zipAttemptAt = useLiveZipAttempt
    ? (latestZipUploadJob?.startedAt ?? 0)
    : Number.isFinite(restoredZipAttemptAt)
      ? restoredZipAttemptAt
      : 0
  const zipInterruptionCandidate = useLiveZipAttempt
    ? latestZipUploadJob &&
      ["cancelled", "attention_required"].includes(latestZipUploadJob.status)
      ? {
          fileName: latestZipUploadJob.fileName,
          status: latestZipUploadJob.status,
          cancelReason:
            latestZipUploadJob.status === "cancelled" ? "user_cancelled" : null,
        }
      : null
    : latestZipUploadAttempt &&
        latestZipUploadAttempt.upload_status !== "completed"
      ? {
          fileName: latestZipUploadAttempt.file_name,
          status: latestZipUploadAttempt.upload_status ?? "incomplete",
          cancelReason: latestZipUploadAttempt.cancel_reason ?? null,
        }
      : null
  const folderAttemptAt = latestFolderUploadJob?.startedAt ?? 0
  const folderInterruptionCandidate =
    latestFolderUploadJob?.summary &&
    latestFolderUploadJob.summary.status !== "sealed" &&
    latestFolderUploadJob.summary.status !== "completed" &&
    (latestFolderUploadJob.files.length === 0 ||
      latestFolderUploadJob.status === "cancelled")
      ? latestFolderUploadJob.summary
      : null
  const latestAttemptIsFolder = folderAttemptAt > zipAttemptAt
  const zipInterruptionNotice = latestAttemptIsFolder
    ? null
    : zipInterruptionCandidate
  const folderInterruptionNotice = latestAttemptIsFolder
    ? folderInterruptionCandidate
    : null
  const cancelledFolderHasUsableDocuments = Boolean(
    latestFolderUploadJob?.status === "cancelled" &&
    latestFolderUploadJob.summary?.document_sync_status === "ready" &&
    (latestFolderUploadJob.summary.counts.effective ?? 0) > 0
  )
  const folderAttemptSupersedesZipPresentation =
    latestAttemptIsFolder &&
    (latestFolderUploadJob?.status !== "cancelled" ||
      cancelledFolderHasUsableDocuments)
  const displayedZipUploadJob = folderAttemptSupersedesZipPresentation
    ? undefined
    : currentZipUploadJob
  const zipUploadReady = Boolean(
    displayedZipUploadJob?.status === "completed" &&
    displayedZipUploadJob.result
  )
  const zipUploadPendingMetadata = Boolean(
    zipUploadReady && !displayedZipUploadJob?.metadataNavigationHandled
  )
  const completedZipPresentationHandled = Boolean(
    displayedZipUploadJob?.status === "completed" &&
    displayedZipUploadJob.metadataNavigationHandled
  )
  const presentedZipUploadJob = completedZipPresentationHandled
    ? undefined
    : displayedZipUploadJob
  const effectiveZipUploadProgress =
    folderAttemptSupersedesZipPresentation || completedZipPresentationHandled
      ? null
      : (presentedZipUploadJob?.progress ?? zipUploadProgress)
  const effectiveZipState: ProcessState =
    displayedZipUploadJob &&
    !["completed", "cancelled", "attention_required"].includes(
      displayedZipUploadJob.status
    )
      ? "processing"
      : zipUploadReady
        ? "done"
        : zipState
  const folderUploadEffectiveCount =
    currentFolderUploadJob?.summary?.counts.effective ?? 0
  const folderUploadWasCancelled =
    currentFolderUploadJob?.summary?.status === "cancelled"
  const folderUploadReady = Boolean(
    currentFolderUploadJob?.status === "completed" &&
    currentFolderUploadJob.summary?.ingestion_run?.status === "ready" &&
    folderUploadEffectiveCount > 0
  )
  const folderIngestionRunKey =
    currentSessionKey && currentFolderUploadJob?.summary?.ingestion_run?.id
      ? `${currentSessionKey}:${currentFolderUploadJob.summary.ingestion_run.id}`
      : null
  const folderUploadActionReady = Boolean(
    folderUploadReady &&
    folderIngestionRunKey &&
    !currentFolderUploadJob?.summary?.ingestion_run?.ocr_batch_ids?.length &&
    !handledFolderIngestionRuns.has(folderIngestionRunKey)
  )
  const folderUploadCanNavigateDirectly =
    canNavigateDirectlyToMetadata(doc1Has, doc2Has) &&
    !resolvePlanInputsReuploaded({
      renderedState: Boolean(planInputsReuploaded),
      arrangementCached: cache.arrangementPlanReuploaded,
      retentionCached: cache.retentionReuploaded,
    })
  const folderUploadMetadataNavigationReady =
    folderUploadActionReady && folderUploadCanNavigateDirectly
  const folderUploadInProgress = Boolean(
    currentFolderUploadJob &&
    ["preparing", "uploading", "sealing", "reconciling", "cancelling"].includes(
      currentFolderUploadJob.status
    )
  )
  const zipUploadCompleting = Boolean(
    currentZipUploadJob?.status === "completing"
  )
  const postUploadDiscoveryPending = latestAttemptIsFolder
    ? Boolean(
        currentFolderUploadJob &&
        ["sealing", "reconciling"].includes(currentFolderUploadJob.status)
      )
    : zipUploadCompleting
  const postUploadDiscoveryMessage = latestAttemptIsFolder
    ? "Đã upload folder. Đang tạo ingestion run..."
    : "Đang extract file ZIP..."
  const folderInputIsLatest = Boolean(
    latestAttemptIsFolder && currentFolderUploadJob
  )
  const targetFolderUploadReady = folderInputIsLatest && folderUploadReady
  const targetZipUploadResult = targetFolderUploadReady
    ? null
    : (currentZipUploadJob?.result ?? cache.zipUpload)
  const metadataTargetIngestionRun =
    (targetFolderUploadReady
      ? currentFolderUploadJob?.summary?.ingestion_run
      : targetZipUploadResult?.ingestion_run) ?? null
  const metadataTargetIngestionRunId = metadataTargetIngestionRun?.id ?? null
  const discoveredMetadataTargetRun =
    metadataTargetIngestionRunId === null
      ? null
      : (ocr.status?.ingestion_runs ?? []).find(
          (run) => run.id === metadataTargetIngestionRunId
        )
  const currentMetadataTargetRun =
    discoveredMetadataTargetRun ?? metadataTargetIngestionRun
  const metadataTargetRunStatus = String(currentMetadataTargetRun?.status ?? "")
    .trim()
    .toLowerCase()
  const metadataTargetIsZipExtracting = Boolean(
    currentMetadataTargetRun?.ingestion_source === "zip" &&
    ["extract_starting", "extracting", "legacy_unknown"].includes(
      metadataTargetRunStatus
    )
  )
  const metadataTargetReadyForOcr = Boolean(
    discoveredMetadataTargetRun?.status === "ready" &&
    ocr.status?.pagination !== undefined
  )
  const metadataTargetBatch =
    metadataTargetIngestionRunId === null
      ? null
      : ([...(ocr.status?.batches ?? [])]
          .filter(
            (batch) => batch.ingestion_run_id === metadataTargetIngestionRunId
          )
          .sort((left, right) => right.id - left.id)[0] ?? null)
  const metadataTargetExpectedDocumentCount = Math.max(
    0,
    currentMetadataTargetRun?.effective_document_count ??
      currentMetadataTargetRun?.total_pdf_files ??
      currentMetadataTargetRun?.extracted_count ??
      0
  )
  const metadataTargetDiscoveredDocumentCount = Object.values(
    metadataTargetBatch?.status_counts ?? {}
  ).reduce((total, count) => total + Math.max(0, Number(count) || 0), 0)
  const metadataTargetBatchDiscoveryComplete = Boolean(
    metadataTargetBatch &&
    (metadataTargetBatch.remote_discovery_complete === true ||
      (metadataTargetBatch.remote_discovery_complete === undefined &&
        metadataTargetExpectedDocumentCount > 0 &&
        metadataTargetDiscoveredDocumentCount >=
          metadataTargetExpectedDocumentCount))
  )
  const metadataDiscoveryPending = isMetadataDiscoveryPending({
    currentStep,
    targetIngestionRunId: metadataTargetIngestionRunId,
    targetIngestionRunStatus: metadataTargetRunStatus,
    batchDiscoveryComplete: metadataTargetBatchDiscoveryComplete,
  })
  const metadataDiscoveryMessage = "Đang bổ sung dần các tài liệu mới..."
  const displayedPendingIngestionCount = Math.max(
    ocrPendingIngestionCount,
    metadataTargetIsZipExtracting ? 1 : 0
  )
  const displayedPendingIngestionMessage = metadataTargetIsZipExtracting
    ? "Đang extract file ZIP..."
    : ocrPendingIngestionMessage
  const hasPendingDataUpload = pendingDataUpload !== null
  const dataInputHas = zipHas || zipUploadReady || folderUploadReady
  const hasVerifiedDocuments = hasExpertReviewedDocuments({
    reviewedCount: ocr.status?.metadata_reviewed_documents ?? 0,
    documents: ocrMetadataItems,
  })
  const hasAnyFile = doc1Has || doc2Has || dataInputHas || hasPendingDataUpload
  const hasActivePlan = Boolean(activePlanVersionId)
  const hasWorkingPlan = Boolean(workingPlanVersionId)
  const draftMatchesActive =
    Boolean(cache.activePlanSignature) &&
    Boolean(cache.workingPlanSignature) &&
    cache.workingPlanSignature === cache.activePlanSignature
  const hasAnalyzedPlan =
    planAnalysisState === "done" &&
    hasWorkingPlan &&
    doc1Has &&
    parsedPlan.groups.length > 0
  const hasPlanReady = hasAnalyzedPlan || hasActivePlan
  const missingDossierInputs = missingDossierBuildInputs({
    hasArrangementPlan: doc1Has,
    hasRetentionSchedule: doc2Has,
    hasVerifiedDocuments,
    hasActivePlan,
  })
  const missingDossierInputLabels =
    dossierBuildMissingLabels(missingDossierInputs)
  const selectedInputLabels = selectedUploadLabels({
    hasArrangementPlan: doc1Has,
    hasRetentionSchedule: doc2Has,
    hasRawZip: dataInputHas,
  })
  const readyCount = (
    existingSessionMode
      ? planInputsReuploaded
        ? [planInputsReuploaded]
        : [dataInputHas || hasPendingDataUpload]
      : [doc1Has, doc2Has, dataInputHas || hasPendingDataUpload]
  ).filter(Boolean).length
  const requiredFileCount = existingSessionMode ? 1 : 3
  const arrangementPlanAnalyzing =
    planAnalysisState === "processing" && doc1State === "processing"
  const statusItems = existingSessionMode
    ? [
        {
          label: "Phương án",
          has: hasPlanReady,
          state: arrangementPlanAnalyzing
            ? "processing"
            : hasPlanReady
              ? "done"
              : "idle",
        },
        { label: "Thời hạn", has: doc2Has, state: doc2State },
        {
          label: "Kho lưu trữ",
          has: dataInputHas || hasPendingDataUpload,
          state: hasPendingDataUpload
            ? "idle"
            : folderUploadInProgress
              ? "processing"
              : folderUploadReady
                ? "done"
                : effectiveZipState,
        },
      ]
    : [
        { label: "Phương án", has: doc1Has, state: doc1State },
        { label: "Thời hạn", has: doc2Has, state: doc2State },
        {
          label: "Kho lưu trữ",
          has: dataInputHas || hasPendingDataUpload,
          state: hasPendingDataUpload
            ? "idle"
            : folderUploadInProgress
              ? "processing"
              : folderUploadReady
                ? "done"
                : effectiveZipState,
        },
      ]
  const planAnalyzing = planAnalysisState === "processing"
  const zipUploadInProgress =
    Boolean(
      effectiveZipUploadProgress !== null &&
      effectiveZipUploadProgress.phase !== "done" &&
      effectiveZipUploadProgress.phase !== "error"
    ) ||
    Boolean(
      currentZipUploadJob &&
      !["completed", "cancelled", "attention_required"].includes(
        currentZipUploadJob.status
      )
    )
  const zipProcessingBlocksAction =
    zipUploadInProgress || (!existingSessionMode && zipState === "processing")
  const allProcessing =
    planAnalyzing ||
    doc1State === "processing" ||
    doc2State === "processing" ||
    zipProcessingBlocksAction ||
    folderUploadInProgress ||
    postUploadDiscoveryPending
  const allDone = hasPlanReady && !planInputsReuploaded
  const canOpenPlanAnalysisStep =
    existingSessionMode && planAnalyzing && (doc1Has || doc2Has)
  const primaryActionAvailable = existingSessionMode
    ? planInputsReuploaded ||
      doc1Has ||
      doc2Has ||
      hasPlanReady ||
      canOpenPlanAnalysisStep ||
      dataInputHas ||
      hasPendingDataUpload
    : hasAnyFile
  const primaryActionDisabled =
    primaryActionPending ||
    sessionLoading ||
    !primaryActionAvailable ||
    (allProcessing && !canOpenPlanAnalysisStep)

  const startMetadataExtractionFromZip = useCallback(async () => {
    const currentSessionId = sessionId ?? routeSessionId ?? cache.sessionId
    if (!currentSessionId) {
      toast.error("Chưa có session để extract metadata.")
      return
    }
    const folderPath = targetFolderUploadReady
      ? (currentFolderUploadJob?.rootName ?? "")
      : zipFolderPath ||
        targetZipUploadResult?.folder_path ||
        targetZipUploadResult?.data_path ||
        ""
    if (!folderPath && !targetFolderUploadReady) {
      toast.error("Chưa có folder_path để bắt đầu lấy metadata.")
      return
    }
    if (targetZipUploadResult && !targetZipUploadResult.remote_batch_id) {
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
    try {
      existingStatus = await ocr.refresh()
    } catch {
      existingStatus = ocr.status ?? null
    }
    const existingDocumentCount = Math.max(
      existingStatus?.total_files ?? 0,
      existingStatus?.total_jobs ?? 0,
      existingStatus?.pagination?.total ?? 0,
      existingStatus?.jobs.length ?? 0
    )
    const existingTargetIngestionRun = (
      existingStatus?.ingestion_runs ?? []
    ).find((run) => run.id === metadataTargetIngestionRunId)
    const targetRunAlreadySubmitted = Boolean(
      existingTargetIngestionRun?.ocr_batch_ids?.length
    )
    const hasNewFolderUpload =
      targetFolderUploadReady &&
      metadataTargetIngestionRunId !== null &&
      !targetRunAlreadySubmitted
    const hasNewZipUpload =
      !targetFolderUploadReady &&
      Boolean(targetZipUploadResult?.id) &&
      (cache.rawZipReuploaded ||
        zipUploadPendingMetadata ||
        (metadataTargetIngestionRunId !== null && !targetRunAlreadySubmitted))
    if (existingDocumentCount > 0 && !hasNewZipUpload && !hasNewFolderUpload) {
      const readyDocuments =
        existingStatus?.metadata_ready_documents ??
        existingStatus?.jobs.filter((job) => job.metadata_ready).length ??
        0
      const failedDocuments =
        existingStatus?.metadata_failed_documents ??
        (existingStatus?.status_counts?.failed ?? 0) +
          (existingStatus?.status_counts?.final_failed ?? 0) +
          (existingStatus?.status_counts?.signature_failed ?? 0) +
          (existingStatus?.status_counts?.skipped ?? 0) +
          (existingStatus?.status_counts?.cancelled ?? 0) +
          (existingStatus?.status_counts?.missing_task ?? 0)
      const hasPendingMetadata =
        existingDocumentCount > readyDocuments + failedDocuments ||
        Boolean(
          existingStatus?.jobs.some(
            (job) =>
              !job.metadata_ready &&
              ![
                "failed",
                "final_failed",
                "signature_failed",
                "skipped",
                "cancelled",
                "missing_task",
              ].includes(
                String(job.status || "")
                  .trim()
                  .toLowerCase()
              )
          )
        )
      syncZipState(hasPendingMetadata ? "processing" : "done")
      if (hasPendingMetadata) {
        void ocr.refreshDocumentsPage({ force: true })
        toast.info("Session đã có job extract metadata. Đang theo dõi tiếp.")
      } else {
        toast.info("Session đã có job extract metadata. Không tạo job mới.")
      }
      return
    }

    syncZipState("processing")
    toast.success("Bắt đầu lấy metadata.")
    void ocr
      .start(folderPath, {
        maxFiles: maxFilesToProcess,
        documentNumberingMode,
        documentNumberingStylePreset,
        documentNumberingStyleOverrides,
        sessionFileId: targetFolderUploadReady
          ? undefined
          : targetZipUploadResult?.id,
        remoteFileId: targetFolderUploadReady
          ? null
          : (targetZipUploadResult?.remote_file_id ?? null),
        ingestionRunIds:
          metadataTargetIngestionRunId === null
            ? undefined
            : [metadataTargetIngestionRunId],
        uploadMode: targetFolderUploadReady
          ? currentFolderUploadJob?.mode
          : targetZipUploadResult
            ? uploadMode
            : undefined,
        previousStatus: existingStatus,
      })
      .then(() => {
        if (hasNewZipUpload) {
          cache.rawZipReuploaded = false
          setZipSupplementUploaded(false)
          if (currentZipUploadJob) {
            zipUploadManager.markMetadataNavigationHandled(
              currentZipUploadJob.id
            )
          }
        }
        syncZipState("done")
        toast.success("Đã hoàn tất lấy metadata từ remote folder.")
      })
      .catch((err: unknown) => {
        if (isOcrWaitSupersededError(err)) return
        syncZipState("idle")
        toast.error(
          err instanceof Error ? err.message : "Không thể bắt đầu OCR."
        )
      })
  }, [
    documentNumberingMode,
    documentNumberingStylePreset,
    documentNumberingStyleOverrides,
    currentFolderUploadJob,
    currentZipUploadJob,
    metadataTargetIngestionRunId,
    ocr,
    parseZipMaxFiles,
    routeSessionId,
    sessionId,
    syncZipState,
    targetFolderUploadReady,
    targetZipUploadResult,
    uploadMode,
    zipFolderPath,
    zipUploadManager,
    zipUploadPendingMetadata,
  ])

  useEffect(() => {
    const viewedUploadSessionId = routeSessionId ?? sessionId
    if (
      resolvePlanInputsReuploaded({
        renderedState: Boolean(planInputsReuploaded),
        arrangementCached: cache.arrangementPlanReuploaded,
        retentionCached: cache.retentionReuploaded,
      }) ||
      !existingSessionMode ||
      !canNavigateDirectlyToMetadata(doc1Has, doc2Has) ||
      !viewedUploadSessionId ||
      !isViewingUploadStepForSession({
        jobSessionId: currentZipUploadJob?.sessionId,
        routeSessionId,
        localSessionId: sessionId,
        currentStep,
      }) ||
      !currentZipUploadJob
    ) {
      zipAutoNavigationRef.current = null
      return
    }
    const previous = zipAutoNavigationRef.current
    zipAutoNavigationRef.current = {
      sessionId: viewedUploadSessionId,
      jobId: currentZipUploadJob.id,
      status: currentZipUploadJob.status,
    }
    if (
      currentZipUploadJob.sessionId !== viewedUploadSessionId ||
      previous?.sessionId !== viewedUploadSessionId ||
      previous.jobId !== currentZipUploadJob.id ||
      previous.status === "completed" ||
      currentZipUploadJob.status !== "completed" ||
      !currentZipUploadJob.result
    ) {
      return
    }

    if (
      !isViewingUploadStepForSession({
        jobSessionId: currentZipUploadJob.sessionId,
        routeSessionId,
        localSessionId: sessionId,
        currentStep,
      })
    ) {
      return
    }
    toast.info("Upload ZIP đã hoàn tất. Đang lấy danh sách file bổ sung.")
    navigate(
      `/sessions/${encodeURIComponent(currentZipUploadJob.sessionId)}/step/3?extract=1`
    )
  }, [
    currentStep,
    currentZipUploadJob,
    doc1Has,
    doc2Has,
    existingSessionMode,
    navigate,
    planInputsReuploaded,
    routeSessionId,
    sessionId,
  ])

  useEffect(() => {
    const viewedUploadSessionId = routeSessionId ?? sessionId
    if (
      resolvePlanInputsReuploaded({
        renderedState: Boolean(planInputsReuploaded),
        arrangementCached: cache.arrangementPlanReuploaded,
        retentionCached: cache.retentionReuploaded,
      }) ||
      !folderUploadCanNavigateDirectly ||
      !viewedUploadSessionId ||
      !isViewingUploadStepForSession({
        jobSessionId: currentFolderUploadJob?.sessionId,
        routeSessionId,
        localSessionId: sessionId,
        currentStep,
      }) ||
      !currentFolderUploadJob
    ) {
      folderAutoNavigationRef.current = null
      return
    }
    const previous = folderAutoNavigationRef.current
    folderAutoNavigationRef.current = {
      sessionId: viewedUploadSessionId,
      jobId: currentFolderUploadJob.id,
      status: currentFolderUploadJob.status,
    }
    if (
      currentFolderUploadJob.sessionId !== viewedUploadSessionId ||
      previous?.sessionId !== viewedUploadSessionId ||
      previous.jobId !== currentFolderUploadJob.id ||
      previous.status === "completed" ||
      !folderUploadReady ||
      currentFolderUploadJob.summary?.status !== "sealed" ||
      currentFolderUploadJob.metadataNavigationHandled
    ) {
      return
    }
    const ingestionRun = currentFolderUploadJob.summary?.ingestion_run
    if (!ingestionRun || ingestionRun.status !== "ready") return

    if (
      !isViewingUploadStepForSession({
        jobSessionId: currentFolderUploadJob.sessionId,
        routeSessionId,
        localSessionId: sessionId,
        currentStep,
      })
    ) {
      return
    }
    folderUploadManager.markMetadataNavigationHandled(currentFolderUploadJob.id)
    if (folderIngestionRunKey) {
      setHandledFolderIngestionRuns((previousRuns) => {
        const nextRuns = new Set(previousRuns)
        nextRuns.add(folderIngestionRunKey)
        return nextRuns
      })
    }
    toast.info("Upload folder đã hoàn tất. Đang lấy danh sách file bổ sung.")
    navigate(
      `/sessions/${encodeURIComponent(currentFolderUploadJob.sessionId)}/step/3?extract=1`
    )
  }, [
    currentStep,
    currentFolderUploadJob,
    folderUploadCanNavigateDirectly,
    folderIngestionRunKey,
    folderUploadManager,
    folderUploadReady,
    navigate,
    planInputsReuploaded,
    routeSessionId,
    sessionId,
  ])

  useEffect(() => {
    if (currentStep !== 3) return
    const navigationRequested = searchParams.get("extract") === "1"
    const completedFolderRequiresMetadataStart = Boolean(
      folderUploadActionReady &&
      targetFolderUploadReady &&
      folderIngestionRunKey
    )
    if (!navigationRequested && !completedFolderRequiresMetadataStart) {
      metadataAutoStartRef.current = false
      return
    }
    if (!sessionId || !dataInputHas) return
    if (metadataTargetIngestionRunId !== null && !metadataTargetReadyForOcr) {
      return
    }
    if (metadataAutoStartRef.current) return

    metadataAutoStartRef.current = true
    if (navigationRequested) {
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete("extract")
      setSearchParams(nextParams, { replace: true })
    }
    if (completedFolderRequiresMetadataStart && folderIngestionRunKey) {
      setHandledFolderIngestionRuns((previousRuns) => {
        const nextRuns = new Set(previousRuns)
        nextRuns.add(folderIngestionRunKey)
        return nextRuns
      })
      if (currentFolderUploadJob) {
        folderUploadManager.markMetadataNavigationHandled(
          currentFolderUploadJob.id
        )
      }
    }
    void startMetadataExtractionFromZip()
  }, [
    currentFolderUploadJob,
    currentStep,
    folderIngestionRunKey,
    folderUploadActionReady,
    folderUploadManager,
    metadataTargetIngestionRunId,
    metadataTargetReadyForOcr,
    searchParams,
    sessionId,
    setSearchParams,
    startMetadataExtractionFromZip,
    dataInputHas,
    targetFolderUploadReady,
  ])

  const handleConfirmPlan = createConfirmPlanHandler({
    confirmingPlan,
    applyWorkingPlanResponse,
    applyActivePlanResponse,
    setConfirmingPlan,
    setPlanViewTab,
  })

  const handleSaveDraft = async () => {
    if (savingPlanDraft) return
    if (!cache.planDraftDirty) {
      toast.info("Không có thay đổi mới để lưu.")
      return
    }
    setSavingPlanDraft(true)
    try {
      const draftPlan = await savePlanChanges()
      if (draftPlan?.status === "draft") {
        cache.planViewTab = "draft"
        setPlanViewTab("draft")
        toast.success("Đã lưu bản nháp phương án.")
      } else {
        toast.info("Không có thay đổi mới để lưu.")
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Không thể lưu bản nháp phương án."
      )
    } finally {
      setSavingPlanDraft(false)
    }
  }

  const handlePlanStepNavigation = (targetStep: AppStep) => {
    const currentSessionId = sessionId ?? routeSessionId ?? cache.sessionId
    if (targetStep === 3 && currentSessionId) {
      navigate(
        `/sessions/${encodeURIComponent(currentSessionId)}/step/3?extract=1`
      )
      return
    }
    goTo(targetStep, currentSessionId)
  }

  const handleNavigateToSessions = () => {
    navigate("/sessions")
  }

  const handleContinueToExtractMetadata = async () => {
    const currentSessionId = sessionId ?? routeSessionId ?? cache.sessionId
    if (!currentSessionId) {
      toast.error("Chưa có session để sang Extract Metadata.")
      return
    }
    handlePlanStepNavigation(3)
  }

  const handleZipUploadAccepted = useCallback(() => {
    dataUploadRef.current?.acceptPending()
  }, [])

  const { handleStartAll } = createUploadPageWorkflowActions({
    sessionId,
    routeSessionId,
    existingSessionMode,
    zipSupplementUploaded:
      zipSupplementUploaded ||
      zipUploadPendingMetadata ||
      folderUploadActionReady,
    planInputsReuploaded,
    planAnalysisState,
    allDone,
    hasPlanReady,
    hasWorkingPlan,
    planReuploadState,
    dossierBuildStrategy,
    doc1Has,
    doc2Has,
    zipHas: dataInputHas,
    doc1Ref,
    doc2Ref,
    navigate,
    ensureSession,
    syncSessionMetadata,
    syncPlanAnalysisState,
    setPlanAnalysisJobId,
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
    setZipSupplementUploaded,
    zipUploadManager,
    onZipUploadAccepted: handleZipUploadAccepted,
  })
  const handleStartAllInputs = useCallback(async () => {
    if (primaryActionLockRef.current) return

    primaryActionLockRef.current = true
    setPrimaryActionPending(true)
    try {
      if (pendingDataUpload) {
        const result = await dataUploadRef.current?.startPending()
        if (result) {
          await handleStartAll({ pendingDataUpload: result })
        }
        return
      }
      if (folderUploadActionReady && folderUploadCanNavigateDirectly) {
        const currentSessionId = routeSessionId ?? sessionId ?? cache.sessionId
        if (!currentSessionId) {
          toast.error("Chưa có session để extract metadata.")
          return
        }
        if (folderIngestionRunKey) {
          setHandledFolderIngestionRuns((previous) => {
            const next = new Set(previous)
            next.add(folderIngestionRunKey)
            return next
          })
        }
        navigate(
          `/sessions/${encodeURIComponent(currentSessionId)}/step/3?extract=1`
        )
        return
      }

      await handleStartAll()
    } finally {
      primaryActionLockRef.current = false
      setPrimaryActionPending(false)
    }
  }, [
    folderUploadCanNavigateDirectly,
    folderIngestionRunKey,
    folderUploadActionReady,
    handleStartAll,
    navigate,
    pendingDataUpload,
    routeSessionId,
    sessionId,
  ])

  return (
    <>
      <UploadPageView
        key={`${routeSessionId ?? "new"}:${currentStep}`}
        currentStep={currentStep}
        highestVisitedStep={highestVisitedStep}
        existingSessionMode={existingSessionMode}
        routeSessionId={routeSessionId}
        sessionId={sessionId}
        sessionMetadata={sessionMetadata}
        syncSessionMetadataDraft={syncSessionMetadataDraft}
        saveSessionMetadata={saveSessionMetadata}
        ensureSession={ensureSession}
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
        postUploadDiscoveryPending={postUploadDiscoveryPending}
        postUploadDiscoveryMessage={postUploadDiscoveryMessage}
        allDone={allDone}
        primaryActionDisabled={primaryActionDisabled}
        primaryActionAvailable={primaryActionAvailable}
        primaryActionPending={primaryActionPending}
        handleStartAll={handleStartAllInputs}
        dataUploadRef={dataUploadRef}
        pendingDataUpload={pendingDataUpload}
        onPendingDataUploadChange={setPendingDataUpload}
        doc1Ref={doc1Ref}
        doc2Ref={doc2Ref}
        zipRef={zipRef}
        doc1Has={doc1Has}
        doc2Has={doc2Has}
        zipHas={dataInputHas}
        hasActivePlan={hasActivePlan}
        hasPlanReady={hasPlanReady}
        doc1State={doc1State}
        doc2State={doc2State}
        zipState={effectiveZipState}
        planAnalysisState={planAnalysisState}
        planAnalyzing={planAnalyzing}
        planProgressPhase={planProgressPhase}
        planCompletedPhases={planCompletedPhases}
        planProgressMessage={planProgressMessage}
        ocr={ocr}
        metadataDiscoveryPending={metadataDiscoveryPending}
        metadataDiscoveryMessage={metadataDiscoveryMessage}
        syncDoc1Has={syncDoc1Has}
        syncDoc2Has={syncDoc2Has}
        syncZipHas={syncZipHas}
        uploadInput={uploadInput}
        stageZipInput={stageZipInput}
        discardStagedZipInput={discardStagedZipInput}
        uploadRetentionInputs={uploadRetentionInputs}
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
        zipUploadProgress={effectiveZipUploadProgress}
        zipUploadFileName={presentedZipUploadJob?.fileName}
        zipInterruptionNotice={zipInterruptionNotice}
        folderInterruptionNotice={folderInterruptionNotice}
        planReuploadState={planReuploadState}
        planInputsReuploaded={planInputsReuploaded}
        zipSupplementUploaded={
          zipSupplementUploaded ||
          (existingSessionMode && zipUploadPendingMetadata)
        }
        folderUploadReady={folderUploadActionReady}
        folderUploadMetadataNavigationReady={
          folderUploadMetadataNavigationReady
        }
        folderUploadWasCancelled={folderUploadWasCancelled}
        folderUploadEffectiveCount={folderUploadEffectiveCount}
        parsedPlan={parsedPlan}
        folderTree={folderTree}
        activeParsedPlan={activeParsedPlan}
        activeFolderTree={activeFolderTree}
        activePlanSettings={activePlanSettings}
        workingPlanVersionId={workingPlanVersionId}
        workingPlanStatus={workingPlanStatus}
        planDraftDirty={planDraftDirty}
        draftMatchesActive={draftMatchesActive}
        activePlanVersionId={activePlanVersionId}
        planViewTab={planViewTab}
        setPlanViewTab={setPlanViewTab}
        dossierBuildStrategy={dossierBuildStrategy}
        selectDossierBuildStrategy={selectDossierBuildStrategy}
        documentNumberingMode={documentNumberingMode}
        applyPersistedDocumentNumberingMode={
          applyPersistedDocumentNumberingMode
        }
        selectDocumentNumberingModeDraft={selectDocumentNumberingModeDraft}
        documentNumberingStylePreset={documentNumberingStylePreset}
        documentNumberingStyleOverrides={documentNumberingStyleOverrides}
        selectDocumentNumberingStylePreset={selectDocumentNumberingStylePreset}
        selectDocumentNumberingStyleOverrides={
          selectDocumentNumberingStyleOverrides
        }
        applyPersistedDocumentNumberingStylePreset={
          applyPersistedDocumentNumberingStylePreset
        }
        applyPersistedDocumentNumberingStyleOverrides={
          applyPersistedDocumentNumberingStyleOverrides
        }
        saveFileRegisterConfig={saveFileRegisterConfig}
        syncFolderTree={syncFolderTree}
        saveFolderTree={saveFolderTree}
        savePlanCriterias={savePlanCriterias}
        handleSaveDraft={handleSaveDraft}
        handleConfirmPlan={handleConfirmPlan}
        handleContinueToExtractMetadata={handleContinueToExtractMetadata}
        handlePlanStepNavigation={handlePlanStepNavigation}
        handleNavigateToSessions={handleNavigateToSessions}
        savingPlanDraft={savingPlanDraft}
        confirmingPlan={confirmingPlan}
        ocrPdfPaths={ocrPdfPaths}
        ocrMetadataItems={ocrMetadataItems}
        ocrLoading={ocrLoading}
        ocrIsReextracting={ocrIsReextracting}
        ocrPendingIngestionCount={displayedPendingIngestionCount}
        ocrPendingIngestionMessage={displayedPendingIngestionMessage}
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
    </>
  )
}

function isViewingUploadStepForSession({
  jobSessionId,
  routeSessionId,
  localSessionId,
  currentStep,
}: {
  jobSessionId: string | null | undefined
  routeSessionId: string | undefined
  localSessionId: string | null
  currentStep: AppStep
}): boolean {
  if (!jobSessionId || currentStep !== 1) return false
  const pathname = window.location.pathname.replace(/\/+$/, "")
  if (routeSessionId) {
    return (
      routeSessionId === jobSessionId &&
      pathname === `/sessions/${encodeURIComponent(jobSessionId)}/step/1`
    )
  }
  return localSessionId === jobSessionId && pathname === "/sessions/new/step/1"
}
