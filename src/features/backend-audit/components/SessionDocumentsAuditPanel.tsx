import { useMemo, useState } from "react"
import {
  CheckCircle2,
  Clock3,
  FileClock,
  FileText,
  Hash,
  Search,
  Tags,
} from "lucide-react"

import type { AuditRequestResult } from "../backendAudit"
import { asRecord, dateText, numberText, text } from "../auditValueFormatters"
import {
  documentMetadata,
  documentMetadataVersions,
  documentName,
  documentRecord,
  documentSessionId,
  type SessionAuditData,
} from "../sessionAuditData"
import { AuditStatusBadge } from "./AuditStatusBadge"

export function SessionDocumentsAuditPanel({
  data,
  results,
  onOpenRaw,
}: {
  data: SessionAuditData
  results: Record<string, AuditRequestResult>
  onOpenRaw: (endpointId: string) => void
}) {
  const [query, setQuery] = useState("")
  const [reviewOnly, setReviewOnly] = useState(false)
  const filtered = useMemo(() => {
    const source = reviewOnly ? data.pendingMetadataDocuments : data.documents
    const normalized = query.trim().toLocaleLowerCase("vi")
    if (!normalized) return source
    return source.filter((document) => {
      const metadata = documentMetadata(document)
      return [
        documentName(document),
        documentSessionId(document),
        text(document.document_id),
        metadata ? JSON.stringify(metadata) : "",
      ].some((value) => value.toLocaleLowerCase("vi").includes(normalized))
    })
  }, [data.documents, data.pendingMetadataDocuments, query, reviewOnly])
  const displayed = filtered.slice(0, 150)
  const richEndpoint = results["backup-documents"]

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={FileText}
          label="Đã tải / tổng"
          value={`${numberText(data.documents.length)} / ${numberText(data.documentTotal)}`}
        />
        <Metric
          icon={Tags}
          label="Metadata version"
          value={numberText(data.metadataVersionCount)}
        />
        <Metric
          icon={Clock3}
          label="Chờ duyệt metadata"
          value={numberText(data.pendingMetadataDocuments.length)}
          tone="warning"
        />
        <Metric
          icon={Hash}
          label="Có PDF đánh số"
          value={numberText(data.numberedDocumentCount)}
        />
      </div>

      {richEndpoint && !richEndpoint.ok && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          API backup-document không khả dụng (
          {richEndpoint.error || `HTTP ${richEndpoint.status}`}); bảng đang dùng
          dữ liệu OCR rút gọn nên có thể thiếu metadata version và PDF đánh số.
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:flex-row md:items-center">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 focus-within:border-cyan-700">
          <Search className="size-4 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm tên file, ID hoặc giá trị metadata..."
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>
        <button
          type="button"
          onClick={() => setReviewOnly((value) => !value)}
          className={`h-11 rounded-xl px-4 text-xs font-bold transition ${
            reviewOnly
              ? "bg-amber-500 text-white"
              : "border border-slate-200 bg-white text-slate-600"
          }`}
        >
          {reviewOnly ? "Đang lọc: chờ duyệt" : "Chỉ tài liệu chờ duyệt"}
        </button>
        <button
          type="button"
          onClick={() => onOpenRaw("backup-documents")}
          className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-cyan-800"
        >
          Xem JSON nguồn
        </button>
      </div>

      {displayed.length === 0 ? (
        <Empty text="Không có tài liệu phù hợp với bộ lọc hiện tại." />
      ) : (
        <div className="grid gap-3">
          {displayed.map((document, index) => (
            <DocumentCard
              key={
                documentSessionId(document) ||
                `${documentName(document)}-${index}`
              }
              document={document}
            />
          ))}
        </div>
      )}

      {(filtered.length > displayed.length ||
        data.documentTotal > data.documents.length) && (
        <p className="rounded-xl bg-slate-100 px-4 py-3 text-center text-xs text-slate-600">
          Đang render {displayed.length.toLocaleString("vi-VN")}/
          {filtered.length.toLocaleString("vi-VN")} kết quả lọc; API đã tải{" "}
          {data.documents.length.toLocaleString("vi-VN")}/
          {data.documentTotal.toLocaleString("vi-VN")} tài liệu.
        </p>
      )}
    </div>
  )
}

function DocumentCard({ document }: { document: Record<string, unknown> }) {
  const record = documentRecord(document)
  const metadata = documentMetadata(document)
  const versions = documentMetadataVersions(document)
  const numberingStatus = asRecord(document.numbering_status)
  const numbered = asRecord(asRecord(document.pdfs)?.numbered)
  const numberedUrl = text(
    numbered?.signed_url ?? numbered?.url ?? numbered?.download_url
  )
  const reviewStatus =
    text(record.review_status ?? record.metadata_review_status) || "unknown"
  const metadataEntries = metadata ? Object.entries(metadata).slice(0, 16) : []

  return (
    <details className="group rounded-2xl border border-slate-200 bg-white open:border-cyan-700/40 open:shadow-lg">
      <summary className="flex cursor-pointer list-none flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-950">
            {documentName(document)}
          </p>
          <p className="mt-1 font-mono text-[11px] text-slate-500">
            session_document_id={documentSessionId(document) || "—"} · remote=
            {text(document.document_id ?? record.document_id) || "—"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AuditStatusBadge
            value={text(record.status ?? record.ocr_status) || "unknown"}
          />
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
            metadata: {reviewStatus}
          </span>
          <span className="rounded-lg bg-cyan-50 px-2 py-1 text-[10px] font-semibold text-cyan-800">
            {versions.length} version
          </span>
        </div>
      </summary>

      <div className="grid gap-5 border-t border-slate-100 p-4 xl:grid-cols-2">
        <section>
          <h4 className="flex items-center gap-2 text-xs font-bold tracking-wide text-slate-700 uppercase">
            <Tags className="size-4 text-cyan-800" /> Metadata chuẩn hóa
          </h4>
          {metadataEntries.length ? (
            <dl className="mt-3 grid gap-x-5 gap-y-3 sm:grid-cols-2">
              {metadataEntries.map(([key, value]) => (
                <div key={key} className="min-w-0">
                  <dt className="truncate text-[10px] font-semibold text-slate-400 uppercase">
                    {key}
                  </dt>
                  <dd className="mt-1 text-xs font-medium break-words text-slate-800">
                    {compactValue(value)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              Chưa có metadata chuẩn hóa.
            </p>
          )}
        </section>

        <section>
          <h4 className="flex items-center gap-2 text-xs font-bold tracking-wide text-slate-700 uppercase">
            <FileClock className="size-4 text-cyan-800" /> Lịch sử metadata
          </h4>
          {versions.length ? (
            <div className="mt-3 grid gap-2">
              {versions.slice(0, 12).map((version, index) => (
                <div
                  key={text(version.id) || String(index)}
                  className="rounded-xl bg-slate-50 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800">
                      Version{" "}
                      {text(version.version_number ?? version.id) || index + 1}
                    </span>
                    <AuditStatusBadge
                      value={
                        text(version.review_status ?? version.status) ||
                        "stored"
                      }
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {text(version.source) || "Không rõ nguồn"} ·{" "}
                    {dateText(version.created_at) || "Không rõ thời điểm"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              API không trả về metadata version.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-100 bg-slate-50 p-4 xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="flex items-center gap-2 text-xs font-bold tracking-wide text-slate-700 uppercase">
                <Hash className="size-4 text-cyan-800" /> Phiên bản đánh số
              </h4>
              <p className="mt-2 text-xs text-slate-600">
                Status:{" "}
                {text(numberingStatus?.status) ||
                  text(numbered?.processing_status) ||
                  "chưa có"}{" "}
                · version:{" "}
                {text(
                  numbered?.version_id ?? numberingStatus?.result_version_id
                ) || "—"}
              </p>
            </div>
            {numbered?.available === true ? (
              numberedUrl.startsWith("http") ? (
                <a
                  href={numberedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl bg-cyan-800 px-3 py-2 text-xs font-bold text-white"
                >
                  Mở PDF đánh số
                </a>
              ) : (
                <span className="flex items-center gap-2 rounded-xl bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-800">
                  <CheckCircle2 className="size-4" /> PDF sẵn sàng
                </span>
              )
            ) : (
              <span className="rounded-xl bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
                Chưa có PDF đánh số
              </span>
            )}
          </div>
        </section>
      </div>
    </details>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: typeof FileText
  label: string
  value: string
  tone?: "default" | "warning"
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
          {label}
        </p>
        <Icon
          className={`size-4 ${tone === "warning" ? "text-amber-600" : "text-cyan-800"}`}
        />
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
    </div>
  )
}

function Empty({ text: value }: { text: string }) {
  return (
    <div className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
      {value}
    </div>
  )
}

function compactValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—"
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value)
  }
  try {
    const serialized = JSON.stringify(value)
    return serialized.length > 180 ? `${serialized.slice(0, 177)}…` : serialized
  } catch {
    return String(value)
  }
}
