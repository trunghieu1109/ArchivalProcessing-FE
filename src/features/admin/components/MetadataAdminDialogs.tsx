import type { FormEvent } from "react"
import { Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { MetadataField, MetadataSet } from "../api/metadataApi"
import { MetadataDialog } from "./MetadataDialog"
import { MetadataFieldEditor } from "./MetadataFieldEditor"
import { MetadataSetEditor, type MetadataSetDraft } from "./MetadataSetEditor"
import {
  metadataButtonClass,
  metadataInputClass,
  metadataPrimaryButtonClass,
} from "./metadataUi"

export type FieldEditorState = {
  scope: "pool" | "set"
  field?: MetadataField
} | null
export type DeleteTarget =
  | { kind: "set"; group: MetadataSet }
  | {
      kind: "field"
      field: MetadataField
      scope: "pool" | "set"
      groupId?: number
    }

interface Props {
  busy: boolean
  selected: MetadataSet | null
  fields: MetadataField[]
  setEditor: MetadataSetDraft | null
  onSetChange: (draft: MetadataSetDraft | null) => void
  onSaveSet: (event: FormEvent) => Promise<void>
  fieldEditor: FieldEditorState
  onCloseField: () => void
  onSaveField: (payload: Record<string, unknown>) => Promise<void>
  importOpen: boolean
  poolKey: string
  onPoolKeyChange: (value: string) => void
  onCloseImport: () => void
  onImportField: (event: FormEvent) => Promise<void>
  deleteTarget: DeleteTarget | null
  onCloseDelete: () => void
  onConfirmDelete: () => Promise<void>
  dialogError: string
}

export function MetadataAdminDialogs({
  busy,
  selected,
  fields,
  setEditor,
  onSetChange,
  onSaveSet,
  fieldEditor,
  onCloseField,
  onSaveField,
  importOpen,
  poolKey,
  onPoolKeyChange,
  onCloseImport,
  onImportField,
  deleteTarget,
  onCloseDelete,
  onConfirmDelete,
  dialogError,
}: Props) {
  const availableFields = fields.filter(
    (field) => !field.hidden && !selected?.field_keys.includes(field.key)
  )
  const deleteFromSet =
    deleteTarget?.kind === "field" && deleteTarget.scope === "set"
  return (
    <>
      {setEditor && (
        <MetadataDialog
          title={setEditor.id ? "Sửa bộ metadata" : "Tạo bộ metadata"}
          description={
            setEditor.id
              ? "Cập nhật tên và mô tả của bộ metadata."
              : "Đặt tên bộ, sau đó thêm các trường cần trích xuất."
          }
          busy={busy}
          onClose={() => onSetChange(null)}
        >
          <MetadataSetEditor
            key={setEditor.id ?? "new-set"}
            draft={setEditor}
            busy={busy}
            onChange={onSetChange}
            onSubmit={onSaveSet}
          />
        </MetadataDialog>
      )}
      {fieldEditor && (
        <MetadataDialog
          title={
            fieldEditor.field ? "Sửa trường metadata" : "Thêm trường metadata"
          }
          description={
            fieldEditor.scope === "set"
              ? `Cấu hình trường trong bộ “${selected?.name}”.`
              : "Cấu hình trường để sử dụng trong các bộ metadata."
          }
          busy={busy}
          onClose={() => onCloseField()}
        >
          <MetadataFieldEditor
            key={`${fieldEditor.scope}-${fieldEditor.field?.key ?? "new"}`}
            field={fieldEditor.field}
            inSet={fieldEditor.scope === "set"}
            busy={busy}
            onSave={onSaveField}
            onCancel={() => onCloseField()}
          />
        </MetadataDialog>
      )}
      {importOpen && selected && (
        <MetadataDialog
          title="Sao chép trường từ kho"
          description={`Thêm một trường có sẵn vào bộ “${selected.name}”.`}
          busy={busy}
          onClose={() => onCloseImport()}
          className="max-w-lg"
        >
          <form
            onSubmit={(event) => void onImportField(event)}
            className="space-y-5"
          >
            {dialogError && (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {dialogError}
              </p>
            )}
            {availableFields.length ? (
              <label className="block text-sm font-medium">
                Trường trong kho
                <select
                  required
                  disabled={busy}
                  className={metadataInputClass}
                  value={poolKey}
                  onChange={(event) => onPoolKeyChange(event.target.value)}
                >
                  <option value="">Chọn trường để sao chép</option>
                  {availableFields.map((field) => (
                    <option key={field.key} value={field.key}>
                      {field.label} ({field.key})
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="rounded-xl bg-[#F8FAFC] p-4 text-sm leading-6 text-[#64748B]">
                Không còn trường phù hợp để sao chép. Các trường đã có trong bộ
                hoặc đang ẩn sẽ không xuất hiện ở đây.
              </p>
            )}
            {poolKey && (
              <p className="rounded-xl bg-[#F8FAFC] p-4 text-sm leading-6 text-[#64748B]">
                {fields.find((field) => field.key === poolKey)?.description ||
                  "Trường sẽ được sao chép với cấu hình hiện tại trong kho."}
              </p>
            )}
            <p className="text-xs leading-5 text-[#64748B]">
              Sau khi sao chép, bạn có thể điều chỉnh trường trong bộ theo các
              thuộc tính được phép.
            </p>
            <div className="flex justify-end gap-2 border-t border-[#E2E8F0] pt-4">
              <Button
                type="button"
                variant="outline"
                className={metadataButtonClass}
                disabled={busy}
                onClick={() => onCloseImport()}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                className={metadataPrimaryButtonClass}
                disabled={busy || !poolKey}
              >
                {busy && <Loader2 className="size-4 animate-spin" />}Sao chép
                trường
              </Button>
            </div>
          </form>
        </MetadataDialog>
      )}
      {deleteTarget && (
        <MetadataDialog
          title={
            deleteTarget.kind === "set"
              ? "Xóa bộ metadata?"
              : deleteFromSet
                ? "Bỏ trường khỏi bộ?"
                : "Xóa trường metadata?"
          }
          description={
            deleteTarget.kind === "set"
              ? "Bộ sẽ không còn xuất hiện trong danh sách lựa chọn."
              : deleteFromSet
                ? "Trường sẽ không còn thuộc bộ metadata này."
                : "Trường tùy chỉnh sẽ được xóa khỏi kho metadata."
          }
          busy={busy}
          onClose={() => onCloseDelete()}
          className="max-w-lg"
        >
          <div className="space-y-5">
            <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <p className="font-semibold break-words">
                {deleteTarget.kind === "set"
                  ? deleteTarget.group.name
                  : deleteTarget.field.label}
              </p>
              {deleteTarget.kind === "field" && (
                <p className="mt-1 font-mono text-xs break-all text-[#64748B]">
                  {deleteTarget.field.key}
                </p>
              )}
            </div>
            <p className="text-sm leading-6 text-[#64748B]">
              {deleteTarget.kind === "set"
                ? "Tên bộ đã xóa không được dùng lại. Kết quả và cấu hình đã chốt của các session trước đó được giữ nguyên."
                : "Các kết quả trích xuất đã lưu trước đó được giữ nguyên."}
            </p>
            {dialogError && (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {dialogError}
              </p>
            )}
            <div className="flex justify-end gap-2 border-t border-[#E2E8F0] pt-4">
              <Button
                type="button"
                variant="outline"
                className={metadataButtonClass}
                disabled={busy}
                onClick={() => onCloseDelete()}
              >
                Hủy
              </Button>
              <Button
                type="button"
                className="h-10 gap-2 rounded-xl bg-red-600 px-4 font-semibold text-white hover:bg-red-700"
                disabled={busy}
                onClick={() => void onConfirmDelete()}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                {deleteTarget.kind === "set"
                  ? "Xóa bộ"
                  : deleteFromSet
                    ? "Bỏ trường"
                    : "Xóa trường"}
              </Button>
            </div>
          </div>
        </MetadataDialog>
      )}
    </>
  )
}
