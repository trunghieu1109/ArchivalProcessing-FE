import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { loginToChinhly } from "@/features/auth/api/authApi"
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
    const nextSession: AuthSession = {
      access_token: String(response.access_token ?? "").trim(),
      token_type: response.token_type ?? "Bearer",
      expires_at: response.expires_at ?? null,
      user: response.user ?? null,
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
