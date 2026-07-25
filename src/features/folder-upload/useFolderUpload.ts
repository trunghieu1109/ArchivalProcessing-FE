import { useContext, useMemo, useSyncExternalStore } from "react"
import { FolderUploadContext } from "./FolderUploadContext"
import type { FolderUploadManager } from "./FolderUploadManager"
import type { FolderUploadJob } from "./types"

export function useFolderUploadManager(): FolderUploadManager {
  const manager = useContext(FolderUploadContext)
  if (!manager) {
    throw new Error(
      "useFolderUploadManager must be used inside FolderUploadProvider."
    )
  }
  return manager
}

export function useFolderUploadJobs(): readonly FolderUploadJob[] {
  const manager = useFolderUploadManager()
  const emptyServerSnapshot = useMemo<readonly FolderUploadJob[]>(() => [], [])
  return useSyncExternalStore(
    manager.subscribe,
    manager.getSnapshot,
    () => emptyServerSnapshot
  )
}
