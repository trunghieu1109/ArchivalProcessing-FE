import {
  AlertTriangle,
  ArrowRightLeft,
  CalendarDays,
  Signature,
} from "lucide-react"
import type { ClusterDocument } from "@/features/upload/lib/clusterGroups"
import { signatureTagInfo } from "@/features/upload/lib/signatureStatus"
import { cn } from "@/shared/lib/utils"
import { metadataText, signatureTagClass } from "./FinalResult.metadataUtils"
import { pendingFeedbackActionLabel } from "./FinalResult.pendingFeedback"
import {
  clusterWarningLevelClass,
  clusterWarningLevelLabel,
  clusterWarningTooltip,
} from "./FinalResult.warningUtils"

export function DocumentStatusTags({
  document,
  compact,
}: {
  document: ClusterDocument
  compact: boolean
}) {
  const issuedDate = metadataText(document.metadata, [
    "issued_date",
    "ngay_ban_hanh",
  ])
  const signatureTag = signatureTagInfo(document)
  const clusterWarning = document.clusterWarning
  const movedFromWarning = Boolean(
    clusterWarning && document.pendingFeedback?.action === "manual_move"
  )

  return (
    <>
      {issuedDate ? (
        <span
          className={cn(
            "flex shrink-0 items-center gap-1 text-[10px] text-[#64748B]",
            compact && "hidden"
          )}
        >
          <CalendarDays className="size-3" /> {issuedDate}
        </span>
      ) : null}
      {signatureTag ? (
        <span
          title={signatureTag.title}
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
            signatureTagClass(signatureTag.kind)
          )}
        >
          <Signature className="size-3" />
          <span className={cn("max-w-24 truncate", compact && "max-w-20")}>
            {signatureTag.label}
          </span>
        </span>
      ) : null}
      {movedFromWarning ? (
        <span
          title="Tài liệu đã được chuyển sang hồ sơ mới theo gợi ý và đang chờ cập nhật hồ sơ"
          className="flex shrink-0 items-center gap-1 rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-800"
        >
          <ArrowRightLeft className="size-3" />
          <span className={cn("max-w-36 truncate", compact && "max-w-28")}>
            Đã chuyển theo gợi ý
          </span>
        </span>
      ) : document.pendingFeedback ? (
        <span
          title="Feedback đã ghi nhận và đang chờ cập nhật hồ sơ"
          className="flex shrink-0 items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800"
        >
          {pendingFeedbackActionLabel(document.pendingFeedback.action)}
        </span>
      ) : null}
      {clusterWarning ? (
        <span
          title={clusterWarningTooltip(clusterWarning)}
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
            clusterWarningLevelClass(clusterWarning.riskLevel)
          )}
        >
          <AlertTriangle className="size-3" />
          <span
            className={cn("max-w-28 truncate", compact && "hidden 2xl:inline")}
          >
            {clusterWarningLevelLabel(clusterWarning.riskLevel)}
          </span>
        </span>
      ) : null}
    </>
  )
}
