import {
  METADATA_FIELDS,
  METADATA_LABELS,
} from "@/features/upload/components/step3/metadataCardUtils"

type MetadataSource = Record<string, unknown> | null | undefined

export interface CustomMetadataEntry {
  key: string
  label: string
  value: string
}

const SYSTEM_FIELDS = new Set<string>([
  ...METADATA_FIELDS.flatMap((field) => [...field.aliases]),
  ...Object.keys(METADATA_LABELS),
  "loai_tai_lieu",
  "document_code",
  "archive_document_code",
  "so_hieu",
  "so_ky_hieu",
  "long_summary",
  "summary",
  "title",
  "ngay_ban_hanh_ngay",
  "ngay_tai_lieu",
  "ngay_ban_hanh_thang",
  "thang_ban_hanh",
  "thang_tai_lieu",
  "ngay_ban_hanh_nam",
  "nam_ban_hanh",
  "nam_tai_lieu",
  "mentioned_subjects",
  "doi_tuong_duoc_nhac_den",
  "chu_the_duoc_nhac_den",
  "direct_target_subject",
  "doi_tuong_huong_toi",
  "signer_name",
  "signed_by",
  "nguoi_ki",
  "nguoi_ky_ten",
  "ten_nguoi_ky",
  "signature",
  "digital_signature",
  "chu_ky",
  "chu_ki",
  "thong_tin_chu_ky",
])

const INTERNAL_FIELDS = new Set([
  "id",
  "document_id",
  "document_id_uuid",
  "session_id",
  "ocr_batch_id",
  "data_path",
  "original_path",
  "resolved_path",
  "file_path",
  "file_name",
  "path",
  "source_path",
  "page_count",
  "sheet_count",
  "source_page_count",
  "output_page_count",
  "processed_pages",
  "document_numbering_mode",
  "status",
  "ocr_status",
  "remote_metadata_status",
  "signature_status",
  "signatureStatus",
  "review_status",
  "is_reviewed",
  "metadata_ready",
  "metadata_final",
  "metadata_user_edited",
  "metadata_version_count",
  "metadata_batch_id",
  "metadata_batch_name",
  "remote_ingestion_batch_id",
  "remote_document_id",
  "remote_object_name",
  "remote_job_id",
  "error",
  "error_message",
  "scan_properties",
  "pdf_preprocessing",
  "text",
  "page_texts",
  "definition_snapshot",
  "metadata_config",
  "metadata_config_snapshot",
  "metadata_selection_config",
  "metadata_config_hash",
  "metadata_source",
  "metadata_set_id",
  "metadata_set_name",
  "metadata_bound_at",
  "metadata_selection_locked",
  "metadata_binding_error",
  "selected_fields",
  "custom_fields",
  "custom_field_definitions",
  "group_field_definitions",
  "field_labels",
  "fields",
  "loai_van_ban_options",
  "last_import_job_id",
  "import_action",
  "content_revision",
  "arrangement_status",
  "supplemental_intake_id",
  "lifecycle_status",
  "generation",
  "created_at",
  "updated_at",
  "last_polled_at",
])

/** Resolve only display data; never merge it into metadata edit requests. */
export function customMetadataEntries(
  sources: readonly MetadataSource[],
  sessionSnapshot?: MetadataSource
): CustomMetadataEntry[] {
  const records = sources.filter((source) => source != null)
  const snapshot =
    records
      .map(
        (source) =>
          asRecord(source.definition_snapshot) ??
          asRecord(source.metadata_config_snapshot)
      )
      .find((source) => source != null) ?? sessionSnapshot
  const config = asRecord(snapshot?.metadata_config) ?? snapshot
  const selected = stringKeys(config?.selected_fields)
  const custom = stringKeys(config?.custom_fields)
  const definitions = new Map<string, Record<string, unknown>>()
  for (const value of [
    snapshot?.group_field_definitions,
    config?.group_field_definitions,
    config?.custom_fields,
    config?.custom_field_definitions,
  ]) {
    if (!Array.isArray(value)) continue
    for (const definition of value) {
      const record = asRecord(definition)
      if (record && typeof record.key === "string") {
        definitions.set(record.key, {
          ...definitions.get(record.key),
          ...record,
        })
      }
    }
  }
  const hasConfiguration = Boolean(
    config &&
    (Array.isArray(config.selected_fields) ||
      Array.isArray(config.custom_fields) ||
      Array.isArray(config.custom_field_definitions) ||
      definitions.size > 0)
  )
  const keys = hasConfiguration
    ? (selected ?? [...new Set([...(custom ?? []), ...definitions.keys()])])
    : [...new Set(records.flatMap((source) => Object.keys(source)))]
  const labels = asRecord(config?.field_labels)

  return keys
    .filter((key) => {
      if (
        SYSTEM_FIELDS.has(key) ||
        key.startsWith("_") ||
        INTERNAL_FIELDS.has(key)
      ) {
        return false
      }
      if (definitions.get(key)?.kind === "system") return false
      if (hasConfiguration) return true
      return (
        !key.startsWith("metadata_verified_") &&
        !key.startsWith("metadata_batch_assigned_") &&
        records.some(
          (source) => Object.hasOwn(source, key) && hasValue(source[key])
        )
      )
    })
    .map((key) => {
      const definition = definitions.get(key)
      const source = records.find(
        (record) => Object.hasOwn(record, key) && record[key] !== undefined
      )
      return {
        key,
        label:
          text(definition?.label) ||
          text(labels?.[key]) ||
          key.replace(/[_-]+/g, " "),
        value: displayValue(source?.[key], definition?.options),
      }
    })
}

function displayValue(value: unknown, options?: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => displayValue(item, options))
      .filter(Boolean)
      .join(", ")
  }
  if (value === null || value === undefined) return ""
  if (typeof value === "boolean") return value ? "Có" : "Không"
  if (Array.isArray(options)) {
    const option = options.find((option) => {
      const record = asRecord(option)
      return record && String(record.value) === String(value)
    })
    const label = text(asRecord(option)?.label)
    if (label) return label
  }
  return typeof value === "object"
    ? JSON.stringify(value, null, 2)
    : String(value)
}

function stringKeys(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  return [
    ...new Set(
      value
        .map((item) =>
          typeof item === "string" ? item : text(asRecord(item)?.key)
        )
        .filter(Boolean)
    ),
  ]
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false
  if (Array.isArray(value)) return value.some(hasValue)
  return typeof value !== "string" || value.trim().length > 0
}
