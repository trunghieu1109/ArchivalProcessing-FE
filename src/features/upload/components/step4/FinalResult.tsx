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
  ChevronLeft,
  ChevronRight,
  Edit2,
  Eye,
  FileText,
  Folder,
  FolderClock,
  FolderOpen,
  FolderPlus,
  GripVertical,
  Loader2,
  MoveRight,
  RefreshCw,
  Signature,
  Undo2,
  X,
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
  ensureClusterBuild,
  getActiveClusters,
  getClusterBuildStatus,
  getClusterVersion,
  listClusterVersions,
  listSessionEvents,
  moveDocumentBetweenClusters,
  moveSelectedDocumentsToCluster,
  patchSessionDossier,
  promoteSelectedDocumentsToDossier,
  promoteTemporaryFolderDocuments,
  type ClusterVersionResponse,
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
  archiveName: string
  fondsName: string
  inventoryNumber: string
  boxNumber: string
  dossierNumber: string
  informationSign: string
  title: string
  annotation: string
  startDate: string
  endDate: string
  language: string
  sheetCount: string
  retentionPeriod: string
  usageMode: string
  physicalCondition: string
  note: string
}

type DossierMetadataDraftKey = keyof DossierMetadataDraft

const DOSSIER_METADATA_EDIT_FIELDS: Array<{
  key: DossierMetadataDraftKey
  label: string
  rows: number
}> = [
  { key: "archiveName", label: "Tên kho lưu trữ", rows: 1 },
  { key: "fondsName", label: "Tên phông", rows: 1 },
  { key: "inventoryNumber", label: "Mục lục số", rows: 1 },
  { key: "boxNumber", label: "Hộp số", rows: 1 },
  { key: "dossierNumber", label: "Hồ sơ số", rows: 1 },
  { key: "informationSign", label: "Ký hiệu thông tin", rows: 1 },
  { key: "title", label: "Tiêu đề hồ sơ", rows: 4 },
  { key: "annotation", label: "Chú giải", rows: 2 },
  { key: "startDate", label: "Thời gian bắt đầu", rows: 1 },
  { key: "endDate", label: "Thời gian kết thúc", rows: 1 },
  { key: "language", label: "Ngôn ngữ", rows: 1 },
  { key: "sheetCount", label: "Số lượng tờ", rows: 1 },
  { key: "retentionPeriod", label: "Thời hạn bảo quản", rows: 2 },
  { key: "usageMode", label: "Chế độ sử dụng", rows: 1 },
  { key: "physicalCondition", label: "Tình trạng vật lý", rows: 2 },
  { key: "note", label: "Ghi chú", rows: 2 },
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
  const [clusterVersions, setClusterVersions] = useState<
    ClusterVersionResponse[]
  >([])
  const [loadingClusterVersionId, setLoadingClusterVersionId] = useState<
    string | null
  >(null)
  const [pendingClusterVersion, setPendingClusterVersion] =
    useState<ClusterVersionResponse | null>(null)
  const [rebuildBaselineVersionId, setRebuildBaselineVersionId] = useState<
    string | null
  >(null)
  const [rebuildPollKey, setRebuildPollKey] = useState(0)
  const [rebuildSubmitting, setRebuildSubmitting] = useState(false)
  const [restoringClusterVersion, setRestoringClusterVersion] = useState(false)
  const [promotingTemporaryFolder, setPromotingTemporaryFolder] =
    useState(false)
  const [promotingSelectedDocuments, setPromotingSelectedDocuments] =
    useState(false)
  const [movingSelectedDocumentsTargetId, setMovingSelectedDocumentsTargetId] =
    useState<string | null>(null)
  const [savingDossierMetadataId, setSavingDossierMetadataId] = useState<
    string | null
  >(null)
  const [pendingFeedbackCount, setPendingFeedbackCount] = useState(0)
  const [selectedSessionDocumentIds, setSelectedSessionDocumentIds] = useState<
    Set<number>
  >(() => new Set())
  const [selectedPreviewDocumentId, setSelectedPreviewDocumentId] = useState<
    number | null
  >(null)
  const [selectedMetadataGroupId, setSelectedMetadataGroupId] = useState<
    string | null
  >(null)
  const [previewWidthPercent, setPreviewWidthPercent] = useState(50)
  const previewLayoutRef = useRef<HTMLDivElement | null>(null)
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
    () =>
      metadataItems.filter(
        (item) => item.is_reviewed === true || item.review_status === "verified"
      ),
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
  const selectableSessionDocumentIdSet = useMemo(
    () => new Set(previewDocuments.map((entry) => entry.sessionDocumentId)),
    [previewDocuments]
  )
  const selectedDocumentCount = selectedSessionDocumentIds.size
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
  const selectedMetadataGroup = useMemo(
    () =>
      selectedMetadataGroupId
        ? (groups.find(
            (group) =>
              !group.isTemporary && group.id === selectedMetadataGroupId
          ) ?? null)
        : null,
    [groups, selectedMetadataGroupId]
  )
  const sidePreviewOpen = Boolean(previewDocument || selectedMetadataGroup)
  const pendingClusterGroups = useMemo(
    () => versionToGroups(pendingClusterVersion, metadataItems),
    [metadataItems, pendingClusterVersion]
  )
  const pendingClusterDocumentCount = pendingClusterGroups.reduce(
    (sum, group) => sum + group.documents.length,
    0
  )
  const pendingDossierCount = regularDossierCount(pendingClusterGroups)
  const sortedClusterVersions = useMemo(
    () =>
      [...clusterVersions].sort((a, b) => a.version_number - b.version_number),
    [clusterVersions]
  )
  const displayedClusterVersionIndex = displayedClusterVersionId
    ? sortedClusterVersions.findIndex(
        (version) => version.id === displayedClusterVersionId
      )
    : -1
  const previousDisplayVersion =
    displayedClusterVersionIndex > 0
      ? sortedClusterVersions[displayedClusterVersionIndex - 1]
      : null
  const nextDisplayVersion =
    displayedClusterVersionIndex >= 0 &&
    displayedClusterVersionIndex < sortedClusterVersions.length - 1
      ? sortedClusterVersions[displayedClusterVersionIndex + 1]
      : null
  const viewingHistoricalClusterVersion = Boolean(
    displayedClusterVersionId &&
    activeClusterVersionId &&
    displayedClusterVersionId !== activeClusterVersionId
  )

  useEffect(() => {
    setOpenNodeIds(
      (previous) => new Set([...previous, ...flattenNodeIds(tree)])
    )
  }, [tree])

  useEffect(() => {
    setSelectedSessionDocumentIds((current) => {
      let changed = false
      const next = new Set<number>()
      current.forEach((sessionDocumentId) => {
        if (selectableSessionDocumentIdSet.has(sessionDocumentId)) {
          next.add(sessionDocumentId)
        } else {
          changed = true
        }
      })
      return changed ? next : current
    })
  }, [selectableSessionDocumentIdSet])

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
    if (
      selectedMetadataGroupId !== null &&
      !groups.some(
        (group) => !group.isTemporary && group.id === selectedMetadataGroupId
      )
    ) {
      setSelectedMetadataGroupId(null)
    }
  }, [groups, selectedMetadataGroupId])

  useEffect(() => {
    let cancelled = false
    if (!sessionId) {
      setClusterVersions([])
      return
    }

    const refreshVersions = async () => {
      try {
        const response = await listClusterVersions(sessionId)
        if (!cancelled) {
          setClusterVersions(response.versions ?? [])
        }
      } catch {
        if (!cancelled) {
          setClusterVersions([])
        }
      }
    }

    void refreshVersions()
    return () => {
      cancelled = true
    }
  }, [
    activeClusterVersionId,
    displayedClusterVersionId,
    pendingClusterVersion?.id,
    sessionId,
  ])

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
            setStatus("Đang chờ backend lập lại hồ sơ theo phương án tập lưu.")
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

  const handleToggleDocumentSelection = (
    sessionDocumentId: number,
    checked: boolean
  ) => {
    setSelectedSessionDocumentIds((current) => {
      const next = new Set(current)
      if (checked) {
        next.add(sessionDocumentId)
      } else {
        next.delete(sessionDocumentId)
      }
      return next
    })
  }

  const handleToggleGroupSelection = (
    group: ClusterGroup,
    checked: boolean
  ) => {
    const sessionDocumentIds = group.documents
      .map((document) => document.sessionDocumentId)
      .filter((id): id is number => id !== null)
    if (sessionDocumentIds.length === 0) return
    setSelectedSessionDocumentIds((current) => {
      const next = new Set(current)
      sessionDocumentIds.forEach((sessionDocumentId) => {
        if (checked) {
          next.add(sessionDocumentId)
        } else {
          next.delete(sessionDocumentId)
        }
      })
      return next
    })
  }

  const handleDropOnDossier = async (targetClusterId: string) => {
    if (!draggedDocument) return
    if (viewingHistoricalClusterVersion) {
      stopResultTreeAutoScroll()
      setDraggedDocument(null)
      setDropTargetId(null)
      toast.error(
        "Bạn đang xem phiên bản cũ. Hãy kích hoạt phiên bản này trước khi chỉnh hồ sơ."
      )
      return
    }
    const sourceGroup = groups.find(
      (group) => group.id === draggedDocument.fromClusterId
    )
    const targetGroup = groups.find((group) => group.id === targetClusterId)
    const sourceFeedbackClusterId =
      sourceGroup?.clusterId ?? draggedDocument.fromClusterId
    const targetFeedbackClusterId = targetGroup?.clusterId ?? targetClusterId
    if (
      draggedDocument.fromClusterId === targetClusterId ||
      sourceFeedbackClusterId === targetFeedbackClusterId
    ) {
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
    const targetIsTemporary = Boolean(targetGroup?.isTemporary)
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
        source_cluster_id: sourceFeedbackClusterId,
        target_cluster_id: targetFeedbackClusterId,
        details: {
          action: targetIsTemporary
            ? "move_to_temporary_folder"
            : "manual_move",
          document_id: moving.document.documentId,
          file_name: moving.document.fileName,
          source_cluster_id: sourceFeedbackClusterId,
          target_cluster_id: targetFeedbackClusterId,
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
    if (viewingHistoricalClusterVersion) {
      toast.error(
        "Bạn đang xem phiên bản cũ. Hãy kích hoạt phiên bản này trước khi sửa metadata hồ sơ."
      )
      throw new Error("Cannot edit a historical cluster version")
    }
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

  const handleCreateDossierFromSelection = async () => {
    if (viewingHistoricalClusterVersion) {
      toast.error(
        "Bạn đang xem phiên bản cũ. Hãy kích hoạt phiên bản này trước khi tạo hồ sơ."
      )
      return
    }
    if (!sessionId) {
      toast.error("Chưa có session để tạo hồ sơ từ tài liệu đã chọn.")
      return
    }
    if (pendingClusterVersion) {
      toast.error(
        "Có phiên bản hồ sơ mới. Hãy áp dụng trước khi tạo hồ sơ khác."
      )
      return
    }
    if (
      loading ||
      rebuildSubmitting ||
      rebuildBaselineVersionId ||
      promotingTemporaryFolder ||
      promotingSelectedDocuments ||
      movingSelectedDocumentsTargetId
    ) {
      toast.error("Đang cập nhật hồ sơ. Vui lòng chờ xong rồi thử lại.")
      return
    }
    const sessionDocumentIds = Array.from(selectedSessionDocumentIds).filter(
      (sessionDocumentId) =>
        selectableSessionDocumentIdSet.has(sessionDocumentId)
    )
    if (sessionDocumentIds.length === 0) {
      toast.error("Chưa chọn tài liệu hợp lệ để tạo hồ sơ mới.")
      return
    }

    setPromotingSelectedDocuments(true)
    try {
      const response = await promoteSelectedDocumentsToDossier(sessionId, {
        session_document_ids: sessionDocumentIds,
      })
      setPendingFeedbackCount(
        (count) => count + Math.max(1, response.feedback_count)
      )
      setSelectedSessionDocumentIds(new Set())
      setStatus(
        `Đã ghi nhận ${response.promoted_document_ids.length} tài liệu thành hồ sơ mới. Đang gửi job cập nhật hồ sơ.`
      )
      toast.success("Đã ghi nhận hồ sơ mới từ tài liệu đã chọn.")
      await handleRebuildClusters("update")
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Không thể tạo hồ sơ mới từ tài liệu đã chọn."
      )
    } finally {
      setPromotingSelectedDocuments(false)
    }
  }

  const handleMoveSelectionToDossier = async (group: ClusterGroup) => {
    if (viewingHistoricalClusterVersion) {
      toast.error(
        "Bạn đang xem phiên bản cũ. Hãy kích hoạt phiên bản này trước khi chuyển tài liệu."
      )
      return
    }
    if (!sessionId) {
      toast.error("Chưa có session để chuyển tài liệu đã chọn.")
      return
    }
    if (group.isTemporary) {
      toast.error("Chỉ có thể chuyển lựa chọn tới một hồ sơ.")
      return
    }
    if (pendingClusterVersion) {
      toast.error(
        "Có phiên bản hồ sơ mới. Hãy áp dụng trước khi chuyển tài liệu."
      )
      return
    }
    if (
      loading ||
      rebuildSubmitting ||
      rebuildBaselineVersionId ||
      promotingTemporaryFolder ||
      promotingSelectedDocuments ||
      movingSelectedDocumentsTargetId
    ) {
      toast.error("Đang cập nhật hồ sơ. Vui lòng chờ xong rồi thử lại.")
      return
    }
    const sessionDocumentIds = Array.from(selectedSessionDocumentIds).filter(
      (sessionDocumentId) =>
        selectableSessionDocumentIdSet.has(sessionDocumentId)
    )
    if (sessionDocumentIds.length === 0) {
      toast.error("Chưa chọn tài liệu hợp lệ để chuyển.")
      return
    }

    setMovingSelectedDocumentsTargetId(group.id)
    try {
      const response = await moveSelectedDocumentsToCluster(sessionId, {
        session_document_ids: sessionDocumentIds,
        target_cluster_id: group.clusterId,
      })
      setPendingFeedbackCount(
        (count) => count + Math.max(1, response.feedback_count)
      )
      setSelectedSessionDocumentIds(new Set())
      setStatus(
        `Đã ghi nhận ${response.moved_document_ids.length} tài liệu chuyển tới hồ sơ "${group.label}". Đang gửi job cập nhật hồ sơ.`
      )
      toast.success("Đã ghi nhận chuyển tài liệu tới hồ sơ.")
      await handleRebuildClusters("update")
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Không thể chuyển tài liệu đã chọn tới hồ sơ."
      )
    } finally {
      setMovingSelectedDocumentsTargetId(null)
    }
  }

  const handlePromoteTemporaryFolder = async (group: ClusterGroup) => {
    if (viewingHistoricalClusterVersion) {
      toast.error(
        "Bạn đang xem phiên bản cũ. Hãy kích hoạt phiên bản này trước khi cập nhật Thư mục tạm."
      )
      return
    }
    if (!sessionId) {
      toast.error("Chưa có session để cập nhật Thư mục tạm.")
      return
    }
    if (pendingClusterVersion) {
      toast.error(
        "Có phiên bản hồ sơ mới. Hãy áp dụng trước khi cập nhật Thư mục tạm."
      )
      return
    }
    if (
      loading ||
      rebuildSubmitting ||
      rebuildBaselineVersionId ||
      promotingTemporaryFolder ||
      promotingSelectedDocuments ||
      movingSelectedDocumentsTargetId
    ) {
      toast.error("Đang cập nhật hồ sơ. Vui lòng chờ xong rồi thử lại.")
      return
    }
    const sessionDocumentIds = group.documents
      .map((document) => document.sessionDocumentId)
      .filter((id): id is number => id !== null)
    if (sessionDocumentIds.length === 0) {
      toast.error("Thư mục tạm chưa có tài liệu hợp lệ để tạo hồ sơ.")
      return
    }
    if (sessionDocumentIds.length !== group.documents.length) {
      toast.error("Một số tài liệu trong Thư mục tạm chưa có mã session.")
      return
    }

    setPromotingTemporaryFolder(true)
    try {
      const response = await promoteTemporaryFolderDocuments(sessionId, {
        session_document_ids: sessionDocumentIds,
      })
      setPendingFeedbackCount(
        (count) => count + Math.max(1, response.feedback_count)
      )
      setStatus(
        `Đã ghi nhận ${response.promoted_document_ids.length} tài liệu trong Thư mục tạm thành hồ sơ mới. Đang gửi job cập nhật hồ sơ.`
      )
      toast.success("Đã ghi nhận Thư mục tạm thành hồ sơ mới.")
      await handleRebuildClusters("update")
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Không thể cập nhật Thư mục tạm thành hồ sơ mới."
      )
    } finally {
      setPromotingTemporaryFolder(false)
    }
  }

  const handleRebuildClusters = async (
    mode: "update" | "file_register" = "update"
  ) => {
    const forceFileRegister = mode === "file_register"
    const previousJobMode = clusterJobMode
    if (viewingHistoricalClusterVersion) {
      toast.error(
        "Bạn đang xem phiên bản cũ. Hãy kích hoạt phiên bản này trước khi cập nhật hồ sơ."
      )
      return
    }
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
      const response = await ensureClusterBuild(sessionId, {
        source: forceFileRegister ? "user_file_register" : "user_feedback",
        ...(forceFileRegister
          ? { dossier_build_strategy: "file_register" as const }
          : {}),
      })
      if (response.status === "not_needed") {
        setClusterJobMode(previousJobMode)
        setStatus(
          forceFileRegister
            ? "Hồ sơ theo tập lưu đã được cập nhật với dữ liệu mới nhất."
            : "Hồ sơ đã được cập nhật với dữ liệu mới nhất."
        )
        toast.info(
          forceFileRegister
            ? "Không có thay đổi mới để lập lại hồ sơ theo tập lưu."
            : "Không có tài liệu hoặc feedback mới để cập nhật hồ sơ."
        )
        return
      }
      setRebuildBaselineVersionId(baselineVersionId)
      setRebuildPollKey((key) => key + 1)
      setLoading(true)
      setCheckingClusters(false)
      setClusterJobMode(mode)
      setClusterProgressPhase(FIRST_CLUSTER_PROGRESS_PHASE_ID)
      setClusterProgressMessage(
        clusterProgressMessageForPhase(FIRST_CLUSTER_PROGRESS_PHASE_ID, mode)
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

  const handleViewClusterVersion = async (clusterVersionId: string) => {
    if (!sessionId) {
      toast.error("Chưa có session để xem phiên bản hồ sơ.")
      return
    }
    if (!clusterVersionId || clusterVersionId === displayedClusterVersionId) {
      return
    }

    setLoadingClusterVersionId(clusterVersionId)
    try {
      const version = await getClusterVersion(sessionId, clusterVersionId)
      const nextGroups = versionToGroups(version, metadataItems)
      setGroups(nextGroups)
      setDisplayedClusterVersionId(version.id)
      setDisplayedClusterVersion(version)
      setSelectedSessionDocumentIds(new Set())
      setSelectedPreviewDocumentId(null)
      setSelectedMetadataGroupId(null)
      setDraggedDocument(null)
      setDropTargetId(null)
      setClusterJobMode(clusterJobModeFromSource(version.source))
      setClusterProgressPhase(null)
      setClusterCompletedPhases(completedClusterPhaseSet())
      setClusterProgressMessage(
        version.id === activeClusterVersionId
          ? "Đang xem phiên bản hồ sơ đang dùng."
          : "Đang xem phiên bản hồ sơ cũ. Các thao tác chỉnh sửa đang tạm khóa."
      )
      setStatus(
        `Đang xem phiên bản ${version.version_number} với ${regularDossierCount(nextGroups)} hồ sơ.`
      )
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Không thể tải phiên bản hồ sơ."
      )
    } finally {
      setLoadingClusterVersionId(null)
    }
  }

  const handleActivateDisplayedClusterVersion = async () => {
    if (!sessionId || !displayedClusterVersionId) {
      toast.error("Chưa có phiên bản hồ sơ để kích hoạt.")
      return
    }
    if (displayedClusterVersionId === activeClusterVersionId) return
    if (pendingClusterVersion) {
      toast.error("Hãy xử lý phiên bản hồ sơ đang chờ áp dụng trước.")
      return
    }

    setRestoringClusterVersion(true)
    try {
      const version = await activateClusterVersion(
        sessionId,
        displayedClusterVersionId
      )
      const nextGroups = versionToGroups(version, metadataItems)
      setGroups(nextGroups)
      setActiveClusterVersionId(version.id)
      setDisplayedClusterVersionId(version.id)
      setDisplayedClusterVersion(version)
      setSelectedSessionDocumentIds(new Set())
      setPendingClusterVersion(null)
      setRebuildBaselineVersionId(null)
      setClusterJobMode(clusterJobModeFromSource(version.source))
      setClusterProgressPhase(null)
      setClusterCompletedPhases(completedClusterPhaseSet())
      setClusterProgressMessage(
        "Đã đặt phiên bản đang xem làm phiên bản đang dùng."
      )
      setStatus(
        `Đã đặt phiên bản ${version.version_number} làm phiên bản đang dùng.`
      )
      toast.success("Đã kích hoạt phiên bản hồ sơ đang xem.")
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Không thể kích hoạt phiên bản hồ sơ đang xem."
      )
    } finally {
      setRestoringClusterVersion(false)
    }
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

  const handleSelectPreviewDocument = (document: ClusterDocument) => {
    if (document.sessionDocumentId === null) {
      toast.error("Tài liệu này chưa có mã trong session để lấy preview.")
      return
    }
    setSelectedMetadataGroupId(null)
    setSelectedPreviewDocumentId(document.sessionDocumentId)
  }

  const handleSelectDossierMetadata = (group: ClusterGroup) => {
    setSelectedPreviewDocumentId(null)
    setSelectedMetadataGroupId((current) =>
      current === group.id ? null : group.id
    )
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
    if (viewingHistoricalClusterVersion) {
      toast.error(
        "Bạn đang xem phiên bản cũ. Hãy kích hoạt phiên bản này trước khi tạo mục lục."
      )
      return
    }
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
      promotingTemporaryFolder ||
      promotingSelectedDocuments ||
      Boolean(movingSelectedDocumentsTargetId) ||
      rebuildBaselineVersionId ||
      viewingHistoricalClusterVersion
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
    clusterJobMode !== "new" && (loading || Boolean(rebuildBaselineVersionId))
  const canRestoreFileRegisterVersion =
    displayedClusterVersion?.source === "user_file_register" &&
    Boolean(displayedClusterVersion.previous_version_id)
  const clusterVersionNavigationBusy =
    Boolean(loadingClusterVersionId) || restoringClusterVersion
  const temporaryFolderUpdateDisabled =
    !sessionId ||
    loading ||
    checkingClusters ||
    rebuildSubmitting ||
    restoringClusterVersion ||
    viewingHistoricalClusterVersion ||
    promotingTemporaryFolder ||
    promotingSelectedDocuments ||
    Boolean(movingSelectedDocumentsTargetId) ||
    Boolean(rebuildBaselineVersionId) ||
    Boolean(pendingClusterVersion)
  const selectedDocumentsActionDisabled =
    temporaryFolderUpdateDisabled || selectedDocumentCount === 0
  const feedbackActionsPanel = (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#D8E1EC] bg-white px-4 py-3 shadow-sm xl:flex-row xl:items-center xl:justify-between">
      <p className="min-w-0 flex-1 text-sm text-[#64748B]">
        {selectedDocumentCount > 0
          ? `Đã chọn ${selectedDocumentCount} tài liệu.`
          : pendingFeedbackCount > 0
            ? `Có ${pendingFeedbackCount} feedback đã lưu và đang chờ cập nhật hồ sơ.`
            : "Chọn tài liệu bằng checkbox hoặc kéo tài liệu vào Thư mục tạm để xử lý sau."}
      </p>
      <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:flex xl:w-auto xl:flex-wrap xl:items-center xl:justify-end">
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
            promotingTemporaryFolder ||
            promotingSelectedDocuments ||
            Boolean(movingSelectedDocumentsTargetId) ||
            loading ||
            !sessionId ||
            totalFiles === 0 ||
            viewingHistoricalClusterVersion ||
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
          onClick={() => void handleCreateDossierFromSelection()}
          className="w-full xl:w-auto"
          disabled={selectedDocumentsActionDisabled}
        >
          {promotingSelectedDocuments ? (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          ) : (
            <FolderPlus data-icon="inline-start" />
          )}
          Tạo hồ sơ từ lựa chọn
        </Button>
        <Button
          variant="outline"
          onClick={() => void handleRebuildClusters()}
          className="w-full xl:w-auto"
          disabled={
            rebuildSubmitting ||
            restoringClusterVersion ||
            promotingTemporaryFolder ||
            promotingSelectedDocuments ||
            Boolean(movingSelectedDocumentsTargetId) ||
            loading ||
            !sessionId ||
            totalFiles === 0 ||
            viewingHistoricalClusterVersion ||
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
            promotingTemporaryFolder ||
            promotingSelectedDocuments ||
            Boolean(movingSelectedDocumentsTargetId) ||
            viewingHistoricalClusterVersion ||
            Boolean(rebuildBaselineVersionId) ||
            Boolean(pendingClusterVersion)
          }
        >
          <CheckCircle2 data-icon="inline-start" />
          Đánh số trang
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

      {sortedClusterVersions.length > 0 && displayedClusterVersion && (
        <div className="flex flex-col gap-3 rounded-2xl border border-[#D8E1EC] bg-white px-4 py-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#0F172A]">
              Phiên bản hồ sơ
            </p>
            <p className="mt-1 text-xs text-[#64748B]">
              Đang xem phiên bản {displayedClusterVersion.version_number}
              {displayedClusterVersion.id === activeClusterVersionId
                ? " · đang dùng"
                : " · chỉ xem"}
              {" · "}
              {clusterVersionSourceLabel(displayedClusterVersion.source)}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                previousDisplayVersion &&
                void handleViewClusterVersion(previousDisplayVersion.id)
              }
              disabled={!previousDisplayVersion || clusterVersionNavigationBusy}
              className="h-9 gap-1.5"
            >
              {loadingClusterVersionId === previousDisplayVersion?.id ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <ChevronLeft data-icon="inline-start" />
              )}
              Lùi
            </Button>
            <select
              value={displayedClusterVersionId ?? ""}
              onChange={(event) =>
                void handleViewClusterVersion(event.target.value)
              }
              disabled={clusterVersionNavigationBusy}
              className="h-9 min-w-[15rem] rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm text-[#0F172A] transition-colors outline-none focus-visible:border-[#0052FF] focus-visible:ring-3 focus-visible:ring-[#0052FF]/20"
            >
              {[...sortedClusterVersions].reverse().map((version) => (
                <option key={version.id} value={version.id}>
                  {clusterVersionOptionLabel(version, activeClusterVersionId)}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                nextDisplayVersion &&
                void handleViewClusterVersion(nextDisplayVersion.id)
              }
              disabled={!nextDisplayVersion || clusterVersionNavigationBusy}
              className="h-9 gap-1.5"
            >
              {loadingClusterVersionId === nextDisplayVersion?.id ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <ChevronRight data-icon="inline-start" />
              )}
              Tiến
            </Button>
            {viewingHistoricalClusterVersion && (
              <Button
                size="sm"
                onClick={() => void handleActivateDisplayedClusterVersion()}
                disabled={
                  clusterVersionNavigationBusy || Boolean(pendingClusterVersion)
                }
                className="h-9"
              >
                {restoringClusterVersion ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                ) : (
                  <Check data-icon="inline-start" />
                )}
                Đặt làm đang dùng
              </Button>
            )}
          </div>
        </div>
      )}

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
                cùng thời hạn bảo quản mới. Nút áp dụng sẽ bật khi phiên bản mới
                sẵn sàng.
              </p>
            ) : clusterJobMode === "file_register" ? (
              <p className="mt-1 text-sm text-[#475569]">
                Backend đang bỏ qua cách lập hồ sơ của phương án hiện tại và sắp
                xếp tài liệu theo dạng tập lưu. Nút áp dụng sẽ bật khi phiên bản
                mới sẵn sàng.
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
          sidePreviewOpen &&
            "xl:[grid-template-columns:var(--result-preview-columns)]"
        )}
        style={
          sidePreviewOpen
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
                  compact={sidePreviewOpen}
                  selectedPreviewDocumentId={selectedPreviewDocumentId}
                  selectedMetadataGroupId={selectedMetadataGroupId}
                  selectedSessionDocumentIds={selectedSessionDocumentIds}
                  selectedDocumentCount={selectedDocumentCount}
                  selectedDocumentsActionDisabled={
                    selectedDocumentsActionDisabled
                  }
                  movingSelectedDocumentsTargetId={
                    movingSelectedDocumentsTargetId
                  }
                  promotingTemporaryFolder={promotingTemporaryFolder}
                  temporaryFolderUpdateDisabled={temporaryFolderUpdateDisabled}
                  onToggle={toggleNode}
                  onToggleDocumentSelection={handleToggleDocumentSelection}
                  onToggleGroupSelection={handleToggleGroupSelection}
                  onMoveSelectionToDossier={handleMoveSelectionToDossier}
                  onDragStart={(document, fromClusterId) => {
                    if (viewingHistoricalClusterVersion) {
                      toast.error(
                        "Bạn đang xem phiên bản cũ. Hãy kích hoạt phiên bản này trước khi kéo thả tài liệu."
                      )
                      return
                    }
                    setDraggedDocument({ document, fromClusterId })
                  }}
                  onDragEnd={() => {
                    stopResultTreeAutoScroll()
                    setDraggedDocument(null)
                    setDropTargetId(null)
                  }}
                  onDragEnter={setDropTargetId}
                  onDropOnDossier={handleDropOnDossier}
                  onSelectPreview={handleSelectPreviewDocument}
                  onSelectDossierMetadata={handleSelectDossierMetadata}
                  onPromoteTemporaryFolder={handlePromoteTemporaryFolder}
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
        {sidePreviewOpen && (
          <div className="relative min-w-0">
            <button
              type="button"
              aria-label="Kéo để đổi kích thước khung xem"
              title="Kéo để đổi kích thước khung xem"
              onPointerDown={handlePreviewResizePointerDown}
              className="group absolute top-0 bottom-0 -left-3 z-20 hidden w-5 cursor-col-resize items-center justify-center xl:flex"
            >
              <span className="h-16 w-1 rounded-full bg-[#0052FF] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
            </button>
            {previewDocument ? (
              <DocumentPdfPreview
                sessionId={sessionId}
                document={previewDocument}
                className="h-[min(70svh,560px)] min-h-[420px] min-w-0"
                onClose={() => setSelectedPreviewDocumentId(null)}
              />
            ) : selectedMetadataGroup ? (
              <DossierMetadataSidePanel
                group={selectedMetadataGroup}
                saving={
                  savingDossierMetadataId ===
                  (selectedMetadataGroup.dossierId ?? selectedMetadataGroup.id)
                }
                className="h-[min(70svh,560px)] min-h-[420px] min-w-0"
                onSave={handleSaveDossierMetadata}
                onClose={() => setSelectedMetadataGroupId(null)}
              />
            ) : null}
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

function SelectionCheckbox({
  checked,
  indeterminate = false,
  disabled = false,
  ariaLabel,
  title,
  onChange,
}: {
  checked: boolean
  indeterminate?: boolean
  disabled?: boolean
  ariaLabel: string
  title: string
  onChange: (checked: boolean) => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate
    }
  }, [indeterminate])

  return (
    <input
      ref={inputRef}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title}
      draggable={false}
      className="mt-1 size-4 shrink-0 cursor-pointer accent-[#0052FF] disabled:cursor-not-allowed disabled:opacity-40"
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => onChange(event.currentTarget.checked)}
      onDragStart={(event) => event.stopPropagation()}
    />
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
  selectedMetadataGroupId,
  selectedSessionDocumentIds,
  selectedDocumentCount,
  selectedDocumentsActionDisabled,
  movingSelectedDocumentsTargetId,
  promotingTemporaryFolder,
  temporaryFolderUpdateDisabled,
  onToggle,
  onToggleDocumentSelection,
  onToggleGroupSelection,
  onMoveSelectionToDossier,
  onDragStart,
  onDragEnd,
  onDragEnter,
  onDropOnDossier,
  onSelectPreview,
  onSelectDossierMetadata,
  onPromoteTemporaryFolder,
}: {
  node: ResultTreeNode
  depth: number
  openNodeIds: Set<string>
  draggedDocument: DraggedDocument | null
  dropTargetId: string | null
  compact: boolean
  selectedPreviewDocumentId: number | null
  selectedMetadataGroupId: string | null
  selectedSessionDocumentIds: Set<number>
  selectedDocumentCount: number
  selectedDocumentsActionDisabled: boolean
  movingSelectedDocumentsTargetId: string | null
  promotingTemporaryFolder: boolean
  temporaryFolderUpdateDisabled: boolean
  onToggle: (nodeId: string) => void
  onToggleDocumentSelection: (
    sessionDocumentId: number,
    checked: boolean
  ) => void
  onToggleGroupSelection: (group: ClusterGroup, checked: boolean) => void
  onMoveSelectionToDossier: (group: ClusterGroup) => void
  onDragStart: (document: ClusterDocument, fromClusterId: string) => void
  onDragEnd: () => void
  onDragEnter: (nodeId: string | null) => void
  onDropOnDossier: (targetClusterId: string) => void
  onSelectPreview: (document: ClusterDocument) => void
  onSelectDossierMetadata: (group: ClusterGroup) => void
  onPromoteTemporaryFolder: (group: ClusterGroup) => void
}) {
  const open = openNodeIds.has(node.id)
  const isDossier = node.type === "dossier"
  const isTemporary = node.type === "temporary"
  const isDropFolder = isDossier || isTemporary
  const group = node.group
  const canDrop = Boolean(
    draggedDocument && group && draggedDocument.fromClusterId !== group.id
  )
  const groupSessionDocumentIds =
    group?.documents
      .map((document) => document.sessionDocumentId)
      .filter((id): id is number => id !== null) ?? []
  const selectedGroupDocumentCount = groupSessionDocumentIds.filter(
    (sessionDocumentId) => selectedSessionDocumentIds.has(sessionDocumentId)
  ).length
  const groupSelectionChecked =
    groupSessionDocumentIds.length > 0 &&
    selectedGroupDocumentCount === groupSessionDocumentIds.length
  const groupSelectionIndeterminate =
    selectedGroupDocumentCount > 0 &&
    selectedGroupDocumentCount < groupSessionDocumentIds.length
  const indentStep = compact ? 14 : 20
  const displayLabel = node.label
  const selectedDossierMetadata =
    Boolean(group) && selectedMetadataGroupId === group?.id

  return (
    <div
      className={cn(
        "max-w-full min-w-0",
        isDossier ? "overflow-visible" : "overflow-hidden"
      )}
    >
      <div
        className={cn(
          "group flex min-h-10 max-w-full min-w-0 gap-2 rounded-xl px-2 py-1.5 transition-all",
          isDossier
            ? "items-start overflow-visible"
            : "items-center overflow-hidden",
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

        {isDropFolder && group && (
          <SelectionCheckbox
            checked={groupSelectionChecked}
            indeterminate={groupSelectionIndeterminate}
            disabled={groupSessionDocumentIds.length === 0}
            ariaLabel={`Chọn toàn bộ tài liệu trong ${group.label}`}
            title="Chọn toàn bộ tài liệu trong hồ sơ"
            onChange={(checked) => onToggleGroupSelection(group, checked)}
          />
        )}

        {isTemporary ? (
          <FolderClock className="size-4 shrink-0 text-amber-600" />
        ) : open ? (
          <FolderOpen className="size-4 shrink-0 text-[#0052FF]" />
        ) : (
          <Folder className="size-4 shrink-0 text-[#0052FF]" />
        )}

        <div
          className={cn(
            "min-w-0 flex-1",
            isDossier ? "overflow-visible" : "overflow-hidden"
          )}
        >
          <div
            className={cn(
              "flex min-w-0 gap-2",
              isDossier
                ? "items-start overflow-visible"
                : "items-center overflow-hidden"
            )}
          >
            <span
              className={cn(
                "min-w-0 flex-1 text-sm",
                isDossier
                  ? "leading-5 [overflow-wrap:anywhere] break-words whitespace-normal"
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
            {group?.createdFromTemporaryFolder && !isTemporary && (
              <span
                className="flex h-6 shrink-0 items-center gap-1 rounded-full border border-[#0052FF] bg-[#0052FF] px-2.5 text-[11px] font-bold text-white shadow-[0_4px_12px_rgba(0,82,255,0.22)]"
                title="Hồ sơ được tạo thủ công từ Thư mục tạm"
              >
                <FolderPlus className="size-3" />
                Thủ công
              </span>
            )}
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
          {isDossier && group && selectedDocumentCount > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              title="Chuyển các tài liệu đã chọn tới hồ sơ này"
              disabled={selectedDocumentsActionDisabled}
              onClick={(event) => {
                event.stopPropagation()
                onMoveSelectionToDossier(group)
              }}
            >
              {movingSelectedDocumentsTargetId === group.id ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <MoveRight data-icon="inline-start" />
              )}
              <span className={cn(compact && "hidden 2xl:inline")}>
                Chuyển tới hồ sơ này
              </span>
            </Button>
          )}
          {isTemporary && group && group.documents.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              title="Tạo hồ sơ từ các tài liệu trong Thư mục tạm"
              disabled={temporaryFolderUpdateDisabled}
              onClick={(event) => {
                event.stopPropagation()
                onPromoteTemporaryFolder(group)
              }}
            >
              {promotingTemporaryFolder ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <FolderPlus data-icon="inline-start" />
              )}
              <span className={cn(compact && "hidden 2xl:inline")}>
                Cập nhật
              </span>
            </Button>
          )}
          {isDossier && group && (
            <Button
              type="button"
              variant={selectedDossierMetadata ? "default" : "outline"}
              size="icon-sm"
              title="Xem metadata hồ sơ"
              onClick={(event) => {
                event.stopPropagation()
                onSelectDossierMetadata(group)
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
              selectionChecked={
                document.sessionDocumentId !== null &&
                selectedSessionDocumentIds.has(document.sessionDocumentId)
              }
              selectionDisabled={document.sessionDocumentId === null}
              onToggleSelection={onToggleDocumentSelection}
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
              selectedMetadataGroupId={selectedMetadataGroupId}
              selectedSessionDocumentIds={selectedSessionDocumentIds}
              selectedDocumentCount={selectedDocumentCount}
              selectedDocumentsActionDisabled={selectedDocumentsActionDisabled}
              movingSelectedDocumentsTargetId={movingSelectedDocumentsTargetId}
              promotingTemporaryFolder={promotingTemporaryFolder}
              temporaryFolderUpdateDisabled={temporaryFolderUpdateDisabled}
              onToggle={onToggle}
              onToggleDocumentSelection={onToggleDocumentSelection}
              onToggleGroupSelection={onToggleGroupSelection}
              onMoveSelectionToDossier={onMoveSelectionToDossier}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragEnter={onDragEnter}
              onDropOnDossier={onDropOnDossier}
              onSelectPreview={onSelectPreview}
              onSelectDossierMetadata={onSelectDossierMetadata}
              onPromoteTemporaryFolder={onPromoteTemporaryFolder}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function DossierMetadataSidePanel({
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
function DocumentRow({
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

function clusterVersionSourceLabel(source: unknown): string {
  if (source === "plan_reanalysis") return "theo phương án mới"
  if (source === "user_file_register") return "theo tập lưu"
  if (source === "user_feedback") return "từ feedback"
  if (source === "user_metadata_import") return "nhập metadata"
  if (source === "system") return "tự động"
  const text = String(source || "").trim()
  return text || "không rõ nguồn"
}

function clusterVersionOptionLabel(
  version: ClusterVersionResponse,
  activeClusterVersionId: string | null
): string {
  const status =
    version.id === activeClusterVersionId
      ? "đang dùng"
      : version.status === "active"
        ? "active"
        : "cũ"
  return `Phiên bản ${version.version_number} - ${status} - ${clusterVersionSourceLabel(version.source)}`
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
  return sortResultTreeNodes(roots)
}

function resultTreePath(group: ClusterGroup): string[] {
  const classificationPath = (group.classificationPath ?? [])
    .map((segment) => segment.trim())
    .filter(Boolean)
  const yearLabel = dossierYearLabel(group)
  const hasKnownYear =
    normalizePathSegment(yearLabel) !== normalizePathSegment(UNKNOWN_YEAR_LABEL)
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

  const tail =
    classificationPath.length > 0 ? classificationPath : [UNCLASSIFIED_LABEL]
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

function sortResultTreeNodes(nodes: ResultTreeNode[]): ResultTreeNode[] {
  nodes.forEach((node) => {
    node.children = sortResultTreeNodes(node.children)
  })
  return nodes.sort(compareResultTreeNodes)
}

function compareResultTreeNodes(a: ResultTreeNode, b: ResultTreeNode): number {
  if (a.type === "temporary" && b.type !== "temporary") return -1
  if (b.type === "temporary" && a.type !== "temporary") return 1

  const aIsYearNode = a.type === "year" || isYearPathSegment(a.label)
  const bIsYearNode = b.type === "year" || isYearPathSegment(b.label)
  if (aIsYearNode && bIsYearNode) {
    const aYear = resultTreeYearValue(a.label)
    const bYear = resultTreeYearValue(b.label)
    if (aYear !== null && bYear !== null && aYear !== bYear) {
      return aYear - bYear
    }
    if (aYear !== null && bYear === null) return -1
    if (aYear === null && bYear !== null) return 1
  }

  if (a.type === "dossier" && b.type === "dossier") {
    const periodComparison = compareResultTreePeriodSortValues(
      resultTreePeriodSortValue(a),
      resultTreePeriodSortValue(b)
    )
    if (periodComparison !== 0) return periodComparison

    const aDossierNumber = resultTreeDossierNumberValue(a.group?.dossierNumber)
    const bDossierNumber = resultTreeDossierNumberValue(b.group?.dossierNumber)
    if (
      aDossierNumber !== null &&
      bDossierNumber !== null &&
      aDossierNumber !== bDossierNumber
    ) {
      return aDossierNumber - bDossierNumber
    }
  }

  return a.label.localeCompare(b.label, "vi")
}

function resultTreeYearValue(value: string): number | null {
  const match = normalizePathSegment(value).match(/\b(?:19|20)\d{2}\b/)
  return match ? Number(match[0]) : null
}

interface ResultTreePeriodSortValue {
  year: number
  month: number
  day: number
}

function compareResultTreePeriodSortValues(
  a: ResultTreePeriodSortValue | null,
  b: ResultTreePeriodSortValue | null
): number {
  if (!a && !b) return 0
  if (a && !b) return -1
  if (!a && b) return 1
  if (!a || !b) return 0
  if (a.year !== b.year) return a.year - b.year
  if (a.month !== b.month) return a.month - b.month
  return a.day - b.day
}

function resultTreePeriodSortValue(
  node: ResultTreeNode
): ResultTreePeriodSortValue | null {
  return (
    resultTreePeriodSortValueFromDate(node.group?.startDate) ??
    resultTreePeriodSortValueFromDate(node.group?.endDate) ??
    resultTreePeriodSortValueFromLabel(node.label)
  )
}

function resultTreePeriodSortValueFromDate(
  value: string | null | undefined
): ResultTreePeriodSortValue | null {
  const text = String(value ?? "").trim()
  if (!text) return null
  const match = text.match(
    /\b((?:19|20)\d{2})(?:[-/](\d{1,2}))?(?:[-/](\d{1,2}))?\b/
  )
  if (!match) return null
  const year = Number(match[1])
  const month = clampPeriodNumber(Number(match[2] ?? 0), 0, 12)
  const day = clampPeriodNumber(Number(match[3] ?? 0), 0, 31)
  return { year, month, day }
}

function resultTreePeriodSortValueFromLabel(
  value: string
): ResultTreePeriodSortValue | null {
  const year = resultTreeYearValue(value)
  if (year === null) return null
  const normalized = normalizePathSegment(value)
  const monthMatch = normalized.match(/\bthang\s+(\d{1,2})\b/)
  if (monthMatch) {
    return {
      year,
      month: clampPeriodNumber(Number(monthMatch[1]), 1, 12),
      day: 0,
    }
  }

  const quarterMatch = normalized.match(/\bquy\s+([ivxlcdm]+|\d{1,2})\b/)
  if (quarterMatch) {
    const quarter = quarterValue(quarterMatch[1])
    if (quarter !== null) {
      return {
        year,
        month: (quarter - 1) * 3 + 1,
        day: 0,
      }
    }
  }

  return { year, month: 0, day: 0 }
}

function quarterValue(value: string): number | null {
  const normalized = value.toLowerCase()
  const numeric = Number(normalized)
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 4) {
    return numeric
  }
  const roman: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4 }
  return roman[normalized] ?? null
}

function clampPeriodNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(Math.max(value, min), max)
}

function resultTreeDossierNumberValue(
  value: string | null | undefined
): number | null {
  const match = String(value ?? "").match(/\d+/)
  return match ? Number(match[0]) : null
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
    archiveName: group?.archiveName ?? "",
    fondsName: group?.fondsName ?? "",
    inventoryNumber: group?.inventoryNumber ?? "",
    boxNumber: group?.boxNumber ?? "",
    dossierNumber: group?.dossierNumber ?? "",
    informationSign: group?.informationSign ?? "",
    title: group?.label ?? "",
    annotation: group?.annotation ?? "",
    startDate: group?.startDate ?? "",
    endDate: group?.endDate ?? "",
    language: group?.language ?? "",
    sheetCount:
      typeof group?.sheetCount === "number" ? String(group.sheetCount) : "",
    retentionPeriod: group?.retentionPeriod ?? "",
    usageMode: group?.usageMode ?? "",
    physicalCondition: group?.physicalCondition ?? "",
    note: group?.note ?? "",
  }
}

function dossierPatchPayloadFromDraft(
  draft: DossierMetadataDraft
): SessionDossierPatchPayload {
  return {
    title: trimmedOrNull(draft.title),
    dossier_number: trimmedOrNull(draft.dossierNumber),
    box_number: trimmedOrNull(draft.boxNumber),
    retention_period: trimmedOrNull(draft.retentionPeriod),
    archive_name: trimmedOrNull(draft.archiveName),
    fonds_name: trimmedOrNull(draft.fondsName),
    inventory_number: trimmedOrNull(draft.inventoryNumber),
    information_sign: trimmedOrNull(draft.informationSign),
    annotation: trimmedOrNull(draft.annotation),
    start_date: trimmedOrNull(draft.startDate),
    end_date: trimmedOrNull(draft.endDate),
    language: trimmedOrNull(draft.language),
    sheet_count: trimmedOrNull(draft.sheetCount),
    usage_mode: trimmedOrNull(draft.usageMode),
    physical_condition: trimmedOrNull(draft.physicalCondition),
    note: trimmedOrNull(draft.note),
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
      archiveName: dossier.archive_name ?? null,
      fondsName: dossier.fonds_name ?? null,
      inventoryNumber: dossier.inventory_number ?? null,
      informationSign: dossier.information_sign ?? null,
      annotation: dossier.annotation ?? null,
      startDate: dossier.start_date ?? group.startDate,
      endDate: dossier.end_date ?? group.endDate,
      language: dossier.language ?? null,
      sheetCount:
        typeof dossier.sheet_count === "string"
          ? Number(dossier.sheet_count) || null
          : group.sheetCount,
      usageMode: dossier.usage_mode ?? null,
      physicalCondition: dossier.physical_condition ?? null,
      note: dossier.note ?? null,
      retentionPeriod: dossier.retention_period ?? null,
      createdFromTemporaryFolder:
        typeof dossier.created_from_temporary_folder === "boolean"
          ? dossier.created_from_temporary_folder
          : group.createdFromTemporaryFolder,
      label: dossier.title || dossier.generated_title || group.label,
    }
  })
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
