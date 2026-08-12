import { useState } from "react"
import {
  AlertCircle,
  ChevronDown,
  FileSpreadsheet,
  LoaderCircle,
  Search,
} from "lucide-react"
import { PaginationControls } from "@/features/upload/components/PaginationControls"
import {
  getDossierTitleCatalogMappings,
  type DossierTitleCatalogMappingsResponse,
} from "@/features/upload/api/sessionApi"
import { cn } from "@/shared/lib/utils"

const PAGE_SIZE = 20

interface DossierTitleMappingPreviewProps {
  sessionId: string | null
  mappingCount: number
}

export function DossierTitleMappingPreview({
  sessionId,
  mappingCount,
}: DossierTitleMappingPreviewProps) {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [appliedQuery, setAppliedQuery] = useState("")
  const [result, setResult] =
    useState<DossierTitleCatalogMappingsResponse | null>(null)

  const loadPage = async (offset: number, query: string) => {
    if (!sessionId || loading) return
    setLoading(true)
    setError("")
    try {
      const response = await getDossierTitleCatalogMappings(sessionId, {
        offset,
        limit: PAGE_SIZE,
        query,
      })
      setResult(response)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không thể tải bảng mapping tiêu đề hồ sơ."
      )
    } finally {
      setLoading(false)
    }
  }

  const toggleExpanded = () => {
    const nextExpanded = !expanded
    setExpanded(nextExpanded)
    if (nextExpanded && result === null) {
      void loadPage(0, appliedQuery)
    }
  }

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextQuery = searchInput.trim()
    setAppliedQuery(nextQuery)
    void loadPage(0, nextQuery)
  }

  if (mappingCount <= 0) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-3">
        <div className="flex items-start gap-3">
          <FileSpreadsheet className="mt-0.5 size-5 shrink-0 text-[#64748B]" />
          <div>
            <p className="text-sm font-semibold text-[#0F172A]">
              Chưa có mapping tiêu đề hồ sơ
            </p>
            <p className="mt-1 text-xs leading-5 text-[#64748B]">
              Chưa tải file XLSX. Khi lập hồ sơ nhanh, hệ thống sẽ dùng AI để
              gợi ý tiêu đề cho các folder.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const total = result?.total ?? mappingCount
  const offset = result?.offset ?? 0
  const pageIndex = Math.floor(offset / PAGE_SIZE)
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const startNumber = total > 0 ? offset + 1 : 0
  const endNumber = Math.min(offset + PAGE_SIZE, total)

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[#BFD3FF] bg-[#F8FAFF]">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={toggleExpanded}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-[#EEF4FF]"
      >
        <span className="flex min-w-0 items-start gap-3">
          <FileSpreadsheet className="mt-0.5 size-5 shrink-0 text-[#1D4ED8]" />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-[#0F172A]">
                Mapping tiêu đề hồ sơ
              </span>
              <span className="rounded-full bg-[#DBEAFE] px-2 py-0.5 text-[11px] font-semibold text-[#1D4ED8]">
                {mappingCount.toLocaleString("vi-VN")} dòng
              </span>
            </span>
            <span className="mt-1 block text-xs leading-5 text-[#64748B]">
              Tên folder được đối chiếu với Mã tạm; mã không tìm thấy vẫn được
              AI gợi ý tiêu đề.
            </span>
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-5 shrink-0 text-[#64748B] transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

      {expanded && (
        <div className="border-t border-[#DCE7FF] bg-white p-4">
          <form
            onSubmit={submitSearch}
            className="mb-3 flex flex-col gap-2 sm:flex-row"
          >
            <label className="relative min-w-0 flex-1">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#94A3B8]" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Tìm theo mã tạm hoặc tiêu đề hồ sơ"
                aria-label="Tìm mapping tiêu đề hồ sơ"
                className="h-9 w-full rounded-lg border border-[#CBD5E1] bg-white pr-3 pl-9 text-sm text-[#0F172A] outline-none placeholder:text-[#94A3B8] focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/10"
              />
            </label>
            <button
              type="submit"
              disabled={loading || !sessionId}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#0052FF] px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading && <LoaderCircle className="size-4 animate-spin" />}
              Tìm kiếm
            </button>
          </form>

          {appliedQuery && result && (
            <p className="mb-3 text-xs text-[#64748B]">
              Tìm thấy {result.total.toLocaleString("vi-VN")} kết quả cho “
              {appliedQuery}”.
            </p>
          )}

          {error && (
            <div className="mb-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading && result === null ? (
            <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-[#64748B]">
              <LoaderCircle className="size-5 animate-spin" />
              Đang tải bảng mapping...
            </div>
          ) : result && result.items.length > 0 ? (
            <>
              <div className="overflow-x-auto rounded-xl border border-[#D8E1EC]">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                  <thead className="bg-[#F8FAFC] text-xs font-semibold tracking-wide text-[#475569] uppercase">
                    <tr>
                      <th className="w-14 border-b border-[#D8E1EC] px-3 py-2.5">
                        Dòng
                      </th>
                      <th className="border-b border-[#D8E1EC] px-3 py-2.5">
                        Mã tạm
                      </th>
                      <th className="border-b border-[#D8E1EC] px-3 py-2.5">
                        Tiêu đề hồ sơ
                      </th>
                      <th className="border-b border-[#D8E1EC] px-3 py-2.5">
                        Bắt đầu
                      </th>
                      <th className="border-b border-[#D8E1EC] px-3 py-2.5">
                        Kết thúc
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] text-[#334155]">
                    {result.items.map((item) => (
                      <tr
                        key={item.id}
                        className="align-top hover:bg-[#F8FAFC]"
                      >
                        <td className="px-3 py-2.5 text-xs text-[#94A3B8] tabular-nums">
                          {item.source_row}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-[#0F172A]">
                          {item.temporary_code}
                        </td>
                        <td className="max-w-xl px-3 py-2.5 whitespace-normal">
                          {item.dossier_title}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {item.start_time || "—"}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {item.end_time || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <PaginationControls
                total={total}
                pageIndex={pageIndex}
                pageSize={PAGE_SIZE}
                pageCount={pageCount}
                startNumber={startNumber}
                endNumber={endNumber}
                itemLabel="mapping"
                className="mt-3"
                onPageChange={(nextPageIndex) =>
                  void loadPage(nextPageIndex * PAGE_SIZE, appliedQuery)
                }
              />
            </>
          ) : result ? (
            <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-8 text-center text-sm text-[#64748B]">
              Không tìm thấy mapping phù hợp.
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
