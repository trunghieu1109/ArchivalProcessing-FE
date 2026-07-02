import type { DocumentPreviewTarget } from "@/features/upload/components/DocumentPdfPreview"
import type {
  SessionDossierPatchPayload,
  SessionDossierSummary,
  ClusterVersionResponse,
} from "@/features/upload/api/sessionApi"
import type {
  ClusterDocument,
  ClusterGroup,
} from "@/features/upload/lib/clusterGroups"
import type { SignatureTagKind } from "@/features/upload/lib/signatureStatus"

export const UNKNOWN_YEAR_LABEL = "Không rõ năm"
export interface DossierMetadataDraft {
  archiveName: string
  fondsName: string
  inventoryNumber: string
  boxNumber: string
  dossierNumber: string
  informationSign: string
  title: string
  annotation: string
  startDate: string
  endDate: string
  language: string
  sheetCount: string
  pageCount: string
  retentionPeriod: string
  usageMode: string
  physicalCondition: string
  note: string
}

type DossierMetadataDraftKey = keyof DossierMetadataDraft

export const DOSSIER_METADATA_EDIT_FIELDS: Array<{
  key: DossierMetadataDraftKey
  label: string
  rows: number
}> = [
  { key: "archiveName", label: "Tên kho lưu trữ", rows: 1 },
  { key: "fondsName", label: "Tên phông", rows: 1 },
  { key: "inventoryNumber", label: "Mục lục số", rows: 1 },
  { key: "boxNumber", label: "Hộp số", rows: 1 },
  { key: "dossierNumber", label: "Hồ sơ số", rows: 1 },
  { key: "informationSign", label: "Ký hiệu thông tin", rows: 1 },
  { key: "title", label: "Tiêu đề hồ sơ", rows: 4 },
  { key: "annotation", label: "Chú giải", rows: 2 },
  { key: "startDate", label: "Thời gian bắt đầu", rows: 1 },
  { key: "endDate", label: "Thời gian kết thúc", rows: 1 },
  { key: "language", label: "Ngôn ngữ", rows: 1 },
  { key: "sheetCount", label: "Số lượng tờ", rows: 1 },
  { key: "pageCount", label: "Số lượng trang", rows: 1 },
  { key: "retentionPeriod", label: "Thời hạn bảo quản", rows: 2 },
  { key: "usageMode", label: "Chế độ sử dụng", rows: 1 },
  { key: "physicalCondition", label: "Tình trạng vật lý", rows: 2 },
  { key: "note", label: "Ghi chú", rows: 2 },
]

export function createDossierMetadataDraft(
  group: ClusterGroup | null | undefined
): DossierMetadataDraft {
  return {
    archiveName: group?.archiveName ?? "",
    fondsName: group?.fondsName ?? "",
    inventoryNumber: group?.inventoryNumber ?? "",
    boxNumber: group?.boxNumber ?? "",
    dossierNumber: group?.dossierNumber ?? "",
    informationSign: group?.informationSign ?? "",
    title: group?.label ?? "",
    annotation: group?.annotation ?? "",
    startDate: group?.startDate ?? "",
    endDate: group?.endDate ?? "",
    language: group?.language ?? "",
    sheetCount:
      typeof group?.sheetCount === "number" ? String(group.sheetCount) : "",
    pageCount:
      typeof group?.pageCount === "number" ? String(group.pageCount) : "",
    retentionPeriod: group?.retentionPeriod ?? "",
    usageMode: group?.usageMode ?? "",
    physicalCondition: group?.physicalCondition ?? "",
    note: group?.note ?? "",
  }
}

export function dossierPatchPayloadFromDraft(
  draft: DossierMetadataDraft,
  dirtyFields?: ReadonlySet<keyof DossierMetadataDraft>
): SessionDossierPatchPayload {
  const payloadByField: Record<
    keyof DossierMetadataDraft,
    [keyof SessionDossierPatchPayload, string | number | null]
  > = {
    archiveName: ["archive_name", trimmedOrNull(draft.archiveName)],
    fondsName: ["fonds_name", trimmedOrNull(draft.fondsName)],
    inventoryNumber: ["inventory_number", trimmedOrNull(draft.inventoryNumber)],
    boxNumber: ["box_number", trimmedOrNull(draft.boxNumber)],
    dossierNumber: ["dossier_number", trimmedOrNull(draft.dossierNumber)],
    informationSign: ["information_sign", trimmedOrNull(draft.informationSign)],
    title: ["title", trimmedOrNull(draft.title)],
    annotation: ["annotation", trimmedOrNull(draft.annotation)],
    startDate: ["start_date", trimmedOrNull(draft.startDate)],
    endDate: ["end_date", trimmedOrNull(draft.endDate)],
    language: ["language", trimmedOrNull(draft.language)],
    sheetCount: ["sheet_count", normalizedCountOrNull(draft.sheetCount)],
    pageCount: ["page_count", normalizedCountOrNull(draft.pageCount)],
    retentionPeriod: [
      "retention_period",
      trimmedOrNull(draft.retentionPeriod),
    ],
    usageMode: ["usage_mode", trimmedOrNull(draft.usageMode)],
    physicalCondition: [
      "physical_condition",
      trimmedOrNull(draft.physicalCondition),
    ],
    note: ["note", trimmedOrNull(draft.note)],
  }
  const payload: Record<string, string | number | null> = {}
  ;(Object.keys(payloadByField) as Array<keyof DossierMetadataDraft>).forEach(
    (field) => {
      if (dirtyFields && !dirtyFields.has(field)) return
      const [apiField, value] = payloadByField[field]
      payload[String(apiField)] = value
    }
  )
  return payload as SessionDossierPatchPayload
}

export function updateDossierGroupFromResponse(
  groups: ClusterGroup[],
  groupId: string,
  dossier: SessionDossierSummary
): ClusterGroup[] {
  return groups.map((group) => {
    if (group.id !== groupId) return group
    return {
      ...group,
      dossierId: dossier.dossier_id ?? group.dossierId,
      dossierNumber: dossier.dossier_number ?? null,
      boxNumber: dossier.box_number ?? null,
      folderName: dossier.folder_name ?? null,
      archiveName: dossier.archive_name ?? null,
      fondsName: dossier.fonds_name ?? null,
      inventoryNumber: dossier.inventory_number ?? null,
      informationSign: dossier.information_sign ?? null,
      annotation: dossier.annotation ?? null,
      startDate: dossier.start_date ?? group.startDate,
      endDate: dossier.end_date ?? group.endDate,
      language: dossier.language ?? null,
      sheetCount:
        numericValue(dossier.sheet_count) ?? group.sheetCount,
      pageCount:
        numericValue(dossier.page_count) ?? group.pageCount,
      usageMode: dossier.usage_mode ?? null,
      physicalCondition: dossier.physical_condition ?? null,
      note: dossier.note ?? null,
      manualMetadataFields:
        dossier.manual_metadata_fields ?? group.manualMetadataFields,
      metadataRevision: dossier.metadata_revision ?? group.metadataRevision,
      classificationStatus:
        dossier.classification_status ?? group.classificationStatus,
      retentionPeriod: dossier.retention_period ?? null,
      createdFromTemporaryFolder:
        typeof dossier.created_from_temporary_folder === "boolean"
          ? dossier.created_from_temporary_folder
          : group.createdFromTemporaryFolder,
      label: dossier.title || dossier.generated_title || group.label,
    }
  })
}

function normalizedCountOrNull(value: string): number | null {
  const text = value.trim()
  if (!text) return null
  const parsed = Number(text)
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : null
}

function numericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value !== "string" || !value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function regularDossierCount(groups: ClusterGroup[]): number {
  return groups.filter(
    (group) => !group.isTemporary && !group.isPendingDossier
  ).length
}

export function temporaryDocumentCount(groups: ClusterGroup[]): number {
  return groups
    .filter((group) => group.isTemporary)
    .reduce((sum, group) => sum + group.documents.length, 0)
}

export function dossierYearLabel(group: ClusterGroup): string {
  const year =
    yearFromText(group.startDate) ||
    group.documents
      .map((document) =>
        yearFromText(
          metadataText(document.metadata, ["issued_date", "ngay_ban_hanh"])
        )
      )
      .find(Boolean)
  return year ? `Năm ${year}` : UNKNOWN_YEAR_LABEL
}

export function dossierPageCount(group: ClusterGroup): number {
  if (typeof group.pageCount === "number") return group.pageCount
  return group.documents.reduce(
    (sum, document) => sum + (document.pageCount ?? 0),
    0
  )
}

export function formatDateRange(
  startDate?: string | null,
  endDate?: string | null
): string {
  if (startDate && endDate && startDate !== endDate)
    return `${startDate} - ${endDate}`
  return startDate || endDate || "Chưa rõ thời gian"
}

export function trimmedOrNull(value: string): string | null {
  const text = value.trim()
  return text ? text : null
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

export function metadataText(
  metadata: Record<string, unknown>,
  keys: string[]
): string {
  for (const key of keys) {
    const value = metadata[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number") return String(value)
  }
  return ""
}

export function truncateWithDots(value: string, maxLength: number): string {
  const text = value.trim()
  if (text.length <= maxLength) return text
  return `${text.slice(0, Math.max(1, maxLength - 4)).trimEnd()}....`
}

export function clusterDocumentToPreviewTarget(
  document: ClusterDocument
): DocumentPreviewTarget {
  return {
    id: document.sessionDocumentId,
    fileName: document.fileName,
    dataPath: document.filePath,
  }
}

export function yearFromText(value: string | null | undefined): string {
  return value?.match(/\b(19|20)\d{2}\b/)?.[0] ?? ""
}

export function clusteredDocumentIds(
  version: ClusterVersionResponse | null | undefined
): Set<string> {
  const ids = new Set<string>()
  version?.clusters?.forEach((cluster) => {
    cluster.document_ids?.forEach((id) => ids.add(id))
    cluster.placements?.forEach((placement) => ids.add(placement.document_id))
  })
  return ids
}
