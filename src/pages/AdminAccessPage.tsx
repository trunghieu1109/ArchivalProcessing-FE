import { type ComponentType, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Database,
  FileText,
  Loader2,
  RefreshCw,
  ShieldCheck,
  UserCog,
  UserRound,
  Users,
} from "lucide-react"
import { toast } from "sonner"

import {
  getAdminDashboard,
  type AdminDashboardResponse,
  type AdminDashboardSession,
  type AdminDashboardStatusCount,
} from "@/features/admin/api/adminDashboardApi"
import {
  listChinhlyUsers,
  updateChinhlyUserRole,
  type ChinhlyUser,
} from "@/features/auth/api/authApi"
import { UserMenu } from "@/features/auth/components/UserMenu"
import { useAuth } from "@/features/auth/lib/AuthContext"

export function AdminAccessPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<ChinhlyUser[]>([])
  const [dashboard, setDashboard] = useState<AdminDashboardResponse | null>(
    null
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)
  const isAdmin = normalizedRole(user?.role) === "admin"

  const accountStats = useMemo(() => buildAccountStats(users), [users])

  const coordinators = useMemo(
    () => users.filter((item) => normalizedRole(item.role) === "coordinator"),
    [users]
  )

  const load = async () => {
    if (!isAdmin) return
    setLoading(true)
    setError("")
    try {
      const [userResponse, dashboardResponse] = await Promise.all([
        listChinhlyUsers({ active: true, limit: 500 }),
        getAdminDashboard({ limit: 180 }),
      ])
      setUsers(userResponse)
      setDashboard(dashboardResponse)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Không thể tải dữ liệu dashboard quản trị."
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [isAdmin])

  const promoteToCoordinator = async (target: ChinhlyUser) => {
    const targetId = userId(target)
    if (!targetId) {
      toast.error("User này chưa có id hợp lệ.")
      return
    }
    setUpdatingUserId(targetId)
    try {
      const updated = await updateChinhlyUserRole(targetId, {
        role: "coordinator",
        is_active: true,
      })
      setUsers((current) =>
        current.map((item) =>
          userId(item) === targetId ? { ...item, ...updated } : item
        )
      )
      toast.success("Đã phân quyền coordinator.")
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Không thể phân quyền coordinator."
      )
    } finally {
      setUpdatingUserId(null)
    }
  }

  if (!isAdmin) {
    return (
      <div className="min-h-svh bg-[#EEF3F8] text-[#0F172A]">
        <AdminHeader />
        <main className="mx-auto max-w-[960px] px-4 py-10 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
            <p className="text-lg font-bold">
              Chỉ admin mới truy cập được màn hình này.
            </p>
            <p className="mt-2 text-sm">
              Hãy đăng nhập bằng tài khoản admin để phân quyền coordinator.
            </p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-[#EEF3F8] text-[#0F172A]">
      <AdminHeader />
      <main className="mx-auto flex max-w-[1560px] flex-col gap-6 px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.16em] text-[#64748B] uppercase">
              Dashboard quản trị
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#0F172A]">
              Theo dõi trạng thái chính của hệ thống
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#64748B]">
              Tổng hợp session, tài liệu upload, job xử lý và account đang hoạt
              động để admin nắm nhanh sức khỏe vận hành.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end">
            <button
              type="button"
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
            <Link
              to="/sessions"
              className="flex items-center justify-center gap-2 rounded-xl bg-[#0052FF] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(0,82,255,0.22)] transition-all hover:-translate-y-0.5 hover:bg-[#0047D6] active:scale-[0.98]"
            >
              <ArrowLeft className="size-4" />
              Session
            </Link>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {loading && !dashboard ? (
          <DashboardSkeleton />
        ) : dashboard ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                icon={Database}
                label="Tổng session"
                value={dashboard.summary.session_count}
                hint={`${formatNumber(dashboard.summary.assigned_session_count)} đã phân công`}
              />
              <StatCard
                icon={FileText}
                label="Tài liệu upload"
                value={dashboard.summary.uploaded_document_count}
                hint={`${formatNumber(dashboard.summary.document_count)} tài liệu đã ghi nhận`}
              />
              <StatCard
                icon={Users}
                label="Account hoạt động"
                value={accountStats.total}
                hint={`${formatNumber(accountStats.worker)} worker, ${formatNumber(accountStats.coordinator)} coordinator`}
              />
              <StatCard
                icon={Activity}
                label="Job đang chờ"
                value={dashboard.summary.queued_job_count}
                tone={
                  dashboard.summary.failed_job_count > 0 ? "warning" : "normal"
                }
                hint={
                  dashboard.summary.failed_job_count > 0
                    ? `${formatNumber(dashboard.summary.failed_job_count)} job lỗi`
                    : `${formatNumber(dashboard.summary.job_count)} job tổng`
                }
              />
            </div>

            <AccessControlPanel
              users={users}
              stats={accountStats}
              coordinators={coordinators.length}
              updatingUserId={updatingUserId}
              onPromote={promoteToCoordinator}
            />

            <section className="grid items-start gap-4 xl:grid-cols-2">
              <SessionTrendChart sessions={dashboard.sessions} />
              <SessionUploadChart sessions={dashboard.sessions} />
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <DonutStatusPanel
                title="Trạng thái session"
                eyebrow="Session"
                counts={dashboard.session_status_counts}
              />
              <RoleDonutPanel stats={accountStats} />
              <StatusPanel
                title="Trạng thái job"
                counts={dashboard.job_status_counts}
              />
            </section>

            <SessionTimelineTable sessions={dashboard.sessions} />
          </>
        ) : (
          <div className="rounded-3xl border border-[#D8E1EC] bg-white px-6 py-10 text-center text-sm text-[#64748B] shadow-sm">
            Chưa có dữ liệu dashboard.
          </div>
        )}
      </main>
    </div>
  )
}

function AdminHeader() {
  return (
    <header className="border-b border-[#D8E1EC] bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-[1560px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src="/assets/mbfs.png"
            alt="MBFS"
            className="h-12 w-auto object-contain"
          />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">
              Dashboard quản trị
            </h1>
            <p className="mt-1 text-sm text-[#64748B]">
              Theo dõi session, tài liệu, job xử lý và phân quyền account.
            </p>
          </div>
        </div>
        <UserMenu />
      </div>
    </header>
  )
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-2xl border border-[#D8E1EC] bg-white"
          />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(20rem,0.8fr)]">
        <div className="h-96 animate-pulse rounded-3xl border border-[#D8E1EC] bg-white" />
        <div className="h-96 animate-pulse rounded-3xl border border-[#D8E1EC] bg-white" />
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "normal",
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  value: number
  hint: string
  tone?: "normal" | "warning"
}) {
  const iconClass =
    tone === "warning"
      ? "bg-amber-50 text-amber-700"
      : "bg-[#EAF1FF] text-[#0052FF]"
  return (
    <div className="rounded-2xl border border-[#D8E1EC] bg-white px-4 py-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">
            {label}
          </p>
          <p className="mt-2 text-3xl font-bold text-[#0F172A]">
            {formatNumber(value)}
          </p>
        </div>
        <div className={`flex size-10 items-center justify-center rounded-xl ${iconClass}`}>
          <Icon className="size-5" />
        </div>
      </div>
      <p className="mt-3 text-sm text-[#64748B]">{hint}</p>
    </div>
  )
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#D8E1EC] bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-[#0F172A]">
        {formatNumber(value)}
      </p>
    </div>
  )
}

function AccessControlPanel({
  users,
  stats,
  coordinators,
  updatingUserId,
  onPromote,
}: {
  users: ChinhlyUser[]
  stats: AccountStats
  coordinators: number
  updatingUserId: string | null
  onPromote: (user: ChinhlyUser) => void | Promise<void>
}) {
  const sortedUsers = [...users].sort((left, right) => {
    const roleOrder = (role: unknown) => {
      const value = normalizedRole(role)
      if (value === "worker") return 0
      if (value === "coordinator") return 1
      if (value === "admin") return 2
      return 3
    }
    return roleOrder(left.role) - roleOrder(right.role)
  })

  return (
    <section className="overflow-hidden rounded-3xl border border-[#B9CDF5] bg-white shadow-sm">
      <div className="grid gap-4 border-b border-[#E6EEF9] bg-[#F7FAFF] px-4 py-4 xl:grid-cols-[minmax(0,1fr)_32rem]">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-[#0052FF] uppercase">
            Phân quyền
          </p>
          <h3 className="mt-1 text-lg font-semibold text-[#0F172A]">
            Nâng user thành coordinator
          </h3>
          <p className="mt-2 text-sm leading-6 text-[#64748B]">
            Khu phân quyền được đặt ngay sau KPI để admin thao tác nhanh, không
            phải cuộn xuống cuối dashboard.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <MiniMetric label="Tổng user" value={stats.total} />
          <MiniMetric label="Coordinator" value={coordinators} />
          <MiniMetric label="Có thể nâng quyền" value={stats.worker} />
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_9rem_11rem] gap-3 border-b border-[#EEF2F7] px-4 py-3 text-[11px] font-semibold tracking-[0.12em] text-[#64748B] uppercase max-md:hidden">
        <span>User</span>
        <span>Role</span>
        <span className="text-right">Thao tác</span>
      </div>
      {sortedUsers.length > 0 ? (
        <div className="max-h-64 divide-y divide-[#EEF2F7] overflow-y-auto">
          {sortedUsers.map((item) => {
            const id = userId(item)
            const role = normalizedRole(item.role)
            const updating = updatingUserId === id
            const canPromote = role === "worker"
            return (
              <div
                key={id || displayUser(item)}
                className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_9rem_11rem] md:items-center"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF1FF] text-[#0052FF]">
                    <UserRound className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#0F172A]">
                      {displayUser(item)}
                    </p>
                    <p className="truncate text-xs text-[#64748B]">
                      {item.email || item.username || id || "Chưa có email"}
                    </p>
                  </div>
                </div>
                <span className="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {displayRole(role)}
                </span>
                <div className="flex justify-start md:justify-end">
                  <button
                    type="button"
                    disabled={!canPromote || updating}
                    onClick={() => void onPromote(item)}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-[#CBD5E1] px-3 py-1.5 text-xs font-semibold text-[#475569] transition-colors hover:border-[#0052FF]/40 hover:text-[#0052FF] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {updating ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <UserCog className="size-3.5" />
                    )}
                    {role === "coordinator"
                      ? "Đã là coordinator"
                      : "Nâng quyền"}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <EmptyPanel text="Chưa có user nào." compact />
      )}
    </section>
  )
}

function SessionTrendChart({
  sessions,
}: {
  sessions: AdminDashboardSession[]
}) {
  const trend = buildDailySessionTrend(sessions)
  const maxDocuments = Math.max(0, ...trend.map((item) => item.documents))
  const points = buildTrendPoints(trend, maxDocuments)

  return (
    <div className="rounded-3xl border border-[#D8E1EC] bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[#EEF2F7] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">
            Trend theo ngày
          </p>
          <h3 className="mt-1 text-lg font-semibold text-[#0F172A]">
            Lượng tài liệu upload qua thời gian
          </h3>
        </div>
        <div className="flex w-fit items-center gap-2 rounded-full bg-[#EAF1FF] px-3 py-1.5 text-xs font-semibold text-[#0052FF]">
          <Activity className="size-4" />
          {formatNumber(maxDocuments)} cao nhất/ngày
        </div>
      </div>

      {trend.length > 0 ? (
        <div className="mt-4">
          <svg
            viewBox="0 0 420 190"
            role="img"
            aria-label="Biểu đồ trend tài liệu upload theo ngày"
            className="h-48 w-full overflow-visible"
          >
            <line x1="28" y1="150" x2="392" y2="150" stroke="#CBD5E1" />
            <line x1="28" y1="28" x2="28" y2="150" stroke="#CBD5E1" />
            {points.map((point) => (
              <g key={point.key}>
                <rect
                  x={point.x - point.barWidth / 2}
                  y={point.barY}
                  width={point.barWidth}
                  height={point.barHeight}
                  rx="6"
                  fill="#BFDBFE"
                />
                <circle cx={point.x} cy={point.y} r="4.5" fill="#0052FF" />
                <text
                  x={point.x}
                  y="178"
                  textAnchor="middle"
                  className="fill-[#64748B] text-[10px]"
                >
                  {point.shortLabel}
                </text>
              </g>
            ))}
            {points.length > 1 && (
              <polyline
                fill="none"
                stroke="#0052FF"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
                points={points.map((point) => `${point.x},${point.y}`).join(" ")}
              />
            )}
          </svg>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <MiniMetric label="Ngày có dữ liệu" value={trend.length} />
            <MiniMetric
              label="Tổng session"
              value={trend.reduce((sum, item) => sum + item.sessionCount, 0)}
            />
            <MiniMetric
              label="Tổng tài liệu"
              value={trend.reduce((sum, item) => sum + item.documents, 0)}
            />
          </div>
        </div>
      ) : (
        <EmptyPanel text="Chưa có dữ liệu theo ngày để vẽ trend." />
      )}
    </div>
  )
}

function SessionUploadChart({
  sessions,
}: {
  sessions: AdminDashboardSession[]
}) {
  const maxValue = Math.max(
    0,
    ...sessions.map((session) => session.uploaded_document_count)
  )
  return (
    <div className="rounded-3xl border border-[#D8E1EC] bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[#EEF2F7] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">
            Tài liệu theo session
          </p>
          <h3 className="mt-1 text-lg font-semibold text-[#0F172A]">
            Session sắp xếp theo thời gian tạo
          </h3>
        </div>
        <div className="flex w-fit items-center gap-2 rounded-full bg-[#EAF1FF] px-3 py-1.5 text-xs font-semibold text-[#0052FF]">
          <BarChart3 className="size-4" />
          {formatNumber(sessions.length)} session
        </div>
      </div>

      {sessions.length > 0 ? (
        <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
          {sessions.map((session) => {
            const value = session.uploaded_document_count
            const width =
              maxValue > 0 && value > 0
                ? Math.max(4, Math.round((value / maxValue) * 100))
                : 0
            return (
              <div
                key={session.session_id}
                className="grid gap-2 sm:grid-cols-[minmax(12rem,18rem)_minmax(0,1fr)_4rem] sm:items-center sm:gap-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#0F172A]">
                    {sessionName(session)}
                  </p>
                  <p className="mt-0.5 text-xs text-[#64748B]">
                    {formatDate(session.created_at)}
                  </p>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[#E2E8F0]">
                  <div
                    className="h-full rounded-full bg-[#0052FF]"
                    style={{ width: `${width}%` }}
                  />
                </div>
                <p className="text-right text-sm font-bold text-[#0F172A]">
                  {formatNumber(value)}
                </p>
              </div>
            )
          })}
        </div>
      ) : (
        <EmptyPanel text="Chưa có session nào để hiển thị biểu đồ." />
      )}
    </div>
  )
}

function StatusPanel({
  title,
  counts,
}: {
  title: string
  counts: AdminDashboardStatusCount[]
}) {
  const total = counts.reduce((sum, item) => sum + item.count, 0)
  return (
    <div className="rounded-3xl border border-[#D8E1EC] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">
            Breakdown
          </p>
          <h3 className="mt-1 text-base font-semibold text-[#0F172A]">
            {title}
          </h3>
        </div>
        <ShieldCheck className="size-5 text-[#0052FF]" />
      </div>
      {counts.length > 0 ? (
        <div className="mt-4 space-y-3">
          {counts.map((item) => {
            const width =
              total > 0 ? Math.max(4, Math.round((item.count / total) * 100)) : 0
            return (
              <div key={item.status}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-[#334155]">
                    {displayStatus(item.status)}
                  </span>
                  <span className="font-bold text-[#0F172A]">
                    {formatNumber(item.count)}
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#E2E8F0]">
                  <div
                    className="h-full rounded-full bg-[#0F172A]"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <EmptyPanel text="Chưa có dữ liệu trạng thái." compact />
      )}
    </div>
  )
}

function DonutStatusPanel({
  title,
  eyebrow,
  counts,
}: {
  title: string
  eyebrow: string
  counts: AdminDashboardStatusCount[]
}) {
  const slices = counts.map((item, index) => ({
    label: displayStatus(item.status),
    value: item.count,
    color: DONUT_COLORS[index % DONUT_COLORS.length],
  }))
  return (
    <div className="rounded-3xl border border-[#D8E1EC] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">
            {eyebrow}
          </p>
          <h3 className="mt-1 text-base font-semibold text-[#0F172A]">
            {title}
          </h3>
        </div>
        <ShieldCheck className="size-5 text-[#0052FF]" />
      </div>
      <DonutChart slices={slices} />
    </div>
  )
}

function RoleDonutPanel({ stats }: { stats: AccountStats }) {
  const slices = [
    { label: "Admin", value: stats.admin, color: "#0F172A" },
    { label: "Coordinator", value: stats.coordinator, color: "#0052FF" },
    { label: "Worker", value: stats.worker, color: "#38BDF8" },
  ]
  return (
    <div className="rounded-3xl border border-[#D8E1EC] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">
            Account
          </p>
          <h3 className="mt-1 text-base font-semibold text-[#0F172A]">
            Phân bổ vai trò
          </h3>
        </div>
        <Users className="size-5 text-[#0052FF]" />
      </div>
      <DonutChart slices={slices} />
    </div>
  )
}

function DonutChart({ slices }: { slices: DonutSlice[] }) {
  const total = slices.reduce((sum, item) => sum + item.value, 0)
  const visibleSlices = slices.filter((item) => item.value > 0)
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center lg:grid-cols-1 2xl:grid-cols-[8rem_minmax(0,1fr)]">
      <div
        className="relative mx-auto flex size-32 items-center justify-center rounded-full"
        style={{
          background:
            total > 0 ? donutGradient(visibleSlices, total) : "#E2E8F0",
        }}
      >
        <div className="flex size-20 flex-col items-center justify-center rounded-full bg-white shadow-inner">
          <span className="text-xl font-bold text-[#0F172A]">
            {formatNumber(total)}
          </span>
          <span className="text-[10px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">
            Tổng
          </span>
        </div>
      </div>
      {visibleSlices.length > 0 ? (
        <div className="space-y-2">
          {visibleSlices.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2 font-medium text-[#334155]">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate">{item.label}</span>
              </span>
              <span className="font-bold text-[#0F172A]">
                {formatNumber(item.value)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyPanel text="Chưa có dữ liệu." compact />
      )}
    </div>
  )
}

function SessionTimelineTable({
  sessions,
}: {
  sessions: AdminDashboardSession[]
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-[#D8E1EC] bg-white shadow-sm">
      <div className="grid grid-cols-[minmax(0,1fr)_8rem_8rem_8rem_9rem] gap-3 border-b border-[#EEF2F7] bg-[#F8FAFC] px-4 py-3 text-[11px] font-semibold tracking-[0.12em] text-[#64748B] uppercase max-lg:hidden">
        <span>Session</span>
        <span>Tài liệu</span>
        <span>File upload</span>
        <span>Job lỗi/chờ</span>
        <span>Tạo lúc</span>
      </div>
      {sessions.length > 0 ? (
        <div className="max-h-[28rem] divide-y divide-[#EEF2F7] overflow-y-auto">
          {sessions.map((session) => (
            <div
              key={session.session_id}
              className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_8rem_8rem_8rem_9rem] lg:items-center"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#0F172A]">
                  {sessionName(session)}
                </p>
                <p className="mt-0.5 truncate text-xs text-[#64748B]">
                  {session.session_id} · {displayStatus(session.status)}
                </p>
              </div>
              <TimelineMetric
                label="Tài liệu"
                value={session.uploaded_document_count}
              />
              <TimelineMetric
                label="File upload"
                value={session.uploaded_file_count}
              />
              <TimelineMetric
                label="Job lỗi/chờ"
                value={`${formatNumber(session.failed_job_count)}/${formatNumber(session.queued_job_count)}`}
                warning={session.failed_job_count > 0}
              />
              <p className="text-sm text-[#64748B]">
                {formatDateTime(session.created_at)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <EmptyPanel text="Chưa có session nào trong hệ thống." />
      )}
    </section>
  )
}

function TimelineMetric({
  label,
  value,
  warning = false,
}: {
  label: string
  value: number | string
  warning?: boolean
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase lg:hidden">
        {label}
      </p>
      <p
        className={`text-sm font-bold ${
          warning ? "text-amber-700" : "text-[#0F172A]"
        }`}
      >
        {typeof value === "number" ? formatNumber(value) : value}
      </p>
    </div>
  )
}

function EmptyPanel({
  text,
  compact = false,
}: {
  text: string
  compact?: boolean
}) {
  return (
    <div
      className={`flex items-center justify-center rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 text-center text-sm text-[#64748B] ${
        compact ? "min-h-20 py-4" : "min-h-40 py-8"
      }`}
    >
      {text}
    </div>
  )
}

interface AccountStats {
  total: number
  admin: number
  coordinator: number
  worker: number
}

interface DailySessionTrend {
  key: string
  label: string
  shortLabel: string
  sessionCount: number
  documents: number
}

interface TrendPoint {
  key: string
  x: number
  y: number
  barY: number
  barHeight: number
  barWidth: number
  shortLabel: string
}

interface DonutSlice {
  label: string
  value: number
  color: string
}

const DONUT_COLORS = [
  "#0052FF",
  "#0F172A",
  "#38BDF8",
  "#F59E0B",
  "#10B981",
  "#8B5CF6",
]

function buildAccountStats(users: ChinhlyUser[]): AccountStats {
  return users.reduce<AccountStats>(
    (stats, item) => {
      stats.total += 1
      const role = normalizedRole(item.role)
      if (role === "admin") stats.admin += 1
      else if (role === "coordinator") stats.coordinator += 1
      else if (role === "worker") stats.worker += 1
      return stats
    },
    { total: 0, admin: 0, coordinator: 0, worker: 0 }
  )
}

function buildDailySessionTrend(
  sessions: AdminDashboardSession[]
): DailySessionTrend[] {
  const map = new Map<string, DailySessionTrend>()
  for (const session of sessions) {
    const key = dateKey(session.created_at)
    const current =
      map.get(key) ??
      {
        key,
        label: formatDate(`${key}T00:00:00`),
        shortLabel: formatShortDate(`${key}T00:00:00`),
        sessionCount: 0,
        documents: 0,
      }
    current.sessionCount += 1
    current.documents += session.uploaded_document_count
    map.set(key, current)
  }
  return [...map.values()].sort((left, right) =>
    left.key.localeCompare(right.key)
  )
}

function buildTrendPoints(
  trend: DailySessionTrend[],
  maxDocuments: number
): TrendPoint[] {
  const chartLeft = 36
  const chartRight = 392
  const chartTop = 28
  const chartBottom = 150
  const width = chartRight - chartLeft
  const height = chartBottom - chartTop
  const step = trend.length > 1 ? width / (trend.length - 1) : 0
  const barSlot = trend.length > 0 ? width / trend.length : width
  const barWidth = Math.max(10, Math.min(34, barSlot * 0.46))

  return trend.map((item, index) => {
    const x = trend.length > 1 ? chartLeft + index * step : chartLeft + width / 2
    const ratio = maxDocuments > 0 ? item.documents / maxDocuments : 0
    const barHeight = Math.max(item.documents > 0 ? 8 : 0, ratio * height)
    const y = chartBottom - ratio * height
    return {
      key: item.key,
      x,
      y,
      barY: chartBottom - barHeight,
      barHeight,
      barWidth,
      shortLabel: item.shortLabel,
    }
  })
}

function donutGradient(slices: DonutSlice[], total: number): string {
  if (!slices.length || total <= 0) return "#E2E8F0"
  let cursor = 0
  const stops = slices.map((slice) => {
    const start = cursor
    const end = cursor + (slice.value / total) * 100
    cursor = end
    return `${slice.color} ${start}% ${end}%`
  })
  return `conic-gradient(${stops.join(", ")})`
}

function userId(user: ChinhlyUser): string {
  return String(user.id ?? user.user_id ?? "").trim()
}

function displayUser(user: ChinhlyUser): string {
  return String(
    user.display_name ||
      user.name ||
      user.email ||
      user.username ||
      userId(user) ||
      "User"
  ).trim()
}

function normalizedRole(role: unknown): string {
  return String(role || "")
    .trim()
    .toLowerCase()
}

function displayRole(role: unknown): string {
  const value = normalizedRole(role)
  if (value === "admin") return "Admin"
  if (value === "coordinator") return "Coordinator"
  if (value === "worker") return "Worker"
  return value || "Không rõ"
}

function sessionName(session: AdminDashboardSession): string {
  return String(
    session.fonds_name ||
      session.archive_name ||
      session.fonds_creator_code ||
      session.session_id
  ).trim()
}

function displayStatus(status: unknown): string {
  const value = normalizedRole(status)
  if (value === "created") return "Mới tạo"
  if (value === "queued") return "Đang chờ"
  if (value === "running") return "Đang chạy"
  if (value === "processing") return "Đang xử lý"
  if (value === "completed" || value === "done") return "Hoàn tất"
  if (value === "completed_with_errors") return "Hoàn tất có lỗi"
  if (value === "failed") return "Lỗi"
  if (value === "cancelled") return "Đã hủy"
  if (value === "unknown") return "Không rõ"
  return value || "Không rõ"
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value)
}

function formatDate(value: string | null | undefined): string {
  return formatDateValue(value, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatDateTime(value: string | null | undefined): string {
  return formatDateValue(value, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatDateValue(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions
): string {
  if (!value) return "Chưa rõ"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("vi-VN", options).format(date)
}

function formatShortDate(value: string | null | undefined): string {
  return formatDateValue(value, {
    day: "2-digit",
    month: "2-digit",
  })
}

function dateKey(value: string | null | undefined): string {
  if (!value) return "unknown"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10) || "unknown"
  return date.toISOString().slice(0, 10)
}
