import { Routes, Route, Navigate } from "react-router-dom"
import { SessionsPage } from "@/pages/SessionsPage"
import { UploadPage } from "@/pages/UploadPage"

export function App() {
  return (
    <Routes>
      <Route path="/sessions" element={<SessionsPage />} />
      <Route path="/sessions/new/step/:step" element={<UploadPage />} />
      <Route path="/sessions/:sessionId/step/:step" element={<UploadPage />} />
      <Route path="/step/:step" element={<Navigate to="/sessions/new/step/1" replace />} />
      <Route path="*" element={<Navigate to="/sessions" replace />} />
    </Routes>
  )
}
