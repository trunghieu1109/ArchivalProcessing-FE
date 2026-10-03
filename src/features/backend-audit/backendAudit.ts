export type AuditAuthMode = "none" | "bearer" | "api-key"

export type AuditCategoryId =
  | "infrastructure"
  | "fonds"
  | "ocr"
  | "classification"
  | "dossiers"
  | "numbering"
  | "operations"
  | "evidence"

export interface AuditConnectionConfig {
  baseUrl: string
  authMode: AuditAuthMode
  credential: string
  apiKeyHeader: string
}

export interface AuditEndpoint {
  id: string
  category: AuditCategoryId
  title: string
  description: string
  path: string | ((sessionId: string) => string)
  requiresSession?: boolean
}

export const SESSION_AUDIT_ENDPOINT_IDS = [
  "session-detail",
  "digitization",
  "backup-manifest",
  "backup-core",
  "plan-versions",
  "backup-plans",
  "cluster-build",
  "active-plan",
  "active-clusters",
  "cluster-versions",
  "dossiers",
  "unclassified-dossiers",
  "dossier-drafts",
  "clustering-pending",
  "numbering-status",
  "numbering-documents",
  "events",
  "artifacts",
  "finalize-status",
  "backup-source-files",
  "backup-documents",
] as const

export interface AuditRequestResult {
  endpointId: string
  endpointTitle: string
  path: string
  url: string
  requestedAt: string
  status: number | null
  statusText: string
  ok: boolean
  durationMs: number
  sizeBytes: number
  headers: Record<string, string>
  data: unknown
  error: string | null
}

export interface AuditSessionSummary {
  session_id: string
  fonds_name?: string | null
  fonds_creator_code?: string | null
  archive_name?: string | null
  status?: string | null
  document_count?: number | null
  dossier_count?: number | null
  updated_at?: string | null
  [key: string]: unknown
}

export const AUDIT_CATEGORIES: Array<{
  id: AuditCategoryId
  label: string
  description: string
}> = [
  {
    id: "infrastructure",
    label: "Hạ tầng",
    description: "Sức khỏe dịch vụ và số liệu vận hành tổng quan.",
  },
  {
    id: "fonds",
    label: "Phông tài liệu",
    description: "Danh sách phông, metadata và dữ liệu đầu vào của session.",
  },
  {
    id: "ocr",
    label: "OCR & metadata",
    description: "Tiến độ số hóa, trạng thái OCR và kiểm duyệt metadata.",
  },
  {
    id: "classification",
    label: "Lập hồ sơ",
    description: "Trạng thái build, phiên bản phân cụm và phương án đang dùng.",
  },
  {
    id: "dossiers",
    label: "Hồ sơ",
    description: "Danh sách hồ sơ, hồ sơ chưa phân loại và publication.",
  },
  {
    id: "numbering",
    label: "Đánh số trang",
    description:
      "Cấu hình đánh số, trạng thái tài liệu và các phiên bản PDF đã sinh.",
  },
  {
    id: "operations",
    label: "Job & sự kiện",
    description: "Thống kê hàng đợi, job gắn với session và nhật ký nghiệp vụ.",
  },
  {
    id: "evidence",
    label: "Dấu vết audit",
    description: "Event, artifact và dữ liệu phục vụ truy vết.",
  },
]

export const AUDIT_ENDPOINTS: AuditEndpoint[] = [
  {
    id: "health",
    category: "infrastructure",
    title: "Sức khỏe dịch vụ",
    description: "Kiểm tra API có phản hồi và xác định độ trễ cơ bản.",
    path: "/health",
  },
  {
    id: "admin-dashboard",
    category: "infrastructure",
    title: "Dashboard vận hành",
    description: "Tổng session, tài liệu, hồ sơ, job lỗi và job đang chờ.",
    path: "/api/admin/dashboard?limit=500",
  },
  {
    id: "sessions",
    category: "fonds",
    title: "Danh sách phông",
    description: "Tải tối đa 200 session/phông gần nhất để chọn và audit.",
    path: "/api/sessions?limit=200&offset=0",
  },
  {
    id: "session-detail",
    category: "fonds",
    title: "Chi tiết phông",
    description: "Metadata phông, file đầu vào và phiên bản đang hoạt động.",
    path: (sessionId) => `/api/sessions/${encodeURIComponent(sessionId)}`,
    requiresSession: true,
  },
  {
    id: "backup-manifest",
    category: "fonds",
    title: "Kiểm kê dữ liệu session",
    description:
      "Tổng số bản ghi theo nhóm dữ liệu để biết phạm vi audit và phần còn phân trang.",
    path: (sessionId) =>
      `/api/sessions/${encodeURIComponent(sessionId)}/backup/manifest`,
    requiresSession: true,
  },
  {
    id: "backup-source-files",
    category: "fonds",
    title: "File nguồn và liên kết tải",
    description:
      "File đầu vào kèm trạng thái lưu trữ và liên kết tải nếu backend hỗ trợ.",
    path: (sessionId) =>
      `/api/sessions/${encodeURIComponent(sessionId)}/backup/source-files`,
    requiresSession: true,
  },
  {
    id: "digitization",
    category: "ocr",
    title: "Trạng thái OCR",
    description:
      "Tổng quan OCR, ingestion run, batch và tối đa 200 tài liệu để inspect.",
    path: (sessionId) =>
      `/api/sessions/${encodeURIComponent(sessionId)}/digitization?include_documents=true&summary_only=false&limit=200&offset=0`,
    requiresSession: true,
  },
  {
    id: "backup-documents",
    category: "ocr",
    title: "Tài liệu, metadata và PDF đánh số",
    description:
      "Tối đa 500 tài liệu cùng metadata chuẩn hóa, lịch sử metadata và phiên bản PDF đánh số hiện tại.",
    path: (sessionId) =>
      `/api/sessions/${encodeURIComponent(sessionId)}/backup/documents?after_id=0&limit=500&variants=numbered&include_metadata_versions=true`,
    requiresSession: true,
  },
  {
    id: "backup-core",
    category: "ocr",
    title: "Dữ liệu lõi phục vụ audit",
    description:
      "Draft hồ sơ, lịch sử đánh số, document operation, feedback và artifact của session.",
    path: (sessionId) =>
      `/api/sessions/${encodeURIComponent(sessionId)}/backup/data/core`,
    requiresSession: true,
  },
  {
    id: "cluster-build",
    category: "classification",
    title: "Tiến trình lập hồ sơ",
    description: "Trạng thái job build hồ sơ và checkpoint xử lý.",
    path: (sessionId) =>
      `/api/sessions/${encodeURIComponent(sessionId)}/clustering/build/status`,
    requiresSession: true,
  },
  {
    id: "active-plan",
    category: "classification",
    title: "Phương án hiện hành",
    description: "Phương án chỉnh lý đang được kích hoạt cho phông.",
    path: (sessionId) =>
      `/api/sessions/${encodeURIComponent(sessionId)}/plan/active`,
    requiresSession: true,
  },
  {
    id: "plan-versions",
    category: "classification",
    title: "Các phiên bản phương án",
    description:
      "Danh sách đầy đủ phiên bản phương án, trạng thái, nguồn và cấu hình đánh số.",
    path: (sessionId) =>
      `/api/sessions/${encodeURIComponent(sessionId)}/plan/versions`,
    requiresSession: true,
  },
  {
    id: "backup-plans",
    category: "classification",
    title: "Chi tiết 10 phương án đầu",
    description:
      "Nhóm phân loại, mục lục thời hạn bảo quản và đơn vị bảo quản cho tối đa 10 version mỗi trang.",
    path: (sessionId) =>
      `/api/sessions/${encodeURIComponent(sessionId)}/backup/data/plans?after_version_number=0&limit=10`,
    requiresSession: true,
  },
  {
    id: "active-clusters",
    category: "classification",
    title: "Phiên bản phân cụm",
    description:
      "Thống kê phiên bản cluster đang hoạt động, không tải cây lớn.",
    path: (sessionId) =>
      `/api/sessions/${encodeURIComponent(sessionId)}/clusters/active?summary_only=true&include_clusters=false`,
    requiresSession: true,
  },
  {
    id: "cluster-versions",
    category: "classification",
    title: "Các phiên bản lập hồ sơ",
    description:
      "Danh sách phiên bản cluster để đối chiếu version đang hoạt động và lịch sử build.",
    path: (sessionId) =>
      `/api/sessions/${encodeURIComponent(sessionId)}/clusters/versions`,
    requiresSession: true,
  },
  {
    id: "dossiers",
    category: "dossiers",
    title: "Danh sách hồ sơ",
    description: "Toàn bộ hồ sơ đã hình thành trong phiên bản hiện hành.",
    path: (sessionId) =>
      `/api/sessions/${encodeURIComponent(sessionId)}/dossiers`,
    requiresSession: true,
  },
  {
    id: "unclassified-dossiers",
    category: "dossiers",
    title: "Hồ sơ chờ phân loại",
    description: "Các hồ sơ chưa gắn được vào nhánh phương án chỉnh lý.",
    path: (sessionId) =>
      `/api/sessions/${encodeURIComponent(sessionId)}/dossiers?scope=unclassified`,
    requiresSession: true,
  },
  {
    id: "dossier-drafts",
    category: "dossiers",
    title: "Hồ sơ nháp",
    description:
      "Tối đa 200 hồ sơ nháp ở mọi trạng thái, gồm metadata và danh sách tài liệu dự kiến.",
    path: (sessionId) =>
      `/api/sessions/${encodeURIComponent(sessionId)}/dossier-drafts?status=&limit=200`,
    requiresSession: true,
  },
  {
    id: "clustering-pending",
    category: "dossiers",
    title: "Tài liệu chờ cập nhật hồ sơ",
    description:
      "Tài liệu đã ingest nhưng chưa nằm trong cluster version đang hoạt động.",
    path: (sessionId) =>
      `/api/sessions/${encodeURIComponent(sessionId)}/documents/clustering-pending?summary_only=false&limit=200`,
    requiresSession: true,
  },
  {
    id: "publication",
    category: "dossiers",
    title: "Cấu trúc công bố (chạy thủ công)",
    description:
      "API GET hiện có thể tạo/reuse publication manifest artifact, nên không được gọi trong lần quét tự động.",
    path: (sessionId) =>
      `/api/sessions/${encodeURIComponent(sessionId)}/publication`,
    requiresSession: true,
  },
  {
    id: "events",
    category: "operations",
    title: "Nhật ký sự kiện",
    description: "Tối đa 500 event theo cursor phục vụ kiểm tra luồng xử lý.",
    path: (sessionId) =>
      `/api/sessions/${encodeURIComponent(sessionId)}/events?limit=500`,
    requiresSession: true,
  },
  {
    id: "numbering-status",
    category: "numbering",
    title: "Cấu hình và tổng quan đánh số",
    description:
      "Mode, style, summary, timeline/configuration hiện tại và các job đánh số đang chạy.",
    path: (sessionId) =>
      `/api/sessions/${encodeURIComponent(sessionId)}/numbering/status?include_documents=false&summary_only=true`,
    requiresSession: true,
  },
  {
    id: "numbering-documents",
    category: "numbering",
    title: "Trạng thái đánh số theo tài liệu",
    description:
      "Tối đa 1.000 tài liệu kèm trạng thái, số trang/tờ và version PDF kết quả.",
    path: (sessionId) =>
      `/api/sessions/${encodeURIComponent(sessionId)}/numbering/documents/status?limit=1000&offset=0`,
    requiresSession: true,
  },
  {
    id: "artifacts",
    category: "evidence",
    title: "Artifact đầu ra",
    description: "Danh sách biểu mẫu, báo cáo và tài liệu đầu ra đã sinh.",
    path: (sessionId) =>
      `/api/sessions/${encodeURIComponent(sessionId)}/artifacts`,
    requiresSession: true,
  },
  {
    id: "finalize-status",
    category: "evidence",
    title: "Trạng thái hoàn tất",
    description: "Trạng thái job tạo bộ artifact cuối cùng.",
    path: (sessionId) =>
      `/api/sessions/${encodeURIComponent(sessionId)}/artifacts/finalize/status`,
    requiresSession: true,
  },
]

export function normalizeAuditBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "")
  if (!trimmed) throw new Error("Hãy nhập địa chỉ API của backend.")
  if (trimmed.startsWith("/")) return trimmed

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error(
      "Địa chỉ API phải là URL http(s) hợp lệ hoặc đường dẫn /api."
    )
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Chỉ hỗ trợ backend sử dụng giao thức HTTP hoặc HTTPS.")
  }
  return trimmed
}

export function normalizeAuditPath(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error("Hãy nhập đường dẫn endpoint.")
  if (!trimmed.startsWith("/")) return `/${trimmed}`
  if (trimmed.startsWith("//")) {
    throw new Error("Endpoint phải là đường dẫn tương đối trên backend.")
  }
  return trimmed
}

export function auditEndpointPath(
  endpoint: AuditEndpoint,
  sessionId: string
): string {
  if (typeof endpoint.path === "string") return endpoint.path
  const normalizedSessionId = sessionId.trim()
  if (!normalizedSessionId) {
    throw new Error("Hãy chọn hoặc nhập session ID trước khi gọi endpoint này.")
  }
  return endpoint.path(normalizedSessionId)
}

export function buildAuditUrl(baseUrl: string, path: string): string {
  const normalizedBase = normalizeAuditBaseUrl(baseUrl)
  const normalizedPath = normalizeAuditPath(path)
  if (normalizedBase.endsWith("/api")) {
    if (normalizedPath === "/health") {
      return `${normalizedBase.slice(0, -4)}${normalizedPath}`
    }
    if (normalizedPath === "/api" || normalizedPath.startsWith("/api/")) {
      return `${normalizedBase}${normalizedPath.slice(4)}`
    }
  }
  return `${normalizedBase}${normalizedPath}`
}

export async function runAuditRequest(
  config: AuditConnectionConfig,
  endpoint: Pick<AuditEndpoint, "id" | "title">,
  path: string,
  signal?: AbortSignal
): Promise<AuditRequestResult> {
  const normalizedPath = normalizeAuditPath(path)
  const url = buildAuditUrl(config.baseUrl, normalizedPath)
  const headers = new Headers({ Accept: "application/json" })
  const credential = config.credential.trim()
  if (config.authMode === "bearer" && credential) {
    headers.set("Authorization", `Bearer ${credential}`)
  }
  if (config.authMode === "api-key" && credential) {
    headers.set(config.apiKeyHeader.trim() || "X-API-Key", credential)
  }

  const startedAt = performance.now()
  const requestedAt = new Date().toISOString()
  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
      signal,
    })
    const text = await response.text()
    const data = parseResponseBody(text)
    const error = response.ok ? null : responseErrorMessage(response, data)
    return {
      endpointId: endpoint.id,
      endpointTitle: endpoint.title,
      path: normalizedPath,
      url,
      requestedAt,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      sizeBytes: new TextEncoder().encode(text).length,
      headers: Object.fromEntries(response.headers.entries()),
      data,
      error,
    }
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError"
    return {
      endpointId: endpoint.id,
      endpointTitle: endpoint.title,
      path: normalizedPath,
      url,
      requestedAt,
      status: null,
      statusText: aborted ? "Đã hủy" : "Không kết nối được",
      ok: false,
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      sizeBytes: 0,
      headers: {},
      data: null,
      error: aborted
        ? "Yêu cầu đã được hủy."
        : "Không thể gọi backend. Hãy kiểm tra URL, mạng, chứng chỉ HTTPS và cấu hình CORS.",
    }
  }
}

export function extractAuditSessions(data: unknown): AuditSessionSummary[] {
  if (!data || typeof data !== "object" || Array.isArray(data)) return []
  const sessions = (data as Record<string, unknown>).sessions
  if (!Array.isArray(sessions)) return []
  return sessions.filter(isAuditSessionSummary)
}

export function auditResultCount(
  result: AuditRequestResult | undefined
): number {
  if (!result) return 0
  const data = result.data
  if (Array.isArray(data)) return data.length
  if (!data || typeof data !== "object") return 0
  const record = data as Record<string, unknown>
  for (const key of [
    "sessions",
    "dossiers",
    "documents",
    "jobs",
    "events",
    "artifacts",
    "items",
  ]) {
    if (Array.isArray(record[key])) return record[key].length
  }
  const pagination = record.pagination
  if (pagination && typeof pagination === "object") {
    const total = Number((pagination as Record<string, unknown>).total)
    if (Number.isFinite(total)) return total
  }
  return 0
}

function parseResponseBody(text: string): unknown {
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function responseErrorMessage(response: Response, data: unknown): string {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const record = data as Record<string, unknown>
    if (typeof record.detail === "string") return record.detail
    if (typeof record.message === "string") return record.message
    if (record.detail !== undefined) return JSON.stringify(record.detail)
  }
  if (typeof data === "string" && data.trim()) return data.trim()
  return `Backend trả về lỗi ${response.status}${response.statusText ? ` ${response.statusText}` : ""}.`
}

function isAuditSessionSummary(value: unknown): value is AuditSessionSummary {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).session_id === "string"
  )
}
