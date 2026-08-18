import { ChevronDown, ChevronRight, ListChecks } from "lucide-react"
import type { ClusterDocumentWarning } from "@/features/upload/lib/clusterGroups"
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
    <div className="col-span-full overflow-hidden rounded-lg border border-[#BFD3FF] bg-[#F8FAFF] px-2.5 py-2 text-[#334155]">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={onToggle}
      >
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold">
          <ListChecks className="size-3.5 shrink-0 text-[#0052FF]" />
          <span className="truncate">Gợi ý rà soát hồ sơ</span>
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
            />
          ))}
        </div>
      )}
      {expanded && hasCloserWarning && (
        <div className="mt-2 border-t border-blue-200 pt-2">
          <p className="text-[11px] font-semibold text-[#334155]">
            Hồ sơ phù hợp hơn
          </p>
          <p className="mt-1 rounded-md bg-white/80 px-2 py-1 text-[11px] font-medium break-words text-[#0F172A]">
            {closerDossierTitle ||
              "Chưa xác định được tên hồ sơ phù hợp hơn từ dữ liệu đối chiếu."}
          </p>
          {representativeDocuments.length > 0 && (
            <>
              <p className="mt-2 text-[11px] font-semibold text-[#334155]">
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
                      className="min-w-0 border-t border-blue-100 pt-1 first:border-t-0 first:pt-0"
                    >
                      <p className="text-[11px] font-medium break-words text-[#0F172A]">
                        {document.fileName ||
                          document.documentId ||
                          "Tài liệu đại diện"}
                      </p>
                      {secondary.length > 0 && (
                        <p className="mt-0.5 line-clamp-2 text-[11px] break-words text-[#475569]">
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
            <p className="mt-2 rounded-md bg-white/60 px-2 py-1 text-[11px] text-[#475569]">
              Chưa có tài liệu đại diện của hồ sơ này trong dữ liệu đối chiếu.
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
}: {
  label: string
  value: string
}) {
  return (
    <div className="min-w-0 rounded-md bg-white/70 px-2 py-1">
      <span className="text-[#64748B]">{label}: </span>
      <span className="font-medium break-words text-[#0F172A]">{value}</span>
    </div>
  )
}
