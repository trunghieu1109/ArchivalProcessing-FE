import { toast } from "sonner"
import {
  enqueuePlanAnalysis,
  type SessionInputUploadResponse,
  uploadSessionInput,
} from "@/features/upload/api/sessionApi"
import { uploadPageCache as cache } from "./UploadPage.cache"
import {
  PLAN_DONE_VISIBLE_MS,
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
    syncPlanAnalysisState,
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
  } = context

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
    const retentionFiles = planReuploadState.retention
      ? retentionUploadPaths(cache.retentionUploads)
      : []
    if (planReuploadState.arrangement && !planFile) {
      toast.error(
        "Backend chưa trả về đường dẫn local cho file phương án vừa tải lại."
      )
      return
    }
    if (planReuploadState.retention && retentionFiles.length === 0) {
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
      syncPlanAnalysisState("processing")
      if (planReuploadState.arrangement) syncDoc1State("processing")
      if (planReuploadState.retention) syncDoc2State("processing")
      setPlanCompletedPhases(new Set(["upload_inputs"]))
      setPlanProgressPhase("preparing_plan_file")
      setPlanProgressMessage(planProgressMessageForPhase("preparing_plan_file"))

      await enqueuePlanAnalysis(currentSessionId, {
        ...(planFile ? { plan_file: planFile } : {}),
        ...(retentionFiles.length > 0 ? { retention_files: retentionFiles } : {}),
        dossier_build_strategy: dossierBuildStrategy,
      })
      resetPlanReuploadState()

      const retentionOnly =
        planReuploadState.retention && !planReuploadState.arrangement
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
    const retentionFileDrafts = doc2Has ? cache.draftRetentionFiles : []
    const zipFile = zipHas ? cache.draftZipFile : null
    if (!arrangementFile && retentionFileDrafts.length === 0 && !zipFile) {
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
        zipUploadTask = uploadSessionInput(
          currentSessionId,
          "raw_zip",
          zipFile,
          {
            uploadMode: cache.uploadMode,
            maxFiles:
              Number.isInteger(parsedZipMaxFiles) && parsedZipMaxFiles > 0
                ? parsedZipMaxFiles
                : undefined,
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
        const retentionFiles = retentionUploadPaths(retentionPlan)
        if (retentionFileDrafts.length > 0 && retentionFiles.length === 0) {
          throw new Error(
            "Backend chưa trả về đường dẫn local cho file thông tư."
          )
        }
        if (retentionFiles.length > 0) {
          syncPlanAnalysisState("processing")
          setPlanProgressPhase("retention_schedule")
          setPlanProgressMessage("Đang phân tích thông tư thời hạn bảo quản.")
          const retentionJob = enqueuePlanAnalysis(currentSessionId, {
            retention_files: retentionFiles,
            dossier_build_strategy: dossierBuildStrategy,
          })
          await retentionJob
          setPlanProgressMessage(
            "Đang chờ backend phân tích thông tư thời hạn bảo quản."
          )
          toast.success(
            "Đã tạo session và gửi task phân tích thời hạn bảo quản."
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
      const retentionFiles = retentionUploadPaths(retentionPlan)
      if (!planFile || (retentionFileDrafts.length > 0 && retentionFiles.length === 0)) {
        throw new Error(
          "Backend chưa trả về đường dẫn local cho file phương án hoặc thông tư."
        )
      }

      const planJob = enqueuePlanAnalysis(currentSessionId, {
        plan_file: planFile,
        ...(retentionFiles.length > 0 ? { retention_files: retentionFiles } : {}),
        dossier_build_strategy: dossierBuildStrategy,
      })
      setPlanCompletedPhases((previous: Set<string>) =>
        addSetValue(previous, "upload_inputs")
      )
      setPlanProgressPhase("preparing_plan_file")
      setPlanProgressMessage(planProgressMessageForPhase("preparing_plan_file"))
      await planJob
      setPlanProgressMessage("Đang chờ backend phân tích phương án chỉnh lý.")
      toast.success("Đã tạo session và gửi task phân tích phương án chỉnh lý.")
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

function retentionUploadPaths(
  uploads: SessionInputUploadResponse[] | null | undefined
): string[] {
  return (uploads ?? [])
    .map((upload) => upload.local_cached_path?.trim() ?? "")
    .filter((path): path is string => Boolean(path))
}
