import { toast } from "sonner"
import {
  activatePlanVersion,
  getWorkingPlan,
} from "@/features/upload/api/sessionApi"
import { uploadPageCache as cache } from "./UploadPage.cache"

export function createConfirmPlanHandler(context: Record<string, any>) {
  const {
    confirmingPlan,
    applyWorkingPlanResponse,
    applyActivePlanResponse,
    setConfirmingPlan,
    setPlanViewTab,
  } = context

  return async function handleConfirmPlan(): Promise<boolean> {
    if (confirmingPlan) return false
    if (!cache.sessionId) {
      toast.error("Chưa có session xử lý.")
      return false
    }
    if (cache.folderTree.length === 0) {
      toast.error("Vui lòng thêm ít nhất một thư mục.")
      return false
    }

    setConfirmingPlan(true)
    try {
      const draftMatchesActive =
        Boolean(cache.activePlanSignature) &&
        Boolean(cache.workingPlanSignature) &&
        cache.workingPlanSignature === cache.activePlanSignature
      const activePlanVersionId = cache.activePlanVersionId.trim()
      const workingPlanVersionId = cache.workingPlanVersionId.trim()
      const hasLoadedActivePlan =
        Boolean(activePlanVersionId) &&
        cache.activePlanResponse?.id === activePlanVersionId

      if (cache.planDraftDirty) {
        toast.warning(
          "Bản draft hiện tại đang có thay đổi chưa lưu. Hãy lưu bản nháp trước khi duyệt."
        )
        return false
      }

      const workingPlanIsActive =
        hasLoadedActivePlan && workingPlanVersionId === activePlanVersionId
      if (
        hasLoadedActivePlan &&
        (!workingPlanVersionId || workingPlanIsActive || draftMatchesActive)
      ) {
        toast.info("Phương án hiện tại đã được duyệt.")
        cache.planViewTab = "active"
        if (typeof setPlanViewTab === "function") setPlanViewTab("active")
        return true
      }

      if (!workingPlanVersionId) {
        toast.error(
          "Không tìm thấy phiên bản phương án để duyệt. Hãy tải lại session hoặc phân tích lại phương án."
        )
        return false
      }

      const activePlan = await activatePlanVersion(
        cache.sessionId,
        workingPlanVersionId,
        { created_by: "ui" }
      )
      applyActivePlanResponse?.(activePlan)
      // Activation creates a fresh editable draft baseline. Load it explicitly
      // instead of treating the newly-active response as working state.
      try {
        const baselineDraft = await getWorkingPlan(cache.sessionId)
        if (baselineDraft?.status === "draft") {
          applyWorkingPlanResponse?.(baselineDraft)
        } else {
          toast.warning(
            "Đã duyệt phương án, nhưng chưa tải được bản draft mới. Hãy tải lại session để tiếp tục chỉnh sửa."
          )
        }
      } catch {
        toast.warning(
          "Đã duyệt phương án, nhưng chưa tải được bản draft mới. Hãy tải lại session để tiếp tục chỉnh sửa."
        )
      }
      cache.planViewTab = "active"
      if (typeof setPlanViewTab === "function") setPlanViewTab("active")
      toast.success("Đã xác nhận phương án phân loại.")
      return true
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Không thể xác nhận phương án phân loại."
      )
      return false
    } finally {
      setConfirmingPlan(false)
    }
  }
}
