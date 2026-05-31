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
  clusterWarning: ClusterDocumentWarning | null
}

export interface ClusterDocumentWarning {
  riskLevel: string
  riskScore: number | null
  reasons: string[]
  message: string
  displayMessages: string[]
  clusterId: string
  currentDossierTitle: string
  nearestOtherClusterId: string
  nearestOtherDossierTitle: string
  nearestOtherClusterSimilarity: number | null
  nearestOtherClusterRepresentativeId: string
  nearestOtherRepresentativeFileName: string
  nearestOtherRepresentativeTitle: string
  nearestOtherRepresentativeDocuments: ClusterWarningRepresentativeDocument[]
  meanSimilarityToCluster: number | null
  clusterMedianDocSimilarity: number | null
  otherClusterMargin: number | null
  documentYear: string
  documentIssuedDate: string
  dominantClusterYear: string
  dominantYearRatio: number | null
  currentDossierDateRange: string
}

export interface ClusterWarningRepresentativeDocument {
  documentId: string
  fileName: string
  title: string
  documentSummary: string
  documentType: string
  issuedDate: string
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
      const clusterWarning = clusterWarningFromMetadata(metadata)
      return {
        documentId: placement.document_id,
        sessionDocumentId: placement.session_document_id,
        filePath,
        fileName: filePath.split(/[\\/]/).pop() || filePath,
        positionIndex: placement.position_index,
        pageCount: placement.page_count ?? numberValue(metadata.page_count),
        sheetCount: placement.sheet_count ?? numberValue(metadata.sheet_count),
        requiresReview: Boolean(placement.requires_review) || Boolean(clusterWarning),
        metadata,
        clusterWarning,
      }
    })
  const placedIds = new Set(documents.map((document) => document.documentId))
  const fallbackDocuments = (cluster.document_ids ?? [])
    .filter((documentId) => !placedIds.has(documentId))
    .map((documentId, index) => {
      const item = itemsByDocumentId.get(documentId)
      const metadata = item?.light_metadata ?? {}
      const filePath = metadataPath(metadata) ?? item?.data_path ?? documentId
      const clusterWarning = clusterWarningFromMetadata(metadata)
      return {
        documentId,
        sessionDocumentId: item?.id ?? null,
        filePath,
        fileName: filePath.split(/[\\/]/).pop() || filePath,
        positionIndex: documents.length + index,
        pageCount: numberValue(metadata.page_count),
        sheetCount: numberValue(metadata.sheet_count),
        requiresReview: Boolean(clusterWarning),
        metadata,
        clusterWarning,
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
      Boolean(allDocuments.some((document) => document.requiresReview)),
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

function clusterWarningFromMetadata(
  metadata: Record<string, unknown>
): ClusterDocumentWarning | null {
  const raw = metadata._cluster_warning
  if (!isRecord(raw)) return null
  if (stringValue(raw.status).toLowerCase() !== "warning") return null
  const displayMessages = stringArray(raw.display_messages ?? raw.displayMessages)
  return {
    riskLevel: stringValue(raw.risk_level ?? raw.riskLevel),
    riskScore: numberValue(raw.risk_score ?? raw.riskScore),
    reasons: stringArray(raw.risk_reasons ?? raw.riskReasons),
    message: stringValue(raw.message),
    displayMessages,
    clusterId: stringValue(raw.cluster_id ?? raw.clusterId),
    currentDossierTitle: stringValue(
      raw.current_dossier_title ?? raw.currentDossierTitle
    ),
    nearestOtherClusterId: stringValue(
      raw.nearest_other_cluster_id ?? raw.nearestOtherClusterId
    ),
    nearestOtherDossierTitle: stringValue(
      raw.nearest_other_dossier_title ?? raw.nearestOtherDossierTitle
    ),
    nearestOtherClusterSimilarity: numberValue(
      raw.nearest_other_cluster_similarity ?? raw.nearestOtherClusterSimilarity
    ),
    nearestOtherClusterRepresentativeId: stringValue(
      raw.nearest_other_cluster_representative_id ??
        raw.nearestOtherClusterRepresentativeId
    ),
    nearestOtherRepresentativeFileName: stringValue(
      raw.nearest_other_representative_file_name ??
        raw.nearestOtherRepresentativeFileName
    ),
    nearestOtherRepresentativeTitle: stringValue(
      raw.nearest_other_representative_title ?? raw.nearestOtherRepresentativeTitle
    ),
    nearestOtherRepresentativeDocuments: representativeDocuments(
      raw.nearest_other_representative_documents ??
        raw.nearestOtherRepresentativeDocuments
    ),
    meanSimilarityToCluster: numberValue(
      raw.mean_similarity_to_cluster ?? raw.meanSimilarityToCluster
    ),
    clusterMedianDocSimilarity: numberValue(
      raw.cluster_median_doc_similarity ?? raw.clusterMedianDocSimilarity
    ),
    otherClusterMargin: numberValue(raw.other_cluster_margin ?? raw.otherClusterMargin),
    documentYear: stringValue(raw.document_year ?? raw.documentYear),
    documentIssuedDate: stringValue(raw.document_issued_date ?? raw.documentIssuedDate),
    dominantClusterYear: stringValue(raw.dominant_cluster_year ?? raw.dominantClusterYear),
    dominantYearRatio: numberValue(raw.dominant_year_ratio ?? raw.dominantYearRatio),
    currentDossierDateRange: stringValue(
      raw.current_dossier_date_range ?? raw.currentDossierDateRange
    ),
  }
}

function representativeDocuments(
  value: unknown
): ClusterWarningRepresentativeDocument[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!isRecord(item)) return null
      return {
        documentId: stringValue(item.document_id ?? item.documentId),
        fileName: stringValue(item.file_name ?? item.fileName),
        title: stringValue(item.title),
        documentSummary: stringValue(
          item.document_summary ?? item.documentSummary ?? item.summary
        ),
        documentType: stringValue(item.document_type ?? item.documentType),
        issuedDate: stringValue(item.issued_date ?? item.issuedDate),
      }
    })
    .filter(
      (item): item is ClusterWarningRepresentativeDocument =>
        Boolean(item?.documentId || item?.fileName || item?.title || item?.documentSummary)
    )
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : ""
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(stringValue).filter(Boolean)
  }
  const text = stringValue(value)
  return text ? [text] : []
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}
