import {
  AlertOctagon,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  Gauge,
  TriangleAlert,
} from "lucide-react"
import { toast } from "sonner"

import type {
  IngestionDiagnosticSeverity,
  IngestionRunDiagnostic,
} from "../ingestionDiagnostics"
import { AuditStatusBadge } from "./AuditStatusBadge"

export function IngestionRunDiagnosticCard({
  diagnostic,
  defaultOpen,
}: {
  diagnostic: IngestionRunDiagnostic
  defaultOpen: boolean
}) {
  const run = diagnostic.run
  const status = text(run.status) || "unknown"
  const progress = diagnostic.progressPercent

  return (
    <details
      open={defaultOpen}
      className="group/run overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045]"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4 transition hover:bg-white/[0.04] sm:p-5">
        <ChevronRight className="size-4 shrink-0 text-slate-500 transition-transform group-open/run:rotate-90" />
        <SeverityIcon severity={diagnostic.severity} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-bold text-white">
              {text(run.file_name) || `Ingestion run #${text(run.id) || "—"}`}
            </p>
            <AuditStatusBadge value={status} />
          </div>
          <p className="mt-1 truncate font-mono text-[10px] text-slate-500">
            run:{text(run.id) || "—"} ·{" "}
            {text(run.ingestion_source) || "unknown"} ·{" "}
            {diagnostic.batches.length} OCR batch
          </p>
        </div>
        <div className="hidden text-right sm:block">
          <p className="text-sm font-bold text-white">
            {progress === null ? "—" : `${progress}%`}
          </p>
          <p className="mt-1 text-[10px] text-slate-500">extract progress</p>
        </div>
      </summary>

      <div className="border-t border-white/10 p-4 sm:p-5">
        <FindingList diagnostic={diagnostic} />

        <div className="mt-4 grid grid-flow-dense gap-3 md:grid-cols-12">
          <div className="rounded-xl border border-white/10 bg-black/10 p-4 md:col-span-4">
            <div className="flex items-center gap-2 text-[10px] font-bold tracking-wide text-slate-400 uppercase">
              <Gauge className="size-3.5" /> Tiến độ extract
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-cyan-300 transition-all duration-700"
                style={{ width: `${progress ?? 0}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-slate-300">
              {diagnostic.handledFiles.toLocaleString("vi-VN")}/
              {diagnostic.totalFiles?.toLocaleString("vi-VN") ?? "—"} PDF đã xử
              lý
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 md:col-span-8 lg:grid-cols-4">
            <MiniMetric label="Extracted" value={run.extracted_count} />
            <MiniMetric label="Created" value={run.created_count} />
            <MiniMetric label="Overwrite" value={run.overwritten_count} />
            <MiniMetric label="Duplicate" value={run.duplicate_count} />
            <MiniMetric label="Skipped" value={run.skipped_count} />
            <MiniMetric label="Attempts" value={run.attempts} />
            <MiniMetric label="Poll attempts" value={run.poll_attempts} />
            <MiniMetric
              label="Effective"
              value={run.effective_document_count}
            />
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-4">
          <Stage
            label="Nguồn ingest"
            value={text(run.ingestion_source) || "unknown"}
            detail={text(run.upload_mode) || "Không có upload mode"}
            healthy={Boolean(
              run.folder_upload_id || run.remote_ingestion_batch_id
            )}
          />
          <Stage
            label="Remote extract"
            value={text(run.remote_extract_status) || status}
            detail={`Worker: ${text(run.worker_id) || "—"}`}
            healthy={!text(run.error)}
          />
          <Stage
            label="OCR discovery"
            value={`${diagnostic.batches.length} batch`}
            detail={
              diagnostic.batches.length > 0 &&
              diagnostic.batches.every(
                (batch) => batch.remote_discovery_complete
              )
                ? "Discovery hoàn tất"
                : "Còn batch chưa discovery xong"
            }
            healthy={
              diagnostic.batches.length > 0 &&
              diagnostic.batches.every(
                (batch) => batch.remote_discovery_complete
              )
            }
          />
          <Stage
            label="Metadata"
            value={metadataStage(diagnostic.batches)}
            detail="Trạng thái tổng hợp từ OCR batch"
            healthy={
              diagnostic.batches.length > 0 &&
              diagnostic.batches.every((batch) =>
                ["ready", "completed", "completed_with_errors"].includes(
                  text(batch.metadata_extraction_status).toLowerCase()
                )
              )
            }
          />
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <IdentifierPanel run={run} />
          <TimingPanel run={run} lastActivityAt={diagnostic.lastActivityAt} />
        </div>

        {diagnostic.batches.length > 0 && (
          <div className="mt-4 grid gap-2">
            {diagnostic.batches.map((batch, index) => (
              <BatchDiagnostic key={String(batch.id ?? index)} batch={batch} />
            ))}
          </div>
        )}
      </div>
    </details>
  )
}

function FindingList({ diagnostic }: { diagnostic: IngestionRunDiagnostic }) {
  if (diagnostic.findings.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-xs text-emerald-200">
        <CheckCircle2 className="size-4" /> Không phát hiện bất thường từ dữ
        liệu hiện có.
      </div>
    )
  }

  return (
    <div className="grid gap-2">
      {diagnostic.findings.map((finding) => (
        <div
          key={finding.code}
          className={`rounded-xl border p-3 ${
            finding.severity === "critical"
              ? "border-rose-400/20 bg-rose-400/10"
              : "border-amber-300/20 bg-amber-300/10"
          }`}
        >
          <div className="flex items-start gap-2">
            {finding.severity === "critical" ? (
              <AlertOctagon className="mt-0.5 size-4 shrink-0 text-rose-300" />
            ) : (
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-300" />
            )}
            <div>
              <p className="text-xs font-bold text-white">{finding.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-300">
                {finding.detail}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function BatchDiagnostic({ batch }: { batch: Record<string, unknown> }) {
  const counts = asRecord(batch.status_counts)
  return (
    <div className="rounded-xl border border-white/10 bg-black/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-white">
            OCR batch #{text(batch.id) || "—"}
          </p>
          <p className="mt-1 font-mono text-[10px] text-slate-500">
            {text(batch.folder_path) || "Không có folder path"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AuditStatusBadge value={text(batch.status) || "unknown"} />
          <AuditStatusBadge
            value={`metadata:${text(batch.metadata_extraction_status) || "unknown"}`}
          />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-400">
        <span>{numberText(batch.total_files)} file</span>
        <span>·</span>
        <span>{numberText(batch.total_jobs)} job</span>
        <span>·</span>
        <span>
          Discovery {batch.remote_discovery_complete ? "xong" : "chưa xong"}
        </span>
        {text(batch.recovery_due_at) && (
          <>
            <span>·</span>
            <span>Recovery {dateText(batch.recovery_due_at)}</span>
          </>
        )}
      </div>
      {counts && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {Object.entries(counts).map(([batchStatus, count]) => (
            <span
              key={batchStatus}
              className="rounded-lg bg-white/5 px-2 py-1 text-[10px] text-slate-300"
            >
              {batchStatus}: {numberText(count)}
            </span>
          ))}
        </div>
      )}
      {text(batch.error) && (
        <p className="mt-3 rounded-lg bg-rose-400/10 px-3 py-2 text-xs leading-5 text-rose-200">
          {text(batch.error)}
        </p>
      )}
    </div>
  )
}

function SeverityIcon({ severity }: { severity: IngestionDiagnosticSeverity }) {
  const Icon =
    severity === "critical"
      ? AlertOctagon
      : severity === "warning"
        ? TriangleAlert
        : CheckCircle2
  const className =
    severity === "critical"
      ? "bg-rose-400/10 text-rose-300"
      : severity === "warning"
        ? "bg-amber-300/10 text-amber-300"
        : "bg-emerald-300/10 text-emerald-300"
  return (
    <span
      className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${className}`}
    >
      <Icon className="size-4" />
    </span>
  )
}

function Stage({
  label,
  value,
  detail,
  healthy,
}: {
  label: string
  value: string
  detail: string
  healthy: boolean
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
      <div className="flex items-center gap-2">
        <span
          className={`size-2 rounded-full ${healthy ? "bg-emerald-400" : "bg-amber-300"}`}
        />
        <p className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">
          {label}
        </p>
      </div>
      <p className="mt-2 truncate text-xs font-semibold text-white">{value}</p>
      <p className="mt-1 truncate text-[10px] text-slate-500">{detail}</p>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
      <p className="text-[9px] font-bold tracking-wide text-slate-500 uppercase">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-white">{numberText(value)}</p>
    </div>
  )
}

function IdentifierPanel({ run }: { run: Record<string, unknown> }) {
  const entries = [
    ["Remote batch", run.remote_ingestion_batch_id],
    ["Extract job", run.remote_extract_job_id],
    ["Remote file", run.remote_file_id],
    ["Folder upload", run.folder_upload_id],
    ["Source file", run.source_file_id],
  ].filter(([, value]) => text(value))

  return (
    <div className="rounded-xl border border-white/10 bg-black/10 p-4">
      <p className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">
        Correlation IDs
      </p>
      <div className="mt-3 grid gap-2">
        {entries.length ? (
          entries.map(([label, value]) => (
            <button
              key={String(label)}
              type="button"
              onClick={() => void copyText(text(value), String(label))}
              className="group flex items-center justify-between gap-3 text-left"
            >
              <span className="text-[10px] text-slate-500">
                {String(label)}
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <span className="max-w-56 truncate font-mono text-[10px] text-slate-300">
                  {text(value)}
                </span>
                <Copy className="size-3 shrink-0 text-slate-600 group-hover:text-cyan-300" />
              </span>
            </button>
          ))
        ) : (
          <p className="text-xs text-amber-200">Không có correlation ID.</p>
        )}
      </div>
    </div>
  )
}

function TimingPanel({
  run,
  lastActivityAt,
}: {
  run: Record<string, unknown>
  lastActivityAt: string | null
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/10 p-4">
      <p className="flex items-center gap-2 text-[10px] font-bold tracking-wide text-slate-400 uppercase">
        <Clock3 className="size-3.5" /> Timeline
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[10px]">
        <TimeField label="Tạo run" value={run.created_at} />
        <TimeField
          label="Bắt đầu extract"
          value={run.extract_started_at ?? run.started_at}
        />
        <TimeField label="Heartbeat" value={run.heartbeat_at} />
        <TimeField label="Poll gần nhất" value={run.last_polled_at} />
        <TimeField
          label="Hoàn tất extract"
          value={run.extract_completed_at ?? run.finished_at}
        />
        <TimeField label="Hoạt động cuối" value={lastActivityAt} />
      </dl>
    </div>
  )
}

function TimeField({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-300">{dateText(value)}</dd>
    </div>
  )
}

function metadataStage(batches: Array<Record<string, unknown>>): string {
  const statuses = [
    ...new Set(
      batches
        .map((batch) => text(batch.metadata_extraction_status))
        .filter(Boolean)
    ),
  ]
  return statuses.length ? statuses.join(", ") : "Chưa có trạng thái"
}

async function copyText(value: string, label: string) {
  await navigator.clipboard.writeText(value)
  toast.success(`Đã sao chép ${label}.`)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : ""
}

function numberText(value: unknown): string {
  const number = Number(value)
  return value !== null && value !== "" && Number.isFinite(number)
    ? number.toLocaleString("vi-VN")
    : "—"
}

function dateText(value: unknown): string {
  const raw = text(value)
  if (!raw) return "—"
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date)
}
