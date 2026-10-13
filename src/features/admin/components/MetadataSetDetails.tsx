import { Copy, Info, Layers, Pencil, Plus, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { MetadataField, MetadataSet } from "../api/metadataApi"
import { MetadataFieldTable } from "./MetadataFieldTable"
import { metadataButtonClass, metadataPrimaryButtonClass } from "./metadataUi"

export function MetadataSetDetails({
  group,
  disabled,
  onEdit,
  onDelete,
  onAddField,
  onImport,
  onEditField,
  onRemoveField,
}: {
  group: MetadataSet | null
  disabled: boolean
  onEdit: () => void
  onDelete: () => void
  onAddField: () => void
  onImport: () => void
  onEditField: (field: MetadataField) => void
  onRemoveField: (field: MetadataField) => void
}) {
  if (!group)
    return (
      <section className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-[#D8E1EC] bg-white p-6 text-center shadow-sm">
        <span className="rounded-2xl bg-[#EAF1FF] p-4 text-[#0052FF]">
          <Layers className="size-7" />
        </span>
        <h3 className="mt-4 text-base font-bold">Chọn một bộ metadata</h3>
        <p className="mt-2 max-w-sm text-sm leading-6 text-[#64748B]">
          Xem và quản lý các trường trích xuất trong bộ. Bạn cũng có thể tạo bộ
          mới để dùng khi thiết lập session.
        </p>
      </section>
    )

  return (
    <section className="min-w-0 overflow-hidden rounded-3xl border border-[#D8E1EC] bg-white shadow-sm">
      <div className="border-b border-[#E2E8F0] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-bold break-words">{group.name}</h3>
              <Badge
                variant="outline"
                className={
                  group.field_keys.length
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                }
              >
                {group.field_keys.length ? "Có thể sử dụng" : "Chưa có trường"}
              </Badge>
            </div>
            <p className="mt-2 text-sm leading-6 break-words text-[#64748B]">
              {group.description || "Chưa có mô tả cho bộ metadata này."}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="outline"
              className={metadataButtonClass}
              disabled={disabled}
              onClick={onEdit}
            >
              <Pencil className="size-4" />
              Sửa bộ
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-10 gap-2 rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700"
              disabled={disabled}
              onClick={onDelete}
            >
              <Trash2 className="size-4" />
              Xóa bộ
            </Button>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-6">
        <div>
          <h4 className="text-sm font-semibold">Trường trong bộ</h4>
          <p className="mt-1 text-xs text-[#64748B]">
            {group.field_keys.length} trường được chọn để trích xuất
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className={metadataButtonClass}
            disabled={disabled}
            onClick={onImport}
          >
            <Copy className="size-4" />
            Sao chép từ kho
          </Button>
          <Button
            type="button"
            className={metadataPrimaryButtonClass}
            disabled={disabled}
            onClick={onAddField}
          >
            <Plus className="size-4" />
            Thêm trường vào bộ
          </Button>
        </div>
      </div>
      <MetadataFieldTable
        key={group.id}
        fields={group.fields}
        inSet
        busy={disabled}
        onEdit={onEditField}
        onRemove={onRemoveField}
      />
      <div className="flex items-start gap-2 border-t border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4 text-xs leading-5 text-[#64748B] sm:px-6">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          {group.field_keys.length
            ? "Thay đổi bộ không ảnh hưởng đến cấu hình đã chốt của các session trước đó."
            : "Thêm ít nhất một trường để bộ này có thể được chọn cho session."}
        </p>
      </div>
    </section>
  )
}
