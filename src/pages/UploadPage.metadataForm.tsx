import { useEffect, useState, type FormEvent } from "react"
import { Loader2, Save } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/shared/lib/utils"
import type { SessionMetadataValues } from "@/features/upload/components/SessionMetadataBar"

export function UploadSessionMetadataForm({
  sessionId,
  metadata,
  onSave,
  readOnly,
  className,
}: {
  sessionId: string | null
  metadata: SessionMetadataValues
  onSave: (metadata: SessionMetadataValues) => Promise<void>
  readOnly: boolean
  className?: string
}) {
  const [draft, setDraft] = useState<SessionMetadataValues>(() =>
    normalizeSessionMetadataDraft(metadata)
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDraft(normalizeSessionMetadataDraft(metadata))
  }, [
    metadata.archive_code,
    metadata.archive_name,
    metadata.fonds_creator_code,
    metadata.fonds_name,
    sessionId,
  ])

  const updateDraft = (field: keyof SessionMetadataValues, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!sessionId || readOnly || saving) return
    setSaving(true)
    try {
      await onSave({
        archive_name: textOrNull(draft.archive_name),
        archive_code: textOrNull(draft.archive_code),
        fonds_name: textOrNull(draft.fonds_name),
        fonds_creator_code: textOrNull(draft.fonds_creator_code),
      })
      toast.success("Đã lưu thông tin kho/phông.")
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Không thể lưu thông tin kho/phông."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "rounded-2xl border border-[#D8E1EC] bg-white px-4 py-4 shadow-sm sm:px-5",
        className
      )}
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#0F172A]">
            Thông tin đơn vị lưu trữ / phông
          </p>
          <p className="mt-1 text-xs text-[#64748B]">
            Nhập các thông tin nền cho session trước khi xử lý hồ sơ.
          </p>
        </div>
        {!readOnly && (
          <button
            type="submit"
            disabled={!sessionId || saving}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#0052FF] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0047D9] disabled:cursor-not-allowed disabled:bg-[#CBD5E1] disabled:text-[#475569]"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Lưu thông tin
          </button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <UploadMetadataInput
          label="Tên đơn vị lưu trữ"
          value={draft.archive_name ?? ""}
          disabled={readOnly || saving}
          onChange={(value) => updateDraft("archive_name", value)}
        />
        <UploadMetadataInput
          label="Mã đơn vị lưu trữ"
          value={draft.archive_code ?? ""}
          disabled={readOnly || saving}
          onChange={(value) => updateDraft("archive_code", value)}
        />
        <UploadMetadataInput
          label="Tên phông"
          value={draft.fonds_name ?? ""}
          disabled={readOnly || saving}
          onChange={(value) => updateDraft("fonds_name", value)}
        />
        <UploadMetadataInput
          label="Mã đơn vị hình thành phông"
          value={draft.fonds_creator_code ?? ""}
          disabled={readOnly || saving}
          onChange={(value) => updateDraft("fonds_creator_code", value)}
        />
      </div>
    </form>
  )
}

function UploadMetadataInput({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-semibold tracking-[0.08em] text-[#64748B] uppercase">
        {label}
      </span>
      <input
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Chưa nhập"
        className="mt-1 h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm font-medium text-[#0F172A] transition-colors outline-none placeholder:text-[#94A3B8] focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/10 disabled:bg-[#F1F5F9] disabled:text-[#64748B]"
      />
    </label>
  )
}

export function normalizeSessionMetadataDraft(
  metadata: SessionMetadataValues
): SessionMetadataValues {
  return {
    archive_name: normalizeDraftText(metadata.archive_name),
    archive_code: normalizeDraftText(metadata.archive_code),
    fonds_name: normalizeDraftText(metadata.fonds_name),
    fonds_creator_code: normalizeDraftText(metadata.fonds_creator_code),
  }
}

function normalizeDraftText(value: unknown): string {
  return String(value ?? "").trim()
}

export function textOrNull(value: unknown): string | null {
  const text = String(value ?? "").trim()
  return text || null
}
