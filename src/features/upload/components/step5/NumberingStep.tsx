import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  AlertTriangle,
  ArrowRight,
  Download,
  Eye,
  FileText,
  Loader2,
  Play,
  RefreshCw,
  Save,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ProgressTimeline } from "@/features/upload/components/ProgressTimeline"
import {
  enqueueDocumentNumbering,
  getDocumentNumberingStatus,
  updateDocumentNumberingFromPage,
  type NumberingDocumentStatus,
  type NumberingStatusResponse,
} from "@/features/upload/api/sessionApi"
import { cn } from "@/shared/lib/utils"

const NUMBERING_POLL_INTERVAL_MS = 3_000
const NUMBERING_PROGRESS_PHASES = [
  { id: "loading_data", label: "Chuẩn bị hồ sơ" },
  { id: "rendering_document", label: "Đánh số PDF" },
  { id: "completed", label: "Hoàn tất" },
]

interface NumberingStepProps {
  sessionId: string | null
  autoStart?: boolean
  onAutoStartHandled?: () => void
  onContinue: () => void
}

export function NumberingStep({
  sessionId,
  autoStart = false,
  onAutoStartHandled,
  onContinue,
}: NumberingStepProps) {
  const autoStartHandled = useRef(false)
  const [status, setStatus] = useState<NumberingStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [updatingDocumentId, setUpdatingDocumentId] = useState<number | null>(
    null
  )
  const [error, setError] = useState("")
  const [progressPhase, setProgressPhase] = useState<string | null>(null)
  const [progressMessage, setProgressMessage] = useState("")
  const [previewDocumentId, setPreviewDocumentId] = useState<number | null>(
    null
  )
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
        if (response.created) {
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
  const previewDocument = useMemo(
    () =>
      (status?.documents ?? []).find(
        (document) => document.session_document_id === previewDocumentId
      ) ?? null,
    [previewDocumentId, status?.documents]
  )
  const totalDocuments = status?.summary.total_documents ?? 0
  const doneCount = status?.summary.done ?? 0
  const failedCount = status?.summary.failed ?? 0
  const complete = Boolean(status && isNumberingComplete(status))
  const active = starting || Boolean(status?.active)
  const canContinue = complete && failedCount === 0
  const modeLabel =
    status?.document_numbering_mode === "sheet"
      ? "Đánh số theo tờ"
      : "Đánh số theo trang"

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-[#CBD5E1] bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-[0.14em] text-[#64748B] uppercase">
              Đánh số trang
            </p>
            <h2 className="mt-1 text-2xl font-semibold text-[#0F172A]">
              Tạo PDF đã đánh số cho từng tài liệu
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-[#475569]">
              {modeLabel}. Mỗi hồ sơ bắt đầu lại từ số 1; bản render dùng kiểu
              chữ pencil mặc định.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void refreshStatus()}
              disabled={loading || starting}
            >
              <RefreshCw data-icon="inline-start" />
              Làm mới
            </Button>
            <Button
              type="button"
              onClick={() => void startNumbering(complete)}
              disabled={active}
            >
              {active ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <Play data-icon="inline-start" />
              )}
              {complete ? "Đánh số lại" : "Bắt đầu đánh số"}
            </Button>
          </div>
        </div>
      </div>

      {(status?.active || progressMessage || starting) && (
        <ProgressTimeline
          phases={NUMBERING_PROGRESS_PHASES}
          activePhase={progressPhase}
          completedPhases={completedPhases}
          title="Tiến trình đánh số"
          message={progressMessage || "Đang xử lý PDF đánh số."}
        />
      )}

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
            <div className="max-h-[min(72svh,760px)] divide-y divide-[#E2E8F0] overflow-y-auto overflow-x-hidden">
              {documentsByDossier.map((group) => (
                <section key={group.dossierId} className="px-4 py-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#0F172A]">
                        {group.title || group.dossierId}
                      </p>
                      <p className="text-xs text-[#64748B]">
                        {group.documents.length} tài liệu
                      </p>
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
          onClose={() => setPreviewDocumentId(null)}
        />
      </div>

      <div className="sticky bottom-0 z-20 -mx-3 border-t border-[#D8E1EC] bg-white/95 px-3 py-3 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#0F172A]">
              {active
                ? "Đang đánh số tài liệu"
                : canContinue
                  ? "Đã sẵn sàng tạo mục lục"
                  : "Hoàn tất đánh số trước khi tạo mục lục"}
            </p>
            <p className="mt-1 text-xs text-[#64748B]">
              Đã đánh số {doneCount}/{totalDocuments} tài liệu
              {failedCount > 0 ? `, ${failedCount} tài liệu lỗi` : ""}.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={onContinue}
            disabled={!canContinue}
            className="w-full sm:w-auto"
          >
            Tạo mục lục
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function NumberingStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string
  value: number
  tone?: "neutral" | "success" | "danger"
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-white px-4 py-3 shadow-sm",
        tone === "success"
          ? "border-emerald-200"
          : tone === "danger"
            ? "border-rose-200"
            : "border-[#CBD5E1]"
      )}
    >
      <p className="text-xs font-medium text-[#64748B]">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold",
          tone === "success"
            ? "text-emerald-700"
            : tone === "danger"
              ? "text-rose-700"
              : "text-[#0F172A]"
        )}
      >
        {value}
      </p>
    </div>
  )
}

function NumberingDocumentRow({
  document,
  previewing,
  onPreview,
  onUpdateFromPage,
  updating,
  disabled,
}: {
  document: NumberingDocumentStatus
  previewing: boolean
  onPreview: () => void
  onUpdateFromPage: (
    document: NumberingDocumentStatus,
    anchorPageNumber: number,
    newNumber: number
  ) => void
  updating: boolean
  disabled: boolean
}) {
  const entries = useMemo(() => numberingEntries(document), [document])
  const [pageValue, setPageValue] = useState(
    String(entries[0]?.page_number ?? 1)
  )
  const [numberValue, setNumberValue] = useState(
    String(entries[0]?.label ?? document.document_number_start)
  )
  useEffect(() => {
    const firstEntry = entries[0]
    setPageValue(String(firstEntry?.page_number ?? 1))
    setNumberValue(String(firstEntry?.label ?? document.document_number_start))
  }, [document.document_number_start, document.session_document_id, entries])

  const badge = statusBadge(document.status)
  const parsedPageNumber = Number.parseInt(pageValue, 10)
  const parsedNewNumber = Number.parseInt(numberValue, 10)
  const selectedEntry = entries.find(
    (entry) => entry.page_number === parsedPageNumber
  )
  const selectedCurrentNumber = selectedEntry
    ? Number.parseInt(selectedEntry.label, 10)
    : Number.NaN
  const canUpdate =
    Boolean(selectedEntry) &&
    Number.isFinite(parsedNewNumber) &&
    parsedNewNumber > 0 &&
    parsedNewNumber !== selectedCurrentNumber &&
    !disabled &&
    !updating
  const span =
    document.document_number_start === document.document_number_end
      ? String(document.document_number_start)
      : `${document.document_number_start}-${document.document_number_end}`
  const handleUpdate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canUpdate) return
    onUpdateFromPage(document, parsedPageNumber, parsedNewNumber)
  }
  const updatePageValue = (value: string) => {
    setPageValue(value)
    const pageNumber = Number.parseInt(value, 10)
    const entry = entries.find((item) => item.page_number === pageNumber)
    if (entry) setNumberValue(entry.label)
  }
  return (
    <div className="grid min-w-0 gap-2 overflow-hidden rounded-xl border border-[#D8E1EC] bg-[#F8FAFC] px-3 py-2.5 lg:grid-cols-[minmax(10rem,1fr)_auto_auto] lg:items-center">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#EAF1FF] text-[#0052FF]">
          <FileText className="size-3.5" />
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-[#0F172A]">
              {document.file_name || document.document_id}
            </p>
            <span
              className={cn(
                "inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                badge.className
              )}
            >
              {badge.label}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-[#64748B]">
            Số {span} · {document.entry_count} vị trí đánh số
            {document.blank_pages.length > 0
              ? ` · Trang trắng: ${compactPageList(document.blank_pages)}`
              : ""}
          </p>
          {document.error ? (
            <p className="mt-1 text-xs text-rose-700">{document.error}</p>
          ) : null}
        </div>
      </div>
      <form
        onSubmit={handleUpdate}
        className="flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto lg:justify-end"
      >
        <label
          htmlFor={`numbering-page-${document.session_document_id}`}
          className="shrink-0 text-[11px] font-medium text-[#64748B]"
        >
          Trang
        </label>
        <input
          id={`numbering-page-${document.session_document_id}`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={pageValue}
          onChange={(event) => updatePageValue(event.target.value)}
          disabled={disabled || updating}
          className="h-7 w-14 shrink-0 rounded-md border border-[#CBD5E1] bg-white px-1.5 text-center text-xs font-medium tabular-nums text-[#0F172A] transition-colors outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/10 disabled:bg-[#F1F5F9] disabled:text-[#94A3B8]"
        />
        <label
          htmlFor={`numbering-value-${document.session_document_id}`}
          className="shrink-0 text-[11px] font-medium text-[#64748B]"
        >
          Số mới
        </label>
        <input
          id={`numbering-value-${document.session_document_id}`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={numberValue}
          onChange={(event) => setNumberValue(event.target.value)}
          disabled={disabled || updating}
          className="h-7 w-16 shrink-0 rounded-md border border-[#CBD5E1] bg-white px-1.5 text-center text-xs font-medium tabular-nums text-[#0F172A] transition-colors outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/10 disabled:bg-[#F1F5F9] disabled:text-[#94A3B8]"
        />
        <button
          type="submit"
          disabled={!canUpdate}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-[#CBD5E1] bg-white text-[#475569] transition-colors hover:border-[#0052FF]/40 hover:text-[#0052FF] disabled:pointer-events-none disabled:opacity-50"
          title="Cập nhật từ trang này"
          aria-label="Cập nhật từ trang này"
        >
          {updating ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Save className="size-3.5" />
          )}
        </button>
      </form>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 lg:justify-end">
        {document.download_url ? (
          <>
            <button
              type="button"
              onClick={onPreview}
              title="Preview"
              aria-label="Preview"
              className={cn(
                "inline-flex size-8 items-center justify-center rounded-lg border text-[#475569] transition-colors",
                previewing
                  ? "border-[#0052FF] bg-[#EAF1FF] text-[#0052FF]"
                  : "border-[#CBD5E1] bg-white text-[#475569] hover:border-[#0052FF]/40 hover:text-[#0052FF]"
              )}
            >
              <Eye className="size-3.5" />
            </button>
            <a
              href={document.download_url}
              target="_blank"
              rel="noreferrer"
              title="Mở PDF"
              aria-label="Mở PDF"
              className="inline-flex size-8 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white text-[#475569] transition-colors hover:border-[#0052FF]/40 hover:text-[#0052FF]"
            >
              <Download className="size-3.5" />
            </a>
          </>
        ) : document.status === "running" ? (
          <Loader2 className="size-4 animate-spin text-[#0052FF]" />
        ) : null}
      </div>
    </div>
  )
}

function NumberedPdfPreviewPanel({
  document,
  onClose,
}: {
  document: NumberingDocumentStatus | null
  onClose: () => void
}) {
  const previewUrl = document?.download_url
    ? pdfEmbedUrl(document.download_url)
    : ""
  return (
    <section className="min-h-[420px] min-w-0 overflow-hidden rounded-2xl border border-[#D8E1EC] bg-white shadow-sm xl:sticky xl:top-4 xl:self-start">
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-[#EEF2F7] px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#0F172A]">
            Preview PDF đã đánh số
          </p>
          <p className="mt-0.5 truncate text-xs text-[#64748B]">
            {document
              ? document.file_name || document.document_id
              : "Chọn một PDF đã đánh số để xem trước."}
          </p>
        </div>
        {document ? (
          <div className="flex shrink-0 items-center gap-2">
            {document.download_url ? (
              <a
                href={document.download_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs font-medium text-[#475569] transition-colors hover:border-[#0052FF]/40 hover:text-[#0052FF]"
              >
                <Download className="size-3.5" />
                Mở PDF
              </a>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex size-8 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white text-[#475569] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A]"
              title="Đóng preview"
              aria-label="Đóng preview"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : null}
      </div>
      {document && previewUrl ? (
        <iframe
          title={`Preview PDF đã đánh số ${document.file_name || document.document_id}`}
          src={previewUrl}
          className="h-[min(72svh,760px)] min-h-[420px] w-full border-0 bg-white"
        />
      ) : (
        <div className="flex h-[min(72svh,760px)] min-h-[420px] flex-col items-center justify-center px-8 text-center text-sm text-[#64748B]">
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-[#EAF1FF] text-[#0052FF]">
            <Eye className="size-6" />
          </div>
          <p className="font-medium text-[#0F172A]">
            Chọn một PDF đã đánh số để preview.
          </p>
        </div>
      )}
    </section>
  )
}

function numberingEntries(document: NumberingDocumentStatus): Array<{
  page_number: number
  label: string
}> {
  if (
    Array.isArray(document.numbering_entries) &&
    document.numbering_entries.length > 0
  ) {
    return document.numbering_entries
      .map((entry) => ({
        page_number: Number(entry.page_number),
        label: String(entry.label || ""),
      }))
      .filter(
        (entry) => Number.isFinite(entry.page_number) && entry.page_number > 0
      )
  }
  if (
    Array.isArray(document.numbering_pages) &&
    document.numbering_pages.length > 0
  ) {
    return document.numbering_pages
      .map((pageNumber, index) => ({
        page_number: Number(pageNumber),
        label: String(document.document_number_start + index),
      }))
      .filter(
        (entry) => Number.isFinite(entry.page_number) && entry.page_number > 0
      )
  }
  return Array.from(
    { length: Math.max(0, document.entry_count) },
    (_, index) => ({
      page_number: index + 1,
      label: String(document.document_number_start + index),
    })
  )
}

function groupDocumentsByDossier(documents: NumberingDocumentStatus[]) {
  const groups: Array<{
    dossierId: string
    title: string
    documents: NumberingDocumentStatus[]
  }> = []
  const byId = new Map<string, (typeof groups)[number]>()
  for (const document of documents) {
    const dossierId = document.dossier_id || "unknown"
    let group = byId.get(dossierId)
    if (!group) {
      group = {
        dossierId,
        title: document.dossier_title || dossierId,
        documents: [],
      }
      byId.set(dossierId, group)
      groups.push(group)
    }
    group.documents.push(document)
  }
  return groups
}

function isNumberingComplete(status: NumberingStatusResponse): boolean {
  const total = status.summary.total_documents
  if (total <= 0) return false
  return status.summary.done + status.summary.failed >= total && !status.active
}

function statusBadge(status: string): { label: string; className: string } {
  if (status === "done") {
    return {
      label: "Sẵn sàng",
      className: "bg-emerald-50 text-emerald-700",
    }
  }
  if (status === "running") {
    return {
      label: "Đang xử lý",
      className: "bg-amber-50 text-amber-700",
    }
  }
  if (status === "failed") {
    return {
      label: "Lỗi",
      className: "bg-rose-50 text-rose-700",
    }
  }
  return {
    label: "Chờ xử lý",
    className: "bg-slate-100 text-slate-700",
  }
}

function compactPageList(pages: number[]): string {
  if (pages.length <= 8) return pages.join(", ")
  return `${pages.slice(0, 8).join(", ")} +${pages.length - 8}`
}

function pdfEmbedUrl(url: string): string {
  if (!url) return ""
  const separator = url.includes("#") ? "&" : "#"
  return `${url}${separator}toolbar=1&navpanes=0`
}
