import {
  type FormEvent,
  type RefObject,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  ArrowRight,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Loader2,
  Play,
  RefreshCw,
  Save,
  Upload,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/shared/lib/utils"
import type { NumberingDocumentStatus } from "@/features/upload/api/sessionApi"
import {
  numberingEntries,
  compactPageList,
  statusBadge,
  textOrNull,
} from "./NumberingStep.utils"

export function NumberingStepHeader({
  modeLabel,
  loading,
  starting,
  active,
  complete,
  onRefresh,
  onStart,
}: {
  modeLabel: string
  loading: boolean
  starting: boolean
  active: boolean
  complete: boolean
  onRefresh: () => void | Promise<unknown>
  onStart: () => void | Promise<unknown>
}) {
  return (
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
            {modeLabel}. Mỗi hồ sơ bắt đầu lại từ số 1; bản render dùng kiểu chữ
            pencil mặc định.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void onRefresh()}
            disabled={loading || starting}
          >
            <RefreshCw data-icon="inline-start" />
            Làm mới
          </Button>
          <Button
            type="button"
            onClick={() => void onStart()}
            disabled={active}
          >
            {active ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <Play data-icon="inline-start" />
            )}
            {complete ? "Lấy kết quả" : "Bắt đầu đánh số"}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function NumberingMetadataPanel({
  metadataImportInputRef,
  sessionId,
  active,
  metadataBusy,
  metadataExporting,
  metadataImporting,
  onExportMetadata,
  onImportMetadataBoxNumbers,
}: {
  metadataImportInputRef: RefObject<HTMLInputElement | null>
  sessionId: string | null
  active: boolean
  metadataBusy: boolean
  metadataExporting: boolean
  metadataImporting: boolean
  onExportMetadata: () => void | Promise<unknown>
  onImportMetadataBoxNumbers: (file: File | null) => void | Promise<unknown>
}) {
  return (
    <div className="rounded-2xl border border-[#CBD5E1] bg-white px-5 py-4 shadow-sm">
      <input
        ref={metadataImportInputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0] ?? null
          event.currentTarget.value = ""
          void onImportMetadataBoxNumbers(file)
        }}
      />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#0F172A]">
            Metadata snapshot & số hộp
          </p>
          <p className="mt-1 max-w-3xl text-sm text-[#64748B]">
            Xuất snapshot metadata từ phiên bản hồ sơ hiện hành, điền số hộp
            trong file Excel rồi nhập lại trước khi tạo mục lục.
          </p>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:w-auto">
          <Button
            type="button"
            variant="outline"
            onClick={() => void onExportMetadata()}
            disabled={!sessionId || active || metadataBusy}
            className="w-full lg:w-auto"
          >
            {metadataExporting ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <FileSpreadsheet data-icon="inline-start" />
            )}
            Xuất metadata
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => metadataImportInputRef.current?.click()}
            disabled={!sessionId || active || metadataBusy}
            className="w-full lg:w-auto"
          >
            {metadataImporting ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <Upload data-icon="inline-start" />
            )}
            Nhập số hộp
          </Button>
        </div>
      </div>
    </div>
  )
}

export function NumberingStepFooter({
  active,
  metadataBusy,
  canContinue,
  doneCount,
  totalDocuments,
  failedCount,
  onContinue,
}: {
  active: boolean
  metadataBusy: boolean
  canContinue: boolean
  doneCount: number
  totalDocuments: number
  failedCount: number
  onContinue: () => void
}) {
  return (
    <div className="sticky bottom-0 z-20 -mx-3 border-t border-[#D8E1EC] bg-white/95 px-3 py-3 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#0F172A]">
            {active
              ? "Đang đánh số tài liệu"
              : metadataBusy
                ? "Đang cập nhật metadata"
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
          disabled={!canContinue || metadataBusy}
          className="w-full sm:w-auto"
        >
          Tạo mục lục
          <ArrowRight data-icon="inline-end" />
        </Button>
      </div>
    </div>
  )
}

export function NumberingStat({
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

export function DossierMetaChip({
  label,
  value,
}: {
  label: string
  value?: string | number | null
}) {
  const displayValue = textOrNull(value) ?? "Chưa có"
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#D8E1EC] bg-[#F8FAFC] px-2 py-0.5">
      <span className="font-medium text-[#64748B]">{label}:</span>
      <span
        className={cn(
          "truncate font-semibold",
          displayValue === "Chưa có" ? "text-[#94A3B8]" : "text-[#0F172A]"
        )}
      >
        {displayValue}
      </span>
    </span>
  )
}

export function NumberingDocumentRow({
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
          className="h-7 w-14 shrink-0 rounded-md border border-[#CBD5E1] bg-white px-1.5 text-center text-xs font-medium text-[#0F172A] tabular-nums transition-colors outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/10 disabled:bg-[#F1F5F9] disabled:text-[#94A3B8]"
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
          className="h-7 w-16 shrink-0 rounded-md border border-[#CBD5E1] bg-white px-1.5 text-center text-xs font-medium text-[#0F172A] tabular-nums transition-colors outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/10 disabled:bg-[#F1F5F9] disabled:text-[#94A3B8]"
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
