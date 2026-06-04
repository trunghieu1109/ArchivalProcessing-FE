import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileStack,
  FileText,
  Layers3,
  Loader2,
  Plus,
  RefreshCw,
} from "lucide-react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { cn } from "@/shared/lib/utils"
import { listSessions, type SessionSummary } from "@/features/upload/api/sessionApi"

const LAST_SESSION_KEY = "archival-processing:last-session-id"

export function SessionsPage() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const readyCount = useMemo(
    () => sessions.filter((session) => session.active_plan_version_id).length,
    [sessions]
  )

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const response = await listSessions(200)
      setSessions(response.sessions)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không thể tải danh sách session."
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const openSession = (sessionId: string) => {
    window.localStorage.setItem(LAST_SESSION_KEY, sessionId)
    navigate(`/sessions/${encodeURIComponent(sessionId)}/step/1`)
  }

  const openArtifacts = (sessionId: string) => {
    window.localStorage.setItem(LAST_SESSION_KEY, sessionId)
    navigate(`/sessions/${encodeURIComponent(sessionId)}/step/5`)
  }

  return (
    <div className="min-h-svh bg-[#EEF3F8] text-[#0F172A]">
      <header className="border-b border-[#D8E1EC] bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1560px] flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between md:gap-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <img src="/assets/mbfs.png" alt="MBFS" className="h-12 w-auto object-contain sm:h-14" />
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight">Quản lý phiên chỉnh lý</h1>
              <p className="mt-1 text-sm text-[#64748B]">
                Chọn một session để tiếp tục xử lý hoặc tạo phiên làm việc mới.
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <SummaryPill label="Tổng session" value={sessions.length} />
            <SummaryPill label="Đã có phương án" value={readyCount} />
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1560px] flex-col gap-6 px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">
              Danh sách session
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#0F172A]">
              Hồ sơ xử lý đang có trong hệ thống
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end">
            <button
              onClick={() => void load()}
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-4 py-2 text-sm font-semibold text-[#475569] shadow-sm transition-colors hover:border-[#0052FF]/40 hover:text-[#0052FF] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Làm mới
            </button>
            <button
              onClick={() => navigate("/sessions/new/step/1")}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#0052FF] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(0,82,255,0.22)] transition-all hover:-translate-y-0.5 hover:bg-[#0047D6] active:scale-[0.98]"
            >
              <Plus className="size-4" /> Tạo mới
            </button>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-48 animate-pulse rounded-2xl border border-[#D8E1EC] bg-white" />
            ))}
          </div>
        ) : sessions.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {sessions.map((session, index) => (
              <SessionCard
                key={session.session_id}
                session={session}
                index={index}
                onOpen={() => openSession(session.session_id)}
                onArtifacts={() => openArtifacts(session.session_id)}
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed border-[#CBD5E1] bg-white px-8 text-center shadow-sm">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-[#EAF1FF] text-[#0052FF]">
              <FileStack className="size-7" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">Chưa có session nào</h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-[#64748B]">
              Tạo phiên mới, tải phương án chỉnh lý và bắt đầu phân tích để session chính thức được lưu trong hệ thống.
            </p>
            <button
              onClick={() => navigate("/sessions/new/step/1")}
              className="mt-5 flex items-center gap-2 rounded-xl bg-[#0052FF] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(0,82,255,0.22)] transition-all hover:-translate-y-0.5 hover:bg-[#0047D6] active:scale-[0.98]"
            >
              <Plus className="size-4" /> Tạo session đầu tiên
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

function SessionCard({
  session,
  index,
  onOpen,
  onArtifacts,
}: {
  session: SessionSummary
  index: number
  onOpen: () => void
  onArtifacts: () => void
}) {
  const hasPlan = Boolean(session.active_plan_version_id)
  const hasClusters = Boolean(session.active_cluster_version_id)
  const documentCount = session.document_count ?? 0
  const clusterCount = session.cluster_count ?? 0
  const incorrectCount =
    session.metadata_incorrect_document_count ?? 0
  const correctCount =
    session.metadata_correct_document_count ??
    Math.max(documentCount - incorrectCount, 0)
  const statusText = hasClusters ? "Đã lập hồ sơ" : hasPlan ? "Có phương án" : statusLabel(session.status)
  const displayName = session.fonds_name?.trim() || session.session_id
  const archiveName = session.archive_name?.trim()
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: index * 0.035 }}
      className="group flex min-h-56 flex-col justify-between rounded-2xl border border-[#D8E1EC] bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-[#0052FF]/35 hover:shadow-[0_18px_42px_rgba(15,23,42,0.12)]"
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-[#0F172A]" title={displayName}>
              {displayName}
            </p>
            <p className="mt-1 text-xs text-[#64748B]">
              {displayName === session.session_id ? "Mã session" : `Mã session: ${session.session_id}`}
            </p>
            <p className="mt-1 text-xs text-[#64748B]">
              Cập nhật {formatDate(session.updated_at ?? session.created_at)}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
              hasClusters
                ? "bg-emerald-50 text-emerald-700"
                : hasPlan
                  ? "bg-blue-50 text-[#0052FF]"
                  : "bg-slate-100 text-slate-600"
            )}
          >
            {statusText}
          </span>
        </div>
        <div className="mt-4 flex min-w-0 items-center gap-2 rounded-xl bg-[#F8FAFC] px-3 py-2 text-sm text-[#475569]">
          <Archive className="size-4 shrink-0 text-[#0052FF]" />
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#64748B]">
            Kho
          </span>
          <span className="truncate font-semibold text-[#0F172A]" title={archiveName || "Chưa có kho lưu trữ"}>
            {archiveName || "Chưa có kho lưu trữ"}
          </span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Metric
            icon={<Clock className="size-3.5" />}
            label="Tạo lúc"
            value={shortDateTime(session.created_at)}
            valueClassName="text-xs"
          />
          <Metric
            icon={<FileStack className="size-3.5" />}
            label="Tệp đầu vào"
            value={session.file_count ?? 0}
          />
          <Metric
            icon={<FileText className="size-3.5" />}
            label="Tài liệu"
            value={documentCount}
          />
          <Metric
            icon={<Layers3 className="size-3.5" />}
            label="Số hồ sơ"
            value={clusterCount}
          />
          <Metric
            icon={<CheckCircle2 className="size-3.5" />}
            label="Extract đúng"
            value={correctCount}
            valueClassName="text-emerald-700"
          />
          <Metric
            icon={<AlertTriangle className="size-3.5" />}
            label="Extract sai"
            value={incorrectCount}
            valueClassName={incorrectCount > 0 ? "text-amber-700" : undefined}
          />
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-2 border-t border-[#EEF2F7] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onOpen}
          className="flex items-center justify-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-[#0052FF] transition-colors hover:bg-[#EAF1FF]"
        >
          Mở phông
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </button>
        {hasClusters && (
          <button
            type="button"
            onClick={onArtifacts}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-[#CBD5E1] px-2.5 py-1 text-xs font-semibold text-[#475569] transition-colors hover:border-[#0052FF]/40 hover:text-[#0052FF]"
          >
            <Archive className="size-3.5" />
            Tạo mục lục
          </button>
        )}
      </div>
    </motion.div>
  )
}

function SummaryPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#D8E1EC] bg-white px-4 py-2 text-right shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">{label}</p>
      <p className="text-lg font-bold text-[#0F172A]">{value}</p>
    </div>
  )
}

function Metric({
  icon,
  label,
  value,
  valueClassName,
}: {
  icon: ReactNode
  label: string
  value: string | number
  valueClassName?: string
}) {
  return (
    <div className="rounded-xl bg-[#F8FAFC] px-3 py-2">
      <div className="flex items-center gap-1.5 text-[#64748B]">
        {icon}
        <span className="text-[11px] font-semibold uppercase">{label}</span>
      </div>
      <p className={cn("mt-1 break-words text-sm font-semibold leading-tight text-[#0F172A]", valueClassName)}>
        {value}
      </p>
    </div>
  )
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

function shortDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function statusLabel(value: string): string {
  const normalized = value.toLowerCase()
  if (normalized === "created") return "Mới tạo"
  if (normalized === "processing") return "Đang xử lý"
  if (normalized === "completed" || normalized === "done") return "Hoàn tất"
  if (normalized === "failed" || normalized === "error") return "Có lỗi"
  return value
}
