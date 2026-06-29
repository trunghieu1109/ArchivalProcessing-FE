import { toast } from "sonner"
import {
  enqueuePlanAnalysis,
  getSession,
  listSessionEvents,
  type SessionInputUploadResponse,
  uploadSessionInput,
  waitForActivePlan,
} from "@/features/upload/api/sessionApi"
import { uploadPageCache as cache } from "./UploadPage.cache"
import {
  activePlanBuildStrategy,
  activePlanDocumentNumberingMode,
  activePlanToParsedPlan,
  planToTree,
} from "./UploadPage.planUtils"
import {
  PLAN_ANALYSIS_TIMEOUT_MS,
  PLAN_DONE_VISIBLE_MS,
  PLAN_PROGRESS_PHASES,
  addSetValue,
  planProgressMessageForPhase,
  wait,
} from "./UploadPage.progress"

export function createUploadPageWorkflowActions(context: Record<string, any>) {
  const {
    sessionId,
    routeSessionId,
    existingSessionMode,
    zipSupplementUploaded,
    planInputsReuploaded,
    planAnalysisState,
    allDone,
    hasActivePlan,
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
  } = context

  const syncLatestPlanProgress = async (currentSessionId: string) => {
    try {
      const response = await listSessionEvents(currentSessionId, { limit: 200 })
      let latestMessage = "Đã phân tích xong phương án chỉnh lý."

      response.events.forEach((event) => {
        if (event.event_type !== "plan.analysis.progress") return
        if (event.message) latestMessage = event.message
      })

      setPlanCompletedPhases(
        new Set(PLAN_PROGRESS_PHASES.map((phase) => phase.id))
      )
      setPlanProgressPhase(null)
      setPlanProgressMessage(latestMessage)
    } catch {
      setPlanProgressPhase(null)
      setPlanProgressMessage("Đã phân tích xong phương án chỉnh lý.")
      setPlanCompletedPhases(
        new Set(PLAN_PROGRESS_PHASES.map((phase) => phase.id))
      )
    }
  }

  const resetPlanReuploadState = () => {
    cache.arrangementPlanReuploaded = false
    cache.retentionReuploaded = false
    setPlanReuploadState({ arrangement: false, retention: false })
  }

  const handleReanalyzeExistingSessionPlan = async () => {
    const currentSessionId = sessionId ?? routeSessionId ?? cache.sessionId
    if (!currentSessionId) {
      toast.error("Chưa có session để phân tích lại phương án.")
      return
    }
    if (!planReanalysisReady) {
      toast.error("Vui lòng tải lại phương án chỉnh lý hoặc thời hạn bảo quản.")
      return
    }

    const planFile = planReuploadState.arrangement
      ? cache.arrangementPlanUpload?.local_cached_path
      : undefined
    const retentionFile = planReuploadState.retention
      ? cache.retentionUpload?.local_cached_path
      : undefined
    if (planReuploadState.arrangement && !planFile) {
      toast.error(
        "Backend chưa trả về đường dẫn local cho file phương án vừa tải lại."
      )
      return
    }
    if (planReuploadState.retention && !retentionFile) {
      toast.error(
        "Backend chưa trả về đường dẫn local cho file thời hạn bảo quản vừa tải lại."
      )
      return
    }
    if (!planFile && !retentionFile) {
      toast.error(
        "Chưa có file phương án hoặc thời hạn bảo quản để phân tích lại."
      )
      return
    }

    const previousPlanId = cache.activePlanVersionId || undefined
    try {
      syncPlanAnalysisState("processing")
      if (planReuploadState.arrangement) syncDoc1State("processing")
      if (planReuploadState.retention) syncDoc2State("processing")
      setPlanCompletedPhases(new Set(["upload_inputs"]))
      setPlanProgressPhase("preparing_plan_file")
      setPlanProgressMessage(planProgressMessageForPhase("preparing_plan_file"))

      await enqueuePlanAnalysis(currentSessionId, {
        ...(planFile ? { plan_file: planFile } : {}),
        ...(retentionFile ? { retention_file: retentionFile } : {}),
        dossier_build_strategy: dossierBuildStrategy,
      })
      const planResponse = await waitForActivePlan(
        currentSessionId,
        PLAN_ANALYSIS_TIMEOUT_MS,
        2_000,
        { previousPlanId }
      )
      const plan = activePlanToParsedPlan(planResponse)
      cache.activePlanVersionId = planResponse.id ?? ""
      applyPersistedDossierBuildStrategy(activePlanBuildStrategy(planResponse))
      applyPersistedDocumentNumberingMode(
        activePlanDocumentNumberingMode(planResponse)
      )
      cache.parsedPlan = plan
      cache.folderTree = planToTree(plan)
      setParsedPlan(plan)
      setFolderTree(cache.folderTree)
      const sessionAfterPlan = await getSession(currentSessionId)
      cache.activeClusterVersionId =
        sessionAfterPlan.active_cluster_version_id ?? null
      syncSessionMetadata(sessionAfterPlan)
      await syncLatestPlanProgress(currentSessionId)
      syncPlanAnalysisState("done")
      syncDoc1State(doc1Has ? "done" : "idle")
      syncDoc2State(doc2Has ? "done" : "idle")
      resetPlanReuploadState()

      const retentionOnly =
        planReuploadState.retention && !planReuploadState.arrangement
      setPlanProgressMessage(
        retentionOnly
          ? "Đã phân tích xong thông tư thời hạn bảo quản."
          : "Đã phân tích xong phương án mới."
      )
      cache.clusterGroups = []
      setClusterGroups([])
      toast.success(
        retentionOnly
          ? "Đã phân tích thời hạn bảo quản. Vui lòng kiểm tra lại ở Step 2."
          : "Đã phân tích lại phương án. Vui lòng kiểm tra và xác nhận ở Step 2."
      )
      goTo(2, currentSessionId)
    } catch (err) {
      syncPlanAnalysisState("idle")
      syncDoc1State(doc1Has ? "done" : "idle")
      syncDoc2State(doc2Has ? "done" : "idle")
      setPlanProgressPhase(null)
      setPlanProgressMessage("")
      setPlanCompletedPhases(new Set())
      toast.error(
        err instanceof Error
          ? err.message
          : "Không thể phân tích lại phương án."
      )
    }
  }

  const handleStartAll = async () => {
    if (allDone && !(existingSessionMode && zipSupplementUploaded)) {
      goTo(2)
      return
    }
    if (existingSessionMode) {
      if (planAnalysisState === "processing" && (doc1Has || doc2Has)) {
        goTo(2)
        return
      }
      if (planInputsReuploaded) {
        await handleReanalyzeExistingSessionPlan()
        return
      }
      if (zipSupplementUploaded) {
        await handleConfirmPlan()
        return
      }
      if (zipHas && !hasActivePlan && !doc1Has && !doc2Has) {
        const currentSessionId = routeSessionId ?? sessionId ?? cache.sessionId
        if (currentSessionId) {
          navigate(
            `/sessions/${encodeURIComponent(currentSessionId)}/step/3?extract=1`
          )
        } else {
          goTo(3)
        }
        return
      }
      goTo(2)
      return
    }

    const arrangementFile = doc1Has ? cache.draftArrangementPlanFile : null
    const retentionFileDraft = doc2Has ? cache.draftRetentionFile : null
    const zipFile = zipHas ? cache.draftZipFile : null
    if (!arrangementFile && !retentionFileDraft && !zipFile) {
      toast.error("Vui lòng chọn ít nhất một file để bắt đầu.")
      return
    }
    try {
      if (arrangementFile) {
        syncPlanAnalysisState("processing")
        setPlanProgressPhase("upload_inputs")
        setPlanProgressMessage(planProgressMessageForPhase("upload_inputs"))
      } else {
        syncPlanAnalysisState("idle")
        setPlanProgressPhase(null)
        setPlanProgressMessage("")
      }
      setPlanCompletedPhases(new Set())
      const currentSessionId = await ensureSession()
      const documentTasks = [
        doc1Ref.current?.hasFile() ? doc1Ref.current.process() : null,
        doc2Ref.current?.hasFile() ? doc2Ref.current.process() : null,
      ].filter(Boolean) as Promise<void>[]
      let arrangementUploadTask: Promise<SessionInputUploadResponse | null> =
        Promise.resolve(null)
      let retentionUploadTask: Promise<SessionInputUploadResponse | null> =
        Promise.resolve(null)
      let zipUploadTask: Promise<SessionInputUploadResponse | null> =
        Promise.resolve(null)

      if (arrangementFile) {
        syncDoc1State("processing")
        arrangementUploadTask = uploadSessionInput(
          currentSessionId,
          "arrangement_plan",
          arrangementFile
        ).then((response) => {
          cache.arrangementPlanUpload = response
          syncDoc1State("done")
          return response
        })
      }
      if (retentionFileDraft) {
        syncDoc2State("processing")
        retentionUploadTask = uploadSessionInput(
          currentSessionId,
          "retention_schedule",
          retentionFileDraft
        ).then((response) => {
          cache.retentionUpload = response
          syncDoc2State("done")
          return response
        })
      }
      if (zipFile) {
        syncZipState("processing")
        syncZipUploadProgress(zipUploadProgressForFile(zipFile, "uploading"))
        zipUploadTask = uploadSessionInput(
          currentSessionId,
          "raw_zip",
          zipFile,
          {
            onProgress: syncZipUploadProgress,
          }
        ).then((response) => {
          cache.zipUpload = response
          syncZipUploadProgress(
            zipUploadProgressForFile(zipFile, "done", zipFile.size)
          )
          syncZipState("done")
          syncZipFolderPath(response.folder_path ?? response.data_path ?? "")
          return response
        })
      }

      const [[arrangementPlan, retentionPlan, zipInput]] = await Promise.all([
        Promise.all([
          arrangementUploadTask,
          retentionUploadTask,
          zipUploadTask,
        ]),
        Promise.all(documentTasks),
      ])

      if (!arrangementFile) {
        const retentionFile = retentionPlan?.local_cached_path
        if (retentionFileDraft && !retentionFile) {
          throw new Error(
            "Backend chưa trả về đường dẫn local cho file thông tư."
          )
        }
        if (retentionFile) {
          syncPlanAnalysisState("processing")
          setPlanProgressPhase("retention_schedule")
          setPlanProgressMessage("Đang phân tích thông tư thời hạn bảo quản.")
          const retentionJob = enqueuePlanAnalysis(currentSessionId, {
            retention_file: retentionFile,
            dossier_build_strategy: dossierBuildStrategy,
          })
          await retentionJob
          const planResponse = await waitForActivePlan(
            currentSessionId,
            PLAN_ANALYSIS_TIMEOUT_MS,
            2_000,
            {
              previousPlanId: undefined,
              afterVersionNumber: undefined,
            }
          )
          const plan = activePlanToParsedPlan(planResponse)
          cache.activePlanVersionId = planResponse.id ?? ""
          applyPersistedDossierBuildStrategy(
            activePlanBuildStrategy(planResponse)
          )
          applyPersistedDocumentNumberingMode(
            activePlanDocumentNumberingMode(planResponse)
          )
          cache.parsedPlan = plan
          cache.folderTree = planToTree(plan)
          setParsedPlan(plan)
          setFolderTree(cache.folderTree)
          const sessionAfterRetention = await getSession(currentSessionId)
          cache.activeClusterVersionId =
            sessionAfterRetention.active_cluster_version_id ?? null
          syncSessionMetadata(sessionAfterRetention)
          syncPlanAnalysisState("done")
          setPlanProgressPhase(null)
          setPlanProgressMessage(
            "Đã phân tích xong thông tư thời hạn bảo quản."
          )
          toast.success(
            "Đã tạo session và phân tích thời hạn bảo quản. Vui lòng kiểm tra ở Step 2."
          )
          navigate(`/sessions/${encodeURIComponent(currentSessionId)}/step/2`)
          return
        }
        toast.success("Đã tạo session và lưu các file đã chọn.")
        if (zipInput) {
          await wait(PLAN_DONE_VISIBLE_MS)
          navigate(
            `/sessions/${encodeURIComponent(currentSessionId)}/step/3?extract=1`
          )
          return
        }
        navigate(`/sessions/${encodeURIComponent(currentSessionId)}/step/2`)
        return
      }

      const planFile = arrangementPlan?.local_cached_path
      const retentionFile = retentionPlan?.local_cached_path
      if (!planFile || (retentionFileDraft && !retentionFile)) {
        throw new Error(
          "Backend chưa trả về đường dẫn local cho file phương án hoặc thông tư."
        )
      }

      const planJob = enqueuePlanAnalysis(currentSessionId, {
        plan_file: planFile,
        ...(retentionFile ? { retention_file: retentionFile } : {}),
        dossier_build_strategy: dossierBuildStrategy,
      })
      setPlanCompletedPhases((previous: Set<string>) =>
        addSetValue(previous, "upload_inputs")
      )
      setPlanProgressPhase("preparing_plan_file")
      setPlanProgressMessage(planProgressMessageForPhase("preparing_plan_file"))
      await planJob
      const planResponse = await waitForActivePlan(
        currentSessionId,
        PLAN_ANALYSIS_TIMEOUT_MS,
        2_000,
        {
          previousPlanId: undefined,
          afterVersionNumber: undefined,
        }
      )
      const plan = activePlanToParsedPlan(planResponse)
      cache.activePlanVersionId = planResponse.id ?? ""
      applyPersistedDossierBuildStrategy(activePlanBuildStrategy(planResponse))
      applyPersistedDocumentNumberingMode(
        activePlanDocumentNumberingMode(planResponse)
      )
      cache.parsedPlan = plan
      cache.folderTree = planToTree(plan)
      setParsedPlan(plan)
      setFolderTree(cache.folderTree)
      const sessionAfterPlan = await getSession(currentSessionId)
      cache.activeClusterVersionId =
        sessionAfterPlan.active_cluster_version_id ?? null
      syncSessionMetadata(sessionAfterPlan)
      await syncLatestPlanProgress(currentSessionId)
      syncPlanAnalysisState("done")
      toast.success("Đã tạo session và phân tích phương án chỉnh lý.")
      await wait(PLAN_DONE_VISIBLE_MS)
      navigate(`/sessions/${encodeURIComponent(currentSessionId)}/step/2`)
    } catch (err) {
      syncPlanAnalysisState("idle")
      setPlanProgressPhase(null)
      setPlanProgressMessage("")
      setPlanCompletedPhases(new Set())
      syncZipState("idle")
      if (cache.draftZipFile) {
        syncZipUploadProgress(
          zipUploadProgressForFile(
            cache.draftZipFile,
            "error",
            cache.zipUploadProgress?.loadedBytes ?? 0
          )
        )
      }
      toast.error(
        err instanceof Error
          ? err.message
          : "Không thể bắt đầu phân tích phương án."
      )
    }
  }

  return { handleStartAll }
}
