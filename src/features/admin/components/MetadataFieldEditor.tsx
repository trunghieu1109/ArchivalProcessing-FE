import { useState, type FormEvent } from "react"
import type { MetadataField, MetadataOption } from "../api/metadataApi"

import { Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  metadataButtonClass,
  metadataInputClass,
  metadataPrimaryButtonClass,
} from "./metadataUi"
const SYSTEM_FIELDS = [
  "so_hieu_tai_lieu",
  "trich_yeu_tai_lieu",
  "ngay_ban_hanh",
  "co_quan_ban_hanh",
  "nguoi_ky",
  "loai_van_ban",
]

interface Props {
  field?: MetadataField
  inSet: boolean
  busy: boolean
  onSave: (payload: Record<string, unknown>) => Promise<void>
  onCancel: () => void
}

export function MetadataFieldEditor({
  field,
  inSet,
  busy,
  onSave,
  onCancel,
}: Props) {
  const [kind, setKind] = useState<"system" | "custom">(field?.kind ?? "custom")
  const [key, setKey] = useState(field?.key ?? "")
  const [label, setLabel] = useState(field?.label ?? "")
  const [description, setDescription] = useState(field?.description ?? "")
  const [page, setPage] = useState(
    field?.page == null ? "" : String(field.page)
  )
  const [hidden, setHidden] = useState(field?.hidden ?? false)
  const [dataType, setDataType] = useState(field?.data_type ?? "TEXT")
  const [options, setOptions] = useState<MetadataOption[]>(field?.options ?? [])
  const [documentTypes, setDocumentTypes] = useState<MetadataOption[]>(
    field?.loai_van_ban_options ?? []
  )
  const [editDocumentTypes, setEditDocumentTypes] = useState(false)
  const [error, setError] = useState("")
  const system = kind === "system"
  const systemInSet = system && inSet

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError("")
    try {
      if (!field && !/^[a-z0-9_]+$/.test(key.trim()))
        throw new Error("Key chỉ gồm chữ thường a-z, số và dấu gạch dưới.")
      if (!label.trim()) throw new Error("Hãy nhập tên hiển thị.")
      const payload: Record<string, unknown> = { label: label.trim() }
      if (!field) {
        payload.key = key.trim()
        if (inSet) payload.kind = kind
      }
      if (!system) {
        if (!description.trim())
          throw new Error("Hãy nhập mô tả nội dung cần trích xuất.")
        payload.description = description.trim()
        payload.data_type = dataType
        payload.options =
          dataType === "DROPLIST" ? validatedOptions(options, true) : []
      }
      if (!systemInSet) {
        if (page && (!Number.isInteger(Number(page)) || Number(page) < 1))
          throw new Error("Trang gợi ý phải là số nguyên dương.")
        payload.page = page ? Number(page) : null
        if (!inSet && field) payload.hidden = hidden
        if (system && key === "loai_van_ban" && editDocumentTypes)
          payload.loai_van_ban_options = validatedOptions(documentTypes, false)
      }
      await onSave(payload)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không thể lưu trường metadata."
      )
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-5">
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
        {!field && inSet && (
          <label className="font-medium text-sm">
            Loại trường
            <select
              className={metadataInputClass}
              value={kind}
              onChange={(event) => {
                setKind(event.target.value as "system" | "custom")
                setKey("")
              }}
            >
              <option value="custom">Tùy chỉnh</option>
              <option value="system">Hệ thống</option>
            </select>
          </label>
        )}
        <label className="font-medium text-sm">
          Key
          {!field && system ? (
            <select
              required
              className={metadataInputClass}
              value={key}
              onChange={(event) => setKey(event.target.value)}
            >
              <option value="">Chọn trường hệ thống</option>
              {SYSTEM_FIELDS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          ) : (
            <Input
              required
              disabled={Boolean(field)}
              className={metadataInputClass}
              value={key}
              onChange={(event) => setKey(event.target.value)}
              placeholder="dia_diem"
            />
          )}
        </label>
        <label className="font-medium text-sm">
          Tên hiển thị
          <Input
            required
            maxLength={150}
            className={metadataInputClass}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
        </label>
        {!system && (
          <label className="font-medium text-sm sm:col-span-2">
            Mô tả trích xuất
            <textarea
              required
              maxLength={1000}
              rows={3}
              className={metadataInputClass}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Mô tả rõ thông tin cần tìm trong tài liệu."
            />
          </label>
        )}
        {!system && (
          <label className="font-medium text-sm">
            Kiểu dữ liệu
            <select
              className={metadataInputClass}
              value={dataType}
              onChange={(event) =>
                setDataType(event.target.value as "TEXT" | "DROPLIST")
              }
            >
              <option value="TEXT">Văn bản</option>
              <option value="DROPLIST">Danh sách chọn một giá trị</option>
            </select>
          </label>
        )}
        {!systemInSet && (
          <label className="font-medium text-sm">
            Trang gợi ý
            <Input
              type="number"
              min={1}
              step={1}
              className={metadataInputClass}
              value={page}
              onChange={(event) => setPage(event.target.value)}
            />
            <span className="mt-1 block text-xs text-slate-500">
              Thông tin gợi ý, chưa giới hạn trang OCR.
            </span>
          </label>
        )}
        {!inSet && field && (
          <label className="flex items-center gap-2 text-sm">
            <input
              className="size-4 accent-[#0052FF]"
              type="checkbox"
              checked={hidden}
              onChange={(event) => setHidden(event.target.checked)}
            />
            Ẩn khỏi danh sách chọn vào nhóm mới
          </label>
        )}
        {system && (
          <p className="text-xs text-slate-500 sm:col-span-2">
            Key và mô tả nghiệp vụ của trường hệ thống do hệ thống quản lý.
            {systemInSet ? " Trong nhóm chỉ sửa tên hiển thị." : ""}
          </p>
        )}
        {!system && dataType === "DROPLIST" && (
          <div className="sm:col-span-2">
            <OptionsEditor options={options} onChange={setOptions} withLabel />
          </div>
        )}
        {!inSet && system && key === "loai_van_ban" && (
          <div className="space-y-3 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                className="size-4 accent-[#0052FF]"
                type="checkbox"
                checked={editDocumentTypes}
                onChange={(event) => setEditDocumentTypes(event.target.checked)}
              />
              Cập nhật danh sách loại văn bản
            </label>
            {editDocumentTypes && (
              <OptionsEditor
                options={documentTypes}
                onChange={setDocumentTypes}
                withLabel={false}
              />
            )}
          </div>
        )}
      </fieldset>
      <div className="flex justify-end gap-2 border-t border-[#E2E8F0] pt-4">
        <Button
          disabled={busy}
          type="button"
          variant="outline"
          className={metadataButtonClass}
          onClick={onCancel}
        >
          Hủy
        </Button>
        <Button
          disabled={busy}
          type="submit"
          className={metadataPrimaryButtonClass}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {busy ? "Đang lưu…" : "Lưu trường"}
        </Button>
      </div>
    </form>
  )
}

function validatedOptions(
  options: MetadataOption[],
  withLabel: boolean
): MetadataOption[] {
  if (!options.length || (withLabel && options.length > 100))
    throw new Error(
      withLabel
        ? "Danh sách cần từ 1 đến 100 lựa chọn."
        : "Danh sách cần ít nhất một lựa chọn."
    )
  const seen = new Set<string>()
  return options.map((option) => {
    const value = option.value.trim()
    const label = option.label?.trim() ?? ""
    if (
      !value ||
      (withLabel && value.length > 100) ||
      (withLabel && (!label || label.length > 150))
    )
      throw new Error("Mỗi lựa chọn cần value và tên hiển thị hợp lệ.")
    if (seen.has(value.toLowerCase()))
      throw new Error("Value không được trùng nhau, kể cả khác hoa/thường.")
    seen.add(value.toLowerCase())
    return {
      value,
      ...(withLabel ? { label } : {}),
      description: option.description?.trim() ?? "",
    }
  })
}

function OptionsEditor({
  options,
  onChange,
  withLabel,
}: {
  options: MetadataOption[]
  onChange: (items: MetadataOption[]) => void
  withLabel: boolean
}) {
  const update = (index: number, key: keyof MetadataOption, value: string) =>
    onChange(
      options.map((item, i) => (i === index ? { ...item, [key]: value } : item))
    )
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">Các lựa chọn</p>
      {withLabel && (
        <p className="text-xs text-slate-500">
          Tên dùng để hiển thị; kết quả trích xuất lưu đúng value, phân biệt
          hoa/thường.
        </p>
      )}
      {options.map((option, index) => (
        <div
          key={index}
          className="grid gap-3 rounded-2xl border border-[#D8E1EC] bg-[#F8FAFC] p-4 sm:grid-cols-2"
        >
          <label className="text-xs">
            {withLabel ? "Value" : "Tên loại văn bản"}
            <Input
              required
              maxLength={withLabel ? 100 : undefined}
              className={metadataInputClass}
              value={option.value}
              onChange={(event) => update(index, "value", event.target.value)}
            />
          </label>
          {withLabel && (
            <label className="text-xs">
              Tên hiển thị
              <Input
                required
                maxLength={150}
                className={metadataInputClass}
                value={option.label ?? ""}
                onChange={(event) => update(index, "label", event.target.value)}
              />
            </label>
          )}
          <label className="text-xs sm:col-span-2">
            Mô tả lựa chọn
            <textarea
              maxLength={1000}
              className={metadataInputClass}
              value={option.description ?? ""}
              onChange={(event) =>
                update(index, "description", event.target.value)
              }
            />
          </label>
          <Button
            type="button"
            variant="ghost"
            className="h-8 justify-self-start rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => onChange(options.filter((_, i) => i !== index))}
          >
            Bỏ lựa chọn
          </Button>
        </div>
      ))}
      <Button
        type="button"
        disabled={withLabel && options.length >= 100}
        className={metadataButtonClass}
        onClick={() =>
          onChange([
            ...options,
            { value: "", ...(withLabel ? { label: "" } : {}), description: "" },
          ])
        }
      >
        Thêm lựa chọn
      </Button>
    </div>
  )
}
