import { FileText } from "lucide-react"

import { AuditStatusBadge } from "./AuditStatusBadge"

export function DocumentStatusTable({
  documents,
  total,
  onOpenRaw,
}: {
  documents: Array<Record<string, unknown>>
  total: number | null
  onOpenRaw: () => void
}) {
  return (
    <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-950">
          <FileText className="size-4 text-cyan-800" /> Tài liệu và trạng thái
          xử lý ({numberText(total ?? documents.length)})
        </h3>
        <button
          type="button"
          onClick={onOpenRaw}
          className="text-xs font-semibold text-cyan-800 hover:text-cyan-600"
        >
          Xem JSON
        </button>
      </div>
      {documents.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[64rem] text-left text-xs">
            <thead className="text-[10px] tracking-wide text-slate-400 uppercase">
              <tr>
                <th className="pb-3 font-semibold">Tài liệu</th>
                <th className="pb-3 font-semibold">OCR</th>
                <th className="pb-3 font-semibold">Review</th>
                <th className="pb-3 font-semibold">Metadata</th>
                <th className="pb-3 font-semibold">Chữ ký</th>
                <th className="pb-3 font-semibold">Lỗi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documents.map((document, index) => {
                const metadata =
                  asRecord(document.normalized_metadata) ??
                  asRecord(document.metadata)
                return (
                  <tr key={String(document.id ?? index)}>
                    <td className="max-w-sm py-3 pr-4">
                      <p className="truncate font-semibold text-slate-800">
                        {documentLabel(document, metadata)}
                      </p>
                      <p className="mt-1 truncate font-mono text-[10px] text-slate-400">
                        ID{" "}
                        {text(document.id) || text(document.document_id) || "—"}
                      </p>
                    </td>
                    <td className="py-3 pr-4">
                      <AuditStatusBadge
                        value={text(document.ocr_status) || "unknown"}
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <AuditStatusBadge
                        value={text(document.review_status) || "unknown"}
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <AuditStatusBadge
                        value={
                          document.metadata_final
                            ? "final"
                            : document.metadata_ready
                              ? "ready"
                              : "pending"
                        }
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <AuditStatusBadge
                        value={text(document.signature_status) || "—"}
                      />
                    </td>
                    <td className="max-w-xs py-3 text-rose-700">
                      <span className="line-clamp-2">
                        {text(document.error) || "—"}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {total !== null && total > documents.length && (
            <p className="pt-4 text-center text-xs text-slate-500">
              Đang hiển thị {documents.length}/{numberText(total)} tài liệu gần
              nhất.
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm leading-6 text-slate-500">
          Chưa có tài liệu số hóa hoặc backend chưa trả danh sách tài liệu.
        </p>
      )}
    </section>
  )
}

function documentLabel(
  document: Record<string, unknown>,
  metadata: Record<string, unknown> | null
): string {
  for (const value of [
    metadata?.title,
    metadata?.document_title,
    metadata?.subject,
    document.original_path,
    document.data_path,
    document.document_id,
  ]) {
    const label = text(value)
    if (label) return label
  }
  return "Tài liệu chưa có tên"
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : ""
}

function numberText(value: unknown): string {
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString("vi-VN") : "—"
}
