export interface AuthUser {
  id?: number | string
  email?: string | null
  username?: string | null
  display_name?: string | null
  name?: string | null
  role?: string | null
  active?: boolean | null
  [key: string]: unknown
}

export interface AuthSession {
  access_token: string
  token_type?: string | null
  expires_at?: string | null
  user?: AuthUser | null
}

const AUTH_STORAGE_KEY = "archival-processing:chinhly-auth"

export function getStoredAuthSession(): AuthSession | null {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AuthSession>
    const token = String(parsed.access_token ?? "").trim()
    if (!token) return null
    const session: AuthSession = {
      access_token: token,
      token_type: parsed.token_type ?? "Bearer",
      expires_at: parsed.expires_at ?? null,
      user: normalizeUser(parsed.user),
    }
    if (isAuthSessionExpired(session)) {
      clearStoredAuthSession()
      return null
    }
    return session
  } catch {
    return null
  }
}

export function storeAuthSession(session: AuthSession): void {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
}

export function clearStoredAuthSession(): void {
  window.localStorage.removeItem(AUTH_STORAGE_KEY)
}

export function getStoredAccessToken(): string | null {
  return getStoredAuthSession()?.access_token ?? null
}

export function authHeaderValue(): string | null {
  const token = getStoredAccessToken()
  return token ? `Bearer ${token}` : null
}

export function isAuthSessionExpired(session: AuthSession | null): boolean {
  if (!session?.expires_at) return false
  const expiresAt = new Date(session.expires_at).getTime()
  if (!Number.isFinite(expiresAt)) return false
  return expiresAt <= Date.now()
}

function normalizeUser(value: unknown): AuthUser | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as AuthUser
}
