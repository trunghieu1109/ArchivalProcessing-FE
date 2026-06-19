import type { SignatureTagKind } from "@/features/upload/lib/signatureStatus"
import type { PdfMetadata } from "@/features/upload/types"

export const METADATA_LABELS: Record<string, string> = {
  document: "Tài liệu",
  document_scan_issue: "Tài liệu",
  document_summary: "Trích yếu",
  trich_yeu_tai_lieu: "Trích yếu",
  document_type: "Loại văn bản",
  loai_van_ban: "Loại văn bản",
  document_number: "Số hiệu",
  so_hieu_tai_lieu: "Số hiệu",
  issuing_agency: "Cơ quan ban hành",
  co_quan_ban_hanh: "Cơ quan ban hành",
  issued_date: "Ngày ban hành",
  ngay_ban_hanh: "Ngày ban hành",
  signer: "Người ký",
  nguoi_ky: "Người ký",
  "nguoi ky": "Người ký",
}

export const METADATA_FIELDS = [
  {
    key: "document_summary",
    label: METADATA_LABELS.document_summary,
    aliases: ["document_summary", "trich_yeu_tai_lieu", "trich_yeu"],
  },
  {
    key: "document_type",
    label: METADATA_LABELS.document_type,
    aliases: ["document_type", "loai_van_ban", "loai_tai_lieu"],
  },
  {
    key: "document_number",
    label: METADATA_LABELS.document_number,
    aliases: ["document_number", "so_hieu_tai_lieu", "so_hieu", "so_ky_hieu"],
  },
  {
    key: "issuing_agency",
    label: METADATA_LABELS.issuing_agency,
    aliases: ["issuing_agency", "co_quan_ban_hanh", "don_vi_ban_hanh"],
  },
  {
    key: "issued_date",
    label: METADATA_LABELS.issued_date,
    aliases: ["issued_date", "ngay_ban_hanh", "ngay_thang_van_ban"],
  },
  {
    key: "signer",
    label: METADATA_LABELS.signer,
    aliases: ["signer", "nguoi_ky", "nguoi ky", "nguoi_ki", "nguoi_ky_ten"],
  },
] as const

export function metadataFieldText(
  metadata: Record<string, unknown>,
  aliases: readonly string[]
): string {
  for (const alias of aliases) {
    const value = metadata[alias]
    if (!hasMetadataValue(value)) continue
    return Array.isArray(value) ? value.map(String).join(", ") : String(value)
  }
  return ""
}

export function isMetadataFailed(status: string): boolean {
  return ["failed", "final_failed", "signature_failed"].includes(status)
}

export function warningLabel(field: string): string {
  return METADATA_LABELS[field] ?? field.replace(/[_-]+/g, " ")
}

function hasMetadataValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasMetadataValue)
  if (typeof value === "string") return value.trim().length > 0
  return value !== null && value !== undefined && value !== false
}

export function signatureTagClass(kind: SignatureTagKind): string {
  if (kind === "done") {
    return "border-emerald-300 bg-emerald-50 text-emerald-700"
  }
  if (kind === "failed") {
    return "border-red-300 bg-red-50 text-red-700"
  }
  return "border-slate-300 bg-slate-50 text-slate-600"
}

export function reviewerDisplayName(item: PdfMetadata): string {
  return String(
    item.metadata_verified_by_name ||
      item.metadata_verified_by_email ||
      item.metadata_verified_by_user_id ||
      ""
  ).trim()
}

export function fieldHasWarning(
  warningFields: Set<string>,
  aliases: readonly string[]
): boolean {
  return aliases.some((alias) => warningFields.has(alias))
}

export function metadataEditorRows(fieldKey: string): number {
  if (fieldKey === "document_summary") return 4
  if (fieldKey === "issuing_agency") return 3
  return 2
}
