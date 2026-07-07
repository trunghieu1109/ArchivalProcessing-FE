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
  activePlanDocumentNumberingStyleOverrides,
  activePlanDocumentNumberingStylePreset,
  activePlanToParsedPlan,
  documentNumberingModeValue,
  dossierBuildStrategyValue,
  planToTree,
  type NumberingStyleOverrides,
} from "./UploadPage.planUtils"

const CONFIRM_STATUS_REFRESH_TIMEOUT_MS = 3_000
const STATUS_REFRESH_TIMED_OUT = Symbol("status-refresh-timeout")

export function createConfirmPlanHandler(context: Record<string, any>) {
  const {
    confirmingPlan,
    planAnalysisState,
    dossierBuildStrategy,
    documentNumberingMode,
    documentNumberingStylePreset,
    documentNumberingStyleOverrides,
    zipFolderPath,
    existingSessionMode,
    uploadMode,
    zipSupplementUploaded,
    ocr,
    applyActivePlanResponse,
    applyPersistedDossierBuildStrategy,
    applyPersistedDocumentNumberingMode,
    applyPersistedDocumentNumberingStylePreset,
    applyPersistedDocumentNumberingStyleOverrides,
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
    let statusRefreshTimedOut = false
    try {
      if (hasConfirmedPlan) {
        if (cache.documentNumberingModeSavePromise) {
          const planResponse = await cache.documentNumberingModeSavePromise
          applyActivePlanResponse(planResponse)
          confirmedPlanVersionId = cache.activePlanVersionId.trim()
        }
        const selectedStrategy = dossierBuildStrategy
        const selectedNumberingMode = documentNumberingMode
        const selectedNumberingStylePreset = documentNumberingStylePreset
        const selectedOverrides: NumberingStyleOverrides =
          documentNumberingStyleOverrides || {}
        const strategyChangedBeforeSave =
          selectedStrategy !== cache.persistedDossierBuildStrategy
        const numberingModeChangedBeforeSave =
          selectedNumberingMode !== cache.persistedDocumentNumberingMode
        const numberingStyleChangedBeforeSave =
          selectedNumberingStylePreset !==
          cache.persistedDocumentNumberingStylePreset
        const overridesChanged =
          JSON.stringify(selectedOverrides) !==
          JSON.stringify(cache.persistedDocumentNumberingStyleOverrides)
        if (
          strategyChangedBeforeSave ||
          numberingModeChangedBeforeSave ||
          numberingStyleChangedBeforeSave ||
          overridesChanged
        ) {
          const planResponse = await patchActivePlan(cache.sessionId, {
            dossier_build_strategy: selectedStrategy,
            document_numbering_mode: selectedNumberingMode,
            document_numbering_style_preset: selectedNumberingStylePreset,
            document_numbering_style_overrides: selectedOverrides,
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
          applyPersistedDocumentNumberingStylePreset(
            activePlanDocumentNumberingStylePreset(planResponse)
          )
          if (
            typeof applyPersistedDocumentNumberingStyleOverrides === "function"
          ) {
            applyPersistedDocumentNumberingStyleOverrides(
              activePlanDocumentNumberingStyleOverrides(planResponse)
            )
          }
          cache.parsedPlan = plan
          cache.folderTree = planToTree(plan)
          setParsedPlan(plan)
          setFolderTree(cache.folderTree)
        }

        if (strategyChangedBeforeSave) {
          let activeClusterVersionId = cache.activeClusterVersionId
          if (activeClusterVersionId === undefined) {
            const sessionDetail = await getSession(cache.sessionId)
            activeClusterVersionId =
              sessionDetail.active_cluster_version_id ?? null
            cache.activeClusterVersionId = activeClusterVersionId
          }

          if (activeClusterVersionId) {
            const [activeClusters, clusterBuildStatus] = await Promise.all([
              getActiveClusters(cache.sessionId, { summaryOnly: true }),
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
      if (!hasSupplementalZipUpload) {
        try {
          if (ocr.status) {
            existingStatus = ocr.status
          } else {
            const refreshResult = await withTimeout(
              ocr.refresh(),
              CONFIRM_STATUS_REFRESH_TIMEOUT_MS,
              STATUS_REFRESH_TIMED_OUT
            )
            if (refreshResult === STATUS_REFRESH_TIMED_OUT) {
              statusRefreshTimedOut = true
              existingStatus = ocr.status ?? null
            } else {
              existingStatus = refreshResult
            }
          }
        } catch {
          existingStatus = ocr.status ?? null
        }
      }
      if (statusRefreshTimedOut && existingSessionMode) {
        syncZipState("processing")
        toast.info(
          "Đang tải trạng thái metadata. Chuyển sang bước xử lý để theo dõi tiếp."
        )
        goTo(3)
        return
      }
      const existingDocumentCount = Math.max(
        existingStatus?.total_files ?? 0,
        existingStatus?.total_jobs ?? 0,
        existingStatus?.pagination?.total ?? 0,
        existingStatus?.jobs.length ?? 0
      )
      if (existingDocumentCount > 0) {
        const existingMode = documentNumberingModeValue(
          existingStatus?.document_numbering_mode
        )
        if (existingMode && existingMode !== documentNumberingMode) {
          toast.info(
            "Đã đổi cách đánh số. Metadata hiện có tiếp tục được sử dụng."
          )
        }
        if (!hasSupplementalZipUpload) {
          const hasReadyMetadata =
            (existingStatus?.metadata_ready_documents ?? 0) > 0 ||
            existingStatus?.jobs.some(
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
        documentNumberingStylePreset,
        documentNumberingStyleOverrides,
        sessionFileId: cache.zipUpload?.id,
        remoteFileId: cache.zipUpload?.remote_file_id ?? null,
        uploadMode:
          cache.zipUpload && !cache.zipUpload.ingestion_run
            ? uploadMode
            : undefined,
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

function withTimeout<T, F>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: F
): Promise<T | F> {
  let timeoutId: ReturnType<typeof window.setTimeout> | null = null
  const timeoutPromise = new Promise<F>((resolve) => {
    timeoutId = window.setTimeout(() => resolve(fallback), timeoutMs)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) window.clearTimeout(timeoutId)
  })
}
