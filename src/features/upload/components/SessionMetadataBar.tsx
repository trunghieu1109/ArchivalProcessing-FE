import { useEffect, useState } from "react"
import type { KeyboardEvent, ReactNode } from "react"
import { Archive, BookOpenText, Loader2, Pencil } from "lucide-react"
import { cn } from "@/shared/lib/utils"

export interface SessionMetadataValues {
  archive_name?: string | null
  fonds_name?: string | null
}

interface SessionMetadataBarProps {
  sessionId: string | null
  metadata: SessionMetadataValues
  onSave: (metadata: SessionMetadataValues) => Promise<void>
  className?: string
}

type MetadataField = "archive_name" | "fonds_name"

export function SessionMetadataBar({
  sessionId,
  metadata,
  onSave,
  className,
}: SessionMetadataBarProps) {
  const currentArchiveName = normalizeText(metadata.archive_name)
  const currentFondsName = normalizeText(metadata.fonds_name)
  const [archiveName, setArchiveName] = useState(currentArchiveName)
  const [fondsName, setFondsName] = useState(currentFondsName)
  const [editingField, setEditingField] = useState<MetadataField | null>(null)
  const [savingField, setSavingField] = useState<MetadataField | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    setArchiveName(currentArchiveName)
    setFondsName(currentFondsName)
    setError("")
  }, [currentArchiveName, currentFondsName, sessionId])

  const startEditing = (field: MetadataField) => {
    if (!sessionId || savingField) return
    if (field === "archive_name") setArchiveName(currentArchiveName)
    if (field === "fonds_name") setFondsName(currentFondsName)
    setError("")
    setEditingField(field)
  }

  const cancelEditing = (field: MetadataField) => {
    if (field === "archive_name") setArchiveName(currentArchiveName)
    if (field === "fonds_name") setFondsName(currentFondsName)
    setEditingField(null)
  }

  const saveField = async (field: MetadataField) => {
    if (!sessionId || savingField) return
    const nextArchiveName = archiveName.trim()
    const nextFondsName = fondsName.trim()
    const changed =
      field === "archive_name"
        ? nextArchiveName !== currentArchiveName
        : nextFondsName !== currentFondsName

    setEditingField(null)
    if (!changed) return

    setSavingField(field)
    setError("")
    try {
      await onSave({
        archive_name: textOrNull(nextArchiveName),
        fonds_name: textOrNull(nextFondsName),
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

  const fallbackValue = sessionId ?? "Chưa có thông tin"

  return (
    <div className={cn("grid w-full gap-5 px-1 sm:grid-cols-2", className)}>
      <InlineMetadataField
        label="Kho lưu trữ"
        icon={<Archive className="size-3.5" />}
        value={currentArchiveName || fallbackValue}
        draftValue={archiveName}
        emptyValue={!currentArchiveName}
        editing={editingField === "archive_name"}
        saving={savingField === "archive_name"}
        disabled={!sessionId || Boolean(savingField)}
        onStartEditing={() => startEditing("archive_name")}
        onChange={setArchiveName}
        onBlur={() => void saveField("archive_name")}
        onKeyDown={(event) => handleKeyDown(event, "archive_name")}
      />

      <InlineMetadataField
        label="Phông tài liệu"
        icon={<BookOpenText className="size-3.5" />}
        value={currentFondsName || fallbackValue}
        draftValue={fondsName}
        emptyValue={!currentFondsName}
        editing={editingField === "fonds_name"}
        saving={savingField === "fonds_name"}
        disabled={!sessionId || Boolean(savingField)}
        onStartEditing={() => startEditing("fonds_name")}
        onChange={setFondsName}
        onBlur={() => void saveField("fonds_name")}
        onKeyDown={(event) => handleKeyDown(event, "fonds_name")}
      />

      {error && (
        <p className="text-xs font-medium text-red-600 sm:col-span-2">{error}</p>
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
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#64748B]">
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
          className="mt-1 h-9 w-full border-0 border-b border-[#0052FF] bg-transparent px-0 text-xl font-semibold text-[#0F172A] outline-none"
          aria-label={label}
        />
      ) : (
        <button
          type="button"
          onClick={onStartEditing}
          disabled={disabled}
          className="group mt-1 flex min-h-8 max-w-full items-start gap-2 text-left disabled:cursor-default"
          title={`Chỉnh sửa ${label.toLowerCase()}`}
        >
          <span
            className={cn(
              "min-w-0 text-xl leading-7 font-semibold break-words whitespace-normal transition-colors [overflow-wrap:anywhere] group-hover:text-[#0052FF]",
              emptyValue ? "text-[#64748B]" : "text-[#0F172A]"
            )}
          >
            {value}
          </span>
          {saving ? (
            <Loader2 className="mt-1.5 size-4 shrink-0 animate-spin text-[#0052FF]" />
          ) : (
            <Pencil className="mt-2 size-3.5 shrink-0 text-[#94A3B8] opacity-0 transition-opacity group-hover:opacity-100" />
          )}
        </button>
      )}
    </div>
  )
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim()
}

function textOrNull(value: string): string | null {
  const text = value.trim()
  return text || null
}
