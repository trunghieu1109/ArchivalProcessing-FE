import {
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react"
import { toast } from "sonner"
import { visibleAwareDelay } from "@/shared/lib/pageVisibility"
import {
  getActiveClusters,
  getClusterBuildStatus,
  listClusterVersions,
  listSessionEvents,
  type ClusterVersionResponse,
} from "@/features/upload/api/sessionApi"
import {
  versionToGroups,
  type ClusterGroup,
} from "@/features/upload/lib/clusterGroups"
import type { PdfMetadata } from "@/features/upload/types"
import {
  CLUSTER_ALL_PHASE_IDS,
  CLUSTER_PROGRESS_PHASES,
  FIRST_CLUSTER_PROGRESS_PHASE_ID,
  clusterJobModeFromPayload,
  clusterJobModeFromSource,
  clusterProgressMessageForPhase,
  completedClusterPhaseSet,
  dossierUiMessage,
  isTerminalClusterProgressMessage,
  latestClusterProgressPhase,
  mergeCompletedClusterPhaseSetBefore,
  normalizeClusterProgressPhase,
  type ClusterJobMode,
} from "./FinalResult.progress"
import {
  clusteredDocumentIds,
  regularDossierCount,
  temporaryDocumentCount,
} from "./FinalResult.metadataUtils"

const CLUSTER_ACTIVE_POLL_INTERVAL_MS = 5_000
const CLUSTER_IDLE_POLL_INTERVAL_MS = 30_000
const CLUSTER_POLL_TIMEOUT_MS = 10 * 60 * 1_000
const CLUSTER_EVENT_POLL_INTERVAL_MS = 5_000
const NO_CLUSTER_VERSION = "__none__"

interface FinalResultPollingContext {
  activeClusterVersionId: string | null
  checkingClusters: boolean
  clusterJobMode: ClusterJobMode
  displayedClusterVersionId: string | null
  groups: ClusterGroup[]
  hasClusterData: boolean
  loading: boolean
  metadataItems: PdfMetadata[]
  pendingClusterVersion: ClusterVersionResponse | null
  rebuildBaselineVersionId: string | null
  rebuildPollKey: number
  sessionId: string | null
  verifiedItems: PdfMetadata[]
  setActiveClusterVersionId: Dispatch<SetStateAction<string | null>>
  setCheckingClusters: Dispatch<SetStateAction<boolean>>
  setClusterCompletedPhases: Dispatch<SetStateAction<Set<string>>>
  setClusterJobMode: Dispatch<SetStateAction<ClusterJobMode>>
  setClusterProgressMessage: Dispatch<SetStateAction<string>>
  setClusterProgressPhase: Dispatch<SetStateAction<string | null>>
  setClusterVersions: Dispatch<SetStateAction<ClusterVersionResponse[]>>
  setDisplayedClusterVersion: Dispatch<
    SetStateAction<ClusterVersionResponse | null>
  >
  setDisplayedClusterVersionId: Dispatch<SetStateAction<string | null>>
  setGroups: Dispatch<SetStateAction<ClusterGroup[]>>
  setLoading: Dispatch<SetStateAction<boolean>>
  setPendingClusterVersion: Dispatch<
    SetStateAction<ClusterVersionResponse | null>
  >
  setPendingFeedbackCount: Dispatch<SetStateAction<number>>
  setPendingFeedbackRefreshKey: Dispatch<SetStateAction<number>>
  setRebuildBaselineVersionId: Dispatch<SetStateAction<string | null>>
  setStatus: Dispatch<SetStateAction<string>>
}

export function useFinalResultPolling(context: FinalResultPollingContext) {
  const {
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
  } = context
  const completedBuildJobIdRef = useRef<number | null>(null)
  const clusterRevisionRef = useRef<string | null>(null)
  const pollStateRef = useRef({
    checkingClusters,
    clusterJobMode,
    displayedClusterVersionId,
    groups,
    hasClusterData,
    loading,
    metadataItems,
    rebuildBaselineVersionId,
    verifiedItems,
  })
  useEffect(() => {
    pollStateRef.current = {
      checkingClusters,
      clusterJobMode,
      displayedClusterVersionId,
      groups,
      hasClusterData,
      loading,
      metadataItems,
      rebuildBaselineVersionId,
      verifiedItems,
    }
  })

  useEffect(() => {
    clusterRevisionRef.current = null
    completedBuildJobIdRef.current = null
  }, [sessionId])

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
    setClusterVersions,
  ])

  useEffect(() => {
    let cancelled = false
    let timeoutId: number | undefined
    const startedAt = Date.now()

    const schedule = (delayMs: number) => {
      if (!cancelled) {
        timeoutId = window.setTimeout(poll, visibleAwareDelay(delayMs))
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
      const state = pollStateRef.current
      if (document.visibilityState === "hidden") {
        schedule(
          state.loading ||
            state.checkingClusters ||
            state.rebuildBaselineVersionId
            ? CLUSTER_ACTIVE_POLL_INTERVAL_MS
            : CLUSTER_IDLE_POLL_INTERVAL_MS
        )
        return
      }
      if (
        Date.now() - startedAt > CLUSTER_POLL_TIMEOUT_MS &&
        (!state.displayedClusterVersionId || state.rebuildBaselineVersionId)
      ) {
        setLoading(false)
        setCheckingClusters(false)
        setRebuildBaselineVersionId(null)
        setStatus(
          state.rebuildBaselineVersionId
            ? "Quá thời gian chờ cập nhật hồ sơ. Feedback vẫn được lưu; hãy kiểm tra worker/dispatcher backend."
            : "Quá thời gian chờ lập hồ sơ. Hãy kiểm tra worker/dispatcher backend."
        )
        return
      }

      try {
        const [versionSummary, buildStatus] = await Promise.all([
          getActiveClusters(sessionId, { summaryOnly: true }),
          getClusterBuildStatus(sessionId).catch(() => null),
        ])
        if (cancelled) return

        const rawActiveBuildJob = Boolean(buildStatus?.active)
        if (!rawActiveBuildJob) completedBuildJobIdRef.current = null
        const hasActiveBuildJob = Boolean(
          rawActiveBuildJob &&
            buildStatus?.job?.id !== completedBuildJobIdRef.current
        )
        const latestState = pollStateRef.current
        const activeJobMode = hasActiveBuildJob
          ? clusterJobModeFromPayload(buildStatus?.job?.payload)
          : latestState.rebuildBaselineVersionId
            ? latestState.clusterJobMode
            : "new"
        let version = versionSummary
        const nextVersionId = versionSummary?.id ?? null
        const nextVersionMarker = nextVersionId ?? NO_CLUSTER_VERSION
        const nextClusterRevision = revisionToken(versionSummary?.revision)
        if (
          nextClusterRevision !== null &&
          nextClusterRevision !== clusterRevisionRef.current
        ) {
          const hadClusterRevision = clusterRevisionRef.current !== null
          clusterRevisionRef.current = nextClusterRevision
          if (
            hadClusterRevision &&
            nextVersionId &&
            latestState.displayedClusterVersionId === nextVersionId
          ) {
            setPendingFeedbackRefreshKey((key: number) => key + 1)
          }
        }
        setActiveClusterVersionId(nextVersionId)

        if (
          latestState.rebuildBaselineVersionId &&
          versionSummary &&
          nextVersionMarker !== latestState.rebuildBaselineVersionId
        ) {
          if (rawActiveBuildJob && buildStatus?.job?.id) {
            completedBuildJobIdRef.current = buildStatus.job.id
          }
          version = await getActiveClusters(sessionId)
          if (cancelled || !version) return
          const nextGroups = versionToGroups(
            version,
            pollStateRef.current.metadataItems
          )
          const nextDossierCount = regularDossierCount(nextGroups)
          const nextTemporaryCount = temporaryDocumentCount(nextGroups)
          setGroups(nextGroups)
          setDisplayedClusterVersionId(version.id)
          setDisplayedClusterVersion(version)
          setPendingClusterVersion(null)
          setPendingFeedbackCount(0)
          setPendingFeedbackRefreshKey((key: number) => key + 1)
          setRebuildBaselineVersionId(null)
          setLoading(false)
          setCheckingClusters(false)
          setClusterJobMode(clusterJobModeFromSource(version.source))
          setClusterProgressPhase(null)
          setClusterCompletedPhases(completedClusterPhaseSet())
          setClusterProgressMessage("Đã cập nhật hồ sơ xong.")
          setStatus(
            nextDossierCount > 0
              ? `Đã cập nhật ${nextDossierCount} hồ sơ.${
                  nextTemporaryCount > 0
                    ? ` Có ${nextTemporaryCount} tài liệu trong Thư mục tạm.`
                    : ""
                }`
              : `Đã cập nhật hồ sơ. Có ${nextTemporaryCount} tài liệu trong Thư mục tạm.`
          )
          toast.success("Đã cập nhật hồ sơ từ feedback đã lưu.")
          schedule(CLUSTER_IDLE_POLL_INTERVAL_MS)
          return
        }

        if (hasActiveBuildJob) {
          setCheckingClusters(false)
          setLoading(true)
          setClusterJobMode(activeJobMode)
          setClusterProgressPhase(
            (phase: string | null) =>
              normalizeClusterProgressPhase(phase) ??
              FIRST_CLUSTER_PROGRESS_PHASE_ID
          )
          setClusterCompletedPhases((previous: Set<string>) =>
            previous.size === CLUSTER_ALL_PHASE_IDS.length
              ? new Set()
              : previous
          )
          setClusterProgressMessage((message: string) =>
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
          schedule(CLUSTER_ACTIVE_POLL_INTERVAL_MS)
          return
        }

        setLoading(false)
        setCheckingClusters(false)
        if (
          latestState.rebuildBaselineVersionId &&
          nextVersionMarker === latestState.rebuildBaselineVersionId
        ) {
          setLoading(true)
          setClusterJobMode(activeJobMode)
          setClusterProgressMessage("Đang nhận phiên bản hồ sơ mới từ backend.")
          setStatus(
            activeJobMode === "file_register"
              ? "Backend đã xử lý xong, đang chờ phiên bản hồ sơ tập lưu mới."
              : "Backend đã xử lý xong, đang chờ phiên bản hồ sơ mới từ feedback đã lưu."
          )
          schedule(CLUSTER_ACTIVE_POLL_INTERVAL_MS)
          return
        }

        const shouldDisplayInitialVersion =
          Boolean(version && nextVersionId) &&
          (!latestState.displayedClusterVersionId || !latestState.hasClusterData)
        const effectiveDisplayedVersionId = shouldDisplayInitialVersion
          ? nextVersionId
          : latestState.displayedClusterVersionId
        const shouldFetchFullVersion =
          Boolean(version && nextVersionId) &&
          (shouldDisplayInitialVersion ||
            Boolean(
              effectiveDisplayedVersionId &&
              nextVersionId !== effectiveDisplayedVersionId
            ))
        if (shouldFetchFullVersion) {
          version = await getActiveClusters(sessionId)
          if (cancelled) return
        }
        const nextGroups = versionToGroups(version, latestState.metadataItems)
        let displayedGroupsForStatus = latestState.groups

        if (shouldDisplayInitialVersion && nextVersionId && version) {
          setGroups(nextGroups)
          setDisplayedClusterVersionId(nextVersionId)
          setDisplayedClusterVersion(version)
          setPendingClusterVersion(null)
          displayedGroupsForStatus = nextGroups
        }

        if (
          version &&
          nextVersionId &&
          effectiveDisplayedVersionId &&
          nextVersionId !== effectiveDisplayedVersionId
        ) {
          if (latestState.rebuildBaselineVersionId) {
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
          schedule(CLUSTER_IDLE_POLL_INTERVAL_MS)
          return
        }

        setPendingClusterVersion(null)
        if (latestState.rebuildBaselineVersionId) {
          setRebuildBaselineVersionId(null)
          toast.success("Đã có phiên bản hồ sơ mới từ feedback đã lưu.")
        }

        const clusteredIds = clusteredDocumentIds(version)
        const currentMetadataItems = pollStateRef.current.metadataItems
        const currentVerifiedItems = pollStateRef.current.verifiedItems
        const hasMetadataItems = currentMetadataItems.length > 0
        const missingVerified = hasMetadataItems
          ? currentVerifiedItems.filter(
              (item) => !clusteredIds.has(item.document_id)
            )
          : []
        const allVerifiedClustered =
          displayedGroupsForStatus.some(
            (group: { documents: unknown[] }) => group.documents.length > 0
          ) &&
          (!hasMetadataItems ||
            currentVerifiedItems.length === 0 ||
            missingVerified.length === 0)
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
              ? `Đã lập ${displayedDossierCount} hồ sơ${currentVerifiedItems.length > 0 ? ` từ ${currentVerifiedItems.length} tài liệu đã xác nhận` : ""}.${displayedTemporaryCount > 0 ? ` Có ${displayedTemporaryCount} tài liệu trong Thư mục tạm.` : ""}`
              : `Có ${displayedTemporaryCount} tài liệu trong Thư mục tạm; chưa có hồ sơ để tạo mục lục.`
          )
          schedule(CLUSTER_IDLE_POLL_INTERVAL_MS)
          return
        }

        if (
          hasMetadataItems &&
          displayedDossierCount > 0 &&
          missingVerified.length > 0
        ) {
          setClusterProgressPhase(null)
          setClusterCompletedPhases(completedClusterPhaseSet())
          setClusterProgressMessage("Đã lập hồ sơ xong.")
          setStatus(
            `Đã có ${displayedDossierCount} hồ sơ. Có ${missingVerified.length} tài liệu đã xác nhận chưa được cập nhật vào hồ sơ.`
          )
          schedule(CLUSTER_IDLE_POLL_INTERVAL_MS)
        } else {
          setClusterProgressPhase(null)
          setClusterProgressMessage("")
          setStatus("Chưa có kết quả lập hồ sơ từ backend.")
          schedule(CLUSTER_IDLE_POLL_INTERVAL_MS)
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
        schedule(
          pollStateRef.current.loading ||
            pollStateRef.current.checkingClusters ||
            pollStateRef.current.rebuildBaselineVersionId
            ? CLUSTER_ACTIVE_POLL_INTERVAL_MS
            : CLUSTER_IDLE_POLL_INTERVAL_MS
        )
      }
    }

    void poll()
    return () => {
      cancelled = true
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [
    rebuildPollKey,
    sessionId,
    setActiveClusterVersionId,
    setCheckingClusters,
    setClusterCompletedPhases,
    setClusterJobMode,
    setClusterProgressMessage,
    setClusterProgressPhase,
    setDisplayedClusterVersion,
    setDisplayedClusterVersionId,
    setGroups,
    setLoading,
    setPendingClusterVersion,
    setPendingFeedbackCount,
    setPendingFeedbackRefreshKey,
    setRebuildBaselineVersionId,
    setStatus,
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
              if (phase === "completed") {
                setClusterProgressPhase(null)
                setClusterCompletedPhases(completedClusterPhaseSet())
              } else if (normalizedPhase) {
                setClusterProgressPhase((currentPhase: string | null) => {
                  const nextPhase = latestClusterProgressPhase(
                    currentPhase,
                    normalizedPhase
                  )
                  setClusterCompletedPhases((previous: Set<string>) =>
                    mergeCompletedClusterPhaseSetBefore(previous, nextPhase)
                  )
                  return nextPhase
                })
              }
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
      if (!cancelled) {
        timeoutId = window.setTimeout(
          pollEvents,
          visibleAwareDelay(CLUSTER_EVENT_POLL_INTERVAL_MS)
        )
      }
    }

    void pollEvents()
    return () => {
      cancelled = true
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [
    loading,
    rebuildBaselineVersionId,
    sessionId,
    setClusterCompletedPhases,
    setClusterProgressMessage,
    setClusterProgressPhase,
  ])

  useEffect(() => {
    if (!loading && !checkingClusters && !rebuildBaselineVersionId) return

    setClusterProgressPhase(
      (phase: string | null) =>
        normalizeClusterProgressPhase(phase) ?? FIRST_CLUSTER_PROGRESS_PHASE_ID
    )
    setClusterProgressMessage((message: string) =>
      isTerminalClusterProgressMessage(message)
        ? clusterProgressMessageForPhase(
            FIRST_CLUSTER_PROGRESS_PHASE_ID,
            clusterJobMode
          )
        : message ||
          clusterProgressMessageForPhase(
            FIRST_CLUSTER_PROGRESS_PHASE_ID,
            clusterJobMode
          )
    )
  }, [
    checkingClusters,
    clusterJobMode,
    loading,
    rebuildBaselineVersionId,
    setClusterProgressMessage,
    setClusterProgressPhase,
  ])
}

function revisionToken(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value))
  }
  if (typeof value === "string") {
    const text = value.trim()
    return text || null
  }
  return null
}
