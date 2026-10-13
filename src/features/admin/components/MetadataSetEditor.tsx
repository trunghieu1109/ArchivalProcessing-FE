import { useState, type FormEvent } from "react"
import { Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  metadataButtonClass,
  metadataInputClass,
  metadataPrimaryButtonClass,
} from "./metadataUi"

export interface MetadataSetDraft {
  id?: number
  name: string
  description: string
}

export function MetadataSetEditor({
  draft,
  busy,
  onChange,
  onSubmit,
}: {
  draft: MetadataSetDraft
  busy: boolean
  onChange: (draft: MetadataSetDraft | null) => void
  onSubmit: (event: FormEvent) => Promise<void>
}) {
  const [error, setError] = useState("")
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError("")
    if (!draft.name.trim()) {
      setError("Hãy nhập tên bộ metadata.")
      return
    }
    try {
      await onSubmit(event)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không thể lưu bộ metadata."
      )
    }
  }

  return (
    <form className="space-y-5" onSubmit={(event) => void submit(event)}>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <label className="block text-sm font-medium">
        Tên bộ
        <Input
          required
          maxLength={255}
          disabled={busy}
          className={metadataInputClass}
          value={draft.name}
          placeholder="Ví dụ: Tài liệu hành chính"
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
        />
      </label>
      <label className="block text-sm font-medium">
        Mô tả
        <textarea
          maxLength={1000}
          rows={3}
          disabled={busy}
          className={metadataInputClass}
          value={draft.description}
          placeholder="Mô tả nhóm tài liệu hoặc mục đích sử dụng bộ metadata."
          onChange={(event) =>
            onChange({ ...draft, description: event.target.value })
          }
        />
        <span className="mt-1 block text-right text-xs font-normal text-[#94A3B8]">
          {draft.description.length} / 1000
        </span>
      </label>
      <div className="flex justify-end gap-2 border-t border-[#E2E8F0] pt-4">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          className={metadataButtonClass}
          onClick={() => onChange(null)}
        >
          Hủy
        </Button>
        <Button
          type="submit"
          disabled={busy}
          className={metadataPrimaryButtonClass}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Lưu bộ
        </Button>
      </div>
    </form>
  )
}
