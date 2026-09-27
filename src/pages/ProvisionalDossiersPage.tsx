import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  FolderCheck,
  Loader2,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/features/auth/lib/AuthContext"
import {
  listProvisionalDossiers,
  promoteAllProvisionalDossiers,
  promoteProvisionalDossier,
  promoteSelectedProvisionalDossiers,
  removeClusterFromProvisionalDossier,
  type ProvisionalDossier,
  type ProvisionalDossierCluster,
  type SessionClusterSummary,
} from "@/features/upload/api/sessionApi"
import { HomogeneousDocumentReviewDialog } from "@/features/upload/components/HomogeneousDocumentReviewDialog"
import { useHomogeneousClusterDetailCache } from "@/features/upload/hooks/useHomogeneousClusterDetailCache"
import { prefetchDocumentPreview } from "@/features/upload/lib/documentPreviewCache"
import { UploadPageHeader } from "@/pages/UploadPage.header"
import { SessionWorkflowContext } from "@/pages/SessionWorkflowContext"
import {
  HOMOGENEOUS_WORKFLOW_LABELS,
  homogeneousWorkflowRoute,
  markHomogeneousWorkflow,
} from "@/pages/homogeneousWorkflow"
import { cn } from "@/shared/lib/utils"

const DOSSIERS_PER_PAGE = 4

export function ProvisionalDossiersPage() {
  const { sessionId = "" } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isWorkerUser =
    String(user?.role ?? "")
      .trim()
      .toLowerCase() === "worker"
  const [dossiers, setDossiers] = useState<ProvisionalDossier[]>([])
  const [reviewCluster, setReviewCluster] =
    useState<SessionClusterSummary | null>(null)
  const [reviewDossierId, setReviewDossierId] = useState<number | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const openClusterRequestRef = useRef(0)
  const [loadingCluster, setLoadingCluster] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [unassignedClusterCount, setUnassignedClusterCount] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [dossierPage, setDossierPage] = useState(1)
  const [selectedDossierIds, setSelectedDossierIds] = useState<Set<number>>(
    () => new Set()
  )
  const [expandedDossierIds, setExpandedDossierIds] = useState<Set<number>>(
    () => new Set()
  )
  const {
    getCached: getCachedClusterDetail,
    loadClusterDetail,
    prefetchClusterDetails,
  } = useHomogeneousClusterDetailCache(
    sessionId,
    dossiers[0]?.source_cluster_version_id ?? ""
  )

  useEffect(() => markHomogeneousWorkflow(sessionId), [sessionId])

  const load = useCallback(async () => {
    if (!sessionId) return
    const response = await listProvisionalDossiers(sessionId)
    setDossiers(response.dossiers)
    setUnassignedClusterCount(
      response.composition?.unassigned_cluster_count ?? 0
    )
    const draftIds = new Set(
      response.dossiers
        .filter((item) => item.status === "draft")
        .map((item) => item.id)
    )
    setSelectedDossierIds(
      (current) => new Set([...current].filter((id) => draftIds.has(id)))
    )
  }, [sessionId])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        await load()
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : "Không tải được hồ sơ tạm."
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [load])

  const removeCluster = async (dossierId: number, clusterId: string) => {
    if (!sessionId) return
    setBusy(`remove-${clusterId}`)
    try {
      await removeClusterFromProvisionalDossier(sessionId, dossierId, clusterId)
      toast.success("Đã đưa cụm ra khỏi hồ sơ tạm.")
      await load()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Không thể đưa cụm ra khỏi hồ sơ."
      )
    } finally {
      setBusy(null)
    }
  }

  const openDocuments = async (dossierId: number, clusterId: string) => {
    if (!sessionId) return
    const requestId = ++openClusterRequestRef.current
    const dossier = dossiers.find((item) => item.id === dossierId)
    const clusterSummary = dossier?.clusters.find(
      (item) => item.cluster_id === clusterId
    )
    const cached = getCachedClusterDetail(clusterId)
    const fallback =
      dossier && clusterSummary
        ? provisionalClusterFallback(dossier, clusterSummary)
        : null

    if (dossier) {
      prefetchClusterDetails(dossier.clusters.map((item) => item.cluster_id))
      const clusterIndex = dossier.clusters.findIndex(
        (item) => item.cluster_id === clusterId
      )
      const followingCluster = dossier.clusters[clusterIndex + 1]
      if (followingCluster) {
        void loadClusterDetail(followingCluster.cluster_id)
          .then((followingDetail) => {
            prefetchDocumentPreview(
              sessionId,
              followingDetail?.placements[0]?.session_document_id,
              "dossier_review"
            )
          })
          .catch(() => undefined)
      }
    }

    setReviewDossierId(dossierId)
    setReviewCluster(cached ?? fallback)
    setReviewOpen(true)
    if (cached) {
      return
    }
    setLoadingCluster(clusterId)
    try {
      const detail = await loadClusterDetail(clusterId)
      if (openClusterRequestRef.current !== requestId) return
      if (!detail) throw new Error("Không tìm thấy thông tin cụm.")
      setReviewCluster(detail)
    } catch (error) {
      if (openClusterRequestRef.current !== requestId) return
      toast.error(
        error instanceof Error ? error.message : "Không tải được tài liệu."
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
      setReviewDossierId(null)
    }
    setReviewOpen(nextOpen)
  }

  const promoteOne = async (dossierId: number) => {
    if (!sessionId) return
    setBusy(`promote-${dossierId}`)
    try {
      await promoteProvisionalDossier(sessionId, dossierId)
      toast.success("Đã ghi nhận hồ sơ. Hồ sơ đang chờ bạn cập nhật kết quả.")
      navigate(homogeneousWorkflowRoute(sessionId, 6))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không thể ghi nhận hồ sơ."
      )
    } finally {
      setBusy(null)
    }
  }

  const promoteAll = async () => {
    if (!sessionId) return
    setBusy("promote-all")
    try {
      await promoteAllProvisionalDossiers(sessionId)
      toast.success(
        "Đã ghi nhận toàn bộ hồ sơ. Hãy cập nhật hồ sơ tại màn hình kết quả."
      )
      navigate(homogeneousWorkflowRoute(sessionId, 6))
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Không thể ghi nhận toàn bộ hồ sơ."
      )
    } finally {
      setBusy(null)
    }
  }

  const promoteSelected = async () => {
    if (!sessionId) return
    const dossierIds = dossiers
      .filter(
        (dossier) =>
          dossier.status === "draft" && selectedDossierIds.has(dossier.id)
      )
      .map((dossier) => dossier.id)
    if (dossierIds.length === 0) {
      toast.error("Chọn ít nhất một hồ sơ tạm để ghi nhận.")
      return
    }
    setBusy("promote-selected")
    try {
      await promoteSelectedProvisionalDossiers(sessionId, dossierIds)
      toast.success(
        `Đã ghi nhận ${dossierIds.length} hồ sơ. Hãy cập nhật hồ sơ tại màn hình kết quả.`
      )
      navigate(homogeneousWorkflowRoute(sessionId, 6))
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Không thể ghi nhận các hồ sơ đã chọn."
      )
    } finally {
      setBusy(null)
    }
  }

  const drafts = dossiers.filter((item) => item.status === "draft")
  const promoted = dossiers.filter((item) => item.status === "promoted")
  const selectedDraftCount = drafts.reduce(
    (count, dossier) => count + (selectedDossierIds.has(dossier.id) ? 1 : 0),
    0
  )
  const allDraftsSelected =
    drafts.length > 0 && selectedDraftCount === drafts.length
  const compositionCompleted =
    dossiers.length > 0 && promoted.length === dossiers.length
  const promotionProgressPercentage =
    dossiers.length > 0
      ? Math.min(100, Math.round((promoted.length / dossiers.length) * 100))
      : 0
  const dossierDocumentCount = useMemo(
    () =>
      dossiers.reduce(
        (sum, dossier) => sum + Number(dossier.statistics.document_count ?? 0),
        0
      ),
    [dossiers]
  )
  const assignedClusterCount = useMemo(
    () =>
      dossiers.reduce(
        (sum, dossier) =>
          sum +
          Number(dossier.statistics.cluster_count ?? dossier.clusters.length),
        0
      ),
    [dossiers]
  )
  const dossierPageCount = Math.max(
    1,
    Math.ceil(dossiers.length / DOSSIERS_PER_PAGE)
  )
  const visibleDossierPage = Math.min(dossierPage, dossierPageCount)
  const paginatedDossiers = useMemo(
    () =>
      dossiers.slice(
        (visibleDossierPage - 1) * DOSSIERS_PER_PAGE,
        visibleDossierPage * DOSSIERS_PER_PAGE
      ),
    [dossiers, visibleDossierPage]
  )

  useEffect(() => {
    prefetchClusterDetails(
      paginatedDossiers
        .map((dossier) => dossier.clusters[0]?.cluster_id ?? "")
        .filter(Boolean)
    )
  }, [paginatedDossiers, prefetchClusterDetails])
  const firstVisibleDossier =
    dossiers.length === 0 ? 0 : (visibleDossierPage - 1) * DOSSIERS_PER_PAGE + 1
  const lastVisibleDossier = Math.min(
    visibleDossierPage * DOSSIERS_PER_PAGE,
    dossiers.length
  )
  const reviewDossier =
    dossiers.find((dossier) => dossier.id === reviewDossierId) ?? null
  const reviewClusterIndex =
    reviewDossier && reviewCluster
      ? reviewDossier.clusters.findIndex(
          (cluster) => cluster.cluster_id === reviewCluster.cluster_id
        )
      : -1

  return (
    <div className="min-h-svh bg-[#F0F4F8]">
      <UploadPageHeader
        currentStep={5}
        highestVisitedStep={promoted.length > 0 ? 6 : 5}
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
          onBack={() => navigate(homogeneousWorkflowRoute(sessionId, 4))}
        />

        <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-4xl min-w-0">
            <h1 className="font-sans text-2xl font-semibold tracking-normal text-[#0F172A]">
              {compositionCompleted
                ? "Hồ sơ đã ghi nhận, chờ cập nhật"
                : "Hồ sơ tạm từ các cụm"}
            </h1>
            <p className="mt-1 text-sm leading-6 text-[#475569]">
              {compositionCompleted
                ? "Các hồ sơ đã được ghi nhận. Sang màn hình kết quả và chọn Cập nhật hồ sơ để tiếp tục xử lý."
                : "Kiểm tra nội dung, chọn các hồ sơ cần ghi nhận rồi cập nhật một lượt tại màn hình kết quả."}
            </p>
          </div>
          <div className="ml-auto flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:items-end">
            <dl className="grid w-full grid-cols-3 gap-2 sm:w-auto">
              <WorkflowMetric
                label={compositionCompleted ? "Hồ sơ" : "Hồ sơ tạm"}
                value={dossiers.length}
              />
              <WorkflowMetric label="Cụm" value={assignedClusterCount} />
              <WorkflowMetric label="Tài liệu" value={dossierDocumentCount} />
            </dl>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {promoted.length > 0 && (
                <Button
                  variant="outline"
                  className="rounded-lg border-[#CBD5E1] bg-white text-[#334155] shadow-sm hover:border-[#AFC4FF] hover:bg-[#F8FAFF] hover:text-[#0052FF]"
                  onClick={() =>
                    navigate(homogeneousWorkflowRoute(sessionId, 6))
                  }
                >
                  <Eye /> Xem kết quả
                </Button>
              )}
              {drafts.length > 0 && (
                <Button
                  className="rounded-lg shadow-sm"
                  onClick={() => void promoteAll()}
                  disabled={
                    unassignedClusterCount > 0 || busy !== null || isWorkerUser
                  }
                >
                  {busy === "promote-all" ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <CheckCircle2 />
                  )}
                  Ghi nhận tất cả
                </Button>
              )}
            </div>
          </div>
        </section>

        {!loading && dossiers.length > 0 && (
          <section
            className="overflow-hidden rounded-xl border border-[#C7D7FE] bg-white shadow-[0_2px_10px_rgba(0,82,255,0.04)]"
            aria-label="Tiến độ ghi nhận hồ sơ tạm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DCE6FF] bg-gradient-to-r from-[#EEF2FF] to-[#F8FAFF] px-4 py-2.5 sm:px-5">
              <div className="flex items-center gap-2.5">
                <span className="flex size-7 items-center justify-center rounded-lg bg-[#EAF1FF] text-[#0052FF]">
                  <CheckCircle2 className="size-4" />
                </span>
                <div>
                  <p className="font-semibold text-[#0F172A]">
                    Tiến độ ghi nhận hồ sơ
                  </p>
                  <p className="mt-0.5 hidden text-sm text-[#64748B]">
                    {promoted.length}/{dossiers.length} hồ sơ tạm đã được ghi
                    nhận và đang chờ cập nhật.
                  </p>
                </div>
              </div>
              <span className="text-lg font-bold text-[#0052FF] tabular-nums">
                {promotionProgressPercentage}%
              </span>
            </div>
            <div className="px-4 py-2.5 sm:px-5">
              <div
                className="h-1.5 overflow-hidden rounded-full bg-[#E2E8F0]"
                role="progressbar"
                aria-label="Tiến độ ghi nhận hồ sơ tạm"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={promotionProgressPercentage}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#0052FF] to-[#4D7CFF] transition-[width] duration-500"
                  style={{ width: `${promotionProgressPercentage}%` }}
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748B]">
                <span className="hidden">
                  {unassignedClusterCount > 0
                    ? `Còn ${unassignedClusterCount} cụm cần được xếp trước khi chuyển tiếp.`
                    : promotionProgressPercentage === 100
                      ? "Đã ghi nhận toàn bộ hồ sơ tạm."
                      : "Các hồ sơ tạm đã sẵn sàng để ghi nhận."}
                </span>
                {unassignedClusterCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 border-[#CBD5E1] bg-white px-2.5 text-xs text-[#334155]"
                    onClick={() =>
                      navigate(homogeneousWorkflowRoute(sessionId, 4))
                    }
                  >
                    Xếp các cụm còn lại
                  </Button>
                )}
              </div>
            </div>
          </section>
        )}

        {loading && (
          <div className="flex items-center gap-3 rounded-xl border border-[#D9E2F1] bg-white p-4 text-sm text-[#64748B]">
            <Loader2 className="size-4 animate-spin text-[#0052FF]" />
            Đang tải hồ sơ tạm...
          </div>
        )}

        {!loading && dossiers.length === 0 && (
          <section className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white p-10 text-center">
            <FolderCheck className="mx-auto size-10 text-[#94A3B8]" />
            <p className="mt-3 font-medium text-[#0F172A]">Chưa có hồ sơ tạm</p>
            <p className="mt-1 text-sm text-[#64748B]">
              Quay lại màn hình phân cụm để tạo hồ sơ từ các cụm phù hợp.
            </p>
            <Button
              className="mt-4"
              onClick={() => navigate(homogeneousWorkflowRoute(sessionId, 4))}
            >
              Quay lại phân cụm
            </Button>
          </section>
        )}

        <section className="space-y-5" aria-label="Danh sách hồ sơ tạm">
          {!loading && dossiers.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-[#0F172A]">
                  {compositionCompleted
                    ? "Cấu trúc hồ sơ đã ghi nhận"
                    : "Danh sách hồ sơ tạm"}
                </h2>
                <p className="mt-1 text-xs text-[#64748B]">
                  Hiển thị {firstVisibleDossier}–{lastVisibleDossier}/
                  {dossiers.length} hồ sơ.
                </p>
              </div>
              <DossierPagination
                page={visibleDossierPage}
                pageCount={dossierPageCount}
                onPageChange={setDossierPage}
              />
            </div>
          )}

          {!loading && drafts.length > 0 && (
            <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 rounded-xl border border-[#D9E2F1] bg-white px-4 py-2.5 shadow-sm">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[#334155]">
                <input
                  type="checkbox"
                  className="size-4 accent-[#0052FF]"
                  checked={allDraftsSelected}
                  disabled={busy !== null || isWorkerUser}
                  onChange={(event) =>
                    setSelectedDossierIds(
                      event.target.checked
                        ? new Set(drafts.map((dossier) => dossier.id))
                        : new Set()
                    )
                  }
                />
                Chọn tất cả {drafts.length} hồ sơ tạm
              </label>
              <div className="flex flex-wrap items-center gap-3">
                {selectedDraftCount > 0 ? (
                  <>
                    <span className="text-sm text-[#475569]">
                      Đã chọn <strong>{selectedDraftCount}</strong> hồ sơ
                    </span>
                    <Button
                      className="rounded-lg shadow-sm"
                      onClick={() => void promoteSelected()}
                      disabled={busy !== null || isWorkerUser}
                    >
                      {busy === "promote-selected" ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <CheckCircle2 />
                      )}
                      Ghi nhận {selectedDraftCount} hồ sơ
                    </Button>
                  </>
                ) : (
                  <span className="text-sm text-[#64748B]">
                    Chọn hồ sơ để ghi nhận một lượt
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="grid items-start gap-5 lg:grid-cols-2">
            {paginatedDossiers.map((dossier, dossierIndex) => {
              const isDraft = dossier.status === "draft"
              const displayIndex =
                (visibleDossierPage - 1) * DOSSIERS_PER_PAGE + dossierIndex + 1
              const isExpanded = expandedDossierIds.has(dossier.id)
              return (
                <article
                  key={dossier.id}
                  className={cn(
                    "self-start overflow-hidden rounded-2xl bg-white transition-shadow",
                    isDraft
                      ? "border border-[#C7D7FE] shadow-[0_8px_24px_rgba(15,23,42,0.08)] hover:shadow-[0_12px_30px_rgba(15,23,42,0.11)]"
                      : "border border-emerald-300 shadow-[0_8px_24px_rgba(5,150,105,0.09)] hover:shadow-[0_12px_30px_rgba(5,150,105,0.12)]"
                  )}
                >
                  <div
                    className={`border-b-2 px-5 py-4 sm:px-6 ${
                      isDraft
                        ? "border-[#BFD0FF] bg-gradient-to-br from-[#F8FAFF] to-[#EEF3FF]"
                        : "border-emerald-300 bg-gradient-to-br from-emerald-50 to-[#ECFDF5]"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {isDraft && (
                            <input
                              type="checkbox"
                              className="mr-1 size-4 accent-[#0052FF]"
                              checked={selectedDossierIds.has(dossier.id)}
                              disabled={busy !== null || isWorkerUser}
                              onChange={(event) =>
                                setSelectedDossierIds((current) => {
                                  const next = new Set(current)
                                  if (event.target.checked) next.add(dossier.id)
                                  else next.delete(dossier.id)
                                  return next
                                })
                              }
                              aria-label={`Chọn hồ sơ tạm ${dossier.id}`}
                            />
                          )}
                          <span className="flex size-8 items-center justify-center rounded-lg bg-[#E8EEFF] text-sm font-bold text-[#0052FF]">
                            {displayIndex}
                          </span>
                          <h2 className="font-semibold text-[#0F172A]">
                            {isDraft ? "Hồ sơ tạm" : "Hồ sơ đã ghi nhận"} #
                            {dossier.id}
                          </h2>
                          <Badge
                            variant={isDraft ? "secondary" : "outline"}
                            className={
                              isDraft
                                ? undefined
                                : "border-emerald-300 bg-white text-emerald-800"
                            }
                          >
                            {isDraft ? "Đang biên soạn" : "Chờ cập nhật hồ sơ"}
                          </Badge>
                        </div>
                        <p className="mt-3 line-clamp-2 max-w-5xl text-sm leading-6 text-[#334155]">
                          {dossier.content_summary}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#64748B]">
                          <span>
                            {dossier.statistics.cluster_count ??
                              dossier.clusters.length}{" "}
                            cụm
                          </span>
                          <span>
                            {dossier.statistics.document_count ?? 0} tài liệu
                          </span>
                          <span>
                            Độ thuần nhất{" "}
                            {formatPercent(
                              dossier.statistics.cohesion_mean as number | null
                            )}
                          </span>
                          <span>
                            {dateRange(
                              dossier.statistics.start_date as string | null,
                              dossier.statistics.end_date as string | null
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          className={cn(
                            "rounded-lg bg-white shadow-sm",
                            isDraft
                              ? "border-[#AFC4FF] text-[#0052FF] hover:bg-[#EEF2FF]"
                              : "border-emerald-200 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
                          )}
                          onClick={() => {
                            const firstCluster = dossier.clusters[0]
                            if (firstCluster) {
                              void openDocuments(
                                dossier.id,
                                firstCluster.cluster_id
                              )
                            }
                          }}
                          disabled={
                            dossier.clusters.length === 0 ||
                            loadingCluster !== null
                          }
                        >
                          {loadingCluster !== null &&
                          reviewDossierId === dossier.id ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <Eye />
                          )}
                          Xem hồ sơ
                        </Button>
                        {isDraft && (
                          <Button
                            onClick={() => void promoteOne(dossier.id)}
                            disabled={busy !== null || isWorkerUser}
                          >
                            {busy === `promote-${dossier.id}` ? (
                              <Loader2 className="animate-spin" />
                            ) : (
                              <CheckCircle2 />
                            )}
                            Ghi nhận hồ sơ này
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end border-b border-[#CBD5E1] bg-white px-5 py-3 sm:px-6">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setExpandedDossierIds((current) => {
                          const next = new Set(current)
                          if (next.has(dossier.id)) next.delete(dossier.id)
                          else next.add(dossier.id)
                          return next
                        })
                      }
                      aria-expanded={isExpanded}
                      aria-controls={`dossier-clusters-${dossier.id}`}
                    >
                      {isExpanded ? <ChevronUp /> : <ChevronDown />}
                      {isExpanded
                        ? "Ẩn danh sách cụm"
                        : `Xem ${dossier.clusters.length} cụm tài liệu`}
                    </Button>
                  </div>

                  {isExpanded && (
                    <div
                      id={`dossier-clusters-${dossier.id}`}
                      className="space-y-3 bg-[#F1F5F9] p-5 sm:p-6"
                    >
                      {dossier.clusters.map((cluster, clusterIndex) => (
                        <div
                          key={cluster.cluster_id}
                          className="rounded-xl border border-[#CBD5E1] bg-white px-4 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)]"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="flex size-7 items-center justify-center rounded-lg bg-[#F1F5F9] text-xs font-bold text-[#475569]">
                                  {clusterIndex + 1}
                                </span>
                                <p className="font-medium text-[#0F172A]">
                                  Cụm tài liệu{" "}
                                  {String(clusterIndex + 1).padStart(2, "0")}
                                </p>
                                <Badge variant="secondary">
                                  {cluster.document_count} tài liệu
                                </Badge>
                                <Badge variant="outline">
                                  Tương đồng{" "}
                                  {formatPercent(cluster.cohesion_mean)}
                                </Badge>
                              </div>
                              <p className="mt-3 text-sm leading-6 text-[#475569]">
                                {cluster.content_summary ||
                                  "Nhóm tài liệu có nội dung tương đồng."}
                              </p>
                            </div>
                            {isDraft && dossier.clusters.length > 1 && (
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                title="Đưa cụm ra khỏi hồ sơ"
                                aria-label="Đưa cụm ra khỏi hồ sơ"
                                onClick={() =>
                                  void removeCluster(
                                    dossier.id,
                                    cluster.cluster_id
                                  )
                                }
                                disabled={
                                  busy === `remove-${cluster.cluster_id}` ||
                                  isWorkerUser
                                }
                              >
                                {busy === `remove-${cluster.cluster_id}` ? (
                                  <Loader2 className="animate-spin" />
                                ) : (
                                  <Trash2 />
                                )}
                              </Button>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            className="mt-3 border-[#AFC4FF] text-[#0052FF] hover:bg-[#EEF2FF]"
                            onClick={() =>
                              void openDocuments(dossier.id, cluster.cluster_id)
                            }
                            disabled={loadingCluster === cluster.cluster_id}
                          >
                            {loadingCluster === cluster.cluster_id ? (
                              <Loader2 className="animate-spin" />
                            ) : (
                              <Eye />
                            )}
                            Xem tài liệu và metadata
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              )
            })}
          </div>

          {dossierPageCount > 1 && dossiers.length > 0 && (
            <div className="flex justify-end pt-1">
              <DossierPagination
                page={visibleDossierPage}
                pageCount={dossierPageCount}
                onPageChange={setDossierPage}
              />
            </div>
          )}
        </section>
      </main>

      <HomogeneousDocumentReviewDialog
        sessionId={sessionId}
        cluster={reviewCluster}
        open={reviewOpen}
        onOpenChange={handleReviewOpenChange}
        owner={reviewDossier}
        clusterIndex={reviewClusterIndex}
        clusterCount={reviewDossier?.clusters.length ?? 0}
        clusterNavigationLoading={loadingCluster !== null}
        onPreviousCluster={
          reviewDossier && reviewClusterIndex > 0
            ? () =>
                void openDocuments(
                  reviewDossier.id,
                  reviewDossier.clusters[reviewClusterIndex - 1].cluster_id
                )
            : undefined
        }
        onNextCluster={
          reviewDossier &&
          reviewClusterIndex >= 0 &&
          reviewClusterIndex < reviewDossier.clusters.length - 1
            ? () =>
                void openDocuments(
                  reviewDossier.id,
                  reviewDossier.clusters[reviewClusterIndex + 1].cluster_id
                )
            : undefined
        }
        onSelectDossierCluster={
          reviewDossier
            ? (clusterId) => void openDocuments(reviewDossier.id, clusterId)
            : undefined
        }
      />
    </div>
  )
}

function DossierPagination({
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
      aria-label="Phân trang hồ sơ"
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

function WorkflowMetric({
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

function provisionalClusterFallback(
  dossier: ProvisionalDossier,
  cluster: ProvisionalDossierCluster
): SessionClusterSummary {
  return {
    id: -1,
    cluster_id: cluster.cluster_id,
    dossier_id: String(dossier.id),
    title: cluster.title,
    content_summary: cluster.content_summary,
    statistics: {
      document_count: cluster.document_count,
      start_date: dossier.statistics.start_date as string | null | undefined,
      end_date: dossier.statistics.end_date as string | null | undefined,
    },
    cohesion_mean: cluster.cohesion_mean,
    dossier: null,
    status: dossier.status,
    notes: [],
    document_ids: [],
    page_count: null,
    sheet_count: null,
    start_date: (dossier.statistics.start_date as string | null) ?? null,
    end_date: (dossier.statistics.end_date as string | null) ?? null,
    placements: [],
  }
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
