import type { ReactNode } from "react"
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useParams,
} from "react-router-dom"
import { AdminAccessPage } from "@/pages/AdminAccessPage"
import { PredefinedDocumentsPage } from "@/pages/PredefinedDocumentsPage"
import { FinalizeArtifactsPage } from "@/pages/FinalizeArtifactsPage"
import { LoginPage } from "@/pages/LoginPage"
import { SessionsPage } from "@/pages/SessionsPage"
import { MergeFondsPage } from "@/pages/MergeFondsPage"
import { UploadPage } from "@/pages/UploadPage"
import { useAuth } from "@/features/auth/lib/AuthContext"

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<LoginPage />} />
      <Route
        path="/admin/access"
        element={
          <RequireAuth>
            <AdminAccessPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/predefined-documents"
        element={
          <RequireAuth>
            <PredefinedDocumentsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/sessions/merges/new"
        element={
          <RequireAuth>
            <MergeFondsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/sessions/:sessionId/merge"
        element={
          <RequireAuth>
            <MergedSessionWorkspaceRedirect />
          </RequireAuth>
        }
      />
      <Route path="/fonds-merges/new" element={<Navigate to="/sessions/merges/new" replace />} />
      <Route
        path="/fonds-merges/:sessionId"
        element={
          <RequireAuth>
            <MergedSessionWorkspaceRedirect />
          </RequireAuth>
        }
      />
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

function MergedSessionWorkspaceRedirect() {
  const { sessionId } = useParams<{ sessionId: string }>()
  if (!sessionId) return <Navigate to="/sessions" replace />
  return (
    <Navigate
      to={`/sessions/${encodeURIComponent(sessionId)}/step/4`}
      replace
    />
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
