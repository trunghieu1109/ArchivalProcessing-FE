import { useMemo, useState } from "react"
import {
  Activity,
  AlertCircle,
  BriefcaseBusiness,
  CircleDot,
  Clock3,
  ListChecks,
  Search,
} from "lucide-react"

import type { AuditRequestResult } from "../backendAudit"
import {
  asRecord,
  asRecords,
  dateText,
  numberText,
  text,
} from "../auditValueFormatters"
import type { SessionAuditData } from "../sessionAuditData"
import { AuditStatusBadge } from "./AuditStatusBadge"

export function SessionOperationsAuditPanel({
  data,
  results,
  onOpenRaw,
}: {
  data: SessionAuditData
  results: Record<string, AuditRequestResult>
  onOpenRaw: (endpointId: string) => void
}) {
  const [eventQuery, setEventQuery] = useState("")
  const normalizedQuery = eventQuery.trim().toLocaleLowerCase("vi")
  const events = useMemo(
    () =>
      [...data.events].reverse().filter((event) => {
        if (!normalizedQuery) return true
        return [
          event.event_type,
          event.message,
          event.id,
          JSON.stringify(event.payload ?? {}),
        ]
          .map(text)
          .some((value) =>
            value.toLocaleLowerCase("vi").includes(normalizedQuery)
          )
      }),
    [data.events, normalizedQuery]
  )
  const digitization = asRecord(results.digitization?.data)
  const ingestionRuns = asRecords(digitization?.ingestion_runs)
  const sessionQueued = data.sessionDashboard?.queued_job_count
  const sessionFailed = data.sessionDashboard?.failed_job_count

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric
          icon={BriefcaseBusiness}
          label="Job toàn server"
          value={data.dashboardSummary?.job_count}
        />
        <Metric
          icon={Clock3}
          label="Queued/running toàn server"
          value={data.dashboardSummary?.queued_job_count}
          tone="warning"
        />
        <Metric
          icon={AlertCircle}
          label="Failed toàn server"
          value={data.dashboardSummary?.failed_job_count}
          tone="danger"
        />
        <Metric
          icon={CircleDot}
          label="Queued/running session"
          value={sessionQueued}
          tone="warning"
        />
        <Metric
          icon={AlertCircle}
          label="Failed session"
          value={sessionFailed}
          tone="danger"
        />
      </div>

      <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-950">
              <ListChecks className="size-4 text-cyan-800" /> Job được API
              session expose
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Thu thập từ plan analysis, cluster build, numbering và
              finalize-artifact. Đây không phải toàn bộ bảng jobs.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenRaw("admin-dashboard")}
            className="shrink-0 text-xs font-semibold text-cyan-800"
          >
            Xem dashboard JSON
          </button>
        </div>
        {results["admin-dashboard"] && !results["admin-dashboard"].ok && (
          <EndpointError result={results["admin-dashboard"]} />
        )}
        {data.relatedJobs.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {data.relatedJobs.map((job, index) => (
              <JobCard
                key={text(job.id ?? job.job_id) || String(index)}
                job={job}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
            Không có active job được nhúng trong các response hiện tại. Backend
            chưa có GET job list theo session để hiển thị job đã hoàn tất hoặc
            failed cụ thể.
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-950">
              <Activity className="size-4 text-cyan-800" /> Ingestion run và
              remote extract
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Các ID giúp nối event/job với tiến trình ingest phía server OCR.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenRaw("digitization")}
            className="shrink-0 text-xs font-semibold text-cyan-800"
          >
            Xem JSON
          </button>
        </div>
        {ingestionRuns.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-left text-xs">
              <thead className="text-[10px] tracking-wide text-slate-400 uppercase">
                <tr>
                  <th className="pb-3 font-semibold">Run</th>
                  <th className="pb-3 font-semibold">File</th>
                  <th className="pb-3 font-semibold">Trạng thái</th>
                  <th className="pb-3 font-semibold">Remote batch</th>
                  <th className="pb-3 font-semibold">Extract job</th>
                  <th className="pb-3 font-semibold">Cập nhật</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ingestionRuns.map((run, index) => (
                  <tr key={text(run.id) || String(index)}>
                    <td className="py-3 pr-4 font-mono text-[11px] text-slate-600">
                      #{text(run.id) || "—"}
                    </td>
                    <td className="max-w-xs truncate py-3 pr-4 font-medium text-slate-800">
                      {text(run.file_name) || "—"}
                    </td>
                    <td className="py-3 pr-4">
                      <AuditStatusBadge value={text(run.status) || "unknown"} />
                    </td>
                    <td className="py-3 pr-4 font-mono text-[11px] text-slate-500">
                      {text(run.remote_ingestion_batch_id) || "—"}
                    </td>
                    <td className="py-3 pr-4 font-mono text-[11px] text-slate-500">
                      {text(run.remote_extract_job_id) || "—"}
                    </td>
                    <td className="py-3 text-slate-500">
                      {dateText(run.updated_at ?? run.last_polled_at) || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty text="Không có ingestion run trong response digitization." />
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-950">
              <Clock3 className="size-4 text-cyan-800" /> Event của session (
              {data.events.length})
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Hiển thị mới nhất trong trang API hiện tại trước; mở từng event để
              xem payload.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenRaw("events")}
            className="shrink-0 text-xs font-semibold text-cyan-800"
          >
            Xem JSON
          </button>
        </div>
        <label className="mt-4 flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-cyan-700 focus-within:bg-white">
          <Search className="size-4 text-slate-400" />
          <input
            value={eventQuery}
            onChange={(event) => setEventQuery(event.target.value)}
            placeholder="Lọc event type, message, payload..."
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>
        {results.events && !results.events.ok ? (
          <div className="mt-4">
            <EndpointError result={results.events} />
          </div>
        ) : events.length ? (
          <div className="mt-4 grid max-h-[48rem] gap-2 overflow-auto pr-1">
            {events.map((event, index) => (
              <details
                key={text(event.id) || String(index)}
                className="rounded-xl border border-slate-100 bg-slate-50 p-3"
              >
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {text(event.event_type) || "unknown.event"}
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {text(event.message) || "Không có message"}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-400">
                      #{text(event.id) || "—"} ·{" "}
                      {dateText(event.created_at) || "—"}
                    </span>
                  </div>
                </summary>
                <pre className="mt-3 max-h-72 overflow-auto rounded-xl bg-slate-950 p-3 text-[11px] leading-5 text-cyan-100">
                  {JSON.stringify(event.payload ?? {}, null, 2)}
                </pre>
              </details>
            ))}
          </div>
        ) : (
          <div className="mt-4">
            <Empty text="Không có event phù hợp." />
          </div>
        )}
      </section>
    </div>
  )
}

function JobCard({ job }: { job: Record<string, unknown> }) {
  return (
    <details className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-slate-900">
              {text(job.job_type) || "Job"}
            </p>
            <p className="mt-1 font-mono text-[11px] text-slate-500">
              id={text(job.id ?? job.job_id) || "—"} · retry=
              {text(job.retry_count) || "0"}
            </p>
          </div>
          <AuditStatusBadge value={text(job.status) || "unknown"} />
        </div>
      </summary>
      <div className="mt-3 border-t border-slate-200 pt-3">
        <p className="text-xs text-slate-600">
          Worker: {text(job.locked_by ?? job.worker_id) || "—"} · updated:{" "}
          {dateText(job.updated_at ?? job.locked_at) || "—"}
        </p>
        {job.error ? (
          <p className="mt-2 rounded-lg bg-rose-50 p-2 text-xs text-rose-800">
            {text(job.error)}
          </p>
        ) : null}
        {job.payload ? (
          <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-slate-950 p-2 text-[10px] leading-5 text-cyan-100">
            {JSON.stringify(job.payload, null, 2)}
          </pre>
        ) : null}
      </div>
    </details>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: typeof Activity
  label: string
  value: unknown
  tone?: "default" | "warning" | "danger"
}) {
  const color =
    tone === "danger"
      ? "text-rose-600"
      : tone === "warning"
        ? "text-amber-600"
        : "text-cyan-800"
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
          {label}
        </p>
        <Icon className={`size-4 ${color}`} />
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-950">
        {numberText(value)}
      </p>
    </div>
  )
}

function EndpointError({ result }: { result: AuditRequestResult }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
      {result.error || `Backend trả HTTP ${result.status ?? "NET"}.`}
    </div>
  )
}

function Empty({ text: value }: { text: string }) {
  return (
    <div className="grid min-h-28 place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
      {value}
    </div>
  )
}
