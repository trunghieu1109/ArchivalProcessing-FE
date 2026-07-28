import type {
  ClusterVersionResponse,
  DocumentEditLock,
  DocumentNumberingMode,
  SessionDossierSuggestion,
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
  isPendingDossier?: boolean
  draftId?: number | null
  manualMetadataFields?: string[]
  metadataRevision?: number
  classificationStatus?: string | null
  createdFromTemporaryFolder?: boolean
  dossierId?: string | null
  dossierStorageId?: string | null
  dossierNumber?: string | null
  dossierCode?: string | null
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
  paperDossierId?: string | null
  note?: string | null
  classificationPath?: string[]
  retentionPeriod?: string | null
  retentionRecommendation?: Record<string, unknown> | null
  confidence?: number | null
  requiresReview?: boolean
  pageCount?: number | null
  sheetCount?: number | null
  startDate?: string | null
  endDate?: string | null
  pendingFeedbackCount?: number
  hasPendingFeedback?: boolean
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
  sourcePageCount?: number | null
  outputPageCount?: number | null
  documentNumberingMode?: DocumentNumberingMode | null
  requiresReview: boolean
  metadata: Record<string, unknown>
  dossierSuggestions?: SessionDossierSuggestion[] | null
  clusterWarning: ClusterDocumentWarning | null
  pendingFeedback?: PendingClusterFeedbackMarker | null
  editLock?: DocumentEditLock | null
  lifecycleStatus?: "active" | "delete_pending" | "deleted" | string
  deletedAt?: string | null
  deletedByName?: string | null
  transferredAt?: string | null
  transferredByName?: string | null
  transferredToSessionId?: string | null
  transferredToSessionDocumentId?: number | null
  previewAvailable?: boolean
}

export interface PendingClusterFeedbackMarker {
  id: number
  action: string
  sourceClusterId?: string | null
  targetClusterId?: string | null
  createdAt: string
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

export interface ClusterDocumentDossierCounts {
  pageCount: number | null
  sheetCount: number | null
  sourcePageCount: number | null
  outputPageCount: number | null
  documentNumberingMode: DocumentNumberingMode
}

interface ClusterDocumentCountOptions {
  pageCount?: unknown
  sheetCount?: unknown
  sourcePageCount?: unknown
  outputPageCount?: unknown
  documentNumberingMode?: unknown
  pdfPreprocessing?: Record<string, unknown> | null
}

export function clusterDocumentTotals(documents: ClusterDocument[]): {
  pageCount: number
  sheetCount: number
} {
  return documents.reduce(
    (totals, document) => ({
      pageCount: totals.pageCount + (document.pageCount ?? 0),
      sheetCount: totals.sheetCount + (document.sheetCount ?? 0),
    }),
    { pageCount: 0, sheetCount: 0 }
  )
}

export function clusterDocumentCountsFromMetadata(
  metadata: Record<string, unknown>,
  options: ClusterDocumentCountOptions = {}
): ClusterDocumentDossierCounts {
  const numbering = recordValue(metadata.numbering)
  const preprocessing = firstRecord(
    options.pdfPreprocessing,
    metadata.pdf_preprocessing,
    metadata._pdf_preprocessing,
    numbering.pdf_preprocessing
  )
  const sourcePageCount = firstNonNegativeInteger(
    options.sourcePageCount,
    numbering.source_page_count,
    preprocessing.source_page_count,
    metadata.source_page_count,
    metadata.page_count,
    metadata.so_trang
  )
  let outputPageCount = firstNonNegativeInteger(
    options.outputPageCount,
    numbering.output_page_count,
    preprocessing.output_page_count,
    metadata.output_page_count,
    metadata.processed_page_count
  )
  if (outputPageCount === null && sourcePageCount !== null) {
    const removedPages = removedPageNumbers(preprocessing, sourcePageCount)
    if (removedPages.size > 0) {
      outputPageCount = Math.max(0, sourcePageCount - removedPages.size)
    }
  }

  const explicitPageCount = firstNonNegativeInteger(
    options.pageCount,
    metadata.page_count,
    metadata.so_trang
  )
  const explicitSheetCount = firstNonNegativeInteger(
    options.sheetCount,
    metadata.sheet_count,
    metadata.so_to
  )
  const documentNumberingMode =
    normalizeDocumentNumberingMode(
      options.documentNumberingMode ??
        numbering.mode ??
        numbering.document_numbering_mode ??
        metadata.document_numbering_mode ??
        metadata.mode
    ) ??
    inferDocumentNumberingMode({
      sourcePageCount,
      outputPageCount,
      explicitPageCount,
      explicitSheetCount,
    }) ??
    "page"

  if (documentNumberingMode === "sheet") {
    return {
      pageCount: outputPageCount ?? sourcePageCount ?? explicitPageCount,
      sheetCount:
        sheetCountFromOriginalPages(sourcePageCount) ?? explicitSheetCount,
      sourcePageCount,
      outputPageCount,
      documentNumberingMode,
    }
  }

  const pageCount = sourcePageCount ?? outputPageCount ?? explicitPageCount
  return {
    pageCount,
    sheetCount: pageCount ?? explicitSheetCount,
    sourcePageCount,
    outputPageCount,
    documentNumberingMode,
  }
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
      const dossierCounts = clusterDocumentCountsFromMetadata(metadata, {
        pageCount: placement.page_count,
        sheetCount: placement.sheet_count,
        sourcePageCount: placement.source_page_count,
        outputPageCount: placement.output_page_count,
        documentNumberingMode: placement.document_numbering_mode,
        pdfPreprocessing: item?.pdf_preprocessing,
      })
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
        pageCount: dossierCounts.pageCount,
        sheetCount: dossierCounts.sheetCount,
        sourcePageCount: dossierCounts.sourcePageCount,
        outputPageCount: dossierCounts.outputPageCount,
        documentNumberingMode: dossierCounts.documentNumberingMode,
        dossierSuggestions: placement.dossier_suggestions ?? null,
        requiresReview:
          Boolean(placement.requires_review) || Boolean(clusterWarning),
        metadata,
        clusterWarning,
        editLock: item?.edit_lock ?? null,
        lifecycleStatus:
          placement.lifecycle_status ?? item?.lifecycle_status ?? "active",
        deletedAt: placement.deleted_at ?? item?.deleted_at ?? null,
        deletedByName:
          placement.deleted_by_name ?? item?.deleted_by_name ?? null,
        transferredAt: placement.transferred_at ?? null,
        transferredByName: placement.transferred_by_name ?? null,
        transferredToSessionId: placement.transferred_to_session_id ?? null,
        transferredToSessionDocumentId:
          placement.transferred_to_session_document_id ?? null,
        previewAvailable:
          placement.preview_available ?? item?.preview_available ?? true,
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
      const dossierCounts = clusterDocumentCountsFromMetadata(metadata, {
        pdfPreprocessing: item?.pdf_preprocessing,
      })
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
        pageCount: dossierCounts.pageCount,
        sheetCount: dossierCounts.sheetCount,
        sourcePageCount: dossierCounts.sourcePageCount,
        outputPageCount: dossierCounts.outputPageCount,
        documentNumberingMode: dossierCounts.documentNumberingMode,
        requiresReview: Boolean(clusterWarning),
        metadata,
        clusterWarning,
        editLock: item?.edit_lock ?? null,
        lifecycleStatus: item?.lifecycle_status ?? "active",
        deletedAt: item?.deleted_at ?? null,
        deletedByName: item?.deleted_by_name ?? null,
        previewAvailable: item?.preview_available ?? true,
      }
    })
  const allDocuments = [...documents, ...fallbackDocuments]
  const documentTotals = clusterDocumentTotals(allDocuments)

  return {
    id: isTemporary
      ? TEMPORARY_CLUSTER_ID
      : (dossier?.dossier_id ?? cluster.dossier_id),
    clusterId: cluster.cluster_id,
    dossierId: isTemporary ? null : (dossier?.dossier_id ?? cluster.dossier_id),
    dossierStorageId: dossier?.dossier_storage_id ?? null,
    isTemporary,
    createdFromTemporaryFolder:
      !isTemporary &&
      Boolean(
        cluster.created_from_temporary_folder ||
        dossier?.created_from_temporary_folder
      ),
    manualMetadataFields: dossier?.manual_metadata_fields ?? [],
    metadataRevision: dossier?.metadata_revision ?? 0,
    classificationStatus: dossier?.classification_status ?? null,
    dossierNumber: dossier?.dossier_number ?? null,
    dossierCode: dossier?.dossier_code ?? null,
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
    paperDossierId: dossier?.paper_dossier_id ?? null,
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
    retentionRecommendation: dossier?.retention_recommendation ?? null,
    confidence: classification?.confidence ?? null,
    requiresReview:
      Boolean(classification?.requires_review) ||
      Boolean(allDocuments.some((document) => document.requiresReview)),
    pageCount:
      dossier?.page_count ?? cluster.page_count ?? documentTotals.pageCount,
    sheetCount:
      numberValue(dossier?.sheet_count) ??
      cluster.sheet_count ??
      documentTotals.sheetCount,
    startDate: dossier?.start_date ?? cluster.start_date,
    endDate: dossier?.end_date ?? cluster.end_date,
  }
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function firstRecord(...values: unknown[]): Record<string, unknown> {
  for (const value of values) {
    const record = recordValue(value)
    if (Object.keys(record).length > 0) return record
  }
  return {}
}

function firstNonNegativeInteger(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = nonNegativeIntegerValue(value)
    if (parsed !== null) return parsed
  }
  return null
}

function nonNegativeIntegerValue(value: unknown): number | null {
  const parsed = numberValue(value)
  if (parsed === null) return null
  const integer = Math.trunc(parsed)
  return integer >= 0 ? integer : null
}

function removedPageNumbers(
  preprocessing: Record<string, unknown>,
  sourcePageCount: number
): Set<number> {
  const source =
    "removed_pages" in preprocessing
      ? preprocessing.removed_pages
      : preprocessing.blank_pages
  return new Set(
    intList(source).filter((page) => page >= 1 && page <= sourcePageCount)
  )
}

function intList(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value
    .map(nonNegativeIntegerValue)
    .filter((item): item is number => item !== null)
}

function normalizeDocumentNumberingMode(
  value: unknown
): DocumentNumberingMode | null {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
  if (normalized === "sheet" || normalized === "to") return "sheet"
  if (normalized === "page" || normalized === "trang") return "page"
  return null
}

function inferDocumentNumberingMode({
  sourcePageCount,
  outputPageCount,
  explicitPageCount,
  explicitSheetCount,
}: {
  sourcePageCount: number | null
  outputPageCount: number | null
  explicitPageCount: number | null
  explicitSheetCount: number | null
}): DocumentNumberingMode | null {
  if (sourcePageCount === null || explicitSheetCount === null) return null
  if (explicitSheetCount !== sheetCountFromOriginalPages(sourcePageCount)) {
    return null
  }
  if (explicitPageCount !== null && explicitPageCount !== explicitSheetCount) {
    return "sheet"
  }
  if (
    explicitPageCount !== null &&
    outputPageCount !== null &&
    explicitPageCount === outputPageCount &&
    outputPageCount !== sourcePageCount
  ) {
    return "sheet"
  }
  return null
}

function sheetCountFromOriginalPages(pageCount: number | null): number | null {
  if (pageCount === null) return null
  return Math.max(0, Math.ceil(pageCount / 2))
}
