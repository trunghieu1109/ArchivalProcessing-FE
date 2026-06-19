import { useState } from "react"
import { motion } from "framer-motion"
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
  GripVertical,
  Signature,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/shared/lib/utils"
import type { ClusterDocument } from "@/features/upload/lib/clusterGroups"
import { signatureTagInfo } from "@/features/upload/lib/signatureStatus"
import { ClusterWarningPanel } from "./FinalResult.warningPanel"
import { SelectionCheckbox } from "./FinalResult.selection"
import {
  clusterWarningLevelClass,
  clusterWarningLevelLabel,
  clusterWarningTooltip,
} from "./FinalResult.warningUtils"
import { PreviewField } from "./FinalResult.sidePanel"
import {
  metadataText,
  signatureTagClass,
  truncateWithDots,
} from "./FinalResult.metadataUtils"

export function DocumentRow({
  document,
  clusterId,
  depth,
  compact,
  selected,
  selectionChecked,
  selectionDisabled,
  onToggleSelection,
  onDragStart,
  onDragEnd,
  onSelectPreview,
}: {
  document: ClusterDocument
  clusterId: string
  depth: number
  compact: boolean
  selected: boolean
  selectionChecked: boolean
  selectionDisabled: boolean
  onToggleSelection: (sessionDocumentId: number, checked: boolean) => void
  onDragStart: (document: ClusterDocument, fromClusterId: string) => void
  onDragEnd: () => void
  onSelectPreview: (document: ClusterDocument) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [showWarningDetails, setShowWarningDetails] = useState(true)
  const [dragging, setDragging] = useState(false)
  const clusterWarning = document.clusterWarning
  const summary = metadataText(document.metadata, [
    "document_summary",
    "trich_yeu_van_ban",
    "title",
    "long_summary",
  ])
  const agency = metadataText(document.metadata, [
    "issuing_agency",
    "co_quan_ban_hanh",
  ])
  const issuedDate = metadataText(document.metadata, [
    "issued_date",
    "ngay_ban_hanh",
  ])
  const docType = metadataText(document.metadata, [
    "document_type",
    "loai_van_ban",
  ])
  const documentNumber = metadataText(document.metadata, [
    "document_number",
    "so_ky_hieu",
  ])
  const signer = metadataText(document.metadata, [
    "signer",
    "signer_name",
    "nguoi_ky",
    "nguoi ky",
    "nguoi_ki",
    "nguoi_ky_ten",
    "ten_nguoi_ky",
  ])
  const signatureTag = signatureTagInfo(document)
  const displaySummary = compact
    ? truncateWithDots(summary, 108)
    : truncateWithDots(summary, 190)
  const metadataSummary = compact ? truncateWithDots(summary, 260) : summary
  const indentStep = compact ? 14 : 20

  const detailIndent = 8 + (depth + 1) * indentStep
  const toggleExpanded = () => {
    const nextExpanded = !expanded
    setExpanded(nextExpanded)
    setShowWarningDetails(nextExpanded)
  }

  return (
    <div className="max-w-full min-w-0 overflow-hidden">
      <div
        draggable
        onClick={() => {
          if (!dragging) {
            toggleExpanded()
          }
        }}
        onDragStart={() => {
          setDragging(true)
          onDragStart(document, clusterId)
        }}
        onDragEnd={() => {
          onDragEnd()
          window.setTimeout(() => setDragging(false), 0)
        }}
        className={cn(
          "mr-1 flex max-w-full min-w-0 cursor-pointer items-start gap-2 overflow-hidden rounded-xl px-2 py-1.5 transition-colors active:cursor-grabbing",
          selected
            ? "bg-[#EAF1FF] ring-1 ring-[#0052FF]/30"
            : expanded
              ? "bg-[#F8FAFC]"
              : "hover:bg-[#F8FAFC]"
        )}
        style={{ paddingLeft: `${8 + depth * indentStep}px` }}
        title="Nhấn để xem chi tiết tài liệu"
      >
        <GripVertical className="mt-1.5 size-3 shrink-0 cursor-grab text-[#94A3B8]" />
        <SelectionCheckbox
          checked={selectionChecked}
          disabled={selectionDisabled}
          ariaLabel={`Chọn tài liệu ${document.fileName}`}
          title="Chọn tài liệu để tạo hồ sơ mới"
          onChange={(checked) => {
            if (document.sessionDocumentId !== null) {
              onToggleSelection(document.sessionDocumentId, checked)
            }
          }}
        />
        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#0052FF] shadow-[0_4px_12px_rgba(0,82,255,0.24)]">
          <FileText className="size-3.5 text-white" />
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 items-center gap-2 overflow-hidden">
            <span className="min-w-0 flex-1 truncate font-roboto text-xs font-medium text-[#334155]">
              {document.fileName}
            </span>
            {docType && (
              <span
                className={cn(
                  "shrink-0 rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[10px] font-medium text-[#475569]",
                  compact && "max-w-24 truncate"
                )}
              >
                {docType}
              </span>
            )}
            {issuedDate && (
              <span
                className={cn(
                  "flex shrink-0 items-center gap-1 text-[10px] text-[#64748B]",
                  compact && "hidden"
                )}
              >
                <CalendarDays className="size-3" /> {issuedDate}
              </span>
            )}
            {signatureTag && (
              <span
                title={signatureTag.title}
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                  signatureTagClass(signatureTag.kind)
                )}
              >
                <Signature className="size-3" />
                <span
                  className={cn("max-w-24 truncate", compact && "max-w-20")}
                >
                  {signatureTag.label}
                </span>
              </span>
            )}
            {clusterWarning && (
              <span
                title={clusterWarningTooltip(clusterWarning)}
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                  clusterWarningLevelClass(clusterWarning.riskLevel)
                )}
              >
                <AlertTriangle className="size-3" />
                <span
                  className={cn(
                    "max-w-28 truncate",
                    compact && "hidden 2xl:inline"
                  )}
                >
                  {clusterWarningLevelLabel(clusterWarning.riskLevel)}
                </span>
              </span>
            )}
            {expanded ? (
              <ChevronDown className="ml-auto size-3.5 shrink-0 text-[#64748B]" />
            ) : (
              <ChevronRight className="ml-auto size-3.5 shrink-0 text-[#94A3B8]" />
            )}
          </div>
          {displaySummary && (
            <p
              className={cn(
                "mt-0.5 text-xs text-[#64748B]",
                compact
                  ? "line-clamp-2 leading-4 break-words whitespace-normal"
                  : "truncate"
              )}
              title={summary}
            >
              {displaySummary}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant={expanded ? "default" : "outline"}
          size="icon-sm"
          draggable={false}
          title="Xem metadata"
          className="mt-0.5 shrink-0"
          onClick={(event) => {
            event.stopPropagation()
            toggleExpanded()
          }}
          onDragStart={(event) => event.stopPropagation()}
        >
          <FileText className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant={selected ? "default" : "outline"}
          size="icon-sm"
          draggable={false}
          title="Preview PDF"
          className="mt-0.5 shrink-0"
          onClick={(event) => {
            event.stopPropagation()
            onSelectPreview(document)
          }}
          onDragStart={(event) => event.stopPropagation()}
        >
          <Eye className="size-3.5" />
        </Button>
      </div>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16 }}
          className="mt-1 mr-3 min-w-0 overflow-hidden rounded-2xl border border-[#D8E1EC] bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
          style={{
            marginLeft: `${detailIndent}px`,
            width: `calc(100% - ${detailIndent + 12}px)`,
          }}
        >
          <div className="mb-3 flex items-start gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#EAF1FF] text-[#0052FF]">
              <FileText className="size-4" />
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="truncate text-sm font-semibold text-[#0F172A]">
                {document.fileName}
              </p>
              <p className="truncate text-[11px] text-[#64748B]">
                {document.filePath}
              </p>
            </div>
          </div>
          <div className="grid min-w-0 gap-2 text-xs">
            {clusterWarning && (
              <ClusterWarningPanel
                warning={clusterWarning}
                expanded={showWarningDetails}
                onToggle={() => setShowWarningDetails((value) => !value)}
              />
            )}
            <PreviewField label="Trích yếu" value={metadataSummary} wide />
            <div
              className={cn(
                "grid min-w-0 grid-cols-1 gap-2",
                compact ? "md:grid-cols-2" : "md:grid-cols-3"
              )}
            >
              <PreviewField label="Cơ quan ban hành" value={agency} />
              <PreviewField label="Ngày ban hành" value={issuedDate} />
              <PreviewField label="Loại văn bản" value={docType} />
              <PreviewField label="Số hiệu" value={documentNumber} />
              <PreviewField
                label="Người ký"
                value={signer}
                icon={<Signature className="size-3" />}
              />
              <PreviewField
                label="Số trang"
                value={String(document.pageCount ?? "")}
              />
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}

export function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-h-16 min-w-0 flex-col justify-center rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-center shadow-sm">
      <p className="font-roboto text-[10px] font-semibold tracking-[0.12em] text-[#64748B] uppercase">
        {label}
      </p>
      <p className="font-roboto text-xl leading-6 font-semibold text-[#0F172A] tabular-nums">
        {value}
      </p>
    </div>
  )
}

export function CountBadge({ value }: { value: number }) {
  if (value <= 0) return null
  return (
    <span className="flex min-w-6 shrink-0 justify-center rounded-full bg-[#EAF1FF] px-2 py-0.5 font-roboto text-[10px] font-bold text-[#0052FF]">
      {value}
    </span>
  )
}
