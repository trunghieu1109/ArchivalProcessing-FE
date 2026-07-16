import type { SignatureTagKind } from "@/features/upload/lib/signatureStatus"
import type { PdfMetadata } from "@/features/upload/types"

export const METADATA_LABELS: Record<string, string> = {
  document: "Tài liệu",
  document_scan_issue: "Tài liệu",
  document_identifier: "Mã định danh tài liệu",
  ma_dinh_danh_tai_lieu: "Mã định danh tài liệu",
  document_storage_id: "Mã lưu trữ tài liệu",
  document_archive_code: "Mã lưu trữ tài liệu",
  ma_luu_tru_tai_lieu: "Mã lưu trữ tài liệu",
  document_summary: "Trích yếu",
  trich_yeu_tai_lieu: "Trích yếu",
  document_type: "Tên loại tài liệu",
  loai_van_ban: "Tên loại tài liệu",
  document_number: "Số hiệu",
  so_hieu_tai_lieu: "Số hiệu",
  document_number_part: "Số của tài liệu",
  so_hieu_tai_lieu_so: "Số của tài liệu",
  document_notation_part: "Ký hiệu của tài liệu",
  so_hieu_tai_lieu_hieu: "Ký hiệu của tài liệu",
  issuing_agency: "Cơ quan ban hành",
  co_quan_ban_hanh: "Cơ quan ban hành",
  issued_date: "Ngày ban hành",
  ngay_ban_hanh: "Ngày ban hành",
  language: "Ngôn ngữ",
  information_sign: "Ký hiệu thông tin",
  information_symbol: "Ký hiệu thông tin",
  keywords: "Từ khóa",
  autograph: "Bút tích",
  physical_condition: "Tình trạng vật lý",
  note: "Ghi chú",
  issued_day: "Ngày",
  issued_month: "Tháng",
  issued_year: "Năm",
  signer: "Người ký",
  nguoi_ky: "Người ký",
  "nguoi ky": "Người ký",
}

const ALL_METADATA_FIELDS = [
  {
    key: "document_identifier",
    label: METADATA_LABELS.document_identifier,
    aliases: ["document_identifier", "ma_dinh_danh_tai_lieu"],
  },
  {
    key: "document_type",
    label: METADATA_LABELS.document_type,
    aliases: ["document_type", "loai_van_ban", "loai_tai_lieu"],
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
    key: "issued_date",
    label: METADATA_LABELS.issued_date,
    aliases: ["issued_date", "ngay_ban_hanh", "ngay_thang_van_ban"],
  },
  {
    key: "issuing_agency",
    label: METADATA_LABELS.issuing_agency,
    aliases: ["issuing_agency", "co_quan_ban_hanh", "don_vi_ban_hanh"],
  },
  {
    key: "document_summary",
    label: METADATA_LABELS.document_summary,
    aliases: ["document_summary", "trich_yeu_tai_lieu", "trich_yeu"],
  },
  {
    key: "language",
    label: METADATA_LABELS.language,
    aliases: ["language", "ngon_ngu", "document_language"],
  },
  {
    key: "information_sign",
    label: METADATA_LABELS.information_sign,
    aliases: ["information_sign", "information_symbol", "ky_hieu_thong_tin"],
  },
  {
    key: "keywords",
    label: METADATA_LABELS.keywords,
    aliases: ["keywords", "tu_khoa"],
  },
  {
    key: "autograph",
    label: METADATA_LABELS.autograph,
    aliases: ["autograph", "but_tich"],
  },
  {
    key: "physical_condition",
    label: METADATA_LABELS.physical_condition,
    aliases: ["physical_condition", "tinh_trang_vat_ly"],
  },
  {
    key: "note",
    label: METADATA_LABELS.note,
    aliases: ["note", "ghi_chu"],
  },
] as const

const DEFAULT_DOCUMENT_LANGUAGE = "Tiếng Việt"

export const METADATA_FIELDS = ALL_METADATA_FIELDS

export function metadataFieldText(
  metadata: Record<string, unknown>,
  aliases: readonly string[]
): string {
  for (const alias of aliases) {
    const value = metadata[alias]
    if (!hasMetadataValue(value)) continue
    return Array.isArray(value) ? value.map(String).join(", ") : String(value)
  }
  if (aliases.includes("language")) return DEFAULT_DOCUMENT_LANGUAGE
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
  if (fieldKey === "note") return 3
  return 2
}
