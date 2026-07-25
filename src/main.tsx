import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"

import "@/styles/globals.css"
import { App } from "@/app/App.tsx"
import { ThemeProvider } from "@/app/providers/theme-provider.tsx"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/features/auth/lib/AuthContext"
import {
  FolderUploadProvider,
  GlobalUploadDock,
} from "@/features/folder-upload"
import { ZipUploadProvider } from "@/features/zip-upload"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <FolderUploadProvider>
            <ZipUploadProvider>
              <App />
              <GlobalUploadDock />
              <Toaster position="top-center" richColors />
            </ZipUploadProvider>
          </FolderUploadProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
)
