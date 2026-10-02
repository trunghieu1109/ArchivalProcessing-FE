import {
  Activity,
  Archive,
  Boxes,
  CheckCircle2,
  FileInput,
  FileText,
  FolderOpen,
  Loader2,
  RefreshCw,
  TriangleAlert,
} from "lucide-react"

import type { AuditRequestResult } from "../backendAudit"
import {
  asNumberRecord,
  asRecord,
  asRecords,
  bytesText,
  dateText,
  finiteNumber,
  numberText,
  text,
} from "../auditValueFormatters"
import { AuditStatusBadge } from "./AuditStatusBadge"
import { DocumentStatusTable } from "./DocumentStatusTable"
import { IngestionDiagnostics } from "./IngestionDiagnostics"

export function FondsDetailPanel({
  sessionId,
  results,
  loading,
  onRefresh,
  onOpenRaw,
}: {
  sessionId: string
  results: Record<string, AuditRequestResult>
  loading: boolean
  onRefresh: () => void
  onOpenRaw: (endpointId: string) => void
}) {
  const detail = asRecord(results["session-detail"]?.data)
  const digitization = asRecord(results.digitization?.data)
  const ocrSummary = asRecord(digitization?.summary)
  const clusterBuild = asRecord(results["cluster-build"]?.data)
  const activePlan = asRecord(results["active-plan"]?.data)
  const activeClusters = asRecord(results["active-clusters"]?.data)
  const dossierPayload = asRecord(results.dossiers?.data)
  const files = asRecords(detail?.files)
  const ingestionRuns = asRecords(digitization?.ingestion_runs)
  const batches = asRecords(digitization?.batches)
  const documents = asRecords(digitization?.documents)
  const documentPagination = asRecord(digitization?.pagination)
  const dossiers = asRecords(dossierPayload?.dossiers)
  const statusCounts = asNumberRecord(ocrSummary?.status_counts)
  const hasLoadedData = Boolean(detail || digitization || dossierPayload)

  if (!sessionId.trim()) return null

  return (
    <section className="audit-reveal overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_22px_70px_rgba(15,23,42,0.08)]">
      <header className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-[#0f6f78] uppercase">
            <FolderOpen className="size-4" /> Chi tiết trong phông
          </div>
          <h2 className="mt-2 truncate text-xl font-semibold text-slate-950">
            {text(detail?.fonds_name) || "Phông đang được chọn"}
          </h2>
          <p className="mt-1 truncate font-mono text-xs text-slate-500">
            {sessionId}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {loading ? "Đang đọc dữ liệu" : "Tải lại chi tiết"}
        </button>
      </header>

      {!hasLoadedData && loading ? (
        <div className="grid min-h-64 place-items-center p-8 text-center">
          <div>
            <Loader2 className="mx-auto size-7 animate-spin text-cyan-700" />
            <p className="mt-3 text-sm font-semibold text-slate-700">
              Đang tải metadata, OCR và hồ sơ...
            </p>
          </div>
        </div>
      ) : !hasLoadedData ? (
        <div className="grid min-h-52 place-items-center p-8 text-center">
          <p className="max-w-md text-sm leading-6 text-slate-500">
            Bấm “Tải lại chi tiết” để đọc dữ liệu bên trong session này.
          </p>
        </div>
      ) : (
        <div className="space-y-6 p-4 sm:p-6">
          <div className="grid grid-flow-dense gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              icon={FileText}
              label="Tài liệu"
              value={numberText(
                detail?.document_count ?? ocrSummary?.total_documents
              )}
              detail={`${numberText(ocrSummary?.complete_documents)} hoàn tất OCR`}
            />
            <Metric
              icon={Archive}
              label="Hồ sơ"
              value={numberText(detail?.dossier_count ?? dossiers.length)}
              detail={`${dossiers.length.toLocaleString("vi-VN")} hồ sơ đã tải`}
            />
            <Metric
              icon={CheckCircle2}
              label="Metadata đã duyệt"
              value={numberText(ocrSummary?.verified ?? ocrSummary?.reviewed)}
              detail={`${numberText(ocrSummary?.metadata_ready)} metadata sẵn sàng`}
            />
            <Metric
              icon={TriangleAlert}
              label="Cần chú ý"
              value={numberText(
                Number(ocrSummary?.failed_documents ?? 0) +
                  Number(ocrSummary?.warning ?? 0)
              )}
              detail={`Lập hồ sơ: ${text(clusterBuild?.status) || "chưa có"}`}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <DetailCard
              title="Metadata phông"
              icon={Boxes}
              action={() => onOpenRaw("session-detail")}
            >
              <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                <Field label="Tên phông" value={detail?.fonds_name} />
                <Field label="Mã phông" value={detail?.fonds_creator_code} />
                <Field label="Tên lưu trữ" value={detail?.archive_name} />
                <Field label="Mã lưu trữ" value={detail?.archive_code} />
                <Field label="Trạng thái" value={detail?.status} />
                <Field
                  label="Cập nhật"
                  value={dateText(detail?.updated_at ?? detail?.created_at)}
                />
              </dl>
            </DetailCard>

            <DetailCard
              title="Trạng thái OCR"
              icon={Activity}
              action={() => onOpenRaw("digitization")}
            >
              {Object.keys(statusCounts).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(statusCounts).map(([status, count]) => (
                    <div
                      key={status}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
                        {status}
                      </p>
                      <p className="mt-1 text-lg font-bold text-slate-950">
                        {count.toLocaleString("vi-VN")}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Backend chưa trả về thống kê trạng thái OCR.
                </p>
              )}
            </DetailCard>
          </div>

          <DetailCard
            title="Trạng thái chuỗi xử lý"
            icon={Activity}
            action={() => onOpenRaw("cluster-build")}
          >
            <div className="grid gap-3 md:grid-cols-3">
              <PipelineItem
                label="Phương án chỉnh lý"
                status={
                  text(activePlan?.status) ||
                  resultStatus(results["active-plan"])
                }
                primary={`Phiên bản ${text(activePlan?.version_number) || "—"}`}
                detail={
                  text(activePlan?.dossier_build_strategy) ||
                  text(activePlan?.source) ||
                  "Chưa có dữ liệu"
                }
                onClick={() => onOpenRaw("active-plan")}
              />
              <PipelineItem
                label="Lập hồ sơ"
                status={
                  text(clusterBuild?.status) ||
                  resultStatus(results["cluster-build"])
                }
                primary={
                  text(clusterBuild?.phase) ||
                  text(clusterBuild?.message) ||
                  "Trạng thái build"
                }
                detail={
                  text(clusterBuild?.reason) ||
                  `Job ${text(clusterBuild?.job_id) || "—"}`
                }
                onClick={() => onOpenRaw("cluster-build")}
              />
              <PipelineItem
                label="Phiên bản cluster"
                status={
                  text(activeClusters?.status) ||
                  resultStatus(results["active-clusters"])
                }
                primary={`Phiên bản ${text(activeClusters?.version_number) || "—"}`}
                detail={`${numberText(activeClusters?.batch_snapshot_count)} batch snapshot`}
                onClick={() => onOpenRaw("active-clusters")}
              />
            </div>
          </DetailCard>

          <IngestionDiagnostics
            runs={ingestionRuns}
            batches={batches}
            onOpenRaw={() => onOpenRaw("digitization")}
          />

          <DetailCard
            title={`File đầu vào (${files.length})`}
            icon={FileInput}
            action={() => onOpenRaw("session-detail")}
          >
            {files.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[42rem] text-left text-xs">
                  <thead className="text-[10px] tracking-wide text-slate-400 uppercase">
                    <tr>
                      <th className="pb-3 font-semibold">Tên file</th>
                      <th className="pb-3 font-semibold">Loại</th>
                      <th className="pb-3 font-semibold">Upload</th>
                      <th className="pb-3 text-right font-semibold">
                        Kích thước
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {files.map((file, index) => (
                      <tr key={String(file.id ?? index)}>
                        <td className="max-w-sm py-3 pr-4 font-medium text-slate-800">
                          {text(file.file_name) || "—"}
                        </td>
                        <td className="py-3 pr-4 text-slate-500">
                          {text(file.file_type) || "—"}
                        </td>
                        <td className="py-3 pr-4 text-slate-500">
                          {text(file.upload_status) || "—"}
                        </td>
                        <td className="py-3 text-right text-slate-500">
                          {bytesText(file.size_bytes)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Không có file đầu vào.</p>
            )}
          </DetailCard>

          <DocumentStatusTable
            documents={documents}
            total={finiteNumber(documentPagination?.total)}
            onOpenRaw={() => onOpenRaw("digitization")}
          />

          <DetailCard
            title={`Hồ sơ bên trong (${dossiers.length})`}
            icon={Archive}
            action={() => onOpenRaw("dossiers")}
          >
            {dossiers.length > 0 ? (
              <div className="grid gap-2">
                {dossiers.slice(0, 100).map((dossier, index) => {
                  const classification = asRecord(dossier.classification)
                  const documentIds = Array.isArray(dossier.document_ids)
                    ? dossier.document_ids
                    : []
                  return (
                    <div
                      key={String(dossier.dossier_id ?? dossier.id ?? index)}
                      className="grid gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {text(dossier.title) ||
                            text(dossier.generated_title) ||
                            "Hồ sơ chưa có tiêu đề"}
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {text(classification?.group_name) ||
                            text(dossier.folder_name) ||
                            "Chưa phân loại"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[10px] font-semibold text-slate-600">
                        <span className="rounded-lg bg-white px-2 py-1.5">
                          {documentIds.length} tài liệu
                        </span>
                        <span className="rounded-lg bg-white px-2 py-1.5">
                          Hộp {text(dossier.box_number) || "—"}
                        </span>
                        <span className="rounded-lg bg-white px-2 py-1.5">
                          {text(dossier.retention_period) || "Chưa có THBQ"}
                        </span>
                      </div>
                    </div>
                  )
                })}
                {dossiers.length > 100 && (
                  <p className="pt-2 text-center text-xs text-slate-500">
                    Đang hiển thị 100/{dossiers.length} hồ sơ. Xem JSON để đọc
                    toàn bộ.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Chưa có hồ sơ hoặc phiên bản lập hồ sơ chưa hoàn thành.
              </p>
            )}
          </DetailCard>
        </div>
      )}
    </section>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Activity
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
        </div>
        <div className="flex size-9 items-center justify-center rounded-xl bg-white text-cyan-800 shadow-sm">
          <Icon className="size-4" />
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">{detail}</p>
    </div>
  )
}

function DetailCard({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string
  icon: typeof Activity
  action: () => void
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-950">
          <Icon className="size-4 text-cyan-800" /> {title}
        </h3>
        <button
          type="button"
          onClick={action}
          className="text-xs font-semibold text-cyan-800 hover:text-cyan-600"
        >
          Xem JSON
        </button>
      </div>
      {children}
    </section>
  )
}

function PipelineItem({
  label,
  status,
  primary,
  detail,
  onClick,
}: {
  label: string
  status: string
  primary: string
  detail: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left transition hover:border-cyan-700/40 hover:bg-cyan-50"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
          {label}
        </p>
        <AuditStatusBadge value={status} />
      </div>
      <p className="mt-3 truncate text-sm font-bold text-slate-900">
        {primary}
      </p>
      <p className="mt-1 truncate text-xs text-slate-500">{detail}</p>
    </button>
  )
}

function Field({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-slate-800">
        {text(value) || "—"}
      </dd>
    </div>
  )
}

function resultStatus(result: AuditRequestResult | undefined): string {
  if (!result) return "not loaded"
  if (result.ok) return "available"
  return result.status ? `HTTP ${result.status}` : "connection error"
}
