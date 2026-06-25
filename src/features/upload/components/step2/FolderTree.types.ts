import type {
  DossierBuildStrategy,
  DocumentNumberingMode,
  DocumentNumberingStylePreset,
} from "@/features/upload/api/sessionApi"
import type {
  FileRegisterConfig,
  FolderNode,
  ParsedPlan,
  PlanCriterionSet,
} from "@/features/upload/types"

export interface FolderTreeProps {
  tree: FolderNode[]
  parsedPlan: ParsedPlan
  fondsName?: string | null
  readOnly?: boolean
  hasRetentionSchedule?: boolean
  dossierBuildStrategy: DossierBuildStrategy
  onDossierBuildStrategyChange: (strategy: DossierBuildStrategy) => void
  documentNumberingMode: DocumentNumberingMode
  onDocumentNumberingModeChange: (
    mode: DocumentNumberingMode
  ) => void | Promise<void>
  documentNumberingStylePreset: DocumentNumberingStylePreset
  onDocumentNumberingStylePresetChange: (
    stylePreset: DocumentNumberingStylePreset
  ) => void | Promise<void>
  onFileRegisterConfigChange: (
    config: FileRegisterConfig
  ) => void | Promise<void>
  onChange: (tree: FolderNode[]) => void
  onSaveTree?: (tree: FolderNode[]) => void | Promise<void>
  onCriteriaChange: (criterias: PlanCriterionSet[]) => void | Promise<void>
  onConfirm: () => void | Promise<void>
  confirming?: boolean
}
