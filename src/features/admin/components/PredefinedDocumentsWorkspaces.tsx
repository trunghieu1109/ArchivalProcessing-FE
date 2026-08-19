import { useState, type ReactNode } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  FileKey2,
  FileSearch2,
  FileUp,
  Info,
  Loader2,
  Search,
  ShieldCheck,
} from "lucide-react"
import { toast } from "sonner"

import {
  evaluatePredefinedMatches,
  importPredefinedDocuments,
  previewPredefinedDocuments,
  type PredefinedImportMode,
  type PredefinedImportPreview,
  type PredefinedMatchEvaluation,
  type PredefinedMatchExample,
} from "@/features/admin/api/predefinedDocumentsApi"

const PRIMARY_ACTION_CLASS =
  "flex w-full items-center justify-center gap-2 rounded-xl bg-[#0052FF] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0047DB] disabled:cursor-not-allowed disabled:opacity-50"

export function ImportWorkspace({ onImported }: { onImported: () => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null)
  const [mode, setMode] = useState<PredefinedImportMode>("replace")
  const [preview, setPreview] = useState<PredefinedImportPreview | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [importing, setImporting] = useState(false)

  const runPreview = async () => {
    if (!file) return toast.error("Hãy chọn file trước khi preview.")
    setPreviewing(true)
    try {
      setPreview(await previewPredefinedDocuments(file, mode))
      toast.success("Đã kiểm tra file; database chưa thay đổi.")
    } catch (error) {
      setPreview(null)
      toast.error(errorMessage(error, "File predefined không hợp lệ."))
    } finally {
      setPreviewing(false)
    }
  }

  const runImport = async () => {
    if (!file || !preview) return
    const action = mode === "replace" ? "thay toàn bộ tập đang hoạt động" : "nối thêm vào tập hiện tại"
    if (!window.confirm(`Xác nhận ${action} bằng ${formatNumber(preview.row_count)} dòng?`)) return
    setImporting(true)
    try {
      const result = await importPredefinedDocuments(file, mode)
      toast.success(`Đã nhập ${formatNumber(result.imported_row_count)} tài liệu.`)
      setPreview(null)
      setFile(null)
      await onImported()
    } catch (error) {
      toast.error(errorMessage(error, "Không thể nhập predefined documents."))
    } finally {
      setImporting(false)
    }
  }

  return (
    <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(30rem,0.95fr)]">
      <div className="rounded-3xl border border-[#D8E1EC] bg-white p-5 shadow-sm sm:p-6">
        <SectionHeading
          icon={<FileUp className="size-5" />}
          title="Nạp tập predefined"
          description="Thực hiện theo ba bước: chọn file, chọn cách cập nhật, kiểm tra trước khi ghi."
        />
        <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm leading-6 text-[#334155]">
          <p className="font-semibold text-[#0F3D91]">Schema được chấp nhận</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><code>dossier_id</code>, <code>dossier_number</code> hoặc <code>predefined_dossier_key</code>.</li>
            <li>Bốn cột hash phải tồn tại; từng ô được phép trống.</li>
            <li>Mỗi dòng cần ít nhất một giá trị hash; backend luôn tính lại hash.</li>
          </ul>
        </div>
        <FilePicker
          id="predefined-import-file"
          file={file}
          title="Chọn tập predefined"
          hint=".parquet, .xlsx hoặc .csv"
          onChange={(nextFile) => {
            setFile(nextFile)
            setPreview(null)
          }}
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ModeCard
            checked={mode === "replace"}
            title="Replace"
            description="Ngừng kích hoạt tập cũ và thay bằng tập mới."
            warning="Có ảnh hưởng đến toàn bộ tập đang hoạt động"
            onChange={() => {
              setMode("replace")
              setPreview(null)
            }}
          />
          <ModeCard
            checked={mode === "append"}
            title="Append"
            description="Giữ tập cũ và nối thêm; bản ghi cũ vẫn được ưu tiên."
            onChange={() => {
              setMode("append")
              setPreview(null)
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => void runPreview()}
          disabled={!file || previewing || importing}
          className={`${PRIMARY_ACTION_CLASS} mt-4`}
        >
          {previewing ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          Kiểm tra trước khi nhập
        </button>
      </div>

      <div className="rounded-3xl border border-[#D8E1EC] bg-white p-5 shadow-sm sm:p-6">
        <SectionHeading
          icon={<FileCheck2 className="size-5" />}
          title="Kết quả kiểm tra"
          description="Preview chỉ phân tích file, chưa ghi dữ liệu vào database."
        />
        {!preview ? (
          <EmptyState icon={<FileCheck2 className="size-8" />} text="Chọn file và bấm kiểm tra để xem chất lượng tập predefined." />
        ) : (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <PreviewValue label="Tổng dòng" value={preview.row_count} />
              <PreviewValue label="Hash unique" value={preview.unique_hash_count} />
              <PreviewValue label="Hash bị lặp" value={preview.duplicate_hash_group_count} warning />
              <PreviewValue label="Hash xung đột" value={preview.conflicting_hash_group_count} warning />
            </div>
            {preview.warnings.map((warning) => <WarningBox key={warning}>{warning}</WarningBox>)}
            {preview.conflict_examples.length > 0 && (
              <ExampleList
                title="Ví dụ hash xung đột"
                examples={preview.conflict_examples.map((item) => ({
                  key: item.document_hash,
                  title: item.document_number || "Không có số",
                  meta: item.predefined_dossier_keys.join(" · "),
                  description: item.document_summary,
                }))}
              />
            )}
            <button
              type="button"
              onClick={() => void runImport()}
              disabled={importing}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#15803D] px-4 py-3 text-sm font-semibold text-white hover:bg-[#166534] disabled:opacity-50"
            >
              {importing ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Xác nhận {mode === "replace" ? "Replace" : "Append"}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

export function EvaluationWorkspace() {
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<PredefinedMatchEvaluation | null>(null)
  const [evaluating, setEvaluating] = useState(false)

  const runEvaluation = async () => {
    if (!file) return toast.error("Hãy chọn file documents trước khi đánh giá.")
    setEvaluating(true)
    try {
      setResult(await evaluatePredefinedMatches(file))
      toast.success("Đã đối chiếu với tập predefined đang hoạt động.")
    } catch (error) {
      setResult(null)
      toast.error(errorMessage(error, "Không thể đánh giá file documents."))
    } finally {
      setEvaluating(false)
    }
  }

  return (
    <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(34rem,1.15fr)]">
      <div className="rounded-3xl border border-[#D8E1EC] bg-white p-5 shadow-sm sm:p-6">
        <SectionHeading
          icon={<FileSearch2 className="size-5" />}
          title="Đánh giá độ phủ hash"
          description="Dành cho documents.parquet do notebook tạo hoặc dữ liệu có schema tương đương."
        />
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <ShieldCheck className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">Chế độ chỉ đọc</p>
            <p className="mt-1 leading-6 text-emerald-800">
              File chỉ được đối chiếu với predefined đang active; không import candidate và không thay đổi database.
            </p>
          </div>
        </div>
        <ol className="mt-5 space-y-3 text-sm text-[#475569]">
          <FlowStep number="1" text="Đọc bốn cột hash theo đúng chuẩn hybrid hiện tại." />
          <FlowStep number="2" text="Kiểm tra hash có tồn tại trong tập predefined đang active hay không." />
          <FlowStep number="3" text="Một hash trùng nhiều predefined vẫn được tính là match." />
        </ol>
        <FilePicker
          id="predefined-evaluation-file"
          file={file}
          title="Chọn documents.parquet"
          hint="Chỉ cần issuing_agency, issued_date, document_number và document_type"
          onChange={(nextFile) => {
            setFile(nextFile)
            setResult(null)
          }}
        />
        <button
          type="button"
          onClick={() => void runEvaluation()}
          disabled={!file || evaluating}
          className={`${PRIMARY_ACTION_CLASS} mt-4`}
        >
          {evaluating ? <Loader2 className="size-4 animate-spin" /> : <FileSearch2 className="size-4" />}
          Phân tích tỷ lệ match
        </button>
      </div>
      <EvaluationResult result={result} />
    </section>
  )
}

function EvaluationResult({ result }: { result: PredefinedMatchEvaluation | null }) {
  if (!result) {
    return (
      <div className="rounded-3xl border border-[#D8E1EC] bg-white p-5 shadow-sm sm:p-6">
        <SectionHeading
          icon={<FileCheck2 className="size-5" />}
          title="Báo cáo đối chiếu"
          description="Kết quả được tính trên tập predefined đang hoạt động tại thời điểm chạy."
        />
        <EmptyState icon={<FileSearch2 className="size-8" />} text="Chưa có file documents được đánh giá." />
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-[#D8E1EC] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeading icon={<FileCheck2 className="size-5" />} title="Báo cáo đối chiếu" description={`${formatNumber(result.total_document_count)} tài liệu · hash version ${result.hash_version}`} />
        <span className="rounded-full bg-[#EAF1FF] px-3 py-1 text-xs font-semibold text-[#0052FF]">{result.file_name}</span>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <RateCard label="Match hash" count={result.matched_document_count} rate={result.match_rate} tone="blue" />
        <RateCard label="Không match hash" count={result.unmatched_document_count} rate={result.unmatched_rate} tone="slate" />
        <RateCard label="Không tạo được hash" count={result.unhashable_document_count} rate={result.unhashable_rate} tone="amber" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <MiniStat label="Hash thiếu trường" value={result.partial_hash_document_count} />
        <MiniStat label="Hash unique đầu vào" value={result.unique_input_hash_count} />
        <MiniStat label="Nhóm hash lặp đầu vào" value={result.duplicate_input_hash_group_count} />
        <MiniStat label="Match nhiều predefined" value={result.multiple_predefined_match_count} warning />
      </div>
      <div className="mt-4 flex gap-2 rounded-xl bg-[#F8FAFC] p-3 text-xs leading-5 text-[#64748B]">
        <Info className="mt-0.5 size-4 shrink-0 text-[#0052FF]" />
        <span>Tỷ lệ match trên toàn bộ file là <strong className="text-[#0F172A]">{formatPercent(result.match_rate)}</strong>. Nếu chỉ tính các dòng tạo được hash, tỷ lệ là <strong className="text-[#0F172A]">{formatPercent(result.hashable_match_rate)}</strong>. Các cột document_id và dossier_number không được sử dụng.</span>
      </div>
      {result.warnings.map((warning) => <WarningBox key={warning}>{warning}</WarningBox>)}
      {result.unmatched_examples.length > 0 && <HashExamples title="Ví dụ không tìm thấy hash" examples={result.unmatched_examples} />}
      {result.multiple_match_examples.length > 0 && <HashExamples title="Ví dụ match nhiều predefined" examples={result.multiple_match_examples} showCandidateCount />}
    </div>
  )
}

function SectionHeading({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return <div className="flex items-start gap-3"><span className="rounded-xl bg-[#EAF1FF] p-2 text-[#0052FF]">{icon}</span><div><h3 className="font-bold">{title}</h3><p className="mt-1 text-sm leading-5 text-[#64748B]">{description}</p></div></div>
}

function FilePicker({ id, file, title, hint, onChange }: { id: string; file: File | null; title: string; hint: string; onChange: (file: File | null) => void }) {
  return <label htmlFor={id} className="mt-5 flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed border-[#B8C7DB] bg-[#F8FAFC] p-5 transition hover:border-[#0052FF] hover:bg-[#F4F7FF]"><span className="rounded-2xl bg-[#EAF1FF] p-3 text-[#0052FF]"><FileUp className="size-6" /></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{file?.name ?? title}</strong><span className="mt-1 block text-xs leading-5 text-[#64748B]">{file ? `${formatFileSize(file.size)} · Bấm để chọn file khác` : hint}</span></span><input id={id} type="file" accept=".parquet,.xlsx,.csv" className="sr-only" onChange={(event) => onChange(event.target.files?.[0] ?? null)} /></label>
}

function ModeCard({ checked, title, description, warning, onChange }: { checked: boolean; title: string; description: string; warning?: string; onChange: () => void }) {
  return <label className={`cursor-pointer rounded-xl border p-3 text-sm transition ${checked ? "border-[#0052FF] bg-[#F4F7FF] ring-1 ring-[#0052FF]" : "border-[#D8E1EC]"}`}><span className="flex items-center gap-2"><input type="radio" checked={checked} onChange={onChange} /><strong>{title}</strong></span><span className="mt-1 block text-xs leading-5 text-[#64748B]">{description}</span>{warning && <span className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-amber-700"><AlertTriangle className="size-3" />{warning}</span>}</label>
}

function FlowStep({ number, text }: { number: string; text: string }) {
  return <li className="flex items-center gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#EAF1FF] text-xs font-bold text-[#0052FF]">{number}</span><span>{text}</span></li>
}

function PreviewValue({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  return <div className={`rounded-xl p-3 ${warning && value ? "bg-amber-50" : "bg-[#F8FAFC]"}`}><span className="block text-xs text-[#64748B]">{label}</span><strong className="mt-1 block text-xl">{formatNumber(value)}</strong></div>
}

function RateCard({ label, count, rate, tone }: { label: string; count: number; rate: number; tone: "blue" | "slate" | "amber" }) {
  const tones = { blue: "bg-blue-50 text-blue-800", slate: "bg-slate-100 text-slate-700", amber: "bg-amber-50 text-amber-800" }
  const icons = { blue: <FileKey2 className="size-4" />, slate: <Search className="size-4" />, amber: <AlertTriangle className="size-4" /> }
  return <div className={`rounded-2xl p-3 ${tones[tone]}`}><div className="flex items-center gap-1.5 text-xs font-semibold">{icons[tone]}{label}</div><div className="mt-2 flex items-end justify-between gap-2"><strong className="text-2xl">{formatNumber(count)}</strong><span className="text-xs font-bold">{formatPercent(rate)}</span></div></div>
}

function MiniStat({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  return <div className={`rounded-xl border p-3 ${warning && value ? "border-amber-200 bg-amber-50" : "border-[#E2E8F0] bg-[#F8FAFC]"}`}><span className="block text-[11px] text-[#64748B]">{label}</span><strong className="mt-1 block">{formatNumber(value)}</strong></div>
}

function WarningBox({ children }: { children: ReactNode }) {
  return <div className="mt-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{children}</div>
}

function EmptyState({ icon, text }: { icon: ReactNode; text: string }) {
  return <div className="mt-6 flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-6 text-center text-[#94A3B8]"><span className="rounded-2xl bg-white p-3 shadow-sm">{icon}</span><p className="mt-3 max-w-sm text-sm leading-6">{text}</p></div>
}

function ExampleList({ title, examples }: { title: string; examples: Array<{ key: string; title: string; meta: string; description: string }> }) {
  return <div><p className="mb-2 text-xs font-semibold text-[#475569] uppercase">{title}</p><div className="max-h-48 overflow-auto rounded-xl border border-[#E2E8F0]">{examples.map((item) => <div key={item.key} className="border-b border-[#E2E8F0] p-3 text-xs last:border-0"><strong>{item.title}</strong><p className="mt-1 text-[#64748B]">{item.meta}</p><p className="mt-1 line-clamp-2">{item.description}</p></div>)}</div></div>
}

function HashExamples({ title, examples, showCandidateCount = false }: { title: string; examples: PredefinedMatchExample[]; showCandidateCount?: boolean }) {
  return <div className="mt-4"><p className="mb-2 text-xs font-semibold uppercase text-[#475569]">{title}</p><div className="max-h-64 overflow-auto rounded-xl border border-[#E2E8F0]">{examples.map((item) => <div key={`${item.source_row}-${item.document_hash}`} className="grid gap-2 border-b border-[#E2E8F0] p-3 text-xs last:border-0 sm:grid-cols-[minmax(0,1fr)_auto]"><div className="min-w-0"><strong className="block truncate">Dòng {formatNumber(item.source_row)} · {item.document_number || "Không có số văn bản"}</strong><p className="mt-1 line-clamp-2 text-[#64748B]">{item.issuing_agency || "Không có cơ quan"} · {item.issued_date || "Không có ngày"} · {item.document_type || "Không có loại"}</p></div><div className="sm:text-right"><p className="font-mono text-[10px] text-[#94A3B8]">{item.document_hash.slice(0, 12)}…</p>{showCandidateCount && <p className="mt-1 font-semibold text-[#0052FF]">{formatNumber(item.candidate_count)} predefined</p>}</div></div>)}</div></div>
}

function formatNumber(value: number) {
  return value.toLocaleString("vi-VN")
}

function formatPercent(value: number) {
  return value.toLocaleString("vi-VN", { style: "percent", maximumFractionDigits: 2 })
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}
