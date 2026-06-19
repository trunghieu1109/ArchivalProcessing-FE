import type { DossierClassification } from "@/features/upload/api/sessionApi"
import type {
  ClusterDocumentWarning,
  ClusterWarningRepresentativeDocument,
} from "./clusterGroups"

export function classificationPath(
  classification: DossierClassification | null | undefined
): string[] {
  if (!classification) return []
  if (classification.group_path?.length) return classification.group_path
  const fromLevels = classification.level_path
    ?.map((level) => {
      if (typeof level !== "object" || level === null) return ""
      const record = level as Record<string, unknown>
      return stringValue(
        record.name ?? record.group_name ?? record.label ?? record.id
      )
    })
    .filter(Boolean)
  if (fromLevels?.length) return fromLevels
  return classification.group_name ? [classification.group_name] : []
}

export function metadataPath(
  metadata: Record<string, unknown> | undefined
): string | null {
  if (!metadata) return null
  return (
    stringValue(
      metadata.data_path ??
        metadata.file_path ??
        metadata.path ??
        metadata.source_path
    ) || null
  )
}

export function clusterWarningFromMetadata(
  metadata: Record<string, unknown>
): ClusterDocumentWarning | null {
  const raw = metadata._cluster_warning
  if (!isRecord(raw)) return null
  if (stringValue(raw.status).toLowerCase() !== "warning") return null
  const displayMessages = stringArray(
    raw.display_messages ?? raw.displayMessages
  )
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
      raw.nearest_other_representative_title ??
        raw.nearestOtherRepresentativeTitle
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
    otherClusterMargin: numberValue(
      raw.other_cluster_margin ?? raw.otherClusterMargin
    ),
    documentYear: stringValue(raw.document_year ?? raw.documentYear),
    documentIssuedDate: stringValue(
      raw.document_issued_date ?? raw.documentIssuedDate
    ),
    dominantClusterYear: stringValue(
      raw.dominant_cluster_year ?? raw.dominantClusterYear
    ),
    dominantYearRatio: numberValue(
      raw.dominant_year_ratio ?? raw.dominantYearRatio
    ),
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
    .filter((item): item is ClusterWarningRepresentativeDocument =>
      Boolean(
        item?.documentId ||
        item?.fileName ||
        item?.title ||
        item?.documentSummary
      )
    )
}

export function mergeMetadataSources(
  ...sources: Array<Record<string, unknown> | null | undefined>
): Record<string, unknown> {
  const merged: Record<string, unknown> = {}
  for (const source of sources) {
    if (!source) continue
    for (const [key, value] of Object.entries(source)) {
      if (isEmptyMetadataValue(value) && hasMetadataValue(merged[key])) {
        continue
      }
      merged[key] = value
    }
  }
  return merged
}

function isEmptyMetadataValue(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === "string") return value.trim().length === 0
  if (Array.isArray(value)) return value.length === 0
  if (isRecord(value)) return Object.keys(value).length === 0
  return false
}

function hasMetadataValue(value: unknown): boolean {
  return !isEmptyMetadataValue(value) && value !== false
}

export function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function stringValue(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : ""
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(stringValue).filter(Boolean)
  }
  const text = stringValue(value)
  return text ? [text] : []
}

export function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}
