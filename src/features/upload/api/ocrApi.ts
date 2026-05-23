const BASE_URL = "https://thuy8088.iselab.site"

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

export async function startFolderPreview(req: FolderPreviewRequest): Promise<FolderPreviewResponse> {
  const res = await fetch(`${BASE_URL}/ocr/preview/folder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export async function getFilePreview(data_path: string): Promise<JobSummary> {
  const params = new URLSearchParams({ data_path, include_text: "false", include_page_texts: "false" })
  const res = await fetch(`${BASE_URL}/ocr/preview/by-path?${params}`)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export async function getFolderStatus(
  folder_path: string,
  recursive = true,
  max_files = 100,
): Promise<FolderStatusResponse> {
  const params = new URLSearchParams({
    folder_path,
    recursive: String(recursive),
    max_files: String(max_files),
  })
  const res = await fetch(`${BASE_URL}/ocr/preview/folder/status?${params}`)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}
