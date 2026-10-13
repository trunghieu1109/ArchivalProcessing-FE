import { useMemo, useState } from "react"
import { Database, Pencil, Search, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { MetadataField } from "../api/metadataApi"
import { metadataSearchText } from "./metadataUi"

export function MetadataFieldTable({
  fields,
  inSet,
  busy,
  onEdit,
  onRemove,
}: {
  fields: MetadataField[]
  inSet: boolean
  busy: boolean
  onEdit: (field: MetadataField) => void
  onRemove: (field: MetadataField) => void
}) {
  const [query, setQuery] = useState("")
  const filtered = useMemo(
    () =>
      fields.filter((field) =>
        metadataSearchText(
          `${field.label} ${field.key} ${field.description ?? ""}`
        ).includes(metadataSearchText(query))
      ),
    [fields, query]
  )

  return (
    <div>
      <div className="px-5 py-4 sm:px-6">
        <div className="relative w-full sm:max-w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#94A3B8]" />
          <Input
            aria-label="Tìm trường metadata"
            placeholder="Tìm tên trường, key hoặc mô tả…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-10 rounded-xl border-[#CBD5E1] pl-9"
          />
        </div>
      </div>
      <Table className="min-w-[720px]">
        <TableHeader className="bg-[#F8FAFC]">
          <TableRow className="border-[#E2E8F0] hover:bg-transparent">
            <TableHead className="h-11 pl-5 text-xs text-[#64748B] sm:pl-6">
              Trường metadata
            </TableHead>
            <TableHead className="text-xs text-[#64748B]">Nguồn</TableHead>
            <TableHead className="text-xs text-[#64748B]">
              Kiểu dữ liệu
            </TableHead>
            <TableHead className="text-xs text-[#64748B]">
              Mô tả trích xuất
            </TableHead>
            <TableHead className="pr-5 text-right text-xs text-[#64748B] sm:pr-6">
              Thao tác
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((field) => (
            <TableRow
              key={field.field_definition_id ?? field.key}
              className="border-[#E2E8F0] hover:bg-[#F8FAFC]/80"
            >
              <TableCell className="max-w-60 py-4 pl-5 whitespace-normal sm:pl-6">
                <span className="block font-semibold break-words">
                  {field.label}
                </span>
                <span className="mt-1 block font-mono text-[11px] break-all text-[#64748B]">
                  {field.key}
                </span>
                {field.hidden && (
                  <Badge
                    variant="outline"
                    className="mt-2 border-[#E2E8F0] text-[#64748B]"
                  >
                    Đang ẩn
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <Badge
                  variant="secondary"
                  className={
                    field.kind === "system"
                      ? "bg-[#F1F5F9] text-[#475569]"
                      : "bg-[#EAF1FF] text-[#0052FF]"
                  }
                >
                  {field.kind === "system" ? "Hệ thống" : "Tùy chỉnh"}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-[#475569]">
                {field.data_type === "DROPLIST" ? "Danh sách chọn" : "Văn bản"}
                {field.data_type === "DROPLIST" && (
                  <span className="mt-1 block text-[#94A3B8]">
                    {field.options?.length ?? 0} lựa chọn
                  </span>
                )}
              </TableCell>
              <TableCell className="max-w-72 whitespace-normal text-xs leading-5 text-[#64748B]">
                <p className="line-clamp-2" title={field.description}>
                  {field.description || "—"}
                </p>
              </TableCell>
              <TableCell className="pr-5 sm:pr-6">
                <div className="flex justify-end gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={busy}
                    aria-label={`Sửa trường ${field.label}`}
                    title="Sửa trường"
                    className="rounded-xl text-[#64748B] hover:bg-[#EAF1FF] hover:text-[#0052FF]"
                    onClick={() => onEdit(field)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  {(inSet || field.kind !== "system") && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={busy}
                      aria-label={`${inSet ? "Bỏ" : "Xóa"} trường ${field.label}`}
                      title={inSet ? "Bỏ khỏi bộ" : "Xóa trường"}
                      className="rounded-xl text-red-500 hover:bg-red-50 hover:text-red-700"
                      onClick={() => onRemove(field)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!filtered.length && (
        <div className="px-5 py-10 text-center">
          <Database className="mx-auto size-8 text-[#CBD5E1]" />
          <p className="mt-3 text-sm font-semibold">
            {fields.length
              ? "Không tìm thấy trường phù hợp"
              : "Chưa có trường metadata"}
          </p>
          <p className="mt-2 text-xs text-[#64748B]">
            {fields.length
              ? "Thử tìm theo tên, key hoặc mô tả khác."
              : inSet
                ? "Thêm trường mới hoặc sao chép trường từ kho để hoàn thiện bộ."
                : "Thêm trường tùy chỉnh để dùng trong các bộ metadata."}
          </p>
        </div>
      )}
      <div className="border-t border-[#E2E8F0] px-5 py-3 text-xs text-[#64748B] sm:px-6">
        Hiển thị {filtered.length} / {fields.length} trường
      </div>
    </div>
  )
}
