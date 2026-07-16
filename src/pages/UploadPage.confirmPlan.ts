import { toast } from "sonner"
import {
  approveReviewPlan,
  getActivePlan,
} from "@/features/upload/api/sessionApi"
import { uploadPageCache as cache } from "./UploadPage.cache"
import {
  activePlanDocumentNumberingMode,
  activePlanDocumentNumberingStyleOverrides,
  activePlanDocumentNumberingStylePreset,
  documentNumberingModeValue,
} from "./UploadPage.planUtils"

const STATUS_REFRESH_TIMEOUT_MS = 3_000
const STATUS_REFRESH_TIMED_OUT = Symbol("status-refresh-timeout")

export function createApprovePlanHandler(context: Record<string, any>) {
  const {
    confirmingPlan,
    savePendingReviewChanges,
    applyActivePlanResponse,
    setConfirmingPlan,
  } = context

  return async function handleApprovePlan() {
    if (confirmingPlan) return
    if (!cache.sessionId) {
      toast.error("Chưa có session xử lý.")
      return
    }

    setConfirmingPlan(true)
    try {
      await savePendingReviewChanges()
      const reviewPlanVersionId = cache.reviewPlanVersionId.trim()
      if (!reviewPlanVersionId) {
        toast.error("Chưa có phiên bản phương án để duyệt.")
        return
      }
      const approvedPlan = await approveReviewPlan(
        cache.sessionId,
        reviewPlanVersionId
      )
      applyActivePlanResponse(approvedPlan)
      toast.success("Đã duyệt phương án phân loại hiện tại.")
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Không thể duyệt phương án phân loại."
      )
    } finally {
      setConfirmingPlan(false)
    }
  }
}

export function createStartMetadataExtractionHandler(
  context: Record<string, any>
) {
  const {
    confirmingPlan,
    zipFolderPath,
    existingSessionMode,
    uploadMode,
    zipSupplementUploaded,
    ocr,
    savePendingReviewChanges,
    applyActivePlanResponse,
    parseZipMaxFiles,
    syncZipState,
    goTo,
    setConfirmingPlan,
    setZipSupplementUploaded,
  } = context

  return async function handleStartMetadataExtraction() {
    if (confirmingPlan) return
    if (!cache.sessionId) {
      toast.error("Chưa có session xử lý.")
      return
    }

    setConfirmingPlan(true)
    let folderPath = ""
    let maxFilesToProcess: number | undefined
    let existingStatus = ocr.status
    let statusRefreshTimedOut = false
    let activePlan = cache.activePlanResponse
    try {
      await savePendingReviewChanges()

      const activePlanVersionId = cache.activePlanVersionId.trim()
      if (!activePlanVersionId) {
        toast.error("Chưa có phương án phân loại được duyệt.")
        return
      }
      if (!activePlan || activePlan.id !== activePlanVersionId) {
        activePlan = await getActivePlan(cache.sessionId)
        if (activePlan) applyActivePlanResponse(activePlan)
      }
      if (!activePlan || activePlan.id !== activePlanVersionId) {
        toast.error("Không tải được phương án phân loại đang active.")
        return
      }

      folderPath =
        zipFolderPath ||
        cache.zipUpload?.folder_path ||
        cache.zipUpload?.data_path ||
        ""
      if (!folderPath) {
        if (existingSessionMode) {
          toast.info("Session này chưa có dữ liệu ZIP mới để extract metadata.")
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
              STATUS_REFRESH_TIMEOUT_MS,
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
        const activeNumberingMode = activePlanDocumentNumberingMode(activePlan)
        const existingMode = documentNumberingModeValue(
          existingStatus?.document_numbering_mode
        )
        if (existingMode && existingMode !== activeNumberingMode) {
          toast.info(
            "Phương án active dùng cách đánh số khác. Metadata hiện có tiếp tục được sử dụng."
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
          : "Không thể chuyển sang extract metadata."
      )
      return
    } finally {
      setConfirmingPlan(false)
    }

    if (!activePlan) return
    if (cache.zipUpload && uploadMode === "overwrite") {
      const confirmed = window.confirm(
        "Bạn đã chọn overwrite. Các PDF trùng đường dẫn trong ZIP bổ sung sẽ ghi đè file đang có và metadata/review của các file đó sẽ được extract lại. Tiếp tục?"
      )
      if (!confirmed) return
    }

    const activePlanVersionId = cache.activePlanVersionId.trim()
    const activeNumberingMode = activePlanDocumentNumberingMode(activePlan)
    const activeNumberingStylePreset =
      activePlanDocumentNumberingStylePreset(activePlan)
    const activeNumberingStyleOverrides =
      activePlanDocumentNumberingStyleOverrides(activePlan)
    syncZipState("processing")
    toast.success("Bắt đầu lấy metadata bằng phương án đã duyệt.")
    void ocr
      .start(folderPath, {
        maxFiles: maxFilesToProcess,
        confirmedPlanVersionId: activePlanVersionId,
        documentNumberingMode: activeNumberingMode,
        documentNumberingStylePreset: activeNumberingStylePreset,
        documentNumberingStyleOverrides: activeNumberingStyleOverrides,
        sessionFileId: cache.zipUpload?.id,
        remoteFileId: cache.zipUpload?.remote_file_id ?? null,
        uploadMode:
          cache.zipUpload && !cache.zipUpload.ingestion_run
            ? uploadMode
            : undefined,
        force: false,
        reextract: zipSupplementUploaded,
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
