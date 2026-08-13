import { AlertCircle, RotateCcw } from "lucide-react"
import {
  planAnalysisFailureDomain,
  type PlanAnalysisFailure,
} from "@/pages/UploadPage.progress"

interface PlanAnalysisFailureAlertProps {
  failure: PlanAnalysisFailure
  onBackToUpload?: () => void
}

export function PlanAnalysisFailureAlert({
  failure,
  onBackToUpload,
}: PlanAnalysisFailureAlertProps) {
  const attemptLabel = planAnalysisAttemptLabel(failure)
  const isRetentionFailure = planAnalysisFailureDomain(failure) === "retention"

  return (
    <div
      role="alert"
      className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-950 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
          <AlertCircle className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold">
              {isRetentionFailure
                ? "Phân tích thời hạn bảo quản không thành công"
                : "Phân tích phương án phân loại không thành công"}
            </p>
            {attemptLabel && (
              <span className="rounded-full border border-red-200 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-red-700">
                {attemptLabel}
              </span>
            )}
          </div>
          <p className="mt-2 text-sm leading-6 text-red-900">
            {failure.message}
          </p>
          <p className="mt-2 text-xs leading-5 text-red-700">
            {isRetentionFailure
              ? "Hãy kiểm tra file thời hạn bảo quản, tải lại file phù hợp rồi thực hiện phân tích lại."
              : "Hãy kiểm tra hoặc rút gọn file phương án, tải lại file phù hợp rồi thực hiện phân tích lại."}
          </p>
          {onBackToUpload && (
            <button
              type="button"
              onClick={onBackToUpload}
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-red-300 bg-white px-3.5 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
            >
              <RotateCcw className="size-4" />
              Quay lại tải file
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function planAnalysisAttemptLabel(failure: PlanAnalysisFailure): string {
  if (failure.retryCount && failure.maxAttempts) {
    return `Đã thử ${failure.retryCount}/${failure.maxAttempts} lần`
  }
  if (failure.retryCount) return `Đã thử ${failure.retryCount} lần`
  return ""
}
