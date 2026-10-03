import { useMemo, useState } from "react"
import {
  Archive,
  CalendarClock,
  Check,
  Database,
  ExternalLink,
  FileText,
  Loader2,
  Search,
} from "lucide-react"

import type { AuditSessionSummary } from "../backendAudit"

export function FondsBrowser({
  sessions,
  total,
  sessionId,
  onSessionIdChange,
  onOpenSession,
  opening,
}: {
  sessions: AuditSessionSummary[]
  total: number
  sessionId: string
  onSessionIdChange: (sessionId: string) => void
  onOpenSession: (sessionId: string) => void
  opening: boolean
}) {
  const [query, setQuery] = useState("")
  const filteredSessions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("vi")
    if (!normalizedQuery) return sessions
    return sessions.filter((session) =>
      [
        session.session_id,
        session.fonds_name,
        session.fonds_creator_code,
        session.archive_name,
        session.status,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLocaleLowerCase("vi").includes(normalizedQuery)
        )
    )
  }, [query, sessions])

  return (
    <section className="audit-reveal overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_22px_70px_rgba(15,23,42,0.08)]">
      <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.14em] text-[#0f6f78] uppercase">
              Phạm vi audit
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">
              Chọn phông tài liệu
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Session ID sẽ được chèn an toàn vào các endpoint có phạm vi phông.
            </p>
          </div>
          <div className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white">
            {sessions.length.toLocaleString("vi-VN")}/
            {total.toLocaleString("vi-VN")} phông đã tải
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(15rem,0.65fr)]">
          <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-cyan-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-cyan-700/10">
            <Search className="size-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm theo tên phông, mã phông, session ID..."
              className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </label>
          <div className="flex gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Session ID tùy chỉnh</span>
              <input
                value={sessionId}
                onChange={(event) => onSessionIdChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && sessionId.trim()) {
                    onOpenSession(sessionId)
                  }
                }}
                placeholder="Hoặc nhập session ID"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-xs text-slate-900 transition outline-none placeholder:text-slate-400 focus:border-cyan-600 focus:ring-4 focus:ring-cyan-700/10"
                spellCheck={false}
              />
            </label>
            <button
              type="button"
              onClick={() => onOpenSession(sessionId)}
              disabled={!sessionId.trim() || opening}
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-cyan-800 text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Mở chi tiết session"
              title="Mở chi tiết session"
            >
              {opening ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ExternalLink className="size-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-h-[28rem] overflow-auto p-3 sm:p-4">
        {sessions.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-800">
              <Archive className="size-5" />
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-800">
              Chưa có danh sách phông
            </p>
            <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
              Kết nối backend để tải danh sách hoặc nhập trực tiếp session ID
              phía trên.
            </p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="py-14 text-center text-sm text-slate-500">
            Không tìm thấy phông phù hợp với từ khóa.
          </div>
        ) : (
          <div className="grid gap-2">
            {filteredSessions.map((session) => (
              <FondsRow
                key={session.session_id}
                session={session}
                selected={session.session_id === sessionId}
                onSelect={() => onOpenSession(session.session_id)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function FondsRow({
  session,
  selected,
  onSelect,
}: {
  session: AuditSessionSummary
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group grid w-full gap-3 overflow-hidden rounded-2xl border p-4 text-left transition-all md:grid-cols-[minmax(0,1.4fr)_minmax(11rem,0.7fr)_auto] md:items-center ${
        selected
          ? "border-cyan-700 bg-cyan-50 shadow-[0_10px_28px_rgba(15,111,120,0.1)]"
          : "border-slate-100 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"
      }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-700 ease-out group-hover:scale-105 ${
            selected ? "bg-cyan-800 text-white" : "bg-slate-100 text-slate-600"
          }`}
        >
          {selected ? (
            <Check className="size-4" />
          ) : (
            <Database className="size-4" />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-950">
            {session.fonds_name?.trim() || "Chưa đặt tên phông"}
          </p>
          <p className="mt-1 truncate font-mono text-[11px] text-slate-500">
            {session.session_id}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <FileText className="size-3.5" />
          {formatCount(session.document_count)} tài liệu
        </span>
        <span className="flex items-center gap-1.5">
          <Archive className="size-3.5" />
          {session.fonds_creator_code || "Chưa có mã"}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 md:justify-end">
        {session.updated_at && (
          <span className="flex items-center gap-1 text-[11px] text-slate-400">
            <CalendarClock className="size-3" />
            {formatDate(session.updated_at)}
          </span>
        )}
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase ${statusClass(session.status)}`}
        >
          {session.status || "unknown"}
        </span>
      </div>
    </button>
  )
}

function statusClass(status: string | null | undefined): string {
  const normalized = String(status ?? "").toLowerCase()
  if (["completed", "ready", "active", "done"].includes(normalized)) {
    return "bg-emerald-100 text-emerald-800"
  }
  if (["failed", "error", "cancelled"].includes(normalized)) {
    return "bg-rose-100 text-rose-800"
  }
  return "bg-slate-100 text-slate-600"
}

function formatCount(value: unknown): string {
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString("vi-VN") : "—"
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(date)
}
