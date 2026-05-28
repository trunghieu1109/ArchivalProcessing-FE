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
  type: string
  definition: string
  children: PlanGroup[]
}

export interface PlanCriterionSet {
  group_level: string
  criteria: string[]
}

export interface ParsedPlan {
  summary: string
  fonds_name: string
  groups: PlanGroup[]
  criterias: PlanCriterionSet[]
}

export interface FolderNode {
  id: string
  name: string
  children: FolderNode[]
  type?: string
  definition?: string
  criteria?: ClassificationCriterion[]
  hoSoName?: string
  soHoSo?: string
  thoiHanBaoQuan?: string
}

export interface PdfMetadata {
  id: number
  document_id: string
  data_path: string
  status: string
  review_status: string
  metadata_ready: boolean
  metadata_final: boolean
  light_metadata: Record<string, unknown>
  applied: boolean
}

export type AppStep = 1 | 2 | 3 | 4
