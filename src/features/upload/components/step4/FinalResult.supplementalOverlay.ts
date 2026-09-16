import type { SupplementalIntakeResponse } from "@/features/upload/api/sessionApi"
import {
  clusterDocumentCountsFromMetadata,
  type ClusterDocument,
  type ClusterGroup,
} from "@/features/upload/lib/clusterGroups"
import {
  clusterWarningFromMetadata,
  mergeMetadataSources,
  metadataPath,
  stringValue,
} from "@/features/upload/lib/clusterGroupUtils"
import { buildDisplayMetadata } from "@/features/upload/lib/metadata"
import { documentSignatureStatus } from "@/features/upload/lib/signatureStatus"
import type { PdfMetadata } from "@/features/upload/types"

export function applySupplementalIntakeOverlay(
  groups: ClusterGroup[],
  intakes: SupplementalIntakeResponse[],
  metadataItems: PdfMetadata[]
): ClusterGroup[] {
  const mappedIds = new Set(
    intakes.flatMap((intake) =>
      intake.documents.map((document) => document.session_document_id)
    )
  )
  const previousDocuments = new Map<number, ClusterDocument>()
  groups.forEach((group) =>
    group.documents.forEach((document) => {
      if (document.sessionDocumentId !== null) {
        previousDocuments.set(document.sessionDocumentId, document)
      }
    })
  )
  const result = groups.map((group) => ({
    ...group,
    documents: group.documents.filter(
      (document) =>
        document.sessionDocumentId === null ||
        !mappedIds.has(document.sessionDocumentId)
    ),
  }))
  result.forEach((group) => {
    group.files = group.documents.map((document) => document.filePath)
  })
  const metadataById = new Map(metadataItems.map((item) => [item.id, item]))

  for (const intake of intakes) {
    if (intake.status === "cancelled" || intake.status === "failed") continue
    const dossierId = intake.target.dossier_id
    if (!dossierId || intake.documents.length === 0) continue
    let target = result.find(
      (group) => (group.dossierId ?? group.id) === dossierId
    )
    if (!target && intake.intake_mode === "existing_dossier") continue
    if (!target) {
      target = supplementalDraftGroup(intake)
      result.unshift(target)
    }
    const ordered = [...intake.documents].sort(
      (left, right) => left.draft_sequence - right.draft_sequence
    )
    for (const intakeDocument of ordered) {
      const existing = previousDocuments.get(intakeDocument.session_document_id)
      const document = existing
        ? {
            ...existing,
            positionIndex: target.documents.length,
          }
        : supplementalDocument(
            intake,
            intakeDocument,
            metadataById.get(intakeDocument.session_document_id),
            target.documents.length
          )
      target.documents.push(document)
    }
    target.files = target.documents.map((document) => document.filePath)
    target.requiresReview = target.documents.some(
      (document) => document.requiresReview
    )
  }
  return result
}

function supplementalDraftGroup(
  intake: SupplementalIntakeResponse
): ClusterGroup {
  const dossier = intake.dossier ?? {}
  const dossierId = intake.target.dossier_id ?? `draft-${intake.intake_id}`
  return {
    id: dossierId,
    clusterId: intake.target.cluster_id ?? dossierId,
    dossierId,
    label: text(dossier.title) || "Hồ sơ bổ sung",
    files: [],
    documents: [],
    isPendingDossier: true,
    supplementalIntakeId: intake.intake_id,
    supplementalTargetState: intake.target.state,
    readinessStatus: intake.status,
    classificationPath: [...(intake.target.group_path ?? [])],
    classificationGroupIds: [...(intake.target.group_ids ?? [])],
    dossierNumber: textOrNull(dossier.dossier_number),
    dossierCode: textOrNull(dossier.dossier_code),
    boxNumber: textOrNull(dossier.box_number),
    folderName: textOrNull(dossier.folder_name),
    retentionPeriod: textOrNull(dossier.retention_period),
    startDate: textOrNull(dossier.start_date),
    endDate: textOrNull(dossier.end_date),
    note: textOrNull(dossier.note),
    requiresReview: true,
  }
}

function supplementalDocument(
  intake: SupplementalIntakeResponse,
  intakeDocument: SupplementalIntakeResponse["documents"][number],
  item: PdfMetadata | undefined,
  positionIndex: number
): ClusterDocument {
  const metadataSource = mergeMetadataSources(
    intakeDocument.light_metadata,
    item?.light_metadata,
    item?.normalized_metadata,
    item?.raw_metadata,
    {
      arrangement_status: intakeDocument.arrangement_status,
      supplemental_intake_id: intake.intake_id,
    }
  )
  const remoteMetadataStatus =
    item?.remote_metadata_status ??
    intakeDocument.remote_metadata_status ??
    stringValue(metadataSource.remote_metadata_status) ??
    null
  const ocrStatus = item?.status ?? intakeDocument.ocr_status
  const signatureStatus = item?.signature_status ?? null
  const metadata = buildDisplayMetadata({
    light_metadata: metadataSource,
    normalized_metadata: item?.normalized_metadata,
    raw_metadata: item?.raw_metadata,
    remote_metadata_status: remoteMetadataStatus,
    signature_status: signatureStatus,
    ocr_status: ocrStatus,
  })
  const filePath =
    metadataPath(metadata) ??
    item?.data_path ??
    intakeDocument.data_path ??
    intakeDocument.file_name
  const warning = clusterWarningFromMetadata(metadata)
  const counts = clusterDocumentCountsFromMetadata(metadata, {
    pdfPreprocessing: item?.pdf_preprocessing,
  })
  return {
    documentId: intakeDocument.document_id,
    sessionDocumentId: intakeDocument.session_document_id,
    filePath,
    fileName: intakeDocument.file_name,
    remoteMetadataStatus,
    ocrStatus,
    signatureStatus: documentSignatureStatus({
      signatureStatus,
      remoteMetadataStatus,
      ocrStatus,
    }),
    positionIndex,
    pageCount: counts.pageCount,
    sheetCount: counts.sheetCount,
    sourcePageCount: counts.sourcePageCount,
    outputPageCount: counts.outputPageCount,
    documentNumberingMode: counts.documentNumberingMode,
    requiresReview:
      intakeDocument.arrangement_status !== "active" || Boolean(warning),
    metadata,
    clusterWarning: warning,
    editLock: item?.edit_lock ?? null,
    lifecycleStatus:
      item?.lifecycle_status ?? intakeDocument.lifecycle_status ?? "active",
    previewAvailable:
      item?.preview_available ?? intakeDocument.preview_available ?? true,
  }
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function textOrNull(value: unknown): string | null {
  return text(value) || null
}
