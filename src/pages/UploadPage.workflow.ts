import { toast } from "sonner"
import {
  enqueuePlanAnalysis,
  type FolderUploadSummary,
  type SessionInputUploadResponse,
  uploadSessionInput,
} from "@/features/upload/api/sessionApi"
import { folderUploadManager } from "@/features/upload/lib/folderUploadManager"
import { zipUploadManager } from "@/features/upload/lib/zipUploadManager"
import { uploadPageCache as cache } from "./UploadPage.cache"
import {
  PLAN_DONE_VISIBLE_MS,
  addSetValue,
  planAnalysisScopeForInputs,
  planProgressMessageForPhase,
  wait,
} from "./UploadPage.progress"
import {
  canNavigateDirectlyToMetadata,
  resolveExistingPlanAnalysisAction,
  resolvePlanAnalysisInputSelection,
  resolvePlanInputsReuploaded,
  shouldAnalyzePlanInputsAfterDataUpload,
} from "./UploadPage.workflowPolicy"

export function createUploadPageWorkflowActions(context: Record<string, any>) {
  const {
    sessionId,
    routeSessionId,
    sessionViewScope,
    isSessionViewActive,
    existingSessionMode,
    zipSupplementUploaded,
    folderRunNeedsMetadataStart,
    planInputsReuploaded,
    planAnalysisState,
    allDone,
    hasPlanReady,
    planReuploadState,
    dossierBuildStrategy,
    doc1Has,
    doc2Has,
    zipHas,
    doc1Ref,
    doc2Ref,
    navigate,
    ensureSession,
    syncPlanAnalysisState,
    syncPlanAnalysisFailure,
    syncPlanAnalysisJobId,
    syncDoc1State,
    syncDoc2State,
    syncZipState,
    syncZipHas,
    syncZipUploadProgress,
    zipUploadProgressForFile,
    syncZipFolderPath,
    goTo,
    setPlanCompletedPhases,
    setPlanProgressPhase,
    setPlanProgressMessage,
    setClusterGroups,
    setPlanReuploadState,
    setZipSupplementUploaded,
    setLatestUploadInterruption,
    setLatestUploadWarning,
  } = context

  const sessionIsActive = (candidateSessionId: string): boolean =>
    typeof isSessionViewActive !== "function" ||
    isSessionViewActive(sessionViewScope, candidateSessionId)

  const resetPlanReuploadState = () => {
    cache.arrangementPlanReuploaded = false
    cache.retentionReuploaded = false
    setPlanReuploadState({ arrangement: false, retention: false })
  }

  const handleReanalyzeExistingSessionPlan = async () => {
    const currentSessionId = routeSessionId ?? sessionId ?? cache.sessionId
    if (!currentSessionId) {
      toast.error("Chưa có session để phân tích lại phương án.")
      return
    }
    const currentPlanReuploadState = {
      arrangement:
        Boolean(planReuploadState.arrangement) ||
        cache.arrangementPlanReuploaded,
      retention:
        Boolean(planReuploadState.retention) || cache.retentionReuploaded,
    }
    const { analyzeArrangement, analyzeRetention } =
      resolvePlanAnalysisInputSelection({
        arrangementReuploaded: currentPlanReuploadState.arrangement,
        retentionReuploaded: currentPlanReuploadState.retention,
        hasPlanReady,
        hasArrangementPlan: Boolean(doc1Has),
        hasRetentionSchedule: Boolean(doc2Has),
      })
    const currentPlanReanalysisReady =
      existingSessionMode && (analyzeArrangement || analyzeRetention)
    const analyzeStoredInputs =
      !currentPlanReuploadState.arrangement &&
      !currentPlanReuploadState.retention &&
      (analyzeArrangement || analyzeRetention)
    if (!currentPlanReanalysisReady && !analyzeStoredInputs) {
      toast.error("Vui lòng tải lại phương án chỉnh lý hoặc thời hạn bảo quản.")
      return
    }

    const retentionOnly = analyzeRetention && !analyzeArrangement
    const planFile = analyzeArrangement
      ? cache.arrangementPlanUpload?.local_cached_path
      : undefined
    const retentionFiles = analyzeRetention
      ? retentionUploadPaths(cache.retentionUploads)
      : []
    if (analyzeArrangement && !planFile) {
      toast.error(
        "Backend chưa trả về đường dẫn local cho file phương án vừa tải lại."
      )
      return
    }
    if (analyzeRetention && retentionFiles.length === 0) {
      toast.error(
        "Backend chưa trả về đường dẫn local cho file thời hạn bảo quản vừa tải lại."
      )
      return
    }
    if (!planFile && retentionFiles.length === 0) {
      toast.error(
        "Chưa có file phương án hoặc thời hạn bảo quản để phân tích lại."
      )
      return
    }

    try {
      syncPlanAnalysisFailure(null)
      syncPlanAnalysisJobId(null)
      cache.planAnalysisScope = planAnalysisScopeForInputs({
        analyzePlan: analyzeArrangement,
        analyzeRetention,
      })
      syncPlanAnalysisState("processing")
      if (analyzeArrangement) syncDoc1State("processing")
      if (analyzeRetention) syncDoc2State("processing")
      setPlanCompletedPhases(new Set(["upload_inputs"]))
      setPlanProgressPhase(
        retentionOnly ? "retention_period" : "preparing_plan_file"
      )
      setPlanProgressMessage(
        planProgressMessageForPhase(
          retentionOnly ? "retention_period" : "preparing_plan_file"
        )
      )

      const analysisJob = await enqueuePlanAnalysis(currentSessionId, {
        ...(planFile ? { plan_file: planFile } : {}),
        ...(retentionFiles.length > 0
          ? { retention_files: retentionFiles }
          : {}),
        dossier_build_strategy: dossierBuildStrategy,
      })
      if (!sessionIsActive(currentSessionId)) return
      syncPlanAnalysisJobId(analysisJob.job_id)
      resetPlanReuploadState()

      setPlanProgressMessage(
        retentionOnly
          ? "Đang chờ backend phân tích thông tư thời hạn bảo quản."
          : "Đang chờ backend phân tích phương án mới."
      )
      cache.clusterGroups = []
      setClusterGroups([])
      toast.success(
        retentionOnly
          ? "Đã gửi task phân tích thời hạn bảo quản."
          : "Đã gửi task phân tích lại phương án."
      )
      goTo(2, currentSessionId)
    } catch (err) {
      if (!sessionIsActive(currentSessionId)) return
      syncPlanAnalysisJobId(null)
      cache.planAnalysisScope = null
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

  const uploadPendingDataInput = async (
    currentSessionId: string
  ): Promise<SessionInputUploadResponse | FolderUploadSummary | null> => {
    const folderSources = cache.draftFolderSources
    if (folderSources.length > 0) {
      const hadValidDataInput = Boolean(
        cache.zipUpload ||
        (cache.latestFolderUpload?.document_sync_status === "ready" &&
          cache.latestFolderUpload.counts.effective > 0)
      )
      cache.latestUploadInterruption = null
      cache.latestUploadWarning = null
      setLatestUploadInterruption(null)
      setLatestUploadWarning(null)
      syncZipState("processing")
      const summary = await folderUploadManager.start(
        currentSessionId,
        folderSources,
        cache.draftFolderRootName || "Tai-lieu-PDF",
        cache.uploadMode,
        (updated) => {
          if (!sessionIsActive(currentSessionId)) return
          cache.latestFolderUpload = updated
          if (["sealed", "cancelled"].includes(updated.status)) {
            cache.draftFolderSources = []
            cache.draftFolderRootName = ""
            cache.draftZipFile = null
          }
          const ready =
            updated.document_sync_status === "ready" &&
            updated.counts.effective > 0
          if (ready) {
            cache.zipHas = true
            syncZipHas(true)
            syncZipState("done")
            syncZipFolderPath(updated.root_name)
          } else if (
            updated.status === "cancelled" &&
            updated.document_sync_status === "ready" &&
            !hadValidDataInput
          ) {
            cache.zipHas = false
            syncZipHas(false)
            syncZipState("idle")
          }
        }
      )
      if (!sessionIsActive(currentSessionId)) return summary
      cache.latestFolderUpload = summary
      cache.draftFolderSources = []
      cache.draftFolderRootName = ""
      cache.draftZipFile = null
      syncZipState("done")
      syncZipFolderPath(summary.root_name)
      return summary
    }

    const zipFile = cache.draftZipFile
    if (!zipFile) return null
    const parsedZipMaxFiles = Number(cache.zipMaxFiles)
    const hadValidDataInput = Boolean(
      cache.zipUpload ||
      (cache.latestFolderUpload?.document_sync_status === "ready" &&
        cache.latestFolderUpload.counts.effective > 0)
    )
    cache.latestUploadInterruption = null
    cache.latestUploadWarning = null
    setLatestUploadInterruption(null)
    setLatestUploadWarning(null)
    syncZipState("processing")
    syncZipUploadProgress(zipUploadProgressForFile(zipFile, "uploading"))
    let zipCommitted = false
    const commitZip = (response: SessionInputUploadResponse) => {
      if (zipCommitted || !sessionIsActive(currentSessionId)) return
      zipCommitted = true
      cache.zipUpload = response
      cache.latestZipAttempt = response
      cache.latestFolderUpload = null
      cache.latestUploadInterruption = null
      cache.draftZipFile = null
      cache.zipHas = true
      syncZipHas(true)
      syncZipUploadProgress(
        zipUploadProgressForFile(zipFile, "done", zipFile.size)
      )
      syncZipState("done")
      syncZipFolderPath(response.folder_path ?? response.data_path ?? "")
    }
    const response = await zipUploadManager.start(currentSessionId, zipFile, {
      uploadMode: cache.uploadMode,
      maxFiles:
        Number.isInteger(parsedZipMaxFiles) && parsedZipMaxFiles > 0
          ? parsedZipMaxFiles
          : undefined,
      onProgress: (progress) => {
        if (sessionIsActive(currentSessionId)) {
          syncZipUploadProgress(progress)
        }
      },
      onCompleted: commitZip,
      onCancelled: () => {
        if (!sessionIsActive(currentSessionId)) return
        cache.draftZipFile = null
        if (!hadValidDataInput) {
          cache.zipHas = false
          syncZipHas(false)
          syncZipState("idle")
        }
      },
    })
    commitZip(response)
    return response
  }

  const handleStartAllImpl = async () => {
    const canGoDirectlyToMetadata = canNavigateDirectlyToMetadata(
      Boolean(doc1Has),
      Boolean(doc2Has)
    )
    const hasPendingData =
      Boolean(cache.draftZipFile) || cache.draftFolderSources.length > 0
    const partialFolderReady =
      cache.latestFolderUpload?.status === "cancelled" &&
      cache.latestFolderUpload.document_sync_status === "ready" &&
      cache.latestFolderUpload.counts.effective > 0 &&
      (cache.latestFolderUpload.ingestion_run?.ocr_batch_ids.length ?? 0) === 0
    if (existingSessionMode && hasPendingData) {
      try {
        const currentSessionId = await ensureSession()
        const dataInput = await uploadPendingDataInput(currentSessionId)
        const dataUploadSucceeded = Boolean(
          dataInput && sessionIsActive(currentSessionId)
        )
        if (dataInput && dataUploadSucceeded) {
          const isFolderInput = "folder_upload_id" in dataInput
          const hasReuploadedPlanInputs = resolvePlanInputsReuploaded({
            renderedState: Boolean(planInputsReuploaded),
            arrangementCached: cache.arrangementPlanReuploaded,
            retentionCached: cache.retentionReuploaded,
          })
          cache.rawZipReuploaded = !isFolderInput
          setZipSupplementUploaded(true)
          if (
            shouldAnalyzePlanInputsAfterDataUpload({
              dataUploadSucceeded,
              planInputsReuploaded: hasReuploadedPlanInputs,
            })
          ) {
            await handleReanalyzeExistingSessionPlan()
          } else if (isFolderInput) {
            navigate(
              `/sessions/${encodeURIComponent(currentSessionId)}/step/3?extract=1`
            )
          }
        }
      } catch (err) {
        const currentSessionId = routeSessionId ?? sessionId ?? cache.sessionId
        if (currentSessionId && !sessionIsActive(currentSessionId)) return
        syncZipState("idle")
        toast.error(
          err instanceof Error
            ? err.message
            : "Không thể upload dữ liệu bổ sung."
        )
      }
      return
    }
    if (
      partialFolderReady &&
      !planInputsReuploaded &&
      canGoDirectlyToMetadata
    ) {
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
    if (
      existingSessionMode &&
      folderRunNeedsMetadataStart &&
      !planInputsReuploaded &&
      canGoDirectlyToMetadata
    ) {
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
    if (allDone && !(existingSessionMode && zipSupplementUploaded)) {
      goTo(2)
      return
    }
    if (existingSessionMode) {
      const planAnalysisAction = resolveExistingPlanAnalysisAction({
        planInputsReuploaded: Boolean(planInputsReuploaded),
        planAnalysisProcessing: planAnalysisState === "processing",
        hasPlanInput: Boolean(doc1Has || doc2Has),
        hasPlanReady: Boolean(hasPlanReady),
      })
      if (planAnalysisAction === "reanalyze") {
        await handleReanalyzeExistingSessionPlan()
        return
      }
      if (planAnalysisAction === "view_progress") {
        goTo(2)
        return
      }
      if (zipSupplementUploaded && canGoDirectlyToMetadata) {
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
      if (zipHas && !hasPlanReady && canGoDirectlyToMetadata) {
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
    const retentionFileDrafts = doc2Has ? cache.draftRetentionFiles : []
    const zipFile = zipHas ? cache.draftZipFile : null
    const folderSources = zipHas ? cache.draftFolderSources : []
    if (
      !arrangementFile &&
      retentionFileDrafts.length === 0 &&
      !zipFile &&
      folderSources.length === 0
    ) {
      toast.error("Vui lòng chọn ít nhất một file để bắt đầu.")
      return
    }
    try {
      syncPlanAnalysisFailure(null)
      if (arrangementFile || retentionFileDrafts.length > 0) {
        syncPlanAnalysisJobId(null)
        cache.planAnalysisScope = null
      }
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
      if (!sessionIsActive(currentSessionId)) return
      const documentTasks = [
        doc1Ref.current?.hasFile() ? doc1Ref.current.process() : null,
        doc2Ref.current?.hasFile() ? doc2Ref.current.process() : null,
      ].filter(Boolean) as Promise<void>[]
      let arrangementUploadTask: Promise<SessionInputUploadResponse | null> =
        Promise.resolve(null)
      let retentionUploadTask: Promise<SessionInputUploadResponse[]> =
        Promise.resolve([])
      let zipUploadTask: Promise<
        SessionInputUploadResponse | FolderUploadSummary | null
      > = Promise.resolve(null)

      if (arrangementFile) {
        syncDoc1State("processing")
        arrangementUploadTask = uploadSessionInput(
          currentSessionId,
          "arrangement_plan",
          arrangementFile
        ).then((response) => {
          if (sessionIsActive(currentSessionId)) {
            cache.arrangementPlanUpload = response
            syncDoc1State("done")
          }
          return response
        })
      }
      if (retentionFileDrafts.length > 0) {
        syncDoc2State("processing")
        retentionUploadTask = Promise.all(
          retentionFileDrafts.map((file) =>
            uploadSessionInput(currentSessionId, "retention_schedule", file)
          )
        ).then((responses) => {
          if (sessionIsActive(currentSessionId)) {
            cache.retentionUploads = responses
            cache.retentionUpload = responses[responses.length - 1] ?? null
            syncDoc2State("done")
          }
          return responses
        })
      }
      if (zipFile || folderSources.length > 0) {
        zipUploadTask = uploadPendingDataInput(currentSessionId)
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
        const retentionFiles = retentionUploadPaths(retentionPlan)
        if (retentionFileDrafts.length > 0 && retentionFiles.length === 0) {
          throw new Error(
            "Backend chưa trả về đường dẫn local cho file thông tư."
          )
        }
        if (retentionFiles.length > 0) {
          if (sessionIsActive(currentSessionId)) {
            cache.planAnalysisScope = "retention"
            syncPlanAnalysisState("processing")
            syncDoc2State("processing")
            setPlanProgressPhase("retention_period")
            setPlanProgressMessage("Đang phân tích thông tư thời hạn bảo quản.")
          }
          const retentionJob = await enqueuePlanAnalysis(currentSessionId, {
            retention_files: retentionFiles,
            dossier_build_strategy: dossierBuildStrategy,
          })
          if (sessionIsActive(currentSessionId)) {
            syncPlanAnalysisJobId(retentionJob.job_id)
            setPlanProgressMessage(
              "Đang chờ backend phân tích thông tư thời hạn bảo quản."
            )
            toast.success(
              "Đã tạo session và gửi task phân tích thời hạn bảo quản."
            )
            navigate(`/sessions/${encodeURIComponent(currentSessionId)}/step/2`)
          }
          return
        }
        if (sessionIsActive(currentSessionId)) {
          toast.success("Đã tạo session và lưu các file đã chọn.")
        }
        if (zipInput) {
          await wait(PLAN_DONE_VISIBLE_MS)
          if (sessionIsActive(currentSessionId)) {
            navigate(
              `/sessions/${encodeURIComponent(currentSessionId)}/step/3?extract=1`
            )
          }
          return
        }
        if (sessionIsActive(currentSessionId)) {
          navigate(`/sessions/${encodeURIComponent(currentSessionId)}/step/2`)
        }
        return
      }

      const planFile = arrangementPlan?.local_cached_path
      const retentionFiles = retentionUploadPaths(retentionPlan)
      if (
        !planFile ||
        (retentionFileDrafts.length > 0 && retentionFiles.length === 0)
      ) {
        throw new Error(
          "Backend chưa trả về đường dẫn local cho file phương án hoặc thông tư."
        )
      }

      const planJob = enqueuePlanAnalysis(currentSessionId, {
        plan_file: planFile,
        ...(retentionFiles.length > 0
          ? { retention_files: retentionFiles }
          : {}),
        dossier_build_strategy: dossierBuildStrategy,
      })
      if (sessionIsActive(currentSessionId)) {
        cache.planAnalysisScope = planAnalysisScopeForInputs({
          analyzePlan: true,
          analyzeRetention: retentionFiles.length > 0,
        })
        syncDoc1State("processing")
        if (retentionFiles.length > 0) syncDoc2State("processing")
        setPlanCompletedPhases((previous: Set<string>) =>
          addSetValue(previous, "upload_inputs")
        )
        setPlanProgressPhase("preparing_plan_file")
        setPlanProgressMessage(
          planProgressMessageForPhase("preparing_plan_file")
        )
      }
      const planJobResponse = await planJob
      if (sessionIsActive(currentSessionId)) {
        syncPlanAnalysisJobId(planJobResponse.job_id)
        setPlanProgressMessage("Đang chờ backend phân tích phương án chỉnh lý.")
        toast.success(
          "Đã tạo session và gửi task phân tích phương án chỉnh lý."
        )
        navigate(`/sessions/${encodeURIComponent(currentSessionId)}/step/2`)
      }
    } catch (err) {
      const currentSessionId = routeSessionId ?? sessionId ?? cache.sessionId
      if (currentSessionId && !sessionIsActive(currentSessionId)) return
      syncPlanAnalysisJobId(null)
      cache.planAnalysisScope = null
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

  return { handleStartAll: handleStartAllImpl }
}

function retentionUploadPaths(
  uploads: SessionInputUploadResponse[] | null | undefined
): string[] {
  return (uploads ?? [])
    .map((upload) => upload.local_cached_path?.trim() ?? "")
    .filter((path): path is string => Boolean(path))
}
