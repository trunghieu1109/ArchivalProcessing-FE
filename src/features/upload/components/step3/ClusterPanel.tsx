import { useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
  Loader2,
  X,
} from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { cn } from "@/shared/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { METADATA_FIELDS, metadataFieldText } from "./MetadataCard"
import type { PdfMetadata } from "@/features/upload/types"
import type { ClusterGroup } from "@/features/upload/lib/clusterGroups"

function PdfPreviewModal({
  filePath,
  metadata,
  onClose,
}: {
  filePath: string
  metadata: PdfMetadata | undefined
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex size-8 shrink-0 items-center justify-center rounded-lg shadow-[0_4px_14px_rgba(0,82,255,0.25)]"
              style={{ background: "linear-gradient(135deg, #0052FF, #4D7CFF)" }}
            >
              <FileText className="size-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {filePath.split("/").pop()}
              </p>
              <p className="truncate font-roboto text-[10px] text-muted-foreground">
                {filePath}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="size-8 p-0">
            <X className="size-4" />
          </Button>
        </div>
        <div className="p-5">
          {metadata ? (
            <div className="flex flex-col gap-2">
              {METADATA_FIELDS.map((field) => {
                const display = metadataFieldText(
                  metadata.light_metadata,
                  field.aliases
                )
                if (!display) return null
                return (
                  <div key={field.key} className="flex gap-3 text-sm">
                    <span className="w-36 shrink-0 font-medium text-muted-foreground">
                      {field.label}
                    </span>
                    <span className="flex-1 text-foreground">{display}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              Không tìm thấy metadata trong danh sách hiện tại.
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

function ClusterGroupCard({
  group,
  index,
  onPreview,
}: {
  group: ClusterGroup
  index: number
  onPreview: (filePath: string) => void
}) {
  const [open, setOpen] = useState(true)
  const classification = group.classificationPath?.length
    ? group.classificationPath.join(" / ")
    : "Chưa có phân loại"

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-primary-foreground shadow-[0_2px_8px_rgba(0,82,255,0.3)]"
            style={{ background: "linear-gradient(135deg, #0052FF, #4D7CFF)" }}
          >
            {index + 1}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start gap-2">
              <span className="min-w-0 flex-1 text-sm leading-5 font-semibold break-words whitespace-normal text-foreground [overflow-wrap:anywhere]">
                {group.label}
              </span>
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 font-roboto text-[10px] font-bold text-primary">
                {group.files.length}
              </span>
              {group.requiresReview && (
                <span className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                  Cần xem lại
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
              <span className="rounded-full bg-muted px-2 py-0.5">{classification}</span>
              <span className="rounded-full bg-muted px-2 py-0.5">
                {group.retentionPeriod || "Chưa gắn thời hạn"}
              </span>
              {group.confidence !== null && group.confidence !== undefined && (
                <span className="rounded-full bg-muted px-2 py-0.5">
                  Tin cậy {formatConfidence(group.confidence)}
                </span>
              )}
            </div>
          </div>
        </div>
        {open ? (
          <ChevronDown className="mt-1 size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="mt-1 size-3.5 shrink-0 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && group.files.length > 0 && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border">
              {group.files.map((filePath) => (
                <motion.div
                  key={filePath}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-2 border-b border-border/50 px-4 py-2 last:border-0"
                >
                  <div className="flex size-6 shrink-0 items-center justify-center rounded bg-primary">
                    <FileText className="size-3 text-primary-foreground" />
                  </div>
                  <span className="flex-1 truncate font-roboto text-xs text-muted-foreground">
                    {filePath.split("/").pop()}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPreview(filePath)}
                    className="h-6 gap-1 px-2 text-[10px]"
                  >
                    <Eye className="size-3" /> Xem
                  </Button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface ClusterPanelProps {
  groups: ClusterGroup[]
  metadataMap: Record<string, PdfMetadata>
  clusterDone: boolean
  clusterStatus: string
  loadedCount: number
  totalCount: number
}

export function ClusterPanel({
  groups,
  metadataMap,
  clusterDone,
  clusterStatus,
  loadedCount,
  totalCount,
}: ClusterPanelProps) {
  const [previewFile, setPreviewFile] = useState<string | null>(null)
  const progress = clusterDone
    ? 100
    : Math.max(0, Math.min(100, totalCount > 0 ? (loadedCount / totalCount) * 100 : 0))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="font-roboto text-[11px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">
          Lập hồ sơ tự động
        </span>
        <span
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium",
            clusterDone ? "text-emerald-600" : "text-primary"
          )}
        >
          {clusterDone ? (
            <>
              <CheckCircle2 className="size-3.5" /> Hoàn tất
            </>
          ) : (
            <>
              <Loader2 className="size-3 animate-spin" /> Đang chờ
            </>
          )}
        </span>
      </div>

      <div className="rounded-xl border border-border bg-card p-3">
        <div
          className={cn(
            "mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium",
            clusterDone ? "bg-emerald-50 text-emerald-700" : "bg-primary/5 text-primary"
          )}
        >
          {clusterDone ? (
            <CheckCircle2 className="size-3.5 shrink-0" />
          ) : groups.length > 0 ? (
            <AlertTriangle className="size-3.5 shrink-0" />
          ) : (
            <Loader2 className="size-3.5 shrink-0 animate-spin" />
          )}
          <span className="min-w-0 flex-1">{clusterStatus}</span>
        </div>

        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(to right, #0052FF, #4D7CFF)" }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>

        <ScrollArea className="h-[360px]">
          <div className="flex flex-col gap-2 pr-1">
            {groups.map((group, index) => (
              <ClusterGroupCard
                key={group.id}
                group={group}
                index={index}
                onPreview={setPreviewFile}
              />
            ))}
            {groups.length === 0 && (
              <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-white p-6 text-center text-sm text-muted-foreground">
                Chưa có hồ sơ nào từ backend.
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      <AnimatePresence>
        {previewFile && (
          <PdfPreviewModal
            filePath={previewFile}
            metadata={metadataMap[previewFile]}
            onClose={() => setPreviewFile(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function formatConfidence(value: number): string {
  const normalized = value > 1 ? value : value * 100
  return `${Math.round(normalized)}%`
}
