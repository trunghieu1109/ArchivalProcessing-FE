import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  UserCog,
  UserRound,
} from "lucide-react"
import { toast } from "sonner"

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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)
  const isAdmin = normalizedRole(user?.role) === "admin"

  const coordinators = useMemo(
    () => users.filter((item) => normalizedRole(item.role) === "coordinator"),
    [users]
  )

  const load = async () => {
    if (!isAdmin) return
    setLoading(true)
    setError("")
    try {
      const response = await listChinhlyUsers({ active: true, limit: 500 })
      setUsers(response)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Không thể tải danh sách user."
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
      <main className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.16em] text-[#64748B] uppercase">
              Quản trị phân quyền
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#0F172A]">
              Chọn user để nâng thành coordinator
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#64748B]">
              Sau khi user đã là coordinator, quay về danh sách session và dùng
              nút “Phân công” trên từng session để giao session cho người đó.
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

        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard label="Tổng user" value={users.length} />
          <SummaryCard label="Coordinator" value={coordinators.length} />
          <SummaryCard
            label="Có thể nâng quyền"
            value={
              users.filter((item) => normalizedRole(item.role) === "worker")
                .length
            }
          />
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <section className="overflow-hidden rounded-3xl border border-[#D8E1EC] bg-white shadow-sm">
          <div className="grid grid-cols-[minmax(0,1fr)_9rem_11rem] gap-3 border-b border-[#EEF2F7] bg-[#F8FAFC] px-4 py-3 text-[11px] font-semibold tracking-[0.12em] text-[#64748B] uppercase">
            <span>User</span>
            <span>Role</span>
            <span className="text-right">Thao tác</span>
          </div>
          {loading ? (
            <div className="flex min-h-40 items-center justify-center text-sm text-[#64748B]">
              <Loader2 className="mr-2 size-4 animate-spin text-[#0052FF]" />
              Đang tải user...
            </div>
          ) : users.length > 0 ? (
            <div className="divide-y divide-[#EEF2F7]">
              {users.map((item) => {
                const id = userId(item)
                const role = normalizedRole(item.role)
                const updating = updatingUserId === id
                const canPromote = role === "worker"
                return (
                  <div
                    key={id || displayUser(item)}
                    className="grid grid-cols-[minmax(0,1fr)_9rem_11rem] items-center gap-3 px-4 py-3"
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
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={!canPromote || updating}
                        onClick={() => void promoteToCoordinator(item)}
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
            <div className="flex min-h-40 items-center justify-center text-sm text-[#64748B]">
              Chưa có user nào.
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function AdminHeader() {
  return (
    <header className="border-b border-[#D8E1EC] bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src="/assets/mbfs.png"
            alt="MBFS"
            className="h-12 w-auto object-contain"
          />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">
              Phân quyền coordinator
            </h1>
            <p className="mt-1 text-sm text-[#64748B]">
              Tách bước nâng quyền user khỏi bước giao session.
            </p>
          </div>
        </div>
        <UserMenu />
      </div>
    </header>
  )
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#D8E1EC] bg-white px-4 py-3 shadow-sm">
      <p className="text-[11px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-[#0F172A]">{value}</p>
    </div>
  )
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
