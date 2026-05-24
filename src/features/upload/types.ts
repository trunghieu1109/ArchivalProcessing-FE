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

export interface ClassificationCriterion {
  id: string
  field: string
  label: string
  values: string[]
  definition: string
}

export interface PlanGroup {
  id: string
  name: string
  type: "level-1" | "level-2"
  definition: string
  children: PlanGroup[]
}

export interface ParsedPlan {
  summary: string
  fonds_name: string
  groups: PlanGroup[]
}

export interface FolderNode {
  id: string
  name: string
  children: FolderNode[]
  criteria?: ClassificationCriterion[]
  hoSoName?: string
  soHoSo?: string
  thoiHanBaoQuan?: string
}

export interface PdfMetadata {
  data_path: string
  status: string
  light_metadata: Record<string, unknown>
  applied: boolean
}

export type AppStep = 1 | 2 | 3 | 4
