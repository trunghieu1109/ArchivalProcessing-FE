import { requestJson } from "./sessionApi.http"

export type SessionBackupProgress = {
  stage: "manifest" | "data" | "source-files" | "documents" | "artifacts"
  processedDocuments: number
  totalDocuments: number
  batchNumber: number
}

export type SessionBackupManifest = {
  schema_version: number
  session_id: string
  generated_at: string
  source_fingerprint: string
  counts: Record<string, number>
  [key: string]: unknown
}

export type SessionBackupDocumentPage = {
  schema_version: number
  session_id: string
  generated_at: string
  pagination: {
    after_id: number
    limit: number
    returned: number
    total: number
    has_more: boolean
    next_after_id: number | null
  }
  variants: string[]
  documents: Array<Record<string, unknown>>
}

export type SessionBackupUrlExport = {
  schema_version: number
  session_id: string
  exported_at: string
  note: string
  source_changed_during_export: boolean
  manifest_initial: SessionBackupManifest
  manifest_final: SessionBackupManifest
  data: Record<string, unknown>
  source_files: Record<string, unknown>
  documents: Array<Record<string, unknown>>
  artifacts: Record<string, unknown>
}

export function getSessionBackupManifest(
  sessionId: string
): Promise<SessionBackupManifest> {
  return requestJson<SessionBackupManifest>(
    `/sessions/${encodeURIComponent(sessionId)}/backup/manifest`
  )
}

export function getSessionBackupData(
  sessionId: string
): Promise<Record<string, unknown>> {
  return requestJson<Record<string, unknown>>(
    `/sessions/${encodeURIComponent(sessionId)}/backup/data`
  )
}

export function getSessionBackupSourceFiles(
  sessionId: string
): Promise<Record<string, unknown>> {
  return requestJson<Record<string, unknown>>(
    `/sessions/${encodeURIComponent(sessionId)}/backup/source-files`
  )
}

export function getSessionBackupArtifacts(
  sessionId: string
): Promise<Record<string, unknown>> {
  return requestJson<Record<string, unknown>>(
    `/sessions/${encodeURIComponent(sessionId)}/backup/artifacts`
  )
}

export function getSessionBackupDocuments(
  sessionId: string,
  options: { afterId?: number; limit?: number } = {}
): Promise<SessionBackupDocumentPage> {
  const query = new URLSearchParams({
    after_id: String(Math.max(0, options.afterId ?? 0)),
    limit: String(Math.min(500, Math.max(1, options.limit ?? 100))),
    variants: "original,blank_removed,numbered",
    include_metadata_versions: "true",
  })
  return requestJson<SessionBackupDocumentPage>(
    `/sessions/${encodeURIComponent(sessionId)}/backup/documents?${query.toString()}`
  )
}

export async function collectSessionBackupUrls(
  sessionId: string,
  onProgress?: (progress: SessionBackupProgress) => void
): Promise<SessionBackupUrlExport> {
  const initialManifest = await getSessionBackupManifest(sessionId)
  const totalDocuments = initialManifest.counts.documents ?? 0
  onProgress?.({
    stage: "manifest",
    processedDocuments: 0,
    totalDocuments,
    batchNumber: 0,
  })

  const data = await getSessionBackupData(sessionId)
  onProgress?.({
    stage: "data",
    processedDocuments: 0,
    totalDocuments,
    batchNumber: 0,
  })
  const sourceFiles = await getSessionBackupSourceFiles(sessionId)
  onProgress?.({
    stage: "source-files",
    processedDocuments: 0,
    totalDocuments,
    batchNumber: 0,
  })

  const documents: Array<Record<string, unknown>> = []
  let afterId = 0
  let batchNumber = 0
  while (true) {
    batchNumber += 1
    const page = await getSessionBackupDocuments(sessionId, {
      afterId,
      limit: 100,
    })
    documents.push(...page.documents)
    onProgress?.({
      stage: "documents",
      processedDocuments: documents.length,
      totalDocuments: page.pagination.total || totalDocuments,
      batchNumber,
    })
    if (!page.pagination.has_more) break
    const nextAfterId = page.pagination.next_after_id
    if (nextAfterId === null || nextAfterId <= afterId) {
      throw new Error(
        "Phân trang backup document không thể chuyển sang batch tiếp theo."
      )
    }
    afterId = nextAfterId
  }

  const artifacts = await getSessionBackupArtifacts(sessionId)
  onProgress?.({
    stage: "artifacts",
    processedDocuments: documents.length,
    totalDocuments,
    batchNumber,
  })
  const finalManifest = await getSessionBackupManifest(sessionId)

  return {
    schema_version: initialManifest.schema_version,
    session_id: sessionId,
    exported_at: new Date().toISOString(),
    note: "File JSON này chỉ chứa dữ liệu backup và URL tải có thời hạn; không nhúng nội dung PDF.",
    source_changed_during_export:
      initialManifest.source_fingerprint !== finalManifest.source_fingerprint,
    manifest_initial: initialManifest,
    manifest_final: finalManifest,
    data,
    source_files: sourceFiles,
    documents,
    artifacts,
  }
}
