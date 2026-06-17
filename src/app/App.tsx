import type { ReactNode } from "react"
import { Routes, Route, Navigate, useLocation } from "react-router-dom"
import { FinalizeArtifactsPage } from "@/pages/FinalizeArtifactsPage"
import { LoginPage } from "@/pages/LoginPage"
import { SessionsPage } from "@/pages/SessionsPage"
import { UploadPage } from "@/pages/UploadPage"
import { useAuth } from "@/features/auth/lib/AuthContext"

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<LoginPage />} />
      <Route
        path="/sessions"
        element={
          <RequireAuth>
            <SessionsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/sessions/:sessionId/finalize"
        element={
          <RequireAuth>
            <FinalizeArtifactsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/sessions/new/step/:step"
        element={
          <RequireAuth>
            <UploadPage />
          </RequireAuth>
        }
      />
      <Route
        path="/sessions/:sessionId/step/:step"
        element={
          <RequireAuth>
            <UploadPage />
          </RequireAuth>
        }
      />
      <Route
        path="/step/:step"
        element={<Navigate to="/sessions/new/step/1" replace />}
      />
      <Route path="*" element={<Navigate to="/sessions" replace />} />
    </Routes>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return children
}
