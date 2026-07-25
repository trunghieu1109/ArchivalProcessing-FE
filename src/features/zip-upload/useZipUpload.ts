import { useContext, useMemo, useSyncExternalStore } from "react"
import { ZipUploadContext } from "./ZipUploadContext"
import type { ZipUploadManager } from "./ZipUploadManager"
import type { ZipUploadJob } from "./types"

export function useZipUploadManager(): ZipUploadManager {
  const manager = useContext(ZipUploadContext)
  if (!manager) {
    throw new Error(
      "useZipUploadManager must be used inside ZipUploadProvider."
    )
  }
  return manager
}

export function useZipUploadJobs(): readonly ZipUploadJob[] {
  const manager = useZipUploadManager()
  const emptyServerSnapshot = useMemo<readonly ZipUploadJob[]>(() => [], [])
  return useSyncExternalStore(
    manager.subscribe,
    manager.getSnapshot,
    () => emptyServerSnapshot
  )
}
