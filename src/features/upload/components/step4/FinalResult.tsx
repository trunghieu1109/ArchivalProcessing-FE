import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { DocumentPreviewTarget } from "@/features/upload/components/DocumentPdfPreview"
import {
  getClusterGroupInformationTable,
  patchSessionDossier,
  type ClusterGroupInformationTableResponse,
  type ClusterVersionResponse,
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
  const sidePreviewOpen = Boolean(
    previewDocument || selectedMetadataGroup || selectedGroupInfoNode
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
    if (!selectedGroupInfoNode) {
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
    if (selectedGroupInfoDossierIds.length === 0) {
      setGroupInformationTable(null)
      setGroupInformationLoading(false)
      setGroupInformationError("")
      return () => {
        cancelled = true
      }
    }

    setGroupInformationLoading(true)
    setGroupInformationError("")
    getClusterGroupInformationTable(sessionId, {
      cluster_version_id: displayedClusterVersionId,
      dossier_ids: selectedGroupInfoDossierIds,
      group_label: selectedGroupInfoNode.label,
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
    selectedGroupInfoNode,
    selectedGroupInfoDossierIds,
    sessionId,
  ])

  useEffect(() => {
    setSelectedGroupInfoNodeId(null)
    setGroupInformationTable(null)
    setGroupInformationError("")
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
    async (dossierId: string, entryId: string) => {
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
      handleCreateDossierFromSelection={handleCreateDossierFromSelection}
      handleDropOnDossier={handleDropOnDossier}
      handleFinish={handleFinish}
      handleMoveSelectionToDossier={handleMoveSelectionToDossier}
      handlePreviewResizePointerDown={handlePreviewResizePointerDown}
      handlePromoteTemporaryFolder={handlePromoteTemporaryFolder}
      handleRebuildClusters={handleRebuildClusters}
      handleRestorePreviousClusterVersion={handleRestorePreviousClusterVersion}
      handleResultTreeDragOver={handleResultTreeDragOver}
      handleSaveDossierMetadata={handleSaveDossierMetadata}
      handleSelectDossierMetadata={handleSelectDossierMetadataFromTree}
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
