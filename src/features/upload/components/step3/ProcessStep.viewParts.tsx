import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/shared/lib/utils"
import { ProgressMetric } from "./ProcessStep.parts"

export function ProcessStepSummaryPanel({
  warningCount,
  pendingMetadataCount,
  metadataReloading,
  readyItems,
  readyCount,
  expectedCount,
  needsReviewItems,
  reviewedItems,
  reviewedCount,
  failedMetadataItems = [],
  failedCount,
  metadataMessage,
  metadataStartingMessage,
  signatureStatus,
  readyPercent,
  reviewedPercent,
  metadataStartingWithoutCount,
}: Record<string, any>) {
  const extractedCount = readyCount ?? readyItems.length
  const reviewedDocumentCount = reviewedCount ?? reviewedItems.length
  const failedDocumentCount = failedCount ?? failedMetadataItems.length
  const needsReviewDocumentCount = warningCount ?? needsReviewItems.length
  const autoVerifiedDocumentCount = Math.max(
    0,
    extractedCount - needsReviewDocumentCount - reviewedDocumentCount
  )
  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-sans text-2xl font-semibold tracking-normal text-foreground">
            Xử lý & lập hồ sơ
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Metadata được lấy từ backend. Sau khi metadata được xác nhận, màn
            hình sẽ chuyển sang kết quả lập hồ sơ.
          </p>
        </div>
        {warningCount > 0 && (
          <div className="shrink-0 text-right">
            <p className="font-roboto text-[11px] text-amber-600">
              Cần kiểm tra
            </p>
            <p className="text-xl font-bold text-amber-600">{warningCount}</p>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#D8E1EC] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-[#64748B] uppercase">
              Tiến độ metadata
            </p>
            <p className="mt-1 text-sm text-[#0F172A]">
              {metadataStartingWithoutCount
                ? metadataStartingMessage ||
                  "Đang chuẩn bị extract metadata. Đang chờ backend trả danh sách tài liệu."
                : failedDocumentCount > 0
                  ? `Có ${failedDocumentCount} tài liệu lỗi khi extract metadata. Đã extract ${extractedCount}/${expectedCount || "..."} tài liệu; có thể chạy lại từng tài liệu lỗi.`
                  : pendingMetadataCount > 0
                    ? `${
                        metadataReloading
                          ? "Đang extract lại metadata"
                          : "Đang extract metadata"
                      } cho ${pendingMetadataCount} tài liệu. Đã extract ${extractedCount}/${expectedCount || "..."} tài liệu.`
                    : extractedCount > 0
                      ? `Đã extract ${extractedCount}/${expectedCount} tài liệu; ${needsReviewDocumentCount} cần xem xét; ${autoVerifiedDocumentCount} tự động xác thực; ${reviewedDocumentCount} chuyên gia xác thực.`
                      : metadataMessage}
            </p>
            {(signatureStatus.pending > 0 || signatureStatus.failed > 0) && (
              <p className="mt-1 text-xs text-[#64748B]">
                Chữ ký: {signatureStatus.extracted} xong
                {signatureStatus.pending > 0
                  ? `, ${signatureStatus.pending} đang chờ`
                  : ""}
                {signatureStatus.failed > 0
                  ? `, ${signatureStatus.failed} lỗi`
                  : ""}
                .
              </p>
            )}
          </div>
          <div className="grid w-full grid-cols-2 gap-2 text-center sm:w-auto lg:grid-cols-6">
            <ProgressMetric label="Tài liệu" value={expectedCount} />
            <ProgressMetric label="Đang extract" value={pendingMetadataCount} />
            <ProgressMetric label="Lỗi" value={failedDocumentCount} />
            <ProgressMetric
              label="Cần xem xét"
              value={needsReviewDocumentCount}
            />
            <ProgressMetric
              label="Tự động xác thực"
              value={autoVerifiedDocumentCount}
            />
            <ProgressMetric
              label="Chuyên gia xác thực"
              value={reviewedDocumentCount}
            />
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#E2E8F0]">
          <motion.div
            className="h-full rounded-full bg-[#BFD3FF]"
            initial={false}
            animate={{ width: `${readyPercent}%` }}
            transition={{ duration: 0.35 }}
          />
          <motion.div
            className="-mt-2 h-full rounded-full bg-[#0052FF]"
            initial={false}
            animate={{ width: `${reviewedPercent}%` }}
            transition={{ duration: 0.35 }}
          />
        </div>
      </div>
    </>
  )
}

export function ProcessStepFooter({
  pendingReadyItems: pendingReadyPageItems,
  pendingReadyCount,
  dossierReadyItems: dossierReadyPageItems,
  dossierReadyCount,
  warningCount = 0,
  readyItems,
  metadataMessage,
  canContinue,
  buildBlockedMessage,
  onContinue,
}: Record<string, any>) {
  const pendingCount = pendingReadyCount ?? pendingReadyPageItems.length
  const readyForDossierCount = dossierReadyCount ?? dossierReadyPageItems.length
  const dossierReadyItems = { length: readyForDossierCount }
  const reviewWarningCount = Math.max(
    pendingCount,
    Number(warningCount) || 0
  )
  const showWarning = reviewWarningCount > 0
  const warningTone = Boolean(buildBlockedMessage) || showWarning

  return (
    <div className="sticky bottom-0 z-20 flex flex-col gap-3 border-t border-[#CBD5E1] bg-white/95 px-4 py-3 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur sm:flex-row sm:items-center sm:gap-5">
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        {warningTone ? (
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
        ) : readyItems.length > 0 ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
        ) : (
          <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-[#0052FF]" />
        )}
        <div className="min-w-0">
          <p
            className={cn(
              "text-sm font-semibold",
              warningTone ? "text-[#78350F]" : "text-[#0F172A]"
            )}
          >
            {buildBlockedMessage
              ? "Chưa thể lập hồ sơ"
              : showWarning
                ? `Còn ${reviewWarningCount} tài liệu chưa xác minh metadata`
                : readyItems.length > 0
                  ? "Sẵn sàng lập hồ sơ"
                  : metadataMessage}
          </p>
          {buildBlockedMessage ? (
            <p className="mt-0.5 text-xs leading-5 text-[#A16207]">
              {buildBlockedMessage}
            </p>
          ) : showWarning ? (
            <p className="mt-0.5 text-xs leading-5 text-[#A16207]">
              {dossierReadyItems.length > 0
                ? `${dossierReadyItems.length} tài liệu đã đủ điều kiện. Bạn vẫn có thể lập hồ sơ, nhưng nên xác minh trước để dữ liệu đầy đủ hơn.`
                : "Hãy xác minh metadata trước khi lập hồ sơ."}
            </p>
          ) : readyItems.length > 0 ? (
            <p className="mt-0.5 text-xs leading-5 text-[#64748B]">
              {dossierReadyItems.length} tài liệu đã đủ điều kiện.
            </p>
          ) : null}
        </div>
      </div>
      <button
        disabled={!canContinue}
        onClick={() => {
          if (!canContinue) return
          onContinue([])
        }}
        className={cn(
          "group flex w-full shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 sm:ml-auto sm:w-auto",
          canContinue
            ? "text-white hover:brightness-95 active:scale-[0.98]"
            : "cursor-not-allowed bg-[#CBD5E1] text-[#475569]"
        )}
        style={
          canContinue
              ? {
                  background: "linear-gradient(to right, #0052FF, #4D7CFF)",
                  boxShadow: "0 3px 10px rgba(0,82,255,0.2)",
                }
            : {}
        }
      >
        {canContinue
          ? `Lập hồ sơ (${dossierReadyItems.length} tài liệu)`
          : "Lập hồ sơ"}
      </button>
    </div>
  )
}
