import { toast } from "sonner"
import {
  enqueueClusterBuild,
  enqueuePlanAnalysis,
  getSession,
  listSessionEvents,
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
    allDone,
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
      syncDoc1State("processing")
      syncDoc2State("processing")
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
      syncDoc1State("done")
      syncDoc2State("done")
      resetPlanReuploadState()

      setPlanProgressMessage(
        "Đã phân tích xong phương án mới. Đang gửi task lập lại hồ sơ."
      )
      try {
        await enqueueClusterBuild(currentSessionId, {
          source: "plan_reanalysis",
          dossier_build_strategy: dossierBuildStrategy,
        })
      } catch (err) {
        toast.error(
          err instanceof Error
            ? `Đã lưu phương án mới nhưng chưa gửi được task lập lại hồ sơ: ${err.message}`
            : "Đã lưu phương án mới nhưng chưa gửi được task lập lại hồ sơ."
        )
        goTo(2, currentSessionId)
        return
      }
      cache.clusterGroups = []
      setClusterGroups([])
      toast.success("Đã phân tích lại phương án và gửi task lập lại hồ sơ.")
      goTo(4, currentSessionId)
    } catch (err) {
      syncPlanAnalysisState("idle")
      syncDoc1State("done")
      syncDoc2State("done")
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
      if (planInputsReuploaded) {
        await handleReanalyzeExistingSessionPlan()
        return
      }
      if (zipSupplementUploaded) {
        await handleConfirmPlan()
        return
      }
      goTo(2)
      return
    }

    if (!doc1Has || !cache.draftArrangementPlanFile) {
      toast.error("Vui lòng tải lên phương án phân loại.")
      return
    }
    if (!doc2Has || !cache.draftRetentionFile) {
      toast.error("Vui lòng tải lên thông tư thời hạn bảo quản.")
      return
    }
    if (!zipHas || !cache.draftZipFile) {
      toast.error("Vui lòng chọn file ZIP dữ liệu.")
      return
    }
    try {
      syncPlanAnalysisState("processing")
      setPlanProgressPhase("upload_inputs")
      setPlanProgressMessage(planProgressMessageForPhase("upload_inputs"))
      setPlanCompletedPhases(new Set())
      const currentSessionId = await ensureSession()
      syncZipState("processing")
      syncZipUploadProgress(
        zipUploadProgressForFile(cache.draftZipFile, "uploading")
      )
      const arrangementPlan = await uploadSessionInput(
        currentSessionId,
        "arrangement_plan",
        cache.draftArrangementPlanFile
      )
      const [retentionPlan, zipInput] = await Promise.all([
        uploadSessionInput(
          currentSessionId,
          "retention_schedule",
          cache.draftRetentionFile
        ),
        uploadSessionInput(currentSessionId, "raw_zip", cache.draftZipFile, {
          onProgress: syncZipUploadProgress,
        }),
      ])
      cache.arrangementPlanUpload = arrangementPlan
      cache.retentionUpload = retentionPlan
      syncZipUploadProgress(
        zipUploadProgressForFile(
          cache.draftZipFile,
          "done",
          cache.draftZipFile.size
        )
      )
      syncZipState("done")
      cache.zipUpload = zipInput
      syncZipFolderPath(zipInput.folder_path ?? zipInput.data_path ?? "")

      const planFile = arrangementPlan.local_cached_path
      const retentionFile = retentionPlan.local_cached_path
      if (!planFile || !retentionFile) {
        throw new Error(
          "Backend chưa trả về đường dẫn local cho hồ sơ phương án."
        )
      }

      const documentTasks = [
        doc1Ref.current?.hasFile() ? doc1Ref.current.process() : null,
        doc2Ref.current?.hasFile() ? doc2Ref.current.process() : null,
      ].filter(Boolean) as Promise<void>[]
      const planJob = enqueuePlanAnalysis(currentSessionId, {
        plan_file: planFile,
        retention_file: retentionFile,
        dossier_build_strategy: dossierBuildStrategy,
      })
      setPlanCompletedPhases((previous: Set<string>) =>
        addSetValue(previous, "upload_inputs")
      )
      setPlanProgressPhase("preparing_plan_file")
      setPlanProgressMessage(planProgressMessageForPhase("preparing_plan_file"))
      await Promise.all([...documentTasks, planJob])
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
