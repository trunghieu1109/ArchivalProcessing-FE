import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"
import {
  AlertTriangle,
  Archive,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Edit2,
  Eye,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderClock,
  FolderOpen,
  GripVertical,
  Loader2,
  MoveRight,
  RefreshCw,
  Signature,
  Undo2,
  Upload,
} from "lucide-react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/shared/lib/utils"
import {
  DocumentPdfPreview,
  type DocumentPreviewTarget,
} from "@/features/upload/components/DocumentPdfPreview"
import {
  activateClusterVersion,
  artifactDownloadUrl,
  enqueueClusterBuild,
  exportMetadataSnapshot,
  getActiveClusters,
  getClusterBuildStatus,
  importMetadataBoxNumbers,
  listSessionEvents,
  moveDocumentBetweenClusters,
  patchSessionDossier,
  type ClusterVersionResponse,
  type MetadataSnapshotGroup,
  type SessionDossierPatchPayload,
  type SessionDossierSummary,
} from "@/features/upload/api/sessionApi"
import { ProgressTimeline } from "@/features/upload/components/ProgressTimeline"
import {
  ensureTemporaryFolderGroup,
  versionToGroups,
  type ClusterDocument,
  type ClusterDocumentWarning,
  type ClusterGroup,
} from "@/features/upload/lib/clusterGroups"
import {
  signatureTagInfo,
  type SignatureTagKind,
} from "@/features/upload/lib/signatureStatus"
import type { PdfMetadata } from "@/features/upload/types"

const CLUSTER_POLL_INTERVAL_MS = 3_000
const CLUSTER_POLL_TIMEOUT_MS = 10 * 60 * 1_000
const CLUSTER_PROGRESS_TICK_MS = 4_500
const RESULT_TREE_AUTO_SCROLL_EDGE_PX = 84
const RESULT_TREE_AUTO_SCROLL_MAX_STEP_PX = 22
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

type ClusterJobMode = "new" | "update" | "plan_reanalysis" | "file_register"

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
  type: "year" | "classification" | "dossier" | "temporary"
  children: ResultTreeNode[]
  group?: ClusterGroup
  documentCount: number
  pageCount: number
}

const UNKNOWN_YEAR_LABEL = "Không rõ năm"
const UNCLASSIFIED_LABEL = "Chưa phân loại"

interface DossierMetadataDraft {
  title: string
  dossierNumber: string
  boxNumber: string
  folderName: string
  retentionPeriod: string
}

type DossierMetadataDraftKey = keyof DossierMetadataDraft

const DOSSIER_METADATA_EDIT_FIELDS: Array<{
  key: DossierMetadataDraftKey
  label: string
  rows: number
}> = [
  { key: "title", label: "Tiêu đề hồ sơ", rows: 4 },
  { key: "dossierNumber", label: "Số hồ sơ", rows: 1 },
  { key: "boxNumber", label: "Số hộp", rows: 1 },
  { key: "folderName", label: "Tên thư mục", rows: 2 },
  { key: "retentionPeriod", label: "Thời hạn bảo quản", rows: 2 },
]

export function FinalResult({
  sessionId,
  groups: initialGroups,
  metadataItems = [],
  onFinish,
}: FinalResultProps) {
  const initialDossierCount = regularDossierCount(initialGroups)
  const [groups, setGroups] = useState<ClusterGroup[]>(() =>
    ensureTemporaryFolderGroup(initialGroups)
  )
  const [status, setStatus] = useState(
    initialDossierCount > 0
      ? `Đã lập ${initialDossierCount} hồ sơ.`
      : "Đang kiểm tra kết quả lập hồ sơ..."
  )
  const [loading, setLoading] = useState(false)
  const [checkingClusters, setCheckingClusters] = useState(
    initialDossierCount === 0
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
  const [displayedClusterVersion, setDisplayedClusterVersion] =
    useState<ClusterVersionResponse | null>(null)
  const [pendingClusterVersion, setPendingClusterVersion] =
    useState<ClusterVersionResponse | null>(null)
  const [rebuildBaselineVersionId, setRebuildBaselineVersionId] = useState<
    string | null
  >(null)
  const [rebuildPollKey, setRebuildPollKey] = useState(0)
  const [rebuildSubmitting, setRebuildSubmitting] = useState(false)
  const [restoringClusterVersion, setRestoringClusterVersion] = useState(false)
  const [metadataExporting, setMetadataExporting] = useState(false)
  const [metadataImporting, setMetadataImporting] = useState(false)
  const [savingDossierMetadataId, setSavingDossierMetadataId] = useState<
    string | null
  >(null)
  const [pendingFeedbackCount, setPendingFeedbackCount] = useState(0)
  const [selectedPreviewDocumentId, setSelectedPreviewDocumentId] = useState<
    number | null
  >(null)
  const [previewWidthPercent, setPreviewWidthPercent] = useState(50)
  const previewLayoutRef = useRef<HTMLDivElement | null>(null)
  const metadataImportInputRef = useRef<HTMLInputElement | null>(null)
  const resultTreeScrollRef = useRef<HTMLDivElement | null>(null)
  const resultTreeDragYRef = useRef<number | null>(null)
  const resultTreeAutoScrollFrameRef = useRef<number | null>(null)
  const [clusterJobMode, setClusterJobMode] = useState<ClusterJobMode>("new")
  const [clusterProgressPhase, setClusterProgressPhase] = useState<
    string | null
  >(null)
  const [clusterProgressMessage, setClusterProgressMessage] = useState(
    initialDossierCount > 0 ? "Đã lập hồ sơ xong." : ""
  )
  const [clusterCompletedPhases, setClusterCompletedPhases] = useState<
    Set<string>
  >(() => (initialDossierCount > 0 ? completedClusterPhaseSet() : new Set()))

  const verifiedItems = useMemo(
    () => metadataItems.filter((item) => item.review_status === "verified"),
    [metadataItems]
  )
  const tree = useMemo(() => buildResultTree(groups), [groups])
  const totalDossiers = regularDossierCount(groups)
  const hasClusterData = groups.some(
    (group) => !group.isTemporary || group.documents.length > 0
  )
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
  const pendingDossierCount = regularDossierCount(pendingClusterGroups)

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
            ? clusterJobMode
            : "new"
        const nextVersionId = version?.id ?? null
        const nextVersionMarker = nextVersionId ?? NO_CLUSTER_VERSION
        setActiveClusterVersionId(nextVersionId)
        const nextGroups = versionToGroups(version, metadataItems)
        const shouldDisplayInitialVersion =
          Boolean(version && nextVersionId) &&
          (!displayedClusterVersionId || !hasClusterData)
        const effectiveDisplayedVersionId = shouldDisplayInitialVersion
          ? nextVersionId
          : displayedClusterVersionId
        const displayedGroupsForStatus = shouldDisplayInitialVersion
          ? nextGroups
          : groups

        if (shouldDisplayInitialVersion && nextVersionId) {
          setGroups(nextGroups)
          setDisplayedClusterVersionId(nextVersionId)
          setDisplayedClusterVersion(version)
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
          if (activeJobMode === "plan_reanalysis") {
            setStatus(
              "Đang chờ backend lập lại hồ sơ theo phương án chỉnh lý và thời hạn bảo quản mới."
            )
          } else if (activeJobMode === "file_register") {
            setStatus(
              "Đang chờ backend lập lại hồ sơ theo phương án tập lưu."
            )
          } else {
            setStatus(
            activeJobMode === "update"
              ? "Đang chờ backend tạo phiên bản hồ sơ mới từ feedback đã lưu."
              : "Đang chờ backend lập hồ sơ từ tài liệu đã xác nhận."
            )
          }
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
          setClusterJobMode(activeJobMode)
          setClusterProgressPhase(null)
          setClusterCompletedPhases(completedClusterPhaseSet())
          setClusterProgressMessage(
            activeJobMode === "file_register"
              ? "Không có job lập lại hồ sơ theo tập lưu đang chạy."
              : "Không có job cập nhật hồ sơ đang chạy."
          )
          setStatus(
            activeJobMode === "file_register"
              ? "Chưa ghi nhận phiên bản hồ sơ tập lưu mới."
              : "Chưa ghi nhận phiên bản hồ sơ mới. Feedback đã lưu sẽ được áp dụng ở lần cập nhật hồ sơ tiếp theo."
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
          setClusterJobMode(clusterJobModeFromSource(version.source))
          setClusterProgressPhase(null)
          setClusterCompletedPhases(completedClusterPhaseSet())
          setClusterProgressMessage(
            "Đã có phiên bản hồ sơ mới. Bấm áp dụng để cập nhật giao diện."
          )
          setStatus(
            `Đã có cập nhật hồ sơ mới: phiên bản ${version.version_number} với ${regularDossierCount(nextGroups)} hồ sơ.`
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
          displayedGroupsForStatus.some(
            (group) => group.documents.length > 0
          ) &&
          (verifiedItems.length === 0 || missingVerified.length === 0)
        const displayedDossierCount = regularDossierCount(
          displayedGroupsForStatus
        )
        const displayedTemporaryCount = temporaryDocumentCount(
          displayedGroupsForStatus
        )

        if (allVerifiedClustered) {
          setClusterProgressPhase(null)
          setClusterCompletedPhases(completedClusterPhaseSet())
          setClusterProgressMessage("Đã lập hồ sơ xong.")
          setStatus(
            displayedDossierCount > 0
              ? `Đã lập ${displayedDossierCount} hồ sơ từ ${verifiedItems.length} tài liệu đã xác nhận.${displayedTemporaryCount > 0 ? ` Có ${displayedTemporaryCount} tài liệu trong Thư mục tạm.` : ""}`
              : `Có ${displayedTemporaryCount} tài liệu trong Thư mục tạm; chưa có hồ sơ để tạo mục lục.`
          )
          schedule()
          return
        }

        if (displayedDossierCount > 0 && missingVerified.length > 0) {
          setClusterProgressPhase(null)
          setClusterCompletedPhases(completedClusterPhaseSet())
          setClusterProgressMessage("Đã lập hồ sơ xong.")
          setStatus(
            `Đã có ${displayedDossierCount} hồ sơ. Có ${missingVerified.length} tài liệu đã xác nhận chưa được cập nhật vào hồ sơ.`
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
    clusterJobMode,
    groups,
    hasClusterData,
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

  const stopResultTreeAutoScroll = () => {
    if (resultTreeAutoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(resultTreeAutoScrollFrameRef.current)
      resultTreeAutoScrollFrameRef.current = null
    }
    resultTreeDragYRef.current = null
  }

  useEffect(() => {
    if (!draggedDocument) {
      stopResultTreeAutoScroll()
      return
    }

    const handleWindowDragOver = (event: DragEvent) => {
      resultTreeDragYRef.current = event.clientY
    }

    const tick = () => {
      const container = resultTreeScrollRef.current
      const clientY = resultTreeDragYRef.current
      if (container && clientY !== null) {
        autoScrollResultTree(container, clientY)
      }
      resultTreeAutoScrollFrameRef.current = window.requestAnimationFrame(tick)
    }

    window.addEventListener("dragover", handleWindowDragOver)
    resultTreeAutoScrollFrameRef.current = window.requestAnimationFrame(tick)

    return () => {
      window.removeEventListener("dragover", handleWindowDragOver)
      stopResultTreeAutoScroll()
    }
  }, [draggedDocument])

  const handleResultTreeDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!draggedDocument) return
    resultTreeDragYRef.current = event.clientY
  }

  const handleDropOnDossier = async (targetClusterId: string) => {
    if (!draggedDocument) return
    if (draggedDocument.fromClusterId === targetClusterId) {
      stopResultTreeAutoScroll()
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
    const targetIsTemporary = Boolean(
      groups.find((group) => group.id === targetClusterId)?.isTemporary
    )
    const sessionDocumentId = draggedDocument.document.sessionDocumentId
    stopResultTreeAutoScroll()
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
          action: targetIsTemporary
            ? "move_to_temporary_folder"
            : "manual_move",
          document_id: moving.document.documentId,
          file_name: moving.document.fileName,
          source_cluster_id: moving.fromClusterId,
          target_cluster_id: targetClusterId,
        },
      })
      setPendingFeedbackCount((count) => count + 1)
      setStatus(
        targetIsTemporary
          ? "Đã lưu việc chuyển tài liệu vào Thư mục tạm. Bấm Cập nhật hồ sơ để áp dụng."
          : "Đã lưu feedback di chuyển tài liệu. Bấm Cập nhật hồ sơ khi bạn muốn lập hồ sơ lại."
      )
      toast.success(
        targetIsTemporary
          ? "Đã chuyển tài liệu vào Thư mục tạm."
          : "Đã lưu feedback chuyển tài liệu."
      )
    } catch (err) {
      setStatus("Không lưu được feedback di chuyển tài liệu. Vui lòng thử lại.")
      toast.error(
        err instanceof Error
          ? err.message
          : "Không gửi được feedback di chuyển tài liệu."
      )
    }
  }

  const handleSaveDossierMetadata = async (
    group: ClusterGroup,
    draft: DossierMetadataDraft
  ) => {
    if (!sessionId) {
      toast.error("Chưa có session để cập nhật metadata hồ sơ.")
      throw new Error("Missing session id")
    }
    const dossierId = group.dossierId ?? group.id
    if (!dossierId) {
      toast.error("Hồ sơ này chưa có mã để cập nhật metadata.")
      throw new Error("Missing dossier id")
    }

    setSavingDossierMetadataId(dossierId)
    try {
      const response = await patchSessionDossier(
        sessionId,
        dossierId,
        dossierPatchPayloadFromDraft(draft)
      )
      setGroups((previous) =>
        updateDossierGroupFromResponse(previous, group.id, response)
      )
      setStatus(
        `Đã cập nhật metadata hồ sơ "${response.title || response.generated_title || group.label}".`
      )
      toast.success("Đã cập nhật metadata hồ sơ.")
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Không thể cập nhật metadata hồ sơ."
      )
      throw err
    } finally {
      setSavingDossierMetadataId(null)
    }
  }

  const handleRebuildClusters = async (
    mode: "update" | "file_register" = "update"
  ) => {
    const forceFileRegister = mode === "file_register"
    const previousJobMode = clusterJobMode
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
    setClusterJobMode(mode)
    setRebuildSubmitting(true)
    try {
      const currentVersion = await getActiveClusters(sessionId)
      const baselineVersionId =
        currentVersion?.id ?? activeClusterVersionId ?? NO_CLUSTER_VERSION
      setActiveClusterVersionId(
        currentVersion?.id ?? activeClusterVersionId ?? null
      )
      const response = await enqueueClusterBuild(sessionId, {
        source: forceFileRegister ? "user_file_register" : "user_feedback",
        ...(forceFileRegister
          ? { dossier_build_strategy: "file_register" as const }
          : {}),
      })
      setRebuildBaselineVersionId(baselineVersionId)
      setRebuildPollKey((key) => key + 1)
      setLoading(true)
      setCheckingClusters(false)
      setClusterJobMode(mode)
      setClusterProgressPhase(FIRST_CLUSTER_PROGRESS_PHASE_ID)
      setClusterProgressMessage(
        clusterProgressMessageForPhase(
          FIRST_CLUSTER_PROGRESS_PHASE_ID,
          mode
        )
      )
      setClusterCompletedPhases(new Set())
      setStatus(
        forceFileRegister
          ? "Đã gửi job lập lại hồ sơ theo tập lưu. Đang chờ backend tạo phiên bản mới."
          : "Đã gửi job cập nhật hồ sơ. Đang chờ backend tạo phiên bản mới."
      )
      toast.success(
        response.status === "already_queued_or_running"
          ? forceFileRegister
            ? "Đã có job lập hồ sơ đang chạy."
            : "Đã có job cập nhật hồ sơ đang chạy."
          : forceFileRegister
            ? "Đã gửi job lập lại hồ sơ theo tập lưu."
            : "Đã gửi job cập nhật hồ sơ."
      )
    } catch (err) {
      setClusterJobMode(previousJobMode)
      toast.error(
        err instanceof Error
          ? err.message
          : forceFileRegister
            ? "Không gửi được job lập lại hồ sơ theo tập lưu."
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
    setDisplayedClusterVersion(pendingClusterVersion)
    setActiveClusterVersionId(pendingClusterVersion.id)
    setPendingClusterVersion(null)
    if (
      pendingClusterVersion.source === "user_feedback" ||
      pendingClusterVersion.source === "user_file_register"
    ) {
      setPendingFeedbackCount(0)
    }
    setClusterJobMode(clusterJobModeFromSource(pendingClusterVersion.source))
    setClusterProgressPhase(null)
    setClusterCompletedPhases(completedClusterPhaseSet())
    setClusterProgressMessage("Đã áp dụng phiên bản hồ sơ mới.")
    const nextDossierCount = regularDossierCount(nextGroups)
    const nextTemporaryCount = temporaryDocumentCount(nextGroups)
    setStatus(
      nextDossierCount > 0 &&
        (verifiedItems.length === 0 || missingVerified.length === 0)
        ? `Đã lập ${nextDossierCount} hồ sơ từ ${verifiedItems.length} tài liệu đã xác nhận.${nextTemporaryCount > 0 ? ` Có ${nextTemporaryCount} tài liệu trong Thư mục tạm.` : ""}`
        : nextDossierCount > 0 && missingVerified.length > 0
          ? `Đã có ${nextDossierCount} hồ sơ. Có ${missingVerified.length} tài liệu đã xác nhận chưa được cập nhật vào hồ sơ.`
          : nextTemporaryCount > 0
            ? `Có ${nextTemporaryCount} tài liệu trong Thư mục tạm; chưa có hồ sơ để tạo mục lục.`
            : "Chưa có kết quả lập hồ sơ từ backend."
    )
    toast.success("Đã áp dụng phiên bản hồ sơ mới.")
  }

  const handleRestorePreviousClusterVersion = async () => {
    const previousVersionId = displayedClusterVersion?.previous_version_id
    if (!sessionId || !previousVersionId) {
      toast.error("Không tìm thấy phiên bản hồ sơ ban đầu để quay trở lại.")
      return
    }
    if (pendingClusterVersion) {
      toast.error("Hãy xử lý phiên bản hồ sơ đang chờ áp dụng trước.")
      return
    }

    setRestoringClusterVersion(true)
    try {
      const version = await activateClusterVersion(sessionId, previousVersionId)
      const nextGroups = versionToGroups(version, metadataItems)
      setGroups(nextGroups)
      setActiveClusterVersionId(version.id)
      setDisplayedClusterVersionId(version.id)
      setDisplayedClusterVersion(version)
      setPendingClusterVersion(null)
      setRebuildBaselineVersionId(null)
      setClusterJobMode(clusterJobModeFromSource(version.source))
      setClusterProgressPhase(null)
      setClusterCompletedPhases(completedClusterPhaseSet())
      setClusterProgressMessage("Đã quay trở lại phiên bản hồ sơ ban đầu.")
      setStatus(
        `Đã quay trở lại phiên bản hồ sơ ban đầu với ${regularDossierCount(nextGroups)} hồ sơ.`
      )
      toast.success("Đã quay trở lại phiên bản hồ sơ ban đầu.")
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Không thể quay trở lại phiên bản hồ sơ ban đầu."
      )
    } finally {
      setRestoringClusterVersion(false)
    }
  }

  const handleExportMetadataSnapshot = async () => {
    if (!sessionId) {
      toast.error("Chưa có session để xuất metadata.")
      return
    }
    if (totalDossiers === 0) {
      toast.error("Chưa có dữ liệu hồ sơ để xuất metadata.")
      return
    }

    setMetadataExporting(true)
    try {
      const result = await exportMetadataSnapshot(sessionId, {
        created_by: "ui",
        groups: metadataSnapshotGroups(groups),
      })
      const artifact = result.artifact ?? result.artifacts[0]
      if (!artifact) {
        throw new Error("Backend chưa trả về artifact metadata.")
      }
      toast.success("Đã tạo snapshot metadata. Đang tải file.")
      window.location.assign(artifactDownloadUrl(sessionId, artifact.id))
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Không thể xuất metadata tại thời điểm hiện tại."
      )
    } finally {
      setMetadataExporting(false)
    }
  }

  const handleImportMetadataBoxNumbers = async (file: File | null) => {
    if (!file) return
    if (!sessionId) {
      toast.error("Chưa có session để nhập số hộp.")
      return
    }
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("File nhập số hộp phải là .xlsx.")
      return
    }

    setMetadataImporting(true)
    try {
      const result = await importMetadataBoxNumbers(sessionId, file, {
        created_by: "ui",
      })
      const version = await getActiveClusters(sessionId)
      if (!version) {
        throw new Error(
          "Backend chưa trả về phiên bản hồ sơ sau khi nhập số hộp."
        )
      }
      const nextGroups = versionToGroups(version, metadataItems)
      setGroups(nextGroups)
      setActiveClusterVersionId(version.id)
      setDisplayedClusterVersionId(version.id)
      setDisplayedClusterVersion(version)
      setPendingClusterVersion(null)
      toast.success(`Đã cập nhật số hộp cho ${result.updated_dossiers} hồ sơ.`)
      const issueCount = result.unmatched_rows + result.conflict_count
      if (issueCount > 0) {
        toast.info(
          `Có ${issueCount} dòng chưa cập nhật được do chưa khớp hồ sơ hoặc bị trùng số hộp.`
        )
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Không thể nhập số hộp từ metadata."
      )
    } finally {
      setMetadataImporting(false)
    }
  }

  const handleSelectPreviewDocument = (document: ClusterDocument) => {
    if (document.sessionDocumentId === null) {
      toast.error("Tài liệu này chưa có mã trong session để lấy preview.")
      return
    }
    setSelectedPreviewDocumentId(document.sessionDocumentId)
  }

  const handlePreviewResizePointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>
  ) => {
    const container = previewLayoutRef.current
    if (!container) return
    event.preventDefault()

    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"

    const updatePreviewWidth = (clientX: number) => {
      const rect = container.getBoundingClientRect()
      const rawPercent = ((rect.right - clientX) / rect.width) * 100
      setPreviewWidthPercent(Math.min(65, Math.max(50, rawPercent)))
    }

    updatePreviewWidth(event.clientX)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      updatePreviewWidth(moveEvent.clientX)
    }
    const handlePointerUp = () => {
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
      window.removeEventListener("pointercancel", handlePointerUp)
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)
    window.addEventListener("pointercancel", handlePointerUp)
  }

  const handleFinish = () => {
    if (pendingFeedbackCount > 0) {
      toast.error(
        "Hãy cập nhật hồ sơ để áp dụng các tài liệu đã di chuyển trước khi tạo mục lục."
      )
      return
    }
    if (pendingClusterVersion) {
      toast.error("Có phiên bản hồ sơ mới. Hãy áp dụng trước khi tạo mục lục.")
      return
    }
    if (
      loading ||
      rebuildSubmitting ||
      restoringClusterVersion ||
      rebuildBaselineVersionId ||
      metadataImporting
    ) {
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
        : clusterJobMode === "plan_reanalysis"
          ? `Đang lập lại hồ sơ theo phương án mới. ${status}`
          : clusterJobMode === "file_register"
            ? `Đang lập lại hồ sơ theo tập lưu. ${status}`
          : clusterJobMode === "update"
          ? `Đang cập nhật hồ sơ. ${status}`
          : `Đang lập hồ sơ mới. ${status}`
      : status
  const showClusterProgress =
    loading ||
    checkingClusters ||
    Boolean(clusterProgressMessage) ||
    hasClusterData
  const updatingClusterVersion =
    clusterJobMode !== "new" &&
    (loading || Boolean(rebuildBaselineVersionId))
  const canRestoreFileRegisterVersion =
    displayedClusterVersion?.source === "user_file_register" &&
    Boolean(displayedClusterVersion.previous_version_id)
  const feedbackActionsPanel = (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#D8E1EC] bg-white px-4 py-3 shadow-sm xl:flex-row xl:items-center xl:justify-between">
      <p className="min-w-0 flex-1 text-sm text-[#64748B]">
        {pendingFeedbackCount > 0
          ? `Có ${pendingFeedbackCount} feedback đã lưu và đang chờ cập nhật hồ sơ.`
          : "Kéo tài liệu chưa thuộc hồ sơ vào Thư mục tạm để xử lý sau."}
      </p>
      <input
        ref={metadataImportInputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0] ?? null
          event.currentTarget.value = ""
          void handleImportMetadataBoxNumbers(file)
        }}
      />
      <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5 xl:flex xl:w-auto xl:flex-wrap xl:items-center xl:justify-end">
        <Button
          variant="outline"
          onClick={() => void handleExportMetadataSnapshot()}
          className="w-full xl:w-auto"
          disabled={
            metadataExporting ||
            metadataImporting ||
            restoringClusterVersion ||
            !sessionId ||
            totalDossiers === 0
          }
        >
          {metadataExporting ? (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          ) : (
            <FileSpreadsheet data-icon="inline-start" />
          )}
          Xuất metadata
        </Button>
        <Button
          variant="outline"
          onClick={() => metadataImportInputRef.current?.click()}
          className="w-full xl:w-auto"
          disabled={
            metadataExporting ||
            metadataImporting ||
            restoringClusterVersion ||
            !sessionId ||
            totalDossiers === 0
          }
        >
          {metadataImporting ? (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          ) : (
            <Upload data-icon="inline-start" />
          )}
          Nhập số hộp
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            void (canRestoreFileRegisterVersion
              ? handleRestorePreviousClusterVersion()
              : handleRebuildClusters("file_register"))
          }
          className="w-full xl:w-auto"
          title={
            canRestoreFileRegisterVersion
              ? "Quay trở lại phiên bản hồ sơ trước khi lập theo tập lưu"
              : "Lập lại hồ sơ theo dạng tập lưu, không phụ thuộc phương án chỉnh lý hiện tại"
          }
          disabled={
            rebuildSubmitting ||
            restoringClusterVersion ||
            loading ||
            metadataImporting ||
            !sessionId ||
            totalFiles === 0 ||
            Boolean(pendingClusterVersion)
          }
        >
          {restoringClusterVersion ||
          (rebuildSubmitting && clusterJobMode === "file_register") ? (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          ) : canRestoreFileRegisterVersion ? (
            <Undo2 data-icon="inline-start" />
          ) : (
            <Archive data-icon="inline-start" />
          )}
          {canRestoreFileRegisterVersion
            ? "Quay trở lại phiên bản ban đầu"
            : "Lập lại theo tập lưu"}
        </Button>
        <Button
          variant="outline"
          onClick={() => void handleRebuildClusters()}
          className="w-full xl:w-auto"
          disabled={
            rebuildSubmitting ||
            restoringClusterVersion ||
            loading ||
            metadataImporting ||
            !sessionId ||
            totalFiles === 0 ||
            Boolean(pendingClusterVersion)
          }
        >
          {rebuildSubmitting && clusterJobMode === "update" ? (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          ) : (
            <RefreshCw data-icon="inline-start" />
          )}
          Cập nhật hồ sơ
        </Button>
        <Button
          onClick={handleFinish}
          className="w-full xl:w-auto"
          disabled={
            totalDossiers === 0 ||
            pendingFeedbackCount > 0 ||
            loading ||
            rebuildSubmitting ||
            restoringClusterVersion ||
            metadataImporting ||
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
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
        <div className="ml-auto grid w-full max-w-[22rem] shrink-0 grid-cols-3 justify-end gap-2 sm:w-auto">
          <Metric label="Hồ sơ" value={totalDossiers} />
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
            clusterJobMode === "plan_reanalysis"
              ? "Tiến độ lập lại hồ sơ"
              : clusterJobMode === "file_register"
                ? "Tiến độ lập hồ sơ theo tập lưu"
              : clusterJobMode === "update"
              ? "Tiến độ cập nhật hồ sơ"
              : "Tiến độ lập hồ sơ"
          }
          message={
            clusterProgressMessage ||
            "Backend đang lập hồ sơ từ các tài liệu đã xác nhận."
          }
        />
      )}

      {updatingClusterVersion && !pendingClusterVersion && (
        <div className="flex flex-col gap-3 rounded-2xl border border-[#BFD3FF] bg-[#F8FAFF] px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#0F172A]">
              Đang cập nhật hồ sơ
            </p>
            {clusterJobMode === "plan_reanalysis" ? (
              <p className="mt-1 text-sm text-[#475569]">
                Backend đang lập lại hồ sơ và phân loại theo phương án chỉnh lý
                cùng thời hạn bảo quản mới. Nút áp dụng sẽ bật khi phiên bản
                mới sẵn sàng.
              </p>
            ) : clusterJobMode === "file_register" ? (
              <p className="mt-1 text-sm text-[#475569]">
                Backend đang bỏ qua cách lập hồ sơ của phương án hiện tại và
                sắp xếp tài liệu theo dạng tập lưu. Nút áp dụng sẽ bật khi
                phiên bản mới sẵn sàng.
              </p>
            ) : (
              <p className="mt-1 text-sm text-[#475569]">
              Backend đang tạo phiên bản hồ sơ mới từ feedback đã lưu. Nút áp
              dụng sẽ bật khi phiên bản mới sẵn sàng.
              </p>
            )}
          </div>
          <Button disabled>
            <Loader2 data-icon="inline-start" className="animate-spin" />
            Đang cập nhật
          </Button>
        </div>
      )}

      {pendingClusterVersion && (
        <div className="flex flex-col gap-3 rounded-2xl border border-[#BFD3FF] bg-[#F8FAFF] px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#0F172A]">
              Đã có cập nhật hồ sơ mới
            </p>
            <p className="mt-1 text-sm text-[#475569]">
              Phiên bản {pendingClusterVersion.version_number} có{" "}
              {pendingDossierCount} hồ sơ và {pendingClusterDocumentCount} tài
              liệu. Bấm áp dụng để chuyển giao diện sang phiên bản mới.
            </p>
          </div>
          <Button onClick={handleApplyPendingClusterVersion}>
            <RefreshCw data-icon="inline-start" />
            Áp dụng phiên bản mới
          </Button>
        </div>
      )}

      <div
        ref={previewLayoutRef}
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
                }fr) minmax(460px, ${previewWidthPercent}fr)`,
              } as CSSProperties)
            : undefined
        }
      >
        <div className="min-w-0 overflow-hidden rounded-2xl border border-[#D8E1EC] bg-white shadow-sm">
          <div
            ref={resultTreeScrollRef}
            onDragOver={handleResultTreeDragOver}
            className="h-[min(70svh,560px)] min-h-[360px] min-w-0 overflow-x-hidden overflow-y-auto p-2 pr-3 sm:p-3 sm:pr-4"
          >
            <div className="flex w-full max-w-full min-w-0 flex-col gap-1 overflow-hidden pr-2 pb-2">
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
                  savingDossierMetadataId={savingDossierMetadataId}
                  onToggle={toggleNode}
                  onDragStart={(document, fromClusterId) =>
                    setDraggedDocument({ document, fromClusterId })
                  }
                  onDragEnd={() => {
                    stopResultTreeAutoScroll()
                    setDraggedDocument(null)
                    setDropTargetId(null)
                  }}
                  onDragEnter={setDropTargetId}
                  onDropOnDossier={handleDropOnDossier}
                  onSelectPreview={handleSelectPreviewDocument}
                  onSaveDossierMetadata={handleSaveDossierMetadata}
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
          </div>
        </div>
        {previewDocument && (
          <div className="relative min-w-0">
            <button
              type="button"
              aria-label="Kéo để đổi kích thước preview"
              title="Kéo để đổi kích thước preview"
              onPointerDown={handlePreviewResizePointerDown}
              className="group absolute top-0 bottom-0 -left-3 z-20 hidden w-5 cursor-col-resize items-center justify-center xl:flex"
            >
              <span className="h-16 w-1 rounded-full bg-[#0052FF] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
            </button>
            <DocumentPdfPreview
              sessionId={sessionId}
              document={previewDocument}
              className="h-[min(70svh,560px)] min-h-[420px] min-w-0"
              onClose={() => setSelectedPreviewDocumentId(null)}
            />
          </div>
        )}
      </div>
      {feedbackActionsPanel}
    </motion.div>
  )
}

function autoScrollResultTree(container: HTMLDivElement, clientY: number) {
  const rect = container.getBoundingClientRect()
  const edge = RESULT_TREE_AUTO_SCROLL_EDGE_PX
  const maxStep = RESULT_TREE_AUTO_SCROLL_MAX_STEP_PX
  const canScrollUp = container.scrollTop > 0
  const canScrollDown =
    container.scrollTop + container.clientHeight < container.scrollHeight

  if (clientY >= rect.top - edge && clientY < rect.top + edge && canScrollUp) {
    const intensity = (rect.top + edge - clientY) / edge
    container.scrollTop -= Math.ceil(maxStep * clampScrollIntensity(intensity))
    return
  }

  if (
    clientY > rect.bottom - edge &&
    clientY <= rect.bottom + edge &&
    canScrollDown
  ) {
    const intensity = (clientY - (rect.bottom - edge)) / edge
    container.scrollTop += Math.ceil(maxStep * clampScrollIntensity(intensity))
  }
}

function clampScrollIntensity(value: number): number {
  return Math.min(1, Math.max(0.15, value))
}

function ResultNode({
  node,
  depth,
  openNodeIds,
  draggedDocument,
  dropTargetId,
  compact,
  selectedPreviewDocumentId,
  savingDossierMetadataId,
  onToggle,
  onDragStart,
  onDragEnd,
  onDragEnter,
  onDropOnDossier,
  onSelectPreview,
  onSaveDossierMetadata,
}: {
  node: ResultTreeNode
  depth: number
  openNodeIds: Set<string>
  draggedDocument: DraggedDocument | null
  dropTargetId: string | null
  compact: boolean
  selectedPreviewDocumentId: number | null
  savingDossierMetadataId: string | null
  onToggle: (nodeId: string) => void
  onDragStart: (document: ClusterDocument, fromClusterId: string) => void
  onDragEnd: () => void
  onDragEnter: (nodeId: string | null) => void
  onDropOnDossier: (targetClusterId: string) => void
  onSelectPreview: (document: ClusterDocument) => void
  onSaveDossierMetadata: (
    group: ClusterGroup,
    draft: DossierMetadataDraft
  ) => Promise<void>
}) {
  const [dossierMetadataOpen, setDossierMetadataOpen] = useState(false)
  const [dossierMetadataEditing, setDossierMetadataEditing] = useState(false)
  const [dossierMetadataDraft, setDossierMetadataDraft] =
    useState<DossierMetadataDraft>(() => createDossierMetadataDraft(null))
  const open = openNodeIds.has(node.id)
  const isDossier = node.type === "dossier"
  const isTemporary = node.type === "temporary"
  const isDropFolder = isDossier || isTemporary
  const group = node.group
  const canDrop = Boolean(
    draggedDocument && group && draggedDocument.fromClusterId !== group.id
  )
  const primaryDocument = group?.documents.find(
    (document) => document.sessionDocumentId !== null
  )
  const indentStep = compact ? 14 : 20
  const displayLabel = node.label
  const dossierMetadataKey = group?.dossierId ?? group?.id ?? null
  const dossierMetadataSaving = Boolean(
    dossierMetadataKey && savingDossierMetadataId === dossierMetadataKey
  )

  const toggleDossierMetadata = () => {
    if (!group) return
    setDossierMetadataDraft(createDossierMetadataDraft(group))
    setDossierMetadataEditing(false)
    setDossierMetadataOpen((value) => !value)
  }

  const startDossierMetadataEdit = () => {
    if (!group) return
    setDossierMetadataDraft(createDossierMetadataDraft(group))
    setDossierMetadataEditing(true)
    setDossierMetadataOpen(true)
  }

  const cancelDossierMetadataEdit = () => {
    setDossierMetadataDraft(createDossierMetadataDraft(group))
    setDossierMetadataEditing(false)
  }

  const saveDossierMetadata = async () => {
    if (!group) return
    try {
      await onSaveDossierMetadata(group, dossierMetadataDraft)
      setDossierMetadataEditing(false)
    } catch {
      // The parent handler owns user-facing error messages.
    }
  }

  return (
    <div className={cn("max-w-full min-w-0", isDossier ? "overflow-visible" : "overflow-hidden")}>
      <div
        className={cn(
          "group flex min-h-10 max-w-full min-w-0 gap-2 rounded-xl px-2 py-1.5 transition-all",
          isDossier ? "items-start overflow-visible" : "items-center overflow-hidden",
          isDropFolder ? "border border-transparent" : "",
          isTemporary && "bg-amber-50/60",
          canDrop && dropTargetId === node.id
            ? "border-[#0052FF]/40 bg-[#EAF1FF] shadow-[0_8px_24px_rgba(0,82,255,0.10)]"
            : "hover:bg-[#F8FAFC]"
        )}
        style={{ paddingLeft: `${8 + depth * indentStep}px` }}
        onDragOver={(event) => {
          if (!isDropFolder || !canDrop) return
          event.preventDefault()
          onDragEnter(node.id)
        }}
        onDragLeave={() => isDropFolder && onDragEnter(null)}
        onDrop={(event) => {
          if (!isDropFolder || !group) return
          event.preventDefault()
          void onDropOnDossier(group.id)
        }}
      >
        <button
          type="button"
          onClick={() => onToggle(node.id)}
          className="flex size-5 shrink-0 items-center justify-center rounded-md text-[#64748B] hover:bg-[#E2E8F0]"
        >
          {node.children.length > 0 || isDropFolder ? (
            open ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )
          ) : (
            <span className="size-3.5" />
          )}
        </button>

        {isTemporary ? (
          <FolderClock className="size-4 shrink-0 text-amber-600" />
        ) : open ? (
          <FolderOpen className="size-4 shrink-0 text-[#0052FF]" />
        ) : (
          <Folder className="size-4 shrink-0 text-[#0052FF]" />
        )}

        <div className={cn("min-w-0 flex-1", isDossier ? "overflow-visible" : "overflow-hidden")}>
          <div
            className={cn(
              "flex min-w-0 gap-2",
              isDossier ? "items-start overflow-visible" : "items-center overflow-hidden"
            )}
          >
            <span
              className={cn(
                "min-w-0 flex-1 text-sm",
                isDossier
                  ? "leading-5 break-words whitespace-normal [overflow-wrap:anywhere]"
                  : compact
                    ? "line-clamp-2 leading-5 break-words whitespace-normal"
                  : "truncate",
                isDropFolder
                  ? "font-semibold text-[#0F172A]"
                  : "font-medium text-[#0F172A]"
              )}
              title={node.label}
            >
              {displayLabel}
            </span>
            {group?.requiresReview && !isTemporary && (
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
              {group.boxNumber && (
                <>
                  <span>·</span>
                  <span>Hộp {group.boxNumber}</span>
                </>
              )}
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
          {isTemporary && group && (
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-[11px] text-amber-700">
              <span>Chưa xử lý khi tạo mục lục</span>
              <span>·</span>
              <span>{group.documents.length} tài liệu</span>
              <span>·</span>
              <span>{dossierPageCount(group)} trang</span>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5 pl-1">
          {isDropFolder && canDrop && (
            <span className="flex items-center gap-1 rounded-full bg-[#DBEAFE] px-2 py-1 text-[10px] font-semibold text-[#0052FF]">
              <MoveRight className="size-3" />
              <span className={cn(compact && "hidden 2xl:inline")}>
                {isTemporary ? "Để xử lý sau" : "Chuyển vào đây"}
              </span>
            </span>
          )}
          {isDossier && group && (
            <Button
              type="button"
              variant={dossierMetadataOpen ? "default" : "outline"}
              size="icon-sm"
              title="Xem metadata hồ sơ"
              onClick={(event) => {
                event.stopPropagation()
                toggleDossierMetadata()
              }}
            >
              <FileText className="size-3.5" />
            </Button>
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

      {dossierMetadataOpen && isDossier && group && (
        <DossierMetadataPanel
          group={group}
          depth={depth}
          compact={compact}
          editing={dossierMetadataEditing}
          draft={dossierMetadataDraft}
          saving={dossierMetadataSaving}
          onDraftChange={(key, value) =>
            setDossierMetadataDraft((current) => ({
              ...current,
              [key]: value,
            }))
          }
          onStartEdit={startDossierMetadataEdit}
          onCancelEdit={cancelDossierMetadataEdit}
          onSave={() => void saveDossierMetadata()}
        />
      )}

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
              savingDossierMetadataId={savingDossierMetadataId}
              onToggle={onToggle}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragEnter={onDragEnter}
              onDropOnDossier={onDropOnDossier}
              onSelectPreview={onSelectPreview}
              onSaveDossierMetadata={onSaveDossierMetadata}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function DossierMetadataPanel({
  group,
  depth,
  compact,
  editing,
  draft,
  saving,
  onDraftChange,
  onStartEdit,
  onCancelEdit,
  onSave,
}: {
  group: ClusterGroup
  depth: number
  compact: boolean
  editing: boolean
  draft: DossierMetadataDraft
  saving: boolean
  onDraftChange: (key: DossierMetadataDraftKey, value: string) => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onSave: () => void
}) {
  const indentStep = compact ? 14 : 20
  const detailIndent = 8 + (depth + 1) * indentStep
  const classificationPath = group.classificationPath?.join(" / ") ?? ""
  const documentCount = String(group.documents.length)
  const confidence = formatConfidence(group.confidence)

  return (
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
          <FolderOpen className="size-4" />
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="text-sm font-semibold text-[#0F172A]">
            Metadata hồ sơ
          </p>
          <p className="text-[11px] leading-4 break-words whitespace-normal text-[#64748B] [overflow-wrap:anywhere]">
            {group.label}
          </p>
        </div>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          {DOSSIER_METADATA_EDIT_FIELDS.map((field) => (
            <div
              key={field.key}
              className="grid min-w-0 grid-cols-1 gap-1 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-2"
            >
              <span className="pt-2 text-[11px] font-medium text-[#64748B]">
                {field.label}
              </span>
              <textarea
                value={draft[field.key]}
                onChange={(event) =>
                  onDraftChange(field.key, event.target.value)
                }
                rows={field.rows}
                disabled={saving}
                className="min-h-9 w-full min-w-0 resize-y rounded-lg border border-[#CBD5E1] bg-transparent px-2.5 py-1.5 text-xs leading-5 [overflow-wrap:anywhere] whitespace-pre-wrap transition-colors outline-none placeholder:text-[#94A3B8] focus-visible:border-[#0052FF] focus-visible:ring-3 focus-visible:ring-[#0052FF]/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:opacity-70"
              />
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={onCancelEdit}
              disabled={saving}
            >
              Hủy
            </Button>
            <Button size="sm" onClick={onSave} disabled={saving}>
              {saving ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <Check data-icon="inline-start" />
              )}
              Lưu metadata
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid min-w-0 gap-2 text-xs">
          <PreviewField label="Tiêu đề hồ sơ" value={group.label} wide />
          <div
            className={cn(
              "grid min-w-0 grid-cols-1 gap-2",
              compact ? "md:grid-cols-2" : "md:grid-cols-3"
            )}
          >
            <PreviewField label="Số hồ sơ" value={group.dossierNumber ?? ""} />
            <PreviewField label="Số hộp" value={group.boxNumber ?? ""} />
            <PreviewField label="Tên thư mục" value={group.folderName ?? ""} />
            <PreviewField
              label="Thời hạn bảo quản"
              value={group.retentionPeriod ?? ""}
            />
            <PreviewField label="Phân loại" value={classificationPath} />
            <PreviewField
              label="Thời gian"
              value={formatDateRange(group.startDate, group.endDate)}
            />
            <PreviewField label="Số tài liệu" value={documentCount} />
            <PreviewField
              label="Số trang"
              value={String(dossierPageCount(group) || "")}
            />
            <PreviewField
              label="Số tờ"
              value={
                typeof group.sheetCount === "number"
                  ? String(group.sheetCount)
                  : ""
              }
            />
            <PreviewField label="Độ tin cậy" value={confidence} />
          </div>
          <div className="flex justify-end pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={onStartEdit}
              disabled={saving}
            >
              <Edit2 data-icon="inline-start" /> Sửa
            </Button>
          </div>
        </div>
      )}
    </motion.div>
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

function ClusterWarningPanel({
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
    <div className="col-span-full overflow-hidden rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 text-amber-900">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={onToggle}
      >
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold">
          <AlertTriangle className="size-3.5 shrink-0" />
          <span className="truncate">Cảnh báo hồ sơ</span>
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
        <div className="mt-2 border-t border-amber-200 pt-2">
          <p className="text-[11px] font-semibold text-amber-900">
            Hồ sơ phù hợp hơn
          </p>
          <p className="mt-1 rounded-md bg-white/70 px-2 py-1 text-[11px] font-medium break-words text-amber-950">
            {closerDossierTitle ||
              "Chưa xác định được tên hồ sơ phù hợp hơn từ dữ liệu cảnh báo."}
          </p>
          {representativeDocuments.length > 0 && (
            <>
              <p className="mt-2 text-[11px] font-semibold text-amber-900">
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
                      className="min-w-0 border-t border-amber-100 pt-1 first:border-t-0 first:pt-0"
                    >
                      <p className="text-[11px] font-medium break-words text-amber-950">
                        {document.fileName ||
                          document.documentId ||
                          "Tài liệu đại diện"}
                      </p>
                      {secondary.length > 0 && (
                        <p className="mt-0.5 line-clamp-2 text-[11px] break-words text-amber-800">
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
            <p className="mt-2 rounded-md bg-white/50 px-2 py-1 text-[11px] text-amber-800">
              Chưa có tài liệu đại diện của hồ sơ này trong dữ liệu cảnh báo.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function WarningDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md bg-white/70 px-2 py-1">
      <span className="text-amber-700">{label}: </span>
      <span className="font-medium break-words text-amber-950">{value}</span>
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

function Metric({ label, value }: { label: string; value: number }) {
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
      return mode === "plan_reanalysis"
        ? "Đang lập lại hồ sơ theo phương án chỉnh lý và thời hạn bảo quản mới."
        : mode === "file_register"
        ? "Đang sắp xếp tài liệu theo loại văn bản, thời gian và giới hạn số trang của tập lưu."
        : mode === "update"
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
      return mode === "plan_reanalysis"
        ? "Đang lập lại hồ sơ theo phương án chỉnh lý mới."
        : mode === "file_register"
        ? "Đang lập lại hồ sơ theo phương án tập lưu."
        : mode === "update"
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
  return clusterJobModeFromSource(payload?.source)
}

function clusterJobModeFromSource(source: unknown): ClusterJobMode {
  if (source === "plan_reanalysis") return "plan_reanalysis"
  if (source === "user_file_register") return "file_register"
  return source === "user_feedback" ? "update" : "new"
}

function buildResultTree(groups: ClusterGroup[]): ResultTreeNode[] {
  const roots: ResultTreeNode[] = []
  const rootByLabel = new Map<string, ResultTreeNode>()

  groups
    .filter((group) => group.isTemporary)
    .forEach((group) => {
      roots.push({
        id: `temporary:${group.id}`,
        label: group.label,
        type: "temporary",
        children: [],
        group,
        documentCount: group.documents.length,
        pageCount: dossierPageCount(group),
      })
    })

  groups
    .filter((group) => !group.isTemporary)
    .forEach((group) => {
      const path = resultTreePath(group)
      let current: ResultTreeNode | null = null
      path.forEach((segment, index) => {
        const label = segment.trim() || UNCLASSIFIED_LABEL
        if (index === 0) {
          current = rootByLabel.get(label) ?? null
          if (!current) {
            current = createTreeNode(
              `root:${label}`,
              label,
              isYearPathSegment(label) ? "year" : "classification"
            )
            rootByLabel.set(label, current)
            roots.push(current)
          }
          return
        }

        const id = `${current!.id}/class:${index}:${label}`
        let child = current!.children.find((candidate) => candidate.id === id)
        if (!child) {
          child = createTreeNode(
            id,
            label,
            isYearPathSegment(label) ? "year" : "classification"
          )
          current!.children.push(child)
        }
        current = child
      })

      current!.children.push({
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
  return roots.sort((a, b) => {
    if (a.type === "temporary") return -1
    if (b.type === "temporary") return 1
    return a.label.localeCompare(b.label, "vi")
  })
}

function resultTreePath(group: ClusterGroup): string[] {
  const classificationPath = (group.classificationPath ?? [])
    .map((segment) => segment.trim())
    .filter(Boolean)
  const yearLabel = dossierYearLabel(group)
  const hasKnownYear = normalizePathSegment(yearLabel) !== normalizePathSegment(UNKNOWN_YEAR_LABEL)
  const hasClassificationYear = classificationPath.some(isYearPathSegment)

  if (hasClassificationYear) {
    let yearSegmentUsed = false
    const deduped = classificationPath.flatMap((segment) => {
      if (!isYearPathSegment(segment)) return [segment]
      if (yearSegmentUsed) return []
      yearSegmentUsed = true
      return [hasKnownYear ? yearLabel : segment]
    })
    return deduped.length > 0 ? deduped : [UNCLASSIFIED_LABEL]
  }

  const tail = classificationPath.length > 0 ? classificationPath : [UNCLASSIFIED_LABEL]
  return [yearLabel, ...tail]
}

function isYearPathSegment(value: string): boolean {
  const normalized = normalizePathSegment(value)
  return (
    normalized === normalizePathSegment(UNKNOWN_YEAR_LABEL) ||
    /^nam\s+(?:19|20)\d{2}\b/.test(normalized) ||
    /^year\s+(?:19|20)\d{2}\b/.test(normalized)
  )
}

function normalizePathSegment(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
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

function createDossierMetadataDraft(
  group: ClusterGroup | null | undefined
): DossierMetadataDraft {
  return {
    title: group?.label ?? "",
    dossierNumber: group?.dossierNumber ?? "",
    boxNumber: group?.boxNumber ?? "",
    folderName: group?.folderName ?? "",
    retentionPeriod: group?.retentionPeriod ?? "",
  }
}

function dossierPatchPayloadFromDraft(
  draft: DossierMetadataDraft
): SessionDossierPatchPayload {
  return {
    title: trimmedOrNull(draft.title),
    dossier_number: trimmedOrNull(draft.dossierNumber),
    box_number: trimmedOrNull(draft.boxNumber),
    folder_name: trimmedOrNull(draft.folderName),
    retention_period: trimmedOrNull(draft.retentionPeriod),
  }
}

function updateDossierGroupFromResponse(
  groups: ClusterGroup[],
  groupId: string,
  dossier: SessionDossierSummary
): ClusterGroup[] {
  return groups.map((group) => {
    if (group.id !== groupId) return group
    return {
      ...group,
      dossierId: dossier.dossier_id ?? group.dossierId,
      dossierNumber: dossier.dossier_number ?? null,
      boxNumber: dossier.box_number ?? null,
      folderName: dossier.folder_name ?? null,
      retentionPeriod: dossier.retention_period ?? null,
      label: dossier.title || dossier.generated_title || group.label,
    }
  })
}

function metadataSnapshotGroups(
  groups: ClusterGroup[]
): MetadataSnapshotGroup[] {
  return groups
    .filter((group) => !group.isTemporary)
    .map((group) => ({
      id: group.id,
      label: group.label,
      dossierId: group.dossierId ?? null,
      dossierNumber: group.dossierNumber ?? null,
      boxNumber: group.boxNumber ?? null,
      folderName: group.folderName ?? null,
      classificationPath: group.classificationPath ?? [],
      retentionPeriod: group.retentionPeriod ?? null,
      confidence: group.confidence ?? null,
      requiresReview: group.requiresReview ?? false,
      pageCount: group.pageCount ?? null,
      sheetCount: group.sheetCount ?? null,
      startDate: group.startDate ?? null,
      endDate: group.endDate ?? null,
      documents: group.documents.map((document) => ({
        documentId: document.documentId,
        sessionDocumentId: document.sessionDocumentId,
        filePath: document.filePath,
        fileName: document.fileName,
        positionIndex: document.positionIndex,
        pageCount: document.pageCount,
        sheetCount: document.sheetCount,
        requiresReview: document.requiresReview,
        metadata: document.metadata,
        remoteMetadataStatus: document.remoteMetadataStatus,
        ocrStatus: document.ocrStatus,
        signatureStatus: document.signatureStatus,
      })),
    }))
}

function regularDossierCount(groups: ClusterGroup[]): number {
  return groups.filter((group) => !group.isTemporary).length
}

function temporaryDocumentCount(groups: ClusterGroup[]): number {
  return groups
    .filter((group) => group.isTemporary)
    .reduce((sum, group) => sum + group.documents.length, 0)
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
  return year ? `Năm ${year}` : UNKNOWN_YEAR_LABEL
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

function formatConfidence(value?: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return ""
  const percent = value <= 1 ? value * 100 : value
  return `${Math.round(percent)}%`
}

function trimmedOrNull(value: string): string | null {
  const text = value.trim()
  return text ? text : null
}

function clusterWarningTooltip(warning: ClusterDocumentWarning): string {
  return clusterWarningMessages(warning).join("\n")
}

function clusterWarningHasCloserReason(
  warning: ClusterDocumentWarning,
  messages: string[] = []
): boolean {
  return (
    warning.reasons.includes("closer_to_another_cluster") ||
    warning.reasons.includes("closer_to_another_dossier") ||
    messages.some(isCloserWarningMessage)
  )
}

function clusterWarningMessages(warning: ClusterDocumentWarning): string[] {
  const baseMessages = warning.displayMessages.length
    ? warning.displayMessages
    : warning.reasons.length
      ? warning.reasons.map((reason) =>
          clusterWarningReasonLabel(reason, warning)
        )
      : warning.message
        ? [warning.message]
        : []
  const messages = baseMessages
    .map((message) => refineClusterWarningMessage(message, warning))
    .filter(Boolean)
  addMissingClusterWarningReasonMessages(messages, warning)
  if (!messages.length) {
    messages.push("Tài liệu cần được kiểm tra lại trong hồ sơ hiện tại.")
  }
  return uniqueWarningMessages(messages)
}

function addMissingClusterWarningReasonMessages(
  messages: string[],
  warning: ClusterDocumentWarning
) {
  const combined = messages.join(" ").toLowerCase()
  if (
    warning.reasons.includes("low_similarity_to_cluster") &&
    !combined.includes("không đồng nhất")
  ) {
    messages.push(
      clusterWarningReasonLabel("low_similarity_to_cluster", warning)
    )
  }
  if (
    warning.reasons.includes("closer_to_another_cluster") &&
    !combined.includes("tương đồng")
  ) {
    messages.push(
      clusterWarningReasonLabel("closer_to_another_cluster", warning)
    )
  }
  if (
    warning.reasons.includes("temporal_outlier") &&
    !combined.includes("năm ban hành")
  ) {
    messages.push(clusterWarningReasonLabel("temporal_outlier", warning))
  }
}

function refineClusterWarningMessage(
  message: string,
  warning: ClusterDocumentWarning
): string {
  const text = message.trim()
  if (
    clusterWarningHasCloserReason(warning, [text]) &&
    isGenericCloserWarningMessage(text)
  ) {
    return clusterWarningReasonLabel("closer_to_another_cluster", warning)
  }
  return text
}

function isGenericCloserWarningMessage(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes("hồ sơ khác") ||
    lower.includes("một hồ sơ khác") ||
    lower.includes("another dossier") ||
    lower.includes("another cluster")
  )
}

function isCloserWarningMessage(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    (lower.includes("tương đồng") && lower.includes("hồ sơ")) ||
    lower.includes("another dossier") ||
    lower.includes("another cluster")
  )
}

function clusterWarningReasonLabel(
  reason: string,
  warning?: ClusterDocumentWarning
): string {
  if (reason === "closer_to_another_cluster") {
    const dossierTitle = warning?.nearestOtherDossierTitle.trim()
    return dossierTitle
      ? `Tài liệu có độ tương đồng với hồ sơ "${dossierTitle}" cao hơn.`
      : "Tài liệu có độ tương đồng với hồ sơ khác cao hơn."
  }
  const labels: Record<string, string> = {
    low_similarity_to_cluster: "Tài liệu không đồng nhất với hồ sơ.",
    temporal_outlier:
      "Năm ban hành của tài liệu khác với đa số tài liệu trong hồ sơ.",
  }
  return labels[reason] ?? reason
}

function uniqueWarningMessages(messages: string[]): string[] {
  const seen = new Set<string>()
  return messages.filter((message) => {
    const normalized = message.trim()
    if (!normalized || seen.has(normalized)) return false
    seen.add(normalized)
    return true
  })
}

function clusterWarningLevelLabel(riskLevel: string): string {
  const normalized = riskLevel.toLowerCase()
  if (normalized === "high") return "Cảnh báo cao"
  if (normalized === "medium") return "Cảnh báo trung bình"
  if (normalized === "low") return "Cảnh báo thấp"
  return "Cảnh báo"
}

function clusterWarningLevelClass(riskLevel: string): string {
  const normalized = riskLevel.toLowerCase()
  if (normalized === "high") {
    return "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
  }
  if (normalized === "medium") {
    return "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
  }
  if (normalized === "low") {
    return "border-yellow-300 bg-yellow-50 text-yellow-800 hover:bg-yellow-100"
  }
  return "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
}

function signatureTagClass(kind: SignatureTagKind): string {
  if (kind === "done") {
    return "border-emerald-300 bg-emerald-50 text-emerald-700"
  }
  if (kind === "failed") {
    return "border-red-300 bg-red-50 text-red-700"
  }
  return "border-slate-300 bg-slate-50 text-slate-600"
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
