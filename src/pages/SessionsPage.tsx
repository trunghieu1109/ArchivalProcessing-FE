import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { FileStack, Loader2, Plus, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { listChinhlyUsers, type ChinhlyUser } from "@/features/auth/api/authApi"
import { UserMenu } from "@/features/auth/components/UserMenu"
import { useAuth } from "@/features/auth/lib/AuthContext"
import { PaginationControls } from "@/features/upload/components/PaginationControls"
import {
  assignSessionCoordinator,
  collectSessionBackupUrls,
  deleteSession,
  getSession,
  listSessions,
  type SessionBackupProgress,
  type SessionSummary,
} from "@/features/upload/api/sessionApi"
import {
  SessionCard,
  SummaryPill,
} from "./SessionsPage.components"
import {
  analysisStatusesFromSessionDetail,
  chinhlyUserId,
  fallbackAnalysisStatuses,
  normalizedRole,
  type SessionAnalysisStatuses,
} from "./SessionsPage.utils"

const LAST_SESSION_KEY = "archival-processing:last-session-id"
const SESSION_PAGE_SIZE = 12

async function loadAnalysisStatuses(
  sessions: SessionSummary[]
): Promise<Record<string, SessionAnalysisStatuses>> {
  const fallbackStatuses = Object.fromEntries(
    sessions.map((session) => [
      session.session_id,
      fallbackAnalysisStatuses(session),
    ])
  ) as Record<string, SessionAnalysisStatuses>

  const results = await Promise.allSettled(
    sessions.map(async (session) => {
      const detail = await getSession(session.session_id)
      return [
        session.session_id,
        analysisStatusesFromSessionDetail(detail),
      ] as const
    })
  )

  for (const result of results) {
    if (result.status !== "fulfilled") continue
    const [sessionId, statuses] = result.value
    fallbackStatuses[sessionId] = statuses
  }

  return fallbackStatuses
}

export function SessionsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const role = normalizedRole(user?.role)
  const isAdmin = role === "admin"
  const canBackup = role === "admin" || role === "coordinator"
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [sessionTotal, setSessionTotal] = useState(0)
  const [sessionPageIndex, setSessionPageIndex] = useState(0)
  const sessionPageSize = SESSION_PAGE_SIZE
  const [coordinators, setCoordinators] = useState<ChinhlyUser[]>([])
  const [analysisStatusesBySessionId, setAnalysisStatusesBySessionId] =
    useState<Record<string, SessionAnalysisStatuses>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(
    null
  )
  const [assigningSessionId, setAssigningSessionId] = useState<string | null>(
    null
  )
  const [backupProgress, setBackupProgress] = useState<
    (SessionBackupProgress & { sessionId: string }) | null
  >(null)
  const loadRequestIdRef = useRef(0)
  const readyCount = useMemo(
    () => sessions.filter((session) => session.active_plan_version_id).length,
    [sessions]
  )

  const assignedCount = useMemo(
    () => sessions.filter((session) => session.coordinator_user_id).length,
    [sessions]
  )

  const sessionOffset = sessionPageIndex * sessionPageSize
  const sessionPageCount = Math.max(1, Math.ceil(sessionTotal / sessionPageSize))
  const displayedPageIndex = Math.min(sessionPageIndex, sessionPageCount - 1)
  const sessionStartNumber =
    sessionTotal === 0 ? 0 : displayedPageIndex * sessionPageSize + 1
  const sessionEndNumber =
    sessionTotal === 0
      ? 0
      : Math.min(sessionTotal, sessionStartNumber + sessions.length - 1)

  const load = useCallback(async () => {
    const requestId = loadRequestIdRef.current + 1
    loadRequestIdRef.current = requestId
    setLoading(true)
    setError("")
    try {
      const [response, coordinatorUsers] = await Promise.all([
        listSessions({
          limit: sessionPageSize,
          offset: sessionOffset,
        }),
        isAdmin
          ? listChinhlyUsers({ role: "coordinator", active: true, limit: 500 })
          : Promise.resolve([]),
      ])
      if (loadRequestIdRef.current !== requestId) return
      const total = response.pagination?.total ?? response.sessions.length
      const pageCount = Math.max(1, Math.ceil(total / sessionPageSize))
      if (
        response.sessions.length === 0 &&
        total > 0 &&
        sessionPageIndex >= pageCount
      ) {
        setSessionTotal(total)
        setCoordinators(coordinatorUsers)
        setAnalysisStatusesBySessionId({})
        setSessionPageIndex(pageCount - 1)
        return
      }
      const nextAnalysisStatuses = await loadAnalysisStatuses(
        response.sessions
      )
      if (loadRequestIdRef.current !== requestId) return
      setSessions(response.sessions)
      setSessionTotal(total)
      setCoordinators(coordinatorUsers)
      setAnalysisStatusesBySessionId(nextAnalysisStatuses)
    } catch (err) {
      if (loadRequestIdRef.current !== requestId) return
      const message =
        err instanceof Error ? err.message : "Không thể tải danh sách session."
      setError(message)
      toast.error(message)
    } finally {
      if (loadRequestIdRef.current === requestId) setLoading(false)
    }
  }, [
    isAdmin,
    sessionOffset,
    sessionPageIndex,
    sessionPageSize,
  ])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

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

  const removeSession = async (session: SessionSummary) => {
    const displayName = session.fonds_name?.trim() || "Chưa đặt tên phông"
    const confirmed = window.confirm(
      `Xóa session "${displayName}"? Toàn bộ dữ liệu và tệp liên quan sẽ bị xóa vĩnh viễn.`
    )
    if (!confirmed) return

    setDeletingSessionId(session.session_id)
    try {
      const response = await deleteSession(session.session_id)
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
      if (sessions.length === 1 && sessionPageIndex > 0) {
        setSessionPageIndex((current) => Math.max(0, current - 1))
      } else {
        void load()
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
          ? "Đã phân công người chịu trách nhiệm."
          : "Đã bỏ phân công người chịu trách nhiệm."
      )
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Không thể phân công người chịu trách nhiệm."
      )
    } finally {
      setAssigningSessionId(null)
    }
  }

  const exportBackupUrls = async (session: SessionSummary) => {
    setBackupProgress({
      sessionId: session.session_id,
      stage: "manifest",
      processedDocuments: 0,
      totalDocuments: session.document_count ?? 0,
      batchNumber: 0,
    })
    try {
      const result = await collectSessionBackupUrls(
        session.session_id,
        (progress) =>
          setBackupProgress({ ...progress, sessionId: session.session_id })
      )
      const blob = new Blob([JSON.stringify(result, null, 2)], {
        type: "application/json;charset=utf-8",
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${safeBackupFileName(session.session_id)}-backup-urls.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      if (result.source_changed_during_export) {
        toast.warning(
          "Đã xuất JSON nhưng session có thay đổi trong lúc tổng hợp. Nên backup lại khi xử lý đã dừng."
        )
      } else {
        toast.success(
          "Đã xuất dữ liệu backup và URL PDF. Các URL tải có thời hạn."
        )
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Không thể xuất dữ liệu backup."
      )
    } finally {
      setBackupProgress(null)
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
              <SummaryPill label="Tổng session" value={sessionTotal} />
              <SummaryPill label="Trang có phương án" value={readyCount} />
              {isAdmin && (
                <SummaryPill label="Trang phân công" value={assignedCount} />
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
              Danh sách các phiên chỉnh lý
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
                onDelete={() => void removeSession(session)}
                deleting={deletingSessionId === session.session_id}
                canBackup={canBackup}
                backupDisabled={Boolean(backupProgress)}
                onBackup={() => void exportBackupUrls(session)}
                backupProgress={
                  backupProgress?.sessionId === session.session_id
                    ? backupProgress
                    : null
                }
                isAdmin={isAdmin}
                coordinators={coordinators}
                coordinator={coordinatorById.get(
                  session.coordinator_user_id ?? ""
                )}
                analysisStatuses={
                  analysisStatusesBySessionId[session.session_id] ??
                  fallbackAnalysisStatuses(session)
                }
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
        {sessionTotal > 0 && (
          <PaginationControls
            total={sessionTotal}
            pageIndex={displayedPageIndex}
            pageSize={sessionPageSize}
            pageCount={sessionPageCount}
            startNumber={sessionStartNumber}
            endNumber={sessionEndNumber}
            itemLabel="session"
            onPageChange={(pageIndex) =>
              setSessionPageIndex(
                Math.min(Math.max(pageIndex, 0), sessionPageCount - 1)
              )
            }
          />
        )}
      </main>
    </div>
  )
}

function safeBackupFileName(value: string): string {
  return (
    value.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[.-]+|[.-]+$/g, "") ||
    "session"
  )
}
