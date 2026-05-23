import { useState, useEffect, useRef } from "react"
import {
  FileText,
  Edit2,
  Check,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Folder,
  FolderOpen,
  ChevronRight,
  ArrowRight,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { cn } from "@/shared/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { PdfMetadata, FolderNode } from "@/features/upload/types"

// ─── Mock data ────────────────────────────────────────────────────────────────

const METADATA_LABELS: Record<string, string> = {
  loai_van_ban: "Loại văn bản",
  so_hieu_tai_lieu: "Số hiệu",
  co_quan_ban_hanh: "Cơ quan ban hành",
  ngay_ban_hanh: "Ngày ban hành",
  trich_yeu_tai_lieu: "Trích yếu",
  mentioned_subjects: "Đối tượng đề cập",
  direct_target_subject: "Đối tượng hướng tới",
  "nguoi ky": "Người ký",
}

// Fields in _warnings are considered uncertain — need user verification
function getWarningFields(meta: Record<string, unknown>): Set<string> {
  const warnings = meta["_warnings"]
  if (!warnings || typeof warnings !== "object") return new Set()
  return new Set(Object.keys(warnings as Record<string, unknown>))
}

function mockOcrResponse(data_path: string, index: number): PdfMetadata {
  const hasWarnings = index % 2 === 0
  return {
    data_path,
    status: "done",
    applied: false,
    light_metadata: {
      loai_van_ban: "Quyết định",
      so_hieu_tai_lieu: `${29 + index}/QĐ-UBND`,
      co_quan_ban_hanh: "ỦY BAN NHÂN DÂN QUẬN DƯƠNG KINH",
      ngay_ban_hanh: "04/01/2021",
      trich_yeu_tai_lieu: "Về việc bổ nhiệm chức danh nghề nghiệp",
      mentioned_subjects: ["Bà Ngô Thị Điểm", "Trường THCS Anh Dũng"],
      direct_target_subject: "Bà Ngô Thị Điểm",
      "nguoi ky": "Nguyễn Văn A",
      _warnings: hasWarnings
        ? { mentioned_subjects: "low confidence", "nguoi ky": "unverified" }
        : {},
    },
  }
}

// ─── Metadata card ────────────────────────────────────────────────────────────

interface MetadataCardProps {
  item: PdfMetadata
  onApply: (data_path: string, meta: Record<string, unknown>) => void
}

function MetadataCard({ item, onApply }: MetadataCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const warningFields = getWarningFields(item.light_metadata)
  const hasWarnings = warningFields.size > 0

  const startEdit = () => {
    const d: Record<string, string> = {}
    Object.keys(METADATA_LABELS).forEach((k) => {
      const v = item.light_metadata[k]
      d[k] = Array.isArray(v) ? (v as string[]).join(", ") : String(v ?? "")
    })
    setDraft(d)
    setEditing(true)
    setExpanded(true)
  }

  const commitEdit = () => {
    const updated: Record<string, unknown> = { ...item.light_metadata }
    Object.entries(draft).forEach(([k, v]) => {
      if (k === "mentioned_subjects")
        updated[k] = v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      else updated[k] = v
    })
    // Clear warnings after manual edit
    updated["_warnings"] = {}
    onApply(item.data_path, updated)
    setEditing(false)
    toast.success("Metadata đã được cập nhật.")
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-white transition-all duration-200",
        item.applied
          ? "border-[#0052FF]/30 shadow-[0_2px_12px_rgba(0,82,255,0.08)]"
          : hasWarnings
            ? "border-amber-300"
            : "border-[#CBD5E1]"
      )}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "linear-gradient(135deg, #0052FF, #4D7CFF)" }}
        >
          <FileText className="size-3.5 text-white" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-xs font-medium text-[#0F172A]">
            {item.data_path.split("/").pop()}
          </p>
          <p className="truncate font-mono text-[10px] text-[#64748B]">
            {item.data_path}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {item.applied ? (
            <span
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
              style={{
                background: "linear-gradient(to right, #0052FF, #4D7CFF)",
              }}
            >
              <Check className="size-2.5" /> Xác nhận
            </span>
          ) : hasWarnings ? (
            <span className="flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              <AlertTriangle className="size-2.5" /> Cần xác minh
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              <CheckCircle2 className="size-2.5" /> Tin cậy
            </span>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9]"
          >
            {expanded ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-[#E2E8F0] px-4 py-3">
              {editing ? (
                <div className="flex flex-col gap-2">
                  {Object.entries(METADATA_LABELS).map(([key, label]) => (
                    <div key={key} className="flex items-start gap-2">
                      <span className="w-32 shrink-0 pt-1.5 text-[11px] font-medium text-[#64748B]">
                        {label}
                      </span>
                      <input
                        value={draft[key] ?? ""}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, [key]: e.target.value }))
                        }
                        className="flex-1 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] px-2.5 py-1 text-xs text-[#0F172A] outline-none focus:border-[#0052FF]/50 focus:ring-1 focus:ring-[#0052FF]/20"
                      />
                    </div>
                  ))}
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setEditing(false)}
                      className="rounded-lg border border-[#CBD5E1] px-3 py-1.5 text-xs font-medium text-[#475569] hover:bg-[#F1F5F9]"
                    >
                      Hủy
                    </button>
                    <button
                      onClick={commitEdit}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                      style={{
                        background:
                          "linear-gradient(to right, #0052FF, #4D7CFF)",
                      }}
                    >
                      Lưu & Xác nhận
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {Object.entries(METADATA_LABELS).map(([key, label]) => {
                    const v = item.light_metadata[key]
                    if (!v) return null
                    const display = Array.isArray(v)
                      ? (v as string[]).join(", ")
                      : String(v)
                    const isWarning = warningFields.has(key)
                    return (
                      <div
                        key={key}
                        className={cn(
                          "flex gap-2 rounded-md px-2 py-1 text-xs",
                          isWarning && "bg-amber-50"
                        )}
                      >
                        <span
                          className={cn(
                            "w-32 shrink-0 font-medium",
                            isWarning ? "text-amber-700" : "text-[#64748B]"
                          )}
                        >
                          {label}
                          {isWarning && (
                            <AlertTriangle className="ml-1 inline size-2.5 text-amber-500" />
                          )}
                        </span>
                        <span
                          className={cn(
                            "flex-1",
                            isWarning ? "text-amber-900" : "text-[#0F172A]"
                          )}
                        >
                          {display}
                        </span>
                      </div>
                    )
                  })}
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={startEdit}
                      className="flex items-center gap-1 rounded-lg border border-[#CBD5E1] px-3 py-1.5 text-xs font-medium text-[#0F172A] hover:border-[#0052FF]/30 hover:text-[#0052FF]"
                    >
                      <Edit2 className="size-3" /> Sửa
                    </button>
                    {!item.applied && (
                      <button
                        onClick={() =>
                          onApply(item.data_path, item.light_metadata)
                        }
                        className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                        style={{
                          background:
                            "linear-gradient(to right, #0052FF, #4D7CFF)",
                        }}
                      >
                        <Check className="size-3" /> Xác nhận
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Clustering tree (right panel) ───────────────────────────────────────────

function ClusterNode({
  node,
  files,
  allFiles,
  depth,
}: {
  node: FolderNode
  files: string[]
  allFiles: Record<string, string[]>
  depth: number
}) {
  const [open, setOpen] = useState(true)
  const hasContent =
    files.length > 0 ||
    node.children.some((c) => (allFiles[c.id] ?? []).length > 0)

  return (
    <div>
      <div
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[#F1F5F9]"
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 text-[#64748B]"
        >
          {files.length > 0 || node.children.length > 0 ? (
            open ? (
              <ChevronDown className="size-3" />
            ) : (
              <ChevronRight className="size-3" />
            )
          ) : (
            <span className="size-3" />
          )}
        </button>
        {open && hasContent ? (
          <FolderOpen className="size-3.5 shrink-0 text-[#0052FF]" />
        ) : (
          <Folder className="size-3.5 shrink-0 text-[#0052FF]" />
        )}
        <span className="flex-1 text-xs font-medium text-[#0F172A]">
          {node.name}
        </span>
        {files.length > 0 && (
          <span className="rounded-full bg-[#0052FF]/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#0052FF]">
            {files.length}
          </span>
        )}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            {files.map((f) => (
              <motion.div
                key={f}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25 }}
                className="flex items-center gap-2 rounded-lg px-2 py-1"
                style={{ paddingLeft: `${8 + (depth + 1) * 16}px` }}
              >
                <span className="size-3 shrink-0" />
                <div
                  className="flex size-5 shrink-0 items-center justify-center rounded"
                  style={{
                    background: "linear-gradient(135deg, #0052FF, #4D7CFF)",
                  }}
                >
                  <FileText className="size-2.5 text-white" />
                </div>
                <span className="flex-1 truncate font-mono text-[10px] text-[#475569]">
                  {f.split("/").pop()}
                </span>
              </motion.div>
            ))}
            {node.children.map((child) => (
              <ClusterNode
                key={child.id}
                node={child}
                files={allFiles[child.id] ?? []}
                allFiles={allFiles}
                depth={depth + 1}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ProcessStepProps {
  pdfPaths: string[]
  tree: FolderNode[]
  onContinue: (
    items: PdfMetadata[],
    assignment: Record<string, string[]>
  ) => void
}

export function ProcessStep({ pdfPaths, tree, onContinue }: ProcessStepProps) {
  const paths =
    pdfPaths.length > 0
      ? pdfPaths
      : ["HC/UBND/PNV/04/14/198/1.pdf", "HC/UBND/PNV/04/14/198/2.pdf"]

  // ── Metadata state ──
  const [items, setItems] = useState<PdfMetadata[]>([])
  const [loadedCount, setLoadedCount] = useState(0)

  // ── Clustering state ──
  const [assignment, setAssignment] = useState<Record<string, string[]>>({})
  const [clusterDone, setClusterDone] = useState(false)
  const [clusterStatus, setClusterStatus] = useState("Đang khởi động phân cụm…")

  const allIds = useRef<string[]>([])

  // Collect all folder IDs from tree
  useEffect(() => {
    const ids: string[] = []
    const collect = (nodes: FolderNode[]) =>
      nodes.forEach((n) => {
        ids.push(n.id)
        collect(n.children)
      })
    collect(tree)
    allIds.current = ids
    const init: Record<string, string[]> = {}
    ids.forEach((id) => {
      init[id] = []
    })
    setAssignment(init)
  }, [tree])

  // Simulate loading metadata one by one (staggered)
  useEffect(() => {
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

  // Simulate clustering running in parallel — assigns files as they arrive
  useEffect(() => {
    if (loadedCount === 0 || allIds.current.length === 0) return
    const latestItem = items[items.length - 1]
    if (!latestItem) return

    const targetId = allIds.current[(loadedCount - 1) % allIds.current.length]
    setAssignment((prev) => ({
      ...prev,
      [targetId]: [...(prev[targetId] ?? []), latestItem.data_path],
    }))
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

  const appliedCount = items.filter((i) => i.applied).length
  const warningCount = items.filter(
    (i) => getWarningFields(i.light_metadata).size > 0 && !i.applied
  ).length

  const handleContinue = () => {
    if (!clusterDone) {
      toast.error("Vui lòng chờ phân cụm hoàn tất.")
      return
    }
    if (warningCount > 0) {
      toast.warning(
        `Còn ${warningCount} file có cảnh báo chưa xác minh. Bạn có thể tiếp tục hoặc xác minh trước.`
      )
    }
    onContinue(items, assignment)
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
          <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-[#0052FF]/30 bg-[#0052FF]/5 px-3 py-1">
            <span className="size-1.5 animate-pulse rounded-full bg-[#0052FF]" />
            <span className="font-mono text-[11px] tracking-[0.15em] text-[#0052FF] uppercase">
              Bước 3 / 4
            </span>
          </div>
          <h2
            className="text-2xl text-[#0F172A]"
            style={{ fontFamily: "'Calistoga', Georgia, serif" }}
          >
            Xử lý
          </h2>
          <p className="mt-1 text-sm text-[#475569]">
            Metadata được tải song song với quá trình phân cụm. Xác minh các
            trường cảnh báo nếu cần.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <p className="text-[11px] text-[#64748B]">Đã xác nhận</p>
            <p className="text-xl font-bold text-[#0052FF]">
              {appliedCount}
              <span className="text-sm font-normal text-[#64748B]">
                /{items.length}
              </span>
            </p>
          </div>
          {warningCount > 0 && (
            <div className="text-right">
              <p className="text-[11px] text-amber-600">Cảnh báo</p>
              <p className="text-xl font-bold text-amber-600">{warningCount}</p>
            </div>
          )}
        </div>
      </div>

      {/* Split layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        {/* LEFT — Metadata list */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] tracking-[0.15em] text-[#475569] uppercase">
              Metadata tài liệu
            </span>
            {items.length < paths.length && (
              <span className="flex items-center gap-1.5 text-xs text-[#64748B]">
                <Loader2 className="size-3 animate-spin text-[#0052FF]" />
                Đang tải {items.length}/{paths.length}…
              </span>
            )}
          </div>

          <ScrollArea className="max-h-[520px]">
            <div className="flex flex-col gap-2 pr-1">
              {items.map((item) => (
                <MetadataCard
                  key={item.data_path}
                  item={item}
                  onApply={handleApply}
                />
              ))}
              {/* Skeleton placeholders for loading items */}
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

        {/* RIGHT — Live clustering tree */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] tracking-[0.15em] text-[#475569] uppercase">
              Phân cụm tự động
            </span>
            <span
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium",
                clusterDone ? "text-emerald-600" : "text-[#0052FF]"
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

          <div className="rounded-xl border border-[#CBD5E1] bg-white p-3">
            {/* Status bar */}
            <div
              className={cn(
                "mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium",
                clusterDone
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-[#0052FF]/5 text-[#0052FF]"
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
            <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-[#E2E8F0]">
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: "linear-gradient(to right, #0052FF, #4D7CFF)",
                }}
                animate={{
                  width: `${paths.length > 0 ? (loadedCount / paths.length) * 100 : 0}%`,
                }}
                transition={{ duration: 0.4 }}
              />
            </div>

            <ScrollArea className="max-h-[420px]">
              {tree.map((node) => (
                <ClusterNode
                  key={node.id}
                  node={node}
                  files={assignment[node.id] ?? []}
                  allFiles={assignment}
                  depth={0}
                />
              ))}
            </ScrollArea>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between rounded-2xl border border-[#CBD5E1] bg-white px-6 py-4 shadow-sm">
        <div className="text-sm text-[#475569]">
          {!clusterDone ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin text-[#0052FF]" />
              Đang phân cụm, vui lòng chờ…
            </span>
          ) : warningCount > 0 ? (
            <span className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="size-4" />
              {warningCount} file có cảnh báo — bạn có thể xác minh hoặc bỏ qua.
            </span>
          ) : (
            <span className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="size-4" />
              Phân cụm hoàn tất. Sẵn sàng tiếp tục.
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
