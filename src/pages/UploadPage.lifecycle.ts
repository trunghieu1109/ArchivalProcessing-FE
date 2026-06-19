import { useEffect } from "react"
import { toast } from "sonner"
import { getActivePlan, getSession } from "@/features/upload/api/sessionApi"
import type { SessionMetadataValues } from "@/features/upload/components/SessionMetadataBar"
import { uploadPageCache as cache } from "./UploadPage.cache"
import { LAST_SESSION_KEY } from "./UploadPage.progress"
import {
  DEFAULT_DOCUMENT_NUMBERING_MODE,
  DEFAULT_DOSSIER_BUILD_STRATEGY,
  EMPTY_PARSED_PLAN,
  activePlanBuildStrategy,
  activePlanDocumentNumberingMode,
  activePlanToParsedPlan,
  planToTree,
} from "./UploadPage.planUtils"

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
    setDoc1Has(cache.doc1Has)
    setDoc2Has(cache.doc2Has)
    setZipHas(cache.zipHas)
    setZipEntries(cache.zipEntries)
    setFolderTree(cache.folderTree)
    setParsedPlan(cache.parsedPlan)
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
    cache.clusterGroups = []
    cache.doc1State = "idle"
    cache.doc2State = "idle"
    cache.zipState = "idle"
    cache.planAnalysisState = "idle"
    cache.dossierBuildStrategy = DEFAULT_DOSSIER_BUILD_STRATEGY
    cache.persistedDossierBuildStrategy = DEFAULT_DOSSIER_BUILD_STRATEGY
    cache.documentNumberingMode = DEFAULT_DOCUMENT_NUMBERING_MODE
    cache.persistedDocumentNumberingMode = DEFAULT_DOCUMENT_NUMBERING_MODE
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
    cache.zipFolderPath = ""
    cache.zipMaxFiles = ""
    cache.uploadMode = "append"
    cache.activePlanVersionId = ""
    cache.activeClusterVersionId = undefined
    cache.draftArrangementPlanFile = null
    cache.draftRetentionFile = null
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
        const [sessionDetail, activePlan] = await Promise.all([
          getSession(routeSessionId),
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
        const retentionFile = files.find(
          (file) => file.file_type === "retention_schedule"
        )
        const zipFiles = files.filter((file) => file.file_type === "raw_zip")
        const zipFile = zipFiles[zipFiles.length - 1]
        cache.doc1Has = Boolean(arrangementPlanFile)
        cache.doc2Has = Boolean(retentionFile)
        cache.zipHas = Boolean(zipFile)
        cache.doc1State = arrangementPlanFile ? "done" : "idle"
        cache.doc2State = retentionFile ? "done" : "idle"
        cache.zipState = zipFile ? "done" : "idle"
        cache.arrangementPlanUpload = arrangementPlanFile ?? null
        cache.retentionUpload = retentionFile ?? null
        cache.arrangementPlanReuploaded = false
        cache.retentionReuploaded = false
        cache.rawZipReuploaded = false
        cache.zipUpload = zipFile ?? null
        cache.zipFolderPath = zipFile?.folder_path ?? zipFile?.data_path ?? ""
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

        if (activePlan) {
          const plan = activePlanToParsedPlan(activePlan)
          const buildStrategy = activePlanBuildStrategy(activePlan)
          const numberingMode = activePlanDocumentNumberingMode(activePlan)
          cache.activePlanVersionId = activePlan.id ?? ""
          cache.parsedPlan = plan
          cache.folderTree = planToTree(plan)
          cache.planAnalysisState = "done"
          cache.dossierBuildStrategy = buildStrategy
          cache.persistedDossierBuildStrategy = buildStrategy
          cache.documentNumberingMode = numberingMode
          cache.persistedDocumentNumberingMode = numberingMode
          setParsedPlan(plan)
          setFolderTree(cache.folderTree)
          setPlanAnalysisState("done")
          setDossierBuildStrategy(buildStrategy)
          setDocumentNumberingMode(numberingMode)
        } else {
          cache.activePlanVersionId = ""
          cache.parsedPlan = EMPTY_PARSED_PLAN
          cache.folderTree = planToTree(EMPTY_PARSED_PLAN)
          cache.planAnalysisState = "idle"
          cache.dossierBuildStrategy = DEFAULT_DOSSIER_BUILD_STRATEGY
          cache.persistedDossierBuildStrategy = DEFAULT_DOSSIER_BUILD_STRATEGY
          cache.documentNumberingMode = DEFAULT_DOCUMENT_NUMBERING_MODE
          cache.persistedDocumentNumberingMode = DEFAULT_DOCUMENT_NUMBERING_MODE
          setParsedPlan(cache.parsedPlan)
          setFolderTree(cache.folderTree)
          setPlanAnalysisState("idle")
          setDossierBuildStrategy(cache.dossierBuildStrategy)
          setDocumentNumberingMode(cache.documentNumberingMode)
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
