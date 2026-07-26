import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"

import "@/styles/globals.css"
import { App } from "@/app/App.tsx"
import { ThemeProvider } from "@/app/providers/theme-provider.tsx"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/features/auth/lib/AuthContext"
import { UploadManagerProvider } from "@/features/upload/components/global/UploadManagerProvider"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <UploadManagerProvider>
            <App />
          </UploadManagerProvider>
          <Toaster position="top-center" richColors />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
)
