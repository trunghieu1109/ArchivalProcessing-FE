import type { ChinhlyUser } from "@/features/auth/api/authApi"
import type {
  ActiveJobSummary,
  SessionDetailResponse,
  SessionSummary,
} from "@/features/upload/api/sessionApi"

const ACTIVE_PLAN_JOB_STATUSES = new Set(["scheduled", "queued", "running"])

export type SourceAnalysisStatus =
  | "Chưa có"
  | "Đang phân tích"
  | "Đã phân tích"

export interface SessionAnalysisStatuses {
  arrangement: SourceAnalysisStatus
  retention: SourceAnalysisStatus
}

export function chinhlyUserId(user: ChinhlyUser): string {
  return String(user.id ?? user.user_id ?? "").trim()
}

export function normalizedRole(role: unknown): string {
  return String(role || "")
    .trim()
    .toLowerCase()
}

export function fallbackAnalysisStatuses(
  session: Pick<SessionSummary, "active_plan_version_id">
): SessionAnalysisStatuses {
  const status = session.active_plan_version_id ? "Đã phân tích" : "Chưa có"
  return {
    arrangement: status,
    retention: status,
  }
}

export function analysisStatusesFromSessionDetail(
  detail: SessionDetailResponse
): SessionAnalysisStatuses {
  const activeJob = isActivePlanAnalysisJob(detail.active_plan_analysis_job)
    ? detail.active_plan_analysis_job
    : null
  const hasActivePlan = Boolean(detail.active_plan_version_id)
  const hasArrangementPlan = detail.files.some(
    (file) => file.file_type === "arrangement_plan"
  )
  const hasRetentionSchedule = detail.files.some(
    (file) => file.file_type === "retention_schedule"
  )

  return {
    arrangement: sourceAnalysisStatus({
      analyzed: hasActivePlan && hasArrangementPlan,
      processing: activeJob ? jobPayloadHasFile(activeJob, "plan_file") : false,
    }),
    retention: sourceAnalysisStatus({
      analyzed: hasActivePlan && hasRetentionSchedule,
      processing: activeJob
        ? jobPayloadHasFile(activeJob, "retention_file") ||
          jobPayloadHasFile(activeJob, "retention_files")
        : false,
    }),
  }
}

function isActivePlanAnalysisJob(
  job: ActiveJobSummary | null | undefined
): job is ActiveJobSummary {
  return (
    Boolean(job) &&
    job?.job_type === "analyze_plan" &&
    ACTIVE_PLAN_JOB_STATUSES.has(String(job?.status ?? ""))
  )
}

function jobPayloadHasFile(job: ActiveJobSummary, key: string): boolean {
  const value = job.payload?.[key]
  if (Array.isArray(value)) {
    return value.some(
      (item) => typeof item === "string" && item.trim().length > 0
    )
  }
  return typeof value === "string" && value.trim().length > 0
}

function sourceAnalysisStatus({
  analyzed,
  processing,
}: {
  analyzed: boolean
  processing: boolean
}): SourceAnalysisStatus {
  if (processing) return "Đang phân tích"
  if (analyzed) return "Đã phân tích"
  return "Chưa có"
}
