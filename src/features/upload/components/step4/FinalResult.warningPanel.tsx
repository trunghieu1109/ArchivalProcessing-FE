import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ListChecks,
} from "lucide-react"
import type { ClusterDocumentWarning } from "@/features/upload/lib/clusterGroups"
import { cn } from "@/shared/lib/utils"
import {
  clusterWarningHasCloserReason,
  clusterWarningMessages,
} from "./FinalResult.warningUtils"

export function ClusterWarningPanel({
  warning,
  expanded,
  onToggle,
}: {
  warning: ClusterDocumentWarning
  expanded: boolean
  onToggle: () => void
}) {
  const messages = clusterWarningMessages(warning)
  const hasCloserWarning = clusterWarningHasCloserReason(warning, messages)
  const hasTemporalWarning = warning.reasons.includes("temporal_outlier")
  const requiresAttention = warning.riskLevel.trim().toLowerCase() === "high"
  const StatusIcon = requiresAttention ? AlertTriangle : ListChecks
  const closerDossierTitle = warning.nearestOtherDossierTitle.trim()
  const representativeDocuments = warning.nearestOtherRepresentativeDocuments
    .length
    ? warning.nearestOtherRepresentativeDocuments
    : warning.nearestOtherRepresentativeFileName
      ? [
          {
            documentId: warning.nearestOtherClusterRepresentativeId,
            fileName: warning.nearestOtherRepresentativeFileName,
            title: warning.nearestOtherRepresentativeTitle,
            documentSummary: "",
            documentType: "",
            issuedDate: "",
          },
        ]
      : []
  const detailRows = [
    {
      label: "Hồ sơ hiện tại",
      value: warning.currentDossierTitle,
    },
    {
      label: "Thời gian của tài liệu",
      value: hasTemporalWarning
        ? warning.documentIssuedDate || warning.documentYear
        : "",
    },
    {
      label: "Thời gian chung của hồ sơ",
      value:
        hasTemporalWarning && warning.dominantClusterYear
          ? `Năm ${warning.dominantClusterYear}`
          : hasTemporalWarning
            ? warning.currentDossierDateRange
            : "",
    },
  ].filter((item) => item.value)

  return (
    <div
      className={cn(
        "col-span-full overflow-hidden rounded-lg border px-2.5 py-2",
        requiresAttention
          ? "border-amber-300 bg-amber-50 text-amber-900"
          : "border-[#BFD3FF] bg-[#F8FAFF] text-[#334155]"
      )}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={onToggle}
      >
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold">
          <StatusIcon className="size-3.5 shrink-0" />
          <span className="truncate">
            {requiresAttention ? "Cảnh báo hồ sơ" : "Gợi ý rà soát hồ sơ"}
          </span>
        </span>
        {expanded ? (
          <ChevronDown className="size-3.5 shrink-0" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0" />
        )}
      </button>
      <div className="mt-1 space-y-0.5 text-[11px] leading-4">
        {messages.map((message, index) => (
          <p key={`${message}-${index}`}>{message}</p>
        ))}
      </div>
      {expanded && detailRows.length > 0 && (
        <div className="mt-2 grid gap-1.5 text-[11px] sm:grid-cols-2">
          {detailRows.map((row) => (
            <WarningDetail
              key={row.label}
              label={row.label}
              value={row.value}
              requiresAttention={requiresAttention}
            />
          ))}
        </div>
      )}
      {expanded && hasCloserWarning && (
        <div
          className={cn(
            "mt-2 border-t pt-2",
            requiresAttention ? "border-amber-200" : "border-blue-200"
          )}
        >
          <p
            className={cn(
              "text-[11px] font-semibold",
              requiresAttention ? "text-amber-900" : "text-[#334155]"
            )}
          >
            Hồ sơ phù hợp hơn
          </p>
          <p
            className={cn(
              "mt-1 rounded-md bg-white/70 px-2 py-1 text-[11px] font-medium break-words",
              requiresAttention ? "text-amber-950" : "text-[#1E3A8A]"
            )}
          >
            {closerDossierTitle ||
              "Chưa xác định được tên hồ sơ phù hợp hơn từ dữ liệu cảnh báo."}
          </p>
          {representativeDocuments.length > 0 && (
            <>
              <p
                className={cn(
                  "mt-2 text-[11px] font-semibold",
                  requiresAttention ? "text-amber-900" : "text-[#334155]"
                )}
              >
                Tài liệu đại diện để đối chiếu
              </p>
              <div className="mt-1 grid gap-1.5">
                {representativeDocuments.map((document, index) => {
                  const secondary = [
                    document.documentType,
                    document.issuedDate,
                    document.title || document.documentSummary,
                  ].filter(Boolean)
                  return (
                    <div
                      key={
                        document.documentId || `${document.fileName}-${index}`
                      }
                      className={cn(
                        "min-w-0 border-t pt-1 first:border-t-0 first:pt-0",
                        requiresAttention
                          ? "border-amber-100"
                          : "border-blue-100"
                      )}
                    >
                      <p
                        className={cn(
                          "text-[11px] font-medium break-words",
                          requiresAttention
                            ? "text-amber-950"
                            : "text-[#1E3A8A]"
                        )}
                      >
                        {document.fileName ||
                          document.documentId ||
                          "Tài liệu đại diện"}
                      </p>
                      {secondary.length > 0 && (
                        <p
                          className={cn(
                            "mt-0.5 line-clamp-2 text-[11px] break-words",
                            requiresAttention
                              ? "text-amber-800"
                              : "text-[#475569]"
                          )}
                        >
                          {secondary.join(" · ")}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
          {representativeDocuments.length === 0 && (
            <p
              className={cn(
                "mt-2 rounded-md bg-white/50 px-2 py-1 text-[11px]",
                requiresAttention ? "text-amber-800" : "text-[#64748B]"
              )}
            >
              Chưa có tài liệu đại diện của hồ sơ này trong dữ liệu cảnh báo.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export function WarningDetail({
  label,
  value,
  requiresAttention,
}: {
  label: string
  value: string
  requiresAttention: boolean
}) {
  return (
    <div className="min-w-0 rounded-md bg-white/70 px-2 py-1">
      <span className={requiresAttention ? "text-amber-700" : "text-[#64748B]"}>
        {label}:{" "}
      </span>
      <span
        className={cn(
          "font-medium break-words",
          requiresAttention ? "text-amber-950" : "text-[#1E3A8A]"
        )}
      >
        {value}
      </span>
    </div>
  )
}
