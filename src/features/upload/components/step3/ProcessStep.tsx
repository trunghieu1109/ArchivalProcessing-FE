import { useState, useEffect, useRef } from "react"
import { AlertTriangle, CheckCircle2, Loader2, ArrowRight } from "lucide-react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { cn } from "@/shared/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MetadataCard, mockOcrResponse, getWarningFields } from "./MetadataCard"
import { ClusterPanel } from "./ClusterPanel"
import type { ClusterGroup } from "./ClusterPanel"
import type { PdfMetadata, FolderNode } from "@/features/upload/types"

interface ProcessStepProps {
  pdfPaths: string[]
  tree: FolderNode[]
  onContinue: (
    items: PdfMetadata[],
    assignment: Record<string, string[]>,
    groups: ClusterGroup[]
  ) => void
}

export function ProcessStep({ pdfPaths, onContinue }: ProcessStepProps) {
  const paths =
    pdfPaths.length > 0
      ? pdfPaths
      : [
          "HC/UBND/PNV/04/14/198/1.pdf",
          "HC/UBND/PNV/04/14/198/2.pdf",
          "HC/UBND/PNV/04/14/198/3.pdf",
        ]

  // ── Metadata state ──
  const [items, setItems] = useState<PdfMetadata[]>([])
  const [loadedCount, setLoadedCount] = useState(0)

  // ── Cluster state ──
  const numGroups = Math.max(2, Math.ceil(paths.length / 3))
  const [groups, setGroups] = useState<ClusterGroup[]>(() =>
    Array.from({ length: numGroups }, (_, i) => ({
      id: `group-${i + 1}`,
      label: `Nhóm ${i + 1}`,
      files: [],
    }))
  )
  const [excludedFiles, setExcludedFiles] = useState<string[]>([])
  const [clusterDone, setClusterDone] = useState(false)
  const [clusterStatus, setClusterStatus] = useState("Đang khởi động phân cụm…")

  // Build metadata lookup map
  const metadataMap: Record<string, PdfMetadata> = {}
  items.forEach((item) => {
    metadataMap[item.data_path] = item
  })

  const initialized = useRef(false)

  // Simulate loading metadata one by one — ref guard prevents StrictMode double-invoke
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    paths.forEach((path, i) => {
      setTimeout(
        () => {
          setItems((prev) => [...prev, mockOcrResponse(path, i)])
          setLoadedCount((c) => c + 1)
        },
        600 + i * 800
      )
    })
  }, [])

  // Assign each file to a numbered group as it arrives
  useEffect(() => {
    if (loadedCount === 0) return
    const latestPath = paths[loadedCount - 1]
    if (!latestPath) return
    const targetGroupIndex = (loadedCount - 1) % numGroups
    setGroups((prev) =>
      prev.map((g, i) =>
        i === targetGroupIndex ? { ...g, files: [...g.files, latestPath] } : g
      )
    )
    setClusterStatus(`Đã phân cụm ${loadedCount}/${paths.length} tài liệu…`)
    if (loadedCount === paths.length) {
      setTimeout(() => {
        setClusterDone(true)
        setClusterStatus("Phân cụm hoàn tất!")
      }, 400)
    }
  }, [loadedCount])

  const handleApply = (data_path: string, meta: Record<string, unknown>) => {
    setItems((prev) =>
      prev.map((item) =>
        item.data_path === data_path
          ? { ...item, light_metadata: meta, applied: true }
          : item
      )
    )
  }

  const handleExclude = (groupId: string, filePath: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? { ...g, files: g.files.filter((f) => f !== filePath) }
          : g
      )
    )
    setExcludedFiles((prev) => [...prev, filePath])
    toast.info(`Đã loại "${filePath.split("/").pop()}" khỏi nhóm.`)
  }

  const warningCount = items.filter(
    (i) => getWarningFields(i.light_metadata).size > 0 && !i.applied
  ).length

  const handleContinue = () => {
    if (!clusterDone) {
      toast.error("Vui lòng chờ phân cụm hoàn tất.")
      return
    }

    const assignment: Record<string, string[]> = {}
    groups.forEach((g) => {
      assignment[g.id] = g.files
    })
    onContinue(items, assignment, groups)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="section-label mb-3">
            <span className="pulse-dot size-1.5 rounded-full bg-primary" />
            Bước 3 / 4
          </div>
          <h2 className="text-2xl text-foreground">Xử lý & Phân cụm</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Metadata được tải song song với quá trình phân cụm. Xác minh các
            trường cảnh báo nếu cần.
          </p>
        </div>
        {warningCount > 0 && (
          <div className="shrink-0 text-right">
            <p className="font-mono text-[11px] text-amber-600">Cảnh báo</p>
            <p className="text-xl font-bold text-amber-600">{warningCount}</p>
          </div>
        )}
      </div>

      {/* Split layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        {/* LEFT — Metadata list */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">
              Metadata tài liệu
            </span>
            {items.length < paths.length && (
              <span className="flex items-center gap-1.5 text-xs text-[#64748B]">
                <Loader2 className="size-3 animate-spin text-[#0052FF]" />
                Đang tải {items.length}/{paths.length}…
              </span>
            )}
          </div>
          <ScrollArea className="h-[520px]">
            <div className="flex flex-col gap-2 pr-1">
              {[...items]
                .sort((a, b) => {
                  const aWarn =
                    getWarningFields(a.light_metadata).size > 0 && !a.applied
                      ? 0
                      : 1
                  const bWarn =
                    getWarningFields(b.light_metadata).size > 0 && !b.applied
                      ? 0
                      : 1
                  return aWarn - bWarn
                })
                .map((item) => (
                  <MetadataCard
                    key={item.data_path}
                    item={item}
                    onApply={handleApply}
                  />
                ))}
              {Array.from({ length: paths.length - items.length }).map(
                (_, i) => (
                  <div
                    key={`skel-${i}`}
                    className="h-14 animate-pulse rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]"
                  />
                )
              )}
            </div>
          </ScrollArea>
        </div>

        {/* RIGHT — Cluster panel */}
        <ClusterPanel
          groups={groups}
          excludedFiles={excludedFiles}
          metadataMap={metadataMap}
          clusterDone={clusterDone}
          clusterStatus={clusterStatus}
          loadedCount={loadedCount}
          totalCount={paths.length}
          onExclude={handleExclude}
        />
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between rounded-2xl border border-[#CBD5E1] bg-white px-6 py-4 shadow-sm">
        <div className="text-sm text-[#475569]">
          {!clusterDone ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin text-[#0052FF]" /> Đang
              phân cụm, vui lòng chờ…
            </span>
          ) : warningCount > 0 ? (
            <span className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="size-4" />
              {warningCount} file có cảnh báo — bạn có thể xác minh hoặc bỏ qua.
            </span>
          ) : (
            <span className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="size-4" /> Phân cụm hoàn tất. Sẵn sàng
              tiếp tục.
            </span>
          )}
        </div>
        <button
          disabled={!clusterDone}
          onClick={handleContinue}
          className={cn(
            "group flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all duration-200",
            clusterDone
              ? "text-white hover:-translate-y-0.5 active:scale-[0.98]"
              : "cursor-not-allowed bg-[#CBD5E1] text-[#475569]"
          )}
          style={
            clusterDone
              ? {
                  background: "linear-gradient(to right, #0052FF, #4D7CFF)",
                  boxShadow: "0 4px 14px rgba(0,82,255,0.25)",
                }
              : {}
          }
        >
          Xem kết quả
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </button>
      </div>
    </motion.div>
  )
}
