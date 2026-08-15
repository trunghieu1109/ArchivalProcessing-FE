import { ArrowRight, Check, Loader2, Save } from "lucide-react"
import { toast } from "sonner"
import { WorkflowActionPanel } from "@/features/upload/components/WorkflowActionPanel"

interface PlanReviewActionsProps {
  readOnly?: boolean
  treeLength: number
  onSaveDraft?: () => void | Promise<void>
  onConfirm: () => void | Promise<void>
  onContinueToMetadata?: () => void | Promise<void>
  savingDraft?: boolean
  confirming?: boolean
  planDraftDirty?: boolean
  hasRetentionSchedule?: boolean
}

export function PlanReviewActions({
  readOnly = false,
  treeLength,
  onSaveDraft,
  onConfirm,
  onContinueToMetadata,
  savingDraft = false,
  confirming = false,
  planDraftDirty = false,
  hasRetentionSchedule = false,
}: PlanReviewActionsProps) {
  const handleConfirm = () => {
    if (confirming || savingDraft) return
    if (planDraftDirty) {
      toast.warning("Hãy lưu bản nháp trước khi xác nhận phương án.")
      return
    }
    if (treeLength === 0) {
      toast.error("Vui lòng thêm ít nhất một thư mục.")
      return
    }
    void onConfirm()
  }

  const handleSaveDraft = () => {
    if (savingDraft || !planDraftDirty) return
    void onSaveDraft?.()
  }

  return (
    <WorkflowActionPanel>
      <div className="flex flex-col gap-2 px-4 py-3.5 sm:px-5">
        {!readOnly && hasRetentionSchedule && (
          <p className="text-xs text-[#64748B]">
            Khi duyệt phương án, kết quả thời hạn bảo quản hiện có cũng được ghi
            nhận cùng phiên bản.
          </p>
        )}
        <div className="flex flex-col justify-stretch gap-3 sm:flex-row sm:justify-between">
          {!readOnly && onSaveDraft && (
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={savingDraft || !planDraftDirty}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-5 text-sm font-semibold text-[#0F172A] shadow-sm transition-all hover:border-[#0052FF]/30 hover:text-[#0052FF] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {savingDraft ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Lưu bản nháp
            </button>
          )}
          {!readOnly && (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={confirming || savingDraft || planDraftDirty}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:mr-auto sm:w-auto"
              style={{
                background: "linear-gradient(to right, #0052FF, #4D7CFF)",
                boxShadow: "0 4px 14px rgba(0,82,255,0.25)",
              }}
            >
              <Check className="size-4" /> Duyệt phương án
            </button>
          )}
          {onContinueToMetadata && (
            <button
              type="button"
              onClick={() => void onContinueToMetadata()}
              disabled={confirming || savingDraft}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-5 text-sm font-semibold text-[#0F172A] shadow-sm transition-all hover:border-[#0052FF]/30 hover:text-[#0052FF] disabled:cursor-wait disabled:opacity-70 sm:ml-auto sm:w-auto"
            >
              <ArrowRight className="size-4" /> Sang extract metadata
            </button>
          )}
        </div>
      </div>
    </WorkflowActionPanel>
  )
}
