export type AuditAuthMode = "none" | "bearer" | "api-key"

export type AuditCategoryId =
  | "infrastructure"
  | "fonds"
  | "ocr"
  | "classification"
  | "dossiers"
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
    path: "/api/admin/dashboard?limit=120",
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
    id: "digitization",
    category: "ocr",
    title: "Trạng thái OCR",
    description:
      "Tổng quan OCR, ingestion run, batch và tối đa 100 tài liệu để inspect.",
    path: (sessionId) =>
      `/api/sessions/${encodeURIComponent(sessionId)}/digitization?include_documents=true&summary_only=false&limit=100&offset=0`,
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
    id: "publication",
    category: "dossiers",
    title: "Cấu trúc công bố",
    description: "Cây hộp, hồ sơ, tài liệu và tên chuẩn ở bước công bố.",
    path: (sessionId) =>
      `/api/sessions/${encodeURIComponent(sessionId)}/publication`,
    requiresSession: true,
  },
  {
    id: "events",
    category: "evidence",
    title: "Nhật ký sự kiện",
    description: "200 event gần nhất phục vụ kiểm tra luồng xử lý.",
    path: (sessionId) =>
      `/api/sessions/${encodeURIComponent(sessionId)}/events?limit=200`,
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
