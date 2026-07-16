import { requestJson } from "@/features/upload/api/sessionApi.http"

export interface AdminDashboardSummary {
  session_count: number
  assigned_session_count: number
  unassigned_session_count: number
  document_count: number
  ocr_total_file_count: number
  uploaded_document_count: number
  uploaded_file_count: number
  raw_upload_count: number
  dossier_count: number
  artifact_count: number
  job_count: number
  queued_job_count: number
  failed_job_count: number
}

export interface AdminDashboardStatusCount {
  status: string
  count: number
}

export interface AdminDashboardSession {
  session_id: string
  status: string
  archive_name?: string | null
  fonds_name?: string | null
  fonds_creator_code?: string | null
  coordinator_user_id?: string | null
  active_plan_version_id?: string | null
  review_plan_version_id?: string | null
  active_cluster_version_id?: string | null
  created_at: string
  updated_at: string
  uploaded_file_count: number
  raw_upload_count: number
  document_count: number
  ocr_total_file_count: number
  uploaded_document_count: number
  dossier_count: number
  artifact_count: number
  queued_job_count: number
  failed_job_count: number
}

export interface AdminDashboardResponse {
  generated_at: string
  summary: AdminDashboardSummary
  session_status_counts: AdminDashboardStatusCount[]
  job_status_counts: AdminDashboardStatusCount[]
  sessions: AdminDashboardSession[]
  pagination: {
    total: number
    limit: number
    returned: number
    sort: string
  }
}

export async function getAdminDashboard(
  options: { limit?: number } = {}
): Promise<AdminDashboardResponse> {
  const query = new URLSearchParams()
  query.set("limit", String(Math.min(Math.max(options.limit ?? 120, 1), 500)))
  return requestJson<AdminDashboardResponse>(
    `/admin/dashboard?${query.toString()}`
  )
}
