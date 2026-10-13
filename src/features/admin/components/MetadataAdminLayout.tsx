import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { Tabs } from "radix-ui"
import {
  AlertTriangle,
  ArrowLeft,
  Database,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { UserMenu } from "@/features/auth/components/UserMenu"
import { metadataButtonClass, metadataPrimaryButtonClass } from "./metadataUi"

export type MetadataTab = "sets" | "fields"

export function MetadataAdminLayout({
  isAdmin,
  tab,
  onTabChange,
  loading,
  busy,
  loaded,
  error,
  setCount,
  fieldCount,
  onReload,
  onCreate,
  children,
}: {
  isAdmin: boolean
  tab: MetadataTab
  onTabChange: (tab: MetadataTab) => void
  loading: boolean
  busy: boolean
  loaded: boolean
  error: string
  setCount: number
  fieldCount: number
  onReload: () => void
  onCreate: () => void
  children: ReactNode
}) {
  return (
    <div className="min-h-svh bg-[#EEF3F8] text-[#0F172A]">
      <header className="border-b border-[#D8E1EC] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:flex-nowrap sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/assets/mbfs.png"
              alt="MBFS"
              className="h-11 w-auto shrink-0"
            />
            <div>
              <h1 className="text-lg font-bold sm:text-xl">Quản lý metadata</h1>
              <p className="mt-0.5 hidden text-sm text-[#64748B] sm:block">
                Thư viện cấu hình trích xuất tài liệu
              </p>
            </div>
          </div>
          <div className="flex w-full justify-end sm:w-auto">
            <UserMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto flex max-w-[1500px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.14em] text-[#64748B] uppercase">
              Quản trị dữ liệu
            </p>
            <h2 className="mt-1 text-2xl font-bold sm:text-3xl">
              Bộ metadata và trường trích xuất
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#64748B]">
              Tổ chức các trường thành bộ metadata để sử dụng khi thiết lập
              session.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className={metadataButtonClass}>
              <Link to="/admin/access">
                <ArrowLeft className="size-4" />
                Quản trị
              </Link>
            </Button>
            {isAdmin && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className={metadataButtonClass}
                  disabled={loading || busy}
                  onClick={onReload}
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  Làm mới
                </Button>
                <Button
                  type="button"
                  className={metadataPrimaryButtonClass}
                  disabled={loading || busy || !loaded || Boolean(error)}
                  onClick={onCreate}
                >
                  <Plus className="size-4" />
                  {tab === "sets" ? "Tạo bộ metadata" : "Thêm trường metadata"}
                </Button>
              </>
            )}
          </div>
        </div>
        {!isAdmin ? (
          <div
            role="alert"
            className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-800"
          >
            <p className="font-semibold">
              Chỉ admin được quản lý thư viện metadata.
            </p>
            <p className="mt-2 text-sm">
              Hãy đăng nhập bằng tài khoản admin để sử dụng màn hình này.
            </p>
          </div>
        ) : (
          <Tabs.Root
            value={tab}
            onValueChange={(value) => onTabChange(value as MetadataTab)}
            className="space-y-5"
          >
            <Tabs.List
              aria-label="Quản lý metadata"
              className="grid grid-cols-1 gap-2 rounded-3xl border border-[#D8E1EC] bg-white p-2 shadow-sm sm:grid-cols-2"
            >
              {(
                [
                  {
                    value: "sets",
                    label: "Bộ metadata",
                    description: "Nhóm các trường theo loại tài liệu",
                    icon: Layers,
                    count: setCount,
                  },
                  {
                    value: "fields",
                    label: "Kho trường metadata",
                    description: "Trường hệ thống và trường tùy chỉnh",
                    icon: Database,
                    count: fieldCount,
                  },
                ] as const
              ).map(({ value, label, description, icon: Icon, count }) => (
                <Tabs.Trigger key={value} value={value} disabled={busy} asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className={`h-auto min-h-18 w-full justify-start gap-3 rounded-2xl px-4 py-3 text-left whitespace-normal ${tab === value ? "bg-[#0052FF] text-white hover:bg-[#0052FF] hover:text-white" : "text-[#475569] hover:bg-[#F8FAFC]"}`}
                  >
                    <span
                      className={`rounded-xl p-2 ${tab === value ? "bg-white/15" : "bg-[#EAF1FF] text-[#0052FF]"}`}
                    >
                      <Icon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">
                        {label}
                      </span>
                      <span
                        className={`mt-1 block text-xs font-normal ${tab === value ? "text-blue-100" : "text-[#64748B]"}`}
                      >
                        {description}
                      </span>
                    </span>
                    <span
                      aria-label={`${count} ${value === "sets" ? "bộ" : "trường"}`}
                      className={`rounded-lg px-2.5 py-1 text-sm font-semibold ${tab === value ? "bg-white/15" : "bg-[#F1F5F9] text-[#64748B]"}`}
                    >
                      {loaded ? count : "—"}
                    </span>
                  </Button>
                </Tabs.Trigger>
              ))}
            </Tabs.List>
            {error && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800"
              >
                <AlertTriangle className="mt-0.5 size-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold">
                    {loaded
                      ? "Chưa thể làm mới thư viện metadata"
                      : "Không thể tải thư viện metadata"}
                  </h3>
                  <p className="mt-1 text-sm leading-6">
                    {loaded
                      ? "Dữ liệu đang hiển thị là lần tải gần nhất. Hãy tải lại trước khi chỉnh sửa."
                      : "Vui lòng thử tải lại. Các bộ và trường metadata sẽ hiển thị khi dịch vụ sẵn sàng."}
                  </p>
                  <details className="mt-2 text-xs leading-5">
                    <summary className="cursor-pointer font-medium">
                      Chi tiết lỗi
                    </summary>
                    <p className="mt-2 break-words">{error}</p>
                  </details>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy || loading}
                    className={`${metadataButtonClass} mt-3`}
                    onClick={onReload}
                  >
                    <RefreshCw className="size-4" />
                    Tải lại thư viện
                  </Button>
                </div>
              </div>
            )}
            {loading && !loaded ? (
              <LibrarySkeleton />
            ) : loaded ? (
              <Tabs.Content value={tab} className="outline-none">
                {children}
              </Tabs.Content>
            ) : null}
          </Tabs.Root>
        )}
      </main>
    </div>
  )
}

function LibrarySkeleton() {
  return (
    <div
      role="status"
      className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]"
    >
      <span className="sr-only">Đang tải thư viện metadata…</span>
      <div className="space-y-4 rounded-3xl border border-[#D8E1EC] bg-white p-5">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-2xl bg-[#F1F5F9]"
          />
        ))}
      </div>
      <div className="space-y-4 rounded-3xl border border-[#D8E1EC] bg-white p-6">
        <div className="h-10 w-1/2 animate-pulse rounded-xl bg-[#F1F5F9]" />
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-[#F1F5F9]" />
        ))}
      </div>
    </div>
  )
}
