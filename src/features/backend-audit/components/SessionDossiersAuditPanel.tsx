import { useMemo, useState } from "react"
import {
  Archive,
  FileClock,
  FileQuestion,
  FileWarning,
  FolderCheck,
  Search,
} from "lucide-react"

import type { AuditRequestResult } from "../backendAudit"
import { asRecord, dateText, numberText, text } from "../auditValueFormatters"
import {
  documentName,
  documentRecord,
  documentSessionId,
  type SessionAuditData,
} from "../sessionAuditData"
import { AuditStatusBadge } from "./AuditStatusBadge"

export function SessionDossiersAuditPanel({
  data,
  results,
  onOpenRaw,
}: {
  data: SessionAuditData
  results: Record<string, AuditRequestResult>
  onOpenRaw: (endpointId: string) => void
}) {
  const [query, setQuery] = useState("")
  const documentsById = useMemo(() => {
    const map = new Map<string, Record<string, unknown>>()
    data.documents.forEach((document) => {
      const record = documentRecord(document)
      for (const value of [
        documentSessionId(document),
        text(document.document_id),
        text(record.document_id),
      ]) {
        if (value) map.set(value, document)
      }
    })
    return map
  }, [data.documents])
  const normalizedQuery = query.trim().toLocaleLowerCase("vi")
  const dossiers = normalizedQuery
    ? data.dossiers.filter((dossier) =>
        [
          dossier.title,
          dossier.generated_title,
          dossier.dossier_id,
          dossier.dossier_number,
        ]
          .map(text)
          .some((value) =>
            value.toLocaleLowerCase("vi").includes(normalizedQuery)
          )
      )
    : data.dossiers

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={FolderCheck}
          label="Hồ sơ đã ghi nhận"
          value={data.dossiers.length}
        />
        <Metric
          icon={FileQuestion}
          label="Chưa phân loại"
          value={data.unclassifiedDossiers.length}
          tone="warning"
        />
        <Metric
          icon={FileClock}
          label="Hồ sơ nháp"
          value={data.dossierDrafts.length}
          tone="warning"
        />
        <Metric
          icon={FileWarning}
          label="Tài liệu chờ cập nhật"
          value={data.pendingClusterDocuments.length}
          tone="danger"
        />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-cyan-700">
          <Search className="size-4 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm hồ sơ theo tiêu đề, mã, số hồ sơ..."
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>
        <button
          type="button"
          onClick={() => onOpenRaw("dossiers")}
          className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-cyan-800"
        >
          Xem JSON hồ sơ
        </button>
      </div>

      <AuditSection
        title={`Hồ sơ đã hình thành (${dossiers.length})`}
        description="Mỗi hồ sơ hiển thị nhóm phân loại, trạng thái và tài liệu thành viên mà API trả về."
        endpointError={
          results.dossiers && !results.dossiers.ok
            ? results.dossiers.error
            : null
        }
      >
        {dossiers.length ? (
          <div className="grid gap-3">
            {dossiers.slice(0, 120).map((dossier, index) => (
              <DossierCard
                key={text(dossier.id ?? dossier.dossier_id) || String(index)}
                dossier={dossier}
                documentsById={documentsById}
              />
            ))}
          </div>
        ) : (
          <Empty text="Chưa có hồ sơ đã hình thành hoặc không khớp bộ lọc." />
        )}
      </AuditSection>

      <div className="grid gap-5 xl:grid-cols-2">
        <AuditSection
          title={`Hồ sơ nháp/chưa chính thức (${data.dossierDrafts.length})`}
          description="Draft chưa apply chưa được tính là hồ sơ chính thức của cluster version."
          action={() => onOpenRaw("dossier-drafts")}
          endpointError={
            results["dossier-drafts"] && !results["dossier-drafts"].ok
              ? results["dossier-drafts"].error
              : null
          }
        >
          {data.dossierDrafts.length ? (
            <div className="grid max-h-[38rem] gap-2 overflow-auto pr-1">
              {data.dossierDrafts.map((draft, index) => (
                <DraftCard
                  key={text(draft.id) || String(index)}
                  draft={draft}
                  documentsById={documentsById}
                />
              ))}
            </div>
          ) : (
            <Empty text="Không có hồ sơ nháp trong dữ liệu API đã tải." />
          )}
        </AuditSection>

        <AuditSection
          title={`Hồ sơ chưa phân loại (${data.unclassifiedDossiers.length})`}
          description="Hồ sơ đã tồn tại nhưng chưa gắn vào nhánh phương án chỉnh lý."
          action={() => onOpenRaw("unclassified-dossiers")}
          endpointError={
            results["unclassified-dossiers"] &&
            !results["unclassified-dossiers"].ok
              ? results["unclassified-dossiers"].error
              : null
          }
        >
          {data.unclassifiedDossiers.length ? (
            <div className="grid max-h-[38rem] gap-2 overflow-auto pr-1">
              {data.unclassifiedDossiers.map((dossier, index) => (
                <div
                  key={text(dossier.id ?? dossier.dossier_id) || String(index)}
                  className="rounded-xl border border-amber-100 bg-amber-50 p-3"
                >
                  <p className="text-sm font-bold text-slate-900">
                    {text(dossier.title ?? dossier.generated_title) ||
                      "Hồ sơ chưa có tiêu đề"}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {text(dossier.dossier_id ?? dossier.id) || "—"} ·{" "}
                    {documentIds(dossier).length} tài liệu
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <Empty text="Không có hồ sơ chưa phân loại." />
          )}
        </AuditSection>
      </div>

      <AuditSection
        title={`Tài liệu chưa vào cluster version hiện hành (${data.pendingClusterDocuments.length})`}
        description="Đây là nhóm cần cập nhật hồ sơ để được ghi nhận trong lần build tiếp theo."
        action={() => onOpenRaw("clustering-pending")}
        endpointError={
          results["clustering-pending"] && !results["clustering-pending"].ok
            ? results["clustering-pending"].error
            : null
        }
      >
        {data.pendingClusterDocuments.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-left text-xs">
              <thead className="text-[10px] tracking-wide text-slate-400 uppercase">
                <tr>
                  <th className="pb-3 font-semibold">Tài liệu</th>
                  <th className="pb-3 font-semibold">Intake</th>
                  <th className="pb-3 font-semibold">Metadata</th>
                  <th className="pb-3 font-semibold">Lý do</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.pendingClusterDocuments.map((item, index) => (
                  <tr key={text(item.session_document_id) || String(index)}>
                    <td className="py-3 pr-4 font-medium text-slate-800">
                      {text(item.file_name) ||
                        `Tài liệu ${text(item.session_document_id)}`}
                    </td>
                    <td className="py-3 pr-4 font-mono text-[11px] text-slate-500">
                      {text(item.supplemental_intake_id) || "—"}
                    </td>
                    <td className="py-3 pr-4">
                      <AuditStatusBadge
                        value={
                          item.metadata_ready
                            ? "ready"
                            : text(item.review_status) || "pending"
                        }
                      />
                    </td>
                    <td className="py-3 text-slate-500">
                      {text(item.pending_reason) || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty text="Không có tài liệu chờ cập nhật hồ sơ." />
        )}
      </AuditSection>
    </div>
  )
}

function DossierCard({
  dossier,
  documentsById,
}: {
  dossier: Record<string, unknown>
  documentsById: Map<string, Record<string, unknown>>
}) {
  const classification = asRecord(dossier.classification)
  const ids = documentIds(dossier)
  const documents = ids
    .map((id) => documentsById.get(id))
    .filter(Boolean) as Record<string, unknown>[]
  return (
    <details className="rounded-2xl border border-slate-200 bg-white open:border-cyan-700/40">
      <summary className="flex cursor-pointer list-none flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-950">
            {text(dossier.title ?? dossier.generated_title) ||
              "Hồ sơ chưa có tiêu đề"}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500">
            {text(classification?.group_name ?? dossier.folder_name) ||
              "Chưa phân loại"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] font-semibold text-slate-600">
          <span className="rounded-lg bg-slate-100 px-2 py-1.5">
            {ids.length} tài liệu
          </span>
          <span className="rounded-lg bg-slate-100 px-2 py-1.5">
            Số HS {text(dossier.dossier_number) || "—"}
          </span>
          <AuditStatusBadge
            value={
              text(dossier.classification_status ?? dossier.status) || "unknown"
            }
          />
        </div>
      </summary>
      <div className="grid gap-4 border-t border-slate-100 p-4 lg:grid-cols-2">
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label="Dossier ID" value={dossier.dossier_id ?? dossier.id} />
          <Field label="Hộp" value={dossier.box_number} />
          <Field label="THBQ" value={dossier.retention_period} />
          <Field
            label="Số trang"
            value={dossier.page_count ?? dossier.sheet_count}
          />
          <Field label="Từ ngày" value={dossier.start_date} />
          <Field label="Đến ngày" value={dossier.end_date} />
        </dl>
        <div>
          <p className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            Tài liệu thành viên
          </p>
          {documents.length ? (
            <div className="mt-2 grid gap-1.5">
              {documents.slice(0, 20).map((document) => (
                <div
                  key={documentSessionId(document)}
                  className="truncate rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700"
                >
                  {documentName(document)}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs leading-5 text-slate-500">
              API trả {ids.length} ID nhưng các tài liệu tương ứng có thể nằm
              ngoài trang 500 tài liệu đã tải.
            </p>
          )}
        </div>
      </div>
    </details>
  )
}

function DraftCard({
  draft,
  documentsById,
}: {
  draft: Record<string, unknown>
  documentsById: Map<string, Record<string, unknown>>
}) {
  const metadata = asRecord(draft.metadata) ?? asRecord(draft.metadata_payload)
  const ids = Array.isArray(draft.session_document_ids)
    ? draft.session_document_ids.map(text)
    : []
  const names = ids
    .map((id) => documentsById.get(id))
    .filter(Boolean)
    .map((item) => documentName(item!))
  return (
    <details className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <summary className="cursor-pointer list-none">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-slate-900">
              {text(metadata?.title ?? draft.target_cluster_id) ||
                `Draft #${text(draft.id)}`}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {ids.length} tài liệu · cập nhật{" "}
              {dateText(draft.updated_at) || "—"}
            </p>
          </div>
          <AuditStatusBadge
            value={text(draft.status ?? draft.readiness_status) || "pending"}
          />
        </div>
      </summary>
      <div className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-600">
        <p>
          Nguồn: {text(draft.source) || "—"} · revision:{" "}
          {text(draft.metadata_revision) || "0"}
        </p>
        {names.length > 0 && (
          <p className="mt-2 leading-5">
            Tài liệu: {names.slice(0, 15).join(", ")}
          </p>
        )}
      </div>
    </details>
  )
}

function AuditSection({
  title,
  description,
  action,
  endpointError,
  children,
}: {
  title: string
  description: string
  action?: () => void
  endpointError?: string | null
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-950">
            <Archive className="size-4 text-cyan-800" /> {title}
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
        </div>
        {action && (
          <button
            type="button"
            onClick={action}
            className="shrink-0 text-xs font-semibold text-cyan-800"
          >
            Xem JSON
          </button>
        )}
      </div>
      {endpointError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          {endpointError}
        </div>
      ) : (
        children
      )}
    </section>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: typeof Archive
  label: string
  value: number
  tone?: "default" | "warning" | "danger"
}) {
  const color =
    tone === "danger"
      ? "text-rose-600"
      : tone === "warning"
        ? "text-amber-600"
        : "text-cyan-800"
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
          {label}
        </p>
        <Icon className={`size-4 ${color}`} />
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-950">
        {numberText(value)}
      </p>
    </div>
  )
}

function Field({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-xs font-medium text-slate-800">
        {text(value) || "—"}
      </dd>
    </div>
  )
}

function Empty({ text: value }: { text: string }) {
  return (
    <div className="grid min-h-28 place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">
      {value}
    </div>
  )
}

function documentIds(dossier: Record<string, unknown>): string[] {
  return Array.isArray(dossier.document_ids)
    ? dossier.document_ids.map(text).filter(Boolean)
    : []
}
