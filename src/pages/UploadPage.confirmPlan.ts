import { toast } from "sonner"
import {
  enqueueClusterBuild,
  getActiveClusters,
  getClusterBuildStatus,
  getSession,
  patchActivePlan,
} from "@/features/upload/api/sessionApi"
import { uploadPageCache as cache } from "./UploadPage.cache"
import {
  activeClusterBuildStrategy,
  activePlanBuildStrategy,
  activePlanDocumentNumberingMode,
  activePlanToParsedPlan,
  documentNumberingModeValue,
  dossierBuildStrategyValue,
  planToTree,
} from "./UploadPage.planUtils"

export function createConfirmPlanHandler(context: Record<string, any>) {
  const {
    confirmingPlan,
    planAnalysisState,
    dossierBuildStrategy,
    documentNumberingMode,
    zipFolderPath,
    existingSessionMode,
    uploadMode,
    zipSupplementUploaded,
    ocr,
    applyActivePlanResponse,
    applyPersistedDossierBuildStrategy,
    applyPersistedDocumentNumberingMode,
    parseZipMaxFiles,
    syncZipState,
    goTo,
    setParsedPlan,
    setFolderTree,
    setClusterGroups,
    setConfirmingPlan,
    setZipSupplementUploaded,
  } = context

  return async function handleConfirmPlan() {
    if (confirmingPlan) return
    if (!cache.sessionId) {
      toast.error("Chưa có session xử lý.")
      return
    }
    let confirmedPlanVersionId = cache.activePlanVersionId.trim()
    const hasConfirmedPlan =
      planAnalysisState === "done" &&
      cache.folderTree.length > 0 &&
      Boolean(confirmedPlanVersionId)

    setConfirmingPlan(true)
    let folderPath = ""
    let maxFilesToProcess: number | undefined
    let forceDigitization = false
    let existingStatus = ocr.status
    try {
      if (hasConfirmedPlan) {
      if (cache.documentNumberingModeSavePromise) {
        const planResponse = await cache.documentNumberingModeSavePromise
        applyActivePlanResponse(planResponse)
        confirmedPlanVersionId = cache.activePlanVersionId.trim()
      }
      const selectedStrategy = dossierBuildStrategy
      const selectedNumberingMode = documentNumberingMode
      const strategyChangedBeforeSave =
        selectedStrategy !== cache.persistedDossierBuildStrategy
      const numberingModeChangedBeforeSave =
        selectedNumberingMode !== cache.persistedDocumentNumberingMode
      if (strategyChangedBeforeSave || numberingModeChangedBeforeSave) {
        const planResponse = await patchActivePlan(cache.sessionId, {
          dossier_build_strategy: selectedStrategy,
          document_numbering_mode: selectedNumberingMode,
        })
        const plan = activePlanToParsedPlan(planResponse)
        confirmedPlanVersionId = planResponse.id ?? ""
        cache.activePlanVersionId = confirmedPlanVersionId
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
      }

      let activeClusterVersionId = cache.activeClusterVersionId
      if (!activeClusterVersionId) {
        const sessionDetail = await getSession(cache.sessionId)
        activeClusterVersionId = sessionDetail.active_cluster_version_id ?? null
        cache.activeClusterVersionId = activeClusterVersionId
      }

      if (activeClusterVersionId) {
        const [activeClusters, clusterBuildStatus] = await Promise.all([
          getActiveClusters(cache.sessionId),
          getClusterBuildStatus(cache.sessionId),
        ])
        const activeStrategy = activeClusterBuildStrategy(activeClusters)
        const queuedStrategy = dossierBuildStrategyValue(
          clusterBuildStatus.job?.payload.dossier_build_strategy
        )
        const matchingBuildActive =
          clusterBuildStatus.active && queuedStrategy === selectedStrategy
        const rebuildRequired =
          strategyChangedBeforeSave ||
          activeStrategy === null ||
          activeStrategy !== selectedStrategy

        if (rebuildRequired) {
          if (!matchingBuildActive) {
            await enqueueClusterBuild(cache.sessionId, {
              source: "plan_reanalysis",
              dossier_build_strategy: selectedStrategy,
            })
          }
          cache.clusterGroups = []
          setClusterGroups([])
          toast.success(
            matchingBuildActive
              ? "Task lập lại hồ sơ đang được xử lý."
              : "Đã lưu cách thức lập hồ sơ và gửi task lập lại hồ sơ."
          )
          goTo(4, cache.sessionId)
          return
        }
      }
      }

      folderPath =
        zipFolderPath ||
        cache.zipUpload?.folder_path ||
        cache.zipUpload?.data_path ||
        ""
      if (!folderPath) {
        if (existingSessionMode) {
          toast.info(
            "Session này chưa có dữ liệu ZIP mới. Bạn có thể tiếp tục xem lại phương án chỉnh lý."
          )
          return
        }
        toast.error("Chưa có folder_path để bắt đầu lấy metadata.")
        return
      }
      if (cache.zipUpload && !cache.zipUpload.remote_batch_id) {
        toast.error(
          "File ZIP chưa được upload lên Chỉnh Lý/MinIO. Vui lòng tải lại file ZIP."
        )
        return
      }

      try {
        maxFilesToProcess = parseZipMaxFiles()
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Số lượng tài liệu không hợp lệ."
        )
        return
      }

      const hasSupplementalZipUpload =
        existingSessionMode &&
        cache.rawZipReuploaded &&
        Boolean(cache.zipUpload)
      existingStatus = ocr.status ?? (await ocr.refresh())
      if ((existingStatus?.jobs.length ?? 0) > 0) {
        const existingMode = documentNumberingModeValue(
          existingStatus?.document_numbering_mode
        )
        if (existingMode && existingMode !== documentNumberingMode) {
          forceDigitization = true
          toast.info(
            "Cách xử lý PDF đã thay đổi. Hệ thống sẽ lấy lại metadata."
          )
        } else if (!hasSupplementalZipUpload) {
          const hasReadyMetadata = existingStatus?.jobs.some(
            (job: { metadata_ready?: boolean }) => job.metadata_ready
          )
          syncZipState(hasReadyMetadata ? "done" : "processing")
          toast.info(
            "Session đã có dữ liệu metadata. Không gọi lại bước lấy metadata."
          )
          goTo(3)
          return
        }
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Không thể xác nhận phương án chỉnh lý."
      )
      return
    } finally {
      setConfirmingPlan(false)
    }

    if (cache.zipUpload && uploadMode === "overwrite") {
      const confirmed = window.confirm(
        "Bạn đã chọn overwrite. Các PDF trùng đường dẫn trong ZIP bổ sung sẽ ghi đè file đang có và metadata/review của các file đó sẽ được extract lại. Tiếp tục?"
      )
      if (!confirmed) return
    }

    syncZipState("processing")
    toast.success(
      hasConfirmedPlan
        ? "Đã xác nhận phương án. Bắt đầu lấy metadata."
        : "Bắt đầu lấy metadata."
    )
    void ocr
      .start(folderPath, {
        maxFiles: maxFilesToProcess,
        confirmedPlanVersionId: confirmedPlanVersionId || undefined,
        documentNumberingMode,
        sessionFileId: cache.zipUpload?.id,
        remoteFileId: cache.zipUpload?.remote_file_id ?? null,
        uploadMode: cache.zipUpload ? uploadMode : undefined,
        force: forceDigitization,
        reextract: forceDigitization || zipSupplementUploaded,
        previousStatus: existingStatus ?? null,
      })
      .then(() => {
        syncZipState("done")
        cache.rawZipReuploaded = false
        setZipSupplementUploaded(false)
        toast.success("Đã hoàn tất lấy metadata từ remote folder.")
      })
      .catch((err: unknown) => {
        syncZipState("idle")
        toast.error(
          err instanceof Error ? err.message : "Không thể bắt đầu OCR."
        )
      })
    goTo(3)
  }
}
