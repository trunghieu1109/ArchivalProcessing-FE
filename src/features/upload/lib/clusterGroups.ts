import type {
  ClusterVersionResponse,
  DossierClassification,
  SessionClusterSummary,
} from "@/features/upload/api/sessionApi"
import type { PdfMetadata } from "@/features/upload/types"

export interface ClusterGroup {
  id: string
  label: string
  files: string[]
  documents: ClusterDocument[]
  dossierId?: string | null
  dossierNumber?: string | null
  folderName?: string | null
  classificationPath?: string[]
  retentionPeriod?: string | null
  confidence?: number | null
  requiresReview?: boolean
  pageCount?: number | null
  sheetCount?: number | null
  startDate?: string | null
  endDate?: string | null
}

export interface ClusterDocument {
  documentId: string
  sessionDocumentId: number | null
  filePath: string
  fileName: string
  positionIndex: number
  pageCount: number | null
  sheetCount: number | null
  requiresReview: boolean
  metadata: Record<string, unknown>
}

export function versionToGroups(
  version: ClusterVersionResponse | null,
  items: PdfMetadata[]
): ClusterGroup[] {
  if (!version?.clusters) return []
  const itemsByDocumentId = new Map(items.map((item) => [item.document_id, item]))
  return version.clusters.map((cluster) => clusterToGroup(cluster, itemsByDocumentId))
}

function clusterToGroup(
  cluster: SessionClusterSummary,
  itemsByDocumentId: Map<string, PdfMetadata>
): ClusterGroup {
  const dossier = cluster.dossier
  const classification = dossier?.classification
  const documents = [...(cluster.placements ?? [])]
    .sort((a, b) => a.position_index - b.position_index)
    .map((placement) => {
      const item = itemsByDocumentId.get(placement.document_id)
      const metadata = {
        ...(item?.light_metadata ?? {}),
        ...(placement.metadata ?? {}),
      }
      const filePath =
        metadataPath(metadata) ??
        item?.data_path ??
        placement.document_id
      return {
        documentId: placement.document_id,
        sessionDocumentId: placement.session_document_id,
        filePath,
        fileName: filePath.split(/[\\/]/).pop() || filePath,
        positionIndex: placement.position_index,
        pageCount: placement.page_count ?? numberValue(metadata.page_count),
        sheetCount: placement.sheet_count ?? numberValue(metadata.sheet_count),
        requiresReview: Boolean(placement.requires_review),
        metadata,
      }
    })
  const placedIds = new Set(documents.map((document) => document.documentId))
  const fallbackDocuments = (cluster.document_ids ?? [])
    .filter((documentId) => !placedIds.has(documentId))
    .map((documentId, index) => {
      const item = itemsByDocumentId.get(documentId)
      const metadata = item?.light_metadata ?? {}
      const filePath = metadataPath(metadata) ?? item?.data_path ?? documentId
      return {
        documentId,
        sessionDocumentId: item?.id ?? null,
        filePath,
        fileName: filePath.split(/[\\/]/).pop() || filePath,
        positionIndex: documents.length + index,
        pageCount: numberValue(metadata.page_count),
        sheetCount: numberValue(metadata.sheet_count),
        requiresReview: false,
        metadata,
      }
    })
  const allDocuments = [...documents, ...fallbackDocuments]

  return {
    id: cluster.cluster_id,
    dossierId: dossier?.dossier_id ?? cluster.dossier_id,
    dossierNumber: dossier?.dossier_number ?? null,
    folderName: dossier?.folder_name ?? null,
    label:
      dossier?.title || dossier?.generated_title || cluster.title || cluster.dossier_id || cluster.cluster_id,
    files: uniqueStrings(allDocuments.map((document) => document.filePath)),
    documents: allDocuments,
    classificationPath: classificationPath(classification),
    retentionPeriod: dossier?.retention_period ?? null,
    confidence: classification?.confidence ?? null,
    requiresReview:
      Boolean(classification?.requires_review) ||
      Boolean(cluster.placements?.some((placement) => placement.requires_review)),
    pageCount: cluster.page_count,
    sheetCount: cluster.sheet_count,
    startDate: cluster.start_date,
    endDate: cluster.end_date,
  }
}

function classificationPath(
  classification: DossierClassification | null | undefined
): string[] {
  if (!classification) return []
  if (classification.group_path?.length) return classification.group_path
  const fromLevels = classification.level_path
    ?.map((level) => {
      if (typeof level !== "object" || level === null) return ""
      const record = level as Record<string, unknown>
      return stringValue(record.name ?? record.group_name ?? record.label ?? record.id)
    })
    .filter(Boolean)
  if (fromLevels?.length) return fromLevels
  return classification.group_name ? [classification.group_name] : []
}

function metadataPath(metadata: Record<string, unknown> | undefined): string | null {
  if (!metadata) return null
  return stringValue(
    metadata.data_path ?? metadata.file_path ?? metadata.path ?? metadata.source_path
  ) || null
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function stringValue(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : ""
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}
