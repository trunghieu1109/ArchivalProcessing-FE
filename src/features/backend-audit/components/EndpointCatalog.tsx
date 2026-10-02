import { useMemo, useState } from "react"
import {
  Activity,
  Archive,
  Braces,
  CircleStop,
  Clock3,
  Database,
  FileClock,
  FolderTree,
  Loader2,
  Play,
  Radar,
  SearchCode,
  ServerCog,
} from "lucide-react"

import {
  AUDIT_CATEGORIES,
  AUDIT_ENDPOINTS,
  auditResultCount,
  type AuditCategoryId,
  type AuditEndpoint,
  type AuditRequestResult,
} from "../backendAudit"

const CATEGORY_ICONS = {
  infrastructure: ServerCog,
  fonds: Database,
  ocr: SearchCode,
  classification: FolderTree,
  dossiers: Archive,
  evidence: FileClock,
} satisfies Record<AuditCategoryId, typeof Activity>

export function EndpointCatalog({
  sessionId,
  results,
  selectedEndpointId,
  runningEndpointIds,
  onRun,
  onSelect,
  onRunAll,
  onCancelAll,
  onRunCustom,
}: {
  sessionId: string
  results: Record<string, AuditRequestResult>
  selectedEndpointId: string | null
  runningEndpointIds: Set<string>
  onRun: (endpoint: AuditEndpoint) => void
  onSelect: (endpointId: string) => void
  onRunAll: () => void
  onCancelAll: () => void
  onRunCustom: (path: string) => void
}) {
  const [activeCategory, setActiveCategory] =
    useState<AuditCategoryId>("infrastructure")
  const [customPath, setCustomPath] = useState("")
  const categoryEndpoints = useMemo(
    () => AUDIT_ENDPOINTS.filter((item) => item.category === activeCategory),
    [activeCategory]
  )
  const anyRunning = runningEndpointIds.size > 0

  return (
    <section className="audit-reveal rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-[0_22px_70px_rgba(15,23,42,0.08)] sm:p-6">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-[#0f6f78] uppercase">
            Endpoint explorer
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">
            Dữ liệu nghiệp vụ cần đối chiếu
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Preset được ánh xạ từ API thật của hệ thống. Các endpoint có biểu
            tượng khóa cần session ID.
          </p>
        </div>
        <button
          type="button"
          onClick={anyRunning ? onCancelAll : onRunAll}
          className={`flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition ${
            anyRunning
              ? "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
              : "bg-slate-950 text-white shadow-lg hover:-translate-y-0.5 hover:bg-slate-800"
          }`}
        >
          {anyRunning ? (
            <CircleStop className="size-4" />
          ) : (
            <Radar className="size-4" />
          )}
          {anyRunning ? "Dừng đợt quét" : "Quét toàn bộ"}
        </button>
      </div>

      <div className="mt-5 flex min-h-20 gap-2 overflow-x-auto pb-1">
        {AUDIT_CATEGORIES.map((category) => {
          const Icon = CATEGORY_ICONS[category.id]
          const active = category.id === activeCategory
          const endpoints = AUDIT_ENDPOINTS.filter(
            (item) => item.category === category.id
          )
          const successCount = endpoints.filter(
            (item) => results[item.id]?.ok
          ).length
          return (
            <button
              type="button"
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`group flex min-w-[7.5rem] flex-1 items-center gap-3 overflow-hidden rounded-2xl border px-3 py-3 text-left transition-all duration-500 ${
                active
                  ? "min-w-[15rem] border-cyan-700 bg-cyan-50"
                  : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
              }`}
            >
              <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-700 ease-out group-hover:scale-105 ${
                  active ? "bg-cyan-800 text-white" : "bg-white text-slate-500"
                }`}
              >
                <Icon className="size-4" />
              </span>
              <span className={active ? "block min-w-0" : "hidden xl:block"}>
                <span className="block truncate text-xs font-bold text-slate-900">
                  {category.label}
                </span>
                <span className="mt-1 block truncate text-[10px] text-slate-500">
                  {successCount}/{endpoints.length} phản hồi tốt
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {categoryEndpoints.map((endpoint) => (
          <EndpointCard
            key={endpoint.id}
            endpoint={endpoint}
            result={results[endpoint.id]}
            selected={selectedEndpointId === endpoint.id}
            running={runningEndpointIds.has(endpoint.id)}
            disabled={Boolean(endpoint.requiresSession && !sessionId.trim())}
            onRun={() => onRun(endpoint)}
            onSelect={() => onSelect(endpoint.id)}
          />
        ))}
      </div>

      <form
        className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4"
        onSubmit={(event) => {
          event.preventDefault()
          onRunCustom(customPath)
        }}
      >
        <div className="flex items-center gap-2 text-xs font-bold tracking-[0.12em] text-slate-600 uppercase">
          <Braces className="size-4" /> GET tùy chỉnh
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <div className="flex min-w-0 flex-1 items-center rounded-xl border border-slate-200 bg-white focus-within:border-cyan-700 focus-within:ring-4 focus-within:ring-cyan-700/10">
            <span className="border-r border-slate-200 px-3 font-mono text-xs font-bold text-emerald-700">
              GET
            </span>
            <input
              value={customPath}
              onChange={(event) => setCustomPath(event.target.value)}
              placeholder="/api/sessions/{id}/..."
              className="h-11 min-w-0 flex-1 bg-transparent px-3 font-mono text-xs text-slate-900 outline-none placeholder:text-slate-400"
              spellCheck={false}
            />
          </div>
          <button
            type="submit"
            disabled={anyRunning || !customPath.trim()}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-cyan-800 px-5 text-sm font-bold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play className="size-4 fill-current" /> Gửi yêu cầu
          </button>
        </div>
      </form>
    </section>
  )
}

function EndpointCard({
  endpoint,
  result,
  selected,
  running,
  disabled,
  onRun,
  onSelect,
}: {
  endpoint: AuditEndpoint
  result?: AuditRequestResult
  selected: boolean
  running: boolean
  disabled: boolean
  onRun: () => void
  onSelect: () => void
}) {
  return (
    <article
      className={`audit-stack-card group overflow-hidden rounded-2xl border p-4 transition-all ${
        selected
          ? "border-cyan-700 bg-cyan-50 shadow-[0_12px_34px_rgba(15,111,120,0.1)]"
          : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="block w-full text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-emerald-100 px-1.5 py-1 font-mono text-[9px] font-bold text-emerald-800">
                GET
              </span>
              {endpoint.requiresSession && (
                <span className="truncate font-mono text-[10px] text-slate-400">
                  SESSION
                </span>
              )}
            </div>
            <h3 className="mt-3 text-sm font-bold text-slate-950">
              {endpoint.title}
            </h3>
          </div>
          <ResultStatus result={result} running={running} />
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          {endpoint.description}
        </p>
        {result && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <Clock3 className="size-3" /> {result.durationMs} ms
            </span>
            <span>
              {auditResultCount(result).toLocaleString("vi-VN")} bản ghi
            </span>
            <span>HTTP {result.status ?? "NET"}</span>
          </div>
        )}
      </button>
      <button
        type="button"
        onClick={onRun}
        disabled={disabled || running}
        className="mt-4 flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 transition hover:border-cyan-700 hover:text-cyan-800 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        title={disabled ? "Hãy chọn session ID" : `Gọi ${endpoint.title}`}
      >
        {running ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Play className="size-3.5 fill-current" />
        )}
        {disabled
          ? "Cần session ID"
          : running
            ? "Đang gọi API"
            : "Chạy kiểm tra"}
      </button>
    </article>
  )
}

function ResultStatus({
  result,
  running,
}: {
  result?: AuditRequestResult
  running: boolean
}) {
  if (running) {
    return <Loader2 className="size-4 shrink-0 animate-spin text-cyan-700" />
  }
  if (!result) {
    return <span className="size-2.5 shrink-0 rounded-full bg-slate-200" />
  }
  return (
    <span
      className={`size-2.5 shrink-0 rounded-full ${result.ok ? "bg-emerald-500" : "bg-rose-500"}`}
      title={result.ok ? "Phản hồi thành công" : result.error || "Phản hồi lỗi"}
    />
  )
}
