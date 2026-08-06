import {
  type FormEvent,
  type RefObject,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Eye,
  FileSpreadsheet,
  FileText,
  Loader2,
  Minus,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Upload,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/shared/lib/utils"
import type {
  DocumentNumberingMode,
  DocumentNumberingStylePreset,
  MetadataBoxNumberImportResponse,
  MetadataCountConflict,
  NumberingDocumentStatus,
  NumberingStyleOption,
} from "@/features/upload/api/sessionApi"
import {
  canPreviewNumberingDocument,
  type NumberingEntry,
  numberingEntries,
  statusBadge,
  textOrNull,
} from "./NumberingStep.utils"

export type DossierUpdateMode = "auto" | "manual"
export type NumberingUpdateMode = DossierUpdateMode | "cascade"
const METADATA_COUNT_CONFLICT_WARNING_ENABLED = true

function formatRowNumberRanges(values: number[]): string {
  const rowNumbers = [...new Set(values)]
    .filter((value) => Number.isInteger(value))
    .sort((left, right) => left - right)
  if (!rowNumbers.length) return ""

  const ranges: string[] = []
  let rangeStart = rowNumbers[0]
  let rangeEnd = rowNumbers[0]
  for (const rowNumber of rowNumbers.slice(1)) {
    if (rowNumber === rangeEnd + 1) {
      rangeEnd = rowNumber
      continue
    }
    ranges.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}–${rangeEnd}`)
    rangeStart = rowNumber
    rangeEnd = rowNumber
  }
  ranges.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}–${rangeEnd}`)
  return ranges.join(", ")
}

export function NumberingStepHeader({
  modeLabel,
  documentNumberingMode,
  documentNumberingStylePreset,
  documentNumberingStyleOverrides,
  numberingStyleOptions,
  changingMode,
  loading,
  starting,
  active,
  complete,
  hasPendingConfigChanges,
  canRestart,
  onRefresh,
  onStart,
  onRestart,
  onModeChange,
  onStyleChange,
  onOverridesChange,
}: {
  modeLabel: string
  documentNumberingMode: DocumentNumberingMode
  documentNumberingStylePreset: DocumentNumberingStylePreset
  documentNumberingStyleOverrides?: {
    font_size?: number
    color?: string
    opacity?: number
  }
  numberingStyleOptions: NumberingStyleOption[]
  changingMode: boolean
  loading: boolean
  starting: boolean
  active: boolean
  complete: boolean
  hasPendingConfigChanges: boolean
  canRestart: boolean
  onRefresh: () => void | Promise<unknown>
  onStart: () => void | Promise<unknown>
  onRestart: () => void | Promise<unknown>
  onModeChange: (mode: DocumentNumberingMode) => void | Promise<unknown>
  onStyleChange: (
    stylePreset: DocumentNumberingStylePreset
  ) => void | Promise<unknown>
  onOverridesChange?: (ov: {
    font_size?: number
    color?: string
    opacity?: number
  }) => void | Promise<unknown>
}) {
  const selectedStyle = numberingStyleOptions.find(
    (style) => style.style_preset === documentNumberingStylePreset
  )
  const hasOverrides =
    documentNumberingStyleOverrides &&
    Object.keys(documentNumberingStyleOverrides).some(
      (k) =>
        documentNumberingStyleOverrides[
          k as keyof typeof documentNumberingStyleOverrides
        ] != null
    )
  const styleLabel =
    (selectedStyle?.display_name ||
      selectedStyle?.name ||
      documentNumberingStylePreset) + (hasOverrides ? " (tùy chỉnh)" : "")
  const controlsDisabled = active || loading
  const baseFontSize =
    selectedStyle?.font_size ??
    (selectedStyle as { fontSize?: number } | undefined)?.fontSize ??
    14
  const currentFontSize =
    documentNumberingStyleOverrides?.font_size ?? baseFontSize
  const [fontSizeDraft, setFontSizeDraft] = useState(String(currentFontSize))
  const [fontSizeDirty, setFontSizeDirty] = useState(false)
  useEffect(() => {
    setFontSizeDraft(String(currentFontSize))
    setFontSizeDirty(false)
  }, [currentFontSize])
  const commitFontSizeDraft = () => {
    if (controlsDisabled || !onOverridesChange) return
    if (!fontSizeDirty) return
    const trimmed = fontSizeDraft.trim()
    const value = trimmed === "" ? undefined : Number(trimmed)
    if (
      trimmed !== "" &&
      (typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 1 ||
        value > 200)
    ) {
      setFontSizeDraft(String(currentFontSize))
      setFontSizeDirty(false)
      return
    }
    if (value === currentFontSize) {
      setFontSizeDirty(false)
      return
    }
    setFontSizeDirty(false)
    void onOverridesChange({
      ...(documentNumberingStyleOverrides || {}),
      font_size: value,
    })
  }
  return (
    <div className="rounded-2xl border border-[#CBD5E1] bg-white px-5 py-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-[0.14em] text-[#64748B] uppercase">
            Đánh số trang
          </p>
          <h2 className="mt-1 font-sans text-2xl font-semibold tracking-normal text-[#0F172A]">
            Tạo PDF đã đánh số cho từng tài liệu
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-[#475569]">
            {modeLabel}. Mỗi hồ sơ bắt đầu lại từ số 1; bản render dùng kiểu chữ
            pencil mặc định.
          </p>
          <div
            className="mt-4 inline-flex rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] p-1"
            role="radiogroup"
            aria-label="Cách đánh số tài liệu"
          >
            {(
              [
                ["page", "Theo trang"],
                ["sheet", "Theo tờ"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={documentNumberingMode === mode}
                disabled={active || changingMode || loading}
                onClick={() => void onModeChange(mode)}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                  documentNumberingMode === mode
                    ? "bg-[#0052FF] text-white shadow-sm"
                    : "text-[#475569] hover:bg-white hover:text-[#0052FF]"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            className="mt-3 flex flex-wrap gap-2"
            role="radiogroup"
            aria-label="Kiểu hiển thị số trang"
          >
            <span className="flex items-center pr-1 text-sm font-semibold text-[#475569]">
              Kiểu số: {styleLabel}
            </span>
            {hasPendingConfigChanges ? (
              <span className="flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                Chưa áp dụng
              </span>
            ) : null}
            {numberingStyleOptions.map((style) => {
              const label =
                style.display_name || style.name || style.style_preset
              return (
                <button
                  key={style.style_preset}
                  type="button"
                  role="radio"
                  aria-checked={
                    documentNumberingStylePreset === style.style_preset
                  }
                  disabled={active || loading}
                  title={style.description || label}
                  onClick={() => void onStyleChange(style.style_preset)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                    documentNumberingStylePreset === style.style_preset
                      ? "border-[#0052FF] bg-[#EEF4FF] text-[#0052FF]"
                      : "border-[#CBD5E1] bg-white text-[#475569] hover:border-[#0052FF]/40 hover:text-[#0052FF]"
                  )}
                >
                  <span className="block">{label}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-medium text-[#64748B]">
                    {style.color ? (
                      <span
                        className="inline-block size-3 rounded-full border border-[#CBD5E1]"
                        style={{ backgroundColor: style.color }}
                      />
                    ) : null}
                    <span>{numberingStyleDetails(style)}</span>
                  </span>
                </button>
              )
            })}
          </div>

          {/* Compact customization for overrides in numbering page */}
          {onOverridesChange && (
            <div className="mt-3 border-t border-[#E2E8F0] pt-3 text-xs">
              <div className="mb-1 flex items-center gap-2 text-[#475569]">
                <span>Tùy chỉnh:</span>
                <button
                  type="button"
                  onClick={() => void onOverridesChange({})}
                  disabled={controlsDisabled}
                  className="text-[#64748B] underline-offset-1 hover:text-[#0052FF] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                >
                  reset
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {/* size */}
                <div className="flex items-center gap-1">
                  <span className="text-[#64748B]">Size</span>
                  <input
                    type="number"
                    min={6}
                    max={48}
                    step={0.5}
                    disabled={controlsDisabled}
                    value={fontSizeDraft}
                    onChange={(event) => {
                      setFontSizeDraft(event.target.value)
                      setFontSizeDirty(true)
                    }}
                    onBlur={commitFontSizeDraft}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return
                      event.currentTarget.blur()
                    }}
                    className="w-16 rounded border border-[#CBD5E1] px-1.5 py-0.5 text-xs"
                  />
                </div>
                {/* color swatches compact */}
                <div className="flex items-center gap-1">
                  <span className="text-[#64748B]">Màu</span>
                  {["#757573", "#3D3D3B", "#000000", "#1E3A5F"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      disabled={controlsDisabled}
                      className="size-4 rounded border border-[#CBD5E1] disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ background: c }}
                      onClick={() =>
                        void onOverridesChange({
                          ...(documentNumberingStyleOverrides || {}),
                          color: c,
                        })
                      }
                    />
                  ))}
                  <input
                    type="color"
                    className="size-4 rounded border border-[#CBD5E1] p-0"
                    disabled={controlsDisabled}
                    value={documentNumberingStyleOverrides?.color || "#757573"}
                    onChange={(e) =>
                      void onOverridesChange({
                        ...(documentNumberingStyleOverrides || {}),
                        color: e.target.value,
                      })
                    }
                  />
                </div>
                {/* opacity compact */}
                <div className="flex min-w-[110px] items-center gap-1">
                  <span className="text-[#64748B]">Độ mờ</span>
                  <input
                    type="range"
                    min={0.2}
                    max={1}
                    step={0.05}
                    disabled={controlsDisabled}
                    value={documentNumberingStyleOverrides?.opacity ?? 0.75}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value)
                      void onOverridesChange({
                        ...(documentNumberingStyleOverrides || {}),
                        opacity: isNaN(v) ? undefined : v,
                      })
                    }}
                    className="w-16 accent-[#0052FF]"
                  />
                  <span className="w-8 text-right tabular-nums">
                    {Math.round(
                      (documentNumberingStyleOverrides?.opacity ?? 0.75) * 100
                    )}
                    %
                  </span>
                </div>
              </div>
            </div>
          )}
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
          {canRestart ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void onRestart()}
              disabled={active || changingMode || loading}
            >
              {active ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <RotateCcw data-icon="inline-start" />
              )}
              Đánh số lại
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={() => void onStart()}
            disabled={active || changingMode}
          >
            {active ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <Play data-icon="inline-start" />
            )}
            {hasPendingConfigChanges
              ? "Áp dụng và đánh số lại"
              : complete
                ? "Lấy kết quả"
                : "Bắt đầu đánh số"}
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
  metadataImportReview,
  onExportMetadata,
  onImportMetadataBoxNumbers,
}: {
  metadataImportInputRef: RefObject<HTMLInputElement | null>
  sessionId: string | null
  active: boolean
  metadataBusy: boolean
  metadataExporting: boolean
  metadataImporting: boolean
  metadataImportReview: MetadataBoxNumberImportResponse | null
  onExportMetadata: () => void | Promise<unknown>
  onImportMetadataBoxNumbers: (file: File | null) => void | Promise<unknown>
}) {
  const countConflicts = METADATA_COUNT_CONFLICT_WARNING_ENABLED
    ? metadataImportReview?.count_conflicts ?? []
    : []
  const conflictDossierCount = new Set(
    countConflicts.map((conflict) =>
      String(
        conflict.session_dossier_id ||
          conflict.dossier_id ||
          conflict.cluster_id
      )
    )
  ).size
  const rowConflictCount =
    metadataImportReview?.row_conflict_count ??
    Math.max(
      0,
      (metadataImportReview?.conflict_count ?? 0) -
        (metadataImportReview?.count_conflict_count ?? 0)
    )
  const unresolvedRowCount =
    (metadataImportReview?.unmatched_rows ?? 0) + rowConflictCount

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
            Metadata snapshot hồ sơ
          </p>
          <p className="mt-1 max-w-3xl text-sm text-[#64748B]">
            Xuất hoặc nhập số hộp, số hồ sơ, ghi chú, số tờ và số trang
            trước khi tạo mục lục.
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
            Nhập metadata
          </Button>
        </div>
      </div>
      {metadataImportReview && countConflicts.length > 0 ? (
        <div
          role="alert"
          className="mt-4 overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 shadow-[0_10px_30px_rgba(180,83,9,0.08)]"
        >
          <div className="flex flex-col gap-4 px-4 py-4 sm:px-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-3.5">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-white text-amber-700 shadow-sm">
                <AlertTriangle className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold tracking-[0.12em] text-amber-700 uppercase">
                  Kiểm tra sau khi nhập
                </p>
                <h3 className="mt-1 text-base font-semibold text-[#422006]">
                  Phát hiện {conflictDossierCount} hồ sơ có số lượng khác nhau
                </h3>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-[#92400E]">
                  Số tờ hoặc số trang trong Excel khác dữ liệu hiện tại. Hệ
                  thống chưa ghi đè các giá trị này để bạn có thể kiểm tra trước
                  khi quyết định.
                </p>
              </div>
            </div>
            <span className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 shadow-sm">
              <span className="size-2 rounded-full bg-amber-500" />
              Đang giữ dữ liệu hiện tại
            </span>
          </div>

          <div className="grid grid-cols-2 border-y border-amber-200/70 bg-white/65 sm:grid-cols-4">
            <MetadataImportStat
              label="Dòng trong file"
              value={metadataImportReview.data_row_count}
            />
            <MetadataImportStat
              label="Đã khớp hồ sơ"
              value={metadataImportReview.matched_rows}
            />
            <MetadataImportStat
              label="Đã cập nhật"
              value={metadataImportReview.updated_dossiers}
              tone="success"
            />
            <MetadataImportStat
              label="Cần xác nhận"
              value={conflictDossierCount}
              tone="warning"
            />
          </div>

          <div className="flex flex-col gap-2 px-4 py-3 text-xs text-[#78350F] sm:px-5 lg:flex-row lg:items-center lg:justify-between">
            <p className="flex min-w-0 items-center gap-2">
              <ArrowRight className="size-3.5 shrink-0" />
              <span>
                Xử lý từng hồ sơ trong danh sách PDF bên dưới; mỗi thay đổi đều
                hiển thị giá trị cũ và giá trị từ Excel.
              </span>
            </p>
            <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-amber-700">
              <span className="font-medium">
                Sheet: {metadataImportReview.sheet_name}
              </span>
              {unresolvedRowCount > 0 ? (
                <span className="font-semibold">
                  {unresolvedRowCount} dòng chưa xử lý
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function MetadataImportStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string
  value: number
  tone?: "neutral" | "success" | "warning"
}) {
  return (
    <div className="border-amber-100 px-4 py-3 not-first:border-l sm:px-5">
      <p className="text-[11px] font-medium text-[#64748B]">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-lg font-semibold tabular-nums",
          tone === "success"
            ? "text-emerald-700"
            : tone === "warning"
              ? "text-amber-700"
              : "text-[#0F172A]"
        )}
      >
        {value}
      </p>
    </div>
  )
}

export function MetadataCountConflictCard({
  conflicts,
  disabled,
  onKeepCurrent,
  onUseImported,
}: {
  conflicts: MetadataCountConflict[]
  disabled: boolean
  onKeepCurrent: () => void | Promise<unknown>
  onUseImported: () => void | Promise<unknown>
}) {
  if (conflicts.length === 0) return null
  const firstConflict = conflicts[0]

  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-amber-200 bg-amber-50/60 shadow-[0_6px_18px_rgba(180,83,9,0.06)]">
      <div className="flex flex-col gap-2 border-b border-amber-200/80 bg-white/80 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <AlertTriangle className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#78350F]">
              Metadata cần xác nhận
            </p>
            <p className="mt-0.5 truncate text-[11px] text-[#92400E]">
              {firstConflict.dossier_number
                ? `Hồ sơ số ${firstConflict.dossier_number}`
                : firstConflict.dossier_title || firstConflict.dossier_id}
            </p>
          </div>
        </div>
        <span className="inline-flex w-fit items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-800">
          {conflicts.length} trường khác nhau
        </span>
      </div>

      <div className="grid gap-2 p-3">
        {conflicts.map((conflict) => {
          const fieldLabel =
            conflict.field === "sheet_count" ? "Số tờ" : "Số trang"
          const rowLabel = conflict.row_numbers.length
            ? `Dòng Excel ${formatRowNumberRanges(conflict.row_numbers)}`
            : "Dữ liệu từ Excel"
          return (
            <div
              key={`${conflict.field}:${conflict.old_value}:${conflict.new_value}`}
              className="rounded-lg border border-amber-100 bg-white px-3 py-2.5"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-[#334155]">
                  {fieldLabel}
                </p>
                <span className="text-[10px] font-medium text-[#94A3B8]">
                  {rowLabel}
                </span>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-2">
                <MetadataConflictValue
                  label="Hiện tại"
                  value={conflict.old_value}
                />
                <div className="flex items-center justify-center text-amber-500">
                  <ArrowRight className="size-4" />
                </div>
                <MetadataConflictValue
                  label="Trong Excel"
                  value={conflict.new_value}
                  highlighted
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex flex-col gap-3 border-t border-amber-200/80 bg-white/70 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] leading-5 text-[#92400E]">
          Chọn giá trị sẽ dùng cho hồ sơ này.
        </p>
        <div className="grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void onKeepCurrent()}
            disabled={disabled}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-50 disabled:pointer-events-none disabled:opacity-50"
          >
            <RotateCcw className="size-3.5" />
            Giữ số hiện tại
          </button>
          <button
            type="button"
            onClick={() => void onUseImported()}
            disabled={disabled}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[#0052FF] px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#0046D8] disabled:pointer-events-none disabled:opacity-50"
          >
            <Check className="size-3.5" />
            Dùng số từ Excel
          </button>
        </div>
      </div>
    </div>
  )
}

function MetadataConflictValue({
  label,
  value,
  highlighted = false,
}: {
  label: string
  value: number
  highlighted?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-2.5 py-2",
        highlighted
          ? "border-blue-200 bg-blue-50/80"
          : "border-[#E2E8F0] bg-[#F8FAFC]"
      )}
    >
      <p
        className={cn(
          "text-[10px] font-medium",
          highlighted ? "text-blue-600" : "text-[#64748B]"
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-base font-semibold tabular-nums",
          highlighted ? "text-blue-700" : "text-[#0F172A]"
        )}
      >
        {value}
      </p>
    </div>
  )
}

function numberingStyleDetails(style: NumberingStyleOption): string {
  const details: string[] = []
  if (style.font_family) details.push(`Font ${style.font_family}`)
  if (style.font_size) details.push(`${style.font_size}pt`)
  const weight = style.font_weight ? String(style.font_weight) : ""
  const fontStyle = style.font_style ? String(style.font_style) : ""
  const emphasis = [fontStyle, weight]
    .filter((value) => value && value !== "normal")
    .join(" ")
  if (emphasis) details.push(emphasis)
  if (style.opacity !== undefined && style.opacity < 1) {
    details.push(`opacity ${Math.round(style.opacity * 100)}%`)
  }
  if (style.color) details.push(style.color)
  return details.join(" · ")
}

export function NumberingStepFooter({
  active,
  metadataBusy,
  canContinue,
  doneCount,
  totalDocuments,
  failedCount,
  unresolvedCount,
  onContinue,
}: {
  active: boolean
  metadataBusy: boolean
  canContinue: boolean
  doneCount: number
  totalDocuments: number
  failedCount: number
  unresolvedCount: number
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
            {failedCount > 0 ? `, ${failedCount} tài liệu lỗi` : ""}
            {unresolvedCount > 0
              ? `, còn ${unresolvedCount} tài liệu chưa hoàn tất`
              : ""}
            .
          </p>
        </div>
        <Button
          type="button"
          onClick={onContinue}
          disabled={!canContinue || metadataBusy}
          className="w-full bg-[#0052FF] text-white hover:bg-[#0047D6] sm:w-auto"
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

export function DossierNumberingModeToggle({
  updateMode,
  disabled,
  onChange,
}: {
  updateMode: DossierUpdateMode
  disabled: boolean
  onChange: (mode: DossierUpdateMode) => void
}) {
  return (
    <div
      className="inline-flex h-7 shrink-0 items-center overflow-hidden rounded-lg border border-[#CBD5E1] bg-white p-px"
      role="radiogroup"
      aria-label="Chế độ xử lý tài liệu mới"
    >
      {(
        [
          ["auto", "Tự động"],
          ["manual", "Thủ công"],
        ] as const
      ).map(([mode, label]) => (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-checked={updateMode === mode}
          disabled={disabled}
          onClick={() => onChange(mode)}
          className={cn(
            "inline-flex h-6 items-center rounded-md px-2.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
            updateMode === mode
              ? "bg-[#0052FF] text-white"
              : "text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0052FF]"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export function NumberingDocumentRow({
  document,
  updateMode,
  previewing,
  highlighted = false,
  onPreview,
  onUpdateFromPage,
  onRetry,
  updating,
  retrying,
  retryable,
  stalled,
  disabled,
}: {
  document: NumberingDocumentStatus
  updateMode: NumberingUpdateMode
  previewing: boolean
  highlighted?: boolean
  onPreview: () => void
  onUpdateFromPage: (
    document: NumberingDocumentStatus,
    anchorPageNumber: number,
    newLabel: string,
    updateMode: NumberingUpdateMode,
    manualEntries?: Array<{ page_number: number; label: string }>
  ) => void
  onRetry: (document: NumberingDocumentStatus) => void
  updating: boolean
  retrying: boolean
  retryable: boolean
  stalled: boolean
  disabled: boolean
}) {
  const entries = useMemo(() => numberingEntries(document), [document])
  const [pageValue, setPageValue] = useState(
    String(entries[0]?.page_number ?? 1)
  )
  const [numberValue, setNumberValue] = useState(
    numberingEntryValueForMode(
      entries[0],
      updateMode,
      document.document_number_start
    )
  )
  const [manualEntryRows, setManualEntryRows] = useState(() =>
    manualEntryRowsFromEntries(entries, document.document_number_start)
  )
  useEffect(() => {
    const firstEntry = entries[0]
    setPageValue(String(firstEntry?.page_number ?? 1))
    setNumberValue(
      numberingEntryValueForMode(
        firstEntry,
        updateMode,
        document.document_number_start
      )
    )
    setManualEntryRows(
      manualEntryRowsFromEntries(entries, document.document_number_start)
    )
  }, [
    document.document_number_start,
    document.session_document_id,
    entries,
    updateMode,
  ])

  const badge = stalled
    ? {
        label: "Chưa hoàn tất",
        className: "bg-rose-50 text-rose-700",
      }
    : statusBadge(document.status)
  const trimmedPageValue = pageValue.trim()
  const pageNumberIsValid = positiveIntegerText(trimmedPageValue)
  const parsedPageNumber = pageNumberIsValid
    ? Number.parseInt(trimmedPageValue, 10)
    : Number.NaN
  const trimmedNumberValue = numberValue.trim()
  const cascadeLabelIsValid = numberingLabelText(trimmedNumberValue)
  const firstEntry = entries[0]
  const pageLimit = Math.max(
    0,
    Number(document.output_page_count) || 0,
    Number(document.source_page_count) || 0,
    Number(document.entry_count) || 0,
    ...entries.map((entry) => entry.page_number)
  )
  const parsedManualEntries = validateManualEntryRows(manualEntryRows, pageLimit)
  const manualPageIsValid =
    pageNumberIsValid && (pageLimit <= 0 || parsedPageNumber <= pageLimit)
  const canUpdate =
    (updateMode === "auto"
      ? Boolean(firstEntry)
      : updateMode === "cascade"
        ? manualPageIsValid && cascadeLabelIsValid
        : parsedManualEntries.entries.length > 0 &&
          parsedManualEntries.error === "") &&
    !disabled &&
    !updating
  const span =
    document.document_number_start === document.document_number_end
      ? String(document.document_number_start)
      : `${document.document_number_start}-${document.document_number_end}`
  const handleUpdate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canUpdate) return
    onUpdateFromPage(
      document,
      updateMode === "auto"
        ? firstEntry?.page_number ?? 1
        : updateMode === "manual"
        ? parsedManualEntries.entries[0]?.page_number ?? 1
          : parsedPageNumber,
      updateMode === "auto"
        ? String(document.document_number_start || 1)
        : updateMode === "manual"
        ? parsedManualEntries.entries[0]?.label ?? ""
          : trimmedNumberValue,
      updateMode,
      updateMode === "manual" ? parsedManualEntries.entries : undefined
    )
  }
  const updatePageValue = (value: string) => {
    setPageValue(value)
    const pageNumber = Number.parseInt(value, 10)
    const entry = entries.find((item) => item.page_number === pageNumber)
    if (entry) {
      setNumberValue(
        numberingEntryValueForMode(
          entry,
          updateMode,
          document.document_number_start
        )
      )
    }
  }
  const updateNumberValue = (value: string) => {
    setNumberValue(updateMode === "auto" ? value.replace(/\D/g, "") : value)
  }
  const valueLabel =
    updateMode === "auto" ? "Tự động" : updateMode === "cascade" ? "Mốc" : "Số"
  const saveTitle =
    updateMode === "manual"
      ? "Cập nhật danh sách thủ công"
      : updateMode === "cascade"
        ? "Cập nhật theo mốc và dồn phần sau"
        : "Cập nhật tự động từ trang này"

  const actionButtons = (
    <>
      <button
        type="submit"
        disabled={!canUpdate}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white text-[#475569] transition-colors hover:border-[#0052FF]/40 hover:text-[#0052FF] disabled:pointer-events-none disabled:bg-[#F8FAFC] disabled:text-[#94A3B8]"
        title={saveTitle}
        aria-label={saveTitle}
      >
        {updating ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Save className="size-3.5" />
        )}
      </button>
      {retryable ? (
        <button
          type="button"
          onClick={() => onRetry(document)}
          disabled={disabled || retrying}
          title="Đánh số lại tài liệu này"
          aria-label="Đánh số lại tài liệu này"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-amber-300 bg-amber-50 text-amber-700 transition-colors hover:border-amber-400 hover:bg-amber-100 disabled:pointer-events-none disabled:opacity-50"
        >
          {retrying ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RotateCcw className="size-3.5" />
          )}
        </button>
      ) : null}
      {canPreviewNumberingDocument(document) ? (
        <button
          type="button"
          onClick={onPreview}
          title={
            document.numbered_pdf_version_id
              ? "Preview PDF đã đánh số"
              : "Preview tài liệu gốc"
          }
          aria-label={
            document.numbered_pdf_version_id
              ? "Preview PDF đã đánh số"
              : "Preview tài liệu gốc"
          }
          className={cn(
            "inline-flex size-8 shrink-0 items-center justify-center rounded-lg border text-[#475569] transition-colors",
            previewing
              ? "border-[#0052FF] bg-[#EAF1FF] text-[#0052FF]"
              : "border-[#CBD5E1] bg-white text-[#475569] hover:border-[#0052FF]/40 hover:text-[#0052FF]"
          )}
        >
          <Eye className="size-3.5" />
        </button>
      ) : document.status === "running" ? (
        <Loader2 className="size-4 shrink-0 animate-spin text-[#0052FF]" />
      ) : null}
    </>
  )

  return (
    <form
      data-numbering-document-id={document.session_document_id}
      onSubmit={handleUpdate}
      className={cn(
        "grid min-w-0 gap-3 rounded-xl border bg-[#F8FAFC] px-3 py-2.5 transition-colors",
        highlighted
          ? "border-[#0052FF] bg-[#EEF4FF] shadow-[0_0_0_2px_rgba(0,82,255,0.12)]"
          : "border-[#D8E1EC]",
        updateMode === "manual"
          ? "lg:grid-cols-[minmax(11rem,0.9fr)_minmax(18rem,1.35fr)_auto] lg:items-start"
          : "sm:grid-cols-[minmax(12rem,1fr)_minmax(0,auto)_auto] sm:items-center"
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#EAF1FF] text-[#0052FF]">
          <FileText className="size-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <p className="min-w-0 truncate text-sm font-semibold text-[#0F172A]">
              {document.file_name || document.document_id}
            </p>
            <span
              className={cn(
                "inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                badge.className
              )}
            >
              {badge.label}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-[#64748B]">Số {span}</p>
          {document.error ? (
            <p className="mt-1 text-xs text-rose-700">{document.error}</p>
          ) : null}
          {stalled && !document.error ? (
            <p className="mt-1 text-xs text-amber-700">
              {updateMode !== "cascade"
                ? "Tài liệu mới trong hồ sơ. Chọn tự động hoặc thủ công để cập nhật số."
                : "Tài liệu chưa có PDF đánh số hợp lệ. Có thể đánh số lại từ dòng này."}
            </p>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          "flex min-w-0 gap-2 border-[#E2E8F0]",
          updateMode === "manual"
            ? "w-full flex-col lg:border-l lg:pl-3"
            : "flex-wrap items-center sm:border-l sm:pl-3"
        )}
      >
        {updateMode === "manual" ? (
          <ManualNumberingEntriesEditor
            documentId={document.session_document_id}
            rows={manualEntryRows}
            pageLimit={pageLimit}
            disabled={disabled || updating}
            error={parsedManualEntries.error}
            onChange={setManualEntryRows}
          />
        ) : updateMode === "auto" ? (
          <div className="flex h-7 min-w-[7rem] items-center rounded-md border border-[#CBD5E1] bg-white px-2 text-xs font-semibold text-[#0F172A]">
            {valueLabel}
          </div>
        ) : (
          <>
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
              {valueLabel}
            </label>
            <input
              id={`numbering-value-${document.session_document_id}`}
              type="text"
              inputMode="text"
              value={numberValue}
              onChange={(event) => updateNumberValue(event.target.value)}
              disabled={disabled || updating}
              className="h-7 w-16 shrink-0 rounded-md border border-[#CBD5E1] bg-white px-1.5 text-center text-xs font-medium text-[#0F172A] tabular-nums transition-colors outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/10 disabled:bg-[#F1F5F9] disabled:text-[#94A3B8]"
            />
          </>
        )}
      </div>
      <div
        className={cn(
          "flex shrink-0 items-center justify-end gap-1.5 justify-self-end",
          updateMode === "manual" ? "self-start" : "self-center"
        )}
      >
        {actionButtons}
      </div>
    </form>
  )
}

type ManualEntryRow = {
  id: string
  page: string
  label: string
}

function ManualNumberingEntriesEditor({
  documentId,
  rows,
  pageLimit,
  disabled,
  error,
  onChange,
}: {
  documentId: number
  rows: ManualEntryRow[]
  pageLimit: number
  disabled: boolean
  error: string
  onChange: (rows: ManualEntryRow[]) => void
}) {
  const updateRow = (
    index: number,
    field: "page" | "label",
    value: string
  ) => {
    onChange(
      rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row
      )
    )
  }
  const addRow = () => {
    onChange([...rows, nextManualEntryRow(rows)])
  }
  const removeRow = (index: number) => {
    if (rows.length <= 1) return
    onChange(rows.filter((_, rowIndex) => rowIndex !== index))
  }

  return (
    <div className="w-full min-w-0 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-2 shadow-sm">
      <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <p className="text-[10px] font-semibold tracking-wide text-[#64748B] uppercase">
          Đánh số thủ công
        </p>
        <span className="text-[10px] font-medium text-[#94A3B8]">
          {rows.length} trang
        </span>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        {rows.map((row, index) => (
          <div
            key={row.id}
            className="grid min-w-0 grid-cols-[2.75rem_3rem_1.75rem_minmax(4.5rem,1fr)_1.75rem_1.75rem] items-center gap-1"
          >
            <label
              htmlFor={`numbering-manual-page-${documentId}-${index}`}
              className="truncate text-[10px] font-medium text-[#94A3B8]"
            >
              Trang
            </label>
            <input
              id={`numbering-manual-page-${documentId}-${index}`}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={row.page}
              onChange={(event) => updateRow(index, "page", event.target.value)}
              disabled={disabled}
              className="h-7 w-full rounded-md border border-[#CBD5E1] bg-[#F8FAFC] px-1 text-center text-xs font-medium text-[#0F172A] tabular-nums transition-colors outline-none focus:border-[#0052FF] focus:bg-white focus:ring-2 focus:ring-[#0052FF]/10 disabled:bg-[#F1F5F9] disabled:text-[#94A3B8]"
            />
            <label
              htmlFor={`numbering-manual-label-${documentId}-${index}`}
              className="truncate text-[10px] font-medium text-[#94A3B8]"
            >
              Số
            </label>
            <input
              id={`numbering-manual-label-${documentId}-${index}`}
              type="text"
              value={row.label}
              onChange={(event) => updateRow(index, "label", event.target.value)}
              disabled={disabled}
              placeholder="VD: 12"
              className="h-7 min-w-0 rounded-md border border-[#CBD5E1] bg-[#F8FAFC] px-2 text-xs font-medium text-[#0F172A] transition-colors outline-none placeholder:text-[#CBD5E1] focus:border-[#0052FF] focus:bg-white focus:ring-2 focus:ring-[#0052FF]/10 disabled:bg-[#F1F5F9] disabled:text-[#94A3B8]"
            />
            {rows.length > 1 ? (
              <button
                type="button"
                onClick={() => removeRow(index)}
                disabled={disabled}
                title="Xóa dòng"
                aria-label="Xóa dòng"
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-[#E2E8F0] bg-[#F8FAFC] text-[#94A3B8] transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:pointer-events-none disabled:opacity-50"
              >
                <Minus className="size-3" />
              </button>
            ) : (
              <span className="size-7 shrink-0" aria-hidden="true" />
            )}
            {index === rows.length - 1 ? (
              <button
                type="button"
                onClick={addRow}
                disabled={
                  disabled || (pageLimit > 0 && rows.length >= pageLimit)
                }
                title="Thêm trang"
                aria-label="Thêm trang"
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-[#CBD5E1] bg-white text-[#475569] transition-colors hover:border-[#0052FF]/40 hover:bg-[#EEF4FF] hover:text-[#0052FF] disabled:pointer-events-none disabled:opacity-50"
              >
                <Plus className="size-3" />
              </button>
            ) : (
              <span className="size-7 shrink-0" aria-hidden="true" />
            )}
          </div>
        ))}
      </div>
      {error ? (
        <p className="mt-1.5 text-[11px] leading-snug text-rose-700">{error}</p>
      ) : (
        <p className="mt-1.5 text-[10px] leading-snug text-[#94A3B8]">
          Lưu một lần để cập nhật toàn bộ danh sách.
        </p>
      )}
    </div>
  )
}

function numberingEntryNumber(entry: NumberingEntry | undefined): number {
  if (!entry) return Number.NaN
  const structuredNumber = Number(entry.numbering_number)
  if (Number.isFinite(structuredNumber) && structuredNumber > 0) {
    return structuredNumber
  }
  const parsedLabel = Number.parseInt(entry.label, 10)
  return Number.isFinite(parsedLabel) && parsedLabel > 0
    ? parsedLabel
    : Number.NaN
}

function numberingEntryValueForMode(
  entry: NumberingEntry | undefined,
  updateMode: NumberingUpdateMode,
  fallback: string | number
): string {
  if (!entry) return String(fallback)
  if (updateMode !== "auto") return entry.label
  const number = numberingEntryNumber(entry)
  return Number.isFinite(number) ? String(number) : String(fallback)
}

function manualEntryRowsFromEntries(
  entries: NumberingEntry[],
  fallbackLabel: string | number
): ManualEntryRow[] {
  const firstEntry = entries[0]
  const pageNumber = firstEntry?.page_number ?? 1
  return [
    {
      id: `entry-${pageNumber}-0`,
      page: String(pageNumber),
      label: firstEntry?.label ?? String(fallbackLabel || 1),
    },
  ]
}

function nextManualEntryRow(rows: ManualEntryRow[]): ManualEntryRow {
  const lastRow = rows[rows.length - 1]
  const lastPage = Number.parseInt(lastRow?.page ?? "", 10)
  const nextPage =
    Number.isFinite(lastPage) && lastPage > 0 ? lastPage + 1 : rows.length + 1
  const lastLabel = lastRow?.label?.trim() ?? ""
  const labelMatch = lastLabel.match(/^(\d+)(.*)$/)
  const nextLabel =
    labelMatch && Number.parseInt(labelMatch[1], 10) > 0
      ? `${Number.parseInt(labelMatch[1], 10) + 1}${labelMatch[2]}`
      : ""
  return {
    id: `entry-${nextPage}-${Date.now()}`,
    page: String(nextPage),
    label: nextLabel,
  }
}

function validateManualEntryRows(
  rows: ManualEntryRow[],
  pageLimit: number
): {
  entries: Array<{ page_number: number; label: string }>
  error: string
} {
  const entries: Array<{ page_number: number; label: string }> = []
  const seenPages = new Set<number>()

  for (const [index, row] of rows.entries()) {
    const pageText = row.page.trim()
    const label = row.label.trim()
    if (!positiveIntegerText(pageText)) {
      return {
        entries: [],
        error: `Dòng ${index + 1}: trang phải là số nguyên dương.`,
      }
    }
    const pageNumber = Number.parseInt(pageText, 10)
    if (pageLimit > 0 && pageNumber > pageLimit) {
      return {
        entries: [],
        error: `Dòng ${index + 1}: trang vượt quá ${pageLimit}.`,
      }
    }
    if (seenPages.has(pageNumber)) {
      return {
        entries: [],
        error: `Dòng ${index + 1}: trùng trang ${pageNumber}.`,
      }
    }
    if (!numberingLabelText(label)) {
      return {
        entries: [],
        error: `Dòng ${index + 1}: số phải bắt đầu bằng chữ số.`,
      }
    }
    seenPages.add(pageNumber)
    entries.push({ page_number: pageNumber, label })
  }

  if (entries.length === 0) {
    return {
      entries: [],
      error: "Cần ít nhất một dòng đánh số.",
    }
  }

  return { entries, error: "" }
}

function numberingLabelText(value: string): boolean {
  const match = value.trim().match(/^(\d+)/)
  return Boolean(match && Number.parseInt(match[1], 10) > 0)
}

function positiveIntegerText(value: string): boolean {
  return /^[0-9]+$/.test(value) && Number.parseInt(value, 10) > 0
}
