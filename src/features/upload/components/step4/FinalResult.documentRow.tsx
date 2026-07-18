import { useState } from "react"
import { motion } from "framer-motion"
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Edit2,
  Eye,
  FileText,
  GripVertical,
  Loader2,
  ListChecks,
  Signature,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/shared/lib/utils"
import type { ClusterDocument } from "@/features/upload/lib/clusterGroups"
import { signatureTagInfo } from "@/features/upload/lib/signatureStatus"
import {
  METADATA_FIELDS,
  metadataEditorRows,
  metadataFieldText,
} from "@/features/upload/components/step3/metadataCardUtils"
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
import { pendingFeedbackActionLabel } from "./FinalResult.pendingFeedback"

const SHOW_DOSSIER_SUGGESTIONS_BUTTON = true

export function DocumentRow({
  document,
  clusterId,
  metadataFeedbackClusterId,
  depth,
  compact,
  selected,
  selectionChecked,
  selectionDisabled,
  selectedDossierSuggestions,
  onToggleSelection,
  onDragStart,
  onDragEnd,
  onSelectPreview,
  onSelectDossierSuggestions,
  onSaveMetadata,
}: {
  document: ClusterDocument
  clusterId: string
  metadataFeedbackClusterId: string
  depth: number
  compact: boolean
  selected: boolean
  selectionChecked: boolean
  selectionDisabled: boolean
  selectedDossierSuggestions: boolean
  onToggleSelection: (sessionDocumentId: number, checked: boolean) => void
  onDragStart: (document: ClusterDocument, fromClusterId: string) => void
  onDragEnd: () => void
  onSelectPreview: (document: ClusterDocument) => void
  onSelectDossierSuggestions: (document: ClusterDocument) => void
  onSaveMetadata: (
    document: ClusterDocument,
    clusterId: string,
    metadata: Record<string, unknown>
  ) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [showWarningDetails, setShowWarningDetails] = useState(true)
  const [dragging, setDragging] = useState(false)
  const [editingMetadata, setEditingMetadata] = useState(false)
  const [savingMetadata, setSavingMetadata] = useState(false)
  const [metadataDraft, setMetadataDraft] = useState<Record<string, string>>({})
  const clusterWarning = document.clusterWarning
  const summary = metadataText(document.metadata, [
    "document_summary",
    "trich_yeu_van_ban",
    "title",
    "long_summary",
  ])
  const issuedDate = metadataText(document.metadata, [
    "issued_date",
    "ngay_ban_hanh",
  ])
  const docType = metadataText(document.metadata, [
    "document_type",
    "loai_van_ban",
  ])
  const signatureTag = signatureTagInfo(document)
  const displaySummary = compact
    ? truncateWithDots(summary, 108)
    : truncateWithDots(summary, 190)
  const indentStep = compact ? 14 : 20

  const detailIndent = 8 + (depth + 1) * indentStep
  const toggleExpanded = () => {
    const nextExpanded = !expanded
    setExpanded(nextExpanded)
    setShowWarningDetails(nextExpanded)
    if (!nextExpanded) setEditingMetadata(false)
  }

  const startMetadataEdit = () => {
    const nextDraft: Record<string, string> = {}
    METADATA_FIELDS.forEach((field) => {
      nextDraft[field.key] = metadataFieldText(document.metadata, field.aliases)
    })
    setMetadataDraft(nextDraft)
    setEditingMetadata(true)
    setExpanded(true)
    setShowWarningDetails(true)
  }

  const cancelMetadataEdit = () => {
    setEditingMetadata(false)
    setMetadataDraft({})
  }

  const saveMetadataEdit = async () => {
    if (document.sessionDocumentId === null) return
    const updated: Record<string, unknown> = { ...document.metadata }
    METADATA_FIELDS.forEach((field) => {
      field.aliases.forEach((alias) => {
        if (alias !== field.key) delete updated[alias]
      })
      updated[field.key] = metadataDraft[field.key] ?? ""
    })
    updated["_warnings"] = {}
    setSavingMetadata(true)
    try {
      await onSaveMetadata(document, metadataFeedbackClusterId, updated)
      setEditingMetadata(false)
    } catch {
      // The parent action reports the failure and keeps the editor open for retry.
    } finally {
      setSavingMetadata(false)
    }
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
          "mr-1 flex max-w-full min-w-0 cursor-pointer items-start gap-2 overflow-hidden rounded-xl border border-transparent px-2 py-1.5 transition-colors active:cursor-grabbing",
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
            {document.pendingFeedback && (
              <span
                title="Feedback đã ghi nhận và đang chờ cập nhật hồ sơ"
                className="flex shrink-0 items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800"
              >
                {pendingFeedbackActionLabel(document.pendingFeedback.action)}
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
        {SHOW_DOSSIER_SUGGESTIONS_BUTTON && (
          <Button
            type="button"
            variant={selectedDossierSuggestions ? "default" : "outline"}
            size="icon-sm"
            draggable={false}
            title="Xem hồ sơ được gợi ý"
            aria-label="Xem hồ sơ được gợi ý"
            className="mt-0.5 shrink-0"
            onClick={(event) => {
              event.stopPropagation()
              onSelectDossierSuggestions(document)
            }}
            onDragStart={(event) => event.stopPropagation()}
          >
            <ListChecks className="size-3.5" />
          </Button>
        )}
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
            <div className="flex shrink-0 items-center gap-1">
              {editingMetadata ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    title="Hủy sửa metadata"
                    disabled={savingMetadata}
                    onClick={(event) => {
                      event.stopPropagation()
                      cancelMetadataEdit()
                    }}
                  >
                    <X className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    title="Lưu metadata"
                    disabled={savingMetadata}
                    onClick={(event) => {
                      event.stopPropagation()
                      void saveMetadataEdit()
                    }}
                  >
                    {savingMetadata ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Check className="size-3.5" />
                    )}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  title="Sửa metadata"
                  disabled={document.sessionDocumentId === null}
                  onClick={(event) => {
                    event.stopPropagation()
                    startMetadataEdit()
                  }}
                >
                  <Edit2 className="size-3.5" />
                </Button>
              )}
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
            <div
              className={cn(
                "grid min-w-0 grid-cols-1 gap-2",
                compact ? "md:grid-cols-2" : "md:grid-cols-3"
              )}
            >
              {METADATA_FIELDS.map((field) => (
                <EditablePreviewField
                  key={field.key}
                  label={field.label}
                  value={metadataFieldText(document.metadata, field.aliases)}
                  fieldKey={field.key}
                  draftValue={metadataDraft[field.key] ?? ""}
                  editing={editingMetadata}
                  saving={savingMetadata}
                  wide={field.key === "document_summary"}
                  onChange={(value) =>
                    setMetadataDraft((current) => ({
                      ...current,
                      [field.key]: value,
                    }))
                  }
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}

function EditablePreviewField({
  label,
  value,
  fieldKey,
  draftValue,
  editing,
  saving,
  icon,
  wide = false,
  onChange,
}: {
  label: string
  value: string
  fieldKey: (typeof METADATA_FIELDS)[number]["key"]
  draftValue: string
  editing: boolean
  saving: boolean
  icon?: React.ReactNode
  wide?: boolean
  onChange: (value: string) => void
}) {
  if (!editing) {
    return <PreviewField label={label} value={value} icon={icon} wide={wide} />
  }

  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-lg bg-[#F8FAFC] px-2.5 py-2",
        wide && "col-span-full"
      )}
    >
      <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold tracking-[0.08em] text-[#94A3B8] uppercase">
        {icon}
        {label}
      </p>
      <textarea
        value={draftValue}
        onChange={(event) => onChange(event.target.value)}
        rows={metadataEditorRows(fieldKey)}
        disabled={saving}
        className={cn(
          "w-full min-w-0 resize-y rounded-md border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs leading-5 font-medium [overflow-wrap:anywhere] whitespace-pre-wrap text-[#0F172A] transition-colors outline-none placeholder:text-[#94A3B8] focus-visible:border-[#0052FF] focus-visible:ring-3 focus-visible:ring-[#0052FF]/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:opacity-70",
          fieldKey === "document_summary" ? "min-h-24" : "min-h-16"
        )}
      />
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
