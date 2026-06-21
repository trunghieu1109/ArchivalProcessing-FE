import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import {
  getCurrentChinhlyUser,
  loginToChinhly,
} from "@/features/auth/api/authApi"
import {
  clearStoredAuthSession,
  getStoredAuthSession,
  isAuthSessionExpired,
  storeAuthSession,
  type AuthSession,
  type AuthUser,
} from "@/features/auth/lib/authStorage"

interface LoginCredentials {
  username: string
  password: string
}

interface AuthContextValue {
  session: AuthSession | null
  user: AuthUser | null
  isAuthenticated: boolean
  login: (credentials: LoginCredentials) => Promise<AuthSession>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() =>
    getStoredAuthSession()
  )

  const login = useCallback(async (credentials: LoginCredentials) => {
    const response = await loginToChinhly(credentials)
    const accessToken = String(response.access_token ?? "").trim()
    const user = response.user ?? (await getCurrentChinhlyUser(accessToken))
    const nextSession: AuthSession = {
      access_token: accessToken,
      token_type: response.token_type ?? "Bearer",
      expires_at: response.expires_at ?? null,
      user,
    }
    if (!nextSession.access_token) {
      throw new Error("Đăng nhập không trả về access token.")
    }
    storeAuthSession(nextSession)
    setSession(nextSession)
    return nextSession
  }, [])

  const logout = useCallback(() => {
    clearStoredAuthSession()
    setSession(null)
  }, [])

  useEffect(() => {
    const accessToken = session?.access_token
    if (!accessToken || session.user || isAuthSessionExpired(session)) return

    let cancelled = false
    getCurrentChinhlyUser(accessToken)
      .then((user) => {
        if (cancelled) return
        setSession((current) => {
          if (!current || current.access_token !== accessToken || current.user) {
            return current
          }
          const nextSession: AuthSession = { ...current, user }
          storeAuthSession(nextSession)
          return nextSession
        })
      })
      .catch(() => {
        // Keep the token; API calls can still surface auth errors explicitly.
      })

    return () => {
      cancelled = true
    }
  }, [session])

  const effectiveSession =
    session && isAuthSessionExpired(session) ? null : session

  const value = useMemo<AuthContextValue>(
    () => ({
      session: effectiveSession,
      user: effectiveSession?.user ?? null,
      isAuthenticated: Boolean(effectiveSession?.access_token),
      login,
      logout,
    }),
    [effectiveSession, login, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.")
  }
  return context
}
