import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { ProgressTimeline } from "@/features/upload/components/ProgressTimeline"
import { PaginationControls } from "@/features/upload/components/PaginationControls"
import { usePagedItems } from "@/features/upload/hooks/usePagedItems"
import {
  downloadArtifact,
  enqueueDocumentNumbering,
  exportMetadataSnapshot,
  getDocumentNumberingStatus,
  getNumberedDocumentPreviewUrl,
  importMetadataBoxNumbers as importMetadataBoxNumbersApi,
  updateDocumentNumberingFromPage,
  type DocumentNumberingMode,
  type NumberingDocumentStatus,
  type NumberingStatusResponse,
} from "@/features/upload/api/sessionApi"
import {
  DossierMetaChip,
  NumberingDocumentRow,
  NumberingMetadataPanel,
  NumberingStat,
  NumberingStepFooter,
  NumberingStepHeader,
} from "./NumberingStep.parts"
import { NumberedPdfPreviewPanel } from "./NumberingStep.preview"
import {
  groupDocumentsByDossier,
  isNumberingComplete,
  saveBlob,
} from "./NumberingStep.utils"

const NUMBERING_POLL_INTERVAL_MS = 3_000
const NUMBERING_PROGRESS_PHASES = [
  { id: "loading_data", label: "Chuẩn bị hồ sơ" },
  { id: "rendering_document", label: "Đánh số PDF" },
  { id: "completed", label: "Hoàn tất" },
]

interface NumberingStepProps {
  sessionId: string | null
  documentNumberingMode: DocumentNumberingMode
  onDocumentNumberingModeChange: (
    mode: DocumentNumberingMode
  ) => Promise<boolean | void>
  autoStart?: boolean
  onAutoStartHandled?: () => void
  onContinue: () => void
}

export function NumberingStep({
  sessionId,
  documentNumberingMode,
  onDocumentNumberingModeChange,
  autoStart = false,
  onAutoStartHandled,
  onContinue,
}: NumberingStepProps) {
  const autoStartHandled = useRef(false)
  const [status, setStatus] = useState<NumberingStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [changingMode, setChangingMode] = useState(false)
  const [updatingDocumentId, setUpdatingDocumentId] = useState<number | null>(
    null
  )
  const [error, setError] = useState("")
  const [progressPhase, setProgressPhase] = useState<string | null>(null)
  const [progressMessage, setProgressMessage] = useState("")
  const [previewDocumentId, setPreviewDocumentId] = useState<number | null>(
    null
  )
  const [previewUrl, setPreviewUrl] = useState("")
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState("")
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0)
  const [metadataExporting, setMetadataExporting] = useState(false)
  const [metadataImporting, setMetadataImporting] = useState(false)
  const metadataImportInputRef = useRef<HTMLInputElement | null>(null)
  const [completedPhases, setCompletedPhases] = useState<Set<string>>(
    () => new Set()
  )

  const refreshStatus = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (!sessionId) {
        setStatus(null)
        setLoading(false)
        setError("Chưa có session để đánh số trang.")
        return null
      }
      if (!options.silent) {
        setLoading(true)
        setError("")
      }
      try {
        const response = await getDocumentNumberingStatus(sessionId)
        setStatus(response)
        setError("")
        return response
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Không tải được trạng thái đánh số."
        if (!options.silent) setError(message)
        return null
      } finally {
        if (!options.silent) setLoading(false)
      }
    },
    [sessionId]
  )

  const startNumbering = useCallback(
    async (force = false) => {
      if (!sessionId) {
        toast.error("Chưa có session để đánh số trang.")
        return
      }
      setStarting(true)
      setError("")
      setProgressPhase("loading_data")
      setProgressMessage("Đang gửi yêu cầu đánh số trang.")
      setCompletedPhases(new Set())
      try {
        const response = await enqueueDocumentNumbering(sessionId, {
          created_by: "ui",
          force,
        })
        if (response.status === "not_needed") {
          if (response.result) setStatus(response.result)
          setProgressPhase("completed")
          setCompletedPhases(
            new Set(NUMBERING_PROGRESS_PHASES.map((phase) => phase.id))
          )
          setProgressMessage("Đã lấy kết quả đánh số hiện có.")
          toast.info("Tài liệu đã được đánh số theo chế độ hiện tại.")
        } else if (response.created) {
          toast.success("Đã gửi task đánh số trang.")
        } else {
          toast.info("Task đánh số trang đang được xử lý.")
        }
        await refreshStatus({ silent: true })
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Không gửi được task đánh số trang."
        setError(message)
        toast.error(message)
      } finally {
        setStarting(false)
      }
    },
    [refreshStatus, sessionId]
  )

  const updateDocumentNumberFromPage = useCallback(
    async (
      document: NumberingDocumentStatus,
      anchorPageNumber: number,
      newNumber: number
    ) => {
      if (!sessionId) {
        toast.error("Chưa có session để cập nhật số.")
        return
      }
      if (!Number.isFinite(anchorPageNumber) || anchorPageNumber < 1) {
        toast.error("Trang cần sửa phải lớn hơn hoặc bằng 1.")
        return
      }
      if (!Number.isFinite(newNumber) || newNumber < 1) {
        toast.error("Số mới phải lớn hơn hoặc bằng 1.")
        return
      }
      setUpdatingDocumentId(document.session_document_id)
      setPreviewDocumentId(document.session_document_id)
      setError("")
      setProgressPhase("loading_data")
      setProgressMessage("Đang gửi yêu cầu cập nhật số.")
      setCompletedPhases(new Set())
      try {
        const response = await updateDocumentNumberingFromPage(
          sessionId,
          document.session_document_id,
          {
            anchor_page_number: anchorPageNumber,
            new_number: newNumber,
            created_by: "ui",
            force: true,
          }
        )
        if (response.created) {
          toast.success("Đã gửi task cập nhật số.")
        } else {
          toast.info("Task đánh số đang được xử lý.")
        }
        await refreshStatus({ silent: true })
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Không cập nhật được số tài liệu."
        setError(message)
        toast.error(message)
      } finally {
        setUpdatingDocumentId(null)
      }
    },
    [refreshStatus, sessionId]
  )

  const exportMetadata = useCallback(async () => {
    if (!sessionId) {
      toast.error("Chưa có session để xuất metadata.")
      return
    }
    setMetadataExporting(true)
    setError("")
    try {
      const result = await exportMetadataSnapshot(sessionId, {
        created_by: "ui",
      })
      const artifact = result.artifact ?? result.artifacts[0]
      if (!artifact) {
        throw new Error("Backend chưa trả về artifact metadata.")
      }
      toast.success("Đã tạo snapshot metadata. Đang tải file.")
      const download = await downloadArtifact(sessionId, artifact.id)
      saveBlob(download.blob, download.fileName)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Không thể xuất metadata tại thời điểm hiện tại."
      setError(message)
      toast.error(message)
    } finally {
      setMetadataExporting(false)
    }
  }, [sessionId])

  const importMetadataBoxNumbers = useCallback(
    async (file: File | null) => {
      if (!file) return
      if (!sessionId) {
        toast.error("Chưa có session để nhập số hộp.")
        return
      }
      if (!file.name.toLowerCase().endsWith(".xlsx")) {
        toast.error("File nhập số hộp phải là .xlsx.")
        return
      }

      setMetadataImporting(true)
      setError("")
      try {
        const result = await importMetadataBoxNumbersApi(sessionId, file, {
          created_by: "ui",
        })
        toast.success(
          `Đã cập nhật số hộp cho ${result.updated_dossiers} hồ sơ.`
        )
        const issueCount = result.unmatched_rows + result.conflict_count
        if (issueCount > 0) {
          toast.info(
            `Có ${issueCount} dòng chưa cập nhật được do chưa khớp hồ sơ hoặc bị trùng số hộp.`
          )
        }
        await refreshStatus({ silent: true })
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Không thể nhập số hộp từ metadata."
        setError(message)
        toast.error(message)
      } finally {
        setMetadataImporting(false)
      }
    },
    [refreshStatus, sessionId]
  )

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  useEffect(() => {
    if (!autoStart || autoStartHandled.current) return
    autoStartHandled.current = true
    onAutoStartHandled?.()
    void startNumbering(false)
  }, [autoStart, onAutoStartHandled, startNumbering])

  useEffect(() => {
    if (!sessionId) return
    if (!status?.active && !starting) return
    let cancelled = false
    let timeoutId: number | null = null
    const poll = async () => {
      const response = await refreshStatus({ silent: true })
      if (cancelled) return
      if (response?.active || starting) {
        timeoutId = window.setTimeout(poll, NUMBERING_POLL_INTERVAL_MS)
        return
      }
      if (response && isNumberingComplete(response)) {
        setProgressPhase("completed")
        setCompletedPhases(
          new Set(NUMBERING_PROGRESS_PHASES.map((phase) => phase.id))
        )
        setProgressMessage("Đã hoàn tất đánh số trang.")
        toast.success("Đã hoàn tất đánh số trang.")
      }
    }
    timeoutId = window.setTimeout(poll, NUMBERING_POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      if (timeoutId !== null) window.clearTimeout(timeoutId)
    }
  }, [refreshStatus, sessionId, starting, status?.active])

  useEffect(() => {
    if (!status) return
    const total = status.summary.total_documents
    const done = status.summary.done
    const failed = status.summary.failed
    const running = status.summary.running
    if (status.active || running > 0 || starting) {
      setProgressPhase("rendering_document")
      setProgressMessage(`Đã đánh số ${done}/${total} tài liệu.`)
      setCompletedPhases(new Set(["loading_data"]))
      return
    }
    if (total > 0 && done + failed >= total) {
      setProgressPhase("completed")
      setCompletedPhases(
        new Set(NUMBERING_PROGRESS_PHASES.map((phase) => phase.id))
      )
      setProgressMessage(
        failed > 0
          ? `Đã đánh số ${done}/${total} tài liệu, ${failed} tài liệu lỗi.`
          : `Đã đánh số xong ${done}/${total} tài liệu.`
      )
    }
  }, [starting, status])

  const documentsByDossier = useMemo(
    () => groupDocumentsByDossier(status?.documents ?? []),
    [status?.documents]
  )
  const dossierPagination = usePagedItems(documentsByDossier, {
    defaultPageSize: 50,
    resetKey: sessionId ?? "",
    storageKey: "archival-processing.numbering-dossier-page-size",
  })
  const pagedDocumentsByDossier = dossierPagination.items
  const previewDocument = useMemo(
    () =>
      (status?.documents ?? []).find(
        (document) => document.session_document_id === previewDocumentId
      ) ?? null,
    [previewDocumentId, status?.documents]
  )
  const previewSessionDocumentId = previewDocument?.session_document_id ?? null
  const previewPdfVersionId = previewDocument?.numbered_pdf_version_id ?? null

  useEffect(() => {
    if (
      !sessionId ||
      previewSessionDocumentId === null ||
      previewPdfVersionId === null ||
      previewPdfVersionId === ""
    ) {
      setPreviewUrl("")
      setPreviewError("")
      setPreviewLoading(false)
      return
    }

    let cancelled = false
    setPreviewUrl("")
    setPreviewError("")
    setPreviewLoading(true)
    getNumberedDocumentPreviewUrl(sessionId, previewSessionDocumentId)
      .then((response) => {
        if (!cancelled) setPreviewUrl(response.download_url)
      })
      .catch((err) => {
        if (cancelled) return
        setPreviewError(
          err instanceof Error
            ? err.message
            : "Không thể cấp URL preview PDF đã đánh số."
        )
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [
    previewPdfVersionId,
    previewRefreshKey,
    previewSessionDocumentId,
    sessionId,
  ])
  const totalDocuments = status?.summary.total_documents ?? 0
  const doneCount = status?.summary.done ?? 0
  const failedCount = status?.summary.failed ?? 0
  const complete = Boolean(status && isNumberingComplete(status))
  const active = starting || Boolean(status?.active)
  const queuedForWorker =
    status?.active === true && status.job?.status === "queued"
  const activeWorkerId =
    status?.job?.status === "running" ? status.job.locked_by : null
  const metadataBusy = metadataExporting || metadataImporting
  const canContinue = complete && failedCount === 0
  const changeNumberingMode = async (mode: DocumentNumberingMode) => {
    if (active || changingMode || mode === documentNumberingMode) return
    const hadCompletedNumbering = complete
    setChangingMode(true)
    setError("")
    try {
      const saved = await onDocumentNumberingModeChange(mode)
      if (saved === false) return
      await refreshStatus({ silent: true })
      setProgressPhase(null)
      setProgressMessage("")
      setCompletedPhases(new Set())
      if (hadCompletedNumbering) {
        toast.info("Đã đổi cách đánh số. Vui lòng đánh số lại tài liệu.")
      }
    } finally {
      setChangingMode(false)
    }
  }
  const modeLabel =
    documentNumberingMode === "sheet" ? "Đánh số theo tờ" : "Đánh số theo trang"

  return (
    <div className="flex flex-col gap-5">
      <NumberingStepHeader
        modeLabel={modeLabel}
        documentNumberingMode={documentNumberingMode}
        changingMode={changingMode}
        loading={loading}
        starting={starting}
        active={active}
        complete={complete}
        onRefresh={refreshStatus}
        onStart={() => startNumbering(false)}
        onModeChange={changeNumberingMode}
      />
      <NumberingMetadataPanel
        metadataImportInputRef={metadataImportInputRef}
        sessionId={sessionId}
        active={active}
        metadataBusy={metadataBusy}
        metadataExporting={metadataExporting}
        metadataImporting={metadataImporting}
        onExportMetadata={exportMetadata}
        onImportMetadataBoxNumbers={importMetadataBoxNumbers}
      />
      {(status?.active || progressMessage || starting) && (
        <ProgressTimeline
          phases={NUMBERING_PROGRESS_PHASES}
          activePhase={progressPhase}
          completedPhases={completedPhases}
          title="Tiến trình đánh số"
          message={
            queuedForWorker
              ? "Task đang chờ worker artifacts nhận xử lý."
              : activeWorkerId
                ? `${progressMessage || "Đang xử lý PDF đánh số."} Worker: ${activeWorkerId}.`
                : progressMessage || "Đang xử lý PDF đánh số."
          }
        />
      )}
      {queuedForWorker ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            Job đánh số đã được tạo nhưng chưa có worker nhận. Kiểm tra worker
            artifacts có khai báo job type <code>number_documents</code>.
          </span>
        </div>
      ) : null}
      {error ? (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <NumberingStat label="Tổng tài liệu" value={totalDocuments} />
        <NumberingStat label="Đã đánh số" value={doneCount} tone="success" />
        <NumberingStat
          label="Lỗi"
          value={failedCount}
          tone={failedCount ? "danger" : "neutral"}
        />
      </div>
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)] xl:items-start">
        <div className="min-w-0 overflow-hidden rounded-2xl border border-[#CBD5E1] bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-[#E2E8F0] px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">
                Danh sách PDF đánh số
              </p>
              <p className="mt-1 text-xs text-[#64748B]">
                Các tài liệu được nhóm theo hồ sơ đang active.
              </p>
            </div>
          </div>
          {documentsByDossier.length > 0 && (
            <div className="border-b border-[#E2E8F0] px-4 py-3">
              <PaginationControls
                total={dossierPagination.total}
                pageIndex={dossierPagination.pageIndex}
                pageSize={dossierPagination.pageSize}
                pageCount={dossierPagination.pageCount}
                startNumber={dossierPagination.startNumber}
                endNumber={dossierPagination.endNumber}
                pageSizeOptions={dossierPagination.pageSizeOptions}
                itemLabel="hồ sơ"
                onPageChange={dossierPagination.setPageIndex}
                onPageSizeChange={dossierPagination.setPageSize}
              />
            </div>
          )}

          {loading ? (
            <div className="flex min-h-48 items-center justify-center text-sm text-[#64748B]">
              <Loader2 className="mr-2 size-4 animate-spin text-[#0052FF]" />
              Đang tải trạng thái đánh số...
            </div>
          ) : documentsByDossier.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center px-6 text-center text-sm text-[#64748B]">
              Chưa có tài liệu trong hồ sơ active để đánh số.
            </div>
          ) : (
            <div className="max-h-[min(72svh,760px)] divide-y divide-[#E2E8F0] overflow-x-hidden overflow-y-auto">
              {pagedDocumentsByDossier.map((group) => (
                <section key={group.dossierId} className="px-4 py-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#0F172A]">
                        {group.title || group.dossierId}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[#64748B]">
                        <span>{group.documents.length} tài liệu</span>
                        <DossierMetaChip
                          label="Hồ sơ số"
                          value={group.dossierNumber}
                        />
                        <DossierMetaChip
                          label="Hộp số"
                          value={group.boxNumber}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    {group.documents.map((document) => (
                      <NumberingDocumentRow
                        key={document.session_document_id}
                        document={document}
                        previewing={
                          previewDocumentId === document.session_document_id
                        }
                        onPreview={() =>
                          setPreviewDocumentId(document.session_document_id)
                        }
                        onUpdateFromPage={updateDocumentNumberFromPage}
                        updating={
                          updatingDocumentId === document.session_document_id
                        }
                        disabled={
                          starting ||
                          Boolean(status?.active) ||
                          updatingDocumentId !== null
                        }
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
        <NumberedPdfPreviewPanel
          document={previewDocument}
          previewUrl={previewUrl}
          loading={previewLoading}
          error={previewError}
          onRefresh={() => setPreviewRefreshKey((key) => key + 1)}
          onClose={() => setPreviewDocumentId(null)}
        />
      </div>
      <NumberingStepFooter
        active={active}
        metadataBusy={metadataBusy}
        canContinue={canContinue}
        doneCount={doneCount}
        totalDocuments={totalDocuments}
        failedCount={failedCount}
        onContinue={onContinue}
      />
    </div>
  )
}
