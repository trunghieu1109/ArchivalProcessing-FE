import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom"
import { AlertCircle, ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { visibleAwareDelay } from "@/shared/lib/pageVisibility"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ArtifactRow,
  FinalizeEmptyState,
  FinalizePageHeader,
  FinalizeStatusCard,
  FinalizeToolbar,
} from "./FinalizeArtifactsPage.parts"
import {
  ArtifactPreviewPanel,
  loadArtifactPreviewContent,
  type ArtifactPreviewContent,
} from "./FinalizeArtifactsPage.preview"
import {
  FINALIZE_POLL_INTERVAL_MS,
  FINALIZE_POLL_TIMEOUT_MS,
  FINALIZE_PROGRESS_PHASES,
  artifactExtension,
  buildFinalizeProgressViewState,
  buildArtifactSections,
  filterVisibleArtifacts,
  latestArtifactDate,
  saveBlob,
} from "./FinalizeArtifactsPage.utils"
import { ProgressTimeline } from "@/features/upload/components/ProgressTimeline"
import {
  downloadAllArtifacts,
  downloadArtifact,
  enqueueFinalizeArtifacts,
  getArtifactPreviewHtml,
  getFinalizeArtifactsStatus,
  listArtifacts,
  type FinalizeArtifactStatusResponse,
  type SessionArtifact,
} from "@/features/upload/api/sessionApi"

interface FinalizeArtifactsStepProps {
  sessionId?: string | null
  autoStart?: boolean
  onAutoStartHandled?: () => void
  embedded?: boolean
  onContinue?: () => void
}

export function FinalizeArtifactsPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [searchParams] = useSearchParams()
  if (!sessionId) return <Navigate to="/sessions" replace />
  const query = searchParams.toString()
  return (
    <Navigate
      to={`/sessions/${encodeURIComponent(sessionId)}/step/6${query ? `?${query}` : ""}`}
      replace
    />
  )
}

export function FinalizeArtifactsStep({
  sessionId,
  autoStart = false,
  onAutoStartHandled,
  embedded = false,
  onContinue,
}: FinalizeArtifactsStepProps) {
  const navigate = useNavigate()
  const autoStartHandled = useRef(false)

  const [artifacts, setArtifacts] = useState<SessionArtifact[]>([])
  const [loading, setLoading] = useState(true)
  const [finalizing, setFinalizing] = useState(false)
  const [finalizeFailed, setFinalizeFailed] = useState(false)
  const [statusMessage, setStatusMessage] = useState("Đang tải tệp mục lục...")
  const [error, setError] = useState("")
  const [selectedArtifactId, setSelectedArtifactId] = useState<number | null>(
    null
  )
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [downloadingArtifactId, setDownloadingArtifactId] = useState<
    number | null
  >(null)
  const [previewContent, setPreviewContent] =
    useState<ArtifactPreviewContent | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState("")
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0)
  const previewBlobUrlRef = useRef<string | null>(null)
  const [progressPhase, setProgressPhase] = useState<string | null>(null)
  const [failedPhase, setFailedPhase] = useState<string | null>(null)
  const [progressMessage, setProgressMessage] = useState("")
  const [completedPhases, setCompletedPhases] = useState<Set<string>>(
    () => new Set()
  )
  const activeFinalizeJobIdRef = useRef<number | null>(null)

  const visibleArtifacts = useMemo(
    () => filterVisibleArtifacts(artifacts),
    [artifacts]
  )
  const artifactSections = useMemo(
    () => buildArtifactSections(visibleArtifacts),
    [visibleArtifacts]
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

  const applyFinalizeStatus = useCallback(
    (status: FinalizeArtifactStatusResponse) => {
      const jobStatus = status.job?.status
      const phase =
        status.progress?.phase ??
        (jobStatus === "done"
          ? "completed"
          : status.active
            ? "loading_data"
            : null)
      const viewState = buildFinalizeProgressViewState(phase, jobStatus)
      setProgressPhase(viewState.activePhase)
      setFailedPhase(viewState.failedPhase)
      setCompletedPhases(viewState.completedPhases)
      if (status.progress?.message) {
        setProgressMessage(status.progress.message)
        setStatusMessage(status.progress.message)
      }
    },
    []
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
        return null
      } finally {
        if (!options.silent) setLoading(false)
      }
    },
    [sessionId]
  )

  const startFinalize = useCallback(
    async (options: { force?: boolean } = {}) => {
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
      setFinalizeFailed(false)
      setFailedPhase(null)
      setError("")
      setStatusMessage("Đang chuẩn bị tạo mục lục...")
      try {
        const currentArtifacts =
          (await refreshArtifacts({ silent: true })) ?? []
        setLoading(false)
        const dispatch = await enqueueFinalizeArtifacts(sessionId, {
          created_by: "ui",
          metadata_export_mode: "combined",
          force: options.force ?? false,
        })
        activeFinalizeJobIdRef.current = dispatch.job_id
        if (dispatch.status === "not_needed") {
          activeFinalizeJobIdRef.current = null
          setFinalizing(false)
          setFinalizeFailed(false)
          setFailedPhase(null)
          setProgressPhase(null)
          setCompletedPhases(
            new Set(FINALIZE_PROGRESS_PHASES.map((phase) => phase.id))
          )
          setProgressMessage(
            "Bộ mục lục hiện tại đã cập nhật theo dữ liệu hồ sơ."
          )
          setStatusMessage(
            `Đã có ${currentArtifacts.length} tệp mục lục mới nhất, không cần tạo lại.`
          )
          toast.success("Mục lục đã được cập nhật, không cần tạo lại.")
          onAutoStartHandled?.()
          return
        }
        setProgressPhase("loading_data")
        setProgressMessage(
          dispatch.status === "already_queued_or_running"
            ? "Đã có yêu cầu tạo mục lục đang được xử lý."
            : "Đã gửi yêu cầu tạo mục lục. Đang chờ worker xử lý."
        )
        setCompletedPhases(new Set())
        setStatusMessage(
          dispatch.status === "already_queued_or_running"
            ? "Yêu cầu tạo mục lục đang chạy. Đang chờ worker sinh tệp..."
            : "Đã gửi yêu cầu tạo mục lục. Đang chờ worker sinh tệp..."
        )
        if (dispatch.status === "queued") {
          toast.success("Đã gửi yêu cầu tạo mục lục.")
        }
        onAutoStartHandled?.()
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Không thể gửi yêu cầu tạo mục lục."
        activeFinalizeJobIdRef.current = null
        setFinalizing(false)
        setFinalizeFailed(true)
        setFailedPhase(null)
        setLoading(false)
        setError(message)
        setStatusMessage("Chưa chạy được bước tạo mục lục.")
        toast.error(message)
        onAutoStartHandled?.()
      }
    },
    [onAutoStartHandled, refreshArtifacts, sessionId]
  )

  const handleUserFinalize = useCallback(
    () => startFinalize({ force: true }),
    [startFinalize]
  )

  useEffect(() => {
    if (!autoStart || autoStartHandled.current) return
    autoStartHandled.current = true
    void startFinalize({ force: false })
  }, [autoStart, startFinalize])

  useEffect(() => {
    if (autoStart) return
    void refreshArtifacts()
  }, [autoStart, refreshArtifacts])

  useEffect(() => {
    if (autoStart || !sessionId) return
    let cancelled = false

    void getFinalizeArtifactsStatus(sessionId)
      .then((status) => {
        if (cancelled || !status.job) return
        if (status.active) {
          activeFinalizeJobIdRef.current = status.job.id
          setFinalizeFailed(false)
          setError("")
          applyFinalizeStatus(status)
          setStatusMessage(
            status.progress?.message ??
              "Yêu cầu tạo mục lục đang chạy. Đang chờ worker xử lý..."
          )
          setProgressMessage(
            status.progress?.message ??
              "Yêu cầu tạo mục lục đang được backend xử lý."
          )
          setFinalizing(true)
          return
        }
        if (status.job.status === "failed") {
          const message =
            status.job.error ?? "Quá trình tạo mục lục gần nhất đã thất bại."
          applyFinalizeStatus(status)
          setFinalizeFailed(true)
          setError(message)
          setProgressMessage(message)
          setStatusMessage("Tạo mục lục thất bại.")
        }
      })
      .catch(() => {
        // Artifact listing remains usable if the best-effort resume check fails.
      })

    return () => {
      cancelled = true
    }
  }, [applyFinalizeStatus, autoStart, sessionId])

  useEffect(() => {
    if (selectedArtifactId === null) return
    if (
      !visibleArtifacts.some((artifact) => artifact.id === selectedArtifactId)
    ) {
      setSelectedArtifactId(null)
    }
  }, [selectedArtifactId, visibleArtifacts])

  const refreshPreview = useCallback(() => {
    setPreviewRefreshKey((key) => key + 1)
  }, [])

  useEffect(() => {
    const artifact = selectedArtifact
    if (!sessionId || !artifact) {
      if (previewBlobUrlRef.current) {
        URL.revokeObjectURL(previewBlobUrlRef.current)
        previewBlobUrlRef.current = null
      }
      setPreviewContent(null)
      setPreviewError("")
      setPreviewLoading(false)
      return
    }

    let cancelled = false
    setPreviewLoading(true)
    setPreviewError("")
    setPreviewContent(null)

    loadArtifactPreviewContent(sessionId, artifact, {
      downloadArtifact,
      getArtifactPreviewHtml,
    })
      .then((content) => {
        if (cancelled) {
          URL.revokeObjectURL(content.blobUrl)
          return
        }
        if (previewBlobUrlRef.current) {
          URL.revokeObjectURL(previewBlobUrlRef.current)
        }
        previewBlobUrlRef.current = content.blobUrl
        setPreviewContent(content)
      })
      .catch((err) => {
        if (cancelled) return
        const message =
          err instanceof Error ? err.message : "Không thể xem trước artifact."
        setPreviewError(message)
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [previewRefreshKey, selectedArtifact, sessionId])

  useEffect(() => {
    return () => {
      if (previewBlobUrlRef.current) {
        URL.revokeObjectURL(previewBlobUrlRef.current)
        previewBlobUrlRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!finalizing || !sessionId) return
    let cancelled = false
    let timeoutId: number | undefined
    const startedAt = Date.now()

    const scheduleNextPoll = () => {
      timeoutId = window.setTimeout(
        poll,
        visibleAwareDelay(FINALIZE_POLL_INTERVAL_MS)
      )
    }

    const stopWithFailure = (message: string, preserveFailedPhase = false) => {
      activeFinalizeJobIdRef.current = null
      setFinalizing(false)
      setFinalizeFailed(true)
      setProgressPhase(null)
      if (!preserveFailedPhase) setFailedPhase(null)
      setError(message)
      setProgressMessage(message)
      setStatusMessage(message)
      toast.error(message)
    }

    const poll = async () => {
      if (Date.now() - startedAt > FINALIZE_POLL_TIMEOUT_MS) {
        stopWithFailure(
          "Quá thời gian chờ tạo mục lục. Hãy kiểm tra backend worker."
        )
        return
      }

      try {
        const status = await getFinalizeArtifactsStatus(sessionId)
        if (cancelled) return

        const expectedJobId = activeFinalizeJobIdRef.current
        if (
          expectedJobId !== null &&
          status.job !== null &&
          status.job.id < expectedJobId
        ) {
          scheduleNextPoll()
          return
        }
        if (status.job) activeFinalizeJobIdRef.current = status.job.id
        applyFinalizeStatus(status)

        if (status.job?.status === "failed") {
          stopWithFailure(
            status.job.error ?? "Quá trình tạo mục lục đã thất bại.",
            true
          )
          return
        }

        if (status.job?.status === "done") {
          const nextVisibleArtifacts = await refreshArtifacts({ silent: true })
          if (cancelled) return
          if (nextVisibleArtifacts === null) {
            scheduleNextPoll()
            return
          }
          activeFinalizeJobIdRef.current = null
          setFinalizing(false)
          setFinalizeFailed(false)
          setFailedPhase(null)
          setError("")
          setProgressPhase(null)
          setCompletedPhases(
            new Set(FINALIZE_PROGRESS_PHASES.map((phase) => phase.id))
          )
          setStatusMessage(
            `Đã có ${nextVisibleArtifacts.length} tệp mục lục sẵn sàng.`
          )
          setProgressMessage("Tệp mục lục đã sẵn sàng.")
          toast.success("Tệp mục lục đã sẵn sàng.")
          return
        }

        if (!status.active && status.job) {
          stopWithFailure(
            `Quá trình tạo mục lục dừng ở trạng thái ${status.job.status}.`
          )
          return
        }

        if (!status.progress) {
          setProgressMessage(
            status.job
              ? "Backend đang chuẩn bị dữ liệu tạo mục lục."
              : "Đang chờ backend ghi nhận job tạo mục lục."
          )
        }
        scheduleNextPoll()
      } catch {
        if (!cancelled) scheduleNextPoll()
      }
    }

    void poll()
    return () => {
      cancelled = true
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [applyFinalizeStatus, finalizing, refreshArtifacts, sessionId])

  const handleDownloadAll = useCallback(async () => {
    if (!sessionId || visibleArtifacts.length === 0) return
    setDownloadingAll(true)
    try {
      const result = await downloadAllArtifacts(sessionId)
      saveBlob(result.blob, result.fileName)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Không thể tải tất cả artifact."
      setError(message)
      toast.error(message)
    } finally {
      setDownloadingAll(false)
    }
  }, [sessionId, visibleArtifacts.length])

  const handleDownloadArtifact = useCallback(
    async (artifact: SessionArtifact) => {
      if (!sessionId) return
      setDownloadingArtifactId(artifact.id)
      try {
        const result = await downloadArtifact(sessionId, artifact.id)
        saveBlob(result.blob, result.fileName || artifact.file_name)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Không thể tải artifact."
        setError(message)
        toast.error(message)
      } finally {
        setDownloadingArtifactId(null)
      }
    },
    [sessionId]
  )

  return (
    <div
      className={
        embedded
          ? "flex flex-col gap-6 text-[#0F172A]"
          : "min-h-svh bg-[#EEF3F8] text-[#0F172A]"
      }
    >
      {!embedded && (
        <FinalizePageHeader
          sessionId={sessionId}
          visibleArtifactCount={visibleArtifacts.length}
          fileTypeCount={fileTypeCount}
        />
      )}

      <main
        className={
          embedded
            ? "flex flex-col gap-6"
            : "mx-auto flex max-w-[1560px] flex-col gap-6 px-4 py-5 sm:px-6 sm:py-8 lg:px-8"
        }
      >
        <FinalizeToolbar
          embedded={embedded}
          sessionId={sessionId}
          loading={loading}
          finalizing={finalizing}
          visibleArtifactCount={visibleArtifacts.length}
          downloadingAll={downloadingAll}
          onBack={() => navigate(-1)}
          onRefreshArtifacts={refreshArtifacts}
          onStartFinalize={handleUserFinalize}
          onDownloadAll={handleDownloadAll}
        />

        {(finalizing || progressMessage) && (
          <ProgressTimeline
            phases={FINALIZE_PROGRESS_PHASES}
            activePhase={progressPhase}
            failedPhase={failedPhase}
            completedPhases={completedPhases}
            title="Tiến độ tạo mục lục"
            message={
              progressMessage ||
              "Backend đang tạo các file mục lục và tổng hợp."
            }
          />
        )}

        <FinalizeStatusCard
          finalizing={finalizing}
          finalizeFailed={finalizeFailed}
          statusMessage={statusMessage}
          latestGeneratedAt={latestGeneratedAt}
          visibleArtifactCount={visibleArtifacts.length}
        />

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
          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
            <div className="min-h-0 min-w-0 overflow-y-auto pr-1 pb-2 xl:h-[calc(min(72svh,760px)+3.5rem)] xl:min-h-[476px]">
              <div className="grid min-w-0 content-start gap-5">
                {artifactSections.map((section) => (
                  <section key={section.id} className="min-w-0">
                    <div className="mb-2 flex items-center justify-between gap-3 px-1">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold tracking-[0.16em] text-[#94A3B8] uppercase">
                          Mục {section.ordinal}
                        </p>
                        <h3 className="truncate text-sm font-semibold text-[#0F172A]">
                          {section.label}
                        </h3>
                      </div>
                      <Badge variant="outline">
                        {section.artifacts.length}
                      </Badge>
                    </div>
                    <div className="grid gap-2.5">
                      {section.artifacts.map((artifact, index) => (
                        <ArtifactRow
                          key={artifact.id}
                          artifact={artifact}
                          index={index}
                          selected={artifact.id === selectedArtifactId}
                          downloading={downloadingArtifactId === artifact.id}
                          onPreview={() => setSelectedArtifactId(artifact.id)}
                          onDownload={() =>
                            void handleDownloadArtifact(artifact)
                          }
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
            <ArtifactPreviewPanel
              artifact={selectedArtifact}
              preview={previewContent}
              loading={previewLoading}
              error={previewError}
              onRefresh={refreshPreview}
              onDownload={() =>
                selectedArtifact
                  ? void handleDownloadArtifact(selectedArtifact)
                  : undefined
              }
              downloading={
                selectedArtifact
                  ? downloadingArtifactId === selectedArtifact.id
                  : false
              }
            />
          </div>
        ) : (
          <FinalizeEmptyState
            finalizing={finalizing}
            sessionId={sessionId}
            onStartFinalize={handleUserFinalize}
          />
        )}
        {embedded &&
        visibleArtifacts.length > 0 &&
        !finalizing &&
        onContinue ? (
          <div className="sticky bottom-0 z-20 flex justify-end border-t border-[#CBD5E1] bg-white/95 px-4 py-3 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur">
            <Button type="button" onClick={onContinue}>
              Xuất bản
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        ) : null}
      </main>
    </div>
  )
}
