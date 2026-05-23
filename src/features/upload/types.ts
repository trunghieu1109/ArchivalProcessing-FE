export type ProcessState = "idle" | "processing" | "done"

export interface SectionHandle {
  hasFile: () => boolean
  process: () => Promise<void>
}

export interface ArchiveEntry {
  name: string
  size: number
  isDir: boolean
}

export interface FolderNode {
  id: string
  name: string
  children: FolderNode[]
}

export interface PdfMetadata {
  data_path: string
  status: string
  light_metadata: Record<string, unknown>
  applied: boolean
}

export type AppStep = 1 | 2 | 3 | 4
