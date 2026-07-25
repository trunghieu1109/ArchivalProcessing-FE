import { createContext } from "react"
import type { ZipUploadManager } from "./ZipUploadManager"

export const ZipUploadContext = createContext<ZipUploadManager | null>(null)
