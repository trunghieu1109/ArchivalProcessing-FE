import { useCallback, useEffect, useRef, useState } from "react"
import { useSyncExternalStore } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { useAuth } from "@/features/auth/lib/AuthContext"
import { visibleAwareDelay } from "@/shared/lib/pageVisibility"
import type { SessionMetadataValues } from "@/features/upload/components/SessionMetadataBar"
import {
  ensureClusterBuild,
  getActivePlan,
  getWorkingPlan,
  listSessionEvents,
  type DossierBuildStrategy,
  type DocumentNumberingMode,
  type DocumentNumberingStylePreset,
  type FolderUploadSummary,
  type PlanVersionStatus,
  type SessionInputUploadResponse,
  type UploadMode,
  type UploadProgressSnapshot,
} from "@/features/upload/api/sessionApi"
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
import { folderUploadManager } from "@/features/upload/lib/folderUploadManager"
import {
  zipUploadManager,
  zipUploadProgressFromJob,
} from "@/features/upload/lib/zipUploadManager"
import { resolveLatestUploadInterruption } from "@/features/upload/lib/uploadInterruption"
import { isOcrPollingReplacedError } from "@/features/upload/hooks/useOcrFolder"

import { UploadPageView } from "./UploadPage.view"
import { createConfirmPlanHandler } from "./UploadPage.confirmPlan"
import { createUploadPageWorkflowActions } from "./UploadPage.workflow"
import { resolvePlanInputsReuploaded } from "./UploadPage.workflowPolicy"
import { createUploadPageActions } from "./UploadPage.actions"
import { useUploadPageOcr } from "./UploadPage.ocr"
import { useUploadPageLifecycle } from "./UploadPage.lifecycle"
import { uploadPageCache as cache } from "./UploadPage.cache"
import {
  PLAN_PROGRESS_PHASES,
  PLAN_ANALYSIS_EVENT_PAGE_SIZE,
  PLAN_ANALYSIS_POLL_INTERVAL_MS,
  STEP_LABELS,
  isPlanAnalysisEventForJob,
  normalizePlanProgressPhase,
  planAnalysisResultVersionId,
  planProgressMessageForPhase,
  shouldApplyPlanAnalysisResult,
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
  missingDossierBuildInputs,
  selectedUploadLabels,
} from "./UploadPage.requirements"

type SessionViewScope = string

const claimedSessionIds = new Map<SessionViewScope, string>()

function createSessionViewScope(routeSessionId: string | undefined) {
  if (routeSessionId) {
    return `session:${encodeURIComponent(routeSessionId)}|path:${
      window.location.pathname
    }`
  }
  const historyState = window.history.state as
    | Record<string, unknown>
    | null
    | undefined
  const historyKey =
    typeof historyState?.key === "string" && historyState.key
      ? historyState.key
      : `${window.location.pathname}${window.location.search}`
  return `new:${historyKey}`
}

function currentRouteSessionId(): string | null {
  const match = /^\/sessions\/([^/]+)\/step\/\d+/.exec(window.location.pathname)
  if (!match?.[1] || match[1] === "new") return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

function resolveSessionViewId(scope: SessionViewScope): string | null {
  const sessionPrefix = /^session:([^|]+)\|path:/.exec(scope)?.[1]
  if (sessionPrefix) {
    try {
      return decodeURIComponent(sessionPrefix)
    } catch {
      return sessionPrefix
    }
  }
  return claimedSessionIds.get(scope) ?? null
}

function isSessionViewActive(
  scope: SessionViewScope,
  candidateSessionId: string
): boolean {
  const routeSessionId = currentRouteSessionId()
  if (routeSessionId !== null) {
    return (
      routeSessionId === candidateSessionId &&
      createSessionViewScope(routeSessionId) === scope
    )
  }
  return (
    createSessionViewScope(undefined) === scope &&
    resolveSessionViewId(scope) === candidateSessionId
  )
}

function claimSessionView(
  scope: SessionViewScope,
  candidateSessionId: string
): boolean {
  if (
    currentRouteSessionId() !== null ||
    createSessionViewScope(undefined) !== scope
  ) {
    return false
  }
  claimedSessionIds.set(scope, candidateSessionId)
  return true
}

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
  const focusedFolderUploadJobId =
    searchParams.get("upload") === "folder"
      ? searchParams.get("folderUpload")
      : null
  const focusedZipUploadJobId =
    searchParams.get("upload") === "zip" ? searchParams.get("zipUpload") : null
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
    const currentSessionId = routeSessionId ?? sessionId ?? cache.sessionId
    if (!currentSessionId) {
      toast.error("Chưa có session để lập hồ sơ.")
      return
    }
    const missingInputs = missingDossierBuildInputs({
      hasArrangementPlan: doc1Has,
      hasRetentionSchedule: doc2Has,
      hasVerifiedDocuments,
      hasActivePlan: Boolean(activePlanVersionId),
    })
    if (missingInputs.length > 0) {
      toast.error(dossierBuildMissingMessage(missingInputs))
      return
    }

    try {
      let buildStrategy = activePlanSettings.dossierBuildStrategy
      if (activePlanVersionId && activeParsedPlan.groups.length === 0) {
        try {
          const activePlan = await getActivePlan(currentSessionId)
          if (
            activePlan &&
            isSessionViewActive(currentSessionViewScope, currentSessionId)
          ) {
            applyActivePlanResponse(activePlan)
            buildStrategy = activePlanBuildStrategy(activePlan)
          }
        } catch {
          // Hydration is best-effort. The backend remains authoritative for
          // validating the active plan when ensureClusterBuild is requested.
        }
      }
      const response = await ensureClusterBuild(currentSessionId, {
        source: "user_view_results",
        dossier_build_strategy: buildStrategy,
      })
      if (!isSessionViewActive(currentSessionViewScope, currentSessionId)) {
        return
      }
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
  const startActionLocksRef = useRef<Map<SessionViewScope, Promise<void>>>(
    new Map()
  )
  const metadataStartLocksRef = useRef<Set<string>>(new Set())
  const metadataAutoStartRef = useRef<string | null>(null)

  const [doc1State, setDoc1State] = useState<ProcessState>(cache.doc1State)
  const [doc2State, setDoc2State] = useState<ProcessState>(cache.doc2State)
  const [zipState, setZipState] = useState<ProcessState>(cache.zipState)
  const [planAnalysisState, setPlanAnalysisState] = useState<ProcessState>(
    cache.planAnalysisState
  )
  const [planAnalysisJobId, setPlanAnalysisJobId] = useState<number | null>(
    cache.planAnalysisJobId
  )
  const syncPlanAnalysisJobId = useCallback((jobId: number | null) => {
    cache.planAnalysisJobId = jobId
    setPlanAnalysisJobId(jobId)
  }, [])
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
  const currentSessionViewScope = createSessionViewScope(routeSessionId)
  const folderUploadJobs = useSyncExternalStore(
    folderUploadManager.subscribe,
    folderUploadManager.getSnapshot
  )
  const zipUploadJobs = useSyncExternalStore(
    zipUploadManager.subscribe,
    zipUploadManager.getSnapshot
  )
  const activeUploadSessionId = routeSessionId ?? sessionId
  const currentFolderUploadJob = folderUploadJobs
    .filter((job) => job.sessionId === activeUploadSessionId)
    .sort((left, right) => right.createdAt - left.createdAt)[0]
  const currentZipUploadJob = zipUploadJobs
    .filter((job) => job.sessionId === activeUploadSessionId)
    .sort((left, right) => right.createdAt - left.createdAt)[0]
  const currentFolderSummary =
    currentFolderUploadJob?.summary ?? cache.latestFolderUpload
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
  const [latestUploadWarning, setLatestUploadWarning] = useState<string | null>(
    cache.latestUploadWarning
  )
  const [latestUploadInterruption, setLatestUploadInterruption] = useState(
    cache.latestUploadInterruption
  )
  const [sessionLoading, setSessionLoading] = useState(false)
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
  const zipViewRef = useRef({
    sessionId: undefined as string | null | undefined,
    startedAt: 0,
  })
  const observedActiveZipJobIdsRef = useRef(new Set<string>())
  const handledZipCompletionIdsRef = useRef(new Set<string>())
  const observedActiveFolderJobIdsRef = useRef(new Set<string>())
  const handledFolderCompletionIdsRef = useRef(new Set<string>())

  useEffect(() => {
    planInputStateRef.current = { doc1Has, doc2Has }
  }, [doc1Has, doc2Has])

  /* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect -- FolderUploadManager is an external store; terminal snapshots must be committed to the route workflow state and shared upload cache atomically. */
  useEffect(() => {
    const job = currentFolderUploadJob
    if (!job || job.sessionId !== activeUploadSessionId) return
    if (job.summary) {
      cache.latestFolderUpload = job.summary
    }

    if (!["completed", "cancelled"].includes(job.status)) {
      const interruptedSync =
        job.summary?.status === "cancelled"
          ? resolveLatestUploadInterruption(cache.latestZipAttempt, job.summary)
          : null
      cache.latestUploadInterruption = interruptedSync
      cache.latestUploadWarning = interruptedSync?.message ?? null
      setLatestUploadInterruption(interruptedSync)
      setLatestUploadWarning(interruptedSync?.message ?? null)
      if (!interruptedSync) {
        observedActiveFolderJobIdsRef.current.add(job.id)
      }
      cache.zipState = "processing"
      setZipState("processing")
      return
    }

    const summary = job.summary
    const interruption =
      job.status === "cancelled" && summary
        ? resolveLatestUploadInterruption(cache.latestZipAttempt, summary)
        : null
    cache.latestUploadInterruption = interruption
    cache.latestUploadWarning = interruption?.message ?? null
    setLatestUploadInterruption(interruption)
    setLatestUploadWarning(interruption?.message ?? null)
    const folderInputReady = Boolean(
      summary &&
      summary.document_sync_status === "ready" &&
      summary.counts.effective > 0 &&
      summary.ingestion_run?.status === "ready"
    )
    const folderIsLatest = Boolean(
      summary &&
      (!cache.zipUpload || !zipInputIsLatest(cache.zipUpload, summary))
    )
    if (!summary || !folderInputReady || !folderIsLatest) return

    cache.rawZipReuploaded = false
    cache.zipHas = true
    cache.zipState = "done"
    cache.zipFolderPath = summary.root_name
    setZipSupplementUploaded(false)
    setZipHas(true)
    setZipState("done")
    setZipFolderPath(summary.root_name)

    const needsMetadataStart =
      job.status === "completed" &&
      (summary.ingestion_run?.ocr_batch_ids.length ?? 0) === 0
    if (
      !needsMetadataStart ||
      cache.arrangementPlanReuploaded ||
      cache.retentionReuploaded ||
      !existingSessionMode ||
      currentStep !== 1 ||
      routeSessionId !== job.sessionId ||
      focusedFolderUploadJobId === job.id ||
      !observedActiveFolderJobIdsRef.current.has(job.id) ||
      handledFolderCompletionIdsRef.current.has(job.id)
    ) {
      return
    }
    handledFolderCompletionIdsRef.current.add(job.id)
    navigate(`/sessions/${encodeURIComponent(job.sessionId)}/step/3?extract=1`)
  }, [
    activeUploadSessionId,
    currentFolderUploadJob,
    currentStep,
    existingSessionMode,
    focusedFolderUploadJobId,
    navigate,
    routeSessionId,
  ])
  /* eslint-enable react-hooks/immutability, react-hooks/set-state-in-effect */

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
    setLatestUploadInterruption,
    setLatestUploadWarning,
    setUploadModeState,
    setPlanReuploadState,
    setZipSupplementUploaded,
    setPlanProgressPhase,
    setPlanProgressMessage,
    setPlanCompletedPhases,
    setSessionLoading,
  })

  useEffect(() => {
    zipViewRef.current = {
      sessionId: activeUploadSessionId,
      startedAt: Date.now(),
    }
  }, [activeUploadSessionId])

  useEffect(() => {
    const job = currentZipUploadJob
    if (!job || job.sessionId !== activeUploadSessionId) return

    if (job.status === "cancelled") {
      if (job.response) {
        cache.latestZipAttempt = job.response
      }
      const interruption = resolveLatestUploadInterruption(
        cache.latestZipAttempt,
        cache.latestFolderUpload
      )
      cache.latestUploadInterruption = interruption
      cache.latestUploadWarning = interruption?.message ?? null
      cache.zipUploadProgress = null
      // Synchronize route-local controls with the global upload manager.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setZipUploadProgress(null)
      setLatestUploadInterruption(interruption)
      setLatestUploadWarning(interruption?.message ?? null)
      return
    }

    const progress = zipUploadProgressFromJob(job)
    cache.zipUploadProgress = progress
    setZipUploadProgress(progress)

    if (["creating", "uploading", "completing"].includes(job.status)) {
      cache.latestUploadInterruption = null
      cache.latestUploadWarning = null
      setLatestUploadInterruption(null)
      setLatestUploadWarning(null)
      observedActiveZipJobIdsRef.current.add(job.id)
      cache.zipState = "processing"
      setZipState("processing")
      return
    }
    if (job.status === "attention_required") {
      cache.latestUploadInterruption = null
      cache.latestUploadWarning = null
      setLatestUploadInterruption(null)
      setLatestUploadWarning(null)
      return
    }
    if (job.status !== "completed" || !job.response) return

    cache.zipUpload = job.response
    cache.latestZipAttempt = job.response
    cache.latestFolderUpload = null
    cache.latestUploadInterruption = null
    cache.latestUploadWarning = null
    cache.draftZipFile = null
    cache.zipHas = true
    cache.zipState = "done"
    cache.zipFolderPath =
      job.response.folder_path ?? job.response.data_path ?? ""
    if (routeSessionId === job.sessionId) {
      cache.rawZipReuploaded = true
      setZipSupplementUploaded(true)
    }
    setZipHas(true)
    setZipState("done")
    setZipFolderPath(cache.zipFolderPath)
    setLatestUploadInterruption(null)
    setLatestUploadWarning(null)

    const completionHappenedInCurrentView =
      zipViewRef.current.sessionId === job.sessionId &&
      job.completedAt !== null &&
      (observedActiveZipJobIdsRef.current.has(job.id) ||
        job.completedAt > zipViewRef.current.startedAt)
    if (
      resolvePlanInputsReuploaded({
        renderedState: false,
        arrangementCached: cache.arrangementPlanReuploaded,
        retentionCached: cache.retentionReuploaded,
      }) ||
      !existingSessionMode ||
      currentStep !== 1 ||
      routeSessionId !== job.sessionId ||
      focusedZipUploadJobId === job.id ||
      !completionHappenedInCurrentView ||
      handledZipCompletionIdsRef.current.has(job.id)
    ) {
      return
    }
    handledZipCompletionIdsRef.current.add(job.id)
    navigate(`/sessions/${encodeURIComponent(job.sessionId)}/step/3?extract=1`)
  }, [
    activeUploadSessionId,
    currentStep,
    currentZipUploadJob,
    existingSessionMode,
    focusedZipUploadJobId,
    navigate,
    routeSessionId,
  ])

  const zipInputPreferredForMetadata = Boolean(
    cache.zipUpload &&
    (cache.rawZipReuploaded ||
      zipInputIsLatest(cache.zipUpload, currentFolderSummary))
  )
  const metadataTargetIngestionRunId = zipInputPreferredForMetadata
    ? (cache.zipUpload?.ingestion_run?.id ?? null)
    : (currentFolderSummary?.ingestion_run?.id ?? null)
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
  } = useUploadPageOcr(activeUploadSessionId, {
    enabled: currentStep === 3,
    currentStep,
    targetIngestionRunId: metadataTargetIngestionRunId,
  })
  const hasVerifiedDocuments =
    (ocr.status?.metadata_verified_documents ?? 0) > 0 ||
    (ocr.status?.metadata_reviewed_documents ?? 0) > 0 ||
    ocrMetadataItems.some(
      (item) =>
        item.metadata_ready &&
        (item.is_reviewed === true || item.review_status === "verified")
    )

  useEffect(() => {
    const planPollingSessionId = routeSessionId ?? sessionId
    if (
      !planPollingSessionId ||
      planAnalysisState !== "processing" ||
      planAnalysisJobId === null
    ) {
      return
    }

    const actionScope = currentSessionViewScope
    let cancelled = false
    let afterId = 0
    let completedPlanVersionId = ""
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
        const response = await listSessionEvents(planPollingSessionId, {
          afterId,
          limit: PLAN_ANALYSIS_EVENT_PAGE_SIZE,
        })
        if (
          cancelled ||
          !isSessionViewActive(actionScope, planPollingSessionId)
        ) {
          return
        }
        for (const event of response.events) {
          afterId = Math.max(afterId, event.id)
          if (!isPlanAnalysisEventForJob(event.payload, planAnalysisJobId)) {
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
            const eventMessage = event.message?.trim()
            if (eventMessage) setPlanProgressMessage(eventMessage)
            else if (phase) {
              setPlanProgressMessage(planProgressMessageForPhase(phase))
            }
          }
          if (event.event_type === "plan.analysis.completed") {
            completedPlanVersionId =
              planAnalysisResultVersionId(event.payload) ||
              completedPlanVersionId
            setPlanProgressPhase(
              PLAN_PROGRESS_PHASES[PLAN_PROGRESS_PHASES.length - 1]?.id ??
                "retention_period"
            )
            setPlanCompletedPhases(
              new Set(PLAN_PROGRESS_PHASES.map((phase) => phase.id))
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
        const planResponse = await getWorkingPlan(planPollingSessionId)
        if (
          cancelled ||
          !isSessionViewActive(actionScope, planPollingSessionId)
        ) {
          return
        }
        const currentPlanVersionId = cache.workingPlanVersionId
        const nextPlanVersionId = planResponse?.id ?? ""
        const shouldApplyPlan =
          Boolean(planResponse) &&
          shouldApplyPlanAnalysisResult({
            currentPlanVersionId,
            nextPlanVersionId,
            completedPlanVersionId,
          })
        if (planResponse && shouldApplyPlan) {
          const plan = activePlanToParsedPlan(planResponse)
          const draftPayload = planResponseToDraftPayload(planResponse)
          const buildStrategy = activePlanBuildStrategy(planResponse)
          const numberingMode = activePlanDocumentNumberingMode(planResponse)
          const numberingStylePreset =
            activePlanDocumentNumberingStylePreset(planResponse)
          const numberingStyleOverrides =
            activePlanDocumentNumberingStyleOverrides(planResponse)

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
          cache.planViewTab = "draft"
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
  }, [
    currentSessionViewScope,
    planAnalysisJobId,
    planAnalysisState,
    routeSessionId,
    sessionId,
  ])

  const {
    ensureSession,
    saveSessionMetadata,
    uploadInput,
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
    sessionViewScope: currentSessionViewScope,
    isSessionViewActive,
    claimSessionView,
    resolveSessionViewId,
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
  })

  const planInputsReuploaded =
    planReuploadState.arrangement || planReuploadState.retention
  const syncFolderSelection = useCallback(
    (
      sources: import("@/features/upload/lib/folderUploadManager").FolderUploadSource[],
      rootName: string
    ) => {
      cache.draftFolderSources = sources
      cache.draftFolderRootName = rootName
      if (sources.length === 0) return
      cache.draftZipFile = null
      cache.rawZipReuploaded = false
      cache.zipHas = true
      cache.zipState = "idle"
      cache.zipFolderPath = rootName
      cache.zipUploadProgress = null
      setZipHas(true)
      setZipState("idle")
      setZipFolderPath(rootName)
      setZipUploadProgress(null)
      setZipSupplementUploaded(false)
    },
    []
  )
  const hasAnyFile = doc1Has || doc2Has || zipHas
  const hasActivePlan = Boolean(activePlanVersionId)
  const hasApprovedPlan = hasActivePlan
  const hasWorkingPlan = Boolean(workingPlanVersionId)
  const draftMatchesActive =
    Boolean(cache.activePlanSignature) &&
    Boolean(cache.workingPlanSignature) &&
    cache.workingPlanSignature === cache.activePlanSignature
  const hasAnalyzedArrangementPlan =
    planAnalysisState === "done" &&
    hasWorkingPlan &&
    doc1Has &&
    parsedPlan.groups.length > 0
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
  const arrangementPlanAnalyzing =
    planAnalysisState === "processing" && doc1State === "processing"
  const statusItems = existingSessionMode
    ? [
        {
          label: "Phương án",
          has: hasAnalyzedArrangementPlan || hasApprovedPlan,
          state: arrangementPlanAnalyzing
            ? "processing"
            : hasAnalyzedArrangementPlan || hasApprovedPlan
              ? "done"
              : "idle",
        },
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
    (zipUploadProgress !== null &&
      zipUploadProgress.phase !== "done" &&
      zipUploadProgress.phase !== "error") ||
    Boolean(
      currentZipUploadJob &&
      !["completed", "cancelled"].includes(currentZipUploadJob.status)
    ) ||
    Boolean(
      currentFolderUploadJob &&
      !["completed", "cancelled"].includes(currentFolderUploadJob.status)
    )
  const zipProcessingBlocksAction =
    zipUploadInProgress || (!existingSessionMode && zipState === "processing")
  const allProcessing =
    planAnalyzing ||
    doc1State === "processing" ||
    doc2State === "processing" ||
    zipProcessingBlocksAction
  const allDone =
    (hasAnalyzedArrangementPlan || hasApprovedPlan) && !planInputsReuploaded
  const canOpenPlanAnalysisStep =
    existingSessionMode && planAnalyzing && (doc1Has || doc2Has)
  const primaryActionDisabled =
    sessionLoading || (allProcessing && !canOpenPlanAnalysisStep)
  const partialFolderCount =
    currentFolderSummary?.status === "cancelled" &&
    currentFolderSummary.document_sync_status === "ready" &&
    (currentFolderSummary.ingestion_run?.ocr_batch_ids.length ?? 0) === 0
      ? currentFolderSummary.counts.effective
      : 0
  const folderRunNeedsMetadataStart = Boolean(
    !zipInputPreferredForMetadata &&
    currentFolderSummary?.document_sync_status === "ready" &&
    currentFolderSummary.counts.effective > 0 &&
    currentFolderSummary.ingestion_run?.status === "ready" &&
    (currentFolderSummary.ingestion_run.ocr_batch_ids.length ?? 0) === 0
  )
  const latestZipIngestionRunId = cache.zipUpload?.ingestion_run?.id ?? null
  const zipRunNeedsMetadataStart = Boolean(
    zipInputPreferredForMetadata &&
    ocr.status &&
    latestZipIngestionRunId !== null &&
    !(ocr.status.ingestion_runs ?? []).find(
      (run) => run.id === latestZipIngestionRunId
    )?.ocr_batch_ids?.length
  )

  const startMetadataExtractionFromZip = useCallback(async () => {
    const currentSessionId = routeSessionId ?? sessionId ?? cache.sessionId
    const actionScope = currentSessionViewScope
    if (!currentSessionId) {
      toast.error("Chưa có session để extract metadata.")
      return
    }
    const folderUploadCandidate =
      folderUploadManager
        .getSnapshot()
        .filter((job) => job.sessionId === currentSessionId)
        .sort((left, right) => right.createdAt - left.createdAt)[0]?.summary ??
      cache.latestFolderUpload
    const useZipInput = Boolean(
      cache.zipUpload &&
      (cache.rawZipReuploaded ||
        zipInputIsLatest(cache.zipUpload, folderUploadCandidate))
    )
    const folderUpload = useZipInput ? null : folderUploadCandidate
    const folderIngestionRunId =
      folderUpload?.document_sync_status === "ready" &&
      folderUpload.counts.effective > 0 &&
      folderUpload.ingestion_run?.status === "ready"
        ? folderUpload.ingestion_run.id
        : null
    const folderUploadReady = folderIngestionRunId !== null
    const zipIngestionRunId = folderUploadReady
      ? null
      : (cache.zipUpload?.ingestion_run?.id ?? null)
    const targetIngestionRunId = folderIngestionRunId ?? zipIngestionRunId
    const folderPath =
      zipFolderPath ||
      cache.zipUpload?.folder_path ||
      cache.zipUpload?.data_path ||
      ""
    if (!folderPath && !folderUploadReady) {
      toast.error("Chưa có folder_path để bắt đầu lấy metadata.")
      return
    }
    if (
      !folderUploadReady &&
      cache.zipUpload &&
      !cache.zipUpload.remote_batch_id
    ) {
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

    const metadataStartKey =
      targetIngestionRunId === null
        ? `${currentSessionId}:legacy:${cache.zipUpload?.id ?? folderPath}`
        : `${currentSessionId}:run:${targetIngestionRunId}`
    if (metadataStartLocksRef.current.has(metadataStartKey)) return
    metadataStartLocksRef.current.add(metadataStartKey)

    try {
      let existingStatus = ocr.status ?? null
      try {
        existingStatus = await ocr.refresh()
      } catch {
        existingStatus = ocr.status ?? null
      }
      if (!isSessionViewActive(actionScope, currentSessionId)) return
      const existingDocumentCount = Math.max(
        existingStatus?.total_files ?? 0,
        existingStatus?.total_jobs ?? 0,
        existingStatus?.pagination?.total ?? 0,
        existingStatus?.jobs.length ?? 0
      )
      const existingFolderIngestionRun = (
        existingStatus?.ingestion_runs ?? []
      ).find((run) => run.id === folderIngestionRunId)
      const existingZipIngestionRun = (
        existingStatus?.ingestion_runs ?? []
      ).find((run) => run.id === zipIngestionRunId)
      const folderRunAlreadySubmitted = Boolean(
        existingFolderIngestionRun?.ocr_batch_ids?.length
      )
      const zipRunAlreadySubmitted = Boolean(
        existingZipIngestionRun?.ocr_batch_ids?.length
      )
      const hasNewFolderUpload = folderUploadReady && !folderRunAlreadySubmitted
      const hasPendingZipRun =
        !folderUploadReady &&
        zipIngestionRunId !== null &&
        !zipRunAlreadySubmitted
      const hasNewZipUpload =
        !folderUploadReady &&
        Boolean(cache.zipUpload?.id) &&
        (cache.rawZipReuploaded || hasPendingZipRun)
      if (
        existingDocumentCount > 0 &&
        !hasNewZipUpload &&
        !hasNewFolderUpload
      ) {
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
      await ocr.start(folderPath, {
        maxFiles: maxFilesToProcess,
        documentNumberingMode,
        documentNumberingStylePreset,
        documentNumberingStyleOverrides,
        sessionFileId: folderUploadReady ? undefined : cache.zipUpload?.id,
        remoteFileId: folderUploadReady
          ? null
          : (cache.zipUpload?.remote_file_id ?? null),
        ingestionRunIds:
          targetIngestionRunId === null ? undefined : [targetIngestionRunId],
        uploadMode: folderUploadReady
          ? folderUpload?.mode
          : cache.zipUpload
            ? uploadMode
            : undefined,
        previousStatus: existingStatus,
      })
      if (!isSessionViewActive(actionScope, currentSessionId)) return
      if (hasNewZipUpload) {
        cache.rawZipReuploaded = false
        setZipSupplementUploaded(false)
      }
      syncZipState("done")
      toast.success("Đã hoàn tất lấy metadata từ remote folder.")
    } catch (err: unknown) {
      if (!isSessionViewActive(actionScope, currentSessionId)) return
      if (isOcrPollingReplacedError(err)) return
      syncZipState("idle")
      toast.error(err instanceof Error ? err.message : "Không thể bắt đầu OCR.")
    } finally {
      metadataStartLocksRef.current.delete(metadataStartKey)
    }
  }, [
    documentNumberingMode,
    documentNumberingStylePreset,
    documentNumberingStyleOverrides,
    currentSessionViewScope,
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
    const explicitlyRequested = searchParams.get("extract") === "1"
    if (
      !explicitlyRequested &&
      !folderRunNeedsMetadataStart &&
      !zipRunNeedsMetadataStart
    ) {
      metadataAutoStartRef.current = null
      return
    }
    if (!activeUploadSessionId || !zipHas) return
    const metadataTargetRunId = zipInputPreferredForMetadata
      ? latestZipIngestionRunId
      : (currentFolderSummary?.ingestion_run?.id ?? null)
    const metadataAutoStartKey = `${activeUploadSessionId}:${
      metadataTargetRunId ?? "legacy"
    }`
    if (metadataAutoStartRef.current === metadataAutoStartKey) return

    metadataAutoStartRef.current = metadataAutoStartKey
    if (explicitlyRequested) {
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete("extract")
      setSearchParams(nextParams, { replace: true })
    }
    void startMetadataExtractionFromZip()
  }, [
    currentStep,
    activeUploadSessionId,
    currentFolderSummary?.ingestion_run?.id,
    folderRunNeedsMetadataStart,
    latestZipIngestionRunId,
    searchParams,
    setSearchParams,
    startMetadataExtractionFromZip,
    zipHas,
    zipInputPreferredForMetadata,
    zipRunNeedsMetadataStart,
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
    const currentSessionId = routeSessionId ?? sessionId ?? cache.sessionId
    goTo(targetStep, currentSessionId)
  }

  const handleNavigateToSessions = () => {
    navigate("/sessions")
  }

  const handleContinueToExtractMetadata = async () => {
    const currentSessionId = routeSessionId ?? sessionId ?? cache.sessionId
    if (!currentSessionId) {
      toast.error("Chưa có session để sang Extract Metadata.")
      return
    }
    navigate(
      `/sessions/${encodeURIComponent(currentSessionId)}/step/3?extract=1`
    )
  }

  const { handleStartAll: handleStartAllUnlocked } =
    createUploadPageWorkflowActions({
      sessionId,
      routeSessionId,
      sessionViewScope: currentSessionViewScope,
      isSessionViewActive,
      existingSessionMode,
      zipSupplementUploaded,
      folderRunNeedsMetadataStart,
      planInputsReuploaded,
      planAnalysisState,
      allDone,
      hasPlanReady: hasAnalyzedArrangementPlan || hasApprovedPlan,
      planReuploadState,
      dossierBuildStrategy,
      doc1Has,
      doc2Has,
      zipHas,
      doc1Ref,
      doc2Ref,
      navigate,
      ensureSession,
      syncSessionMetadata,
      syncPlanAnalysisState,
      syncPlanAnalysisJobId,
      syncDoc1State,
      syncDoc2State,
      syncZipState,
      syncZipHas,
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
      setLatestUploadInterruption,
      setLatestUploadWarning,
    })
  const handleStartAll = (): Promise<void> => {
    const actionScope = currentSessionViewScope
    const active = startActionLocksRef.current.get(actionScope)
    if (active) return active
    const running = handleStartAllUnlocked().finally(() => {
      if (startActionLocksRef.current.get(actionScope) === running) {
        startActionLocksRef.current.delete(actionScope)
      }
    })
    startActionLocksRef.current.set(actionScope, running)
    return running
  }

  return (
    <>
      <UploadPageView
        currentStep={currentStep}
        highestVisitedStep={highestVisitedStep}
        existingSessionMode={existingSessionMode}
        routeSessionId={routeSessionId}
        sessionId={sessionId}
        sessionMetadata={sessionMetadata}
        syncSessionMetadataDraft={syncSessionMetadataDraft}
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
        latestUploadWarning={latestUploadWarning}
        partialFolderCount={partialFolderCount}
        folderRunNeedsMetadataStart={folderRunNeedsMetadataStart}
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
        syncFolderSelection={syncFolderSelection}
        pendingFolderCount={cache.draftFolderSources.length}
        hasPendingZip={Boolean(cache.draftZipFile)}
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
        zipUploadProgress={zipUploadProgress}
        latestUploadInterruption={latestUploadInterruption}
        planReuploadState={planReuploadState}
        planInputsReuploaded={planInputsReuploaded}
        zipSupplementUploaded={zipSupplementUploaded}
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
        ocrPendingIngestionCount={ocrPendingIngestionCount}
        ocrPendingIngestionMessage={ocrPendingIngestionMessage}
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

function zipInputIsLatest(
  zipUpload: SessionInputUploadResponse | null,
  folderUpload: FolderUploadSummary | null | undefined
): boolean {
  if (!zipUpload) return false
  if (!folderUpload) return true
  return (
    inputAttemptTime(zipUpload.created_at, zipUpload.updated_at) >
    inputAttemptTime(folderUpload.created_at, folderUpload.updated_at)
  )
}

function inputAttemptTime(
  createdAt: string | null | undefined,
  updatedAt: string | null | undefined
): number {
  const timestamp = Date.parse(createdAt || updatedAt || "")
  return Number.isFinite(timestamp) ? timestamp : 0
}
