import { Routes, Route, Navigate } from "react-router-dom"
import { UploadPage } from "@/pages/UploadPage"

export function App() {
  return (
    <Routes>
      <Route path="/step/:step" element={<UploadPage />} />
      <Route path="*" element={<Navigate to="/step/1" replace />} />
    </Routes>
  )
}
