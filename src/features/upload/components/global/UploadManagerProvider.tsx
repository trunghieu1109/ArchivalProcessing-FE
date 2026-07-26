import { useEffect, type PropsWithChildren } from "react"
import { GlobalUploadDock } from "./GlobalUploadDock"
import { folderUploadManager } from "@/features/upload/lib/folderUploadManager"
import { zipUploadManager } from "@/features/upload/lib/zipUploadManager"

export function UploadManagerProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    const detachFolder = folderUploadManager.attachPageLifecycle()
    const detachZip = zipUploadManager.attachPageLifecycle()
    return () => {
      detachFolder()
      detachZip()
    }
  }, [])
  return (
    <>
      {children}
      <GlobalUploadDock />
    </>
  )
}
