import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"

import "@/styles/globals.css"
import { App } from "@/app/App.tsx"
import { ThemeProvider } from "@/app/providers/theme-provider.tsx"
import { Toaster } from "@/components/ui/sonner"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
        <Toaster position="top-center" richColors />
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
)
