import { useState } from "react"
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  Network,
  ShieldAlert,
  Unplug,
} from "lucide-react"

import type { AuditConnectionConfig, AuditRequestResult } from "../backendAudit"

export function ConnectionPanel({
  config,
  onChange,
  onConnect,
  connecting,
  probe,
}: {
  config: AuditConnectionConfig
  onChange: (config: AuditConnectionConfig) => void
  onConnect: () => void
  connecting: boolean
  probe: AuditRequestResult | null
}) {
  const [showCredential, setShowCredential] = useState(false)
  const inputClass =
    "h-11 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10"

  return (
    <div className="audit-system-visual relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.055] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-6">
      <div className="pointer-events-none absolute -top-20 -right-20 size-52 rounded-full bg-cyan-300/10 blur-3xl" />
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-cyan-300 uppercase">
              Kết nối mục tiêu
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              Backend cần kiểm tra
            </h2>
          </div>
          <ConnectionIndicator connecting={connecting} probe={probe} />
        </div>

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-medium text-slate-300">
              Base URL API
            </span>
            <div className="relative">
              <Network className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
              <input
                value={config.baseUrl}
                onChange={(event) =>
                  onChange({ ...config, baseUrl: event.target.value })
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") onConnect()
                }}
                placeholder="https://be.example.vn"
                className={`${inputClass} pl-10 font-mono text-xs`}
                spellCheck={false}
                autoCapitalize="none"
              />
            </div>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-slate-300">
                Xác thực
              </span>
              <select
                value={config.authMode}
                onChange={(event) =>
                  onChange({
                    ...config,
                    authMode: event.target
                      .value as AuditConnectionConfig["authMode"],
                  })
                }
                className={inputClass}
              >
                <option value="none" className="bg-slate-900">
                  Không xác thực
                </option>
                <option value="bearer" className="bg-slate-900">
                  Bearer token
                </option>
                <option value="api-key" className="bg-slate-900">
                  API key
                </option>
              </select>
            </label>

            {config.authMode === "api-key" && (
              <label className="block">
                <span className="mb-2 block text-xs font-medium text-slate-300">
                  Header API key
                </span>
                <input
                  value={config.apiKeyHeader}
                  onChange={(event) =>
                    onChange({ ...config, apiKeyHeader: event.target.value })
                  }
                  className={inputClass}
                  placeholder="X-API-Key"
                  spellCheck={false}
                />
              </label>
            )}
          </div>

          {config.authMode !== "none" && (
            <label className="block">
              <span className="mb-2 flex items-center justify-between text-xs font-medium text-slate-300">
                <span>
                  {config.authMode === "bearer"
                    ? "Access token"
                    : "Giá trị API key"}
                </span>
                <span className="text-slate-500">Chỉ giữ trong bộ nhớ tab</span>
              </span>
              <div className="relative">
                <KeyRound className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={config.credential}
                  onChange={(event) =>
                    onChange({ ...config, credential: event.target.value })
                  }
                  type={showCredential ? "text" : "password"}
                  className={`${inputClass} pr-11 pl-10 font-mono text-xs`}
                  placeholder="Nhập credential của hạ tầng đích"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setShowCredential((current) => !current)}
                  className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
                  aria-label={
                    showCredential ? "Ẩn credential" : "Hiện credential"
                  }
                >
                  {showCredential ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </label>
          )}

          <button
            type="button"
            onClick={onConnect}
            disabled={connecting || !config.baseUrl.trim()}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 text-sm font-bold text-[#06111e] shadow-[0_12px_32px_rgba(103,232,249,0.2)] transition hover:-translate-y-0.5 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {connecting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <LockKeyhole className="size-4" />
            )}
            {connecting
              ? "Đang kiểm tra kết nối"
              : "Kết nối và khám phá dữ liệu"}
          </button>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-white/10 bg-black/10 px-3 py-3 text-xs leading-5 text-slate-400">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-300" />
          Công cụ chỉ gửi yêu cầu GET. Backend đích cần cho phép CORS từ domain
          của giao diện này.
        </div>
      </div>
    </div>
  )
}

function ConnectionIndicator({
  connecting,
  probe,
}: {
  connecting: boolean
  probe: AuditRequestResult | null
}) {
  const content = connecting
    ? {
        label: "Đang kiểm tra",
        icon: <Loader2 className="size-3.5 animate-spin" />,
        className: "border-amber-300/20 bg-amber-300/10 text-amber-200",
      }
    : probe?.ok
      ? {
          label: `${probe.durationMs} ms`,
          icon: <CheckCircle2 className="size-3.5" />,
          className: "border-emerald-300/20 bg-emerald-300/10 text-emerald-200",
        }
      : probe
        ? {
            label: probe.status ? `HTTP ${probe.status}` : "Mất kết nối",
            icon: <Unplug className="size-3.5" />,
            className: "border-rose-300/20 bg-rose-300/10 text-rose-200",
          }
        : {
            label: "Chưa kết nối",
            icon: <Unplug className="size-3.5" />,
            className: "border-white/10 bg-white/5 text-slate-400",
          }

  return (
    <div
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold ${content.className}`}
    >
      {content.icon}
      {content.label}
    </div>
  )
}
