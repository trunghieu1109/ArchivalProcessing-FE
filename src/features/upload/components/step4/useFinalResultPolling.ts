import { useEffect } from "react"
import { toast } from "sonner"
import {
  getActiveClusters,
  getClusterBuildStatus,
  listClusterVersions,
  listSessionEvents,
} from "@/features/upload/api/sessionApi"
import { versionToGroups } from "@/features/upload/lib/clusterGroups"
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
  nextClusterProgressPhase,
  normalizeClusterProgressPhase,
} from "./FinalResult.progress"
import {
  clusteredDocumentIds,
  regularDossierCount,
  temporaryDocumentCount,
} from "./FinalResult.metadataUtils"

const CLUSTER_POLL_INTERVAL_MS = 3_000
const CLUSTER_POLL_TIMEOUT_MS = 10 * 60 * 1_000
const CLUSTER_PROGRESS_TICK_MS = 4_500
const NO_CLUSTER_VERSION = "__none__"

export function useFinalResultPolling(context: Record<string, any>) {
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
    setRebuildBaselineVersionId,
    setStatus,
  } = context

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
        const [versionSummary, buildStatus] = await Promise.all([
          getActiveClusters(sessionId, { summaryOnly: true }),
          getClusterBuildStatus(sessionId).catch(() => null),
        ])
        if (cancelled) return

        const hasActiveBuildJob = Boolean(buildStatus?.active)
        const activeJobMode = hasActiveBuildJob
          ? clusterJobModeFromPayload(buildStatus?.job?.payload)
          : rebuildBaselineVersionId
            ? clusterJobMode
            : "new"
        let version = versionSummary
        const nextVersionId = versionSummary?.id ?? null
        const nextVersionMarker = nextVersionId ?? NO_CLUSTER_VERSION
        setActiveClusterVersionId(nextVersionId)

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

        const shouldDisplayInitialVersion =
          Boolean(version && nextVersionId) &&
          (!displayedClusterVersionId || !hasClusterData)
        const effectiveDisplayedVersionId = shouldDisplayInitialVersion
          ? nextVersionId
          : displayedClusterVersionId
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
        const nextGroups = versionToGroups(version, metadataItems)
        const displayedGroupsForStatus = shouldDisplayInitialVersion
          ? nextGroups
          : groups

        if (shouldDisplayInitialVersion && nextVersionId && version) {
          setGroups(nextGroups)
          setDisplayedClusterVersionId(nextVersionId)
          setDisplayedClusterVersion(version)
          setPendingClusterVersion(null)
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
        const hasMetadataItems = metadataItems.length > 0
        const missingVerified = hasMetadataItems
          ? verifiedItems.filter(
              (item: { document_id: string }) =>
                !clusteredIds.has(item.document_id)
            )
          : []
        const allVerifiedClustered =
          displayedGroupsForStatus.some(
            (group: { documents: unknown[] }) => group.documents.length > 0
          ) &&
          (!hasMetadataItems ||
            verifiedItems.length === 0 ||
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
              ? `Đã lập ${displayedDossierCount} hồ sơ${verifiedItems.length > 0 ? ` từ ${verifiedItems.length} tài liệu đã xác nhận` : ""}.${displayedTemporaryCount > 0 ? ` Có ${displayedTemporaryCount} tài liệu trong Thư mục tạm.` : ""}`
              : `Có ${displayedTemporaryCount} tài liệu trong Thư mục tạm; chưa có hồ sơ để tạo mục lục.`
          )
          schedule()
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
      (phase: string | null) =>
        normalizeClusterProgressPhase(phase) ?? FIRST_CLUSTER_PROGRESS_PHASE_ID
    )
    setClusterProgressMessage((message: string) =>
      isTerminalClusterProgressMessage(message)
        ? clusterProgressMessageForPhase(
            FIRST_CLUSTER_PROGRESS_PHASE_ID,
            clusterJobMode
          )
        : message
    )

    const intervalId = window.setInterval(() => {
      setClusterProgressPhase((phase: string | null) => {
        const nextPhase = nextClusterProgressPhase(phase)
        setClusterCompletedPhases((previous: Set<string>) =>
          mergeCompletedClusterPhaseSetBefore(previous, nextPhase)
        )
        setClusterProgressMessage(
          clusterProgressMessageForPhase(nextPhase, clusterJobMode)
        )
        return nextPhase
      })
    }, CLUSTER_PROGRESS_TICK_MS)

    return () => window.clearInterval(intervalId)
  }, [checkingClusters, clusterJobMode, loading, rebuildBaselineVersionId])
}
