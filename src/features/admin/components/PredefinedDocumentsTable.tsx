import { Search } from "lucide-react"

import type { PredefinedDocumentsResponse } from "@/features/admin/api/predefinedDocumentsApi"

const PAGE_SIZE = 50
const SECONDARY_ACTION_CLASS =
  "flex items-center justify-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-4 py-2 text-sm font-semibold text-[#475569] shadow-sm transition hover:border-[#0052FF]/40 hover:text-[#0052FF] disabled:cursor-not-allowed disabled:opacity-50"

export function PredefinedDocumentsTable({
  data,
  loading,
  query,
  offset,
  onQueryChange,
  onPrevious,
  onNext,
}: {
  data: PredefinedDocumentsResponse | null
  loading: boolean
  query: string
  offset: number
  onQueryChange: (value: string) => void
  onPrevious: () => void
  onNext: () => void
}) {
  const start = data?.total ? offset + 1 : 0
  const end = Math.min(offset + PAGE_SIZE, data?.total ?? 0)
  return (
    <section className="overflow-hidden rounded-3xl border border-[#D8E1EC] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] p-4 sm:p-5">
        <div>
          <h3 className="font-bold">Dữ liệu đang hoạt động</h3>
          <p className="text-xs text-[#64748B]">
            {loading ? "Đang tải..." : `${formatNumber(data?.total ?? 0)} kết quả`}
          </p>
        </div>
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#94A3B8]" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Tìm dossier, số, trích yếu..."
            className="h-10 w-72 rounded-xl border border-[#CBD5E1] pr-3 pl-9 text-sm outline-none focus:border-[#0052FF]"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] text-left text-sm">
          <thead className="bg-[#F8FAFC] text-xs text-[#64748B]">
            <tr>
              <th className="p-3">Dossier key</th>
              <th className="p-3">Số / loại</th>
              <th className="p-3">Ngày ban hành</th>
              <th className="p-3">Cơ quan ban hành</th>
              <th className="p-3">Trích yếu</th>
              <th className="p-3">Hash</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((item) => (
              <tr key={item.id} className="border-t border-[#E2E8F0] align-top hover:bg-[#F8FAFC]/80">
                <td className="p-3 font-semibold text-[#0052FF]">{item.predefined_dossier_key}</td>
                <td className="p-3"><strong>{item.document_number || "—"}</strong><br /><span className="text-xs text-[#64748B]">{item.document_type || "—"}</span></td>
                <td className="p-3 whitespace-nowrap">{item.issued_date || "—"}</td>
                <td className="max-w-56 p-3">{item.issuing_agency || "—"}</td>
                <td className="max-w-md p-3"><p className="line-clamp-3">{item.document_summary || item.long_summary || "—"}</p></td>
                <td className="p-3 font-mono text-[11px] text-[#64748B]">{item.document_hash.slice(0, 12)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8F0] p-3">
        <p className="text-xs text-[#64748B]">
          Hiển thị {formatNumber(start)}–{formatNumber(end)} / {formatNumber(data?.total ?? 0)}
        </p>
        <div className="flex gap-2">
          <button className={SECONDARY_ACTION_CLASS} disabled={offset === 0} onClick={onPrevious}>Trước</button>
          <button className={SECONDARY_ACTION_CLASS} disabled={!data || offset + PAGE_SIZE >= data.total} onClick={onNext}>Sau</button>
        </div>
      </div>
    </section>
  )
}

function formatNumber(value: number) {
  return value.toLocaleString("vi-VN")
}
