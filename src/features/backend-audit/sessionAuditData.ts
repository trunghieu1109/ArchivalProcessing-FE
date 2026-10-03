import type { AuditRequestResult } from "./backendAudit"
import {
  asNumberRecord,
  asRecord,
  asRecords,
  finiteNumber,
  text,
} from "./auditValueFormatters"

export type AuditRecord = Record<string, unknown>

export interface SessionAuditData {
  detail: AuditRecord | null
  dashboard: AuditRecord | null
  dashboardSummary: AuditRecord | null
  sessionDashboard: AuditRecord | null
  documents: AuditRecord[]
  documentTotal: number
  metadataVersionCount: number
  pendingMetadataDocuments: AuditRecord[]
  numberedDocumentCount: number
  dossiers: AuditRecord[]
  unclassifiedDossiers: AuditRecord[]
  dossierDrafts: AuditRecord[]
  pendingClusterDocuments: AuditRecord[]
  files: AuditRecord[]
  artifacts: AuditRecord[]
  planVersions: AuditRecord[]
  planVersionDetails: AuditRecord[]
  planGroups: AuditRecord[]
  clusterVersions: AuditRecord[]
  numbering: AuditRecord | null
  numberingDocuments: AuditRecord[]
  numberingDocumentVersions: AuditRecord[]
  events: AuditRecord[]
  relatedJobs: AuditRecord[]
  jobStatusCounts: Record<string, number>
}

export function buildSessionAuditData(
  sessionId: string,
  results: Record<string, AuditRequestResult>
): SessionAuditData {
  const detail = resultRecord(results, "session-detail")
  const dashboard = resultRecord(results, "admin-dashboard")
  const dashboardSummary = asRecord(dashboard?.summary)
  const sessionDashboard =
    asRecords(dashboard?.sessions).find(
      (item) => text(item.session_id) === sessionId
    ) ?? null
  const backupDocuments = resultRecord(results, "backup-documents")
  const digitization = resultRecord(results, "digitization")
  const documents = asRecords(backupDocuments?.documents).length
    ? asRecords(backupDocuments?.documents)
    : asRecords(digitization?.documents)
  const documentPagination =
    asRecord(backupDocuments?.pagination) ?? asRecord(digitization?.pagination)
  const backupCore = resultRecord(results, "backup-core")
  const coreDossierFormation = asRecord(backupCore?.dossier_formation)
  const coreNumbering = asRecord(backupCore?.numbering)
  const dossierPayload = resultRecord(results, "dossiers")
  const unclassifiedPayload = resultRecord(results, "unclassified-dossiers")
  const draftPayload = resultRecord(results, "dossier-drafts")
  const coreDrafts = asRecords(coreDossierFormation?.dossier_drafts)
  const pagedDrafts = asRecords(draftPayload?.drafts)
  const pendingClusterPayload = resultRecord(results, "clustering-pending")
  const sourceFilePayload = resultRecord(results, "backup-source-files")
  const plansPayload = resultRecord(results, "plan-versions")
  const backupPlansPayload = resultRecord(results, "backup-plans")
  const backupPlans = asRecord(backupPlansPayload?.plans)
  const clusterVersionsPayload = resultRecord(results, "cluster-versions")
  const numbering = resultRecord(results, "numbering-status")
  const numberingDocumentsPayload = resultRecord(results, "numbering-documents")
  const eventPayload = resultRecord(results, "events")
  const artifactPayload = resultRecord(results, "artifacts")
  const files = asRecords(sourceFilePayload?.files).length
    ? asRecords(sourceFilePayload?.files)
    : asRecords(detail?.files)

  return {
    detail,
    dashboard,
    dashboardSummary,
    sessionDashboard,
    documents,
    documentTotal: finiteNumber(documentPagination?.total) ?? documents.length,
    metadataVersionCount: documents.reduce(
      (total, document) => total + documentMetadataVersions(document).length,
      0
    ),
    pendingMetadataDocuments: documents.filter(documentNeedsMetadataReview),
    numberedDocumentCount: documents.filter(documentHasNumberedPdf).length,
    dossiers: asRecords(dossierPayload?.dossiers),
    unclassifiedDossiers: asRecords(unclassifiedPayload?.dossiers),
    dossierDrafts: coreDrafts.length ? coreDrafts : pagedDrafts,
    pendingClusterDocuments: asRecords(pendingClusterPayload?.items),
    files,
    artifacts: asRecords(artifactPayload?.artifacts).length
      ? asRecords(artifactPayload?.artifacts)
      : asRecords(backupCore?.artifacts),
    planVersions: asRecords(plansPayload?.versions),
    planVersionDetails: asRecords(backupPlans?.versions),
    planGroups: asRecords(backupPlans?.classification_groups),
    clusterVersions: extractVersionRecords(clusterVersionsPayload),
    numbering,
    numberingDocuments: asRecords(numberingDocumentsPayload?.documents),
    numberingDocumentVersions: asRecords(coreNumbering?.document_versions),
    events: asRecords(eventPayload?.events),
    relatedJobs: collectRelatedJobs(results, detail, numbering),
    jobStatusCounts: asNumberRecord(dashboard?.job_status_counts),
  }
}

export function resultRecord(
  results: Record<string, AuditRequestResult>,
  endpointId: string
): AuditRecord | null {
  return asRecord(results[endpointId]?.data)
}

export function documentRecord(document: AuditRecord): AuditRecord {
  return asRecord(document.record) ?? document
}

export function documentMetadata(document: AuditRecord): AuditRecord | null {
  return asRecord(asRecord(document.metadata)?.normalized)
}

export function documentMetadataVersions(document: AuditRecord): AuditRecord[] {
  return asRecords(asRecord(document.metadata)?.versions)
}

export function documentName(document: AuditRecord): string {
  const record = documentRecord(document)
  return (
    text(document.file_name) ||
    text(record.file_name) ||
    `Tài liệu ${text(document.session_document_id ?? record.id)}`
  )
}

export function documentSessionId(document: AuditRecord): string {
  const record = documentRecord(document)
  return text(document.session_document_id ?? record.id)
}

export function documentNeedsMetadataReview(document: AuditRecord): boolean {
  const record = documentRecord(document)
  const status = text(
    record.review_status ??
      record.metadata_review_status ??
      record.metadata_status
  ).toLowerCase()
  if (["verified", "approved", "done", "completed"].includes(status))
    return false
  if (record.metadata_verified_at) return false
  if (
    [
      "pending",
      "review",
      "needs_review",
      "ready_for_review",
      "unverified",
    ].includes(status)
  ) {
    return true
  }
  return Boolean(record.metadata_ready)
}

export function documentHasNumberedPdf(document: AuditRecord): boolean {
  const numbered = asRecord(asRecord(document.pdfs)?.numbered)
  if (numbered?.available === true) return true
  const status = asRecord(document.numbering_status)
  const payload = asRecord(status?.payload)
  const numbering = asRecord(payload?.numbering) ?? payload
  return Boolean(
    numbering?.numbered_pdf_version_id ||
    numbering?.result_version_id ||
    status?.numbered_pdf_version_id ||
    status?.result_version_id
  )
}

export function recordIdentifier(record: AuditRecord): string {
  return text(
    record.session_document_id ??
      record.document_id ??
      record.dossier_id ??
      record.id ??
      record.job_id
  )
}

function extractVersionRecords(payload: AuditRecord | null): AuditRecord[] {
  if (!payload) return []
  for (const key of ["versions", "cluster_versions", "items"]) {
    const records = asRecords(payload[key])
    if (records.length) return records
  }
  return []
}

function collectRelatedJobs(
  results: Record<string, AuditRequestResult>,
  detail: AuditRecord | null,
  numbering: AuditRecord | null
): AuditRecord[] {
  const jobs: AuditRecord[] = []
  const add = (value: unknown, fallbackType?: string) => {
    const record = asRecord(value)
    if (!record) return
    const normalized =
      fallbackType && !record.job_type
        ? { ...record, job_type: fallbackType }
        : record
    const key = text(normalized.id ?? normalized.job_id)
    if (key && jobs.some((job) => text(job.id ?? job.job_id) === key)) return
    jobs.push(normalized)
  }

  add(detail?.active_plan_analysis_job, "analyze_plan")
  const clusterBuild = resultRecord(results, "cluster-build")
  add(clusterBuild?.job, "build_clusters")
  if (clusterBuild?.job_id && !clusterBuild.job)
    add(clusterBuild, "build_clusters")
  asRecords(numbering?.active_jobs).forEach((job) =>
    add(job, "number_documents")
  )
  add(numbering?.job, "number_documents")
  const finalize = resultRecord(results, "finalize-status")
  add(finalize?.job, "finalize_artifacts")
  if (finalize?.job_id && !finalize.job) add(finalize, "finalize_artifacts")
  return jobs
}
