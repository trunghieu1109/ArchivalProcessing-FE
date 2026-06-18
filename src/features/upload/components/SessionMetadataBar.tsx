import { useEffect, useState } from "react"
import type { KeyboardEvent, ReactNode } from "react"
import {
  Archive,
  BookOpenText,
  Building2,
  Hash,
  Loader2,
  Pencil,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"

export interface SessionMetadataValues {
  archive_name?: string | null
  archive_code?: string | null
  fonds_name?: string | null
  fonds_creator_code?: string | null
}

interface SessionMetadataBarProps {
  sessionId: string | null
  metadata: SessionMetadataValues
  onSave: (metadata: SessionMetadataValues) => Promise<void>
  readOnly?: boolean
  className?: string
}

type MetadataField =
  | "archive_name"
  | "archive_code"
  | "fonds_name"
  | "fonds_creator_code"

const METADATA_FIELDS: Array<{
  field: MetadataField
  label: string
  icon: ReactNode
}> = [
  {
    field: "archive_name",
    label: "Tên đơn vị lưu trữ",
    icon: <Archive className="size-3.5" />,
  },
  {
    field: "archive_code",
    label: "Mã đơn vị lưu trữ",
    icon: <Hash className="size-3.5" />,
  },
  {
    field: "fonds_name",
    label: "Tên phông",
    icon: <BookOpenText className="size-3.5" />,
  },
  {
    field: "fonds_creator_code",
    label: "Mã đơn vị hình thành phông",
    icon: <Building2 className="size-3.5" />,
  },
]

export function SessionMetadataBar({
  sessionId,
  metadata,
  onSave,
  readOnly = false,
  className,
}: SessionMetadataBarProps) {
  const currentValues = metadataValues(metadata)
  const [drafts, setDrafts] = useState(currentValues)
  const [editingField, setEditingField] = useState<MetadataField | null>(null)
  const [savingField, setSavingField] = useState<MetadataField | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    setDrafts(currentValues)
    setError("")
  }, [
    currentValues.archive_code,
    currentValues.archive_name,
    currentValues.fonds_creator_code,
    currentValues.fonds_name,
    sessionId,
  ])

  const startEditing = (field: MetadataField) => {
    if (readOnly || !sessionId || savingField) return
    setDrafts((current) => ({
      ...current,
      [field]: currentValues[field],
    }))
    setError("")
    setEditingField(field)
  }

  const cancelEditing = (field: MetadataField) => {
    setDrafts((current) => ({
      ...current,
      [field]: currentValues[field],
    }))
    setEditingField(null)
  }

  const saveField = async (field: MetadataField) => {
    if (!sessionId || savingField) return
    const nextValue = drafts[field].trim()
    setEditingField(null)
    if (nextValue === currentValues[field]) return

    setSavingField(field)
    setError("")
    try {
      await onSave({
        archive_name: textOrNull(drafts.archive_name),
        archive_code: textOrNull(drafts.archive_code),
        fonds_name: textOrNull(drafts.fonds_name),
        fonds_creator_code: textOrNull(drafts.fonds_creator_code),
      })
    } catch (err) {
      cancelEditing(field)
      setError(err instanceof Error ? err.message : "Không thể lưu thông tin.")
    } finally {
      setSavingField(null)
    }
  }

  const handleKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    field: MetadataField
  ) => {
    if (event.key === "Enter") {
      event.preventDefault()
      event.currentTarget.blur()
    }
    if (event.key === "Escape") {
      event.preventDefault()
      cancelEditing(field)
    }
  }

  return (
    <div
      className={cn(
        "grid w-full gap-x-6 gap-y-4 px-1 sm:grid-cols-2 xl:grid-cols-4",
        className
      )}
    >
      {METADATA_FIELDS.map(({ field, label, icon }) => (
        <InlineMetadataField
          key={field}
          label={label}
          icon={icon}
          value={currentValues[field] || "Chưa nhập"}
          draftValue={drafts[field]}
          emptyValue={!currentValues[field]}
          editing={editingField === field}
          saving={savingField === field}
          disabled={readOnly || !sessionId || Boolean(savingField)}
          onStartEditing={() => startEditing(field)}
          onChange={(value) =>
            setDrafts((current) => ({ ...current, [field]: value }))
          }
          onBlur={() => void saveField(field)}
          onKeyDown={(event) => handleKeyDown(event, field)}
        />
      ))}

      {error && (
        <p className="text-xs font-medium text-red-600 sm:col-span-2 xl:col-span-4">
          {error}
        </p>
      )}
    </div>
  )
}

function InlineMetadataField({
  label,
  icon,
  value,
  draftValue,
  emptyValue,
  editing,
  saving,
  disabled,
  onStartEditing,
  onChange,
  onBlur,
  onKeyDown,
}: {
  label: string
  icon: ReactNode
  value: string
  draftValue: string
  emptyValue: boolean
  editing: boolean
  saving: boolean
  disabled: boolean
  onStartEditing: () => void
  onChange: (value: string) => void
  onBlur: () => void
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.12em] text-[#64748B] uppercase">
        {icon}
        {label}
      </p>
      {editing ? (
        <input
          autoFocus
          value={draftValue}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          className="mt-1 h-9 w-full border-0 border-b border-[#0052FF] bg-transparent px-0 text-base font-semibold text-[#0F172A] outline-none"
          aria-label={label}
        />
      ) : (
        <button
          type="button"
          onClick={onStartEditing}
          disabled={disabled}
          className="group mt-1 flex min-h-8 max-w-full items-start gap-2 text-left disabled:cursor-default"
          title={disabled ? label : `Chỉnh sửa ${label.toLowerCase()}`}
        >
          <span
            className={cn(
              "min-w-0 text-base leading-6 font-semibold break-words whitespace-normal transition-colors [overflow-wrap:anywhere] group-hover:text-[#0052FF]",
              emptyValue ? "text-[#64748B]" : "text-[#0F172A]"
            )}
          >
            {value}
          </span>
          {saving ? (
            <Loader2 className="mt-1 size-4 shrink-0 animate-spin text-[#0052FF]" />
          ) : (
            <Pencil className="mt-1.5 size-3.5 shrink-0 text-[#94A3B8] opacity-0 transition-opacity group-hover:opacity-100" />
          )}
        </button>
      )}
    </div>
  )
}

function metadataValues(
  metadata: SessionMetadataValues
): Record<MetadataField, string> {
  return {
    archive_name: normalizeText(metadata.archive_name),
    archive_code: normalizeText(metadata.archive_code),
    fonds_name: normalizeText(metadata.fonds_name),
    fonds_creator_code: normalizeText(metadata.fonds_creator_code),
  }
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim()
}

function textOrNull(value: string): string | null {
  const text = value.trim()
  return text || null
}
