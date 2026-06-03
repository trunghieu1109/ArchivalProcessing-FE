import { documentSignatureStatus } from "@/features/upload/lib/signatureStatus"

type MetadataSource = Record<string, unknown> | null | undefined

export interface WarningEntry {
  field: string
  message: string
}

interface DisplayMetadataSources {
  light_metadata?: MetadataSource
  normalized_metadata?: MetadataSource
  metadata?: MetadataSource
  raw_metadata?: MetadataSource
  remote_metadata_status?: string | null
  remoteMetadataStatus?: string | null
  signature_status?: string | null
  signatureStatus?: string | null
  ocr_status?: string | null
  ocrStatus?: string | null
  status?: string | null
}

const WARNING_KEY = "_warnings"
const SIGNER_METADATA_FIELD_KEYS = new Set([
  "signer",
  "signer_name",
  "signed_by",
  "nguoi_ky",
  "nguoi_ki",
  "nguoi_ky_ten",
  "ten_nguoi_ky",
])
const SIGNATURE_METADATA_FIELD_KEYS = new Set([
  "_signature",
  "signature",
  "digital_signature",
  "chu_ky",
  "chu_ki",
  "thong_tin_chu_ky",
])
const SIGNATURE_SIGNER_FIELD_KEYS = new Set([
  "signer",
  "signer_name",
  "signer_full_name",
  "signed_by",
  "nguoi_ky",
  "nguoi_ki",
  "ten_nguoi_ky",
  "name",
  "full_name",
  "display_name",
  "common_name",
  "subject",
  "subject_name",
  "subject_dn",
  "subject_common_name",
  "subject_cn",
  "certificate_subject",
  "cn",
])
const TEXT_VALUE_FIELD_KEYS = [
  "name",
  "full_name",
  "display_name",
  "common_name",
  "subject",
  "subject_name",
  "subject_dn",
  "subject_common_name",
  "subject_cn",
  "certificate_subject",
  "cn",
]
const FIELD_ALIAS_GROUPS = [
  ["document_summary", "trich_yeu_tai_lieu", "trich_yeu"],
  ["long_summary", "summary"],
  ["document_type", "loai_van_ban", "loai_tai_lieu"],
  ["document_number", "so_hieu_tai_lieu", "so_hieu", "so_ky_hieu"],
  ["issuing_agency", "co_quan_ban_hanh", "don_vi_ban_hanh"],
  ["issued_date", "ngay_ban_hanh", "ngay_thang_van_ban"],
  ["signer", "nguoi_ky", "nguoi ky", "nguoi_ki", "nguoi_ky_ten"],
  ["direct_target_subject", "doi_tuong_huong_toi"],
  ["mentioned_subjects", "doi_tuong_duoc_nhac_den", "chu_the_duoc_nhac_den"],
]

export function buildDisplayMetadata(
  sources: DisplayMetadataSources
): Record<string, unknown> {
  const base = firstMetadataSource(
    sources.light_metadata,
    sources.normalized_metadata,
    sources.metadata,
    sources.raw_metadata
  )
  const metadata = { ...base }
  const warnings = firstWarningValue(
    sources.light_metadata,
    sources.raw_metadata,
    sources.normalized_metadata,
    sources.metadata
  )
  if (warnings !== undefined) {
    metadata[WARNING_KEY] = warnings
  }
  if (!hasResolvedFieldValue(metadata, "signer") && documentSignatureStatus(sources) === "done") {
    const signer = firstSignerValue(
      sources.light_metadata,
      sources.normalized_metadata,
      sources.metadata,
      sources.raw_metadata
    )
    if (signer) {
      metadata.signer = signer
    }
  }
  return metadata
}

export function getWarningFields(meta: Record<string, unknown>): Set<string> {
  return new Set(
    getWarningEntries(meta)
      .map((warning) => warning.field)
      .filter(Boolean)
  )
}

export function getWarningEntries(meta: Record<string, unknown>): WarningEntry[] {
  const warnings = meta[WARNING_KEY]
  if (Array.isArray(warnings)) {
    return warnings
      .map((warning, index) => warningEntryFromArrayItem(warning, index, meta))
      .filter((warning): warning is WarningEntry => Boolean(warning))
  }
  if (isRecord(warnings)) {
    return Object.entries(warnings)
      .map(([field, value]) => warningEntryFromField(field, value, meta))
      .filter((warning): warning is WarningEntry => Boolean(warning))
  }
  if (typeof warnings === "string" && warnings.trim()) {
    return [{ field: "", message: warnings.trim() }]
  }
  return []
}

export function hasMetadataWarning(item: {
  review_status: string
  light_metadata: Record<string, unknown>
}): boolean {
  if (getWarningEntries(item.light_metadata).length > 0) return true
  if (WARNING_KEY in item.light_metadata) return false
  return item.review_status === "warning"
}

function firstMetadataSource(
  ...sources: MetadataSource[]
): Record<string, unknown> {
  for (const source of sources) {
    if (!isRecord(source)) continue
    if (Object.keys(source).some((key) => key !== WARNING_KEY)) {
      return source
    }
  }
  return {}
}

function firstWarningValue(...sources: MetadataSource[]): unknown {
  let emptyWarningValue: unknown
  for (const source of sources) {
    if (!isRecord(source) || !(WARNING_KEY in source)) continue
    const warnings = source[WARNING_KEY]
    if (hasWarningContent(warnings)) return warnings
    emptyWarningValue ??= warnings
  }
  return emptyWarningValue
}

function firstSignerValue(...sources: MetadataSource[]): string {
  for (const source of sources) {
    if (!isRecord(source)) continue
    const signer = signerFromMetadataFields(source)
    if (signer) return signer
  }
  for (const source of sources) {
    if (!isRecord(source)) continue
    for (const [key, value] of Object.entries(source)) {
      if (!SIGNATURE_METADATA_FIELD_KEYS.has(normalizeFieldName(key))) continue
      const signer = signerFromSignaturePayload(value)
      if (signer) return signer
    }
  }
  return ""
}

function signerFromMetadataFields(meta: Record<string, unknown>): string {
  for (const [key, value] of Object.entries(meta)) {
    if (!SIGNER_METADATA_FIELD_KEYS.has(normalizeFieldName(key))) continue
    const signer = metadataTextValue(value)
    if (signer) return signer
  }
  return ""
}

function signerFromSignaturePayload(value: unknown): string {
  if (Array.isArray(value)) {
    for (const item of value) {
      const signer = signerFromSignaturePayload(item)
      if (signer) return signer
    }
    return ""
  }
  if (!isRecord(value)) return ""

  for (const [key, itemValue] of Object.entries(value)) {
    if (!SIGNATURE_SIGNER_FIELD_KEYS.has(normalizeFieldName(key))) continue
    const signer = metadataTextValue(itemValue)
    if (signer) return signer
  }
  for (const [key, itemValue] of Object.entries(value)) {
    if (SIGNATURE_SIGNER_FIELD_KEYS.has(normalizeFieldName(key))) continue
    const signer = signerFromSignaturePayload(itemValue)
    if (signer) return signer
  }
  return ""
}

function metadataTextValue(value: unknown): string {
  if (typeof value === "string") return cleanSignerText(value)
  if (typeof value === "number") return String(value)
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = metadataTextValue(item)
      if (text) return text
    }
    return ""
  }
  if (isRecord(value)) {
    for (const key of TEXT_VALUE_FIELD_KEYS) {
      const text = metadataTextValue(value[key])
      if (text) return text
    }
  }
  return ""
}

function cleanSignerText(value: string): string {
  const text = value.trim()
  if (!hasTextContent(text)) return ""
  for (const part of text.split(",")) {
    const [key, ...rawValueParts] = part.split("=")
    if (key?.trim().toLowerCase() !== "cn") continue
    const commonName = rawValueParts.join("=").trim()
    if (commonName) return commonName
  }
  return text
}

function hasWarningContent(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0
  if (isRecord(value)) return Object.keys(value).length > 0
  if (typeof value === "string") return hasTextContent(value)
  return Boolean(value)
}

function warningEntryFromArrayItem(
  value: unknown,
  index: number,
  meta: Record<string, unknown>
): WarningEntry | null {
  if (typeof value === "string") {
    const field = value.trim()
    return hasResolvedFieldValue(meta, field) ? null : { field, message: "" }
  }
  if (isRecord(value)) {
    const field = stringValue(value.field ?? value.key ?? value.name)
    return warningEntryFromField(field || `warning_${index + 1}`, value, meta)
  }
  return { field: "", message: warningMessage(value) }
}

function warningEntryFromField(
  field: string,
  value: unknown,
  meta: Record<string, unknown>
): WarningEntry | null {
  if (!isRecord(value)) {
    if (!hasWarningContent(value)) return null
    if (hasResolvedFieldValue(meta, field) && isMissingValue(value)) return null
    return { field, message: warningMessage(value) }
  }

  const warningField = stringValue(value.field ?? value.key ?? value.name) || field
  const status = stringValue(value.status).toLowerCase()
  const warningPayload = value.warnings ?? value.warning ?? value.message ?? value.reason
  const hasPayload = hasWarningContent(warningPayload)

  if (isOkStatus(status) && !hasPayload) return null
  if (isMissingStatus(status) && hasResolvedFieldValue(meta, warningField)) {
    return null
  }

  const message = warningMessage(warningPayload) || status || warningMessage(value)
  if (!message && !warningField) return null
  return { field: warningField, message }
}

function warningMessage(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return hasTextContent(value) ? value.trim() : ""
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) {
    return value.map(warningMessage).filter(Boolean).join(", ")
  }
  if (isRecord(value)) {
    const direct = value.message ?? value.reason ?? value.warning
    if (direct !== undefined) return warningMessage(direct)
    return Object.entries(value)
      .map(([key, entryValue]) => `${key}: ${warningMessage(entryValue)}`)
      .join(", ")
  }
  return String(value)
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function hasTextContent(value: string): boolean {
  return value.replace(/[,\s;|]+/g, "").length > 0
}

function isOkStatus(status: string): boolean {
  return ["ok", "valid", "verified", "success", "passed"].includes(status)
}

function isMissingStatus(status: string): boolean {
  return ["missing", "empty", "not_found", "not found"].includes(status)
}

function isMissingValue(value: unknown): boolean {
  if (typeof value === "string") {
    return ["missing", "empty", "not_found", "notfound"].includes(
      normalizeFieldName(value)
    )
  }
  if (Array.isArray(value)) {
    return value.every(isMissingValue)
  }
  return false
}

function hasResolvedFieldValue(
  meta: Record<string, unknown>,
  field: string
): boolean {
  if (!field) return false
  return fieldAliases(field).some((alias) => hasDisplayValue(meta[alias]))
}

function fieldAliases(field: string): string[] {
  const normalized = normalizeFieldName(field)
  return (
    FIELD_ALIAS_GROUPS.find((group) =>
      group.some((alias) => normalizeFieldName(alias) === normalized)
    ) ?? [field]
  )
}

function normalizeFieldName(field: string): string {
  const rawText = field.trim().toLowerCase()
  const prefix = rawText.startsWith("_") ? "_" : ""
  const normalized = rawText
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .split("_")
    .filter(Boolean)
    .join("_")
  return `${prefix}${normalized}`
}

function hasDisplayValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasDisplayValue)
  if (typeof value === "string") return value.trim().length > 0
  if (isRecord(value)) return Object.keys(value).length > 0
  return value !== null && value !== undefined && value !== false
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
