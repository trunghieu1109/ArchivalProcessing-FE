import { useEffect, type ReactNode } from "react"
import { ZipUploadContext } from "./ZipUploadContext"
import { zipUploadManager } from "./ZipUploadManager"

export function ZipUploadProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const cancelAllOnPageHide = () =>
      zipUploadManager.cancelAllBestEffort("page_closed")
    const cancelAllOnLogout = () =>
      zipUploadManager.cancelAllBestEffort("logout")
    window.addEventListener("pagehide", cancelAllOnPageHide)
    window.addEventListener("archival:logout", cancelAllOnLogout)
    return () => {
      window.removeEventListener("pagehide", cancelAllOnPageHide)
      window.removeEventListener("archival:logout", cancelAllOnLogout)
    }
  }, [])

  return (
    <ZipUploadContext.Provider value={zipUploadManager}>
      {children}
    </ZipUploadContext.Provider>
  )
}
