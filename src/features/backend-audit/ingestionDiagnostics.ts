export type IngestionDiagnosticSeverity =
  | "healthy"
  | "info"
  | "warning"
  | "critical"

export interface IngestionDiagnosticFinding {
  code: string
  severity: Exclude<IngestionDiagnosticSeverity, "healthy">
  title: string
  detail: string
}

export interface IngestionRunDiagnostic {
  run: Record<string, unknown>
  batches: Array<Record<string, unknown>>
  severity: IngestionDiagnosticSeverity
  findings: IngestionDiagnosticFinding[]
  totalFiles: number | null
  handledFiles: number
  progressPercent: number | null
  lastActivityAt: string | null
}

const ACTIVE_RUN_STATUSES = new Set([
  "extract_starting",
  "extracting",
  "legacy_unknown",
])
const FAILED_RUN_STATUSES = new Set([
  "extract_failed",
  "failed",
  "error",
  "cancelled",
  "canceled",
])
const TERMINAL_BATCH_STATUSES = new Set([
  "done",
  "completed",
  "completed_with_errors",
  "failed",
  "cancelled",
  "canceled",
])
const FAILED_BATCH_STATUSES = new Set([
  "failed",
  "error",
  "cancelled",
  "canceled",
])
const STALE_ACTIVE_MS = 15 * 60 * 1_000

export function diagnoseIngestionRuns(
  runs: Array<Record<string, unknown>>,
  batches: Array<Record<string, unknown>>,
  now = Date.now()
): IngestionRunDiagnostic[] {
  return runs.map((run) => diagnoseIngestionRun(run, batches, now))
}

export function diagnoseIngestionRun(
  run: Record<string, unknown>,
  allBatches: Array<Record<string, unknown>>,
  now = Date.now()
): IngestionRunDiagnostic {
  const runId = numberOrNull(run.id)
  const explicitBatchIds = new Set(
    arrayValues(run.ocr_batch_ids)
      .map(numberOrNull)
      .filter((value): value is number => value !== null)
  )
  const batches = allBatches.filter((batch) => {
    const batchRunId = numberOrNull(batch.ingestion_run_id)
    const batchId = numberOrNull(batch.id)
    return (
      (runId !== null && batchRunId === runId) ||
      (batchId !== null && explicitBatchIds.has(batchId))
    )
  })
  const findings: IngestionDiagnosticFinding[] = []
  const status = normalized(run.status)
  const ingestionSource = normalized(run.ingestion_source)
  const totalFiles = numberOrNull(run.total_pdf_files)
  const extracted = positiveNumber(run.extracted_count)
  const skipped = positiveNumber(run.skipped_count)
  const handledFiles = extracted + skipped
  const lastActivityAt = newestTimestamp([
    run.heartbeat_at,
    run.last_polled_at,
    run.updated_at,
    run.extract_started_at,
    run.created_at,
  ])
  const lastActivityAgeMs = ageMs(lastActivityAt, now)

  if (FAILED_RUN_STATUSES.has(status) || text(run.error)) {
    findings.push({
      code: "extract_failed",
      severity: "critical",
      title: "Bước extract thất bại",
      detail:
        text(run.error) ||
        `Ingestion run đang ở trạng thái ${status || "không xác định"}.`,
    })
  }

  if (ACTIVE_RUN_STATUSES.has(status) && lastActivityAgeMs !== null) {
    if (lastActivityAgeMs > STALE_ACTIVE_MS) {
      findings.push({
        code: "stale_activity",
        severity: "critical",
        title: "Run có dấu hiệu bị treo",
        detail: `Không ghi nhận heartbeat/poll/cập nhật trong ${durationText(lastActivityAgeMs)}.`,
      })
    } else if (lastActivityAgeMs > STALE_ACTIVE_MS / 2) {
      findings.push({
        code: "slow_activity",
        severity: "warning",
        title: "Run cập nhật chậm",
        detail: `Hoạt động gần nhất cách đây ${durationText(lastActivityAgeMs)}.`,
      })
    }
  }

  if (
    status !== "extract_starting" &&
    ingestionSource &&
    !text(run.remote_ingestion_batch_id) &&
    ingestionSource !== "folder"
  ) {
    findings.push({
      code: "missing_remote_batch",
      severity: "critical",
      title: "Thiếu remote ingestion batch ID",
      detail:
        "Không thể đối chiếu run này với batch trên dịch vụ ingestion từ xa.",
    })
  }

  if (ACTIVE_RUN_STATUSES.has(status) && !text(run.remote_extract_job_id)) {
    findings.push({
      code: "missing_extract_job",
      severity: "warning",
      title: "Chưa có remote extract job ID",
      detail: "Run đã active nhưng chưa liên kết được job extract từ xa.",
    })
  }

  if (status === "ready" && totalFiles !== null && handledFiles < totalFiles) {
    findings.push({
      code: "extract_count_mismatch",
      severity: "warning",
      title: "Số lượng extract chưa khớp",
      detail: `Run báo ready nhưng mới xử lý ${handledFiles}/${totalFiles} PDF.`,
    })
  }

  if (
    status === "ready" &&
    totalFiles !== null &&
    totalFiles > 0 &&
    extracted === 0
  ) {
    findings.push({
      code: "empty_extract",
      severity: "critical",
      title: "Không extract được tài liệu nào",
      detail: `Có ${totalFiles} PDF đầu vào nhưng extracted_count bằng 0.`,
    })
  }

  if (status === "ready" && batches.length === 0) {
    findings.push({
      code: "missing_ocr_batch",
      severity: "warning",
      title: "Chưa tạo OCR batch",
      detail: "Extract đã sẵn sàng nhưng không tìm thấy OCR batch liên kết.",
    })
  }

  for (const batch of batches) {
    diagnoseBatch(batch, now).forEach((finding) => findings.push(finding))
  }

  return {
    run,
    batches,
    severity: highestSeverity(findings),
    findings,
    totalFiles,
    handledFiles,
    progressPercent:
      totalFiles && totalFiles > 0
        ? Math.min(100, Math.round((handledFiles / totalFiles) * 100))
        : null,
    lastActivityAt,
  }
}

function diagnoseBatch(
  batch: Record<string, unknown>,
  now: number
): IngestionDiagnosticFinding[] {
  const findings: IngestionDiagnosticFinding[] = []
  const id = text(batch.id) || "?"
  const status = normalized(batch.status)
  const metadataStatus = normalized(batch.metadata_extraction_status)
  const updatedAgeMs = ageMs(text(batch.updated_at), now)

  if (FAILED_BATCH_STATUSES.has(status) || text(batch.error)) {
    findings.push({
      code: `batch_${id}_failed`,
      severity: "critical",
      title: `OCR batch #${id} thất bại`,
      detail: text(batch.error) || `Batch đang ở trạng thái ${status}.`,
    })
  } else if (status === "completed_with_errors") {
    findings.push({
      code: `batch_${id}_partial`,
      severity: "warning",
      title: `OCR batch #${id} hoàn tất có lỗi`,
      detail:
        "Một phần tài liệu hoặc metadata trong batch không xử lý thành công.",
    })
  }

  if (
    TERMINAL_BATCH_STATUSES.has(status) &&
    batch.remote_discovery_complete === false
  ) {
    findings.push({
      code: `batch_${id}_discovery`,
      severity: "warning",
      title: `OCR batch #${id} chưa hoàn tất discovery`,
      detail: "Batch đã kết thúc nhưng remote_discovery_complete vẫn là false.",
    })
  }

  if (
    TERMINAL_BATCH_STATUSES.has(status) &&
    metadataStatus &&
    !["ready", "completed", "completed_with_errors"].includes(metadataStatus)
  ) {
    findings.push({
      code: `batch_${id}_metadata`,
      severity: metadataStatus === "failed" ? "critical" : "warning",
      title: `Metadata batch #${id} chưa hoàn tất`,
      detail: `OCR đã kết thúc nhưng metadata_extraction_status là ${metadataStatus}.`,
    })
  }

  if (
    TERMINAL_BATCH_STATUSES.has(status) &&
    batch.metadata_submitted === true &&
    !metadataStatus
  ) {
    findings.push({
      code: `batch_${id}_metadata_status_missing`,
      severity: "warning",
      title: `Metadata batch #${id} thiếu trạng thái`,
      detail:
        "Batch đã gửi metadata nhưng backend không trả metadata_extraction_status.",
    })
  }

  if (
    !TERMINAL_BATCH_STATUSES.has(status) &&
    updatedAgeMs !== null &&
    updatedAgeMs > STALE_ACTIVE_MS
  ) {
    findings.push({
      code: `batch_${id}_stale`,
      severity: "warning",
      title: `OCR batch #${id} không cập nhật`,
      detail: `Batch chưa kết thúc và không cập nhật trong ${durationText(updatedAgeMs)}.`,
    })
  }
  return findings
}

function highestSeverity(
  findings: IngestionDiagnosticFinding[]
): IngestionDiagnosticSeverity {
  if (findings.some((item) => item.severity === "critical")) return "critical"
  if (findings.some((item) => item.severity === "warning")) return "warning"
  if (findings.some((item) => item.severity === "info")) return "info"
  return "healthy"
}

function newestTimestamp(values: unknown[]): string | null {
  const timestamps = values
    .map(text)
    .filter(Boolean)
    .map((value) => ({ value, time: Date.parse(value) }))
    .filter((item) => Number.isFinite(item.time))
    .sort((left, right) => right.time - left.time)
  return timestamps[0]?.value ?? null
}

function ageMs(value: string | null, now: number): number | null {
  if (!value) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? Math.max(0, now - timestamp) : null
}

function durationText(milliseconds: number): string {
  const minutes = Math.max(1, Math.round(milliseconds / 60_000))
  if (minutes < 60) return `${minutes} phút`
  const hours = Math.round((minutes / 60) * 10) / 10
  return `${hours} giờ`
}

function arrayValues(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function numberOrNull(value: unknown): number | null {
  const number = Number(value)
  return value !== null && value !== "" && Number.isFinite(number)
    ? number
    : null
}

function positiveNumber(value: unknown): number {
  return Math.max(0, numberOrNull(value) ?? 0)
}

function normalized(value: unknown): string {
  return text(value).toLowerCase()
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : ""
}
