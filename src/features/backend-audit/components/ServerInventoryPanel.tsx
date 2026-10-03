import {
  Activity,
  Archive,
  BriefcaseBusiness,
  Database,
  FileArchive,
  FileInput,
  FileText,
  Layers3,
} from "lucide-react"

import type { AuditRequestResult } from "../backendAudit"
import { asNumberRecord, asRecord, numberText } from "../auditValueFormatters"
import { AuditStatusBadge } from "./AuditStatusBadge"

export function ServerInventoryPanel({
  result,
  onOpenRaw,
}: {
  result?: AuditRequestResult
  onOpenRaw: () => void
}) {
  const payload = asRecord(result?.data)
  const summary = asRecord(payload?.summary)
  const jobStatuses = asNumberRecord(payload?.job_status_counts)
  const sessionStatuses = asNumberRecord(payload?.session_status_counts)

  return (
    <section className="audit-reveal overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_22px_70px_rgba(15,23,42,0.08)]">
      <header className="flex flex-col gap-3 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-[#0f6f78] uppercase">
            Toàn server
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">
            Kiểm kê dữ liệu và hàng đợi
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Số liệu tổng hợp từ API quản trị, không truy cập trực tiếp database.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenRaw}
          disabled={!result}
          className="text-xs font-semibold text-cyan-800 hover:text-cyan-600 disabled:text-slate-300"
        >
          Xem JSON
        </button>
      </header>

      {!result ? (
        <p className="p-6 text-sm text-slate-500">
          Kết nối backend để tải thống kê toàn hệ thống.
        </p>
      ) : !result.ok ? (
        <div className="p-6">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            Không đọc được dashboard quản trị:{" "}
            {result.error || `HTTP ${result.status}`}. Token có thể không có
            quyền admin.
          </div>
        </div>
      ) : (
        <div className="space-y-5 p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <InventoryMetric
              icon={Database}
              label="Session"
              value={summary?.session_count}
            />
            <InventoryMetric
              icon={FileText}
              label="Tài liệu"
              value={summary?.document_count}
            />
            <InventoryMetric
              icon={Archive}
              label="Hồ sơ"
              value={summary?.dossier_count}
            />
            <InventoryMetric
              icon={Layers3}
              label="Artifact"
              value={summary?.artifact_count}
            />
            <InventoryMetric
              icon={FileInput}
              label="File upload"
              value={summary?.uploaded_file_count}
            />
            <InventoryMetric
              icon={FileArchive}
              label="Raw ZIP"
              value={summary?.raw_upload_count}
            />
            <InventoryMetric
              icon={BriefcaseBusiness}
              label="Tổng job"
              value={summary?.job_count}
            />
            <InventoryMetric
              icon={Activity}
              label="Job lỗi"
              value={summary?.failed_job_count}
              tone="danger"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <StatusDistribution title="Trạng thái job" counts={jobStatuses} />
            <StatusDistribution
              title="Trạng thái session"
              counts={sessionStatuses}
            />
          </div>
        </div>
      )}
    </section>
  )
}

function InventoryMetric({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: typeof Activity
  label: string
  value: unknown
  tone?: "default" | "danger"
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
          {label}
        </p>
        <Icon
          className={`size-4 ${tone === "danger" ? "text-rose-600" : "text-cyan-800"}`}
        />
      </div>
      <p
        className={`mt-3 text-2xl font-bold ${tone === "danger" ? "text-rose-700" : "text-slate-950"}`}
      >
        {numberText(value)}
      </p>
    </div>
  )
}

function StatusDistribution({
  title,
  counts,
}: {
  title: string
  counts: Record<string, number>
}) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <h3 className="text-sm font-bold text-slate-950">{title}</h3>
      {Object.keys(counts).length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">API chưa trả về dữ liệu.</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(counts).map(([status, count]) => (
            <div
              key={status}
              className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
            >
              <AuditStatusBadge value={status} />
              <span className="text-sm font-bold text-slate-900">
                {count.toLocaleString("vi-VN")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
