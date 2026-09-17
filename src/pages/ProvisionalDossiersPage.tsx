import { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Trash2,
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
import { Input } from "@/components/ui/input"
import {
  getHomogeneousCluster,
  listProvisionalDossiers,
  patchProvisionalDossier,
  promoteAllProvisionalDossiers,
  promoteProvisionalDossier,
  removeClusterFromProvisionalDossier,
  type ProvisionalDossier,
  type SessionClusterSummary,
} from "@/features/upload/api/sessionApi"

export function ProvisionalDossiersPage() {
  const { sessionId = "" } = useParams()
  const navigate = useNavigate()
  const [dossiers, setDossiers] = useState<ProvisionalDossier[]>([])
  const [titles, setTitles] = useState<Record<number, string>>({})
  const [expanded, setExpanded] = useState<
    Record<string, SessionClusterSummary>
  >({})
  const [loading, setLoading] = useState(true)
  const [unassignedClusterCount, setUnassignedClusterCount] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!sessionId) return
    const response = await listProvisionalDossiers(sessionId)
    setDossiers(response.dossiers)
    setUnassignedClusterCount(
      response.composition?.unassigned_cluster_count ?? 0
    )
    setTitles(
      Object.fromEntries(response.dossiers.map((item) => [item.id, item.title]))
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

  const saveTitle = async (dossier: ProvisionalDossier) => {
    const title = titles[dossier.id]?.trim() ?? ""
    if (!sessionId || title === dossier.title) return
    setBusy(`title-${dossier.id}`)
    try {
      await patchProvisionalDossier(sessionId, dossier.id, {
        title: title || null,
        expected_revision: dossier.revision,
      })
      toast.success("Đã cập nhật tiêu đề hồ sơ tạm.")
      await load()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không cập nhật được tiêu đề."
      )
    } finally {
      setBusy(null)
    }
  }

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

  const toggleDocuments = async (clusterId: string) => {
    if (expanded[clusterId]) {
      setExpanded((current) => {
        const next = { ...current }
        delete next[clusterId]
        return next
      })
      return
    }
    if (!sessionId) return
    try {
      const detail = await getHomogeneousCluster(sessionId, clusterId)
      setExpanded((current) => ({ ...current, [clusterId]: detail }))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không tải được tài liệu."
      )
    }
  }

  const promoteOne = async (dossierId: number) => {
    if (!sessionId) return
    setBusy(`promote-${dossierId}`)
    try {
      await promoteProvisionalDossier(sessionId, dossierId)
      toast.success(
        "Đã chuyển hồ sơ tạm và bắt đầu cập nhật kết quả chính thức."
      )
      navigate(`/sessions/${encodeURIComponent(sessionId)}/step/4`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không thể chuyển hồ sơ."
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
        "Đã chuyển toàn bộ hồ sơ tạm và bắt đầu xử lý hồ sơ chính thức."
      )
      navigate(`/sessions/${encodeURIComponent(sessionId)}/step/4`)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Không thể chuyển toàn bộ hồ sơ."
      )
    } finally {
      setBusy(null)
    }
  }

  const drafts = dossiers.filter((item) => item.status === "draft")

  return (
    <main className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-6xl space-y-6 px-5 py-6 lg:px-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Button
              variant="ghost"
              className="mb-2 -ml-2"
              onClick={() => navigate(`/sessions/${sessionId}/clusters/review`)}
            >
              <ArrowLeft /> Quay lại các cụm
            </Button>
            <h1 className="font-heading text-2xl font-semibold">
              Hồ sơ tạm từ các cụm
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Kiểm tra cấu trúc cụm, chỉnh tiêu đề và chuyển sang hồ sơ chính
              thức khi đã sẵn sàng.
            </p>
          </div>
          <Button
            onClick={() => void promoteAll()}
            disabled={
              drafts.length === 0 || unassignedClusterCount > 0 || busy !== null
            }
          >
            <CheckCircle2 /> Chuyển tất cả thành hồ sơ chính thức
          </Button>
        </header>

        {unassignedClusterCount > 0 && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Còn {unassignedClusterCount} cụm chưa thuộc hồ sơ tạm. Hãy quay lại
            màn hình cụm và sắp xếp hết trước khi chuyển toàn bộ.
          </div>
        )}

        {loading && (
          <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
            Đang tải hồ sơ tạm...
          </div>
        )}
        {!loading && dossiers.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Chưa có hồ sơ tạm. Quay lại màn hình cụm để tạo hồ sơ.
            </CardContent>
          </Card>
        )}

        <section className="space-y-4">
          {dossiers.map((dossier) => (
            <Card
              key={dossier.id}
              className={dossier.status !== "draft" ? "opacity-70" : ""}
            >
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      dossier.status === "draft" ? "secondary" : "outline"
                    }
                  >
                    {dossier.status === "draft" ? "Hồ sơ tạm" : "Đã chuyển"}
                  </Badge>
                  <Badge variant="outline">
                    {dossier.statistics.cluster_count ??
                      dossier.clusters.length}{" "}
                    cụm
                  </Badge>
                  <Badge variant="outline">
                    {dossier.statistics.document_count ?? 0} tài liệu
                  </Badge>
                  <Badge variant="outline">
                    Độ thuần nhất{" "}
                    {formatPercent(
                      dossier.statistics.cohesion_mean as number | null
                    )}
                  </Badge>
                </div>
                <CardTitle className="mt-2">Hồ sơ tạm #{dossier.id}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={titles[dossier.id] ?? dossier.title}
                    disabled={dossier.status !== "draft"}
                    onChange={(event) =>
                      setTitles((current) => ({
                        ...current,
                        [dossier.id]: event.target.value,
                      }))
                    }
                    onBlur={() => void saveTitle(dossier)}
                    aria-label={`Tiêu đề hồ sơ tạm ${dossier.id}`}
                  />
                  {dossier.status === "draft" && (
                    <Button
                      variant="outline"
                      onClick={() => void saveTitle(dossier)}
                      disabled={busy === `title-${dossier.id}`}
                    >
                      Lưu tiêu đề
                    </Button>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  Thời gian:{" "}
                  {dateRange(
                    dossier.statistics.start_date as string | null,
                    dossier.statistics.end_date as string | null
                  )}
                </div>
                <div className="space-y-3">
                  {dossier.clusters.map((cluster) => {
                    const detail = expanded[cluster.cluster_id]
                    return (
                      <div
                        key={cluster.cluster_id}
                        className="rounded-xl border bg-background p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium">{cluster.title}</div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {cluster.content_summary}
                            </p>
                            <div className="mt-2 flex gap-2 text-xs text-muted-foreground">
                              <span>{cluster.document_count} tài liệu</span>
                              <span>•</span>
                              <span>
                                Tương đồng{" "}
                                {formatPercent(cluster.cohesion_mean)}
                              </span>
                            </div>
                          </div>
                          {dossier.status === "draft" &&
                            dossier.clusters.length > 1 && (
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                title="Đưa cụm ra khỏi hồ sơ"
                                onClick={() =>
                                  void removeCluster(
                                    dossier.id,
                                    cluster.cluster_id
                                  )
                                }
                                disabled={
                                  busy === `remove-${cluster.cluster_id}`
                                }
                              >
                                <Trash2 />
                              </Button>
                            )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2"
                          onClick={() =>
                            void toggleDocuments(cluster.cluster_id)
                          }
                        >
                          {detail ? <ChevronUp /> : <ChevronDown />}{" "}
                          <FileText />
                          {detail ? "Ẩn tài liệu" : "Xem tài liệu"}
                        </Button>
                        {detail && (
                          <div className="mt-2 grid gap-2 border-t pt-3 md:grid-cols-2">
                            {(detail.placements ?? []).map((placement) => (
                              <div
                                key={placement.id}
                                className="rounded-lg bg-muted/60 px-3 py-2 text-xs"
                              >
                                <div className="font-medium">
                                  {String(
                                    placement.metadata.title ||
                                      placement.metadata.file_name ||
                                      placement.document_id
                                  )}
                                </div>
                                <div className="mt-1 text-muted-foreground">
                                  Tương đồng:{" "}
                                  {formatPercent(
                                    placement.membership_similarity
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
              {dossier.status === "draft" && (
                <CardFooter className="justify-end">
                  <Button
                    onClick={() => void promoteOne(dossier.id)}
                    disabled={busy !== null}
                  >
                    <CheckCircle2 /> Chuyển thành hồ sơ chính thức
                  </Button>
                </CardFooter>
              )}
            </Card>
          ))}
        </section>
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
