import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { DocumentPreviewTarget } from "@/features/upload/components/DocumentPdfPreview"
import {
  cancelPendingClusterFeedback,
  getClusterGroupInformationTable,
  listClusterFeedback,
  patchSessionDossier,
  type ClusterGroupInformationTableResponse,
  type ClusterVersionResponse,
  type SessionDossierSuggestion,
} from "@/features/upload/api/sessionApi"
import { toast } from "sonner"
import {
  ensureTemporaryFolderGroup,
  versionToGroups,
  type ClusterDocument,
  type ClusterGroup,
} from "@/features/upload/lib/clusterGroups"
import { FinalResultView } from "./FinalResult.view"
import { useFinalResultPolling } from "./useFinalResultPolling"
import { useFinalResultVersionActions } from "./useFinalResultVersionActions"
import { useFinalResultTreeActions } from "./useFinalResultTreeActions"
import type {
  DraggedDocument,
  FinalResultProps,
  PreviewDocumentEntry,
  ResultTreeNode,
} from "./FinalResult.types"
import {
  buildResultTree,
  dossierGroupsFromNode,
  findResultTreeNode,
  findResultTreeDossierMatches,
  flattenNodeIds,
} from "./FinalResult.treeUtils"
import {
  clusterDocumentToPreviewTarget,
  dossierPageCount,
  regularDossierCount,
  updateDossierGroupFromResponse,
} from "./FinalResult.metadataUtils"
import {
  clusterProgressLabel,
  completedClusterPhaseSet,
  type ClusterJobMode,
} from "./FinalResult.progress"
import {
  applyPendingDossierDrafts,
  applyPendingFeedbackOverlay,
  clearPendingFeedbackMarkers,
} from "./FinalResult.pendingFeedback"

const DOSSIER_SUGGESTION_TOP_K = 5

export function FinalResult({
  sessionId,
  groups: initialGroups,
  fondsName,
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
  const [pendingFeedbackRefreshKey, setPendingFeedbackRefreshKey] = useState(0)
  const [cancelingPendingFeedback, setCancelingPendingFeedback] =
    useState(false)
  const [selectedSessionDocumentIds, setSelectedSessionDocumentIds] = useState<
    Set<number>
  >(() => new Set())
  const [selectedPreviewDocumentId, setSelectedPreviewDocumentId] = useState<
    number | null
  >(null)
  const [
    selectedDossierSuggestionsDocumentIds,
    setSelectedDossierSuggestionsDocumentIds,
  ] = useState<number[]>([])
  const [
    selectedDossierSuggestionCandidates,
    setSelectedDossierSuggestionCandidates,
  ] = useState<SessionDossierSuggestion[] | null>(null)
  const [dossierSuggestionsLoading, setDossierSuggestionsLoading] =
    useState(false)
  const [dossierSuggestionsRefreshing, setDossierSuggestionsRefreshing] =
    useState(false)
  const [dossierSuggestionsError, setDossierSuggestionsError] = useState("")
  const [selectedMetadataGroupId, setSelectedMetadataGroupId] = useState<
    string | null
  >(null)
  const [selectedGroupInfoNodeId, setSelectedGroupInfoNodeId] = useState<
    string | null
  >(null)
  const [groupInformationTable, setGroupInformationTable] =
    useState<ClusterGroupInformationTableResponse | null>(null)
  const [groupInformationLoading, setGroupInformationLoading] = useState(false)
  const [groupInformationError, setGroupInformationError] = useState("")
  const [previewWidthPercent, setPreviewWidthPercent] = useState(50)
  const previewLayoutRef = useRef<HTMLDivElement | null>(null)
  const resultTreeScrollRef = useRef<HTMLDivElement | null>(null)
  const resultTreeDragYRef = useRef<number | null>(null)
  const resultTreeAutoScrollFrameRef = useRef<number | null>(null)
  const displayedClusterVersionRef = useRef<ClusterVersionResponse | null>(null)
  const metadataItemsRef = useRef(metadataItems)
  const lastFeedbackRequestKeyRef = useRef("")
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
        (item) => item.metadata_ready && item.is_reviewed === true
      ),
    [metadataItems]
  )
  const tree = useMemo(
    () => buildResultTree(groups, fondsName),
    [groups, fondsName]
  )
  const [resultTreeSearch, setResultTreeSearch] = useState("")
  const [resultTreeSearchIndex, setResultTreeSearchIndex] = useState(0)
  const resultTreeSearchMatches = useMemo(
    () => findResultTreeDossierMatches(tree, resultTreeSearch),
    [resultTreeSearch, tree]
  )
  const activeResultTreeSearchMatch =
    resultTreeSearchMatches[resultTreeSearchIndex] ?? null
  const activeResultTreeSearchAncestorKey =
    activeResultTreeSearchMatch?.ancestorIds.join("\u001f") ?? ""
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
  const selectedDossierSuggestionsDocuments = useMemo(() => {
    if (selectedDossierSuggestionsDocumentIds.length === 0) return []
    const documentsBySessionId = new Map(
      groups
        .flatMap((group) => group.documents)
        .flatMap((document) =>
          document.sessionDocumentId === null
            ? []
            : [[document.sessionDocumentId, document] as const]
        )
    )
    return selectedDossierSuggestionsDocumentIds.flatMap(
      (sessionDocumentId) => {
        const document = documentsBySessionId.get(sessionDocumentId)
        return document ? [document] : []
      }
    )
  }, [groups, selectedDossierSuggestionsDocumentIds])
  const selectedDossierSuggestionsDocumentId =
    selectedDossierSuggestionsDocumentIds.length === 1
      ? selectedDossierSuggestionsDocumentIds[0]
      : null
  const dossierSuggestionRepresentativeDocuments = useMemo(
    () => previewDocuments.map((entry) => entry.document),
    [previewDocuments]
  )
  const selectedGroupInfoNode = useMemo<ResultTreeNode | null>(
    () =>
      selectedGroupInfoNodeId
        ? findResultTreeNode(tree, selectedGroupInfoNodeId)
        : null,
    [selectedGroupInfoNodeId, tree]
  )
  const selectedGroupInfoDossierIds = useMemo(
    () =>
      selectedGroupInfoNode
        ? dossierGroupsFromNode(selectedGroupInfoNode)
            .map((group) => group.dossierId ?? group.id)
            .filter((id): id is string => Boolean(id))
        : [],
    [selectedGroupInfoNode]
  )
  const selectedGroupInfoDossierKey = selectedGroupInfoDossierIds.join("\u001f")
  const selectedGroupInfoLabel = selectedGroupInfoNode?.label ?? ""
  const sidePreviewOpen = Boolean(
    previewDocument || selectedMetadataGroup || selectedGroupInfoNode
  )
  const pendingClusterGroups = useMemo(
    () => versionToGroups(pendingClusterVersion, metadataItems),
    [metadataItems, pendingClusterVersion]
  )
  const pendingClusterVersionId = pendingClusterVersion?.id ?? null
  const hasPendingClusterVersion = pendingClusterVersionId !== null
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
    displayedClusterVersionRef.current = displayedClusterVersion
    metadataItemsRef.current = metadataItems
  }, [displayedClusterVersion, metadataItems])

  useEffect(() => {
    let cancelled = false
    const currentDisplayedClusterVersion = displayedClusterVersionRef.current
    const displayingActiveVersion = Boolean(
      sessionId &&
      currentDisplayedClusterVersion &&
      displayedClusterVersionId &&
      activeClusterVersionId &&
      displayedClusterVersionId === activeClusterVersionId
    )
    if (rebuildSubmitting || rebuildBaselineVersionId || loading) {
      return () => {
        cancelled = true
      }
    }
    if (!displayingActiveVersion || hasPendingClusterVersion) {
      const timeoutId = window.setTimeout(() => {
        if (cancelled) return
        if (!displayingActiveVersion || hasPendingClusterVersion) {
          setPendingFeedbackCount(0)
        }
        if (displayingActiveVersion && currentDisplayedClusterVersion) {
          setGroups(
            versionToGroups(
              currentDisplayedClusterVersion,
              metadataItemsRef.current
            )
          )
        }
      }, 0)
      return () => {
        cancelled = true
        window.clearTimeout(timeoutId)
      }
    }

    const feedbackRequestKey = [
      sessionId,
      activeClusterVersionId,
      displayedClusterVersionId,
      pendingFeedbackRefreshKey,
    ].join(":")
    if (lastFeedbackRequestKeyRef.current === feedbackRequestKey) {
      return () => {
        cancelled = true
      }
    }
    lastFeedbackRequestKeyRef.current = feedbackRequestKey

    listClusterFeedback(sessionId!, { pendingOnly: true, limit: 500 })
      .then((response) => {
        if (cancelled) return
        const hasServerPendingFeedback = Array.isArray(
          response.pending_feedback
        )
        const baseGroups = versionToGroups(
          currentDisplayedClusterVersion,
          metadataItemsRef.current
        )
        const overlay = applyPendingFeedbackOverlay(
          baseGroups,
          hasServerPendingFeedback
            ? response.pending_feedback!
            : (response.feedback ?? []),
          currentDisplayedClusterVersion,
          hasServerPendingFeedback
        )
        setGroups(
          applyPendingDossierDrafts(
            overlay.groups,
            response.dossier_drafts ?? []
          )
        )
        setPendingFeedbackCount(
          response.pending_feedback_count ?? overlay.pendingFeedbackCount
        )
      })
      .catch(() => {
        if (!cancelled) setPendingFeedbackCount(0)
      })

    return () => {
      cancelled = true
    }
  }, [
    activeClusterVersionId,
    displayedClusterVersionId,
    hasPendingClusterVersion,
    loading,
    pendingFeedbackRefreshKey,
    rebuildBaselineVersionId,
    rebuildSubmitting,
    sessionId,
  ])

  useEffect(() => {
    setOpenNodeIds(
      (previous) => new Set([...previous, ...flattenNodeIds(tree)])
    )
  }, [tree])

  useEffect(() => {
    setResultTreeSearchIndex(0)
  }, [resultTreeSearch])

  useEffect(() => {
    if (resultTreeSearchIndex < resultTreeSearchMatches.length) return
    setResultTreeSearchIndex(0)
  }, [resultTreeSearchIndex, resultTreeSearchMatches.length])

  useEffect(() => {
    if (!activeResultTreeSearchMatch) return
    setOpenNodeIds((previous) => {
      let changed = false
      const next = new Set(previous)
      activeResultTreeSearchMatch.ancestorIds.forEach((id) => {
        if (!next.has(id)) {
          next.add(id)
          changed = true
        }
      })
      return changed ? next : previous
    })
    const timeoutId = window.setTimeout(() => {
      scrollResultTreeNodeIntoView(
        resultTreeScrollRef.current,
        activeResultTreeSearchMatch.nodeId
      )
    }, 120)
    return () => window.clearTimeout(timeoutId)
  }, [
    activeResultTreeSearchAncestorKey,
    activeResultTreeSearchMatch,
    resultTreeScrollRef,
  ])

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
    if (selectedGroupInfoNodeId !== null && !selectedGroupInfoNode) {
      setSelectedGroupInfoNodeId(null)
      setGroupInformationTable(null)
      setGroupInformationError("")
    }
  }, [selectedGroupInfoNode, selectedGroupInfoNodeId])

  useEffect(() => {
    let cancelled = false
    if (!selectedGroupInfoNodeId) {
      setGroupInformationLoading(false)
      return () => {
        cancelled = true
      }
    }
    if (!sessionId) {
      setGroupInformationTable(null)
      setGroupInformationLoading(false)
      setGroupInformationError("Chưa có session để tải thông tin nhóm.")
      return () => {
        cancelled = true
      }
    }
    if (!selectedGroupInfoDossierKey) {
      setGroupInformationTable(null)
      setGroupInformationLoading(false)
      setGroupInformationError("")
      return () => {
        cancelled = true
      }
    }

    const dossierIds = selectedGroupInfoDossierKey.split("\u001f")
    setGroupInformationLoading(true)
    setGroupInformationError("")
    getClusterGroupInformationTable(sessionId, {
      cluster_version_id: displayedClusterVersionId,
      dossier_ids: dossierIds,
      group_label: selectedGroupInfoLabel,
    })
      .then((table) => {
        if (cancelled) return
        setGroupInformationTable(table)
      })
      .catch((err) => {
        if (cancelled) return
        setGroupInformationTable(null)
        setGroupInformationError(
          err instanceof Error
            ? err.message
            : "Không thể tải thông tin nhóm hồ sơ."
        )
      })
      .finally(() => {
        if (!cancelled) setGroupInformationLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [
    displayedClusterVersionId,
    selectedGroupInfoDossierKey,
    selectedGroupInfoLabel,
    selectedGroupInfoNodeId,
    sessionId,
  ])

  useEffect(() => {
    setSelectedGroupInfoNodeId(null)
    setGroupInformationTable(null)
    setGroupInformationError("")
    setSelectedDossierSuggestionsDocumentIds([])
    setSelectedDossierSuggestionCandidates(null)
    setDossierSuggestionsLoading(false)
    setDossierSuggestionsRefreshing(false)
    setDossierSuggestionsError("")
  }, [displayedClusterVersionId])

  useFinalResultPolling({
    activeClusterVersionId,
    checkingClusters,
    clusterJobMode,
    displayedClusterVersionId,
    groups,
    hasClusterData,
    loading,
    metadataItems,
    pendingClusterVersion,
    rebuildBaselineVersionId,
    rebuildPollKey,
    sessionId,
    verifiedItems,
    setActiveClusterVersionId,
    setCheckingClusters,
    setClusterCompletedPhases,
    setClusterJobMode,
    setClusterProgressMessage,
    setClusterProgressPhase,
    setClusterVersions,
    setDisplayedClusterVersion,
    setDisplayedClusterVersionId,
    setGroups,
    setLoading,
    setPendingClusterVersion,
    setPendingFeedbackCount,
    setPendingFeedbackRefreshKey,
    setRebuildBaselineVersionId,
    setStatus,
  })

  const {
    handleActivateDisplayedClusterVersion,
    handleApplyPendingClusterVersion,
    handleFinish,
    handlePreviewResizePointerDown,
    handleRebuildClusters,
    handleRestorePreviousClusterVersion,
    handleSelectDossierMetadata,
    handleSelectPreviewDocument,
    handleViewClusterVersion,
  } = useFinalResultVersionActions({
    activeClusterVersionId,
    clusterJobMode,
    displayedClusterVersion,
    displayedClusterVersionId,
    loading,
    metadataItems,
    movingSelectedDocumentsTargetId,
    onFinish,
    pendingClusterVersion,
    pendingFeedbackCount,
    previewLayoutRef,
    promotingSelectedDocuments,
    promotingTemporaryFolder,
    rebuildBaselineVersionId,
    rebuildSubmitting,
    restoringClusterVersion,
    sessionId,
    verifiedItems,
    viewingHistoricalClusterVersion,
    setActiveClusterVersionId,
    setCheckingClusters,
    setClusterCompletedPhases,
    setClusterJobMode,
    setClusterProgressMessage,
    setClusterProgressPhase,
    setDisplayedClusterVersion,
    setDisplayedClusterVersionId,
    setDraggedDocument,
    setDropTargetId,
    setGroups,
    setLoading,
    setLoadingClusterVersionId,
    setPendingClusterVersion,
    setPendingFeedbackCount,
    setPendingFeedbackRefreshKey,
    setPreviewWidthPercent,
    setRebuildBaselineVersionId,
    setRebuildPollKey,
    setRebuildSubmitting,
    setRestoringClusterVersion,
    setSelectedMetadataGroupId,
    setSelectedPreviewDocumentId,
    setSelectedSessionDocumentIds,
    setStatus,
  })

  const {
    handleCreateDossierFromSelection,
    handleDropOnDossier,
    handleMoveSelectionToDossier,
    handlePromoteTemporaryFolder,
    handleResultTreeDragOver,
    handleSaveDossierMetadata,
    handleSaveDocumentMetadata,
    handleToggleDocumentSelection,
    handleToggleGroupSelection,
    stopResultTreeAutoScroll,
    toggleNode,
  } = useFinalResultTreeActions({
    draggedDocument,
    groups,
    handleRebuildClusters,
    loading,
    movingSelectedDocumentsTargetId,
    pendingClusterVersion,
    promotingSelectedDocuments,
    promotingTemporaryFolder,
    rebuildBaselineVersionId,
    rebuildSubmitting,
    resultTreeAutoScrollFrameRef,
    resultTreeDragYRef,
    resultTreeScrollRef,
    selectableSessionDocumentIdSet,
    selectedSessionDocumentIds,
    sessionId,
    viewingHistoricalClusterVersion,
    setDraggedDocument,
    setDropTargetId,
    setGroups,
    setMovingSelectedDocumentsTargetId,
    setOpenNodeIds,
    setPendingFeedbackCount,
    setPendingFeedbackRefreshKey,
    setPromotingSelectedDocuments,
    setPromotingTemporaryFolder,
    setSavingDossierMetadataId,
    setSelectedSessionDocumentIds,
    setStatus,
  })

  const handleSelectGroupInformation = useCallback((node: ResultTreeNode) => {
    setSelectedPreviewDocumentId(null)
    setSelectedMetadataGroupId(null)
    setSelectedGroupInfoNodeId((current) =>
      current === node.id ? null : node.id
    )
  }, [])

  const handleCloseGroupInformation = useCallback(() => {
    setSelectedGroupInfoNodeId(null)
    setGroupInformationTable(null)
    setGroupInformationError("")
  }, [])

  const handleSelectPreviewDocumentFromTree = useCallback(
    (document: ClusterDocument) => {
      setSelectedGroupInfoNodeId(null)
      setGroupInformationTable(null)
      setGroupInformationError("")
      handleSelectPreviewDocument(document)
    },
    [handleSelectPreviewDocument]
  )

  const handleCloseDossierSuggestions = useCallback(() => {
    setSelectedDossierSuggestionsDocumentIds([])
    setSelectedDossierSuggestionCandidates(null)
    setDossierSuggestionsLoading(false)
    setDossierSuggestionsRefreshing(false)
    setDossierSuggestionsError("")
  }, [])

  const handleSelectDossierSuggestionsForDocuments = useCallback(
    (documents: ClusterDocument[], forceRefresh = false) => {
      setSelectedGroupInfoNodeId(null)
      setGroupInformationTable(null)
      setGroupInformationError("")
      setSelectedPreviewDocumentId(null)
      setSelectedMetadataGroupId(null)
      setDossierSuggestionsError("")

      const requestDocuments = documents.filter(
        (document) => document.sessionDocumentId !== null
      )
      const sessionDocumentIds = Array.from(
        new Set(
          requestDocuments
            .map((document) => document.sessionDocumentId)
            .filter((id): id is number => id !== null)
        )
      )
      setSelectedDossierSuggestionsDocumentIds(sessionDocumentIds)

      if (sessionDocumentIds.length === 0) {
        setSelectedDossierSuggestionCandidates(null)
        setDossierSuggestionsLoading(false)
        setDossierSuggestionsRefreshing(false)
        setDossierSuggestionsError(
          "Tài liệu được chọn chưa có mã trong session để lấy gợi ý hồ sơ."
        )
        return
      }

      if (
        !forceRefresh &&
        requestDocuments.every(
          (document) =>
            document.dossierSuggestions !== null &&
            document.dossierSuggestions !== undefined
        )
      ) {
        setSelectedDossierSuggestionCandidates(
          aggregateDossierSuggestionsFromDocuments(requestDocuments)
        )
        setDossierSuggestionsLoading(false)
        setDossierSuggestionsRefreshing(false)
        return
      }

      setSelectedDossierSuggestionCandidates(null)
      setDossierSuggestionsLoading(false)
      setDossierSuggestionsRefreshing(false)
      setDossierSuggestionsError("")
    },
    []
  )

  const handleSelectDossierSuggestionsFromTree = useCallback(
    (document: ClusterDocument, forceRefresh = false) => {
      handleSelectDossierSuggestionsForDocuments([document], forceRefresh)
    },
    [handleSelectDossierSuggestionsForDocuments]
  )

  const handleSelectDossierSuggestionsFromSelection = useCallback(() => {
    const documents = previewDocuments.flatMap((entry) =>
      selectedSessionDocumentIds.has(entry.sessionDocumentId)
        ? [entry.document]
        : []
    )
    if (documents.length === 0) {
      toast.error("Chưa chọn tài liệu hợp lệ để lấy gợi ý hồ sơ.")
      return
    }
    handleSelectDossierSuggestionsForDocuments(documents)
  }, [
    handleSelectDossierSuggestionsForDocuments,
    previewDocuments,
    selectedSessionDocumentIds,
  ])

  const handleRefreshDossierSuggestions = useCallback(() => {
    if (selectedDossierSuggestionsDocuments.length === 0) return
    toast.info("Đang tải lại gợi ý hồ sơ...")
    handleSelectDossierSuggestionsForDocuments(
      selectedDossierSuggestionsDocuments,
      true
    )
  }, [
    handleSelectDossierSuggestionsForDocuments,
    selectedDossierSuggestionsDocuments,
  ])

  const handleMoveDossierSuggestion = useCallback(
    async (suggestion: SessionDossierSuggestion) => {
      const targetGroup =
        groups.find(
          (group) =>
            !group.isTemporary &&
            (group.id === suggestion.dossier_id ||
              group.dossierId === suggestion.dossier_id ||
              group.dossierStorageId === suggestion.dossier_id)
        ) ??
        groups.find(
          (group) =>
            !group.isTemporary &&
            (group.clusterId === suggestion.cluster_id ||
              group.id === suggestion.cluster_id)
        )
      if (!targetGroup) {
        toast.error("Không tìm thấy hồ sơ đích trong phiên bản đang xem.")
        return false
      }

      const sessionDocumentIds = selectedDossierSuggestionsDocuments.flatMap(
        (document) =>
          document.sessionDocumentId === null
            ? []
            : [document.sessionDocumentId]
      )
      return handleMoveSelectionToDossier(targetGroup, sessionDocumentIds)
    },
    [groups, handleMoveSelectionToDossier, selectedDossierSuggestionsDocuments]
  )

  const handleCreateDossierFromSuggestions = useCallback(() => {
    const sessionDocumentIds = selectedDossierSuggestionsDocuments.flatMap(
      (document) =>
        document.sessionDocumentId === null ? [] : [document.sessionDocumentId]
    )
    return handleCreateDossierFromSelection(sessionDocumentIds)
  }, [handleCreateDossierFromSelection, selectedDossierSuggestionsDocuments])

  const handleSelectDossierMetadataFromTree = useCallback(
    (group: ClusterGroup) => {
      setSelectedGroupInfoNodeId(null)
      setGroupInformationTable(null)
      setGroupInformationError("")
      handleSelectDossierMetadata(group)
    },
    [handleSelectDossierMetadata]
  )

  const handleSelectGroupInfoDossier = useCallback(
    (dossierId: string) => {
      const group = groups.find(
        (item) => !item.isTemporary && (item.dossierId ?? item.id) === dossierId
      )
      if (!group) return
      setSelectedGroupInfoNodeId(null)
      setGroupInformationTable(null)
      setGroupInformationError("")
      setSelectedPreviewDocumentId(null)
      setSelectedMetadataGroupId(group.id)
    },
    [groups]
  )

  const handleSelectGroupInfoDocument = useCallback(
    (sessionDocumentId: number) => {
      const hasDocument = previewDocuments.some(
        (item) => item.sessionDocumentId === sessionDocumentId
      )
      if (!hasDocument) return
      setSelectedGroupInfoNodeId(null)
      setGroupInformationTable(null)
      setGroupInformationError("")
      setSelectedMetadataGroupId(null)
      setSelectedPreviewDocumentId(sessionDocumentId)
    },
    [previewDocuments]
  )

  const handleSelectRetentionCandidate = useCallback(
    async (
      dossierId: string,
      entryId: string,
      candidateVersionId?: string | null
    ) => {
      if (viewingHistoricalClusterVersion) {
        toast.error(
          "Không thể sửa thời hạn bảo quản khi đang xem phiên bản cũ."
        )
        throw new Error("Cannot edit a historical cluster version")
      }
      if (!sessionId) {
        toast.error("Chưa có session để cập nhật thời hạn bảo quản.")
        throw new Error("Missing session id")
      }
      const response = await patchSessionDossier(sessionId, dossierId, {
        retention_candidate_entry_id: entryId,
        retention_candidate_version_id: candidateVersionId ?? undefined,
      })
      setGroups((previous) =>
        updateDossierGroupFromResponse(previous, dossierId, response)
      )
      setStatus(
        `Đã cập nhật thời hạn bảo quản "${response.retention_period || ""}".`
      )
      toast.success("Đã lưu lựa chọn thời hạn bảo quản.")
      if (selectedGroupInfoNode && selectedGroupInfoDossierIds.length > 0) {
        const table = await getClusterGroupInformationTable(sessionId, {
          cluster_version_id: displayedClusterVersionId,
          dossier_ids: selectedGroupInfoDossierIds,
          group_label: selectedGroupInfoNode.label,
        })
        setGroupInformationTable(table)
      }
    },
    [
      displayedClusterVersionId,
      selectedGroupInfoDossierIds,
      selectedGroupInfoNode,
      sessionId,
      viewingHistoricalClusterVersion,
    ]
  )

  const handleCancelPendingFeedback = useCallback(async () => {
    if (viewingHistoricalClusterVersion) {
      toast.error(
        "Bạn đang xem phiên bản cũ. Hãy quay về phiên bản đang dùng trước khi hủy feedback."
      )
      return
    }
    if (!sessionId) {
      toast.error("Chưa có session để hủy feedback.")
      return
    }
    if (pendingFeedbackCount <= 0) {
      toast.info("Không có feedback đang chờ cập nhật.")
      return
    }
    if (
      loading ||
      checkingClusters ||
      rebuildSubmitting ||
      restoringClusterVersion ||
      Boolean(rebuildBaselineVersionId) ||
      Boolean(pendingClusterVersion)
    ) {
      toast.error("Đang cập nhật hồ sơ. Vui lòng chờ xong rồi hủy feedback.")
      return
    }

    setCancelingPendingFeedback(true)
    try {
      const response = await cancelPendingClusterFeedback(sessionId)
      if (displayedClusterVersion) {
        setGroups(versionToGroups(displayedClusterVersion, metadataItems))
      } else {
        setGroups((previous) => clearPendingFeedbackMarkers(previous))
      }
      setSelectedSessionDocumentIds(new Set())
      setPendingFeedbackCount(0)
      setPendingFeedbackRefreshKey((key) => key + 1)
      const cancelledCount = response.cancelled_feedback_count ?? 0
      setStatus(
        cancelledCount > 0
          ? `Đã hủy ${cancelledCount} feedback đang chờ cập nhật hồ sơ.`
          : "Không có feedback đang chờ cập nhật để hủy."
      )
      if (cancelledCount > 0) {
        toast.success("Đã hủy các thay đổi feedback đang chờ cập nhật.")
      } else {
        toast.info("Không có feedback đang chờ cập nhật để hủy.")
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Không thể hủy feedback đang chờ cập nhật."
      )
    } finally {
      setCancelingPendingFeedback(false)
    }
  }, [
    checkingClusters,
    displayedClusterVersion,
    loading,
    metadataItems,
    pendingClusterVersion,
    pendingFeedbackCount,
    rebuildBaselineVersionId,
    rebuildSubmitting,
    restoringClusterVersion,
    sessionId,
    viewingHistoricalClusterVersion,
  ])

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
  const handleResultTreeSearchNavigate = useCallback(
    (direction: number) => {
      setResultTreeSearchIndex((current) => {
        const total = resultTreeSearchMatches.length
        if (total === 0) return 0
        return (current + direction + total) % total
      })
    },
    [resultTreeSearchMatches.length]
  )
  return (
    <FinalResultView
      activeClusterVersionId={activeClusterVersionId}
      canRestoreFileRegisterVersion={canRestoreFileRegisterVersion}
      cancelingPendingFeedback={cancelingPendingFeedback}
      checkingClusters={checkingClusters}
      clusterCompletedPhases={clusterCompletedPhases}
      clusterJobMode={clusterJobMode}
      clusterProgressMessage={clusterProgressMessage}
      clusterProgressPhase={clusterProgressPhase}
      clusterVersionNavigationBusy={clusterVersionNavigationBusy}
      displayedClusterVersion={displayedClusterVersion}
      displayedClusterVersionId={displayedClusterVersionId}
      draggedDocument={draggedDocument}
      dropTargetId={dropTargetId}
      handleActivateDisplayedClusterVersion={
        handleActivateDisplayedClusterVersion
      }
      handleApplyPendingClusterVersion={handleApplyPendingClusterVersion}
      handleCancelPendingFeedback={handleCancelPendingFeedback}
      handleCreateDossierFromSelection={handleCreateDossierFromSelection}
      handleCreateDossierFromSuggestions={handleCreateDossierFromSuggestions}
      handleDropOnDossier={handleDropOnDossier}
      handleFinish={handleFinish}
      handleMoveSelectionToDossier={handleMoveSelectionToDossier}
      handlePreviewResizePointerDown={handlePreviewResizePointerDown}
      handlePromoteTemporaryFolder={handlePromoteTemporaryFolder}
      handleRebuildClusters={handleRebuildClusters}
      handleRestorePreviousClusterVersion={handleRestorePreviousClusterVersion}
      handleResultTreeDragOver={handleResultTreeDragOver}
      handleSaveDossierMetadata={handleSaveDossierMetadata}
      handleSaveDocumentMetadata={handleSaveDocumentMetadata}
      handleSelectDossierMetadata={handleSelectDossierMetadataFromTree}
      handleSelectDossierSuggestions={handleSelectDossierSuggestionsFromTree}
      handleSelectDossierSuggestionsFromSelection={
        handleSelectDossierSuggestionsFromSelection
      }
      handleRefreshDossierSuggestions={handleRefreshDossierSuggestions}
      handleMoveDossierSuggestion={handleMoveDossierSuggestion}
      handleSelectGroupInformation={handleSelectGroupInformation}
      handleSelectRetentionCandidate={handleSelectRetentionCandidate}
      handleSelectPreviewDocument={handleSelectPreviewDocumentFromTree}
      handleToggleDocumentSelection={handleToggleDocumentSelection}
      handleToggleGroupSelection={handleToggleGroupSelection}
      handleViewClusterVersion={handleViewClusterVersion}
      groupInformationError={groupInformationError}
      groupInformationLoading={groupInformationLoading}
      groupInformationTable={groupInformationTable}
      handleCloseGroupInformation={handleCloseGroupInformation}
      handleSelectGroupInfoDossier={handleSelectGroupInfoDossier}
      handleSelectGroupInfoDocument={handleSelectGroupInfoDocument}
      handleCloseDossierSuggestions={handleCloseDossierSuggestions}
      loading={loading}
      loadingClusterVersionId={loadingClusterVersionId}
      movingSelectedDocumentsTargetId={movingSelectedDocumentsTargetId}
      nextDisplayVersion={nextDisplayVersion}
      openNodeIds={openNodeIds}
      pendingClusterDocumentCount={pendingClusterDocumentCount}
      pendingClusterVersion={pendingClusterVersion}
      pendingDossierCount={pendingDossierCount}
      pendingFeedbackCount={pendingFeedbackCount}
      previewDocument={previewDocument}
      selectedDossierSuggestionsDocuments={selectedDossierSuggestionsDocuments}
      selectedDossierSuggestionCandidates={selectedDossierSuggestionCandidates}
      dossierSuggestionRepresentativeDocuments={
        dossierSuggestionRepresentativeDocuments
      }
      dossierSuggestionDossiers={groups}
      selectedDossierSuggestionsDocumentId={
        selectedDossierSuggestionsDocumentId
      }
      dossierSuggestionsLoading={dossierSuggestionsLoading}
      dossierSuggestionsRefreshing={dossierSuggestionsRefreshing}
      dossierSuggestionsError={dossierSuggestionsError}
      previewLayoutRef={previewLayoutRef}
      previewWidthPercent={previewWidthPercent}
      previousDisplayVersion={previousDisplayVersion}
      promotingSelectedDocuments={promotingSelectedDocuments}
      promotingTemporaryFolder={promotingTemporaryFolder}
      rebuildBaselineVersionId={rebuildBaselineVersionId}
      rebuildSubmitting={rebuildSubmitting}
      resultStatusText={resultStatusText}
      resultTreeSearch={resultTreeSearch}
      resultTreeSearchIndex={resultTreeSearchIndex}
      resultTreeSearchTotal={resultTreeSearchMatches.length}
      resultTreeScrollRef={resultTreeScrollRef}
      restoringClusterVersion={restoringClusterVersion}
      savingDossierMetadataId={savingDossierMetadataId}
      selectedDocumentCount={selectedDocumentCount}
      selectedDocumentsActionDisabled={selectedDocumentsActionDisabled}
      selectedGroupInfoNode={selectedGroupInfoNode}
      selectedGroupInfoNodeId={selectedGroupInfoNodeId}
      selectedMetadataGroup={selectedMetadataGroup}
      selectedMetadataGroupId={selectedMetadataGroupId}
      selectedPreviewDocumentId={selectedPreviewDocumentId}
      selectedSessionDocumentIds={selectedSessionDocumentIds}
      sessionId={sessionId}
      setDraggedDocument={setDraggedDocument}
      setDropTargetId={setDropTargetId}
      setResultTreeSearch={setResultTreeSearch}
      setSelectedMetadataGroupId={setSelectedMetadataGroupId}
      setSelectedPreviewDocumentId={setSelectedPreviewDocumentId}
      showClusterProgress={showClusterProgress}
      sidePreviewOpen={sidePreviewOpen}
      sortedClusterVersions={sortedClusterVersions}
      stopResultTreeAutoScroll={stopResultTreeAutoScroll}
      temporaryFolderUpdateDisabled={temporaryFolderUpdateDisabled}
      totalDossiers={totalDossiers}
      totalFiles={totalFiles}
      totalPages={totalPages}
      tree={tree}
      toggleNode={toggleNode}
      updatingClusterVersion={updatingClusterVersion}
      viewingHistoricalClusterVersion={viewingHistoricalClusterVersion}
      activeResultTreeSearchNodeId={activeResultTreeSearchMatch?.nodeId ?? null}
      onResultTreeSearchNavigate={handleResultTreeSearchNavigate}
    />
  )
}

function aggregateDossierSuggestionsFromDocuments(
  documents: ClusterDocument[]
): SessionDossierSuggestion[] {
  return aggregateDossierSuggestions(
    documents.flatMap((document) =>
      (document.dossierSuggestions ?? []).map((suggestion) => ({
        documentId: document.documentId,
        sessionDocumentId: document.sessionDocumentId ?? 0,
        suggestion,
      }))
    )
  )
}

function aggregateDossierSuggestions(
  items: Array<{
    documentId: string
    sessionDocumentId: number
    suggestion: SessionDossierSuggestion
  }>
): SessionDossierSuggestion[] {
  const buckets = new Map<
    string,
    {
      suggestion: SessionDossierSuggestion
      similaritySum: number
      matchedDocumentIds: string[]
      matchedSessionDocumentIds: number[]
      seenSessionDocumentIds: Set<number>
    }
  >()

  for (const { documentId, sessionDocumentId, suggestion } of items) {
    const key = dossierSuggestionKey(suggestion)
    if (!key) continue
    const similarity = Number(
      suggestion.average_similarity ?? suggestion.best_other_similarity ?? 0
    )
    const bucket = buckets.get(key) ?? {
      suggestion: {
        ...suggestion,
        representative_document_ids: [],
        representative_documents: [],
      },
      similaritySum: 0,
      matchedDocumentIds: [],
      matchedSessionDocumentIds: [],
      seenSessionDocumentIds: new Set<number>(),
    }
    if (bucket.seenSessionDocumentIds.has(sessionDocumentId)) continue
    bucket.seenSessionDocumentIds.add(sessionDocumentId)
    bucket.similaritySum += Number.isFinite(similarity) ? similarity : 0
    bucket.matchedDocumentIds.push(documentId)
    bucket.matchedSessionDocumentIds.push(sessionDocumentId)
    bucket.suggestion.representative_document_ids = uniqueStrings([
      ...bucket.suggestion.representative_document_ids,
      ...suggestion.representative_document_ids,
    ])
    bucket.suggestion.representative_documents = uniqueRepresentatives([
      ...bucket.suggestion.representative_documents,
      ...suggestion.representative_documents,
    ])
    buckets.set(key, bucket)
  }

  return Array.from(buckets.values())
    .map(
      ({
        suggestion,
        similaritySum,
        matchedDocumentIds,
        matchedSessionDocumentIds,
      }) => {
        const matchingDocumentCount = matchedSessionDocumentIds.length
        const averageSimilarity =
          matchingDocumentCount > 0 ? similaritySum / matchingDocumentCount : 0
        return {
          ...suggestion,
          rank: 0,
          best_other_similarity: Number(averageSimilarity.toFixed(4)),
          average_similarity: Number(averageSimilarity.toFixed(4)),
          matching_document_count: matchingDocumentCount,
          matched_document_ids: matchedDocumentIds,
          matched_session_document_ids: matchedSessionDocumentIds,
        }
      }
    )
    .sort(
      (left, right) =>
        (right.matching_document_count ?? 0) -
          (left.matching_document_count ?? 0) ||
        (right.average_similarity ?? right.best_other_similarity ?? 0) -
          (left.average_similarity ?? left.best_other_similarity ?? 0) ||
        (left.title || left.dossier_id).localeCompare(
          right.title || right.dossier_id
        )
    )
    .slice(0, DOSSIER_SUGGESTION_TOP_K)
    .map((suggestion, index) => ({ ...suggestion, rank: index + 1 }))
}

function dossierSuggestionKey(suggestion: SessionDossierSuggestion): string {
  return (
    suggestion.cluster_id ||
    suggestion.dossier_id ||
    String(suggestion.session_dossier_id || "")
  )
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function uniqueRepresentatives(
  values: SessionDossierSuggestion["representative_documents"]
): SessionDossierSuggestion["representative_documents"] {
  const seen = new Set<string>()
  return values.filter((representative) => {
    const key = `${representative.session_document_id}:${representative.document_id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function scrollResultTreeNodeIntoView(
  container: HTMLDivElement | null,
  nodeId: string
) {
  if (!container) return
  const nodes = container.querySelectorAll<HTMLElement>("[data-result-node-id]")
  for (const node of nodes) {
    if (node.dataset.resultNodeId !== nodeId) continue
    node.scrollIntoView({ block: "center", behavior: "smooth" })
    return
  }
}
