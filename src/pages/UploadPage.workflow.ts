import { toast } from "sonner"
import {
  enqueuePlanAnalysis,
  type SessionInputUploadResponse,
  uploadSessionInput,
} from "@/features/upload/api/sessionApi"
import type { PendingDataUploadStartResult } from "@/features/upload/components/step1/PendingDataUpload"
import { uploadPageCache as cache } from "./UploadPage.cache"
import {
  PLAN_DONE_VISIBLE_MS,
  addSetValue,
  planProgressMessageForPhase,
  wait,
} from "./UploadPage.progress"
import { resolveExistingSessionWorkflowAction } from "./UploadPage.workflowPolicy"

export function createUploadPageWorkflowActions(context: Record<string, any>) {
  const {
    sessionId,
    routeSessionId,
    existingSessionMode,
    zipSupplementUploaded,
    planInputsReuploaded,
    planAnalysisState,
    allDone,
    hasPlanReady,
    hasWorkingPlan,
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
    syncPlanAnalysisState,
    setPlanAnalysisJobId,
    syncDoc1State,
    syncDoc2State,
    syncZipState,
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
    zipUploadManager,
    onZipUploadAccepted,
  } = context

  const resetPlanReuploadState = (updateView = true) => {
    cache.arrangementPlanReuploaded = false
    cache.retentionReuploaded = false
    if (updateView) {
      setPlanReuploadState({ arrangement: false, retention: false })
    }
  }

  const syncPlanAnalysisJobId = (jobId: number | null, updateView = true) => {
    cache.planAnalysisJobId = jobId
    if (updateView) setPlanAnalysisJobId(jobId)
  }

  const handleAnalyzeExistingSessionPlan = async ({
    includeStoredInputs = false,
    isWorkflowActive = () => true,
  }: {
    includeStoredInputs?: boolean
    isWorkflowActive?: () => boolean
  } = {}) => {
    const currentSessionId = sessionId ?? routeSessionId ?? cache.sessionId
    if (!currentSessionId) {
      if (isWorkflowActive()) {
        toast.error("Chưa có session để phân tích phương án.")
      }
      return
    }
    if (!includeStoredInputs && !planReanalysisReady) {
      if (isWorkflowActive()) {
        toast.error(
          "Vui lòng tải lại phương án chỉnh lý hoặc thời hạn bảo quản."
        )
      }
      return
    }

    const analyzeArrangement = includeStoredInputs
      ? doc1Has
      : planReuploadState.arrangement
    const analyzeRetention = includeStoredInputs
      ? doc2Has
      : planReuploadState.retention
    const planFile = analyzeArrangement
      ? cache.arrangementPlanUpload?.local_cached_path
      : undefined
    const retentionFiles = analyzeRetention
      ? retentionUploadPaths(cache.retentionUploads)
      : []
    if (analyzeArrangement && !planFile) {
      if (isWorkflowActive()) {
        toast.error("Backend chưa trả về đường dẫn local cho file phương án.")
      }
      return
    }
    if (analyzeRetention && retentionFiles.length === 0) {
      if (isWorkflowActive()) {
        toast.error(
          "Backend chưa trả về đường dẫn local cho file thời hạn bảo quản."
        )
      }
      return
    }
    if (!planFile && retentionFiles.length === 0) {
      if (isWorkflowActive()) {
        toast.error(
          "Chưa có file phương án hoặc thời hạn bảo quản để phân tích."
        )
      }
      return
    }

    try {
      if (isWorkflowActive()) {
        syncPlanAnalysisJobId(null)
        syncPlanAnalysisState("processing")
        if (analyzeArrangement) syncDoc1State("processing")
        if (analyzeRetention) syncDoc2State("processing")
        setPlanCompletedPhases(new Set(["upload_inputs"]))
        setPlanProgressPhase("preparing_plan_file")
        setPlanProgressMessage(
          planProgressMessageForPhase("preparing_plan_file")
        )
      }

      const queuedJob = await enqueuePlanAnalysis(currentSessionId, {
        ...(planFile ? { plan_file: planFile } : {}),
        ...(retentionFiles.length > 0
          ? { retention_files: retentionFiles }
          : {}),
        dossier_build_strategy: dossierBuildStrategy,
      })
      syncPlanAnalysisJobId(queuedJob.job_id, isWorkflowActive())
      resetPlanReuploadState(isWorkflowActive())

      const retentionOnly = analyzeRetention && !analyzeArrangement
      cache.clusterGroups = []
      if (isWorkflowActive()) {
        setPlanProgressMessage(
          retentionOnly
            ? "Đang chờ backend phân tích thông tư thời hạn bảo quản."
            : "Đang chờ backend phân tích phương án."
        )
        setClusterGroups([])
        toast.success(
          retentionOnly
            ? "Đã gửi task phân tích thời hạn bảo quản."
            : "Đã gửi task phân tích phương án."
        )
        goTo(2, currentSessionId)
      }
    } catch (err) {
      if (isWorkflowActive()) {
        syncPlanAnalysisJobId(null)
        syncPlanAnalysisState("idle")
        syncDoc1State(doc1Has ? "done" : "idle")
        syncDoc2State(doc2Has ? "done" : "idle")
        setPlanProgressPhase(null)
        setPlanProgressMessage("")
        setPlanCompletedPhases(new Set())
        toast.error(
          err instanceof Error ? err.message : "Không thể phân tích phương án."
        )
      }
    }
  }

  const uploadPendingZipForExistingSession = async () => {
    const file = cache.draftZipFile
    const currentSessionId = routeSessionId ?? sessionId ?? cache.sessionId
    if (!file || !currentSessionId) return false
    const parsedZipMaxFiles = Number(cache.zipMaxFiles)
    try {
      syncZipState("processing")
      syncZipUploadProgress(zipUploadProgressForFile(file, "uploading"))
      const startedUpload = zipUploadManager.start({
        sessionId: currentSessionId,
        file,
        mode: cache.uploadMode,
        maxFiles:
          Number.isInteger(parsedZipMaxFiles) && parsedZipMaxFiles > 0
            ? parsedZipMaxFiles
            : undefined,
      })
      onZipUploadAccepted?.()
      const response = await startedUpload.completion
      cache.zipUpload = response
      cache.draftZipFile = null
      cache.rawZipReuploaded = true
      setZipSupplementUploaded(true)
      syncZipUploadProgress(zipUploadProgressForFile(file, "done", file.size))
      syncZipState("done")
      syncZipFolderPath(response.folder_path ?? response.data_path ?? "")
      toast.success("Upload ZIP đã hoàn tất.")
      return true
    } catch (err) {
      syncZipState("idle")
      syncZipUploadProgress(
        zipUploadProgressForFile(
          file,
          "error",
          cache.zipUploadProgress?.loadedBytes ?? 0
        )
      )
      toast.error(
        err instanceof Error ? err.message : "Không thể upload file ZIP."
      )
      return false
    }
  }

  const handleStartAll = async ({
    pendingDataUpload,
  }: {
    pendingDataUpload?: PendingDataUploadStartResult
  } = {}) => {
    const workflowPath = window.location.pathname
    const isWorkflowActive = () => window.location.pathname === workflowPath
    const pendingFolderCompletion =
      pendingDataUpload?.kind === "folder"
        ? pendingDataUpload.completion
        : undefined

    if (existingSessionMode && pendingFolderCompletion) {
      try {
        await pendingFolderCompletion
      } catch (err) {
        if (isWorkflowActive()) {
          toast.error(
            err instanceof Error ? err.message : "Upload folder chưa hoàn tất."
          )
        }
        return
      }
    }

    if (
      allDone &&
      !cache.draftZipFile &&
      !(existingSessionMode && zipSupplementUploaded)
    ) {
      if (isWorkflowActive()) goTo(2)
      return
    }
    if (existingSessionMode) {
      if (cache.draftZipFile) {
        const uploaded = await uploadPendingZipForExistingSession()
        if (!uploaded) return
      }

      const action = resolveExistingSessionWorkflowAction({
        hasPlanInputs: doc1Has || doc2Has,
        planInputsChanged: planInputsReuploaded,
        planAnalysisRunning: planAnalysisState === "processing",
        hasPlanAnalysisResult: hasPlanReady || hasWorkingPlan,
      })
      if (action === "analyze_plan") {
        await handleAnalyzeExistingSessionPlan({
          includeStoredInputs: !planInputsReuploaded,
          isWorkflowActive,
        })
      } else if (action === "monitor_plan_analysis" || action === "view_plan") {
        if (isWorkflowActive()) goTo(2)
      } else if (isWorkflowActive()) {
        const currentSessionId = routeSessionId ?? sessionId ?? cache.sessionId
        if (currentSessionId) {
          navigate(
            `/sessions/${encodeURIComponent(currentSessionId)}/step/3?extract=1`
          )
        } else {
          goTo(3)
        }
      }
      return
    }

    const arrangementFile = doc1Has ? cache.draftArrangementPlanFile : null
    const retentionFileDrafts = doc2Has ? cache.draftRetentionFiles : []
    const zipFile = zipHas ? cache.draftZipFile : null
    if (
      !arrangementFile &&
      retentionFileDrafts.length === 0 &&
      !zipFile &&
      !pendingFolderCompletion
    ) {
      toast.error("Vui lòng chọn ít nhất một file để bắt đầu.")
      return
    }
    try {
      syncPlanAnalysisJobId(null, isWorkflowActive())
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
      let retentionUploadTask: Promise<SessionInputUploadResponse[]> =
        Promise.resolve([])
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
      if (retentionFileDrafts.length > 0) {
        syncDoc2State("processing")
        retentionUploadTask = Promise.all(
          retentionFileDrafts.map((file) =>
            uploadSessionInput(currentSessionId, "retention_schedule", file)
          )
        ).then((responses) => {
          cache.retentionUploads = responses
          cache.retentionUpload = responses[responses.length - 1] ?? null
          syncDoc2State("done")
          return responses
        })
      }
      if (zipFile) {
        const parsedZipMaxFiles = Number(cache.zipMaxFiles)
        syncZipState("processing")
        syncZipUploadProgress(zipUploadProgressForFile(zipFile, "uploading"))
        const startedUpload = zipUploadManager.start({
          sessionId: currentSessionId,
          file: zipFile,
          mode: cache.uploadMode,
          maxFiles:
            Number.isInteger(parsedZipMaxFiles) && parsedZipMaxFiles > 0
              ? parsedZipMaxFiles
              : undefined,
        })
        onZipUploadAccepted?.()
        zipUploadTask = startedUpload.completion.then(
          (response: SessionInputUploadResponse) => {
            if (window.location.pathname !== workflowPath) return response
            cache.zipUpload = response
            cache.draftZipFile = null
            syncZipUploadProgress(
              zipUploadProgressForFile(zipFile, "done", zipFile.size)
            )
            syncZipState("done")
            syncZipFolderPath(response.folder_path ?? response.data_path ?? "")
            return response
          }
        )
      }

      const [[arrangementPlan, retentionPlan, zipInput]] = await Promise.all([
        Promise.all([
          arrangementUploadTask,
          retentionUploadTask,
          zipUploadTask,
        ]),
        Promise.all(documentTasks),
        pendingFolderCompletion ?? Promise.resolve(),
      ])
      const dataUploadCompleted = Boolean(
        zipInput || pendingDataUpload?.kind === "folder"
      )

      if (!arrangementFile) {
        const retentionFiles = retentionUploadPaths(retentionPlan)
        if (retentionFileDrafts.length > 0 && retentionFiles.length === 0) {
          throw new Error(
            "Backend chưa trả về đường dẫn local cho file thông tư."
          )
        }
        if (retentionFiles.length > 0) {
          if (isWorkflowActive()) {
            syncPlanAnalysisState("processing")
            setPlanProgressPhase("retention_schedule")
            setPlanProgressMessage("Đang phân tích thông tư thời hạn bảo quản.")
          }
          const queuedJob = await enqueuePlanAnalysis(currentSessionId, {
            retention_files: retentionFiles,
            dossier_build_strategy: dossierBuildStrategy,
          })
          syncPlanAnalysisJobId(queuedJob.job_id, isWorkflowActive())
          if (!isWorkflowActive()) return
          setPlanProgressMessage(
            "Đang chờ backend phân tích thông tư thời hạn bảo quản."
          )
          toast.success(
            "Đã tạo session và gửi task phân tích thời hạn bảo quản."
          )
          navigate(`/sessions/${encodeURIComponent(currentSessionId)}/step/2`)
          return
        }
        if (!isWorkflowActive()) return
        toast.success("Đã tạo session và lưu các file đã chọn.")
        if (dataUploadCompleted) {
          await wait(PLAN_DONE_VISIBLE_MS)
          if (!isWorkflowActive()) return
          navigate(
            `/sessions/${encodeURIComponent(currentSessionId)}/step/3?extract=1`
          )
          return
        }
        navigate(`/sessions/${encodeURIComponent(currentSessionId)}/step/2`)
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
      if (isWorkflowActive()) {
        setPlanCompletedPhases((previous: Set<string>) =>
          addSetValue(previous, "upload_inputs")
        )
        setPlanProgressPhase("preparing_plan_file")
        setPlanProgressMessage(
          planProgressMessageForPhase("preparing_plan_file")
        )
      }
      const queuedJob = await planJob
      syncPlanAnalysisJobId(queuedJob.job_id, isWorkflowActive())
      if (!isWorkflowActive()) return
      setPlanProgressMessage("Đang chờ backend phân tích phương án chỉnh lý.")
      toast.success("Đã tạo session và gửi task phân tích phương án chỉnh lý.")
      navigate(`/sessions/${encodeURIComponent(currentSessionId)}/step/2`)
    } catch (err) {
      if (!isWorkflowActive()) return
      syncPlanAnalysisJobId(null)
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

function retentionUploadPaths(
  uploads: SessionInputUploadResponse[] | null | undefined
): string[] {
  return (uploads ?? [])
    .map((upload) => upload.local_cached_path?.trim() ?? "")
    .filter((path): path is string => Boolean(path))
}
