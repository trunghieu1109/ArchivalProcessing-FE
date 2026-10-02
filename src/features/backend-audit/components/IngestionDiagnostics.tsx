import { useMemo, useState } from "react"
import { Activity, FileInput, Search } from "lucide-react"

import {
  diagnoseIngestionRuns,
  type IngestionDiagnosticSeverity,
} from "../ingestionDiagnostics"
import { IngestionRunDiagnosticCard } from "./IngestionRunDiagnosticCard"

type DiagnosticFilter = "all" | "issues" | IngestionDiagnosticSeverity

export function IngestionDiagnostics({
  runs,
  batches,
  onOpenRaw,
}: {
  runs: Array<Record<string, unknown>>
  batches: Array<Record<string, unknown>>
  onOpenRaw: () => void
}) {
  const [filter, setFilter] = useState<DiagnosticFilter>("all")
  const [query, setQuery] = useState("")
  const diagnostics = useMemo(
    () => diagnoseIngestionRuns(runs, batches),
    [batches, runs]
  )
  const counts = useMemo(
    () =>
      diagnostics.reduce<Record<IngestionDiagnosticSeverity, number>>(
        (current, item) => ({
          ...current,
          [item.severity]: current[item.severity] + 1,
        }),
        { healthy: 0, info: 0, warning: 0, critical: 0 }
      ),
    [diagnostics]
  )
  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return diagnostics.filter((item) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "issues"
          ? item.severity === "warning" || item.severity === "critical"
          : item.severity === filter)
      if (!matchesFilter) return false
      if (!normalizedQuery) return true
      return [
        item.run.id,
        item.run.file_name,
        item.run.folder_upload_id,
        item.run.remote_ingestion_batch_id,
        item.run.remote_extract_job_id,
        item.run.worker_id,
        ...item.findings.flatMap((finding) => [finding.title, finding.detail]),
      ].some((value) => text(value).toLowerCase().includes(normalizedQuery))
    })
  }, [diagnostics, filter, query])

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-white">
      <header className="border-b border-white/10 p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-cyan-300 uppercase">
              <Activity className="size-4" /> Ingestion diagnostics
            </div>
            <h3 className="mt-2 text-xl font-semibold">
              Kiểm tra nguyên nhân run gặp vấn đề
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
              Đối chiếu extract, heartbeat, số lượng file, OCR discovery và
              metadata của từng run.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenRaw}
            className="h-10 rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-4 text-xs font-bold text-cyan-200 transition hover:bg-cyan-300/20"
          >
            Xem payload digitization
          </button>
        </div>

        <div className="mt-5 grid grid-flow-dense grid-cols-2 gap-2 lg:grid-cols-4">
          <HealthMetric label="Healthy" value={counts.healthy} tone="healthy" />
          <HealthMetric
            label="Cảnh báo"
            value={counts.warning}
            tone="warning"
          />
          <HealthMetric
            label="Nghiêm trọng"
            value={counts.critical}
            tone="critical"
          />
          <HealthMetric
            label="Tổng run"
            value={diagnostics.length}
            tone="info"
          />
        </div>
      </header>

      <div className="border-b border-white/10 p-4 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 focus-within:border-cyan-300/40">
            <Search className="size-4 text-slate-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm ID, file, worker hoặc nội dung lỗi..."
              className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-slate-500"
            />
          </label>
          <div className="flex gap-1 overflow-x-auto rounded-xl bg-white/5 p-1">
            {(
              [
                ["all", "Tất cả"],
                ["issues", "Có vấn đề"],
                ["critical", "Nghiêm trọng"],
                ["warning", "Cảnh báo"],
                ["healthy", "Healthy"],
              ] as Array<[DiagnosticFilter, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`shrink-0 rounded-lg px-3 py-2 text-[10px] font-bold transition ${
                  filter === value
                    ? "bg-cyan-300 text-slate-950"
                    : "text-slate-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-3 sm:p-4">
        {runs.length === 0 ? (
          <EmptyState message="Backend chưa trả về ingestion run." />
        ) : visible.length === 0 ? (
          <EmptyState message="Không có ingestion run phù hợp với bộ lọc." />
        ) : (
          visible.map((diagnostic, index) => (
            <IngestionRunDiagnosticCard
              key={String(diagnostic.run.id ?? index)}
              diagnostic={diagnostic}
              defaultOpen={diagnostic.severity !== "healthy"}
            />
          ))
        )}
      </div>
    </section>
  )
}

function HealthMetric({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: IngestionDiagnosticSeverity
}) {
  const className =
    tone === "critical"
      ? "border-rose-400/20 bg-rose-400/10 text-rose-200"
      : tone === "warning"
        ? "border-amber-300/20 bg-amber-300/10 text-amber-200"
        : tone === "healthy"
          ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200"
          : "border-cyan-300/20 bg-cyan-300/10 text-cyan-200"
  return (
    <div className={`rounded-xl border p-3 ${className}`}>
      <p className="text-[10px] font-bold tracking-wide uppercase">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="grid min-h-40 place-items-center rounded-xl border border-dashed border-white/10 p-6 text-center">
      <div>
        <FileInput className="mx-auto size-6 text-slate-600" />
        <p className="mt-3 text-sm text-slate-400">{message}</p>
      </div>
    </div>
  )
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : ""
}
