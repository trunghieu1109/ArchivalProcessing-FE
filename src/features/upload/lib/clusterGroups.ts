import type {
  ClusterVersionResponse,
  DossierClassification,
  SessionClusterSummary,
} from "@/features/upload/api/sessionApi"
import { buildDisplayMetadata } from "@/features/upload/lib/metadata"
import { documentSignatureStatus } from "@/features/upload/lib/signatureStatus"
import type { PdfMetadata } from "@/features/upload/types"

export const TEMPORARY_CLUSTER_ID = "temporary-folder"
export const TEMPORARY_FOLDER_NAME = "Thư mục tạm"

export interface ClusterGroup {
  id: string
  clusterId: string
  label: string
  files: string[]
  documents: ClusterDocument[]
  isTemporary?: boolean
  createdFromTemporaryFolder?: boolean
  dossierId?: string | null
  dossierNumber?: string | null
  boxNumber?: string | null
  folderName?: string | null
  archiveName?: string | null
  fondsName?: string | null
  inventoryNumber?: string | null
  informationSign?: string | null
  annotation?: string | null
  language?: string | null
  usageMode?: string | null
  physicalCondition?: string | null
  note?: string | null
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
  remoteMetadataStatus: string | null
  ocrStatus: string
  signatureStatus: string
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
  const itemsByDocumentId = new Map(
    items.map((item) => [item.document_id, item])
  )
  return ensureTemporaryFolderGroup(
    version.clusters.flatMap((cluster) =>
      clusterToGroups(cluster, itemsByDocumentId)
    )
  )
}

export function ensureTemporaryFolderGroup(
  groups: ClusterGroup[]
): ClusterGroup[] {
  const temporaryGroup = groups.find(
    (group) => group.isTemporary || group.id === TEMPORARY_CLUSTER_ID
  )
  const regularGroups = groups.filter(
    (group) => !group.isTemporary && group.id !== TEMPORARY_CLUSTER_ID
  )
  return [
    temporaryGroup
      ? {
          ...temporaryGroup,
          id: TEMPORARY_CLUSTER_ID,
          clusterId: TEMPORARY_CLUSTER_ID,
          label: TEMPORARY_FOLDER_NAME,
          dossierId: null,
          isTemporary: true,
          createdFromTemporaryFolder: false,
          classificationPath: [],
        }
      : {
          id: TEMPORARY_CLUSTER_ID,
          clusterId: TEMPORARY_CLUSTER_ID,
          label: TEMPORARY_FOLDER_NAME,
          files: [],
          documents: [],
          dossierId: null,
          isTemporary: true,
          createdFromTemporaryFolder: false,
          classificationPath: [],
          requiresReview: false,
        },
    ...regularGroups,
  ]
}

function clusterToGroups(
  cluster: SessionClusterSummary,
  itemsByDocumentId: Map<string, PdfMetadata>
): ClusterGroup[] {
  const isTemporary =
    Boolean(cluster.is_temporary) || cluster.cluster_id === TEMPORARY_CLUSTER_ID
  if (isTemporary) {
    return [
      clusterToGroup(
        cluster,
        itemsByDocumentId,
        cluster.dossier,
        cluster.placements ?? [],
        cluster.document_ids ?? []
      ),
    ]
  }

  const dossiers =
    cluster.dossiers?.length
      ? cluster.dossiers
      : cluster.dossier
        ? [cluster.dossier]
        : []
  if (!dossiers.length) {
    return [
      clusterToGroup(
        cluster,
        itemsByDocumentId,
        cluster.dossier,
        cluster.placements ?? [],
        cluster.document_ids ?? []
      ),
    ]
  }

  const hasMultipleDossiers = dossiers.length > 1
  return dossiers.map((dossier) => {
    const placements = (cluster.placements ?? []).filter(
      (placement) =>
        placement.dossier_id === dossier.dossier_id ||
        (!hasMultipleDossiers && !placement.dossier_id)
    )
    return clusterToGroup(
      cluster,
      itemsByDocumentId,
      dossier,
      placements,
      dossier.document_ids?.length
        ? dossier.document_ids
        : placements.map((placement) => placement.document_id)
    )
  })
}

function clusterToGroup(
  cluster: SessionClusterSummary,
  itemsByDocumentId: Map<string, PdfMetadata>,
  dossier: SessionClusterSummary["dossier"],
  clusterPlacements: SessionClusterSummary["placements"],
  fallbackDocumentIds: string[]
): ClusterGroup {
  const isTemporary =
    Boolean(cluster.is_temporary) || cluster.cluster_id === TEMPORARY_CLUSTER_ID
  const classification = dossier?.classification
  const documents = [...(clusterPlacements ?? [])]
    .sort((a, b) => a.position_index - b.position_index)
    .map((placement) => {
      const item = itemsByDocumentId.get(placement.document_id)
      const metadataSource = mergeMetadataSources(
        item?.light_metadata,
        placement.metadata
      )
      const remoteMetadataStatus =
        (item?.remote_metadata_status ??
          stringValue(metadataSource.remote_metadata_status)) ||
        null
      const ocrStatus =
        item?.status ??
        stringValue(metadataSource.ocr_status ?? metadataSource.status)
      const metadata = buildDisplayMetadata({
        light_metadata: metadataSource,
        normalized_metadata: item?.normalized_metadata,
        raw_metadata: item?.raw_metadata,
        remote_metadata_status: remoteMetadataStatus,
        ocr_status: ocrStatus,
        status: stringValue(metadataSource.status),
      })
      const filePath =
        metadataPath(metadata) ?? item?.data_path ?? placement.document_id
      const clusterWarning = clusterWarningFromMetadata(metadata)
      return {
        documentId: placement.document_id,
        sessionDocumentId: placement.session_document_id,
        filePath,
        fileName: filePath.split(/[\\/]/).pop() || filePath,
        remoteMetadataStatus,
        ocrStatus,
        signatureStatus: documentSignatureStatus({
          remoteMetadataStatus,
          ocrStatus,
        }),
        positionIndex: placement.position_index,
        pageCount: placement.page_count ?? numberValue(metadata.page_count),
        sheetCount: placement.sheet_count ?? numberValue(metadata.sheet_count),
        requiresReview:
          Boolean(placement.requires_review) || Boolean(clusterWarning),
        metadata,
        clusterWarning,
      }
    })
  const placedIds = new Set(documents.map((document) => document.documentId))
  const fallbackDocuments = (fallbackDocumentIds ?? [])
    .filter((documentId) => !placedIds.has(documentId))
    .map((documentId, index) => {
      const item = itemsByDocumentId.get(documentId)
      const metadataSource = item?.light_metadata ?? {}
      const remoteMetadataStatus =
        (item?.remote_metadata_status ??
          stringValue(metadataSource.remote_metadata_status)) ||
        null
      const ocrStatus =
        item?.status ??
        stringValue(metadataSource.ocr_status ?? metadataSource.status)
      const metadata = buildDisplayMetadata({
        light_metadata: metadataSource,
        normalized_metadata: item?.normalized_metadata,
        raw_metadata: item?.raw_metadata,
        remote_metadata_status: remoteMetadataStatus,
        ocr_status: ocrStatus,
        status: stringValue(metadataSource.status),
      })
      const filePath = metadataPath(metadata) ?? item?.data_path ?? documentId
      const clusterWarning = clusterWarningFromMetadata(metadata)
      return {
        documentId,
        sessionDocumentId: item?.id ?? null,
        filePath,
        fileName: filePath.split(/[\\/]/).pop() || filePath,
        remoteMetadataStatus,
        ocrStatus,
        signatureStatus: documentSignatureStatus({
          remoteMetadataStatus,
          ocrStatus,
        }),
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
    id: isTemporary ? TEMPORARY_CLUSTER_ID : (dossier?.dossier_id ?? cluster.dossier_id),
    clusterId: cluster.cluster_id,
    dossierId: isTemporary ? null : (dossier?.dossier_id ?? cluster.dossier_id),
    isTemporary,
    createdFromTemporaryFolder:
      !isTemporary &&
      Boolean(
        cluster.created_from_temporary_folder ||
          dossier?.created_from_temporary_folder
      ),
    dossierNumber: dossier?.dossier_number ?? null,
    boxNumber: dossier?.box_number ?? null,
    folderName: dossier?.folder_name ?? null,
    archiveName: dossier?.archive_name ?? null,
    fondsName: dossier?.fonds_name ?? null,
    inventoryNumber: dossier?.inventory_number ?? null,
    informationSign: dossier?.information_sign ?? null,
    annotation: dossier?.annotation ?? null,
    language: dossier?.language ?? null,
    usageMode: dossier?.usage_mode ?? null,
    physicalCondition: dossier?.physical_condition ?? null,
    note: dossier?.note ?? null,
    label: isTemporary
      ? TEMPORARY_FOLDER_NAME
      : dossier?.title ||
        dossier?.generated_title ||
        cluster.title ||
        cluster.dossier_id ||
        cluster.cluster_id,
    files: uniqueStrings(allDocuments.map((document) => document.filePath)),
    documents: allDocuments,
    classificationPath: isTemporary ? [] : classificationPath(classification),
    retentionPeriod: dossier?.retention_period ?? null,
    confidence: classification?.confidence ?? null,
    requiresReview:
      Boolean(classification?.requires_review) ||
      Boolean(allDocuments.some((document) => document.requiresReview)),
    pageCount: dossier?.page_count ?? cluster.page_count,
    sheetCount: numberValue(dossier?.sheet_count) ?? cluster.sheet_count,
    startDate: dossier?.start_date ?? cluster.start_date,
    endDate: dossier?.end_date ?? cluster.end_date,
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
      return stringValue(
        record.name ?? record.group_name ?? record.label ?? record.id
      )
    })
    .filter(Boolean)
  if (fromLevels?.length) return fromLevels
  return classification.group_name ? [classification.group_name] : []
}

function metadataPath(
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

function clusterWarningFromMetadata(
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

function mergeMetadataSources(
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

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown): string {
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

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}
