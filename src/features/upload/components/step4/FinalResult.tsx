import { useEffect, useMemo, useState, type CSSProperties } from "react"
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
  Folder,
  FolderOpen,
  GripVertical,
  Loader2,
  PanelRight,
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
  DocumentPdfPreview,
  type DocumentPreviewTarget,
} from "@/features/upload/components/DocumentPdfPreview"
import {
  enqueueClusterBuild,
  getActiveClusters,
  getClusterBuildStatus,
  listSessionEvents,
  moveDocumentBetweenClusters,
  type ClusterVersionResponse,
} from "@/features/upload/api/sessionApi"
import { ProgressTimeline } from "@/features/upload/components/ProgressTimeline"
import {
  versionToGroups,
  type ClusterDocument,
  type ClusterGroup,
} from "@/features/upload/lib/clusterGroups"
import type { PdfMetadata } from "@/features/upload/types"

const CLUSTER_POLL_INTERVAL_MS = 3_000
const CLUSTER_POLL_TIMEOUT_MS = 10 * 60 * 1_000
const CLUSTER_PROGRESS_TICK_MS = 4_500
const NO_CLUSTER_VERSION = "__none__"
const CLUSTER_PROGRESS_PHASES = [
  { id: "updating_dossiers", label: "Đang cập nhật hồ sơ" },
  { id: "naming_dossiers", label: "Đặt tiêu đề hồ sơ" },
  { id: "classifying_dossiers", label: "Phân loại hồ sơ" },
  { id: "finding_retention", label: "Tìm thời hạn bảo quản" },
  { id: "reviewing_dossiers", label: "Rà soát hồ sơ" },
]
const CLUSTER_ALL_PHASE_IDS = CLUSTER_PROGRESS_PHASES.map((phase) => phase.id)
const FIRST_CLUSTER_PROGRESS_PHASE_ID = CLUSTER_PROGRESS_PHASES[0].id
const CLUSTER_PROGRESS_PHASE_ALIASES: Record<string, string> = {
  loading_verified_documents: "updating_dossiers",
  building_dossiers: "updating_dossiers",
  naming_dossiers: "naming_dossiers",
  classifying_retention: "finding_retention",
  persisting_clusters: "reviewing_dossiers",
}

type ClusterJobMode = "new" | "update"

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

interface PreviewDocumentEntry {
  groupId: string
  document: ClusterDocument
  sessionDocumentId: number
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
  const [status, setStatus] = useState(
    initialGroups.length > 0
      ? `Đã lập ${initialGroups.length} hồ sơ.`
      : "Đang kiểm tra kết quả lập hồ sơ..."
  )
  const [loading, setLoading] = useState(false)
  const [checkingClusters, setCheckingClusters] = useState(
    initialGroups.length === 0
  )
  const [draggedDocument, setDraggedDocument] =
    useState<DraggedDocument | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [openNodeIds, setOpenNodeIds] = useState<Set<string>>(() => new Set())
  const [activeClusterVersionId, setActiveClusterVersionId] = useState<
    string | null
  >(null)
  const [displayedClusterVersionId, setDisplayedClusterVersionId] = useState<
    string | null
  >(null)
  const [pendingClusterVersion, setPendingClusterVersion] =
    useState<ClusterVersionResponse | null>(null)
  const [rebuildBaselineVersionId, setRebuildBaselineVersionId] = useState<
    string | null
  >(null)
  const [rebuildPollKey, setRebuildPollKey] = useState(0)
  const [rebuildSubmitting, setRebuildSubmitting] = useState(false)
  const [pendingFeedbackCount, setPendingFeedbackCount] = useState(0)
  const [selectedPreviewDocumentId, setSelectedPreviewDocumentId] = useState<
    number | null
  >(null)
  const [previewWidthPercent, setPreviewWidthPercent] = useState(38)
  const [clusterJobMode, setClusterJobMode] = useState<ClusterJobMode>("new")
  const [clusterProgressPhase, setClusterProgressPhase] = useState<
    string | null
  >(null)
  const [clusterProgressMessage, setClusterProgressMessage] = useState(
    initialGroups.length > 0 ? "Đã lập hồ sơ xong." : ""
  )
  const [clusterCompletedPhases, setClusterCompletedPhases] = useState<
    Set<string>
  >(() => (initialGroups.length > 0 ? completedClusterPhaseSet() : new Set()))

  const verifiedItems = useMemo(
    () => metadataItems.filter((item) => item.review_status === "verified"),
    [metadataItems]
  )
  const tree = useMemo(() => buildResultTree(groups), [groups])
  const totalFiles = groups.reduce(
    (sum, group) => sum + group.documents.length,
    0
  )
  const totalPages = groups.reduce(
    (sum, group) => sum + dossierPageCount(group),
    0
  )
  const previewDocuments = useMemo<PreviewDocumentEntry[]>(
    () =>
      groups.flatMap((group) =>
        group.documents.flatMap((document) =>
          document.sessionDocumentId === null
            ? []
            : [
                {
                  groupId: group.id,
                  document,
                  sessionDocumentId: document.sessionDocumentId,
                },
              ]
        )
      ),
    [groups]
  )
  const selectedPreviewEntry = useMemo(
    () =>
      previewDocuments.find(
        (entry) => entry.sessionDocumentId === selectedPreviewDocumentId
      ) ?? null,
    [previewDocuments, selectedPreviewDocumentId]
  )
  const previewDocument = useMemo<DocumentPreviewTarget | null>(
    () =>
      selectedPreviewEntry
        ? clusterDocumentToPreviewTarget(selectedPreviewEntry.document)
        : null,
    [selectedPreviewEntry]
  )
  const pendingClusterGroups = useMemo(
    () => versionToGroups(pendingClusterVersion, metadataItems),
    [metadataItems, pendingClusterVersion]
  )
  const pendingClusterDocumentCount = pendingClusterGroups.reduce(
    (sum, group) => sum + group.documents.length,
    0
  )

  useEffect(() => {
    setOpenNodeIds(
      (previous) => new Set([...previous, ...flattenNodeIds(tree)])
    )
  }, [tree])

  useEffect(() => {
    if (
      selectedPreviewDocumentId !== null &&
      !previewDocuments.some(
        (entry) => entry.sessionDocumentId === selectedPreviewDocumentId
      )
    ) {
      setSelectedPreviewDocumentId(null)
    }
  }, [previewDocuments, selectedPreviewDocumentId])

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
        setCheckingClusters(false)
        setStatus("Chưa có session để lấy kết quả lập hồ sơ.")
        return
      }
      if (
        Date.now() - startedAt > CLUSTER_POLL_TIMEOUT_MS &&
        groups.length === 0 &&
        !displayedClusterVersionId
      ) {
        setLoading(false)
        setCheckingClusters(false)
        setStatus(
          "Quá thời gian chờ lập hồ sơ. Hãy kiểm tra worker/dispatcher backend."
        )
        return
      }

      try {
        const [version, buildStatus] = await Promise.all([
          getActiveClusters(sessionId),
          getClusterBuildStatus(sessionId).catch(() => null),
        ])
        if (cancelled) return

        const hasActiveBuildJob = Boolean(buildStatus?.active)
        const activeJobMode = hasActiveBuildJob
          ? clusterJobModeFromPayload(buildStatus?.job?.payload)
          : rebuildBaselineVersionId
            ? "update"
            : "new"
        const nextVersionId = version?.id ?? null
        const nextVersionMarker = nextVersionId ?? NO_CLUSTER_VERSION
        setActiveClusterVersionId(nextVersionId)
        const nextGroups = versionToGroups(version, metadataItems)
        const shouldDisplayInitialVersion =
          Boolean(version && nextVersionId) &&
          (!displayedClusterVersionId || groups.length === 0)
        const effectiveDisplayedVersionId = shouldDisplayInitialVersion
          ? nextVersionId
          : displayedClusterVersionId
        const displayedGroupsForStatus = shouldDisplayInitialVersion
          ? nextGroups
          : groups

        if (shouldDisplayInitialVersion && nextVersionId) {
          setGroups(nextGroups)
          setDisplayedClusterVersionId(nextVersionId)
          setPendingClusterVersion(null)
        }

        if (hasActiveBuildJob) {
          setCheckingClusters(false)
          setLoading(true)
          setClusterJobMode(activeJobMode)
          setClusterProgressPhase(
            (phase) =>
              normalizeClusterProgressPhase(phase) ??
              FIRST_CLUSTER_PROGRESS_PHASE_ID
          )
          setClusterCompletedPhases((previous) =>
            previous.size === CLUSTER_ALL_PHASE_IDS.length
              ? new Set()
              : previous
          )
          setClusterProgressMessage((message) =>
            isTerminalClusterProgressMessage(message)
              ? clusterProgressMessageForPhase(
                  FIRST_CLUSTER_PROGRESS_PHASE_ID,
                  activeJobMode
                )
              : message ||
                clusterProgressMessageForPhase(
                  FIRST_CLUSTER_PROGRESS_PHASE_ID,
                  activeJobMode
                )
          )
          setStatus(
            activeJobMode === "update"
              ? "Đang chờ backend tạo phiên bản hồ sơ mới từ feedback đã lưu."
              : "Đang chờ backend lập hồ sơ từ tài liệu đã xác nhận."
          )
          schedule()
          return
        }

        setLoading(false)
        setCheckingClusters(false)
        if (
          rebuildBaselineVersionId &&
          nextVersionMarker === rebuildBaselineVersionId
        ) {
          setRebuildBaselineVersionId(null)
          setClusterJobMode("update")
          setClusterProgressPhase(null)
          setClusterCompletedPhases(completedClusterPhaseSet())
          setClusterProgressMessage("Không có job cập nhật hồ sơ đang chạy.")
          setStatus(
            "Chưa ghi nhận phiên bản hồ sơ mới. Feedback đã lưu sẽ được áp dụng ở lần cập nhật hồ sơ tiếp theo."
          )
          schedule()
          return
        }

        if (
          version &&
          nextVersionId &&
          effectiveDisplayedVersionId &&
          nextVersionId !== effectiveDisplayedVersionId
        ) {
          if (rebuildBaselineVersionId) {
            setRebuildBaselineVersionId(null)
          }
          setPendingClusterVersion(version)
          setClusterJobMode(
            version.source === "user_feedback" ? "update" : "new"
          )
          setClusterProgressPhase(null)
          setClusterCompletedPhases(completedClusterPhaseSet())
          setClusterProgressMessage(
            "Đã có phiên bản hồ sơ mới. Bấm áp dụng để cập nhật giao diện."
          )
          setStatus(
            `Đã có cập nhật hồ sơ mới: phiên bản ${version.version_number} với ${nextGroups.length} hồ sơ.`
          )
          schedule()
          return
        }

        setPendingClusterVersion(null)
        if (rebuildBaselineVersionId) {
          setRebuildBaselineVersionId(null)
          toast.success("Đã có phiên bản hồ sơ mới từ feedback đã lưu.")
        }

        const clusteredIds = clusteredDocumentIds(version)
        const missingVerified = verifiedItems.filter(
          (item) => !clusteredIds.has(item.document_id)
        )
        const allVerifiedClustered =
          displayedGroupsForStatus.length > 0 &&
          (verifiedItems.length === 0 || missingVerified.length === 0)

        if (allVerifiedClustered) {
          setClusterProgressPhase(null)
          setClusterCompletedPhases(completedClusterPhaseSet())
          setClusterProgressMessage("Đã lập hồ sơ xong.")
          setStatus(
            `Đã lập ${displayedGroupsForStatus.length} hồ sơ từ ${verifiedItems.length} tài liệu đã xác nhận.`
          )
          schedule()
          return
        }

        if (displayedGroupsForStatus.length > 0 && missingVerified.length > 0) {
          setClusterProgressPhase(null)
          setClusterCompletedPhases(completedClusterPhaseSet())
          setClusterProgressMessage("Đã lập hồ sơ xong.")
          setStatus(
            `Đã có ${displayedGroupsForStatus.length} hồ sơ. Có ${missingVerified.length} tài liệu đã xác nhận chưa được cập nhật vào hồ sơ.`
          )
          schedule()
        } else {
          setClusterProgressPhase(null)
          setClusterProgressMessage("")
          setStatus("Chưa có kết quả lập hồ sơ từ backend.")
          schedule()
        }
      } catch (err) {
        if (cancelled) return
        setLoading(false)
        setCheckingClusters(false)
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
  }, [
    displayedClusterVersionId,
    groups,
    metadataItems,
    rebuildBaselineVersionId,
    rebuildPollKey,
    sessionId,
    verifiedItems,
  ])

  useEffect(() => {
    if (!sessionId || (!loading && !rebuildBaselineVersionId)) return

    let cancelled = false
    let afterId = 0
    let timeoutId: number | undefined

    const pollEvents = async () => {
      try {
        const response = await listSessionEvents(sessionId, {
          afterId,
          limit: 100,
        })
        if (cancelled) return
        for (const event of response.events) {
          afterId = Math.max(afterId, event.id)
          if (event.event_type === "clustering.progress") {
            const phase = String(event.payload?.phase ?? "")
            if (phase) {
              const normalizedPhase = normalizeClusterProgressPhase(phase)
              setClusterProgressPhase(normalizedPhase)
              setClusterCompletedPhases((previous) => {
                if (phase === "completed") {
                  return completedClusterPhaseSet()
                }
                if (!normalizedPhase) return previous
                return completedClusterPhaseSetBefore(normalizedPhase)
              })
            }
            if (event.message) {
              setClusterProgressMessage(dossierUiMessage(event.message))
            }
          }
          if (event.event_type === "clustering.version.created") {
            setClusterProgressPhase(null)
            setClusterCompletedPhases(
              new Set(CLUSTER_PROGRESS_PHASES.map((phase) => phase.id))
            )
            setClusterProgressMessage("Đã tạo phiên bản hồ sơ mới.")
          }
        }
      } catch {
        // The cluster polling loop owns user-facing errors.
      }
      if (!cancelled) timeoutId = window.setTimeout(pollEvents, 1_500)
    }

    void pollEvents()
    return () => {
      cancelled = true
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [loading, rebuildBaselineVersionId, sessionId])

  useEffect(() => {
    if (!loading && !checkingClusters && !rebuildBaselineVersionId) return

    setClusterProgressPhase(
      (phase) =>
        normalizeClusterProgressPhase(phase) ?? FIRST_CLUSTER_PROGRESS_PHASE_ID
    )
    setClusterProgressMessage((message) =>
      isTerminalClusterProgressMessage(message)
        ? clusterProgressMessageForPhase(
            FIRST_CLUSTER_PROGRESS_PHASE_ID,
            clusterJobMode
          )
        : message
    )

    const intervalId = window.setInterval(() => {
      setClusterProgressPhase((phase) => {
        const nextPhase = nextClusterProgressPhase(phase)
        setClusterCompletedPhases(completedClusterPhaseSetBefore(nextPhase))
        setClusterProgressMessage(
          clusterProgressMessageForPhase(nextPhase, clusterJobMode)
        )
        return nextPhase
      })
    }, CLUSTER_PROGRESS_TICK_MS)

    return () => window.clearInterval(intervalId)
  }, [checkingClusters, clusterJobMode, loading, rebuildBaselineVersionId])

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
      toast.error(
        "Tài liệu này chưa có mã trong session để ghi nhận di chuyển."
      )
      return
    }

    const moving = draggedDocument
    const sessionDocumentId = draggedDocument.document.sessionDocumentId
    setDraggedDocument(null)
    setDropTargetId(null)
    setGroups((previous) =>
      moveDocumentLocally(previous, moving, targetClusterId)
    )
    setStatus("Đang lưu feedback di chuyển tài liệu...")

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
      setStatus(
        "Đã lưu feedback di chuyển tài liệu. Bấm Cập nhật hồ sơ khi bạn muốn lập hồ sơ lại."
      )
      toast.success("Đã lưu feedback chuyển tài liệu.")
    } catch (err) {
      setStatus("Không lưu được feedback di chuyển tài liệu. Vui lòng thử lại.")
      toast.error(
        err instanceof Error
          ? err.message
          : "Không gửi được feedback di chuyển tài liệu."
      )
    }
  }

  const handleRebuildClusters = async () => {
    if (!sessionId) {
      toast.error("Chưa có session để cập nhật hồ sơ.")
      return
    }
    if (pendingClusterVersion) {
      toast.error(
        "Đang có phiên bản hồ sơ mới chờ áp dụng. Hãy áp dụng trước khi gửi job cập nhật khác."
      )
      return
    }
    setRebuildSubmitting(true)
    try {
      const currentVersion = await getActiveClusters(sessionId)
      const baselineVersionId =
        currentVersion?.id ?? activeClusterVersionId ?? NO_CLUSTER_VERSION
      setActiveClusterVersionId(
        currentVersion?.id ?? activeClusterVersionId ?? null
      )
      const response = await enqueueClusterBuild(sessionId, {
        source: "user_feedback",
      })
      setRebuildBaselineVersionId(baselineVersionId)
      setRebuildPollKey((key) => key + 1)
      setLoading(true)
      setCheckingClusters(false)
      setClusterJobMode("update")
      setClusterProgressPhase(FIRST_CLUSTER_PROGRESS_PHASE_ID)
      setClusterProgressMessage(
        clusterProgressMessageForPhase(
          FIRST_CLUSTER_PROGRESS_PHASE_ID,
          "update"
        )
      )
      setClusterCompletedPhases(new Set())
      setStatus(
        "Đã gửi job cập nhật hồ sơ. Đang chờ backend tạo phiên bản mới."
      )
      toast.success(
        response.status === "already_queued_or_running"
          ? "Đã có job cập nhật hồ sơ đang chạy."
          : "Đã gửi job cập nhật hồ sơ."
      )
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Không gửi được job cập nhật hồ sơ."
      )
    } finally {
      setRebuildSubmitting(false)
    }
  }

  const handleApplyPendingClusterVersion = () => {
    if (!pendingClusterVersion) return

    const nextGroups = versionToGroups(pendingClusterVersion, metadataItems)
    const clusteredIds = clusteredDocumentIds(pendingClusterVersion)
    const missingVerified = verifiedItems.filter(
      (item) => !clusteredIds.has(item.document_id)
    )
    setGroups(nextGroups)
    setDisplayedClusterVersionId(pendingClusterVersion.id)
    setActiveClusterVersionId(pendingClusterVersion.id)
    setPendingClusterVersion(null)
    if (pendingClusterVersion.source === "user_feedback") {
      setPendingFeedbackCount(0)
    }
    setClusterJobMode(
      pendingClusterVersion.source === "user_feedback" ? "update" : "new"
    )
    setClusterProgressPhase(null)
    setClusterCompletedPhases(completedClusterPhaseSet())
    setClusterProgressMessage("Đã áp dụng phiên bản hồ sơ mới.")
    setStatus(
      nextGroups.length > 0 &&
        (verifiedItems.length === 0 || missingVerified.length === 0)
        ? `Đã lập ${nextGroups.length} hồ sơ từ ${verifiedItems.length} tài liệu đã xác nhận.`
        : nextGroups.length > 0 && missingVerified.length > 0
          ? `Đã có ${nextGroups.length} hồ sơ. Có ${missingVerified.length} tài liệu đã xác nhận chưa được cập nhật vào hồ sơ.`
          : "Chưa có kết quả lập hồ sơ từ backend."
    )
    toast.success("Đã áp dụng phiên bản hồ sơ mới.")
  }

  const handleSelectPreviewDocument = (document: ClusterDocument) => {
    if (document.sessionDocumentId === null) {
      toast.error("Tài liệu này chưa có mã trong session để lấy preview.")
      return
    }
    setSelectedPreviewDocumentId(document.sessionDocumentId)
  }

  const handleFinish = () => {
    if (pendingClusterVersion) {
      toast.error("Có phiên bản hồ sơ mới. Hãy áp dụng trước khi tạo mục lục.")
      return
    }
    if (loading || rebuildSubmitting || rebuildBaselineVersionId) {
      toast.error("Đang cập nhật hồ sơ. Vui lòng chờ xong rồi tạo mục lục.")
      return
    }
    onFinish()
  }

  const activeClusterProgressLabel = clusterProgressPhase
    ? clusterProgressLabel(clusterProgressPhase)
    : ""
  const resultStatusText =
    loading || checkingClusters
      ? activeClusterProgressLabel
        ? `${activeClusterProgressLabel}. ${status}`
        : clusterJobMode === "update"
          ? `Đang cập nhật hồ sơ. ${status}`
          : `Đang lập hồ sơ mới. ${status}`
      : status
  const showClusterProgress =
    loading ||
    checkingClusters ||
    Boolean(clusterProgressMessage) ||
    groups.length > 0
  const feedbackActionsPanel = (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D8E1EC] bg-white px-4 py-3 shadow-sm">
      <p className="min-w-[260px] flex-1 text-sm text-[#64748B]">
        {pendingFeedbackCount > 0
          ? `Có ${pendingFeedbackCount} feedback đã lưu và đang chờ cập nhật hồ sơ.`
          : "Feedback di chuyển tài liệu sẽ được lưu lại và chỉ áp dụng khi cập nhật hồ sơ."}
      </p>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {previewDocument && (
          <label className="flex items-center gap-2 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] px-2 py-1 text-[11px] font-medium text-[#475569]">
            <PanelRight className="size-3.5 text-[#0052FF]" />
            <span className="whitespace-nowrap">Preview</span>
            <input
              type="range"
              min={28}
              max={55}
              value={previewWidthPercent}
              onChange={(event) =>
                setPreviewWidthPercent(Number(event.target.value))
              }
              className="h-1.5 w-24 accent-[#0052FF] sm:w-32"
              aria-label="Điều chỉnh kích thước preview"
            />
          </label>
        )}
        <Button
          variant="outline"
          onClick={() => void handleRebuildClusters()}
          disabled={
            rebuildSubmitting ||
            loading ||
            !sessionId ||
            groups.length === 0 ||
            Boolean(pendingClusterVersion)
          }
        >
          {rebuildSubmitting ? (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          ) : (
            <RefreshCw data-icon="inline-start" />
          )}
          Cập nhật hồ sơ
        </Button>
        <Button
          onClick={handleFinish}
          disabled={
            groups.length === 0 ||
            loading ||
            rebuildSubmitting ||
            Boolean(rebuildBaselineVersionId) ||
            Boolean(pendingClusterVersion)
          }
        >
          <CheckCircle2 data-icon="inline-start" />
          Tạo mục lục
        </Button>
      </div>
    </div>
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            className="text-2xl text-[#0F172A]"
            style={{ fontFamily: "'Calistoga', Georgia, serif" }}
          >
            Kết quả
          </h2>
          <p className="mt-1 text-sm text-[#475569]">
            Tài liệu đã được gắn vào phông lưu trữ. Các hồ sơ có thể được điều
            chỉnh bằng kéo thả.
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm text-[#475569]">
            {loading || checkingClusters ? (
              <Loader2 className="size-4 animate-spin text-[#0052FF]" />
            ) : (
              <CheckCircle2 className="size-4 text-emerald-600" />
            )}
            {resultStatusText}
          </p>
        </div>
        <div className="grid shrink-0 grid-cols-3 gap-2">
          <Metric label="Hồ sơ" value={groups.length} />
          <Metric label="Tài liệu" value={totalFiles} />
          <Metric label="Trang" value={totalPages} />
        </div>
      </div>

      {showClusterProgress && (
        <ProgressTimeline
          phases={CLUSTER_PROGRESS_PHASES}
          activePhase={clusterProgressPhase}
          completedPhases={clusterCompletedPhases}
          title={
            clusterJobMode === "update"
              ? "Tiến độ cập nhật hồ sơ"
              : "Tiến độ lập hồ sơ"
          }
          message={
            clusterProgressMessage ||
            "Backend đang lập hồ sơ từ các tài liệu đã xác nhận."
          }
        />
      )}

      {pendingClusterVersion && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#BFD3FF] bg-[#F8FAFF] px-4 py-3 shadow-sm">
          <div className="min-w-[260px] flex-1">
            <p className="text-sm font-semibold text-[#0F172A]">
              Đã có cập nhật hồ sơ mới
            </p>
            <p className="mt-1 text-sm text-[#475569]">
              Phiên bản {pendingClusterVersion.version_number} có{" "}
              {pendingClusterGroups.length} hồ sơ và{" "}
              {pendingClusterDocumentCount} tài liệu. Bấm áp dụng để chuyển
              giao diện sang phiên bản mới.
            </p>
          </div>
          <Button onClick={handleApplyPendingClusterVersion}>
            <RefreshCw data-icon="inline-start" />
            Áp dụng phiên bản mới
          </Button>
        </div>
      )}

      <div
        className={cn(
          "grid min-w-0 gap-4",
          previewDocument &&
            "xl:[grid-template-columns:var(--result-preview-columns)]"
        )}
        style={
          previewDocument
            ? ({
                "--result-preview-columns": `minmax(0, ${
                  100 - previewWidthPercent
                }fr) minmax(300px, ${previewWidthPercent}fr)`,
              } as CSSProperties)
            : undefined
        }
      >
        <div className="min-w-0 rounded-2xl border border-[#D8E1EC] bg-white shadow-sm">
          <ScrollArea className="h-[560px] p-2 pr-3 sm:p-3 sm:pr-4">
            <div className="flex min-w-0 flex-col gap-1 pr-2 pb-2">
              {tree.map((node) => (
                <ResultNode
                  key={node.id}
                  node={node}
                  depth={0}
                  openNodeIds={openNodeIds}
                  draggedDocument={draggedDocument}
                  dropTargetId={dropTargetId}
                  compact={Boolean(previewDocument)}
                  selectedPreviewDocumentId={selectedPreviewDocumentId}
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
                  onSelectPreview={handleSelectPreviewDocument}
                />
              ))}
              {tree.length === 0 && (
                <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-8 text-center text-sm text-muted-foreground">
                  {checkingClusters
                    ? "Đang kiểm tra kết quả lập hồ sơ từ backend."
                    : loading
                      ? "Đang chờ kết quả lập hồ sơ từ backend."
                      : "Chưa có kết quả lập hồ sơ từ backend."}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
        {previewDocument && (
          <DocumentPdfPreview
            sessionId={sessionId}
            document={previewDocument}
            className="h-[560px] min-w-0"
            onClose={() => setSelectedPreviewDocumentId(null)}
          />
        )}
      </div>
      {feedbackActionsPanel}
    </motion.div>
  )
}

function ResultNode({
  node,
  depth,
  openNodeIds,
  draggedDocument,
  dropTargetId,
  compact,
  selectedPreviewDocumentId,
  onToggle,
  onDragStart,
  onDragEnd,
  onDragEnter,
  onDropOnDossier,
  onSelectPreview,
}: {
  node: ResultTreeNode
  depth: number
  openNodeIds: Set<string>
  draggedDocument: DraggedDocument | null
  dropTargetId: string | null
  compact: boolean
  selectedPreviewDocumentId: number | null
  onToggle: (nodeId: string) => void
  onDragStart: (document: ClusterDocument, fromClusterId: string) => void
  onDragEnd: () => void
  onDragEnter: (nodeId: string | null) => void
  onDropOnDossier: (targetClusterId: string) => void
  onSelectPreview: (document: ClusterDocument) => void
}) {
  const open = openNodeIds.has(node.id)
  const isDossier = node.type === "dossier"
  const group = node.group
  const canDrop = Boolean(
    draggedDocument && group && draggedDocument.fromClusterId !== group.id
  )
  const primaryDocument = group?.documents.find(
    (document) => document.sessionDocumentId !== null
  )
  const indentStep = compact ? 14 : 20
  const displayLabel =
    compact && isDossier ? truncateWithDots(node.label, 76) : node.label

  return (
    <div>
      <div
        className={cn(
          "group flex min-h-10 min-w-0 items-center gap-2 rounded-xl px-2 py-1.5 transition-all",
          isDossier ? "border border-transparent" : "",
          canDrop && dropTargetId === node.id
            ? "border-[#0052FF]/40 bg-[#EAF1FF] shadow-[0_8px_24px_rgba(0,82,255,0.10)]"
            : "hover:bg-[#F8FAFC]"
        )}
        style={{ paddingLeft: `${8 + depth * indentStep}px` }}
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
            open ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )
          ) : (
            <span className="size-3.5" />
          )}
        </button>

        {open ? (
          <FolderOpen className="size-4 shrink-0 text-[#0052FF]" />
        ) : (
          <Folder className="size-4 shrink-0 text-[#0052FF]" />
        )}

        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "truncate text-sm",
                isDossier
                  ? "font-semibold text-[#0F172A]"
                  : "font-medium text-[#0F172A]"
              )}
              title={node.label}
            >
              {displayLabel}
            </span>
            {group?.requiresReview && (
              <span className="flex shrink-0 items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                <AlertTriangle className="size-3" /> Cần xem
              </span>
            )}
          </div>
          {isDossier && group && (
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-[#64748B]">
              <span>
                {group.dossierNumber
                  ? `Số ${group.dossierNumber}`
                  : "Chưa có số hồ sơ"}
              </span>
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

        <div className="flex shrink-0 items-center gap-1.5 pl-1">
          {isDossier && canDrop && (
            <span className="flex items-center gap-1 rounded-full bg-[#DBEAFE] px-2 py-1 text-[10px] font-semibold text-[#0052FF]">
              <MoveRight className="size-3" />
              <span className={cn(compact && "hidden 2xl:inline")}>
                Chuyển vào đây
              </span>
            </span>
          )}
          {isDossier && primaryDocument && (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              title="Preview tài liệu đầu tiên"
              onClick={(event) => {
                event.stopPropagation()
                onSelectPreview(primaryDocument)
              }}
            >
              <Eye className="size-3.5" />
            </Button>
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
              compact={compact}
              selected={
                document.sessionDocumentId !== null &&
                document.sessionDocumentId === selectedPreviewDocumentId
              }
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onSelectPreview={onSelectPreview}
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
              compact={compact}
              selectedPreviewDocumentId={selectedPreviewDocumentId}
              onToggle={onToggle}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragEnter={onDragEnter}
              onDropOnDossier={onDropOnDossier}
              onSelectPreview={onSelectPreview}
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
  compact,
  selected,
  onDragStart,
  onDragEnd,
  onSelectPreview,
}: {
  document: ClusterDocument
  clusterId: string
  depth: number
  compact: boolean
  selected: boolean
  onDragStart: (document: ClusterDocument, fromClusterId: string) => void
  onDragEnd: () => void
  onSelectPreview: (document: ClusterDocument) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [dragging, setDragging] = useState(false)
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
  const signer = metadataText(document.metadata, ["signer", "nguoi_ky"])
  const displaySummary = compact
    ? truncateWithDots(summary, 108)
    : truncateWithDots(summary, 190)
  const metadataSummary = compact ? truncateWithDots(summary, 260) : summary
  const indentStep = compact ? 14 : 20

  return (
    <div>
      <div
        draggable
        onClick={() => {
          if (!dragging) {
            setExpanded((value) => !value)
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
          "mr-1 flex min-w-0 cursor-pointer items-start gap-2 rounded-xl px-2 py-1.5 transition-colors active:cursor-grabbing",
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
        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#0052FF] shadow-[0_4px_12px_rgba(0,82,255,0.24)]">
          <FileText className="size-3.5 text-white" />
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 items-center gap-2 overflow-hidden">
            <span className="truncate font-roboto text-xs font-medium text-[#334155]">
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
                  compact && "hidden 2xl:flex"
                )}
              >
                <CalendarDays className="size-3" /> {issuedDate}
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
              className="mt-0.5 truncate text-xs text-[#64748B]"
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
            setExpanded((value) => !value)
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
          className="mt-1 mr-3 rounded-2xl border border-[#D8E1EC] bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
          style={{
            marginLeft: `${8 + (depth + 1) * indentStep}px`,
          }}
        >
          <div className="mb-3 flex items-start gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#EAF1FF] text-[#0052FF]">
              <FileText className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#0F172A]">
                {document.fileName}
              </p>
              <p className="truncate text-[11px] text-[#64748B]">
                {document.filePath}
              </p>
            </div>
          </div>
          <div className="grid gap-2 text-xs">
            <PreviewField label="Trích yếu" value={metadataSummary} wide />
            <div
              className={cn(
                "grid grid-cols-1 gap-2",
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
    <div
      className={cn(
        "min-w-0 rounded-lg bg-[#F8FAFC] px-2.5 py-2",
        wide && "col-span-full"
      )}
    >
      <p className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold tracking-[0.08em] text-[#94A3B8] uppercase">
        {icon}
        {label}
      </p>
      <p
        className={cn(
          "text-xs font-medium text-[#0F172A]",
          wide ? "line-clamp-3" : "truncate"
        )}
      >
        {value || "Chưa có"}
      </p>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-20 rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-right shadow-sm">
      <p className="font-roboto text-[10px] font-semibold tracking-[0.12em] text-[#64748B] uppercase">
        {label}
      </p>
      <p className="text-lg font-semibold text-[#0F172A]">{value}</p>
    </div>
  )
}

function CountBadge({ value }: { value: number }) {
  if (value <= 0) return null
  return (
    <span className="flex min-w-6 shrink-0 justify-center rounded-full bg-[#EAF1FF] px-2 py-0.5 font-roboto text-[10px] font-bold text-[#0052FF]">
      {value}
    </span>
  )
}

function completedClusterPhaseSet(): Set<string> {
  return new Set(CLUSTER_ALL_PHASE_IDS)
}

function completedClusterPhaseSetBefore(phaseId: string): Set<string> {
  const phaseIndex = CLUSTER_PROGRESS_PHASES.findIndex(
    (phase) => phase.id === phaseId
  )
  return new Set(
    CLUSTER_PROGRESS_PHASES.slice(0, Math.max(phaseIndex, 0)).map(
      (phase) => phase.id
    )
  )
}

function normalizeClusterProgressPhase(
  phase: string | null | undefined
): string | null {
  if (!phase || phase === "completed") return null
  if (CLUSTER_ALL_PHASE_IDS.includes(phase)) return phase
  return CLUSTER_PROGRESS_PHASE_ALIASES[phase] ?? null
}

function nextClusterProgressPhase(phase: string | null | undefined): string {
  const currentPhase =
    normalizeClusterProgressPhase(phase) ?? FIRST_CLUSTER_PROGRESS_PHASE_ID
  const currentIndex = CLUSTER_PROGRESS_PHASES.findIndex(
    (item) => item.id === currentPhase
  )
  const nextIndex = Math.min(
    Math.max(currentIndex, 0) + 1,
    CLUSTER_PROGRESS_PHASES.length - 1
  )
  return CLUSTER_PROGRESS_PHASES[nextIndex].id
}

function clusterProgressLabel(phaseId: string): string {
  return (
    CLUSTER_PROGRESS_PHASES.find((phase) => phase.id === phaseId)?.label ?? ""
  )
}

function clusterProgressMessageForPhase(
  phaseId: string,
  mode: ClusterJobMode
): string {
  switch (phaseId) {
    case "updating_dossiers":
      return mode === "update"
        ? "Đang áp dụng feedback và cập nhật cấu trúc hồ sơ."
        : "Đang gom tài liệu đã xác nhận vào hồ sơ."
    case "naming_dossiers":
      return "Đang đặt tiêu đề hồ sơ từ nội dung tài liệu."
    case "classifying_dossiers":
      return "Đang phân loại hồ sơ theo phương án chỉnh lý."
    case "finding_retention":
      return "Đang tìm thời hạn bảo quản phù hợp."
    case "reviewing_dossiers":
      return "Đang rà soát kết quả trước khi hiển thị phiên bản mới."
    default:
      return mode === "update"
        ? "Đang cập nhật hồ sơ từ feedback đã lưu."
        : "Đang lập hồ sơ mới từ các tài liệu đã xác nhận."
  }
}

function isTerminalClusterProgressMessage(message: string): boolean {
  return (
    !message ||
    message.startsWith("Đã ") ||
    message.includes("xong") ||
    message.includes("Không có job")
  )
}

function dossierUiMessage(message: string): string {
  return message
    .replace(/phiên bản cụm/g, "phiên bản hồ sơ")
    .replace(/cập nhật cụm/g, "cập nhật hồ sơ")
    .replace(/phân cụm/g, "lập hồ sơ")
    .replace(/cụm/g, "hồ sơ")
}

function clusterJobModeFromPayload(
  payload: Record<string, unknown> | null | undefined
): ClusterJobMode {
  return payload?.source === "user_feedback" ? "update" : "new"
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

    const path = group.classificationPath?.length
      ? group.classificationPath
      : ["Chưa phân loại"]
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
  node.documentCount = node.children.reduce(
    (sum, child) => sum + child.documentCount,
    0
  )
  node.pageCount = node.children.reduce(
    (sum, child) => sum + child.pageCount,
    0
  )
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
      return {
        ...group,
        documents,
        files: documents.map((document) => document.filePath),
      }
    }
    if (group.id === targetClusterId) {
      const documents = [
        ...group.documents,
        { ...moving.document, positionIndex: group.documents.length },
      ]
      return {
        ...group,
        documents,
        files: documents.map((document) => document.filePath),
      }
    }
    return group
  })
}

function dossierYearLabel(group: ClusterGroup): string {
  const year =
    yearFromText(group.startDate) ||
    group.documents
      .map((document) =>
        yearFromText(
          metadataText(document.metadata, ["issued_date", "ngay_ban_hanh"])
        )
      )
      .find(Boolean)
  return year ? `Năm ${year}` : "Không rõ năm"
}

function dossierPageCount(group: ClusterGroup): number {
  if (typeof group.pageCount === "number") return group.pageCount
  return group.documents.reduce(
    (sum, document) => sum + (document.pageCount ?? 0),
    0
  )
}

function formatDateRange(
  startDate?: string | null,
  endDate?: string | null
): string {
  if (startDate && endDate && startDate !== endDate)
    return `${startDate} - ${endDate}`
  return startDate || endDate || "Chưa rõ thời gian"
}

function metadataText(
  metadata: Record<string, unknown>,
  keys: string[]
): string {
  for (const key of keys) {
    const value = metadata[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number") return String(value)
  }
  return ""
}

function truncateWithDots(value: string, maxLength: number): string {
  const text = value.trim()
  if (text.length <= maxLength) return text
  return `${text.slice(0, Math.max(1, maxLength - 4)).trimEnd()}....`
}

function clusterDocumentToPreviewTarget(
  document: ClusterDocument
): DocumentPreviewTarget {
  return {
    id: document.sessionDocumentId,
    fileName: document.fileName,
    dataPath: document.filePath,
  }
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
