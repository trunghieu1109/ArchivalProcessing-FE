import type {
  DossierBuildStrategy,
  DocumentNumberingMode,
  DocumentNumberingStylePreset,
  PlanVersionStatus,
} from "@/features/upload/api/sessionApi"
import type {
  FileRegisterConfig,
  FolderNode,
  ParsedPlan,
  PlanCriterionSet,
} from "@/features/upload/types"

export interface FolderTreeProps {
  sessionId?: string | null
  tree: FolderNode[]
  parsedPlan: ParsedPlan
  fondsName?: string | null
  readOnly?: boolean
  hasRetentionSchedule?: boolean
  showRetentionSection?: boolean
  showActions?: boolean
  dossierBuildStrategy: DossierBuildStrategy
  dossierTitleCatalogMappingCount?: number
  onDossierBuildStrategyChange: (strategy: DossierBuildStrategy) => void
  documentNumberingMode: DocumentNumberingMode
  onDocumentNumberingModeChange: (
    mode: DocumentNumberingMode
  ) => void | Promise<void>
  documentNumberingStylePreset: DocumentNumberingStylePreset
  documentNumberingStyleOverrides?: {
    font_size?: number
    color?: string
    opacity?: number
  }
  onDocumentNumberingStylePresetChange: (
    stylePreset: DocumentNumberingStylePreset
  ) => void | Promise<void>
  onDocumentNumberingStyleOverridesChange?: (overrides: {
    font_size?: number
    color?: string
    opacity?: number
  }) => void | Promise<void>
  onFileRegisterConfigChange: (
    config: FileRegisterConfig
  ) => void | Promise<void>
  onChange: (tree: FolderNode[]) => void
  onSaveTree?: (tree: FolderNode[]) => void | Promise<void>
  onCriteriaChange: (criterias: PlanCriterionSet[]) => void | Promise<void>
  onSaveDraft?: () => void | Promise<void>
  onConfirm: () => void | Promise<void>
  onContinueToMetadata?: () => void | Promise<void>
  savingDraft?: boolean
  confirming?: boolean
  planDraftDirty?: boolean
  draftDiffersActive?: boolean
  planStatus?: PlanVersionStatus | ""
}
