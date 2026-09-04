import type {
  DossierBuildStrategy,
  DocumentNumberingMode,
  DocumentNumberingStylePreset,
} from "@/features/upload/api/sessionApi"
import type { FileRegisterConfig, ParsedPlan } from "@/features/upload/types"

export const easeOut = [0.16, 1, 0.3, 1] as const
export const DEFAULT_DOSSIER_BUILD_STRATEGY: DossierBuildStrategy = "hybrid"
export const DEFAULT_DOCUMENT_NUMBERING_MODE: DocumentNumberingMode = "page"
export const DEFAULT_DOCUMENT_NUMBERING_STYLE_PRESET: DocumentNumberingStylePreset =
  "pencil_miama"

export interface NumberingStyleOverrides {
  font_size?: number
  color?: string
  opacity?: number
}

export const DEFAULT_NUMBERING_STYLE_OVERRIDES: NumberingStyleOverrides = {}
export const DEFAULT_FILE_REGISTER_CONFIG: FileRegisterConfig = {
  analysis_status: "not_detected",
  summary: "",
  evidence: [],
  steps: [
    { criterion: "document_type" },
    { criterion: "issued_date", granularity: "year" },
  ],
  merge_small_dossiers: true,
}

export const EMPTY_PARSED_PLAN: ParsedPlan = {
  summary: "",
  fonds_name: "",
  groups: [],
  criterias: [],
  leaf_group_candidates: [],
  file_register_config: DEFAULT_FILE_REGISTER_CONFIG,
  predefined_use_temporary_code_as_dossier_number: false,
  retention_appendices: [],
  retention_sources: [],
}
