import { toast } from "sonner"
import { activatePlanVersion } from "@/features/upload/api/sessionApi"
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

      if (cache.planDraftDirty) {
        toast.warning(
          "Bản draft hiện tại đang có thay đổi chưa lưu. Hãy lưu bản nháp trước khi duyệt."
        )
        return false
      }

      const targetPlanVersionId =
        cache.workingPlanStatus === "draft" && !draftMatchesActive
          ? cache.workingPlanVersionId.trim()
          : ""

      if (!targetPlanVersionId) {
        toast.info("Phương án hiện tại đã được duyệt.")
        cache.planViewTab = "active"
        if (typeof setPlanViewTab === "function") setPlanViewTab("active")
        return true
      }

      const activePlan = await activatePlanVersion(
        cache.sessionId,
        targetPlanVersionId,
        { created_by: "ui" }
      )
      applyActivePlanResponse?.(activePlan)
      applyWorkingPlanResponse?.(activePlan)
      cache.workingPlanStatus = "active"
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
