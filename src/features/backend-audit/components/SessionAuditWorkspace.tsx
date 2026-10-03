import { useMemo, useState } from "react"
import {
  AlertTriangle,
  Archive,
  BookOpenCheck,
  FileSearch2,
  FolderKanban,
  Hash,
  ListChecks,
  Loader2,
  ShieldAlert,
} from "lucide-react"

import type { AuditRequestResult } from "../backendAudit"
import { SESSION_AUDIT_ENDPOINT_IDS } from "../backendAudit"
import { buildSessionAuditData } from "../sessionAuditData"
import { SessionDocumentsAuditPanel } from "./SessionDocumentsAuditPanel"
import { SessionDossiersAuditPanel } from "./SessionDossiersAuditPanel"
import { SessionGovernanceAuditPanel } from "./SessionGovernanceAuditPanel"
import { SessionOperationsAuditPanel } from "./SessionOperationsAuditPanel"

type WorkspaceTab =
  | "documents"
  | "dossiers"
  | "governance"
  | "operations"
  | "limits"

const TABS: Array<{
  id: WorkspaceTab
  label: string
  icon: typeof FileSearch2
}> = [
  { id: "documents", label: "Tài liệu & metadata", icon: FileSearch2 },
  { id: "dossiers", label: "Hồ sơ & draft", icon: Archive },
  { id: "governance", label: "Plan, file & đánh số", icon: FolderKanban },
  { id: "operations", label: "Jobs & sự kiện", icon: ListChecks },
  { id: "limits", label: "Giới hạn API", icon: ShieldAlert },
]

export function SessionAuditWorkspace({
  sessionId,
  results,
  runningEndpointIds,
  onOpenRaw,
}: {
  sessionId: string
  results: Record<string, AuditRequestResult>
  runningEndpointIds: Set<string>
  onOpenRaw: (endpointId: string) => void
}) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("documents")
  const data = useMemo(
    () => buildSessionAuditData(sessionId, results),
    [results, sessionId]
  )
  const endpointIds = [...SESSION_AUDIT_ENDPOINT_IDS]
  const completed = endpointIds.filter((id) => results[id]).length
  const successful = endpointIds.filter((id) => results[id]?.ok).length
  const failed = endpointIds.filter((id) => results[id] && !results[id].ok)
  const running = endpointIds.filter((id) => runningEndpointIds.has(id)).length

  if (!sessionId.trim()) return null

  return (
    <section className="audit-reveal overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_22px_70px_rgba(15,23,42,0.08)]">
      <header className="border-b border-slate-100 px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-[#0f6f78] uppercase">
              <BookOpenCheck className="size-4" /> Session inspector
            </div>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">
              Dữ liệu chi tiết có thể đọc qua API
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              Mỗi nhóm dữ liệu được tải độc lập; endpoint lỗi không làm mất các
              nhóm đã tải thành công.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-700">
              {successful}/{endpointIds.length} API tốt
            </span>
            {running > 0 && (
              <span className="flex items-center gap-2 rounded-xl bg-cyan-50 px-3 py-2 text-cyan-800">
                <Loader2 className="size-3.5 animate-spin" /> {running} đang tải
              </span>
            )}
            {failed.length > 0 && (
              <span className="rounded-xl bg-amber-50 px-3 py-2 text-amber-800">
                {failed.length} API không khả dụng
              </span>
            )}
            {completed === 0 && (
              <span className="rounded-xl bg-slate-100 px-3 py-2 text-slate-600">
                Chưa tải dữ liệu
              </span>
            )}
          </div>
        </div>

        <nav
          className="mt-5 flex gap-2 overflow-x-auto pb-1"
          aria-label="Nhóm dữ liệu audit"
        >
          {TABS.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                  active
                    ? "bg-slate-950 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-cyan-700 hover:text-cyan-800"
                }`}
              >
                <Icon className="size-4" /> {tab.label}
              </button>
            )
          })}
        </nav>
      </header>

      <div className="p-4 sm:p-6">
        {activeTab === "documents" && (
          <SessionDocumentsAuditPanel
            data={data}
            results={results}
            onOpenRaw={onOpenRaw}
          />
        )}
        {activeTab === "dossiers" && (
          <SessionDossiersAuditPanel
            data={data}
            results={results}
            onOpenRaw={onOpenRaw}
          />
        )}
        {activeTab === "governance" && (
          <SessionGovernanceAuditPanel
            data={data}
            results={results}
            onOpenRaw={onOpenRaw}
          />
        )}
        {activeTab === "operations" && (
          <SessionOperationsAuditPanel
            data={data}
            results={results}
            onOpenRaw={onOpenRaw}
          />
        )}
        {activeTab === "limits" && (
          <ApiLimitations results={results} failedIds={failed} />
        )}
      </div>
    </section>
  )
}

function ApiLimitations({
  results,
  failedIds,
}: {
  results: Record<string, AuditRequestResult>
  failedIds: string[]
}) {
  const limitations = [
    {
      title: "Không có API danh sách job tổng quát",
      detail:
        "Backend hiện không expose GET /jobs hoặc GET /sessions/{id}/jobs. UI chỉ hiển thị thống kê trạng thái toàn server, số job queued/failed của session và các job được nhúng trong API plan, clustering, numbering, artifact.",
    },
    {
      title: "Lịch sử PDF chưa có endpoint riêng theo tài liệu",
      detail:
        "UI đọc version đánh số lưu trong backup core và PDF numbered hiện tại. Không thể ký URL hoặc trình bày mọi PDF version lịch sử nếu backend không trả chúng trong dữ liệu numbering.",
    },
    {
      title: "Giới hạn phân trang của API",
      detail:
        "Một lần audit tải tối đa 200 session, 500 tài liệu, 200 draft, 200 tài liệu chờ cập nhật, 1.000 trạng thái đánh số, 500 event và 10 plan version chi tiết. Tổng số vẫn được hiển thị khi response có pagination.",
    },
    {
      title: "Không có runtime metrics",
      detail:
        "CPU, RAM, container restart, RabbitMQ queue depth và worker heartbeat không có trong các API nghiệp vụ hiện tại nên không thể hiển thị ở đây.",
    },
    {
      title: "Publication manifest không được quét tự động",
      detail:
        "GET /sessions/{id}/publication hiện gọi ensure_manifest và có thể ghi artifact/file mới. Để giữ lần audit tự động không làm thay đổi server, endpoint này chỉ có thể chạy thủ công trong Endpoint Explorer.",
    },
  ]

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" />
          <p>
            Đây là audit read-only dựa hoàn toàn trên API hiện có. Các mục bên
            dưới cần backend bổ sung endpoint nếu muốn xem sâu hơn.
          </p>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {limitations.map((item) => (
          <article
            key={item.title}
            className="rounded-2xl border border-slate-200 p-4"
          >
            <h3 className="text-sm font-bold text-slate-950">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {item.detail}
            </p>
          </article>
        ))}
      </div>
      {failedIds.length > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <h3 className="text-sm font-bold text-rose-900">
            Endpoint không khả dụng trên server đích
          </h3>
          <div className="mt-3 grid gap-2">
            {failedIds.map((id) => (
              <div
                key={id}
                className="rounded-xl bg-white px-3 py-2 text-xs text-rose-800"
              >
                <span className="font-mono font-bold">{id}</span>
                <span className="ml-2">
                  —{" "}
                  {results[id]?.error || `HTTP ${results[id]?.status ?? "NET"}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Hash className="size-3.5" /> Các giới hạn này được ghi cả trong báo cáo
        JSON xuất ra qua kết quả endpoint.
      </div>
    </div>
  )
}
