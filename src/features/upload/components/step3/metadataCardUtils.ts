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
  document_number_part: "Số của tài liệu",
  so_hieu_tai_lieu_so: "Số của tài liệu",
  document_notation_part: "Hiệu của tài liệu",
  so_hieu_tai_lieu_hieu: "Hiệu của tài liệu",
  issuing_agency: "Cơ quan ban hành",
  co_quan_ban_hanh: "Cơ quan ban hành",
  issued_date: "Ngày ban hành",
  ngay_ban_hanh: "Ngày ban hành",
  issued_day: "Ngày",
  issued_month: "Tháng",
  issued_year: "Năm",
  signer: "Người ký",
  nguoi_ky: "Người ký",
  "nguoi ky": "Người ký",
}

const HIDDEN_METADATA_FIELD_KEYS = new Set([
  "document_number",
  "issued_day",
  "issued_month",
  "issued_year",
])

const ALL_METADATA_FIELDS = [
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
    key: "document_number_part",
    label: METADATA_LABELS.document_number_part,
    aliases: [
      "document_number_part",
      "document_number_value",
      "so_hieu_tai_lieu_so",
      "so_cua_tai_lieu",
      "so_van_ban",
    ],
  },
  {
    key: "document_notation_part",
    label: METADATA_LABELS.document_notation_part,
    aliases: [
      "document_notation_part",
      "document_notation",
      "document_symbol",
      "so_hieu_tai_lieu_hieu",
      "ky_hieu_tai_lieu",
      "ky_hieu_van_ban",
      "hieu_tai_lieu",
      "hieu_van_ban",
      "hieu_cua_tai_lieu",
    ],
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
    key: "issued_day",
    label: METADATA_LABELS.issued_day,
    aliases: ["issued_day", "ngay_ban_hanh_ngay", "ngay_tai_lieu"],
  },
  {
    key: "issued_month",
    label: METADATA_LABELS.issued_month,
    aliases: [
      "issued_month",
      "ngay_ban_hanh_thang",
      "thang_ban_hanh",
      "thang_tai_lieu",
    ],
  },
  {
    key: "issued_year",
    label: METADATA_LABELS.issued_year,
    aliases: [
      "issued_year",
      "ngay_ban_hanh_nam",
      "nam_ban_hanh",
      "nam_tai_lieu",
    ],
  },
  {
    key: "signer",
    label: METADATA_LABELS.signer,
    aliases: ["signer", "nguoi_ky", "nguoi ky", "nguoi_ki", "nguoi_ky_ten"],
  },
] as const

export const METADATA_FIELDS = ALL_METADATA_FIELDS.filter(
  (field) => !HIDDEN_METADATA_FIELD_KEYS.has(field.key)
)

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
  return [
    "failed",
    "final_failed",
    "signature_failed",
    "skipped",
    "cancelled",
    "missing_task",
  ].includes(status)
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
