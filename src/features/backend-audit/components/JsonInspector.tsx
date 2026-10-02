import { useMemo, useState } from "react"
import {
  Braces,
  Check,
  ChevronRight,
  Clipboard,
  Download,
  FileJson2,
  Search,
} from "lucide-react"
import { toast } from "sonner"

import type { AuditRequestResult } from "../backendAudit"

type InspectorTab = "response" | "headers"

export function JsonInspector({
  result,
}: {
  result: AuditRequestResult | null
}) {
  const [tab, setTab] = useState<InspectorTab>("response")
  const [mode, setMode] = useState<"tree" | "raw">("tree")
  const [query, setQuery] = useState("")
  const [copied, setCopied] = useState(false)
  const displayedValue = tab === "response" ? result?.data : result?.headers
  const rawText = useMemo(
    () => stringifyForDisplay(displayedValue),
    [displayedValue]
  )
  const filteredText = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("vi")
    if (!normalizedQuery) return rawText
    return rawText
      .split("\n")
      .filter((line) => line.toLocaleLowerCase("vi").includes(normalizedQuery))
      .join("\n")
  }, [query, rawText])

  const copy = async () => {
    await navigator.clipboard.writeText(rawText)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1_500)
    toast.success("Đã sao chép dữ liệu phản hồi.")
  }

  const download = () => {
    if (!result) return
    const blob = new Blob([rawText], { type: "application/json;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${safeFileName(result.endpointId)}-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="flex min-h-[34rem] flex-col overflow-hidden rounded-[1.75rem] border border-slate-200 bg-[#08111f] text-slate-100 shadow-[0_28px_80px_rgba(3,11,24,0.2)]">
      <div className="border-b border-white/10 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-cyan-300 uppercase">
              <Braces className="size-4" /> Response inspector
            </div>
            <h2 className="mt-2 truncate text-lg font-semibold text-white">
              {result?.endpointTitle ?? "Chọn một endpoint để xem dữ liệu"}
            </h2>
            {result && (
              <p className="mt-1 truncate font-mono text-xs text-slate-400">
                GET {result.path}
              </p>
            )}
          </div>
          {result && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void copy()}
                className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:border-cyan-300/40 hover:bg-cyan-300/10 hover:text-cyan-200"
                aria-label="Sao chép JSON"
                title="Sao chép JSON"
              >
                {copied ? (
                  <Check className="size-4" />
                ) : (
                  <Clipboard className="size-4" />
                )}
              </button>
              <button
                type="button"
                onClick={download}
                className="flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:border-cyan-300/40 hover:bg-cyan-300/10 hover:text-cyan-200"
                aria-label="Tải JSON"
                title="Tải JSON"
              >
                <Download className="size-4" />
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <InspectorButton
            active={tab === "response"}
            onClick={() => setTab("response")}
          >
            Dữ liệu
          </InspectorButton>
          <InspectorButton
            active={tab === "headers"}
            onClick={() => setTab("headers")}
          >
            Headers
          </InspectorButton>
          <span className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />
          <InspectorButton
            active={mode === "tree"}
            onClick={() => setMode("tree")}
          >
            Cây JSON
          </InspectorButton>
          <InspectorButton
            active={mode === "raw"}
            onClick={() => setMode("raw")}
          >
            Raw
          </InspectorButton>
        </div>
      </div>

      <div className="border-b border-white/10 p-3 sm:px-5">
        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-slate-300 focus-within:border-cyan-300/40 focus-within:ring-2 focus-within:ring-cyan-300/10">
          <Search className="size-4 shrink-0" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Lọc theo khóa hoặc giá trị..."
            className="h-10 w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4 font-mono text-[12px] leading-6 sm:p-5">
        {!result ? (
          <div className="flex min-h-72 flex-col items-center justify-center text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
              <FileJson2 className="size-6" />
            </div>
            <p className="mt-4 max-w-xs font-sans text-sm leading-6 text-slate-400">
              Kết quả thành công hoặc lỗi đều được giữ nguyên ở đây để đối
              chiếu.
            </p>
          </div>
        ) : result.error && displayedValue === null ? (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 font-sans text-sm leading-6 text-rose-200">
            {result.error}
          </div>
        ) : mode === "tree" && !query.trim() ? (
          <JsonNode value={displayedValue} name="root" depth={0} />
        ) : (
          <pre className="min-w-max break-words whitespace-pre-wrap text-slate-300">
            {filteredText || "Không tìm thấy nội dung phù hợp."}
          </pre>
        )}
      </div>

      {result && (
        <footer className="grid grid-cols-2 gap-px border-t border-white/10 bg-white/10 text-xs sm:grid-cols-4">
          <InspectorMetric label="HTTP" value={result.status ?? "NET"} />
          <InspectorMetric label="Độ trễ" value={`${result.durationMs} ms`} />
          <InspectorMetric
            label="Kích thước"
            value={formatBytes(result.sizeBytes)}
          />
          <InspectorMetric
            label="Thời điểm"
            value={new Intl.DateTimeFormat("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }).format(new Date(result.requestedAt))}
          />
        </footer>
      )}
    </section>
  )
}

function JsonNode({
  value,
  name,
  depth,
}: {
  value: unknown
  name: string
  depth: number
}) {
  const isArray = Array.isArray(value)
  const isRecord = Boolean(value && typeof value === "object")
  if (!isRecord) {
    return (
      <div className="flex gap-2">
        <span className="text-cyan-300">{name}:</span>
        <JsonPrimitive value={value} />
      </div>
    )
  }

  const entries = Object.entries(value as Record<string, unknown>)
  const visibleEntries = entries.slice(0, 100)
  return (
    <details open={depth < 2} className="group/json">
      <summary className="flex cursor-pointer list-none items-center gap-1 text-slate-300 hover:text-white">
        <ChevronRight className="size-3.5 transition-transform group-open/json:rotate-90" />
        <span className="text-cyan-300">{name}</span>
        <span className="text-slate-500">
          {isArray ? `[${entries.length}]` : `{${entries.length}}`}
        </span>
      </summary>
      <div className="ml-1 border-l border-white/10 pl-4">
        {visibleEntries.map(([key, child]) => (
          <JsonNode key={key} value={child} name={key} depth={depth + 1} />
        ))}
        {entries.length > visibleEntries.length && (
          <p className="text-amber-300">
            Còn {entries.length - visibleEntries.length} phần tử. Chuyển sang
            Raw để xem toàn bộ.
          </p>
        )}
      </div>
    </details>
  )
}

function JsonPrimitive({ value }: { value: unknown }) {
  if (value === null) return <span className="text-violet-300">null</span>
  if (typeof value === "string")
    return (
      <span className="break-all text-emerald-300">&quot;{value}&quot;</span>
    )
  if (typeof value === "number")
    return <span className="text-amber-300">{value}</span>
  if (typeof value === "boolean")
    return <span className="text-violet-300">{String(value)}</span>
  return <span className="text-slate-400">{String(value)}</span>
}

function InspectorButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "bg-cyan-300 text-slate-950"
          : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </button>
  )
}

function InspectorMetric({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="bg-[#08111f] px-4 py-3">
      <p className="font-sans text-[10px] font-semibold tracking-[0.12em] text-slate-500 uppercase">
        {label}
      </p>
      <p className="mt-1 truncate text-slate-200">{value}</p>
    </div>
  )
}

function stringifyForDisplay(value: unknown): string {
  if (typeof value === "string") return value
  if (value === undefined) return ""
  return JSON.stringify(value, null, 2)
}

function formatBytes(value: number): string {
  if (value < 1_024) return `${value} B`
  if (value < 1_048_576) return `${(value / 1_024).toFixed(1)} KB`
  return `${(value / 1_048_576).toFixed(1)} MB`
}

function safeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-")
}
