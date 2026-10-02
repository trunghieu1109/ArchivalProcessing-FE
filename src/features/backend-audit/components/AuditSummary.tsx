import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  FileJson2,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react"

import type { AuditRequestResult } from "../backendAudit"

export function AuditSummary({
  results,
  history,
  onSelectResult,
}: {
  results: Record<string, AuditRequestResult>
  history: AuditRequestResult[]
  onSelectResult: (endpointId: string) => void
}) {
  const latestResults = Object.values(results)
  const successful = latestResults.filter((item) => item.ok).length
  const failed = latestResults.filter((item) => !item.ok).length
  const averageLatency = latestResults.length
    ? Math.round(
        latestResults.reduce((total, item) => total + item.durationMs, 0) /
          latestResults.length
      )
    : 0
  const coverage = latestResults.length
    ? Math.round((successful / latestResults.length) * 100)
    : 0

  return (
    <div className="grid grid-flow-dense grid-cols-1 gap-3 md:grid-cols-12">
      <SummaryCard
        className="md:col-span-4"
        icon={ShieldCheck}
        eyebrow="Khả dụng"
        value={latestResults.length ? `${coverage}%` : "—"}
        detail={`${successful} endpoint tốt, ${failed} endpoint lỗi`}
        tone={failed > 0 ? "warning" : "success"}
      />
      <SummaryCard
        className="md:col-span-4"
        icon={Clock3}
        eyebrow="Độ trễ trung bình"
        value={latestResults.length ? `${averageLatency} ms` : "—"}
        detail={`Tính trên ${latestResults.length} kết quả gần nhất`}
        tone="neutral"
      />
      <div className="audit-reveal overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-950 p-5 text-white shadow-[0_18px_55px_rgba(15,23,42,0.16)] md:col-span-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.16em] text-cyan-300 uppercase">
              Dấu vết gần nhất
            </p>
            <p className="mt-2 text-3xl font-semibold">{history.length}</p>
            <p className="mt-1 text-xs text-slate-400">
              request trong phiên audit
            </p>
          </div>
          <div className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-cyan-300">
            <FileJson2 className="size-5" />
          </div>
        </div>
        {history[0] ? (
          <button
            type="button"
            onClick={() => onSelectResult(history[0].endpointId)}
            className="mt-5 flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-left transition hover:border-cyan-300/30 hover:bg-cyan-300/10"
          >
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold">
                {history[0].endpointTitle}
              </span>
              <span className="mt-0.5 block text-[10px] text-slate-400">
                HTTP {history[0].status ?? "NET"} · {history[0].durationMs} ms
              </span>
            </span>
            <ArrowUpRight className="size-4 shrink-0 text-cyan-300" />
          </button>
        ) : (
          <p className="mt-5 text-xs leading-5 text-slate-500">
            Kết nối backend để bắt đầu thu thập bằng chứng.
          </p>
        )}
      </div>
    </div>
  )
}

function SummaryCard({
  className,
  icon: Icon,
  eyebrow,
  value,
  detail,
  tone,
}: {
  className: string
  icon: typeof Activity
  eyebrow: string
  value: string
  detail: string
  tone: "success" | "warning" | "neutral"
}) {
  const colors =
    tone === "success"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "warning"
        ? "bg-amber-50 text-amber-700"
        : "bg-cyan-50 text-cyan-800"
  const IconComponent =
    tone === "warning"
      ? TriangleAlert
      : tone === "success"
        ? CheckCircle2
        : Icon
  return (
    <article
      className={`audit-reveal rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_18px_55px_rgba(15,23,42,0.08)] ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.16em] text-slate-500 uppercase">
            {eyebrow}
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p>
        </div>
        <div
          className={`flex size-10 items-center justify-center rounded-xl ${colors}`}
        >
          <IconComponent className="size-5" />
        </div>
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-500">{detail}</p>
    </article>
  )
}

export function AuditCapabilityMarquee() {
  const items = [
    "GET-only an toàn",
    "Không lưu credential",
    "JSON tree inspector",
    "Theo dõi HTTP & latency",
    "Xuất bằng chứng audit",
    "Preset theo nghiệp vụ",
  ]
  return (
    <div className="overflow-hidden border-y border-white/10 bg-black/15 py-3">
      <div className="audit-marquee flex w-max items-center gap-8 pr-8 text-[10px] font-semibold tracking-[0.16em] text-slate-400 uppercase motion-reduce:animate-none">
        {[...items, ...items].map((item, index) => (
          <span
            key={`${item}-${index}`}
            className="flex items-center gap-3 whitespace-nowrap"
          >
            <span className="size-1.5 rounded-full bg-cyan-300" />
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}
