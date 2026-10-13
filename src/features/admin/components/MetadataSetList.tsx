import { useMemo, useState } from "react"
import { Layers, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import type { MetadataSet } from "../api/metadataApi"
import { metadataSearchText } from "./metadataUi"

export function MetadataSetList({
  sets,
  selectedId,
  disabled,
  onSelect,
}: {
  sets: MetadataSet[]
  selectedId?: number
  disabled: boolean
  onSelect: (group: MetadataSet) => void
}) {
  const [query, setQuery] = useState("")
  const filtered = useMemo(() => {
    const search = metadataSearchText(query)
    return sets.filter((group) =>
      metadataSearchText(`${group.name} ${group.description ?? ""}`).includes(
        search
      )
    )
  }, [query, sets])

  return (
    <section className="min-w-0 overflow-hidden rounded-3xl border border-[#D8E1EC] bg-white shadow-sm">
      <div className="border-b border-[#E2E8F0] p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold">Các bộ metadata</h3>
          <Badge variant="secondary" className="bg-[#F1F5F9] text-[#64748B]">
            {sets.length}
          </Badge>
        </div>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#94A3B8]" />
          <Input
            aria-label="Tìm bộ metadata"
            placeholder="Tìm theo tên bộ…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-10 rounded-xl border-[#CBD5E1] pl-9"
          />
        </div>
      </div>
      <div className="max-h-[620px] space-y-2 overflow-y-auto p-3">
        {filtered.map((group) => {
          const active = selectedId === group.id
          const empty = group.field_keys.length === 0
          return (
            <button
              type="button"
              key={group.id}
              disabled={disabled}
              aria-pressed={active}
              aria-label={`Mở bộ ${group.name}`}
              onClick={() => onSelect(group)}
              className={`w-full rounded-2xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0052FF] disabled:opacity-60 ${active ? "border-[#BFD3FF] bg-[#EEF4FF]" : "border-transparent hover:border-[#E2E8F0] hover:bg-[#F8FAFC]"}`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 rounded-xl p-2 ${active ? "bg-[#0052FF] text-white" : "bg-[#F1F5F9] text-[#64748B]"}`}
                >
                  <Layers className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <span
                    className={`block text-sm font-semibold break-words ${active ? "text-[#0052FF]" : "text-[#0F172A]"}`}
                  >
                    {group.name}
                  </span>
                  {group.description && (
                    <span className="mt-1 line-clamp-2 text-xs leading-5 text-[#64748B]">
                      {group.description}
                    </span>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
                    <span>{group.field_keys.length} trường</span>
                    {empty && (
                      <Badge
                        variant="outline"
                        className="border-amber-200 bg-amber-50 text-amber-700"
                      >
                        Chưa có trường
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
        {!filtered.length && (
          <div className="px-3 py-10 text-center">
            <Layers className="mx-auto size-8 text-[#CBD5E1]" />
            <p className="mt-3 text-sm font-semibold">
              {sets.length
                ? "Không tìm thấy bộ phù hợp"
                : "Chưa có bộ metadata"}
            </p>
            <p className="mt-2 text-xs leading-5 text-[#64748B]">
              {sets.length
                ? "Thử tìm với tên hoặc mô tả khác."
                : "Tạo bộ mới, sau đó thêm các trường cần trích xuất."}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
