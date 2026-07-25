import { createContext } from "react"
import type { FolderUploadManager } from "./FolderUploadManager"

export const FolderUploadContext = createContext<FolderUploadManager | null>(
  null
)
