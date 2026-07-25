import { useEffect, type ReactNode } from "react"
import { folderUploadManager } from "./FolderUploadManager"
import { FolderUploadContext } from "./FolderUploadContext"

export function FolderUploadProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const handlePageHide = () => {
      folderUploadManager.cancelAllBestEffort("page_closed")
    }
    const handleLogout = () => {
      folderUploadManager.cancelAllBestEffort("logout")
    }
    window.addEventListener("pagehide", handlePageHide)
    window.addEventListener("archival:logout", handleLogout)
    return () => {
      window.removeEventListener("pagehide", handlePageHide)
      window.removeEventListener("archival:logout", handleLogout)
    }
  }, [])

  return (
    <FolderUploadContext.Provider value={folderUploadManager}>
      {children}
    </FolderUploadContext.Provider>
  )
}
