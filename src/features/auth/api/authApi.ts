import type { AuthSession } from "@/features/auth/lib/authStorage"
import { authHeaderValue } from "@/features/auth/lib/authStorage"

const API_BASE = (import.meta.env.VITE_ARCHIVAL_API_BASE_URL ?? "/api").replace(
  /\/$/,
  ""
)

export interface LoginPayload {
  username: string
  password: string
}

export interface RegisterPayload {
  email: string
  password: string
  display_name: string
  name?: string
  role?: "worker" | "coordinator" | "admin"
}

export interface ChinhlyUser {
  id?: string | number
  user_id?: string | number
  email?: string | null
  username?: string | null
  display_name?: string | null
  name?: string | null
  role?: string | null
  active?: boolean | null
  is_active?: boolean | null
  managed_batch_ids?: Array<string | number> | null
  [key: string]: unknown
}

export async function loginToChinhly(
  payload: LoginPayload
): Promise<AuthSession> {
  const response = await fetch(apiUrl("/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response))
  }
  return response.json() as Promise<AuthSession>
}

export async function registerChinhlyUser(
  payload: RegisterPayload
): Promise<Record<string, unknown>> {
  const headers = new Headers({ "Content-Type": "application/json" })
  const authorization = authHeaderValue()
  if (authorization) headers.set("Authorization", authorization)

  const response = await fetch(apiUrl("/auth/register"), {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response))
  }
  return response.json() as Promise<Record<string, unknown>>
}

export async function listChinhlyUsers(
  options: {
    role?: string
    active?: boolean
    limit?: number
    offset?: number
  } = {}
): Promise<ChinhlyUser[]> {
  const query = new URLSearchParams()
  if (options.role) query.set("role", options.role)
  query.set("active", String(options.active ?? true))
  query.set("limit", String(Math.min(options.limit ?? 500, 500)))
  query.set("offset", String(options.offset ?? 0))
  const headers = new Headers()
  const authorization = authHeaderValue()
  if (authorization) headers.set("Authorization", authorization)

  const response = await fetch(apiUrl(`/auth/users?${query.toString()}`), {
    headers,
  })
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response))
  }
  return normalizeUserList(await response.json())
}

export async function updateChinhlyUser(
  userId: string | number,
  payload: {
    display_name?: string
    name?: string
    role?: "admin" | "coordinator" | "worker"
    is_active?: boolean
  }
): Promise<ChinhlyUser> {
  const headers = new Headers({ "Content-Type": "application/json" })
  const authorization = authHeaderValue()
  if (authorization) headers.set("Authorization", authorization)

  const response = await fetch(
    apiUrl(`/auth/users/${encodeURIComponent(String(userId))}`),
    {
      method: "PATCH",
      headers,
      body: JSON.stringify(payload),
    }
  )
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response))
  }
  return response.json() as Promise<ChinhlyUser>
}

export async function updateChinhlyUserRole(
  userId: string | number,
  payload: {
    role: "admin" | "coordinator" | "worker"
    is_active?: boolean
  }
): Promise<ChinhlyUser> {
  const headers = new Headers({ "Content-Type": "application/json" })
  const authorization = authHeaderValue()
  if (authorization) headers.set("Authorization", authorization)

  const response = await fetch(
    apiUrl(`/auth/users/${encodeURIComponent(String(userId))}/role`),
    {
      method: "PATCH",
      headers,
      body: JSON.stringify(payload),
    }
  )
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response))
  }
  return response.json() as Promise<ChinhlyUser>
}

export async function updateChinhlyUserBatchAssignments(
  userId: string | number,
  payload: {
    mode: "replace" | "add" | "remove"
    batch_ids: Array<string | number>
  }
): Promise<ChinhlyUser> {
  const headers = new Headers({ "Content-Type": "application/json" })
  const authorization = authHeaderValue()
  if (authorization) headers.set("Authorization", authorization)

  const response = await fetch(
    apiUrl(
      `/auth/users/${encodeURIComponent(String(userId))}/batch-assignments`
    ),
    {
      method: "PUT",
      headers,
      body: JSON.stringify(payload),
    }
  )
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response))
  }
  return response.json() as Promise<ChinhlyUser>
}

function apiUrl(path: string): string {
  return API_BASE ? `${API_BASE}${path}` : path
}

async function responseErrorMessage(response: Response): Promise<string> {
  const text = await response.text()
  if (!text) return `API error ${response.status}`
  try {
    const payload = JSON.parse(text) as { detail?: unknown }
    if (typeof payload.detail === "string") {
      if (payload.detail === "Authentication required") {
        return "Cần đăng nhập bằng tài khoản điều phối hoặc cấu hình CHINHLY_ADMIN_EMAIL/CHINHLY_ADMIN_PASSWORD để tạo tài khoản."
      }
      return payload.detail
    }
    if (payload.detail) return JSON.stringify(payload.detail)
  } catch {
    return text
  }
  return text
}

function normalizeUserList(payload: unknown): ChinhlyUser[] {
  const rawUsers = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object"
      ? ((payload as Record<string, unknown>).users ??
        (payload as Record<string, unknown>).items ??
        (payload as Record<string, unknown>).results ??
        (payload as Record<string, unknown>).data)
      : []
  if (!Array.isArray(rawUsers)) return []
  return rawUsers.filter(
    (item): item is ChinhlyUser =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item)
  )
}
