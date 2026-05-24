// All API types kept for type compatibility — no real network calls are made.

export interface FolderPreviewRequest {
  folder_path: string
  recursive: boolean
  max_files: number
  metadata_fields: string[]
  force: boolean
}

export interface JobSummary {
  id: number
  data_path: string
  status: string
  light_metadata?: Record<string, unknown>
}

export interface FolderPreviewResponse {
  folder_path: string
  recursive: boolean
  total_files: number
  job_ids: number[]
  jobs: JobSummary[]
}

export interface FolderStatusResponse {
  folder_path: string
  recursive: boolean
  total_files: number
  total_jobs: number
  missing_files: string[]
  status_counts: Record<string, number>
  jobs: JobSummary[]
}
