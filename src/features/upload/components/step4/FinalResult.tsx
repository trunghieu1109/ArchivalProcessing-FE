import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"
import type { DocumentPreviewTarget } from "@/features/upload/components/DocumentPdfPreview"
import {
  cancelPendingClusterFeedback,
  explainDocumentDossierMembership,
  getClusterVersion,
  getClusterGroupInformationTable,
  getClusterVersionChanges,
  getClusteringPendingDocuments,
  listSupplementalIntakes,
  listClusterFeedback,
  patchSessionDossier,
  suggestSelectedDocumentDossiers,
  sortDossierDocuments,
  sortLeafDossiers,
  type ArrangementDossierKind,
  type ClusterGroupInformationTableResponse,
  type ClusterVersionChangesResponse,
  type ClusterVersionResponse,
  type DossierMembershipExplanationResponse,
  type DocumentDeletionOperationResponse,
  type DocumentTransferRequestResponse,
  type SessionDossierSuggestion,
  type SupplementalIntakeResponse,
  type ClusteringPendingDocumentsResponse,
} from "@/features/upload/api/sessionApi"
import { useAuth } from "@/features/auth/lib/AuthContext"
import { toast } from "sonner"
import {
  ensureTemporaryFolderGroup,
  versionToGroups,
  type ClusterDocument,
  type ClusterGroup,
} from "@/features/upload/lib/clusterGroups"
import { FinalResultView } from "./FinalResult.view"
import {
  DocumentDeletionDialog,
  type DocumentDeletionTarget,
} from "../DocumentDeletionDialog"
import {
  SHOW_DOCUMENT_DELETION,
  SHOW_DOCUMENT_DELETION_IN_DOSSIER_STEP,
  SHOW_DOCUMENT_TRANSFER,
} from "./temporaryFeatureVisibility"
import {
  DocumentTransferDialog,
  type DocumentTransferTarget,
} from "../DocumentTransferDialog"
import { useFinalResultPolling } from "./useFinalResultPolling"
import { useFinalResultVersionActions } from "./useFinalResultVersionActions"
import { useFinalResultTreeActions } from "./useFinalResultTreeActions"
import { useNumberingInProgressWarning } from "./useNumberingInProgressWarning"
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
  stableFinalResultMetadataItems,
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
import { buildClusterChangeHighlights } from "./FinalResult.changes"
import {
  isDocumentTransferLocked,
  transferSelectionError,
} from "./FinalResult.transferState"
import { applySupplementalIntakeOverlay } from "./FinalResult.supplementalOverlay"
import { resolveFinalResultActionState } from "./FinalResult.actionState"

const DOSSIER_SUGGESTION_TOP_K = 5
const SUPPLEMENTAL_VERIFICATION_PENDING_STATUSES = new Set([
  "prepared",
  "waiting_for_files",
  "uploading",
  "syncing_documents",
  "ocr_processing",
  "waiting_for_review",
  "partially_verified",
])

export function FinalResult({
  sessionId,
  groups: initialGroups,
  fondsName,
  activePlanVersionId = null,
  classificationTree = [],
  metadataItems: providedMetadataItems,
  onFinish,
}: FinalResultProps) {
  const { user } = useAuth()
  const metadataItems = stableFinalResultMetadataItems(providedMetadataItems)
  const numberingInProgress = useNumberingInProgressWarning(sessionId)
  const initialDossierCount = regularDossierCount(initialGroups)
  const [groups, setGroups] = useState<ClusterGroup[]>(() =>
    ensureTemporaryFolderGroup(initialGroups)
  )
  const [supplementalIntakes, setSupplementalIntakes] = useState<
    SupplementalIntakeResponse[]
  >([])
  const [supplementalRefreshKey, setSupplementalRefreshKey] = useState(0)
  const [clusteringPending, setClusteringPending] =
    useState<ClusteringPendingDocumentsResponse | null>(null)
  const [sortingScope, setSortingScope] = useState<string | null>(null)
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
  const [clusterVersionChanges, setClusterVersionChanges] =
    useState<ClusterVersionChangesResponse | null>(null)
  const [clusterVersionChangesLoading, setClusterVersionChangesLoading] =
    useState(false)
  const [clusterVersionChangesError, setClusterVersionChangesError] =
    useState("")
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
  const [deletionTargets, setDeletionTargets] = useState<
    DocumentDeletionTarget[]
  >([])
  const [transferTargets, setTransferTargets] = useState<
    DocumentTransferTarget[]
  >([])
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
  const [membershipExplanationDocument, setMembershipExplanationDocument] =
    useState<ClusterDocument | null>(null)
  const [membershipExplanation, setMembershipExplanation] =
    useState<DossierMembershipExplanationResponse | null>(null)
  const [membershipExplanationLoading, setMembershipExplanationLoading] =
    useState(false)
  const [membershipExplanationError, setMembershipExplanationError] =
    useState("")
  const [selectedMetadataGroupId, setSelectedMetadataGroupId] = useState<
    string | null
  >(null)
  const [manualClassificationGroup, setManualClassificationGroup] =
    useState<ClusterGroup | null>(null)
  const [selectedGroupInfoNodeId, setSelectedGroupInfoNodeId] = useState<
    string | null
  >(null)
  const [groupInformationTable, setGroupInformationTable] =
    useState<ClusterGroupInformationTableResponse | null>(null)
  const [groupInformationLoading, setGroupInformationLoading] = useState(false)
  const [groupInformationError, setGroupInformationError] = useState("")
  const [previewWidthPercent, setPreviewWidthPercent] = useState(50)
  const [
    manualClassificationWidthPercent,
    setManualClassificationWidthPercent,
  ] = useState(30)
  const previewLayoutRef = useRef<HTMLDivElement | null>(null)
  const resultTreeScrollRef = useRef<HTMLDivElement | null>(null)
  const resultTreeDragYRef = useRef<number | null>(null)
  const resultTreeAutoScrollFrameRef = useRef<number | null>(null)
  const displayedClusterVersionRef = useRef<ClusterVersionResponse | null>(null)
  const metadataItemsRef = useRef(metadataItems)
  const lastFeedbackRequestKeyRef = useRef("")
  const feedbackHydrationRevisionRef = useRef(0)
  const dossierSuggestionsRequestRef = useRef(0)
  const membershipExplanationRequestIdRef = useRef(0)
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
  const visibleClusterVersionChanges =
    displayedClusterVersionId &&
    displayedClusterVersionId === activeClusterVersionId &&
    clusterVersionChanges?.to.cluster_version_id === displayedClusterVersionId
      ? clusterVersionChanges
      : null
  const changeHighlights = useMemo(
    () => buildClusterChangeHighlights(visibleClusterVersionChanges),
    [visibleClusterVersionChanges]
  )
  const displayGroups = useMemo(
    () =>
      applySupplementalIntakeOverlay(
        groups,
        supplementalIntakes,
        metadataItems
      ),
    [groups, metadataItems, supplementalIntakes]
  )
  const supplementalVerificationPendingCount = useMemo(
    () =>
      supplementalIntakes.filter((intake) =>
        SUPPLEMENTAL_VERIFICATION_PENDING_STATUSES.has(intake.status)
      ).length,
    [supplementalIntakes]
  )
  const tree = useMemo(
    () => buildResultTree(displayGroups, fondsName, changeHighlights),
    [changeHighlights, displayGroups, fondsName]
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
  const totalDossiers = regularDossierCount(displayGroups)
  const hasClusterData = displayGroups.some(
    (group) => !group.isTemporary || group.documents.length > 0
  )
  const totalFiles = displayGroups.reduce(
    (sum, group) => sum + group.documents.length,
    0
  )
  const totalPages = displayGroups.reduce(
    (sum, group) => sum + dossierPageCount(group),
    0
  )
  const previewDocuments = useMemo<PreviewDocumentEntry[]>(
    () =>
      displayGroups.flatMap((group) =>
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
    [displayGroups]
  )
  const selectableSessionDocumentIdSet = useMemo(
    () =>
      new Set(
        previewDocuments
          .filter(
            (entry) =>
              (!entry.document.lifecycleStatus ||
                entry.document.lifecycleStatus === "active") &&
              !isDocumentTransferLocked(entry.document) &&
              entry.document.editLock?.locked !== true
          )
          .map((entry) => entry.sessionDocumentId)
      ),
    [previewDocuments]
  )
  const selectedDocumentCount = selectedSessionDocumentIds.size
  const selectedHasActiveEditLock = previewDocuments.some(
    (entry) =>
      selectedSessionDocumentIds.has(entry.sessionDocumentId) &&
      entry.document.editLock?.locked === true
  )
  const userRole = String(user?.role ?? "")
    .trim()
    .toLowerCase()
  const canManageDocuments = userRole === "admin" || userRole === "coordinator"
  const canDeleteDocuments =
    SHOW_DOCUMENT_DELETION &&
    SHOW_DOCUMENT_DELETION_IN_DOSSIER_STEP &&
    canManageDocuments
  const canTransferDocuments = SHOW_DOCUMENT_TRANSFER && canManageDocuments
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
        ? (displayGroups.find(
            (group) =>
              !group.isTemporary && group.id === selectedMetadataGroupId
          ) ?? null)
        : null,
    [displayGroups, selectedMetadataGroupId]
  )
  const selectedDossierSuggestionsDocuments = useMemo(() => {
    if (selectedDossierSuggestionsDocumentIds.length === 0) return []
    const documentsBySessionId = new Map(
      displayGroups
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
  }, [displayGroups, selectedDossierSuggestionsDocumentIds])
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
    manualClassificationGroup ||
    membershipExplanationDocument ||
    previewDocument ||
    selectedMetadataGroup ||
    selectedGroupInfoNode
  )
  const pendingClusterGroups = useMemo(
    () => versionToGroups(pendingClusterVersion, metadataItems),
    [metadataItems, pendingClusterVersion]
  )
  const pendingClusterVersionId = pendingClusterVersion?.id ?? null
  const supplementalPendingUpdateDocumentCount = useMemo(() => {
    const pendingDocuments = clusteringPending?.documents ?? []
    if (!pendingClusterVersion) return pendingDocuments.length
    const workingDocumentIds = new Set(
      pendingClusterGroups.flatMap((group) =>
        group.documents.map((document) => String(document.sessionDocumentId))
      )
    )
    return pendingDocuments.filter(
      (document) =>
        !workingDocumentIds.has(String(document.session_document_id))
    ).length
  }, [
    clusteringPending?.documents,
    pendingClusterGroups,
    pendingClusterVersion,
  ])
  const pendingClusterVersionNeedsRefresh = Boolean(
    pendingClusterVersion?.status === "draft" &&
    (pendingClusterVersion.is_stale ||
      supplementalPendingUpdateDocumentCount > 0 ||
      (pendingClusterVersion.source_document_set_revision != null &&
        pendingClusterVersion.current_document_set_revision != null &&
        pendingClusterVersion.source_document_set_revision !==
          pendingClusterVersion.current_document_set_revision))
  )
  const workingClusterVersionId =
    pendingClusterVersionId ?? activeClusterVersionId
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
  const activeClusterVersion =
    clusterVersions.find((version) => version.id === activeClusterVersionId) ??
    (displayedClusterVersion?.id === activeClusterVersionId
      ? displayedClusterVersion
      : null)
  const hasUsableActiveClusterVersion = Boolean(
    activeClusterVersion &&
    !pendingClusterVersion &&
    !activeClusterVersion.is_stale &&
    (activeClusterVersion.source_document_set_revision == null ||
      activeClusterVersion.current_document_set_revision == null ||
      activeClusterVersion.source_document_set_revision ===
        activeClusterVersion.current_document_set_revision)
  )
  const sourceHasActiveClusterVersion = Boolean(
    activeClusterVersionId ||
    clusterVersions.some((version) => version.status === "active")
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
    workingClusterVersionId &&
    displayedClusterVersionId !== workingClusterVersionId
  )

  useEffect(() => {
    displayedClusterVersionRef.current = displayedClusterVersion
    metadataItemsRef.current = metadataItems
  }, [displayedClusterVersion, metadataItems])

  useEffect(() => {
    if (!sessionId) {
      const resetId = window.setTimeout(() => {
        setSupplementalIntakes([])
        setClusteringPending(null)
      }, 0)
      return () => window.clearTimeout(resetId)
    }
    let cancelled = false
    let running = false
    const refresh = async () => {
      if (running) return
      running = true
      const [intakesResult, pendingResult] = await Promise.allSettled([
        listSupplementalIntakes(sessionId, {
          status: "active",
          includeDocuments: true,
        }),
        getClusteringPendingDocuments(sessionId),
      ])
      if (!cancelled && intakesResult.status === "fulfilled") {
        setSupplementalIntakes(intakesResult.value.items)
      }
      if (!cancelled && pendingResult.status === "fulfilled") {
        setClusteringPending(pendingResult.value)
      }
      if (intakesResult.status === "rejected") {
        // The result screen remains usable when the optional intake endpoint
        // is temporarily unavailable during a rolling deployment.
      }
      if (pendingResult.status === "rejected") {
        // Older backends may not expose the supplemental pending query yet.
      }
      running = false
    }
    void refresh()
    const intervalId = window.setInterval(refresh, 2_000)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [sessionId, supplementalRefreshKey])

  useEffect(() => {
    let cancelled = false
    let requestTimeoutId: number | null = null
    const previousVersionId =
      displayedClusterVersion?.previous_version_id ?? null
    const showingActiveVersion = Boolean(
      sessionId &&
      displayedClusterVersionId &&
      displayedClusterVersionId === activeClusterVersionId
    )

    requestTimeoutId = window.setTimeout(() => {
      if (cancelled) return
      if (!showingActiveVersion || !previousVersionId) {
        setClusterVersionChanges(null)
        setClusterVersionChangesLoading(false)
        setClusterVersionChangesError("")
        return
      }

      setClusterVersionChanges(null)
      setClusterVersionChangesLoading(true)
      setClusterVersionChangesError("")
      getClusterVersionChanges(
        sessionId!,
        displayedClusterVersionId!,
        previousVersionId
      )
        .then((response) => {
          if (!cancelled) {
            setClusterVersionChanges(response)
          }
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setClusterVersionChangesError(
              error instanceof Error
                ? error.message
                : "Kh\u00f4ng th\u1ec3 t\u1ea3i thay \u0111\u1ed5i c\u1ee7a phi\u00ean b\u1ea3n."
            )
          }
        })
        .finally(() => {
          if (!cancelled) {
            setClusterVersionChangesLoading(false)
          }
        })
    }, 0)

    return () => {
      cancelled = true
      if (requestTimeoutId !== null) {
        window.clearTimeout(requestTimeoutId)
      }
    }
  }, [
    activeClusterVersionId,
    displayedClusterVersion?.previous_version_id,
    displayedClusterVersionId,
    sessionId,
  ])

  useEffect(() => {
    if (metadataItems.length === 0) return

    const locksBySessionDocumentId = new Map(
      metadataItems.map((item) => [item.id, item.edit_lock ?? null] as const)
    )
    const timeoutId = window.setTimeout(() => {
      setGroups((previous) =>
        previous.map((group) => ({
          ...group,
          documents: group.documents.map((document) =>
            document.sessionDocumentId !== null &&
            locksBySessionDocumentId.has(document.sessionDocumentId)
              ? {
                  ...document,
                  editLock:
                    locksBySessionDocumentId.get(document.sessionDocumentId) ??
                    null,
                }
              : document
          ),
        }))
      )
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [metadataItems])

  useEffect(() => {
    let cancelled = false
    const hydrationRevision = feedbackHydrationRevisionRef.current
    const currentDisplayedClusterVersion = displayedClusterVersionRef.current
    const displayingWorkingVersion = Boolean(
      sessionId &&
      currentDisplayedClusterVersion &&
      displayedClusterVersionId &&
      workingClusterVersionId &&
      displayedClusterVersionId === workingClusterVersionId
    )
    if (rebuildSubmitting || rebuildBaselineVersionId || loading) {
      return () => {
        cancelled = true
      }
    }
    if (!displayingWorkingVersion) {
      const timeoutId = window.setTimeout(() => {
        if (
          cancelled ||
          hydrationRevision !== feedbackHydrationRevisionRef.current
        ) {
          return
        }
        if (!displayingWorkingVersion) {
          setPendingFeedbackCount(0)
        }
        if (displayingWorkingVersion && currentDisplayedClusterVersion) {
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
      workingClusterVersionId,
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
        if (
          cancelled ||
          hydrationRevision !== feedbackHydrationRevisionRef.current
        ) {
          return
        }
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
        if (
          !cancelled &&
          hydrationRevision === feedbackHydrationRevisionRef.current
        ) {
          setPendingFeedbackCount(0)
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    displayedClusterVersionId,
    loading,
    pendingFeedbackRefreshKey,
    rebuildBaselineVersionId,
    rebuildSubmitting,
    sessionId,
    workingClusterVersionId,
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
    dossierSuggestionsRequestRef.current += 1
    setSelectedDossierSuggestionsDocumentIds([])
    setSelectedDossierSuggestionCandidates(null)
    setDossierSuggestionsLoading(false)
    setDossierSuggestionsRefreshing(false)
    setDossierSuggestionsError("")
    membershipExplanationRequestIdRef.current += 1
    setMembershipExplanationDocument(null)
    setMembershipExplanation(null)
    setMembershipExplanationLoading(false)
    setMembershipExplanationError("")
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

  const clusterVersionStale = Boolean(displayedClusterVersion?.is_stale)
  const clusterActionState = resolveFinalResultActionState({
    hasPendingClusterVersion: Boolean(pendingClusterVersion),
    pendingClusterVersionStatus: pendingClusterVersion?.status ?? null,
    pendingClusterVersionNeedsRefresh,
    pendingFeedbackCount,
    supplementalVerificationPendingCount,
    supplementalPendingDocumentCount: clusteringPending?.count ?? 0,
    supplementalPendingUpdateDocumentCount,
    clusterVersionStale,
    busy: Boolean(
      loading ||
      checkingClusters ||
      rebuildSubmitting ||
      restoringClusterVersion ||
      promotingTemporaryFolder ||
      promotingSelectedDocuments ||
      movingSelectedDocumentsTargetId ||
      rebuildBaselineVersionId ||
      clusteringPending?.blocked_reasons.includes("cluster_build_in_progress")
    ),
    viewingHistoricalClusterVersion,
    hasSession: Boolean(sessionId),
    totalFiles,
    totalDossiers,
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
    clusterActionState,
    clusterVersionStale,
    displayedClusterVersion,
    displayedClusterVersionId,
    hasUsableActiveClusterVersion,
    loading,
    metadataItems,
    movingSelectedDocumentsTargetId,
    onFinish,
    pendingClusterVersion,
    pendingClusterVersionNeedsRefresh,
    pendingFeedbackCount,
    supplementalPendingDocumentCount: clusteringPending?.count ?? 0,
    supplementalPendingUpdateDocumentCount,
    supplementalVerificationPendingCount,
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
    handleApplyManualDossierClassification,
    handleRefreshDossierClassification,
    handleSaveDossierMetadata,
    handleSaveDocumentMetadata,
    handleToggleDocumentSelection,
    handleToggleGroupSelection,
    stopResultTreeAutoScroll,
    toggleNode,
    refreshingClassificationDossierId,
    manuallyClassifyingDossierId,
  } = useFinalResultTreeActions({
    draggedDocument,
    feedbackHydrationRevisionRef,
    groups,
    handleRebuildClusters,
    loading,
    movingSelectedDocumentsTargetId,
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
    setDisplayedClusterVersion,
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

  const handleCloseMembershipExplanation = useCallback(() => {
    membershipExplanationRequestIdRef.current += 1
    setMembershipExplanationDocument(null)
    setMembershipExplanation(null)
    setMembershipExplanationLoading(false)
    setMembershipExplanationError("")
  }, [])

  const handleSelectGroupInformation = useCallback(
    (node: ResultTreeNode) => {
      handleCloseMembershipExplanation()
      setManualClassificationGroup(null)
      setSelectedPreviewDocumentId(null)
      setSelectedMetadataGroupId(null)
      setSelectedGroupInfoNodeId((current) =>
        current === node.id ? null : node.id
      )
    },
    [handleCloseMembershipExplanation]
  )

  const handleOpenManualClassification = useCallback(
    (group: ClusterGroup) => {
      if (!activePlanVersionId || classificationTree.length === 0) {
        toast.error("Phương án đang active chưa có cây phân loại để lựa chọn.")
        return
      }
      setSelectedPreviewDocumentId(null)
      setSelectedMetadataGroupId(null)
      setSelectedGroupInfoNodeId(null)
      setGroupInformationTable(null)
      setGroupInformationError("")
      handleCloseMembershipExplanation()
      setManualClassificationGroup(group)
    },
    [
      activePlanVersionId,
      classificationTree.length,
      handleCloseMembershipExplanation,
    ]
  )

  const handleCloseManualClassification = useCallback(() => {
    setManualClassificationGroup(null)
  }, [])

  const handleManualClassificationResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const container = previewLayoutRef.current
      if (!container) return
      event.preventDefault()

      const previousCursor = document.body.style.cursor
      const previousUserSelect = document.body.style.userSelect
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"

      const updatePanelWidth = (clientX: number) => {
        const rect = container.getBoundingClientRect()
        const rawPercent = ((rect.right - clientX) / rect.width) * 100
        setManualClassificationWidthPercent(
          Math.min(50, Math.max(25, rawPercent))
        )
      }

      const handlePointerMove = (moveEvent: PointerEvent) => {
        updatePanelWidth(moveEvent.clientX)
      }
      const handlePointerUp = () => {
        document.body.style.cursor = previousCursor
        document.body.style.userSelect = previousUserSelect
        window.removeEventListener("pointermove", handlePointerMove)
        window.removeEventListener("pointerup", handlePointerUp)
      }

      updatePanelWidth(event.clientX)
      window.addEventListener("pointermove", handlePointerMove)
      window.addEventListener("pointerup", handlePointerUp)
    },
    []
  )

  const handleSubmitManualClassification = useCallback(
    (groupIds: string[]) => {
      if (!manualClassificationGroup || !activePlanVersionId) {
        return Promise.resolve(false)
      }
      return handleApplyManualDossierClassification(
        manualClassificationGroup,
        activePlanVersionId,
        groupIds
      )
    },
    [
      activePlanVersionId,
      handleApplyManualDossierClassification,
      manualClassificationGroup,
    ]
  )

  const handleCloseGroupInformation = useCallback(() => {
    setSelectedGroupInfoNodeId(null)
    setGroupInformationTable(null)
    setGroupInformationError("")
  }, [])

  const handleSelectPreviewDocumentFromTree = useCallback(
    (document: ClusterDocument) => {
      handleCloseMembershipExplanation()
      setManualClassificationGroup(null)
      setSelectedGroupInfoNodeId(null)
      setGroupInformationTable(null)
      setGroupInformationError("")
      handleSelectPreviewDocument(document)
    },
    [handleCloseMembershipExplanation, handleSelectPreviewDocument]
  )

  const handleCloseDossierSuggestions = useCallback(() => {
    dossierSuggestionsRequestRef.current += 1
    setSelectedDossierSuggestionsDocumentIds([])
    setSelectedDossierSuggestionCandidates(null)
    setDossierSuggestionsLoading(false)
    setDossierSuggestionsRefreshing(false)
    setDossierSuggestionsError("")
  }, [])

  const handleExplainDocumentMembership = useCallback(
    async (document: ClusterDocument, forceRefresh = false) => {
      if (
        !forceRefresh &&
        membershipExplanationDocument?.sessionDocumentId ===
          document.sessionDocumentId
      ) {
        handleCloseMembershipExplanation()
        return
      }
      setManualClassificationGroup(null)
      setSelectedPreviewDocumentId(null)
      setSelectedMetadataGroupId(null)
      setSelectedGroupInfoNodeId(null)
      setGroupInformationTable(null)
      setGroupInformationError("")
      handleCloseDossierSuggestions()
      setMembershipExplanationDocument(document)
      setMembershipExplanation(null)
      setMembershipExplanationError("")
      if (!sessionId || document.sessionDocumentId === null) {
        setMembershipExplanationLoading(false)
        setMembershipExplanationError(
          "Không xác định được session hoặc tài liệu để tạo lời giải thích."
        )
        return
      }
      const requestId = ++membershipExplanationRequestIdRef.current
      setMembershipExplanationLoading(true)
      try {
        const response = await explainDocumentDossierMembership(
          sessionId,
          document.sessionDocumentId,
          {
            cluster_version_id: displayedClusterVersionId,
            force_refresh: forceRefresh,
          }
        )
        if (requestId !== membershipExplanationRequestIdRef.current) return
        setMembershipExplanation(response)
      } catch (err) {
        if (requestId !== membershipExplanationRequestIdRef.current) return
        setMembershipExplanationError(
          err instanceof Error
            ? err.message
            : "Không thể tạo lời giải thích cho tài liệu."
        )
      } finally {
        if (requestId === membershipExplanationRequestIdRef.current) {
          setMembershipExplanationLoading(false)
        }
      }
    },
    [
      displayedClusterVersionId,
      handleCloseDossierSuggestions,
      handleCloseMembershipExplanation,
      membershipExplanationDocument?.sessionDocumentId,
      sessionId,
    ]
  )

  const handleRefreshMembershipExplanation = useCallback(() => {
    if (!membershipExplanationDocument) return
    void handleExplainDocumentMembership(membershipExplanationDocument, true)
  }, [handleExplainDocumentMembership, membershipExplanationDocument])

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

      if (!sessionId) {
        setSelectedDossierSuggestionCandidates(null)
        setDossierSuggestionsLoading(false)
        setDossierSuggestionsRefreshing(false)
        setDossierSuggestionsError("Chưa có phiên hồ sơ để lấy gợi ý.")
        return
      }

      const requestId = dossierSuggestionsRequestRef.current + 1
      dossierSuggestionsRequestRef.current = requestId
      setDossierSuggestionsLoading(!forceRefresh)
      setDossierSuggestionsRefreshing(forceRefresh)
      setSelectedDossierSuggestionCandidates(null)
      void suggestSelectedDocumentDossiers(sessionId, {
        session_document_ids: sessionDocumentIds,
        cluster_version_id: displayedClusterVersionId ?? undefined,
        force_refresh: forceRefresh,
      })
        .then((response) => {
          if (dossierSuggestionsRequestRef.current !== requestId) {
            return
          }
          const resultsBySessionDocumentId = new Map(
            response.documents.map((item) => [item.session_document_id, item])
          )
          const missingSessionDocumentIds = sessionDocumentIds.filter(
            (sessionDocumentId) =>
              !resultsBySessionDocumentId.has(sessionDocumentId)
          )
          if (missingSessionDocumentIds.length > 0) {
            throw new Error(
              "Backend không trả về đủ gợi ý cho tài liệu đã chọn."
            )
          }

          setGroups((previous) =>
            previous.map((group) => ({
              ...group,
              documents: group.documents.map((item) =>
                item.sessionDocumentId !== null &&
                resultsBySessionDocumentId.has(item.sessionDocumentId)
                  ? {
                      ...item,
                      dossierSuggestions:
                        resultsBySessionDocumentId.get(item.sessionDocumentId)
                          ?.dossier_suggestions ?? [],
                    }
                  : item
              ),
            }))
          )

          const suggestions =
            response.dossier_suggestions ??
            aggregateDossierSuggestionsFromResults(response.documents)
          setSelectedDossierSuggestionCandidates(suggestions)
          const suggestionCount = suggestions.length
          if (forceRefresh) {
            toast.success(
              suggestionCount > 0
                ? `Đã tải lại ${suggestionCount} gợi ý hồ sơ.`
                : "Đã tính xong nhưng chưa tìm thấy hồ sơ phù hợp."
            )
          }
        })
        .catch((err) => {
          if (dossierSuggestionsRequestRef.current !== requestId) {
            return
          }
          setSelectedDossierSuggestionCandidates(null)
          setDossierSuggestionsError(
            err instanceof Error
              ? err.message
              : "Không thể tải danh sách hồ sơ được gợi ý."
          )
          if (forceRefresh) {
            toast.error("Không thể tải lại gợi ý hồ sơ.")
          }
        })
        .finally(() => {
          if (dossierSuggestionsRequestRef.current === requestId) {
            setDossierSuggestionsLoading(false)
            setDossierSuggestionsRefreshing(false)
          }
        })
    },
    [displayedClusterVersionId, sessionId]
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

  const handleSelectDossierSuggestionsFromTemporaryFolder = useCallback(
    (group: ClusterGroup) => {
      const documents = group.documents.filter(
        (document) =>
          document.sessionDocumentId !== null &&
          selectedSessionDocumentIds.has(document.sessionDocumentId)
      )
      if (documents.length === 0) {
        toast.error(
          "Hãy chọn ít nhất một tài liệu trong Thư mục tạm để lấy gợi ý hồ sơ."
        )
        return
      }
      handleSelectDossierSuggestionsForDocuments(documents)
    },
    [handleSelectDossierSuggestionsForDocuments, selectedSessionDocumentIds]
  )

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
      handleCloseMembershipExplanation()
      setManualClassificationGroup(null)
      setSelectedGroupInfoNodeId(null)
      setGroupInformationTable(null)
      setGroupInformationError("")
      handleSelectDossierMetadata(group)
    },
    [handleCloseMembershipExplanation, handleSelectDossierMetadata]
  )

  const handleSelectGroupInfoDossier = useCallback(
    (dossierId: string) => {
      const group = groups.find(
        (item) => !item.isTemporary && (item.dossierId ?? item.id) === dossierId
      )
      if (!group) return
      handleCloseMembershipExplanation()
      setSelectedGroupInfoNodeId(null)
      setGroupInformationTable(null)
      setGroupInformationError("")
      setSelectedPreviewDocumentId(null)
      setSelectedMetadataGroupId(group.id)
    },
    [groups, handleCloseMembershipExplanation]
  )

  const handleSelectGroupInfoDocument = useCallback(
    (sessionDocumentId: number) => {
      const hasDocument = previewDocuments.some(
        (item) => item.sessionDocumentId === sessionDocumentId
      )
      if (!hasDocument) return
      handleCloseMembershipExplanation()
      setSelectedGroupInfoNodeId(null)
      setGroupInformationTable(null)
      setGroupInformationError("")
      setSelectedMetadataGroupId(null)
      setSelectedPreviewDocumentId(sessionDocumentId)
    },
    [handleCloseMembershipExplanation, previewDocuments]
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
      Boolean(rebuildBaselineVersionId)
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
            : clusterJobMode === "predefined"
              ? `Đang lập hồ sơ nhanh. ${status}`
              : clusterJobMode === "update"
                ? `Đang cập nhật hồ sơ. ${status}`
                : `Đang lập hồ sơ mới. ${status}`
      : status
  const handleDeleteSelectedDocuments = useCallback(() => {
    const selectedEntries = previewDocuments.filter((entry) =>
      selectedSessionDocumentIds.has(entry.sessionDocumentId)
    )
    if (selectedEntries.some((entry) => entry.document.editLock?.locked)) {
      toast.error("Không thể xóa khi có tài liệu đang được chỉnh sửa.")
      return
    }
    const targets = previewDocuments
      .filter(
        (entry) =>
          selectedSessionDocumentIds.has(entry.sessionDocumentId) &&
          entry.document.lifecycleStatus !== "deleted" &&
          entry.document.lifecycleStatus !== "delete_pending"
      )
      .map((entry) => ({
        id: entry.sessionDocumentId,
        name: entry.document.fileName,
      }))
    if (targets.length === 0) {
      toast.error("Chưa chọn tài liệu active để xóa.")
      return
    }
    setDeletionTargets(targets)
  }, [previewDocuments, selectedSessionDocumentIds])

  const handleTransferSelectedDocuments = useCallback(() => {
    if (sourceHasActiveClusterVersion) {
      toast.error(
        "Phông nguồn đã có kết quả phân loại được duyệt nên không thể chuyển tài liệu đi."
      )
      return
    }
    const selectedEntries = previewDocuments.filter((entry) =>
      selectedSessionDocumentIds.has(entry.sessionDocumentId)
    )
    if (selectedEntries.some((entry) => entry.document.editLock?.locked)) {
      toast.error("Không thể chuyển phông khi có tài liệu đang được chỉnh sửa.")
      return
    }
    const selectionError = transferSelectionError(
      selectedEntries.map((entry) => entry.document)
    )
    if (selectionError) {
      toast.error(selectionError)
      return
    }
    const targets = selectedEntries.map((entry) => ({
      id: entry.sessionDocumentId,
      name: entry.document.fileName,
    }))
    if (targets.length === 0) {
      toast.error("Chưa chọn tài liệu active để chuyển phông.")
      return
    }
    setTransferTargets(targets)
  }, [
    previewDocuments,
    selectedSessionDocumentIds,
    sourceHasActiveClusterVersion,
  ])

  const handleDocumentDeletionCompleted = useCallback(
    (
      result: DocumentDeletionOperationResponse,
      targetedDocumentIds: number[]
    ) => {
      const targetedIds = new Set(targetedDocumentIds)
      const pendingIds = new Set(
        result.pending_session_documents.map(
          (document) => document.session_document_id
        )
      )
      setGroups((previous) =>
        previous.map((group) => ({
          ...group,
          documents: group.documents.map((document) =>
            document.sessionDocumentId !== null &&
            targetedIds.has(document.sessionDocumentId)
              ? {
                  ...document,
                  lifecycleStatus: pendingIds.has(document.sessionDocumentId)
                    ? "delete_pending"
                    : "deleted",
                  previewAvailable: false,
                }
              : document
          ),
        }))
      )
      setSelectedSessionDocumentIds((previous) => {
        const next = new Set(previous)
        targetedIds.forEach((id) => next.delete(id))
        return next
      })
      setSelectedPreviewDocumentId((previous) =>
        previous !== null && targetedIds.has(previous) ? null : previous
      )
      setPendingFeedbackCount(0)
      setStatus("Tập tài liệu đã thay đổi. Cần lập hồ sơ lại.")
      setDisplayedClusterVersion((previous) =>
        previous
          ? {
              ...previous,
              status: "stale",
              is_stale: true,
              stale_reason: "document_deleted",
              current_document_set_revision: result.document_set_revision,
            }
          : previous
      )
      setClusterVersions((previous) =>
        previous.map((version) =>
          version.id === activeClusterVersionId
            ? {
                ...version,
                status: "stale",
                is_stale: true,
                stale_reason: "document_deleted",
                current_document_set_revision: result.document_set_revision,
              }
            : version
        )
      )
    },
    [activeClusterVersionId]
  )

  const handleDocumentTransferRequestCreated = useCallback(
    async (
      request: DocumentTransferRequestResponse,
      targetedDocumentIds: number[]
    ) => {
      const targetedIds = new Set(targetedDocumentIds)
      setSelectedSessionDocumentIds((previous) => {
        const next = new Set(previous)
        targetedIds.forEach((id) => next.delete(id))
        return next
      })
      if (request.status === "completed") {
        setGroups((previous) =>
          previous.map((group) => ({
            ...group,
            documents: group.documents.map((document) =>
              document.sessionDocumentId !== null &&
              targetedIds.has(document.sessionDocumentId)
                ? {
                    ...document,
                    lifecycleStatus: "transferred_out",
                    transferredToSessionId: request.target_session_id,
                    previewAvailable: false,
                  }
                : document
            ),
          }))
        )
        setSelectedPreviewDocumentId((previous) =>
          previous !== null && targetedIds.has(previous) ? null : previous
        )
        setStatus(
          `Đã chuyển ${request.document_count} tài liệu sang ${request.target_session_id}.`
        )
        return
      }
      setGroups((previous) =>
        previous.map((group) => ({
          ...group,
          documents: group.documents.map((document) =>
            document.sessionDocumentId !== null &&
            targetedIds.has(document.sessionDocumentId)
              ? {
                  ...document,
                  activeTransferRequestId: request.request_id,
                  activeTransferRequestStatus: request.status,
                }
              : document
          ),
        }))
      )
      setDisplayedClusterVersion((previous) =>
        previous
          ? {
              ...previous,
              clusters: previous.clusters?.map((cluster) => ({
                ...cluster,
                placements: cluster.placements.map((placement) =>
                  targetedIds.has(placement.session_document_id)
                    ? {
                        ...placement,
                        active_transfer_request_id: request.request_id,
                        active_transfer_request_status: request.status,
                      }
                    : placement
                ),
              })),
            }
          : previous
      )
      setStatus(
        `Đã gửi yêu cầu chuyển ${request.document_count} tài liệu tới ${request.target_session_id}. Tài liệu được khóa cho tới khi Phông đích xử lý.`
      )
    },
    []
  )

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
    Boolean(rebuildBaselineVersionId)
  const selectedDocumentsActionDisabled =
    temporaryFolderUpdateDisabled ||
    clusterVersionStale ||
    selectedDocumentCount === 0
  const deleteSelectedDocumentsDisabled =
    !canDeleteDocuments ||
    temporaryFolderUpdateDisabled ||
    selectedDocumentCount === 0 ||
    selectedHasActiveEditLock
  const transferSelectedDocumentsDisabled =
    !canTransferDocuments ||
    sourceHasActiveClusterVersion ||
    temporaryFolderUpdateDisabled ||
    selectedDocumentCount === 0 ||
    selectedHasActiveEditLock
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
  const applyCompletedSort = useCallback(
    async (clusterVersionId: string, message: string) => {
      if (!sessionId) return
      const version = await getClusterVersion(sessionId, clusterVersionId, {
        includeClusters: true,
      })
      if (version.status === "active") {
        setActiveClusterVersionId(clusterVersionId)
      }
      setDisplayedClusterVersionId(clusterVersionId)
      setDisplayedClusterVersion(version)
      setPendingClusterVersion(version.status === "draft" ? version : null)
      setGroups(versionToGroups(version, metadataItemsRef.current))
      setClusterVersions((current) => {
        const withoutResult = current.filter(
          (item) => item.id !== clusterVersionId
        )
        return [...withoutResult, version]
      })
      setSupplementalRefreshKey((key) => key + 1)
      setStatus(message)
    },
    [sessionId]
  )
  const handleSortDossierDocuments = useCallback(
    async (group: ClusterGroup, dossierKind: ArrangementDossierKind) => {
      const dossierId = group.dossierId ?? group.id
      if (
        !sessionId ||
        (dossierKind === "cluster_dossier" && !workingClusterVersionId) ||
        viewingHistoricalClusterVersion ||
        sortingScope
      ) {
        return
      }
      const scope = `dossier:${dossierKind}:${dossierId}`
      setSortingScope(scope)
      try {
        const response = await sortDossierDocuments(
          sessionId,
          dossierId,
          dossierKind,
          workingClusterVersionId
        )
        if (response.cluster_version_id) {
          await applyCompletedSort(
            response.cluster_version_id,
            `Đã sắp xếp ${response.sorted_document_count ?? 0} tài liệu đã verify trong hồ sơ.`
          )
        } else {
          setSupplementalRefreshKey((key) => key + 1)
          setStatus(
            `Đã sắp xếp ${response.sorted_document_count ?? 0} tài liệu đã verify trong hồ sơ draft.`
          )
        }
        toast.success("Sắp xếp tài liệu hoàn tất.")
      } catch (caught) {
        toast.error(
          finalResultErrorMessage(caught, "Không thể sắp xếp tài liệu.")
        )
      } finally {
        setSortingScope(null)
      }
    },
    [
      applyCompletedSort,
      sessionId,
      sortingScope,
      viewingHistoricalClusterVersion,
      workingClusterVersionId,
    ]
  )
  const handleSortLeafDossiers = useCallback(
    async (leafGroupId: string) => {
      const planVersionId =
        displayedClusterVersion?.plan_version_id ?? activePlanVersionId
      if (
        !sessionId ||
        !workingClusterVersionId ||
        !planVersionId ||
        viewingHistoricalClusterVersion ||
        sortingScope
      ) {
        return
      }
      const scope = `leaf:${leafGroupId}`
      setSortingScope(scope)
      try {
        const response = await sortLeafDossiers(
          sessionId,
          leafGroupId,
          planVersionId,
          workingClusterVersionId
        )
        await applyCompletedSort(
          response.cluster_version_id,
          `Đã sắp xếp ${response.sorted_dossier_count ?? 0} hồ sơ đủ điều kiện trong mục.`
        )
        toast.success("Sắp xếp hồ sơ hoàn tất.")
      } catch (caught) {
        toast.error(finalResultErrorMessage(caught, "Không thể sắp xếp hồ sơ."))
      } finally {
        setSortingScope(null)
      }
    },
    [
      activePlanVersionId,
      applyCompletedSort,
      displayedClusterVersion?.plan_version_id,
      sessionId,
      sortingScope,
      viewingHistoricalClusterVersion,
      workingClusterVersionId,
    ]
  )
  return (
    <>
      <FinalResultView
        activeClusterVersionId={activeClusterVersionId}
        canDeleteDocuments={canDeleteDocuments}
        canTransferDocuments={canTransferDocuments}
        canRestoreFileRegisterVersion={canRestoreFileRegisterVersion}
        cancelingPendingFeedback={cancelingPendingFeedback}
        checkingClusters={checkingClusters}
        clusterCompletedPhases={clusterCompletedPhases}
        clusterJobMode={clusterJobMode}
        clusterProgressMessage={clusterProgressMessage}
        clusterProgressPhase={clusterProgressPhase}
        clusterVersionNavigationBusy={clusterVersionNavigationBusy}
        clusterVersionChanges={visibleClusterVersionChanges}
        clusterVersionChangesError={clusterVersionChangesError}
        clusterVersionChangesLoading={clusterVersionChangesLoading}
        clusterVersionStale={clusterVersionStale}
        clusterActionState={clusterActionState}
        deleteSelectedDocumentsDisabled={deleteSelectedDocumentsDisabled}
        transferSelectedDocumentsDisabled={transferSelectedDocumentsDisabled}
        displayedClusterVersion={displayedClusterVersion}
        displayedClusterVersionId={displayedClusterVersionId}
        draggedDocument={draggedDocument}
        dropTargetId={dropTargetId}
        documentChangeTypesById={changeHighlights.documents}
        handleActivateDisplayedClusterVersion={
          handleActivateDisplayedClusterVersion
        }
        handleApplyPendingClusterVersion={handleApplyPendingClusterVersion}
        handleCancelPendingFeedback={handleCancelPendingFeedback}
        handleCreateDossierFromSelection={handleCreateDossierFromSelection}
        handleCreateDossierFromSuggestions={handleCreateDossierFromSuggestions}
        handleDropOnDossier={handleDropOnDossier}
        handleDeleteSelectedDocuments={handleDeleteSelectedDocuments}
        handleTransferSelectedDocuments={handleTransferSelectedDocuments}
        handleFinish={handleFinish}
        hasUsableActiveClusterVersion={hasUsableActiveClusterVersion}
        sourceHasActiveClusterVersion={sourceHasActiveClusterVersion}
        handleMoveSelectionToDossier={handleMoveSelectionToDossier}
        handlePreviewResizePointerDown={handlePreviewResizePointerDown}
        handleManualClassificationResizePointerDown={
          handleManualClassificationResizePointerDown
        }
        handlePromoteTemporaryFolder={handlePromoteTemporaryFolder}
        handleRebuildClusters={handleRebuildClusters}
        handleRestorePreviousClusterVersion={
          handleRestorePreviousClusterVersion
        }
        handleResultTreeDragOver={handleResultTreeDragOver}
        handleOpenManualClassification={handleOpenManualClassification}
        handleRefreshDossierClassification={handleRefreshDossierClassification}
        handleSaveDossierMetadata={handleSaveDossierMetadata}
        handleSaveDocumentMetadata={handleSaveDocumentMetadata}
        handleSelectDossierMetadata={handleSelectDossierMetadataFromTree}
        handleSelectDossierSuggestions={handleSelectDossierSuggestionsFromTree}
        handleSelectDossierSuggestionsFromSelection={
          handleSelectDossierSuggestionsFromSelection
        }
        handleSelectDossierSuggestionsFromTemporaryFolder={
          handleSelectDossierSuggestionsFromTemporaryFolder
        }
        handleRefreshDossierSuggestions={handleRefreshDossierSuggestions}
        handleMoveDossierSuggestion={handleMoveDossierSuggestion}
        handleSelectGroupInformation={handleSelectGroupInformation}
        handleSelectRetentionCandidate={handleSelectRetentionCandidate}
        handleSelectPreviewDocument={handleSelectPreviewDocumentFromTree}
        handleExplainDocumentMembership={handleExplainDocumentMembership}
        handleToggleDocumentSelection={handleToggleDocumentSelection}
        handleToggleGroupSelection={handleToggleGroupSelection}
        handleViewClusterVersion={handleViewClusterVersion}
        handleSortDossierDocuments={handleSortDossierDocuments}
        handleSortLeafDossiers={handleSortLeafDossiers}
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
        numberingInProgress={numberingInProgress}
        nextDisplayVersion={nextDisplayVersion}
        openNodeIds={openNodeIds}
        pendingClusterDocumentCount={pendingClusterDocumentCount}
        pendingClusterVersion={pendingClusterVersion}
        pendingClusterVersionNeedsRefresh={pendingClusterVersionNeedsRefresh}
        pendingDossierCount={pendingDossierCount}
        pendingFeedbackCount={pendingFeedbackCount}
        supplementalPendingDocumentCount={clusteringPending?.count ?? 0}
        supplementalPendingUpdateDocumentCount={
          supplementalPendingUpdateDocumentCount
        }
        supplementalVerificationPendingCount={
          supplementalVerificationPendingCount
        }
        previewDocument={previewDocument}
        selectedDossierSuggestionsDocuments={
          selectedDossierSuggestionsDocuments
        }
        selectedDossierSuggestionCandidates={
          selectedDossierSuggestionCandidates
        }
        dossierSuggestionRepresentativeDocuments={
          dossierSuggestionRepresentativeDocuments
        }
        dossierSuggestionDossiers={displayGroups}
        selectedDossierSuggestionsDocumentId={
          selectedDossierSuggestionsDocumentId
        }
        dossierSuggestionsLoading={dossierSuggestionsLoading}
        dossierSuggestionsRefreshing={dossierSuggestionsRefreshing}
        dossierSuggestionsError={dossierSuggestionsError}
        previewLayoutRef={previewLayoutRef}
        previewWidthPercent={previewWidthPercent}
        manualClassificationWidthPercent={manualClassificationWidthPercent}
        previousDisplayVersion={previousDisplayVersion}
        promotingSelectedDocuments={promotingSelectedDocuments}
        promotingTemporaryFolder={promotingTemporaryFolder}
        rebuildBaselineVersionId={rebuildBaselineVersionId}
        rebuildSubmitting={rebuildSubmitting}
        refreshingClassificationDossierId={refreshingClassificationDossierId}
        manuallyClassifyingDossierId={manuallyClassifyingDossierId}
        manualClassificationGroup={manualClassificationGroup}
        membershipExplanationDocument={membershipExplanationDocument}
        membershipExplanation={membershipExplanation}
        membershipExplanationLoading={membershipExplanationLoading}
        membershipExplanationError={membershipExplanationError}
        classificationTree={classificationTree}
        handleCloseManualClassification={handleCloseManualClassification}
        handleCloseMembershipExplanation={handleCloseMembershipExplanation}
        handleRefreshMembershipExplanation={handleRefreshMembershipExplanation}
        handleSubmitManualClassification={handleSubmitManualClassification}
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
        sortingScope={sortingScope}
        stopResultTreeAutoScroll={stopResultTreeAutoScroll}
        temporaryFolderUpdateDisabled={temporaryFolderUpdateDisabled}
        totalDossiers={totalDossiers}
        totalFiles={totalFiles}
        totalPages={totalPages}
        tree={tree}
        toggleNode={toggleNode}
        updatingClusterVersion={updatingClusterVersion}
        viewingHistoricalClusterVersion={viewingHistoricalClusterVersion}
        activeResultTreeSearchNodeId={
          activeResultTreeSearchMatch?.nodeId ?? null
        }
        onResultTreeSearchNavigate={handleResultTreeSearchNavigate}
      />
      <DocumentDeletionDialog
        open={deletionTargets.length > 0}
        sessionId={sessionId}
        targets={deletionTargets}
        onOpenChange={(open) => {
          if (!open) setDeletionTargets([])
        }}
        onMutationCompleted={handleDocumentDeletionCompleted}
      />
      {SHOW_DOCUMENT_TRANSFER && (
        <DocumentTransferDialog
          open={transferTargets.length > 0}
          sourceSessionId={sessionId}
          targets={transferTargets}
          onOpenChange={(open) => {
            if (!open) setTransferTargets([])
          }}
          onRequestCreated={handleDocumentTransferRequestCreated}
        />
      )}
    </>
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

function aggregateDossierSuggestionsFromResults(
  documents: Array<{
    session_document_id: number
    document_id: string
    dossier_suggestions: SessionDossierSuggestion[]
  }>
): SessionDossierSuggestion[] {
  return aggregateDossierSuggestions(
    documents.flatMap((document) =>
      document.dossier_suggestions.map((suggestion) => ({
        documentId: document.document_id,
        sessionDocumentId: document.session_document_id,
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

function finalResultErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}
