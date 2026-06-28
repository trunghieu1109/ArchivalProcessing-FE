import type {
  ClusterVersionResponse,
  SessionClusterSummary,
} from "@/features/upload/api/sessionApi"
import { buildDisplayMetadata } from "@/features/upload/lib/metadata"
import { documentSignatureStatus } from "@/features/upload/lib/signatureStatus"
import type { PdfMetadata } from "@/features/upload/types"
import {
  classificationPath,
  clusterWarningFromMetadata,
  mergeMetadataSources,
  metadataPath,
  numberValue,
  stringValue,
  uniqueStrings,
} from "./clusterGroupUtils"

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

  const dossiers = cluster.dossiers?.length
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
      const signatureStatus =
        (item?.signature_status ??
          stringValue(metadataSource.signature_status) ??
          stringValue(metadataSource.signatureStatus)) ||
        null
      const ocrStatus =
        item?.status ??
        stringValue(metadataSource.ocr_status ?? metadataSource.status)
      const metadata = buildDisplayMetadata({
        light_metadata: metadataSource,
        normalized_metadata: item?.normalized_metadata,
        raw_metadata: item?.raw_metadata,
        remote_metadata_status: remoteMetadataStatus,
        signature_status: signatureStatus,
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
          signatureStatus,
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
      const signatureStatus =
        (item?.signature_status ??
          stringValue(metadataSource.signature_status) ??
          stringValue(metadataSource.signatureStatus)) ||
        null
      const ocrStatus =
        item?.status ??
        stringValue(metadataSource.ocr_status ?? metadataSource.status)
      const metadata = buildDisplayMetadata({
        light_metadata: metadataSource,
        normalized_metadata: item?.normalized_metadata,
        raw_metadata: item?.raw_metadata,
        remote_metadata_status: remoteMetadataStatus,
        signature_status: signatureStatus,
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
          signatureStatus,
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
    id: isTemporary
      ? TEMPORARY_CLUSTER_ID
      : (dossier?.dossier_id ?? cluster.dossier_id),
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
