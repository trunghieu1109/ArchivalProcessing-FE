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
  buildArtifactSections,
  filterVisibleArtifacts,
  latestArtifactDate,
  maxArtifactId,
  saveBlob,
} from "./FinalizeArtifactsPage.utils"
import { ProgressTimeline } from "@/features/upload/components/ProgressTimeline"
import {
  downloadAllArtifacts,
  downloadArtifact,
  enqueueFinalizeArtifacts,
  getArtifactRemoteSignedUrl,
  getArtifactPreviewHtml,
  listArtifacts,
  listSessionEvents,
  type MetadataExportMode,
  type SessionArtifact,
} from "@/features/upload/api/sessionApi"

const FINALIZE_EVENT_POLL_INTERVAL_MS = 5_000

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
  const [metadataExportMode, setMetadataExportMode] =
    useState<MetadataExportMode>("combined")
  const [pollAfterArtifactId, setPollAfterArtifactId] = useState(0)
  const [statusMessage, setStatusMessage] = useState("Đang tải tệp mục lục...")
  const [error, setError] = useState("")
  const [selectedArtifactId, setSelectedArtifactId] = useState<number | null>(
    null
  )
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [downloadingArtifactId, setDownloadingArtifactId] = useState<
    number | null
  >(null)
  const [remoteDownloadingArtifactId, setRemoteDownloadingArtifactId] =
    useState<number | null>(null)
  const [previewContent, setPreviewContent] =
    useState<ArtifactPreviewContent | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState("")
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0)
  const previewBlobUrlRef = useRef<string | null>(null)
  const [progressPhase, setProgressPhase] = useState<string | null>(null)
  const [progressMessage, setProgressMessage] = useState("")
  const [completedPhases, setCompletedPhases] = useState<Set<string>>(
    () => new Set()
  )

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
      await enqueueFinalizeArtifacts(sessionId, {
        created_by: "ui",
        metadata_export_mode: metadataExportMode,
      })
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
  }, [metadataExportMode, onAutoStartHandled, refreshArtifacts, sessionId])

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
      timeoutId = window.setTimeout(
        poll,
        visibleAwareDelay(FINALIZE_POLL_INTERVAL_MS)
      )
    }

    timeoutId = window.setTimeout(
      poll,
      visibleAwareDelay(FINALIZE_POLL_INTERVAL_MS)
    )
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
          limit: 50,
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
      if (!cancelled) {
        timeoutId = window.setTimeout(
          pollEvents,
          visibleAwareDelay(FINALIZE_EVENT_POLL_INTERVAL_MS)
        )
      }
    }

    void pollEvents()
    return () => {
      cancelled = true
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [finalizing, sessionId])

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

  const handleRemoteDownloadArtifact = useCallback(
    async (artifact: SessionArtifact) => {
      if (!sessionId || !artifact.remote_artifact_id) return
      const downloadWindow = window.open("about:blank", "_blank")
      if (downloadWindow) downloadWindow.opener = null
      setRemoteDownloadingArtifactId(artifact.id)
      try {
        const result = await getArtifactRemoteSignedUrl(sessionId, artifact.id)
        if (downloadWindow) {
          downloadWindow.location.replace(result.download_url)
        } else {
          window.open(result.download_url, "_blank", "noopener,noreferrer")
        }
      } catch (err) {
        downloadWindow?.close()
        const message =
          err instanceof Error
            ? err.message
            : "Không thể lấy đường dẫn tải từ kho Chỉnh Lý."
        setError(message)
        toast.error(message)
      } finally {
        setRemoteDownloadingArtifactId(null)
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
          metadataExportMode={metadataExportMode}
          onBack={() => navigate(-1)}
          onRefreshArtifacts={refreshArtifacts}
          onStartFinalize={startFinalize}
          onDownloadAll={handleDownloadAll}
          onMetadataExportModeChange={setMetadataExportMode}
        />

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

        <FinalizeStatusCard
          finalizing={finalizing}
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
                          remoteDownloading={
                            remoteDownloadingArtifactId === artifact.id
                          }
                          onPreview={() => setSelectedArtifactId(artifact.id)}
                          onDownload={() =>
                            void handleDownloadArtifact(artifact)
                          }
                          onRemoteDownload={() =>
                            void handleRemoteDownloadArtifact(artifact)
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
              onRemoteDownload={() =>
                selectedArtifact
                  ? void handleRemoteDownloadArtifact(selectedArtifact)
                  : undefined
              }
              remoteDownloading={
                selectedArtifact
                  ? remoteDownloadingArtifactId === selectedArtifact.id
                  : false
              }
            />
          </div>
        ) : (
          <FinalizeEmptyState
            finalizing={finalizing}
            sessionId={sessionId}
            onStartFinalize={startFinalize}
          />
        )}
        {embedded && visibleArtifacts.length > 0 && !finalizing && onContinue ? (
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
