import { useCallback, useEffect, useRef, useState } from "react"
import {
  getDefaultMetadataConfig,
  listMetadataSets,
  updateSessionMetadataSelection,
  type DefaultMetadataConfig,
  type MetadataSet,
} from "@/features/admin/api/metadataApi"
import { DYNAMIC_METADATA_ENABLED } from "@/shared/config/featureFlags"
import type { SessionMetadataValues } from "../SessionMetadataBar"

interface Props {
  sessionId?: string | null
  metadata?: SessionMetadataValues
  disabled: boolean
  readOnly: boolean
  onChange?: (metadata: SessionMetadataValues) => void
}

export function MetadataSetSelector({
  sessionId,
  metadata,
  disabled,
  readOnly,
  onChange,
}: Props) {
  const [sets, setSets] = useState<MetadataSet[]>([])
  const [defaults, setDefaults] = useState<DefaultMetadataConfig | null>(null)
  const [loading, setLoading] = useState(
    !readOnly && metadata?.metadata_selection_locked !== true
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const loadSequence = useRef(0)
  const locked = readOnly || metadata?.metadata_selection_locked === true
  const value =
    metadata?.metadata_source === "default"
      ? "default"
      : metadata?.metadata_source === "set" && metadata.metadata_set_id
        ? String(metadata.metadata_set_id)
        : ""
  const selected = sets.find((group) => String(group.id) === value)
  const preview = value === "default" ? defaults?.fields : selected?.fields

  const load = useCallback(async () => {
    if (!DYNAMIC_METADATA_ENABLED || locked) return
    const sequence = ++loadSequence.current
    setLoading(true)
    setError("")
    try {
      const [groups, config] = await Promise.all([
        listMetadataSets(),
        getDefaultMetadataConfig(),
      ])
      if (!Array.isArray(groups) || !Array.isArray(config.fields))
        throw new Error("API metadata trả cấu hình không hợp lệ.")
      if (sequence !== loadSequence.current) return
      setSets(groups)
      setDefaults(config)
    } catch (err) {
      if (sequence === loadSequence.current)
        setError(
          err instanceof Error ? err.message : "Không thể tải bộ metadata."
        )
    } finally {
      if (sequence === loadSequence.current) setLoading(false)
    }
  }, [locked])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => {
      window.clearTimeout(timer)
      loadSequence.current += 1
    }
  }, [load])

  const select = async (next: string) => {
    if (!DYNAMIC_METADATA_ENABLED || !onChange || locked) return
    setError("")
    const source = next === "default" ? "default" : next ? "set" : undefined
    const setId = source === "set" ? Number(next) : null
    const name =
      source === "default"
        ? "Mặc định — 6 trường hệ thống"
        : (sets.find((group) => group.id === setId)?.name ?? null)
    if (sessionId && source) {
      setSaving(true)
      try {
        const updated = await updateSessionMetadataSelection(
          sessionId,
          source,
          setId
        )
        onChange({ ...metadata, ...updated })
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Không thể đổi bộ metadata."
        )
      } finally {
        setSaving(false)
      }
    } else
      onChange({
        ...metadata,
        metadata_source: source,
        metadata_set_id: setId,
        metadata_set_name: name,
      })
  }

  if (!DYNAMIC_METADATA_ENABLED) return null

  return (
    <div className="mb-5 rounded-xl border border-[#D8E1EC] bg-slate-50 p-4">
      <label className="block text-sm font-semibold">
        Bộ metadata{!locked && <span className="ml-1 text-red-500">*</span>}
        {locked ? (
          <span className="mt-2 block text-sm font-normal">
            {metadata?.metadata_set_name ||
              (metadata?.metadata_source === "legacy" ||
              !metadata?.metadata_source
                ? "Cấu hình hiện tại của session"
                : "Bộ đã chọn")}
          </span>
        ) : (
          <select
            required
            aria-label="Bộ metadata"
            disabled={disabled || loading || saving}
            value={value}
            onChange={(event) => void select(event.target.value)}
            className="mt-2 h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm font-normal outline-none focus:border-[#0052FF] disabled:bg-slate-100"
          >
            <option value="">Chọn bộ metadata</option>
            <option value="default">Mặc định — 6 trường hệ thống</option>
            {sets.map((group) => (
              <option
                key={group.id}
                value={group.id}
                disabled={group.field_keys.length === 0}
              >
                {group.name} ({group.field_keys.length} trường)
                {group.field_keys.length === 0 ? " — Chưa có trường" : ""}
              </option>
            ))}
          </select>
        )}
      </label>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
      {metadata?.metadata_binding_error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {metadata.metadata_binding_error}
        </p>
      )}
      {preview?.length ? (
        <p className="mt-2 text-xs leading-5 text-slate-500">
          {preview.map((field) => field.label).join(" · ")}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-slate-500">
        {locked
          ? "Cấu hình đã gắn với session; upload bổ sung và retry dùng cấu hình đã chốt."
          : loading
            ? "Đang tải các bộ metadata…"
            : saving
              ? "Đang lưu lựa chọn…"
              : "Bộ metadata được chốt khi upload đầu tiên. Thay đổi bộ sau đó không ảnh hưởng session này."}
      </p>
      {!locked && (
        <div className="mt-3 flex gap-4 text-xs font-semibold text-[#0052FF]">
          <button
            type="button"
            disabled={loading || saving || disabled}
            onClick={() => void load()}
          >
            Tải lại danh sách
          </button>
          <a href="/admin/metadata" target="_blank" rel="noopener noreferrer">
            Quản lý bộ metadata
          </a>
        </div>
      )}
    </div>
  )
}
