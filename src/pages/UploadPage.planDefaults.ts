import type {
  DossierBuildStrategy,
  DocumentNumberingMode,
} from "@/features/upload/api/sessionApi"
import type { FileRegisterConfig, ParsedPlan } from "@/features/upload/types"

export const easeOut = [0.16, 1, 0.3, 1] as const
export const DEFAULT_DOSSIER_BUILD_STRATEGY: DossierBuildStrategy =
  "incremental"
export const DEFAULT_DOCUMENT_NUMBERING_MODE: DocumentNumberingMode = "page"
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
}
