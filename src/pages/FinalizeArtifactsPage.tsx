import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom"
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Home,
  Loader2,
  Play,
  RefreshCw,
} from "lucide-react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/shared/lib/utils"
import { ProgressTimeline } from "@/features/upload/components/ProgressTimeline"
import {
  artifactDownloadAllUrl,
  artifactDownloadUrl,
  artifactPreviewUrl,
  enqueueFinalizeArtifacts,
  listArtifacts,
  listSessionEvents,
  type SessionArtifact,
} from "@/features/upload/api/sessionApi"

const FINALIZE_POLL_INTERVAL_MS = 3_000
const FINALIZE_POLL_TIMEOUT_MS = 10 * 60 * 1_000
const EXCLUDED_FILE_NAMES = new Set(["tai lieu can kiem tra khi phan cum.xlsx"])
const HIDDEN_ARTIFACT_TYPES = new Set(["manifest"])
const FINALIZE_PROGRESS_PHASES = [
  { id: "loading_data", label: "Tổng hợp dữ liệu hồ sơ" },
  { id: "creating_xlsx", label: "Tạo các file Excel" },
  { id: "writing_manifest", label: "Ghi danh sách tệp" },
  { id: "completed", label: "Hoàn tất" },
]

interface FinalizeArtifactsStepProps {
  sessionId?: string | null
  autoStart?: boolean
  onAutoStartHandled?: () => void
  embedded?: boolean
}

export function FinalizeArtifactsPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [searchParams] = useSearchParams()
  if (!sessionId) return <Navigate to="/sessions" replace />
  const query = searchParams.toString()
  return (
    <Navigate
      to={`/sessions/${encodeURIComponent(sessionId)}/step/5${query ? `?${query}` : ""}`}
      replace
    />
  )
}

export function FinalizeArtifactsStep({
  sessionId,
  autoStart = false,
  onAutoStartHandled,
  embedded = false,
}: FinalizeArtifactsStepProps) {
  const navigate = useNavigate()
  const autoStartHandled = useRef(false)

  const [artifacts, setArtifacts] = useState<SessionArtifact[]>([])
  const [loading, setLoading] = useState(true)
  const [finalizing, setFinalizing] = useState(false)
  const [pollAfterArtifactId, setPollAfterArtifactId] = useState(0)
  const [statusMessage, setStatusMessage] = useState("Đang tải tệp mục lục...")
  const [error, setError] = useState("")
  const [selectedArtifactId, setSelectedArtifactId] = useState<number | null>(
    null
  )
  const [progressPhase, setProgressPhase] = useState<string | null>(null)
  const [progressMessage, setProgressMessage] = useState("")
  const [completedPhases, setCompletedPhases] = useState<Set<string>>(
    () => new Set()
  )

  const visibleArtifacts = useMemo(
    () => filterVisibleArtifacts(artifacts),
    [artifacts]
  )
  const selectedArtifact = useMemo(
    () =>
      visibleArtifacts.find((artifact) => artifact.id === selectedArtifactId) ??
      null,
    [selectedArtifactId, visibleArtifacts]
  )
  const latestGeneratedAt = useMemo(
    () => latestArtifactDate(visibleArtifacts),
    [visibleArtifacts]
  )
  const fileTypeCount = useMemo(
    () =>
      new Set(
        visibleArtifacts.map((artifact) =>
          artifactExtension(artifact.file_name)
        )
      ).size,
    [visibleArtifacts]
  )

  const refreshArtifacts = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (!sessionId) {
        if (!options.silent) {
          setArtifacts([])
          setLoading(false)
          setError("Chưa có session để tạo mục lục.")
          setStatusMessage("Chưa có session để tạo mục lục.")
        }
        return []
      }
      if (!options.silent) {
        setLoading(true)
        setError("")
      }
      try {
        const response = await listArtifacts(sessionId, "ready")
        const nextVisibleArtifacts = filterVisibleArtifacts(response.artifacts)
        setArtifacts(response.artifacts)
        if (!options.silent) {
          setStatusMessage(
            nextVisibleArtifacts.length > 0
              ? `Đã có ${nextVisibleArtifacts.length} tệp mục lục sẵn sàng.`
              : "Chưa có tệp mục lục sẵn sàng."
          )
        }
        return nextVisibleArtifacts
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Không thể tải tệp mục lục."
        setError(message)
        if (!options.silent) toast.error(message)
        return []
      } finally {
        if (!options.silent) setLoading(false)
      }
    },
    [sessionId]
  )

  const startFinalize = useCallback(async () => {
    if (!sessionId) {
      const message = "Chưa có session để tạo mục lục."
      setError(message)
      setLoading(false)
      setStatusMessage(message)
      toast.error(message)
      onAutoStartHandled?.()
      return
    }
    setFinalizing(true)
    setError("")
    setStatusMessage("Đang chuẩn bị tạo mục lục...")
    try {
      const currentArtifacts = await refreshArtifacts({ silent: true })
      setLoading(false)
      setPollAfterArtifactId(maxArtifactId(currentArtifacts))
      await enqueueFinalizeArtifacts(sessionId, { created_by: "ui" })
      setProgressPhase("loading_data")
      setProgressMessage("Đã gửi yêu cầu tạo mục lục. Đang chờ worker xử lý.")
      setCompletedPhases(new Set())
      setStatusMessage(
        "Đã gửi yêu cầu tạo mục lục. Đang chờ worker sinh tệp..."
      )
      toast.success("Đã gửi yêu cầu tạo mục lục.")
      onAutoStartHandled?.()
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Không thể gửi yêu cầu tạo mục lục."
      setFinalizing(false)
      setLoading(false)
      setError(message)
      setStatusMessage("Chưa chạy được bước tạo mục lục.")
      toast.error(message)
      onAutoStartHandled?.()
    }
  }, [onAutoStartHandled, refreshArtifacts, sessionId])

  useEffect(() => {
    if (!autoStart || autoStartHandled.current) return
    autoStartHandled.current = true
    void startFinalize()
  }, [autoStart, startFinalize])

  useEffect(() => {
    if (autoStart) return
    void refreshArtifacts()
  }, [autoStart, refreshArtifacts])

  useEffect(() => {
    if (selectedArtifactId === null) return
    if (
      !visibleArtifacts.some((artifact) => artifact.id === selectedArtifactId)
    ) {
      setSelectedArtifactId(null)
    }
  }, [selectedArtifactId, visibleArtifacts])

  useEffect(() => {
    if (!finalizing || !sessionId) return
    let cancelled = false
    let timeoutId: number | undefined
    const startedAt = Date.now()

    const poll = async () => {
      const nextVisibleArtifacts = await refreshArtifacts({ silent: true })
      if (cancelled) return
      const hasNewArtifacts = nextVisibleArtifacts.some(
        (artifact) => artifact.id > pollAfterArtifactId
      )
      if (hasNewArtifacts) {
        setFinalizing(false)
        setStatusMessage(
          `Đã có ${nextVisibleArtifacts.length} tệp mục lục sẵn sàng.`
        )
        setProgressPhase(null)
        setCompletedPhases(
          new Set(FINALIZE_PROGRESS_PHASES.map((phase) => phase.id))
        )
        setProgressMessage("Tệp mục lục đã sẵn sàng.")
        toast.success("Tệp mục lục đã sẵn sàng.")
        return
      }
      if (Date.now() - startedAt > FINALIZE_POLL_TIMEOUT_MS) {
        setFinalizing(false)
        setStatusMessage(
          "Quá thời gian chờ tạo mục lục. Hãy kiểm tra backend worker."
        )
        return
      }
      timeoutId = window.setTimeout(poll, FINALIZE_POLL_INTERVAL_MS)
    }

    timeoutId = window.setTimeout(poll, FINALIZE_POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [finalizing, pollAfterArtifactId, refreshArtifacts, sessionId])

  useEffect(() => {
    if (!finalizing || !sessionId) return

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
          if (event.event_type === "artifacts.finalize.progress") {
            const phase = String(event.payload?.phase ?? "")
            if (phase) {
              setProgressPhase(phase === "completed" ? null : phase)
              setCompletedPhases((previous) => {
                const next = new Set(previous)
                const phaseIndex = FINALIZE_PROGRESS_PHASES.findIndex(
                  (item) => item.id === phase
                )
                FINALIZE_PROGRESS_PHASES.slice(
                  0,
                  Math.max(phaseIndex, 0)
                ).forEach((item) => next.add(item.id))
                if (phase === "completed") {
                  FINALIZE_PROGRESS_PHASES.forEach((item) => next.add(item.id))
                }
                return next
              })
            }
            if (event.message) {
              setProgressMessage(event.message)
              setStatusMessage(event.message)
            }
          }
          if (event.event_type === "artifacts.item.ready" && event.message) {
            setProgressMessage(event.message)
          }
        }
      } catch {
        // Artifact polling owns user-facing errors.
      }
      if (!cancelled) timeoutId = window.setTimeout(pollEvents, 1_500)
    }

    void pollEvents()
    return () => {
      cancelled = true
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [finalizing, sessionId])

  const handleDownloadAll = () => {
    if (!sessionId || visibleArtifacts.length === 0) return
    window.location.assign(artifactDownloadAllUrl(sessionId))
  }

  return (
    <div
      className={
        embedded
          ? "flex flex-col gap-6 text-[#0F172A]"
          : "min-h-svh bg-[#EEF3F8] text-[#0F172A]"
      }
    >
      {!embedded && (
        <header className="border-b border-[#D8E1EC] bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-8 py-5">
            <div className="flex min-w-0 items-center gap-4">
              <img
                src="/assets/mbfs.png"
                alt="MBFS"
                className="h-14 w-auto object-contain"
              />
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold tracking-tight">
                  Tạo mục lục
                </h1>
                <p className="mt-1 truncate text-sm text-[#64748B]">
                  {sessionId}
                </p>
              </div>
            </div>
            <div className="hidden items-center gap-3 md:flex">
              <SummaryPill label="Tệp" value={visibleArtifacts.length} />
              <SummaryPill label="Định dạng" value={fileTypeCount} />
            </div>
          </div>
        </header>
      )}

      <main
        className={
          embedded
            ? "flex flex-col gap-6"
            : "mx-auto flex max-w-6xl flex-col gap-6 px-8 py-8"
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          {embedded ? (
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-[0.16em] text-[#64748B] uppercase">
                Bước 5
              </p>
              <h2 className="mt-1 text-xl font-semibold text-[#0F172A]">
                Tạo mục lục
              </h2>
              <p className="mt-1 truncate text-sm text-[#64748B]">
                {sessionId ?? "Chưa có session"}
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" asChild>
                <Link to="/sessions">
                  <Home data-icon="inline-start" />
                  Danh sách session
                </Link>
              </Button>
              <Button variant="outline" onClick={() => navigate(-1)}>
                <ArrowLeft data-icon="inline-start" />
                Quay lại
              </Button>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => void refreshArtifacts()}
              disabled={loading || finalizing}
            >
              {loading ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <RefreshCw data-icon="inline-start" />
              )}
              Làm mới
            </Button>
            <Button
              variant="outline"
              onClick={() => void startFinalize()}
              disabled={finalizing || !sessionId}
            >
              {finalizing ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <Play data-icon="inline-start" />
              )}
              {visibleArtifacts.length > 0 ? "Tạo lại" : "Tạo mục lục"}
            </Button>
            <Button
              onClick={handleDownloadAll}
              disabled={visibleArtifacts.length === 0 || !sessionId}
            >
              <Archive data-icon="inline-start" />
              Tải tất cả
            </Button>
          </div>
        </div>

        {(finalizing || progressMessage) && (
          <ProgressTimeline
            phases={FINALIZE_PROGRESS_PHASES}
            activePhase={progressPhase}
            completedPhases={completedPhases}
            title="Tiến độ tạo mục lục"
            message={
              progressMessage ||
              "Backend đang tạo các file mục lục và tổng hợp."
            }
          />
        )}

        <section className="rounded-2xl border border-[#D8E1EC] bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex size-10 items-center justify-center rounded-xl",
                  finalizing
                    ? "bg-blue-50 text-[#0052FF]"
                    : "bg-emerald-50 text-emerald-700"
                )}
              >
                {finalizing ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-5" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-[#0F172A]">
                  {statusMessage}
                </p>
                <p className="mt-1 text-xs text-[#64748B]">
                  {latestGeneratedAt
                    ? `Lần sinh mới nhất: ${formatDate(latestGeneratedAt)}`
                    : "Chưa ghi nhận lần sinh tệp."}
                </p>
              </div>
            </div>
            <Badge variant={finalizing ? "outline" : "secondary"}>
              {finalizing
                ? "Đang tạo"
                : visibleArtifacts.length > 0
                  ? "Sẵn sàng"
                  : "Chưa có tệp"}
            </Badge>
          </div>
        </section>

        {error && (
          <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-20 animate-pulse rounded-2xl border border-[#D8E1EC] bg-white"
              />
            ))}
          </div>
        ) : visibleArtifacts.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(16rem,19rem)_minmax(0,1fr)]">
            <div className="grid content-start gap-2.5">
              {visibleArtifacts.map((artifact, index) => (
                <ArtifactRow
                  key={artifact.id}
                  artifact={artifact}
                  index={index}
                  selected={artifact.id === selectedArtifactId}
                  downloadUrl={
                    sessionId
                      ? artifactDownloadUrl(sessionId, artifact.id)
                      : "#"
                  }
                  onPreview={() => setSelectedArtifactId(artifact.id)}
                />
              ))}
            </div>
            <ArtifactPreviewPanel
              artifact={selectedArtifact}
              previewUrl={
                sessionId && selectedArtifact
                  ? artifactPreviewUrl(sessionId, selectedArtifact.id)
                  : ""
              }
            />
          </div>
        ) : (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-[#CBD5E1] bg-white px-8 text-center shadow-sm">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-[#EAF1FF] text-[#0052FF]">
              <Archive className="size-7" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">Chưa có tệp mục lục</h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-[#64748B]">
              {finalizing
                ? "Worker đang sinh tệp mục lục cho session này. Danh sách sẽ tự cập nhật khi hoàn tất."
                : "Bấm tạo mục lục để sinh các tệp cho session hiện tại."}
            </p>
            {!finalizing && (
              <Button
                className="mt-5"
                onClick={() => void startFinalize()}
                disabled={!sessionId}
              >
                <Play data-icon="inline-start" />
                Tạo mục lục
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function ArtifactRow({
  artifact,
  index,
  selected,
  downloadUrl,
  onPreview,
}: {
  artifact: SessionArtifact
  index: number
  selected: boolean
  downloadUrl: string
  onPreview: () => void
}) {
  const extension = artifactExtension(artifact.file_name)
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, delay: index * 0.025 }}
      onClick={onPreview}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onPreview()
        }
      }}
      className={cn(
        "flex min-h-16 items-center justify-between gap-2.5 rounded-xl border bg-white px-3 py-2.5 text-left shadow-sm transition-all",
        selected
          ? "border-[#0052FF]/45 ring-2 ring-[#0052FF]/10"
          : "border-[#D8E1EC] hover:border-[#0052FF]/35"
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#EAF1FF] text-[#0052FF]">
          <FileText className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-[#0F172A]">
            {artifact.file_name}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[#64748B]">
            <span>{artifactTypeLabel(artifact.artifact_type)}</span>
            <span className="text-[#CBD5E1]">/</span>
            <span>{extension.toUpperCase()}</span>
            {artifact.generated_at && (
              <>
                <span className="text-[#CBD5E1]">/</span>
                <span>{formatDate(artifact.generated_at)}</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onPreview}
          title="Xem trước"
        >
          <Eye className="size-4" />
        </Button>
        <Button variant="outline" size="icon-sm" asChild title="Tải xuống">
          <a href={downloadUrl} onClick={(event) => event.stopPropagation()}>
            <Download className="size-4" />
          </a>
        </Button>
      </div>
    </motion.div>
  )
}

function ArtifactPreviewPanel({
  artifact,
  previewUrl,
}: {
  artifact: SessionArtifact | null
  previewUrl: string
}) {
  return (
    <section className="min-h-[640px] overflow-hidden rounded-2xl border border-[#D8E1EC] bg-white shadow-sm">
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-[#EEF2F7] px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#0F172A]">Xem trước</p>
          <p className="mt-0.5 truncate text-xs text-[#64748B]">
            {artifact ? artifact.file_name : "Chọn một tệp"}
          </p>
        </div>
        {artifact && (
          <Badge variant="outline">
            {artifactExtension(artifact.file_name).toUpperCase()}
          </Badge>
        )}
      </div>
      {artifact && previewUrl ? (
        <iframe
          title={`Xem trước ${artifact.file_name}`}
          src={previewUrl}
          sandbox=""
          className="h-[640px] w-full bg-white"
        />
      ) : (
        <div className="flex h-[640px] flex-col items-center justify-center px-8 text-center text-sm text-[#64748B]">
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-[#EAF1FF] text-[#0052FF]">
            <Eye className="size-6" />
          </div>
          <p className="font-medium text-[#0F172A]">
            Chọn một tệp để xem trực tiếp.
          </p>
        </div>
      )}
    </section>
  )
}

function SummaryPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#D8E1EC] bg-white px-4 py-2 text-right shadow-sm">
      <p className="text-[11px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">
        {label}
      </p>
      <p className="text-lg font-bold text-[#0F172A]">{value}</p>
    </div>
  )
}

function filterVisibleArtifacts(
  artifacts: SessionArtifact[]
): SessionArtifact[] {
  return artifacts.filter((artifact) => {
    if (artifact.status !== "ready") return false
    if (HIDDEN_ARTIFACT_TYPES.has(normalizeFilterText(artifact.artifact_type)))
      return false
    if (EXCLUDED_FILE_NAMES.has(normalizeFilterText(artifact.file_name)))
      return false
    return true
  })
}

function normalizeFilterText(value: string): string {
  return value.trim().toLowerCase()
}

function maxArtifactId(artifacts: SessionArtifact[]): number {
  return artifacts.reduce((maxId, artifact) => Math.max(maxId, artifact.id), 0)
}

function latestArtifactDate(artifacts: SessionArtifact[]): string | null {
  return (
    artifacts
      .map((artifact) => artifact.generated_at)
      .filter((value): value is string => Boolean(value))
      .sort(
        (left, right) => new Date(right).getTime() - new Date(left).getTime()
      )[0] ?? null
  )
}

function artifactExtension(fileName: string): string {
  const index = fileName.lastIndexOf(".")
  return index >= 0 ? fileName.slice(index + 1) : "file"
}

function artifactTypeLabel(value: string): string {
  const labels: Record<string, string> = {
    muc_luc_ho_so: "Mục lục hồ sơ",
    muc_luc_ho_so_co_thoi_han: "Mục lục hồ sơ có thời hạn",
    muc_luc_ho_so_xlsx: "Mục lục hồ sơ Excel",
    muc_luc_ho_so_co_thoi_han_xlsx: "Mục lục hồ sơ có thời hạn Excel",
    danh_muc_ho_so: "Danh mục hồ sơ",
    muc_luc_van_ban: "Mục lục văn bản",
    muc_luc_van_ban_co_thoi_han: "Mục lục văn bản có thời hạn",
    muc_luc_van_ban_xlsx: "Mục lục văn bản Excel",
    muc_luc_van_ban_co_thoi_han_xlsx: "Mục lục văn bản có thời hạn Excel",
    metadata_extracted_documents_xlsx: "Metadata tài liệu trích xuất",
    metadata_digitalized_documents_xlsx: "Metadata tài liệu số hóa",
  }
  return labels[value] ?? value.replace(/_/g, " ")
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}
