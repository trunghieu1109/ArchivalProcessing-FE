import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { FileStack, Loader2, Plus, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { listChinhlyUsers, type ChinhlyUser } from "@/features/auth/api/authApi"
import { UserMenu } from "@/features/auth/components/UserMenu"
import { useAuth } from "@/features/auth/lib/AuthContext"
import {
  assignSessionCoordinator,
  deleteSession,
  listSessions,
  type SessionSummary,
} from "@/features/upload/api/sessionApi"
import {
  SessionCard,
  SummaryPill,
  chinhlyUserId,
  normalizedRole,
} from "./SessionsPage.components"

const LAST_SESSION_KEY = "archival-processing:last-session-id"

export function SessionsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = normalizedRole(user?.role) === "admin"
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [coordinators, setCoordinators] = useState<ChinhlyUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(
    null
  )
  const [assigningSessionId, setAssigningSessionId] = useState<string | null>(
    null
  )

  const readyCount = useMemo(
    () => sessions.filter((session) => session.active_plan_version_id).length,
    [sessions]
  )

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const [response, coordinatorUsers] = await Promise.all([
        listSessions(200),
        isAdmin
          ? listChinhlyUsers({ role: "coordinator", active: true, limit: 500 })
          : Promise.resolve([]),
      ])
      setSessions(response.sessions)
      setCoordinators(coordinatorUsers)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Không thể tải danh sách session."
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [isAdmin])

  const coordinatorById = useMemo(() => {
    const map = new Map<string, ChinhlyUser>()
    for (const coordinator of coordinators) {
      const id = chinhlyUserId(coordinator)
      if (id) map.set(id, coordinator)
    }
    return map
  }, [coordinators])

  const openSession = (sessionId: string) => {
    window.localStorage.setItem(LAST_SESSION_KEY, sessionId)
    navigate(`/sessions/${encodeURIComponent(sessionId)}/step/1`)
  }

  const openArtifacts = (sessionId: string) => {
    window.localStorage.setItem(LAST_SESSION_KEY, sessionId)
    navigate(`/sessions/${encodeURIComponent(sessionId)}/step/5`)
  }

  const removeSession = async (session: SessionSummary) => {
    const displayName = session.fonds_name?.trim() || session.session_id
    const confirmed = window.confirm(
      `Xóa session "${displayName}"? Toàn bộ dữ liệu và tệp liên quan sẽ bị xóa vĩnh viễn.`
    )
    if (!confirmed) return

    setDeletingSessionId(session.session_id)
    try {
      const response = await deleteSession(session.session_id)
      setSessions((current) =>
        current.filter((item) => item.session_id !== session.session_id)
      )
      if (
        window.localStorage.getItem(LAST_SESSION_KEY) === session.session_id
      ) {
        window.localStorage.removeItem(LAST_SESSION_KEY)
      }
      if (response.storage_cleanup_errors.length > 0) {
        toast.warning(
          "Đã xóa session nhưng không thể dọn hết một số tệp lưu trữ."
        )
      } else {
        toast.success("Đã xóa session.")
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Không thể xóa session."
      toast.error(message)
    } finally {
      setDeletingSessionId(null)
    }
  }

  const assignCoordinator = async (
    session: SessionSummary,
    coordinatorUserId: string | null
  ) => {
    setAssigningSessionId(session.session_id)
    try {
      const updated = await assignSessionCoordinator(
        session.session_id,
        coordinatorUserId
      )
      setSessions((current) =>
        current.map((item) =>
          item.session_id === session.session_id
            ? { ...item, ...updated }
            : item
        )
      )
      toast.success(
        coordinatorUserId
          ? "Đã phân công session cho coordinator."
          : "Đã bỏ phân công coordinator khỏi session."
      )
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Không thể phân công coordinator."
      )
    } finally {
      setAssigningSessionId(null)
    }
  }

  return (
    <div className="min-h-svh bg-[#EEF3F8] text-[#0F172A]">
      <header className="border-b border-[#D8E1EC] bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1560px] flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between md:gap-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <img
              src="/assets/mbfs.png"
              alt="MBFS"
              className="h-12 w-auto object-contain sm:h-14"
            />
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight">
                Quản lý phiên chỉnh lý
              </h1>
              <p className="mt-1 text-sm text-[#64748B]">
                Chọn một session để tiếp tục xử lý hoặc tạo phiên làm việc mới.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 md:flex">
            <div className="hidden items-center gap-3 lg:flex">
              <SummaryPill label="Tổng session" value={sessions.length} />
              <SummaryPill label="Đã có phương án" value={readyCount} />
              {isAdmin && (
                <SummaryPill
                  label="Đã phân công"
                  value={
                    sessions.filter((session) => session.coordinator_user_id)
                      .length
                  }
                />
              )}
            </div>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1560px] flex-col gap-6 px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.16em] text-[#64748B] uppercase">
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
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
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
              <div
                key={index}
                className="h-48 animate-pulse rounded-2xl border border-[#D8E1EC] bg-white"
              />
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
                onDelete={() => void removeSession(session)}
                deleting={deletingSessionId === session.session_id}
                isAdmin={isAdmin}
                coordinators={coordinators}
                coordinator={coordinatorById.get(
                  session.coordinator_user_id ?? ""
                )}
                assigning={assigningSessionId === session.session_id}
                onAssignCoordinator={(coordinatorUserId) =>
                  void assignCoordinator(session, coordinatorUserId)
                }
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
              Tạo phiên mới, tải phương án chỉnh lý và bắt đầu phân tích để
              session chính thức được lưu trong hệ thống.
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
