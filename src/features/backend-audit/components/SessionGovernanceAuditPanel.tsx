import {
  Boxes,
  FileInput,
  FileStack,
  FolderTree,
  Hash,
  History,
  PackageCheck,
  Settings2,
} from "lucide-react"

import type { AuditRequestResult } from "../backendAudit"
import {
  asNumberRecord,
  asRecord,
  dateText,
  numberText,
  text,
} from "../auditValueFormatters"
import { recordIdentifier, type SessionAuditData } from "../sessionAuditData"
import { AuditStatusBadge } from "./AuditStatusBadge"

export function SessionGovernanceAuditPanel({
  data,
  results,
  onOpenRaw,
}: {
  data: SessionAuditData
  results: Record<string, AuditRequestResult>
  onOpenRaw: (endpointId: string) => void
}) {
  const numberingSummary = asRecord(data.numbering?.summary)
  const numberingCounts = asNumberRecord(numberingSummary?.status_counts)
  const numberingPagination = asRecord(results["numbering-documents"]?.data)
  const numberingPage = asRecord(numberingPagination?.pagination)
  const planDetails = asRecord(results["backup-plans"]?.data)
  const planPagination = asRecord(planDetails?.pagination)

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={FolderTree}
          label="Plan version"
          value={data.planVersions.length}
        />
        <Metric
          icon={Boxes}
          label="Nhóm phân loại đã tải"
          value={data.planGroups.length}
        />
        <Metric icon={FileInput} label="File nguồn" value={data.files.length} />
        <Metric
          icon={History}
          label="PDF version đánh số"
          value={data.numberingDocumentVersions.length}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel
          title="Phiên bản phương án"
          icon={FolderTree}
          action={() => onOpenRaw("plan-versions")}
        >
          {results["plan-versions"] && !results["plan-versions"].ok ? (
            <EndpointError result={results["plan-versions"]} />
          ) : data.planVersions.length ? (
            <div className="grid max-h-[40rem] gap-2 overflow-auto pr-1">
              {data.planVersions.map((version, index) => {
                const groups = data.planGroups.filter(
                  (group) => text(group.plan_version_id) === text(version.id)
                )
                const detail = data.planVersionDetails.find(
                  (item) => text(item.id) === text(version.id)
                )
                const fileReferences = collectPlanFileReferences(detail)
                return (
                  <details
                    key={text(version.id) || String(index)}
                    className="rounded-xl border border-slate-100 bg-slate-50 p-3"
                  >
                    <summary className="cursor-pointer list-none">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            Version {text(version.version_number) || index + 1}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {text(version.source) || "Không rõ nguồn"} ·{" "}
                            {dateText(version.created_at) || "—"}
                          </p>
                        </div>
                        <AuditStatusBadge
                          value={text(version.status) || "unknown"}
                        />
                      </div>
                    </summary>
                    <dl className="mt-3 grid gap-3 border-t border-slate-200 pt-3 sm:grid-cols-2">
                      <Field label="ID" value={version.id} />
                      <Field
                        label="Nhóm phân loại"
                        value={groups.length || "Chưa tải chi tiết"}
                      />
                      <Field
                        label="Chiến lược lập hồ sơ"
                        value={version.dossier_build_strategy}
                      />
                      <Field
                        label="Mode đánh số"
                        value={version.document_numbering_mode}
                      />
                      <Field
                        label="Style đánh số"
                        value={version.document_numbering_style_preset}
                      />
                      <Field label="Tóm tắt" value={version.summary} />
                    </dl>
                    <div className="mt-3 border-t border-slate-200 pt-3">
                      <p className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
                        File/tham chiếu nguồn
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        {fileReferences.length
                          ? fileReferences.join(", ")
                          : "API summary không trả liên kết file cho version này."}
                      </p>
                    </div>
                  </details>
                )
              })}
              {planPagination?.has_more === true && (
                <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
                  Chi tiết group mới tải {text(planPagination.returned)}/
                  {text(planPagination.total)} plan version do API backup giới
                  hạn 10 version/trang.
                </p>
              )}
            </div>
          ) : (
            <Empty text="Chưa có plan version." />
          )}
        </Panel>

        <Panel
          title="File đầu vào / nguồn"
          icon={FileStack}
          action={() => onOpenRaw("backup-source-files")}
        >
          {results["backup-source-files"] &&
          !results["backup-source-files"].ok ? (
            <EndpointError result={results["backup-source-files"]} />
          ) : data.files.length ? (
            <div className="grid max-h-[40rem] gap-2 overflow-auto pr-1">
              {data.files.map((file, index) => {
                const record = asRecord(file.record) ?? file
                const download = asRecord(file.download)
                const downloadUrl = text(
                  download?.signed_url ??
                    download?.url ??
                    download?.download_url
                )
                return (
                  <div
                    key={text(file.id ?? record.id) || String(index)}
                    className="rounded-xl border border-slate-100 bg-slate-50 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">
                          {text(file.file_name ?? record.file_name) ||
                            "File chưa có tên"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {text(file.file_type ?? record.file_type) ||
                            "unknown"}{" "}
                          ·{" "}
                          {text(record.remote_status ?? record.upload_status) ||
                            "—"}
                        </p>
                      </div>
                      {download?.available === true ? (
                        downloadUrl.startsWith("http") ? (
                          <a
                            href={downloadUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg bg-cyan-800 px-2.5 py-1.5 text-[10px] font-bold text-white"
                          >
                            Tải file
                          </a>
                        ) : (
                          <span className="rounded-lg bg-emerald-100 px-2.5 py-1.5 text-[10px] font-bold text-emerald-800">
                            Có thể tải
                          </span>
                        )
                      ) : (
                        <span className="rounded-lg bg-slate-200 px-2.5 py-1.5 text-[10px] font-bold text-slate-600">
                          Không có URL
                        </span>
                      )}
                    </div>
                    <p className="mt-2 font-mono text-[10px] break-all text-slate-400">
                      remote_file_id={text(record.remote_file_id) || "—"} ·
                      batch={text(record.remote_batch_id) || "—"}
                    </p>
                  </div>
                )
              })}
            </div>
          ) : (
            <Empty text="Session chưa có file nguồn." />
          )}
        </Panel>
      </div>

      <Panel
        title="Cấu hình và trạng thái đánh số"
        icon={Settings2}
        action={() => onOpenRaw("numbering-status")}
      >
        {results["numbering-status"] && !results["numbering-status"].ok ? (
          <EndpointError result={results["numbering-status"]} />
        ) : data.numbering ? (
          <div className="space-y-4">
            <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <ConfigField
                label="Cluster version"
                value={data.numbering.cluster_version_id}
              />
              <ConfigField
                label="Mode"
                value={data.numbering.document_numbering_mode}
              />
              <ConfigField
                label="Style preset"
                value={data.numbering.document_numbering_style_preset}
              />
              <ConfigField
                label="Configuration"
                value={asRecord(data.numbering.numbering_configuration)?.id}
              />
              <ConfigField
                label="Working state"
                value={
                  asRecord(data.numbering.numbering_state)?.status ??
                  (data.numbering.active ? "active" : "idle")
                }
              />
            </dl>
            {Object.keys(numberingCounts).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(numberingCounts).map(([status, count]) => (
                  <div
                    key={status}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <AuditStatusBadge value={status} />
                    <span className="text-sm font-bold text-slate-900">
                      {count.toLocaleString("vi-VN")}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {data.numbering.document_numbering_style_overrides ? (
              <pre className="max-h-44 overflow-auto rounded-xl bg-slate-950 p-3 text-[11px] leading-5 text-cyan-100">
                {JSON.stringify(
                  data.numbering.document_numbering_style_overrides,
                  null,
                  2
                )}
              </pre>
            ) : (
              <p className="text-xs text-slate-500">
                Không có style override; backend đang dùng preset mặc định.
              </p>
            )}
          </div>
        ) : (
          <Empty text="Chưa có dữ liệu cấu hình đánh số." />
        )}
      </Panel>

      <Panel
        title={`Đánh số theo tài liệu (${data.numberingDocuments.length})`}
        icon={Hash}
        action={() => onOpenRaw("numbering-documents")}
      >
        {results["numbering-documents"] &&
        !results["numbering-documents"].ok ? (
          <EndpointError result={results["numbering-documents"]} />
        ) : data.numberingDocuments.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[58rem] text-left text-xs">
              <thead className="text-[10px] tracking-wide text-slate-400 uppercase">
                <tr>
                  <th className="pb-3 font-semibold">Tài liệu</th>
                  <th className="pb-3 font-semibold">Hồ sơ</th>
                  <th className="pb-3 font-semibold">Trạng thái</th>
                  <th className="pb-3 font-semibold">Bắt đầu</th>
                  <th className="pb-3 font-semibold">Kết thúc</th>
                  <th className="pb-3 font-semibold">PDF version</th>
                  <th className="pb-3 text-right font-semibold">Lịch sử</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.numberingDocuments
                  .slice(0, 250)
                  .map((document, index) => {
                    const documentId = recordIdentifier(document)
                    const versions = data.numberingDocumentVersions.filter(
                      (version) =>
                        text(version.session_document_id) === documentId
                    )
                    const nestedNumbering = asRecord(document.numbering)
                    return (
                      <tr key={documentId || String(index)}>
                        <td className="max-w-xs py-3 pr-4 font-medium text-slate-800">
                          {text(document.file_name) || `#${documentId}`}
                        </td>
                        <td className="py-3 pr-4 font-mono text-[11px] text-slate-500">
                          {text(document.dossier_id) || "—"}
                        </td>
                        <td className="py-3 pr-4">
                          <AuditStatusBadge
                            value={text(document.status) || "unknown"}
                          />
                        </td>
                        <td className="py-3 pr-4 text-slate-500">
                          {text(
                            document.start_number ??
                              document.page_start ??
                              document.sheet_start
                          ) || "—"}
                        </td>
                        <td className="py-3 pr-4 text-slate-500">
                          {text(
                            document.end_number ??
                              document.page_end ??
                              document.sheet_end
                          ) || "—"}
                        </td>
                        <td className="py-3 pr-4 font-mono text-[11px] text-slate-500">
                          {text(
                            document.numbered_pdf_version_id ??
                              document.result_version_id ??
                              nestedNumbering?.numbered_pdf_version_id
                          ) || "—"}
                        </td>
                        <td className="py-3 text-right font-bold text-slate-700">
                          {versions.length}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
            {(data.numberingDocuments.length > 250 ||
              numberingPage?.has_more === true) && (
              <p className="mt-3 rounded-xl bg-slate-100 p-3 text-center text-xs text-slate-600">
                Đang render 250/{data.numberingDocuments.length}; API báo tổng{" "}
                {numberText(
                  numberingPage?.total ?? data.numberingDocuments.length
                )}{" "}
                tài liệu đánh số.
              </p>
            )}
          </div>
        ) : (
          <Empty text="Chưa có trạng thái đánh số theo tài liệu." />
        )}
      </Panel>

      <Panel
        title={`Artifact đầu ra (${data.artifacts.length})`}
        icon={PackageCheck}
        action={() => onOpenRaw("artifacts")}
      >
        {results.artifacts && !results.artifacts.ok ? (
          <EndpointError result={results.artifacts} />
        ) : data.artifacts.length ? (
          <div className="grid gap-2 md:grid-cols-2">
            {data.artifacts.map((artifact, index) => {
              const record = asRecord(artifact.record) ?? artifact
              const download = asRecord(artifact.download)
              const downloadUrl = text(download?.download_url ?? download?.url)
              return (
                <div
                  key={text(record.id) || String(index)}
                  className="rounded-xl border border-slate-100 bg-slate-50 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {text(
                          record.file_name ??
                            record.artifact_type ??
                            record.name
                        ) || `Artifact #${text(record.id)}`}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {text(record.artifact_type ?? record.type) ||
                          "artifact"}{" "}
                        · {dateText(record.created_at) || "—"}
                      </p>
                    </div>
                    <AuditStatusBadge
                      value={
                        text(record.status) ||
                        (download?.available ? "ready" : "unknown")
                      }
                    />
                  </div>
                  {download?.available === true &&
                    downloadUrl.startsWith("http") && (
                      <a
                        href={downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex rounded-lg bg-cyan-800 px-2.5 py-1.5 text-[10px] font-bold text-white"
                      >
                        Mở artifact
                      </a>
                    )}
                </div>
              )
            })}
          </div>
        ) : (
          <Empty text="Session chưa có artifact đầu ra." />
        )}
      </Panel>
    </div>
  )
}

function Panel({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string
  icon: typeof Hash
  action: () => void
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-950">
          <Icon className="size-4 text-cyan-800" />
          {title}
        </h3>
        <button
          type="button"
          onClick={action}
          className="text-xs font-semibold text-cyan-800"
        >
          Xem JSON
        </button>
      </div>
      {children}
    </section>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Hash
  label: string
  value: number
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
          {label}
        </p>
        <Icon className="size-4 text-cyan-800" />
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-950">
        {numberText(value)}
      </p>
    </div>
  )
}

function ConfigField({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <dt className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-xs font-bold break-words text-slate-800">
        {text(value) || "—"}
      </dd>
    </div>
  )
}

function Field({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-xs font-medium break-words text-slate-800">
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

function EndpointError({ result }: { result: AuditRequestResult }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
      {result.error || `Backend trả HTTP ${result.status ?? "NET"}.`}
    </div>
  )
}

function collectPlanFileReferences(
  record: Record<string, unknown> | undefined
): string[] {
  if (!record) return []
  const references = new Set<string>()
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    const item = asRecord(value)
    if (!item) return
    for (const key of [
      "source_session_file_id",
      "session_file_id",
      "file_id",
    ]) {
      const id = text(item[key])
      if (id) references.add(`${key}=${id}`)
    }
    for (const [key, child] of Object.entries(item)) {
      if (key === "raw_content" || key === "normalized_text") continue
      visit(child)
    }
  }
  visit(record)
  return [...references]
}
