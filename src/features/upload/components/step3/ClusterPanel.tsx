import { useState } from "react"
import {
  FileText,
  Eye,
  X,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Loader2,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/shared/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { METADATA_LABELS } from "./MetadataCard"
import type { PdfMetadata } from "@/features/upload/types"

export interface ClusterGroup {
  id: string
  label: string
  files: string[]
}

// ─── PDF Preview Modal ────────────────────────────────────────────────────────

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
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div
              className="flex size-8 items-center justify-center rounded-lg shadow-[0_4px_14px_rgba(0,82,255,0.25)]"
              style={{
                background: "linear-gradient(135deg, #0052FF, #4D7CFF)",
              }}
            >
              <FileText className="size-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {filePath.split("/").pop()}
              </p>
              <p className="font-roboto text-[10px] text-muted-foreground">
                {filePath}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="size-8 p-0"
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="p-5">
          {metadata ? (
            <div className="flex flex-col gap-2">
              {Object.entries(METADATA_LABELS).map(([key, label]) => {
                const v = metadata.light_metadata[key]
                if (!v) return null
                const display = Array.isArray(v)
                  ? (v as string[]).join(", ")
                  : String(v)
                return (
                  <div key={key} className="flex gap-3 text-sm">
                    <span className="w-36 shrink-0 font-medium text-muted-foreground">
                      {label}
                    </span>
                    <span className="flex-1 text-foreground">{display}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin" /> Đang tải
              metadata…
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

// ─── Cluster group card ───────────────────────────────────────────────────────

function ClusterGroupCard({
  group,
  onExclude,
  onPreview,
}: {
  group: ClusterGroup
  metadataMap: Record<string, PdfMetadata>
  onExclude: (groupId: string, filePath: string) => void
  onPreview: (filePath: string) => void
}) {
  const [open, setOpen] = useState(true)

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-muted/50"
      >
        <div className="flex items-center gap-2">
          <div
            className="flex size-6 items-center justify-center rounded-md text-[10px] font-bold text-primary-foreground shadow-[0_2px_8px_rgba(0,82,255,0.3)]"
            style={{ background: "linear-gradient(135deg, #0052FF, #4D7CFF)" }}
          >
            {group.label.replace("Nhóm ", "")}
          </div>
          <span className="text-sm font-semibold text-foreground">
            {group.label}
          </span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-roboto text-[10px] font-bold text-primary">
            {group.files.length}
          </span>
        </div>
        {open ? (
          <ChevronDown className="size-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3.5 text-muted-foreground" />
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
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onPreview(filePath)}
                      className="h-6 gap-1 px-2 text-[10px]"
                    >
                      <Eye className="size-3" /> Xem
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onExclude(group.id, filePath)}
                      className="h-6 gap-1 px-2 text-[10px]"
                    >
                      <X className="size-3" /> Loại
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main ClusterPanel ────────────────────────────────────────────────────────

interface ClusterPanelProps {
  groups: ClusterGroup[]
  excludedFiles: string[]
  metadataMap: Record<string, PdfMetadata>
  clusterDone: boolean
  clusterStatus: string
  loadedCount: number
  totalCount: number
  onExclude: (groupId: string, filePath: string) => void
}

export function ClusterPanel({
  groups,
  excludedFiles,
  metadataMap,
  clusterDone,
  clusterStatus,
  loadedCount,
  totalCount,
  onExclude,
}: ClusterPanelProps) {
  const [previewFile, setPreviewFile] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="font-roboto text-[11px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">
          Phân cụm tự động
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
              <Loader2 className="size-3 animate-spin" /> Đang chạy
            </>
          )}
        </span>
      </div>

      <div className="rounded-xl border border-border bg-card p-3">
        {/* Status bar */}
        <div
          className={cn(
            "mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium",
            clusterDone
              ? "bg-emerald-50 text-emerald-700"
              : "bg-primary/5 text-primary"
          )}
        >
          {clusterDone ? (
            <CheckCircle2 className="size-3.5 shrink-0" />
          ) : (
            <Loader2 className="size-3.5 shrink-0 animate-spin" />
          )}
          {clusterStatus}
        </div>

        {/* Progress bar */}
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: "linear-gradient(to right, #0052FF, #4D7CFF)",
            }}
            animate={{
              width: `${totalCount > 0 ? (loadedCount / totalCount) * 100 : 0}%`,
            }}
            transition={{ duration: 0.4 }}
          />
        </div>

        <ScrollArea className="h-[360px]">
          <div className="flex flex-col gap-2 pr-1">
            {groups.map((group) => (
              <ClusterGroupCard
                key={group.id}
                group={group}
                metadataMap={metadataMap}
                onExclude={onExclude}
                onPreview={setPreviewFile}
              />
            ))}

            {excludedFiles.length > 0 && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-destructive">
                  <X className="size-3.5" /> Đã loại ({excludedFiles.length})
                </p>
                {excludedFiles.map((f) => (
                  <p
                    key={f}
                    className="truncate font-roboto text-[10px] text-destructive/70"
                  >
                    {f.split("/").pop()}
                  </p>
                ))}
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
