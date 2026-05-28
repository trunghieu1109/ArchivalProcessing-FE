import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  GripVertical,
  Loader2,
  MoveRight,
  RefreshCw,
  Signature,
} from "lucide-react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/shared/lib/utils"
import {
  enqueueClusterBuild,
  getActiveClusters,
  moveDocumentBetweenClusters,
} from "@/features/upload/api/sessionApi"
import {
  versionToGroups,
  type ClusterDocument,
  type ClusterGroup,
} from "@/features/upload/lib/clusterGroups"
import type { PdfMetadata } from "@/features/upload/types"

const CLUSTER_POLL_INTERVAL_MS = 3_000
const CLUSTER_POLL_TIMEOUT_MS = 10 * 60 * 1_000
const NO_CLUSTER_VERSION = "__none__"

interface FinalResultProps {
  sessionId: string | null
  groups: ClusterGroup[]
  metadataItems?: PdfMetadata[]
  onFinish: () => void
}

interface DraggedDocument {
  document: ClusterDocument
  fromClusterId: string
}

interface ResultTreeNode {
  id: string
  label: string
  type: "year" | "classification" | "dossier"
  children: ResultTreeNode[]
  group?: ClusterGroup
  documentCount: number
  pageCount: number
}

export function FinalResult({
  sessionId,
  groups: initialGroups,
  metadataItems = [],
  onFinish,
}: FinalResultProps) {
  const [groups, setGroups] = useState<ClusterGroup[]>(initialGroups)
  const [status, setStatus] = useState("Đang chờ backend lập hồ sơ...")
  const [loading, setLoading] = useState(initialGroups.length === 0)
  const [draggedDocument, setDraggedDocument] = useState<DraggedDocument | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [openNodeIds, setOpenNodeIds] = useState<Set<string>>(() => new Set())
  const [activeClusterVersionId, setActiveClusterVersionId] = useState<string | null>(null)
  const [rebuildBaselineVersionId, setRebuildBaselineVersionId] = useState<string | null>(null)
  const [rebuildPollKey, setRebuildPollKey] = useState(0)
  const [rebuildSubmitting, setRebuildSubmitting] = useState(false)
  const [pendingFeedbackCount, setPendingFeedbackCount] = useState(0)

  const verifiedItems = useMemo(
    () => metadataItems.filter((item) => item.review_status === "verified"),
    [metadataItems]
  )
  const tree = useMemo(() => buildResultTree(groups), [groups])
  const totalFiles = groups.reduce((sum, group) => sum + group.documents.length, 0)
  const totalPages = groups.reduce((sum, group) => sum + dossierPageCount(group), 0)

  useEffect(() => {
    setOpenNodeIds((previous) => new Set([...previous, ...flattenNodeIds(tree)]))
  }, [tree])

  useEffect(() => {
    let cancelled = false
    let timeoutId: number | undefined
    const startedAt = Date.now()

    const schedule = () => {
      if (!cancelled) {
        timeoutId = window.setTimeout(poll, CLUSTER_POLL_INTERVAL_MS)
      }
    }

    const poll = async () => {
      if (cancelled) return
      if (!sessionId) {
        setLoading(false)
        setStatus("Chưa có session để lấy kết quả lập hồ sơ.")
        return
      }
      if (Date.now() - startedAt > CLUSTER_POLL_TIMEOUT_MS) {
        setLoading(false)
        setStatus("Quá thời gian chờ lập hồ sơ. Hãy kiểm tra worker/dispatcher backend.")
        return
      }

      try {
        const version = await getActiveClusters(sessionId)
        if (cancelled) return

        const nextVersionId = version?.id ?? null
        const nextVersionMarker = nextVersionId ?? NO_CLUSTER_VERSION
        setActiveClusterVersionId(nextVersionId)
        if (rebuildBaselineVersionId && nextVersionMarker === rebuildBaselineVersionId) {
          setLoading(true)
          setStatus("Đang chờ backend tạo phiên bản cụm mới từ feedback đã lưu.")
          schedule()
          return
        }
        if (rebuildBaselineVersionId) {
          setRebuildBaselineVersionId(null)
          setPendingFeedbackCount(0)
          toast.success("Đã cập nhật cụm từ feedback đã lưu.")
        }

        const nextGroups = versionToGroups(version, metadataItems)
        setGroups(nextGroups)

        const clusteredIds = clusteredDocumentIds(version)
        const missingVerified = verifiedItems.filter(
          (item) => !clusteredIds.has(item.document_id)
        )
        const allVerifiedClustered =
          nextGroups.length > 0 &&
          (verifiedItems.length === 0 || missingVerified.length === 0)

        if (allVerifiedClustered) {
          setLoading(false)
          setStatus(`Đã lập ${nextGroups.length} hồ sơ từ ${verifiedItems.length} tài liệu đã xác nhận.`)
          return
        }

        setLoading(true)
        if (nextGroups.length > 0 && missingVerified.length > 0) {
          setStatus(
            `Đã có ${nextGroups.length} hồ sơ. Đang chờ dispatcher cập nhật ${missingVerified.length} tài liệu mới.`
          )
        } else {
          setStatus("Đang chờ backend lập hồ sơ...")
        }
        schedule()
      } catch (err) {
        if (cancelled) return
        setLoading(true)
        setStatus(
          err instanceof Error
            ? `Chưa lấy được kết quả lập hồ sơ: ${err.message}`
            : "Chưa lấy được kết quả lập hồ sơ."
        )
        schedule()
      }
    }

    void poll()
    return () => {
      cancelled = true
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [metadataItems, rebuildBaselineVersionId, rebuildPollKey, sessionId, verifiedItems])

  const toggleNode = (nodeId: string) => {
    setOpenNodeIds((previous) => {
      const next = new Set(previous)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }

  const handleDropOnDossier = async (targetClusterId: string) => {
    if (!draggedDocument) return
    if (draggedDocument.fromClusterId === targetClusterId) {
      setDraggedDocument(null)
      setDropTargetId(null)
      return
    }
    if (!sessionId) {
      toast.error("Chưa có session để ghi feedback.")
      return
    }
    if (!draggedDocument.document.sessionDocumentId) {
      toast.error("Tài liệu này chưa có session_document_id để ghi manual-move.")
      return
    }

    const moving = draggedDocument
    const sessionDocumentId = draggedDocument.document.sessionDocumentId
    setDraggedDocument(null)
    setDropTargetId(null)
    setGroups((previous) => moveDocumentLocally(previous, moving, targetClusterId))
    setStatus("Đang lưu feedback manual-move...")

    try {
      await moveDocumentBetweenClusters(sessionId, {
        session_document_id: sessionDocumentId,
        source_cluster_id: moving.fromClusterId,
        target_cluster_id: targetClusterId,
        details: {
          action: "manual_move",
          document_id: moving.document.documentId,
          file_name: moving.document.fileName,
          source_cluster_id: moving.fromClusterId,
          target_cluster_id: targetClusterId,
        },
      })
      setPendingFeedbackCount((count) => count + 1)
      setStatus("Đã lưu feedback manual-move. Bấm Cập nhật cụm khi bạn muốn phân cụm lại.")
      toast.success("Đã lưu feedback chuyển tài liệu.")
    } catch (err) {
      setStatus("Không lưu được feedback manual-move. Vui lòng thử lại.")
      toast.error(err instanceof Error ? err.message : "Không gửi được feedback manual-move.")
    }
  }

  const handleRebuildClusters = async () => {
    if (!sessionId) {
      toast.error("Chưa có session để cập nhật cụm.")
      return
    }
    setRebuildSubmitting(true)
    try {
      const currentVersion = await getActiveClusters(sessionId)
      const baselineVersionId = currentVersion?.id ?? activeClusterVersionId ?? NO_CLUSTER_VERSION
      setActiveClusterVersionId(currentVersion?.id ?? activeClusterVersionId ?? null)
      const response = await enqueueClusterBuild(sessionId, { source: "user_feedback" })
      setRebuildBaselineVersionId(baselineVersionId)
      setRebuildPollKey((key) => key + 1)
      setLoading(true)
      setStatus("Đã gửi job cập nhật cụm. Đang chờ backend tạo phiên bản mới.")
      toast.success(
        response.status === "already_queued_or_running"
          ? "Đã có job cập nhật cụm đang chạy."
          : "Đã gửi job cập nhật cụm."
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không gửi được job cập nhật cụm.")
    } finally {
      setRebuildSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            className="text-2xl text-[#0F172A]"
            style={{ fontFamily: "'Calistoga', Georgia, serif" }}
          >
            Kết quả
          </h2>
          <p className="mt-1 text-sm text-[#475569]">
            Tài liệu đã được gắn vào phông lưu trữ. Các hồ sơ có thể được điều chỉnh bằng kéo thả.
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm text-[#475569]">
            {loading ? (
              <Loader2 className="size-4 animate-spin text-[#0052FF]" />
            ) : (
              <CheckCircle2 className="size-4 text-emerald-600" />
            )}
            {status}
          </p>
        </div>
        <div className="grid shrink-0 grid-cols-3 gap-2">
          <Metric label="Hồ sơ" value={groups.length} />
          <Metric label="Tài liệu" value={totalFiles} />
          <Metric label="Trang" value={totalPages} />
        </div>
      </div>

      <div className="rounded-2xl border border-[#D8E1EC] bg-white shadow-sm">
        <ScrollArea className="h-[560px] p-3">
          <div className="flex flex-col gap-1">
            {tree.map((node) => (
              <ResultNode
                key={node.id}
                node={node}
                depth={0}
                openNodeIds={openNodeIds}
                draggedDocument={draggedDocument}
                dropTargetId={dropTargetId}
                onToggle={toggleNode}
                onDragStart={(document, fromClusterId) =>
                  setDraggedDocument({ document, fromClusterId })
                }
                onDragEnd={() => {
                  setDraggedDocument(null)
                  setDropTargetId(null)
                }}
                onDragEnter={setDropTargetId}
                onDropOnDossier={handleDropOnDossier}
              />
            ))}
            {tree.length === 0 && (
              <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-8 text-center text-sm text-muted-foreground">
                {loading ? "Đang chờ kết quả lập hồ sơ từ backend." : "Chưa có kết quả lập hồ sơ từ backend."}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#64748B]">
          {pendingFeedbackCount > 0
            ? `Có ${pendingFeedbackCount} feedback đã lưu và đang chờ cập nhật cụm.`
            : "Feedback manual-move sẽ được lưu lại và chỉ áp dụng khi cập nhật cụm."}
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => void handleRebuildClusters()}
            disabled={rebuildSubmitting || loading || !sessionId || groups.length === 0}
          >
            {rebuildSubmitting ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <RefreshCw data-icon="inline-start" />
            )}
            Cập nhật cụm
          </Button>
          <Button onClick={onFinish} disabled={groups.length === 0}>
            <CheckCircle2 data-icon="inline-start" />
            Tạo mục lục
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

function ResultNode({
  node,
  depth,
  openNodeIds,
  draggedDocument,
  dropTargetId,
  onToggle,
  onDragStart,
  onDragEnd,
  onDragEnter,
  onDropOnDossier,
}: {
  node: ResultTreeNode
  depth: number
  openNodeIds: Set<string>
  draggedDocument: DraggedDocument | null
  dropTargetId: string | null
  onToggle: (nodeId: string) => void
  onDragStart: (document: ClusterDocument, fromClusterId: string) => void
  onDragEnd: () => void
  onDragEnter: (nodeId: string | null) => void
  onDropOnDossier: (targetClusterId: string) => void
}) {
  const open = openNodeIds.has(node.id)
  const isDossier = node.type === "dossier"
  const group = node.group
  const canDrop =
    Boolean(draggedDocument && group && draggedDocument.fromClusterId !== group.id)

  return (
    <div>
      <div
        className={cn(
          "group flex min-h-10 items-center gap-2 rounded-xl px-2 py-1.5 transition-all",
          isDossier ? "border border-transparent" : "",
          canDrop && dropTargetId === node.id
            ? "border-[#0052FF]/40 bg-[#EAF1FF] shadow-[0_8px_24px_rgba(0,82,255,0.10)]"
            : "hover:bg-[#F8FAFC]"
        )}
        style={{ paddingLeft: `${8 + depth * 20}px` }}
        onDragOver={(event) => {
          if (!isDossier || !canDrop) return
          event.preventDefault()
          onDragEnter(node.id)
        }}
        onDragLeave={() => isDossier && onDragEnter(null)}
        onDrop={(event) => {
          if (!isDossier || !group) return
          event.preventDefault()
          void onDropOnDossier(group.id)
        }}
      >
        <button
          type="button"
          onClick={() => onToggle(node.id)}
          className="flex size-5 shrink-0 items-center justify-center rounded-md text-[#64748B] hover:bg-[#E2E8F0]"
        >
          {node.children.length > 0 || isDossier ? (
            open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />
          ) : (
            <span className="size-3.5" />
          )}
        </button>

        {open ? (
          <FolderOpen className="size-4 shrink-0 text-[#0052FF]" />
        ) : (
          <Folder className="size-4 shrink-0 text-[#0052FF]" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "truncate text-sm",
                isDossier ? "font-semibold text-[#0F172A]" : "font-medium text-[#0F172A]"
              )}
            >
              {node.label}
            </span>
            {group?.requiresReview && (
              <span className="flex shrink-0 items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                <AlertTriangle className="size-3" /> Cần xem
              </span>
            )}
          </div>
          {isDossier && group && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[#64748B]">
              <span>{group.dossierNumber ? `Số ${group.dossierNumber}` : "Chưa có số hồ sơ"}</span>
              <span>·</span>
              <span>{formatDateRange(group.startDate, group.endDate)}</span>
              <span>·</span>
              <span>{dossierPageCount(group)} trang</span>
              {group.retentionPeriod && (
                <>
                  <span>·</span>
                  <span>{group.retentionPeriod}</span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {isDossier && canDrop && (
            <span className="flex items-center gap-1 rounded-full bg-[#DBEAFE] px-2 py-1 text-[10px] font-semibold text-[#0052FF]">
              <MoveRight className="size-3" /> Chuyển vào đây
            </span>
          )}
          <CountBadge value={node.documentCount} />
        </div>
      </div>

      {open && (
        <div className="mt-1">
          {group?.documents.map((document) => (
            <DocumentRow
              key={`${group.id}-${document.documentId}`}
              document={document}
              clusterId={group.id}
              depth={depth + 1}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))}
          {node.children.map((child) => (
            <ResultNode
              key={child.id}
              node={child}
              depth={depth + 1}
              openNodeIds={openNodeIds}
              draggedDocument={draggedDocument}
              dropTargetId={dropTargetId}
              onToggle={onToggle}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragEnter={onDragEnter}
              onDropOnDossier={onDropOnDossier}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function DocumentRow({
  document,
  clusterId,
  depth,
  onDragStart,
  onDragEnd,
}: {
  document: ClusterDocument
  clusterId: string
  depth: number
  onDragStart: (document: ClusterDocument, fromClusterId: string) => void
  onDragEnd: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [dragging, setDragging] = useState(false)
  const summary = metadataText(document.metadata, [
    "document_summary",
    "trich_yeu_van_ban",
    "title",
    "long_summary",
  ])
  const agency = metadataText(document.metadata, ["issuing_agency", "co_quan_ban_hanh"])
  const issuedDate = metadataText(document.metadata, ["issued_date", "ngay_ban_hanh"])
  const docType = metadataText(document.metadata, ["document_type", "loai_van_ban"])
  const documentNumber = metadataText(document.metadata, ["document_number", "so_ky_hieu"])
  const signer = metadataText(document.metadata, ["signer", "nguoi_ky"])

  return (
    <div>
      <div
        draggable
        onClick={() => {
          if (!dragging) setExpanded((value) => !value)
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
          "flex cursor-pointer items-start gap-2 rounded-xl px-2 py-1.5 transition-colors active:cursor-grabbing",
          expanded ? "bg-[#F8FAFC]" : "hover:bg-[#F8FAFC]"
        )}
        style={{ paddingLeft: `${8 + depth * 20}px` }}
        title="Nhấn để xem chi tiết tài liệu"
      >
        <GripVertical className="mt-1.5 size-3 shrink-0 cursor-grab text-[#94A3B8]" />
        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#0052FF] shadow-[0_4px_12px_rgba(0,82,255,0.24)]">
          <FileText className="size-3.5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-roboto text-xs font-medium text-[#334155]">
              {document.fileName}
            </span>
            {docType && (
              <span className="shrink-0 rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[10px] font-medium text-[#475569]">
                {docType}
              </span>
            )}
            {issuedDate && (
              <span className="flex shrink-0 items-center gap-1 text-[10px] text-[#64748B]">
                <CalendarDays className="size-3" /> {issuedDate}
              </span>
            )}
            {expanded ? (
              <ChevronDown className="ml-auto size-3.5 shrink-0 text-[#64748B]" />
            ) : (
              <ChevronRight className="ml-auto size-3.5 shrink-0 text-[#94A3B8]" />
            )}
          </div>
          {summary && (
            <p className="mt-0.5 line-clamp-1 text-xs text-[#64748B]">{summary}</p>
          )}
        </div>
      </div>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16 }}
          className="mt-1 rounded-2xl border border-[#D8E1EC] bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
          style={{ marginLeft: `${8 + (depth + 1) * 20}px` }}
        >
          <div className="mb-3 flex items-start gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#EAF1FF] text-[#0052FF]">
              <FileText className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#0F172A]">{document.fileName}</p>
              <p className="truncate text-[11px] text-[#64748B]">{document.filePath}</p>
            </div>
          </div>
          <div className="grid gap-2 text-xs">
            <PreviewField label="Trích yếu" value={summary} wide />
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <PreviewField label="Cơ quan ban hành" value={agency} />
              <PreviewField label="Ngày ban hành" value={issuedDate} />
              <PreviewField label="Loại văn bản" value={docType} />
              <PreviewField label="Số hiệu" value={documentNumber} />
              <PreviewField label="Người ký" value={signer} icon={<Signature className="size-3" />} />
              <PreviewField label="Số trang" value={String(document.pageCount ?? "")} />
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}

function PreviewField({
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
    <div className={cn("min-w-0 rounded-lg bg-[#F8FAFC] px-2.5 py-2", wide && "col-span-full")}>
      <p className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#94A3B8]">
        {icon}
        {label}
      </p>
      <p className={cn("text-xs font-medium text-[#0F172A]", wide ? "line-clamp-3" : "truncate")}>
        {value || "Chưa có"}
      </p>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-20 rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-right shadow-sm">
      <p className="font-roboto text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
        {label}
      </p>
      <p className="text-lg font-semibold text-[#0F172A]">{value}</p>
    </div>
  )
}

function CountBadge({ value }: { value: number }) {
  if (value <= 0) return null
  return (
    <span className="flex min-w-6 justify-center rounded-full bg-[#EAF1FF] px-2 py-0.5 font-roboto text-[10px] font-bold text-[#0052FF]">
      {value}
    </span>
  )
}

function buildResultTree(groups: ClusterGroup[]): ResultTreeNode[] {
  const roots: ResultTreeNode[] = []
  const rootByLabel = new Map<string, ResultTreeNode>()

  groups.forEach((group) => {
    const yearLabel = dossierYearLabel(group)
    let current = rootByLabel.get(yearLabel)
    if (!current) {
      current = createTreeNode(`year:${yearLabel}`, yearLabel, "year")
      rootByLabel.set(yearLabel, current)
      roots.push(current)
    }

    const path = group.classificationPath?.length ? group.classificationPath : ["Chưa phân loại"]
    path.forEach((segment, index) => {
      const label = segment.trim() || "Chưa phân loại"
      const id = `${current!.id}/class:${index}:${label}`
      let child = current!.children.find((candidate) => candidate.id === id)
      if (!child) {
        child = createTreeNode(id, label, "classification")
        current!.children.push(child)
      }
      current = child
    })

    current.children.push({
      id: `dossier:${group.id}`,
      label: group.label,
      type: "dossier",
      children: [],
      group,
      documentCount: group.documents.length,
      pageCount: dossierPageCount(group),
    })
  })

  roots.forEach(updateTreeCounts)
  return roots.sort((a, b) => a.label.localeCompare(b.label, "vi"))
}

function createTreeNode(
  id: string,
  label: string,
  type: ResultTreeNode["type"]
): ResultTreeNode {
  return {
    id,
    label,
    type,
    children: [],
    documentCount: 0,
    pageCount: 0,
  }
}

function updateTreeCounts(node: ResultTreeNode): ResultTreeNode {
  if (node.group) return node
  node.children.forEach(updateTreeCounts)
  node.documentCount = node.children.reduce((sum, child) => sum + child.documentCount, 0)
  node.pageCount = node.children.reduce((sum, child) => sum + child.pageCount, 0)
  return node
}

function flattenNodeIds(nodes: ResultTreeNode[]): string[] {
  return nodes.flatMap((node) => [node.id, ...flattenNodeIds(node.children)])
}

function moveDocumentLocally(
  groups: ClusterGroup[],
  moving: DraggedDocument,
  targetClusterId: string
): ClusterGroup[] {
  return groups.map((group) => {
    if (group.id === moving.fromClusterId) {
      const documents = group.documents.filter(
        (document) => document.documentId !== moving.document.documentId
      )
      return { ...group, documents, files: documents.map((document) => document.filePath) }
    }
    if (group.id === targetClusterId) {
      const documents = [
        ...group.documents,
        { ...moving.document, positionIndex: group.documents.length },
      ]
      return { ...group, documents, files: documents.map((document) => document.filePath) }
    }
    return group
  })
}

function dossierYearLabel(group: ClusterGroup): string {
  const year =
    yearFromText(group.startDate) ||
    group.documents.map((document) => yearFromText(metadataText(document.metadata, ["issued_date", "ngay_ban_hanh"]))).find(Boolean)
  return year ? `Năm ${year}` : "Không rõ năm"
}

function dossierPageCount(group: ClusterGroup): number {
  if (typeof group.pageCount === "number") return group.pageCount
  return group.documents.reduce((sum, document) => sum + (document.pageCount ?? 0), 0)
}

function formatDateRange(startDate?: string | null, endDate?: string | null): string {
  if (startDate && endDate && startDate !== endDate) return `${startDate} - ${endDate}`
  return startDate || endDate || "Chưa rõ thời gian"
}

function metadataText(metadata: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = metadata[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number") return String(value)
  }
  return ""
}

function yearFromText(value: string | null | undefined): string {
  return value?.match(/\b(19|20)\d{2}\b/)?.[0] ?? ""
}

function clusteredDocumentIds(
  version: Awaited<ReturnType<typeof getActiveClusters>>
): Set<string> {
  const ids = new Set<string>()
  version?.clusters?.forEach((cluster) => {
    cluster.document_ids?.forEach((id) => ids.add(id))
    cluster.placements?.forEach((placement) => ids.add(placement.document_id))
  })
  return ids
}
