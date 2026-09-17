import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  FolderPlus,
  Layers3,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  addClusterToProvisionalDossier,
  createProvisionalDossier,
  getClusterBuildStatus,
  getHomogeneousCluster,
  getHomogeneousClusters,
  listProvisionalDossiers,
  startHomogeneousClustering,
  type ClusterVersionResponse,
  type ProvisionalDossier,
  type SessionClusterSummary,
} from "@/features/upload/api/sessionApi"

const POLL_INTERVAL_MS = 2500

export function HomogeneousClustersPage() {
  const { sessionId = "" } = useParams()
  const navigate = useNavigate()
  const [version, setVersion] = useState<ClusterVersionResponse | null>(null)
  const [provisional, setProvisional] = useState<ProvisionalDossier[]>([])
  const [compositionLocked, setCompositionLocked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [building, setBuilding] = useState(false)
  const [progress, setProgress] = useState("Đang tải kết quả phân cụm...")
  const [expanded, setExpanded] = useState<
    Record<string, SessionClusterSummary>
  >({})
  const [selectedDossier, setSelectedDossier] = useState<
    Record<string, string>
  >({})
  const [busyCluster, setBusyCluster] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!sessionId) return
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
    const homogeneousJob =
      buildStatus.active &&
      buildStatus.job?.payload.workflow_mode === "homogeneous"
    setBuilding(Boolean(homogeneousJob))
    setProgress(
      buildStatus.progress?.message ||
        (homogeneousJob
          ? "Đang phân cụm tài liệu..."
          : "Đã cập nhật kết quả mới nhất.")
    )
    return Boolean(homogeneousJob)
  }, [sessionId])

  useEffect(() => {
    let cancelled = false
    let timer: number | undefined
    const poll = async () => {
      try {
        const active = await load()
        if (!cancelled && active)
          timer = window.setTimeout(poll, POLL_INTERVAL_MS)
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
  }, [load])

  const occupiedByCluster = useMemo(() => {
    const result = new Map<string, ProvisionalDossier>()
    for (const dossier of provisional) {
      for (const cluster of dossier.clusters)
        result.set(cluster.cluster_id, dossier)
    }
    return result
  }, [provisional])
  const draftDossiers = provisional.filter((item) => item.status === "draft")

  const refresh = async () => {
    setLoading(true)
    try {
      await load()
    } finally {
      setLoading(false)
    }
  }

  const rerun = async () => {
    if (!sessionId) return
    setLoading(true)
    try {
      await startHomogeneousClustering(sessionId)
      setBuilding(true)
      setProgress("Đã gửi task phân cụm thuần nhất.")
      toast.success("Đã bắt đầu phân cụm lại.")
      window.setTimeout(() => void refresh(), 800)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không thể phân cụm lại."
      )
    } finally {
      setLoading(false)
    }
  }

  const toggleDocuments = async (cluster: SessionClusterSummary) => {
    if (expanded[cluster.cluster_id]) {
      setExpanded((current) => {
        const next = { ...current }
        delete next[cluster.cluster_id]
        return next
      })
      return
    }
    if (!sessionId) return
    try {
      const detail = await getHomogeneousCluster(sessionId, cluster.cluster_id)
      setExpanded((current) => ({ ...current, [cluster.cluster_id]: detail }))
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Không tải được tài liệu trong cụm."
      )
    }
  }

  const createDossier = async (clusterId: string) => {
    if (!sessionId) return
    setBusyCluster(clusterId)
    try {
      await createProvisionalDossier(sessionId, [clusterId])
      toast.success("Đã tạo hồ sơ tạm từ cụm tài liệu.")
      await load()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không tạo được hồ sơ tạm."
      )
    } finally {
      setBusyCluster(null)
    }
  }

  const addToDossier = async (clusterId: string) => {
    const dossierId = Number(selectedDossier[clusterId])
    if (!sessionId || !dossierId) return
    setBusyCluster(clusterId)
    try {
      await addClusterToProvisionalDossier(sessionId, dossierId, clusterId)
      toast.success("Đã ghép cụm vào hồ sơ tạm.")
      await load()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không ghép được cụm."
      )
    } finally {
      setBusyCluster(null)
    }
  }

  const clusters = version?.clusters ?? []

  return (
    <main className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-7xl space-y-6 px-5 py-6 lg:px-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Button
              variant="ghost"
              className="mb-2 -ml-2"
              onClick={() => navigate(`/sessions/${sessionId}/step/3`)}
            >
              <ArrowLeft /> Quay lại dữ liệu
            </Button>
            <h1 className="font-heading text-2xl font-semibold">
              Cụm tài liệu thuần nhất
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Mỗi card là một cụm nội dung, chưa phải hồ sơ. Hãy tạo mới hoặc
              ghép cụm vào hồ sơ tạm phù hợp.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => void rerun()}
              disabled={
                loading ||
                building ||
                draftDossiers.length > 0 ||
                compositionLocked
              }
              title={
                draftDossiers.length > 0 || compositionLocked
                  ? "Hoàn tất hồ sơ tạm hiện tại trước khi phân cụm lại"
                  : undefined
              }
            >
              <RefreshCw className={building ? "animate-spin" : ""} /> Phân cụm
              lại
            </Button>
            <Button
              onClick={() =>
                navigate(`/sessions/${sessionId}/dossiers/compose`)
              }
            >
              <Layers3 /> Xem hồ sơ tạm ({draftDossiers.length})
            </Button>
          </div>
        </header>

        {(loading || building) && (
          <div className="rounded-xl border bg-card px-4 py-3 text-sm">
            <span className="font-medium">
              {building ? "Đang xử lý" : "Đang tải"}
            </span>
            <span className="ml-2 text-muted-foreground">{progress}</span>
          </div>
        )}

        {!loading && !building && clusters.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Chưa có kết quả phân cụm thuần nhất. Hãy chọn “Phân cụm lại”.
            </CardContent>
          </Card>
        )}

        {!building && (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {clusters.map((cluster) => {
              const detail = expanded[cluster.cluster_id]
              const owner = occupiedByCluster.get(cluster.cluster_id)
              const types = Object.entries(
                cluster.statistics?.document_type_counts ?? {}
              )
              const documentCount =
                cluster.statistics?.document_count ??
                cluster.document_ids.length
              return (
                <Card key={cluster.cluster_id} className="h-fit">
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {documentCount} tài liệu
                      </Badge>
                      <Badge variant="outline">
                        Độ thuần nhất {formatPercent(cluster.cohesion_mean)}
                      </Badge>
                    </div>
                    <CardTitle className="mt-2">{cluster.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="leading-6 text-muted-foreground">
                      {cluster.content_summary || cluster.title}
                    </p>
                    <dl className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3 text-xs">
                      <div>
                        <dt className="text-muted-foreground">
                          Khoảng thời gian
                        </dt>
                        <dd className="mt-1 font-medium">
                          {dateRange(cluster.start_date, cluster.end_date)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Số trang / tờ</dt>
                        <dd className="mt-1 font-medium">
                          {cluster.page_count ?? "—"} /{" "}
                          {cluster.sheet_count ?? "—"}
                        </dd>
                      </div>
                    </dl>
                    {types.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {types.map(([name, count]) => (
                          <Badge key={name} variant="outline">
                            {name}: {count}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void toggleDocuments(cluster)}
                    >
                      {detail ? <ChevronUp /> : <ChevronDown />}
                      {detail ? "Ẩn tài liệu" : "Xem tài liệu trong cụm"}
                    </Button>
                    {detail && (
                      <div className="max-h-64 space-y-2 overflow-auto border-t pt-3">
                        {(detail.placements ?? []).map((placement) => (
                          <div
                            key={placement.id}
                            className="rounded-lg border px-3 py-2 text-xs"
                          >
                            <div className="font-medium">
                              {String(
                                placement.metadata.title ||
                                  placement.metadata.file_name ||
                                  placement.document_id
                              )}
                            </div>
                            <div className="mt-1 text-muted-foreground">
                              Tương đồng với cụm:{" "}
                              {formatPercent(placement.membership_similarity)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="flex flex-wrap gap-2">
                    {owner ? (
                      <span className="text-xs text-muted-foreground">
                        Đã thuộc hồ sơ tạm #{owner.id}
                      </span>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          onClick={() => void createDossier(cluster.cluster_id)}
                          disabled={busyCluster === cluster.cluster_id}
                        >
                          <FolderPlus /> Tạo hồ sơ tạm
                        </Button>
                        {draftDossiers.length > 0 && (
                          <>
                            <select
                              className="h-7 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs"
                              value={selectedDossier[cluster.cluster_id] ?? ""}
                              onChange={(event) =>
                                setSelectedDossier((current) => ({
                                  ...current,
                                  [cluster.cluster_id]: event.target.value,
                                }))
                              }
                            >
                              <option value="">Chọn hồ sơ tạm...</option>
                              {draftDossiers.map((dossier) => (
                                <option key={dossier.id} value={dossier.id}>
                                  #{dossier.id} · {dossier.title}
                                </option>
                              ))}
                            </select>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                void addToDossier(cluster.cluster_id)
                              }
                              disabled={
                                !selectedDossier[cluster.cluster_id] ||
                                busyCluster === cluster.cluster_id
                              }
                            >
                              Ghép
                            </Button>
                          </>
                        )}
                      </>
                    )}
                  </CardFooter>
                </Card>
              )
            })}
          </section>
        )}
      </div>
    </main>
  )
}

function formatPercent(value: number | null | undefined) {
  return value == null ? "—" : `${Math.round(value * 100)}%`
}

function dateRange(
  start: string | null | undefined,
  end: string | null | undefined
) {
  if (!start && !end) return "Chưa xác định"
  if (!start || start === end) return start || end || "—"
  return `${start} – ${end}`
}
