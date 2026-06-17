import { useMemo, useState, type FormEvent } from "react"
import { Navigate, useLocation, useNavigate } from "react-router-dom"
import { Eye, EyeOff, Loader2, UserPlus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { registerChinhlyUser } from "@/features/auth/api/authApi"
import { useAuth } from "@/features/auth/lib/AuthContext"

interface RedirectState {
  from?: {
    pathname?: string
    search?: string
  }
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, login } = useAuth()
  const [mode, setMode] = useState<"login" | "register">(() =>
    location.pathname === "/register" ? "register" : "login"
  )
  const [email, setEmail] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const redirectTo = useMemo(() => {
    const state = location.state as RedirectState | null
    const from = state?.from
    if (!from?.pathname || from.pathname === "/login") return "/sessions"
    return `${from.pathname}${from.search ?? ""}`
  }, [location.state])

  if (isAuthenticated && mode !== "register") {
    return <Navigate to={redirectTo} replace />
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) {
      setError("Vui lòng nhập email và mật khẩu.")
      return
    }
    setSubmitting(true)
    setError("")
    try {
      await login({ username: trimmedEmail, password })
      toast.success("Đã đăng nhập.")
      navigate(redirectTo, { replace: true })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Không thể đăng nhập."
      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const submitRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedEmail = email.trim()
    const trimmedDisplayName = displayName.trim()
    if (!trimmedDisplayName || !trimmedEmail || !password) {
      setError("Vui lòng nhập họ tên, email và mật khẩu.")
      return
    }
    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.")
      return
    }
    setSubmitting(true)
    setError("")
    try {
      await registerChinhlyUser({
        email: trimmedEmail,
        password,
        display_name: trimmedDisplayName,
        role: "worker",
      })
      toast.success(
        isAuthenticated
          ? "Đã tạo tài khoản."
          : "Đã tạo tài khoản. Bạn có thể đăng nhập."
      )
      if (isAuthenticated) {
        setDisplayName("")
        setEmail("")
        setPassword("")
      } else {
        setMode("login")
        navigate("/login", { replace: true })
      }
      setConfirmPassword("")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Không thể tạo tài khoản."
      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-[#E9EEF4] px-4 py-8 text-[#0F172A]">
      <section className="flex w-full max-w-[25rem] flex-col items-center gap-6">
        <img
          src="/assets/mbfs.png"
          alt="MobiFone Solutions"
          className="h-14 w-auto object-contain"
        />

        <form
          className="w-full rounded-lg border border-[#D4DEE9] bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.12)]"
          onSubmit={mode === "login" ? submit : submitRegister}
        >
          <div className="grid grid-cols-2 rounded-md border border-[#D8E1EC] bg-[#F8FAFC] p-1">
            <button
              type="button"
              onClick={() => {
                setMode("login")
                setError("")
                navigate("/login", { replace: true })
              }}
              className={`rounded-[0.35rem] px-3 py-2 text-sm font-semibold transition-colors ${
                mode === "login"
                  ? "bg-white text-[#0052FF] shadow-sm"
                  : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register")
                setError("")
                navigate("/register", { replace: true })
              }}
              className={`rounded-[0.35rem] px-3 py-2 text-sm font-semibold transition-colors ${
                mode === "register"
                  ? "bg-white text-[#0052FF] shadow-sm"
                  : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              Đăng ký
            </button>
          </div>

          <h1 className="mt-5 font-sans text-2xl font-semibold tracking-normal text-[#0F172A]">
            {mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
          </h1>
          <p className="mt-1 text-sm text-[#64748B]">
            {mode === "login"
              ? "Đăng nhập bằng tài khoản Chỉnh Lý."
              : "Tài khoản mới sẽ được tạo với vai trò nhân viên."}
          </p>

          <div className="mt-6 flex flex-col gap-4">
            {mode === "register" && (
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-[#334155]">
                  Họ tên
                </span>
                <Input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  autoComplete="name"
                  className="h-11 rounded-md border-[#CBD5E1] bg-white px-3"
                  placeholder="Nguyễn Văn A"
                  disabled={submitting}
                />
              </label>
            )}

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-[#334155]">Email</span>
              <Input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                type="email"
                className="h-11 rounded-md border-[#CBD5E1] bg-white px-3"
                placeholder="name@example.com"
                disabled={submitting}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-[#334155]">
                Mật khẩu
              </span>
              <div className="relative">
                <Input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  type={showPassword ? "text" : "password"}
                  className="h-11 rounded-md border-[#CBD5E1] bg-white px-3 pr-10"
                  placeholder="Nhập mật khẩu"
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  disabled={submitting}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </label>

            {mode === "register" && (
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-[#334155]">
                  Xác nhận mật khẩu
                </span>
                <Input
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  type="password"
                  className="h-11 rounded-md border-[#CBD5E1] bg-white px-3"
                  placeholder="Nhập lại mật khẩu"
                  disabled={submitting}
                />
              </label>
            )}

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="mt-2 h-11 rounded-md bg-[#0052FF] text-sm font-semibold hover:bg-[#0047D6]"
            >
              {submitting ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : mode === "register" ? (
                <UserPlus data-icon="inline-start" />
              ) : null}
              {mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
            </Button>
          </div>
        </form>
      </section>
    </main>
  )
}
