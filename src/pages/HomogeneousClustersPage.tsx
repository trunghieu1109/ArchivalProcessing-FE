import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  FolderCheck,
  FolderPlus,
  Layers3,
  ListChecks,
  Loader2,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { HomogeneousDocumentReviewDialog } from "@/features/upload/components/HomogeneousDocumentReviewDialog"
import {
  addClustersToProvisionalDossier,
  createProvisionalDossier,
  getClusterBuildStatus,
  getHomogeneousClusterNeighbors,
  getHomogeneousClusters,
  listProvisionalDossiers,
  startHomogeneousClustering,
  type ClusterBuildProgressMetrics,
  type ClusterBuildStatusResponse,
  type ClusterVersionResponse,
  type HomogeneousClusterNeighbor,
  type ProvisionalDossier,
  type ProvisionalDossierRecommendation,
  type SessionClusterSummary,
} from "@/features/upload/api/sessionApi"
import { useAuth } from "@/features/auth/lib/AuthContext"
import { buildHomogeneousProgressView } from "@/pages/HomogeneousClustersPage.progress"
import { normalizeClusterContentSummary } from "@/features/upload/lib/homogeneousClusterSummary"
import { prefetchDocumentPreview } from "@/features/upload/lib/documentPreviewCache"
import { useHomogeneousClusterDetailCache } from "@/features/upload/hooks/useHomogeneousClusterDetailCache"
import { UploadPageHeader } from "@/pages/UploadPage.header"
import { SessionWorkflowContext } from "@/pages/SessionWorkflowContext"
import {
  HOMOGENEOUS_WORKFLOW_LABELS,
  homogeneousWorkflowRoute,
  markHomogeneousWorkflow,
} from "@/pages/homogeneousWorkflow"

const POLL_INTERVAL_MS = 1000
const CLUSTERS_PER_PAGE = 6
const RELATED_CLUSTER_SUGGESTION_LIMIT = 20

export function HomogeneousClustersPage() {
  const { sessionId = "" } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isWorkerUser =
    String(user?.role ?? "")
      .trim()
      .toLowerCase() === "worker"
  const [version, setVersion] = useState<ClusterVersionResponse | null>(null)
  const [provisional, setProvisional] = useState<ProvisionalDossier[]>([])
  const [compositionLocked, setCompositionLocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [building, setBuilding] = useState(false)
  const [progress, setProgress] = useState("Đang tải kết quả phân cụm...")
  const [progressMetrics, setProgressMetrics] =
    useState<ClusterBuildProgressMetrics | null>(null)
  const [pollGeneration, setPollGeneration] = useState(0)
  const [reviewCluster, setReviewCluster] =
    useState<SessionClusterSummary | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [loadingCluster, setLoadingCluster] = useState<string | null>(null)
  const [selectedDossier, setSelectedDossier] = useState<
    Record<string, string>
  >({})
  const [busyCluster, setBusyCluster] = useState<string | null>(null)
  const [neighborsByCluster, setNeighborsByCluster] = useState<
    Record<string, HomogeneousClusterNeighbor[]>
  >({})
  const [dossierRecommendationsByCluster, setDossierRecommendationsByCluster] =
    useState<Record<string, ProvisionalDossierRecommendation[]>>({})
  const [neighborsLoading, setNeighborsLoading] = useState(false)
  const [clusterPage, setClusterPage] = useState(1)
  const [selectedClusterIds, setSelectedClusterIds] = useState<Set<string>>(
    () => new Set()
  )
  const [bulkCreating, setBulkCreating] = useState(false)
  const openClusterRequestRef = useRef(0)
  const {
    getCached: getCachedClusterDetail,
    loadClusterDetail,
    prefetchClusterDetails,
  } = useHomogeneousClusterDetailCache(sessionId, version?.id ?? "")

  const prefetchFollowingPreview = useCallback(
    (clusterId: string) => {
      const clusterList = version?.clusters ?? []
      const clusterIndex = clusterList.findIndex(
        (item) => item.cluster_id === clusterId
      )
      if (clusterIndex < 0) return

      const followingCluster = clusterList[clusterIndex + 1]
      if (!followingCluster) return
      void loadClusterDetail(followingCluster.cluster_id)
        .then((followingDetail) => {
          prefetchDocumentPreview(
            sessionId,
            followingDetail?.placements[0]?.session_document_id,
            "dossier_review"
          )
        })
        .catch(() => undefined)
    },
    [loadClusterDetail, sessionId, version]
  )

  useEffect(() => markHomogeneousWorkflow(sessionId), [sessionId])

  const applyBuildStatus = useCallback(
    (buildStatus: ClusterBuildStatusResponse) => {
      const homogeneousJob =
        buildStatus.active &&
        buildStatus.job?.payload.workflow_mode === "homogeneous"
      setBuilding(Boolean(homogeneousJob))
      setProgressMetrics(
        homogeneousJob ? (buildStatus.progress?.metrics ?? null) : null
      )
      setProgress(
        buildStatus.progress?.message ||
          (homogeneousJob
            ? "Đang phân cụm tài liệu..."
            : "Đã cập nhật kết quả mới nhất.")
      )
      return Boolean(homogeneousJob)
    },
    []
  )

  const loadBuildStatus = useCallback(async () => {
    if (!sessionId) return false
    return applyBuildStatus(await getClusterBuildStatus(sessionId))
  }, [applyBuildStatus, sessionId])

  const load = useCallback(async () => {
    if (!sessionId) return false
    const [clusterVersion, dossierList, buildStatus] = await Promise.all([
      getHomogeneousClusters(sessionId),
      listProvisionalDossiers(sessionId),
      getClusterBuildStatus(sessionId),
    ])
    setVersion(clusterVersion)
    setProvisional(dossierList.dossiers)
    setCompositionLocked(
      (dossierList.composition?.assigned_cluster_count ?? 0) > 0 &&
        (dossierList.composition?.unassigned_cluster_count ?? 0) > 0
    )
    return applyBuildStatus(buildStatus)
  }, [applyBuildStatus, sessionId])

  const applyDossierMutationResult = useCallback(
    (dossier: ProvisionalDossier) => {
      setProvisional((current) => [
        ...current.filter((item) => item.id !== dossier.id),
        dossier,
      ])
      setNeighborsByCluster({})
      setDossierRecommendationsByCluster({})
    },
    []
  )

  const refreshAfterDossierMutation = useCallback(() => {
    void load().catch(() => undefined)
  }, [load])

  useEffect(() => {
    let cancelled = false
    let timer: number | undefined
    let initialized = false
    let observedActiveBuild = false
    const poll = async () => {
      try {
        const active = initialized ? await loadBuildStatus() : await load()
        initialized = true
        if (!cancelled && active) {
          observedActiveBuild = true
          timer = window.setTimeout(poll, POLL_INTERVAL_MS)
        } else if (!cancelled && observedActiveBuild) {
          await load()
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Không tải được cụm tài liệu."
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void poll()
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [load, loadBuildStatus, pollGeneration])

  const occupiedByCluster = useMemo(() => {
    const result = new Map<string, ProvisionalDossier>()
    for (const dossier of provisional) {
      for (const cluster of dossier.clusters) {
        result.set(cluster.cluster_id, dossier)
      }
    }
    return result
  }, [provisional])
  const draftDossiers = provisional.filter((item) => item.status === "draft")
  const promotedDossiers = provisional.filter(
    (item) => item.status === "promoted"
  )
  const compositionCompleted =
    provisional.length > 0 && draftDossiers.length === 0
  const progressView = useMemo(
    () => buildHomogeneousProgressView(progressMetrics),
    [progressMetrics]
  )

  const rerun = async () => {
    if (!sessionId) return
    setLoading(true)
    try {
      await startHomogeneousClustering(sessionId, { forceRebuild: true })
      setBuilding(true)
      setProgressMetrics(null)
      setProgress("Đã gửi tác vụ phân cụm thuần nhất.")
      toast.success("Đã bắt đầu phân cụm lại.")
      setPollGeneration((current) => current + 1)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không thể phân cụm lại."
      )
    } finally {
      setLoading(false)
    }
  }

  const openDocuments = async (
    clusterId: string,
    fallbackCluster?: SessionClusterSummary
  ) => {
    if (!sessionId) return
    const requestId = ++openClusterRequestRef.current
    const cached = getCachedClusterDetail(clusterId)
    if (cached || fallbackCluster) {
      setReviewCluster(cached ?? fallbackCluster ?? null)
      setReviewOpen(true)
    }
    prefetchFollowingPreview(clusterId)
    setLoadingCluster(clusterId)
    const neighborsCached = Object.prototype.hasOwnProperty.call(
      neighborsByCluster,
      clusterId
    )
    if (!neighborsCached) {
      setNeighborsLoading(true)
      void getHomogeneousClusterNeighbors(
        sessionId,
        clusterId,
        RELATED_CLUSTER_SUGGESTION_LIMIT
      )
        .then((neighborResponse) => {
          setNeighborsByCluster((current) => ({
            ...current,
            [clusterId]: neighborResponse.neighbors,
          }))
          setDossierRecommendationsByCluster((current) => ({
            ...current,
            [clusterId]: neighborResponse.provisional_dossiers ?? [],
          }))
        })
        .catch(() => undefined)
        .finally(() => {
          if (openClusterRequestRef.current === requestId) {
            setNeighborsLoading(false)
          }
        })
    } else {
      setNeighborsLoading(false)
    }
    try {
      const detail = cached ?? (await loadClusterDetail(clusterId))
      if (openClusterRequestRef.current !== requestId) return
      if (!detail) throw new Error("Không tìm thấy thông tin cụm.")
      setReviewCluster(detail)
      setReviewOpen(true)
    } catch (error) {
      if (openClusterRequestRef.current !== requestId) return
      toast.error(
        error instanceof Error
          ? error.message
          : "Không tải được tài liệu trong cụm."
      )
    } finally {
      if (openClusterRequestRef.current === requestId) {
        setLoadingCluster(null)
      }
    }
  }

  const handleReviewOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      openClusterRequestRef.current += 1
      setLoadingCluster(null)
      setNeighborsLoading(false)
    }
    setReviewOpen(nextOpen)
  }

  const createDossierFromClusters = async (
    clusterIds: string[]
  ): Promise<ProvisionalDossier | null> => {
    const uniqueClusterIds = [...new Set(clusterIds.filter(Boolean))]
    if (!sessionId || uniqueClusterIds.length === 0) return null
    setBusyCluster(uniqueClusterIds[0])
    try {
      const createdDossier = await createProvisionalDossier(
        sessionId,
        uniqueClusterIds
      )
      toast.success(
        uniqueClusterIds.length > 1
          ? `Đã tạo hồ sơ tạm từ ${uniqueClusterIds.length} cụm tài liệu.`
          : "Đã tạo hồ sơ tạm từ cụm tài liệu."
      )
      setSelectedClusterIds((current) => {
        const next = new Set(current)
        uniqueClusterIds.forEach((clusterId) => next.delete(clusterId))
        return next
      })
      applyDossierMutationResult(createdDossier)
      refreshAfterDossierMutation()
      return createdDossier
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không tạo được hồ sơ tạm."
      )
      return null
    } finally {
      setBusyCluster(null)
    }
  }

  const createDossier = (clusterId: string) =>
    createDossierFromClusters([clusterId])

  const addClustersToDossier = async (
    clusterIds: string[],
    targetDossierId: number
  ): Promise<ProvisionalDossier | null> => {
    const uniqueClusterIds = [...new Set(clusterIds.filter(Boolean))]
    if (!sessionId || !targetDossierId || uniqueClusterIds.length === 0) {
      return null
    }
    setBusyCluster(uniqueClusterIds[0])
    try {
      const updatedDossier = await addClustersToProvisionalDossier(
        sessionId,
        targetDossierId,
        uniqueClusterIds
      )
      toast.success(
        uniqueClusterIds.length > 1
          ? `Đã ghép ${uniqueClusterIds.length} cụm vào hồ sơ tạm.`
          : "Đã ghép cụm vào hồ sơ tạm."
      )
      setSelectedClusterIds((current) => {
        const next = new Set(current)
        uniqueClusterIds.forEach((clusterId) => next.delete(clusterId))
        return next
      })
      setSelectedDossier((current) => {
        const next = { ...current }
        uniqueClusterIds.forEach((clusterId) => {
          next[clusterId] = ""
        })
        return next
      })
      applyDossierMutationResult(updatedDossier)
      refreshAfterDossierMutation()
      return updatedDossier
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không ghép được cụm."
      )
      return null
    } finally {
      setBusyCluster(null)
    }
  }

  const addToDossier = (
    clusterId: string,
    targetDossierId?: number
  ): Promise<ProvisionalDossier | null> => {
    const dossierId = targetDossierId ?? Number(selectedDossier[clusterId])
    return addClustersToDossier([clusterId], dossierId)
  }

  const createDossierFromSelection = async () => {
    if (!sessionId || selectedClusterIds.size === 0) return
    setBulkCreating(true)
    try {
      const createdDossier = await createProvisionalDossier(sessionId, [
        ...selectedClusterIds,
      ])
      toast.success(
        `Đã tạo một hồ sơ tạm từ ${selectedClusterIds.size} cụm đã chọn.`
      )
      setSelectedClusterIds(new Set())
      applyDossierMutationResult(createdDossier)
      refreshAfterDossierMutation()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Không tạo được hồ sơ tạm từ các cụm đã chọn."
      )
    } finally {
      setBulkCreating(false)
    }
  }

  const toggleClusterSelection = (clusterId: string) => {
    setSelectedClusterIds((current) => {
      const next = new Set(current)
      if (next.has(clusterId)) next.delete(clusterId)
      else next.add(clusterId)
      return next
    })
  }

  const clusters = useMemo(
    () =>
      (version?.clusters ?? []).filter(
        (cluster) =>
          !(
            (cluster.is_temporary ||
              cluster.cluster_id === "temporary-folder") &&
            cluster.document_ids.length === 0
          )
      ),
    [version]
  )
  const orderedClusters = useMemo(
    () =>
      clusters
        .map((cluster, originalIndex) => ({ cluster, originalIndex }))
        .sort((left, right) => {
          const leftAssigned = occupiedByCluster.has(left.cluster.cluster_id)
          const rightAssigned = occupiedByCluster.has(right.cluster.cluster_id)
          if (leftAssigned !== rightAssigned) return leftAssigned ? 1 : -1
          return left.originalIndex - right.originalIndex
        }),
    [clusters, occupiedByCluster]
  )
  const clusterPageCount = Math.max(
    1,
    Math.ceil(orderedClusters.length / CLUSTERS_PER_PAGE)
  )
  const visibleClusterPage = Math.min(clusterPage, clusterPageCount)
  const paginatedClusters = useMemo(
    () =>
      orderedClusters.slice(
        (visibleClusterPage - 1) * CLUSTERS_PER_PAGE,
        visibleClusterPage * CLUSTERS_PER_PAGE
      ),
    [orderedClusters, visibleClusterPage]
  )

  useEffect(() => {
    prefetchClusterDetails(
      paginatedClusters.map(({ cluster }) => cluster.cluster_id)
    )
  }, [paginatedClusters, prefetchClusterDetails])

  const assignedCount = clusters.filter((cluster) =>
    occupiedByCluster.has(cluster.cluster_id)
  ).length
  const assignmentProgressPercentage =
    clusters.length > 0
      ? Math.min(100, Math.round((assignedCount / clusters.length) * 100))
      : 0
  const totalDocumentCount = clusters.reduce(
    (total, cluster) =>
      total +
      (cluster.statistics?.document_count ?? cluster.document_ids.length),
    0
  )
  const selectablePageClusterIds = paginatedClusters
    .map(({ cluster }) => cluster.cluster_id)
    .filter((clusterId) => !occupiedByCluster.has(clusterId))
  const allPageClustersSelected =
    selectablePageClusterIds.length > 0 &&
    selectablePageClusterIds.every((clusterId) =>
      selectedClusterIds.has(clusterId)
    )
  const reviewClusterIndex = reviewCluster
    ? orderedClusters.findIndex(
        ({ cluster }) => cluster.cluster_id === reviewCluster.cluster_id
      )
    : -1

  const togglePageSelection = () => {
    setSelectedClusterIds((current) => {
      const next = new Set(current)
      if (allPageClustersSelected) {
        selectablePageClusterIds.forEach((clusterId) => next.delete(clusterId))
      } else {
        selectablePageClusterIds.forEach((clusterId) => next.add(clusterId))
      }
      return next
    })
  }

  return (
    <div className="min-h-svh bg-[#F0F4F8]">
      <UploadPageHeader
        currentStep={4}
        highestVisitedStep={4}
        STEP_LABELS={HOMOGENEOUS_WORKFLOW_LABELS}
        goTo={(step: number) =>
          navigate(homogeneousWorkflowRoute(sessionId, step))
        }
        isWorkerUser={isWorkerUser}
        navigate={navigate}
        onNavigateSessions={() => navigate("/sessions")}
      />

      <main className="mx-auto max-w-[1560px] space-y-5 px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
        <SessionWorkflowContext
          sessionId={sessionId}
          readOnly={isWorkerUser}
          onNavigateSessions={() => navigate("/sessions")}
          onBack={() => navigate(homogeneousWorkflowRoute(sessionId, 3))}
        />

        <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-4xl min-w-0">
            <h1 className="font-sans text-2xl font-semibold tracking-normal text-[#0F172A]">
              Danh sách nhóm tài liệu tạm thời
            </h1>
            <p className="mt-1 text-sm text-[#475569]">
              Kiểm tra tóm tắt nội dung, đối chiếu tài liệu và chọn các cụm để
              lập hồ sơ tạm.
            </p>
          </div>
          {!building && clusters.length > 0 && (
            <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
              <Button
                variant="outline"
                onClick={() => void rerun()}
                disabled={
                  loading ||
                  building ||
                  draftDossiers.length > 0 ||
                  compositionLocked ||
                  isWorkerUser
                }
                title={
                  draftDossiers.length > 0 || compositionLocked
                    ? "Hoàn tất hồ sơ tạm hiện tại trước khi phân cụm lại"
                    : undefined
                }
              >
                <RefreshCw className={building ? "animate-spin" : ""} />
                Phân cụm lại
              </Button>
              <dl className="grid w-full shrink-0 grid-cols-3 gap-2 sm:w-auto">
                <ClusterMetric label="Cụm" value={clusters.length} />
                <ClusterMetric label="Tài liệu" value={totalDocumentCount} />
                <ClusterMetric label="Đã xử lý" value={assignedCount} />
              </dl>
            </div>
          )}
        </section>

        {(loading || building) && (
          <section className="overflow-hidden rounded-2xl border border-[#C7D7FE] bg-white shadow-[0_4px_18px_rgba(0,82,255,0.06)]">
            <div className="border-b border-[#DCE6FF] bg-gradient-to-r from-[#EEF2FF] to-[#F8FAFF] px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-9 items-center justify-center rounded-xl bg-[#0052FF] text-white shadow-sm">
                    <Loader2 className="size-4 animate-spin" />
                  </span>
                  <div>
                    <p className="font-semibold text-[#0F172A]">
                      {building ? progressView.phaseTitle : "Đang tải kết quả"}
                    </p>
                    <p className="mt-0.5 text-sm text-[#64748B]">{progress}</p>
                  </div>
                </div>
                {(loading || building) && (
                  <span className="text-lg font-bold text-[#0052FF] tabular-nums">
                    {progressView.percentage}%
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-4 px-5 py-4">
              {(loading || building) && (
                <div
                  className="h-2.5 overflow-hidden rounded-full bg-[#E2E8F0]"
                  role="progressbar"
                  aria-label={progressView.progressLabel}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progressView.percentage}
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] transition-[width] duration-500"
                    style={{ width: `${progressView.percentage}%` }}
                  />
                </div>
              )}
              {(loading || building) && (
                <ol className="grid gap-2 sm:grid-cols-3">
                  {progressView.phases.map((phase, index) => (
                    <li
                      key={phase.id}
                      className={`rounded-xl border px-3 py-2.5 ${
                        phase.status === "active"
                          ? "border-[#AFC6FF] bg-[#F4F7FF]"
                          : phase.status === "completed"
                            ? "border-[#BBF7D0] bg-[#F0FDF4]"
                            : "border-[#E2E8F0] bg-[#F8FAFC]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span
                          className={`font-semibold ${
                            phase.status === "active"
                              ? "text-[#0052FF]"
                              : phase.status === "completed"
                                ? "text-[#15803D]"
                                : "text-[#64748B]"
                          }`}
                        >
                          {index + 1}. {phase.label}
                        </span>
                        <span className="font-medium text-[#475569] tabular-nums">
                          {phase.percentage}%
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#E2E8F0]">
                        <div
                          className={`h-full rounded-full transition-[width] duration-500 ${
                            phase.status === "completed"
                              ? "bg-[#22C55E]"
                              : phase.status === "active"
                                ? "bg-[#0052FF]"
                                : "bg-[#CBD5E1]"
                          }`}
                          style={{ width: `${phase.percentage}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        )}

        {!loading && !building && clusters.length === 0 && (
          <section className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white p-10 text-center">
            <Layers3 className="mx-auto size-10 text-[#94A3B8]" />
            <p className="mt-3 font-medium text-[#0F172A]">
              Chưa có kết quả phân cụm thuần nhất
            </p>
            <p className="mt-1 text-sm text-[#64748B]">
              Chọn “Phân cụm lại” để bắt đầu xử lý.
            </p>
            <Button
              className="mt-4"
              onClick={() => void rerun()}
              disabled={loading || building || isWorkerUser}
            >
              <RefreshCw /> Phân cụm lại
            </Button>
          </section>
        )}

        {!building && clusters.length > 0 && (
          <section
            className="overflow-hidden rounded-xl border border-[#C7D7FE] bg-white shadow-[0_2px_10px_rgba(0,82,255,0.04)]"
            aria-label="Tiến độ lập hồ sơ tạm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DCE6FF] bg-gradient-to-r from-[#EEF2FF] to-[#F8FAFF] px-4 py-2.5 sm:px-5">
              <div className="flex items-center gap-2.5">
                <span className="flex size-7 items-center justify-center rounded-lg bg-[#EAF1FF] text-[#0052FF]">
                  <ListChecks className="size-4" />
                </span>
                <div>
                  <p className="font-semibold text-[#0F172A]">
                    Tiến độ lập hồ sơ tạm
                  </p>
                  <p className="mt-0.5 hidden text-sm text-[#64748B]">
                    {assignedCount}/{clusters.length} cụm đã được xếp vào hồ sơ
                    tạm.
                  </p>
                </div>
              </div>
              <span className="text-lg font-bold text-[#0052FF] tabular-nums">
                {assignmentProgressPercentage}%
              </span>
            </div>
            <div className="px-4 py-2.5 sm:px-5">
              <div
                className="h-1.5 overflow-hidden rounded-full bg-[#E2E8F0]"
                role="progressbar"
                aria-label="Tiến độ lập hồ sơ tạm từ các cụm"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={assignmentProgressPercentage}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] transition-[width] duration-500"
                  style={{ width: `${assignmentProgressPercentage}%` }}
                />
              </div>
              <p className="mt-2 hidden text-xs text-[#64748B]">
                {assignmentProgressPercentage === 100
                  ? "Tất cả cụm đã được xếp vào hồ sơ tạm."
                  : `Còn ${clusters.length - assignedCount} cụm cần được xếp.`}
              </p>
            </div>
          </section>
        )}

        {!building && clusters.length > 0 && (
          <section className="space-y-4" aria-label="Danh sách cụm tài liệu">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-[#0F172A]">
                  Danh sách cụm tài liệu
                </h2>
                <p className="mt-1 text-xs text-[#64748B]">
                  Hiển thị {paginatedClusters.length}/{clusters.length} cụm · đã
                  chọn {selectedClusterIds.size} cụm.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={togglePageSelection}
                  disabled={
                    selectablePageClusterIds.length === 0 || isWorkerUser
                  }
                >
                  <ListChecks />
                  {allPageClustersSelected
                    ? "Bỏ chọn trang này"
                    : "Chọn cụm chưa xếp ở trang này"}
                </Button>
                <Button
                  size="sm"
                  onClick={() => void createDossierFromSelection()}
                  disabled={
                    selectedClusterIds.size === 0 ||
                    bulkCreating ||
                    isWorkerUser
                  }
                >
                  {bulkCreating ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <FolderPlus />
                  )}
                  Tạo hồ sơ tạm ({selectedClusterIds.size})
                </Button>
                {selectedClusterIds.size > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedClusterIds(new Set())}
                  >
                    Bỏ chọn
                  </Button>
                )}
                <ClusterPagination
                  page={visibleClusterPage}
                  pageCount={clusterPageCount}
                  onPageChange={setClusterPage}
                />
              </div>
            </div>

            <div className="grid items-stretch gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {paginatedClusters.map(({ cluster, originalIndex }) => {
                const owner = occupiedByCluster.get(cluster.cluster_id)
                const documentCount =
                  cluster.statistics?.document_count ??
                  cluster.document_ids.length
                const isBusy = busyCluster === cluster.cluster_id
                const isOpening = loadingCluster === cluster.cluster_id
                const selected = selectedClusterIds.has(cluster.cluster_id)
                return (
                  <article
                    key={cluster.cluster_id}
                    onClick={(event) => {
                      if (owner || isWorkerUser) return
                      const target = event.target as HTMLElement
                      if (
                        target.closest(
                          "button, input, select, option, a, label"
                        )
                      ) {
                        return
                      }
                      toggleClusterSelection(cluster.cluster_id)
                    }}
                    className={`flex flex-col overflow-hidden rounded-xl border bg-white shadow-[0_2px_8px_rgba(15,23,42,0.045)] transition ${
                      selected
                        ? "cursor-pointer border-[#0052FF] ring-1 ring-[#0052FF]/15"
                        : owner || isWorkerUser
                          ? "border-[#D9E2F1]"
                          : "cursor-pointer border-[#D9E2F1] hover:border-[#8EABF8] hover:shadow-[0_4px_12px_rgba(15,23,42,0.07)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 border-b border-[#E2E8F0] bg-[#FBFCFF] px-3.5 py-3">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[#E8EEFF] text-sm font-bold text-[#0052FF]">
                          {originalIndex + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <h3 className="font-semibold text-[#0F172A]">
                              Cụm {String(originalIndex + 1).padStart(2, "0")}
                            </h3>
                            <span className="rounded-md bg-[#EEF2F7] px-2 py-0.5 text-[11px] font-semibold text-[#475569] tabular-nums">
                              {documentCount} tài liệu
                            </span>
                            <span className="rounded-md bg-[#E8EEFF] px-2 py-0.5 text-[11px] font-semibold text-[#0052FF] tabular-nums">
                              Độ tin cậy {formatPercent(cluster.cohesion_mean)}
                            </span>
                          </div>
                        </div>
                      </div>
                      {owner ? (
                        <Badge className="shrink-0 bg-emerald-50 text-emerald-700">
                          <Check />
                          {owner.status === "promoted"
                            ? "Đã thành hồ sơ"
                            : "Đã xếp"}
                        </Badge>
                      ) : (
                        <label
                          className="flex size-7 shrink-0 cursor-pointer items-center justify-center"
                          title={`Chọn cụm ${originalIndex + 1}`}
                        >
                          <input
                            type="checkbox"
                            className="size-4 border-[#94A3B8] accent-[#0052FF]"
                            checked={selected}
                            onChange={() =>
                              toggleClusterSelection(cluster.cluster_id)
                            }
                            disabled={isWorkerUser}
                            aria-label={`Chọn cụm ${originalIndex + 1}`}
                          />
                        </label>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col px-3.5 py-3">
                      <div className="rounded-lg border border-[#E2E8F0] bg-[#FBFCFF] px-3 py-2.5">
                        <p className="text-[10px] font-semibold tracking-[0.08em] text-[#64748B] uppercase">
                          Nội dung cụm
                        </p>
                        <p className="mt-1 line-clamp-3 text-sm leading-5 font-medium text-[#0F172A]">
                          {normalizeClusterContentSummary(
                            cluster.content_summary
                          )}
                        </p>
                      </div>

                      <div className="mt-auto border-t border-[#E8EDF5] pt-2.5 text-xs text-[#64748B]">
                        <p className="flex items-center gap-1.5 font-medium">
                          <CalendarDays className="size-3.5 text-[#0052FF]" />
                          {dateRange(cluster.start_date, cluster.end_date)}
                        </p>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2.5 w-full border-[#AFC4FF] text-[#0052FF] hover:bg-[#EEF2FF]"
                        onClick={() =>
                          void openDocuments(cluster.cluster_id, cluster)
                        }
                        disabled={isOpening}
                      >
                        {isOpening ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <Eye />
                        )}
                        Xem chi tiết cụm
                      </Button>
                    </div>

                    {owner ? (
                      <footer className="mt-auto border-t border-[#E2E8F0] bg-[#F8FAFC] p-2.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-emerald-300 bg-white text-emerald-800"
                          onClick={() =>
                            navigate(homogeneousWorkflowRoute(sessionId, 5))
                          }
                        >
                          <FolderCheck />
                          {owner.status === "promoted"
                            ? "Xem hồ sơ đã chuyển"
                            : "Mở hồ sơ tạm"}
                        </Button>
                      </footer>
                    ) : (
                      <footer className="mt-auto border-t border-[#E2E8F0] bg-[#F8FAFC] p-2.5">
                        <div className="space-y-2">
                          <Button
                            className="w-full"
                            onClick={() =>
                              void createDossier(cluster.cluster_id)
                            }
                            disabled={isBusy || isWorkerUser}
                          >
                            {isBusy ? (
                              <Loader2 className="animate-spin" />
                            ) : (
                              <FolderPlus />
                            )}
                            Tạo hồ sơ tạm mới
                          </Button>
                          {draftDossiers.length > 0 && (
                            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                              <select
                                id={`dossier-${cluster.cluster_id}`}
                                className="h-9 min-w-0 rounded-lg border border-[#CBD5E1] bg-white px-2.5 text-xs text-[#0F172A] outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/20"
                                value={
                                  selectedDossier[cluster.cluster_id] ?? ""
                                }
                                onChange={(event) =>
                                  setSelectedDossier((current) => ({
                                    ...current,
                                    [cluster.cluster_id]: event.target.value,
                                  }))
                                }
                                aria-label="Chọn hồ sơ tạm đích"
                              >
                                <option value="">Chọn hồ sơ tạm...</option>
                                {draftDossiers.map((dossier) => (
                                  <option key={dossier.id} value={dossier.id}>
                                    Hồ sơ tạm #{dossier.id}
                                  </option>
                                ))}
                              </select>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  void addToDossier(cluster.cluster_id)
                                }
                                disabled={
                                  !selectedDossier[cluster.cluster_id] ||
                                  isBusy ||
                                  isWorkerUser
                                }
                              >
                                Ghép
                              </Button>
                            </div>
                          )}
                        </div>
                      </footer>
                    )}
                  </article>
                )
              })}
            </div>

            <div className="flex justify-end border-t border-[#CBD5E1] pt-5">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() =>
                    navigate(homogeneousWorkflowRoute(sessionId, 5))
                  }
                >
                  <Layers3 />
                  {compositionCompleted
                    ? `Hồ sơ đã chuyển (${promotedDossiers.length})`
                    : `Hồ sơ tạm (${provisional.length})`}
                </Button>
              </div>
            </div>
          </section>
        )}
      </main>

      <HomogeneousDocumentReviewDialog
        sessionId={sessionId}
        cluster={reviewCluster}
        open={reviewOpen}
        onOpenChange={handleReviewOpenChange}
        neighbors={
          reviewCluster
            ? (neighborsByCluster[reviewCluster.cluster_id] ?? [])
            : []
        }
        neighborsLoading={neighborsLoading}
        dossierRecommendations={
          reviewCluster
            ? (dossierRecommendationsByCluster[reviewCluster.cluster_id] ?? [])
            : []
        }
        provisionalDossiers={draftDossiers}
        owner={
          reviewCluster
            ? (occupiedByCluster.get(reviewCluster.cluster_id) ?? null)
            : null
        }
        assignmentBusy={
          Boolean(reviewCluster) && busyCluster === reviewCluster?.cluster_id
        }
        clusterIndex={reviewClusterIndex}
        clusterCount={orderedClusters.length}
        onPreviousCluster={
          reviewClusterIndex > 0
            ? () =>
                void openDocuments(
                  orderedClusters[reviewClusterIndex - 1].cluster.cluster_id,
                  orderedClusters[reviewClusterIndex - 1].cluster
                )
            : undefined
        }
        onNextCluster={
          reviewClusterIndex >= 0 &&
          reviewClusterIndex < orderedClusters.length - 1
            ? () =>
                void openDocuments(
                  orderedClusters[reviewClusterIndex + 1].cluster.cluster_id,
                  orderedClusters[reviewClusterIndex + 1].cluster
                )
            : undefined
        }
        onLoadClusterDetail={loadClusterDetail}
        clusterNavigationLoading={loadingCluster !== null}
        readOnly={isWorkerUser}
        onCreateDossier={
          reviewCluster
            ? (clusterIds) => createDossierFromClusters(clusterIds)
            : undefined
        }
        onAddToDossier={
          reviewCluster
            ? (dossierId, clusterIds) =>
                addClustersToDossier(clusterIds, dossierId)
            : undefined
        }
        onOpenNeighbor={(clusterId) => void openDocuments(clusterId)}
      />
    </div>
  )
}

function ClusterMetric({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="flex min-h-16 min-w-0 flex-col justify-center rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-center shadow-sm">
      <dt className="font-roboto text-[10px] font-semibold tracking-[0.12em] text-[#64748B] uppercase">
        {label}
      </dt>
      <dd className="font-roboto text-xl leading-6 font-semibold text-[#0F172A] tabular-nums">
        {value}
      </dd>
    </div>
  )
}

function ClusterPagination({
  page,
  pageCount,
  onPageChange,
}: {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
}) {
  return (
    <nav
      className="flex items-center gap-2 rounded-xl border border-[#D9E2F1] bg-white p-1 shadow-sm"
      aria-label="Phân trang cụm tài liệu"
    >
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        aria-label="Trang trước"
      >
        <ChevronLeft />
      </Button>
      <span className="min-w-24 text-center text-xs font-medium text-[#475569] tabular-nums">
        Trang {page}/{pageCount}
      </span>
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={() => onPageChange(Math.min(pageCount, page + 1))}
        disabled={page >= pageCount}
        aria-label="Trang sau"
      >
        <ChevronRight />
      </Button>
    </nav>
  )
}

function formatPercent(value: number | null | undefined) {
  return value == null ? "—" : `${Math.round(value * 100)}%`
}

function dateRange(
  start: string | null | undefined,
  end: string | null | undefined
) {
  if (!start && !end) return "Chưa xác định thời gian"
  if (!start || start === end) return start || end || "—"
  return `${start} – ${end}`
}
