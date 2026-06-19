import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Check, Edit2, FolderOpen, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/shared/lib/utils"
import type { ClusterGroup } from "@/features/upload/lib/clusterGroups"
import {
  DOSSIER_METADATA_EDIT_FIELDS,
  createDossierMetadataDraft,
  type DossierMetadataDraft,
} from "./FinalResult.metadataUtils"

export function DossierMetadataSidePanel({
  group,
  saving,
  className,
  onSave,
  onClose,
}: {
  group: ClusterGroup
  saving: boolean
  className?: string
  onSave: (group: ClusterGroup, draft: DossierMetadataDraft) => Promise<void>
  onClose: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<DossierMetadataDraft>(() =>
    createDossierMetadataDraft(group)
  )
  const groupKey = group.dossierId ?? group.id
  const metadataFields: Array<{
    label: string
    value: string
    wide?: boolean
  }> = [
    { label: "Tên kho lưu trữ", value: group.archiveName ?? "" },
    { label: "Tên phông", value: group.fondsName ?? "" },
    { label: "Mục lục số", value: group.inventoryNumber ?? "" },
    { label: "Hộp số", value: group.boxNumber ?? "" },
    { label: "Hồ sơ số", value: group.dossierNumber ?? "" },
    { label: "Ký hiệu thông tin", value: group.informationSign ?? "" },
    { label: "Tiêu đề hồ sơ", value: group.label, wide: true },
    { label: "Chú giải", value: group.annotation ?? "", wide: true },
    { label: "Thời gian bắt đầu", value: group.startDate ?? "" },
    { label: "Thời gian kết thúc", value: group.endDate ?? "" },
    { label: "Ngôn ngữ", value: group.language ?? "" },
    {
      label: "Số lượng tờ",
      value:
        typeof group.sheetCount === "number" ? String(group.sheetCount) : "",
    },
    { label: "Thời hạn bảo quản", value: group.retentionPeriod ?? "" },
    { label: "Chế độ sử dụng", value: group.usageMode ?? "" },
    {
      label: "Tình trạng vật lý",
      value: group.physicalCondition ?? "",
      wide: true,
    },
    { label: "Ghi chú", value: group.note ?? "", wide: true },
  ]

  useEffect(() => {
    setDraft(createDossierMetadataDraft(group))
    setEditing(false)
  }, [groupKey])

  useEffect(() => {
    if (!editing) setDraft(createDossierMetadataDraft(group))
  }, [editing, group])

  const startEdit = () => {
    setDraft(createDossierMetadataDraft(group))
    setEditing(true)
  }

  const cancelEdit = () => {
    setDraft(createDossierMetadataDraft(group))
    setEditing(false)
  }

  const saveMetadata = async () => {
    try {
      await onSave(group, draft)
      setEditing(false)
    } catch {
      // The parent handler owns user-facing error messages.
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.16 }}
      className={cn(
        "flex min-h-[360px] min-w-0 flex-col overflow-hidden rounded-2xl border border-[#D8E1EC] bg-white shadow-sm sm:min-h-[520px]",
        className
      )}
    >
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#EAF1FF] text-[#0052FF]">
            <FolderOpen className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#0F172A]">
              Metadata hồ sơ
            </p>
            <p className="truncate text-[11px] text-[#64748B]">{group.label}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {editing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={cancelEdit}
                disabled={saving}
              >
                Hủy
              </Button>
              <Button
                size="sm"
                onClick={() => void saveMetadata()}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                ) : (
                  <Check data-icon="inline-start" />
                )}
                Lưu metadata
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={startEdit}
              disabled={saving}
            >
              <Edit2 data-icon="inline-start" /> Sửa
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title="Đóng metadata"
            onClick={onClose}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#F8FAFC] p-3">
        {editing ? (
          <div className="flex flex-col gap-2 rounded-xl bg-white p-3">
            {DOSSIER_METADATA_EDIT_FIELDS.map((field) => (
              <div
                key={field.key}
                className="grid min-w-0 grid-cols-1 gap-1 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-2"
              >
                <span className="pt-2 text-[11px] font-medium text-[#64748B]">
                  {field.label}
                </span>
                <textarea
                  value={draft[field.key]}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))
                  }
                  rows={field.rows}
                  disabled={saving}
                  className="min-h-9 w-full min-w-0 resize-y rounded-lg border border-[#CBD5E1] bg-transparent px-2.5 py-1.5 text-xs leading-5 [overflow-wrap:anywhere] whitespace-pre-wrap transition-colors outline-none placeholder:text-[#94A3B8] focus-visible:border-[#0052FF] focus-visible:ring-3 focus-visible:ring-[#0052FF]/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:opacity-70"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid min-w-0 gap-2 text-xs">
            <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2">
              {metadataFields.map((field) => (
                <PreviewField
                  key={field.label}
                  label={field.label}
                  value={field.value}
                  wide={field.wide}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

export function PreviewField({
  label,
  value,
  icon,
  wide = false,
}: {
  label: string
  value: string
  icon?: React.ReactNode
  wide?: boolean
}) {
  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-lg bg-[#F8FAFC] px-2.5 py-2",
        wide && "col-span-full"
      )}
    >
      <p className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold tracking-[0.08em] text-[#94A3B8] uppercase">
        {icon}
        {label}
      </p>
      <p
        className={cn(
          "min-w-0 text-xs font-medium [overflow-wrap:anywhere] break-words whitespace-normal text-[#0F172A]",
          !wide && "line-clamp-2"
        )}
      >
        {value || "Chưa có"}
      </p>
    </div>
  )
}
