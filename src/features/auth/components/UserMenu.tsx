import { LogOut, ShieldCheck, UserCog, UserPlus, UserRound } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/features/auth/lib/AuthContext"

export function UserMenu({ className = "" }: { className?: string }) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const displayName = displayUserName(user)
  const role = displayRole(user?.role)
  const isAdmin = String(user?.role || "").trim().toLowerCase() === "admin"

  const handleLogout = () => {
    logout()
    toast.success("Đã đăng xuất.")
    navigate("/login", { replace: true })
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-xl border border-[#D8E1EC] bg-white px-2.5 py-2 shadow-sm ${className}`}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#EAF1FF] text-[#0052FF]">
        <UserRound className="size-4" />
      </div>
      <div className="hidden min-w-0 sm:block">
        <p className="max-w-[14rem] truncate text-sm font-semibold leading-5 text-[#0F172A]">
          {displayName}
        </p>
        <p className="flex items-center gap-1 text-[11px] font-medium text-[#64748B]">
          <ShieldCheck className="size-3" />
          {role}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={() => navigate("/register")}
        title="Tạo tài khoản"
        aria-label="Tạo tài khoản"
        className="ml-1 rounded-lg"
      >
        <UserPlus className="size-4" />
      </Button>
      {isAdmin && (
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => navigate("/admin/access")}
          title="Phân quyền coordinator"
          aria-label="Phân quyền coordinator"
          className="ml-1 rounded-lg"
        >
          <UserCog className="size-4" />
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={handleLogout}
        title="Đăng xuất"
        aria-label="Đăng xuất"
        className="ml-1 rounded-lg"
      >
        <LogOut className="size-4" />
      </Button>
    </div>
  )
}

function displayUserName(user: ReturnType<typeof useAuth>["user"]): string {
  const value =
    user?.display_name || user?.name || user?.email || user?.username || ""
  return String(value || "Người dùng").trim()
}

function displayRole(role: unknown): string {
  const value = String(role || "").trim().toLowerCase()
  if (value === "admin") return "Quản trị viên"
  if (value === "coordinator") return "Điều phối viên"
  if (value === "worker") return "Nhân viên"
  return value || "Đã xác thực"
}
