import type { SessionMetadataValues } from "@/features/upload/components/SessionMetadataBar"
import type {
  ActivePlanResponse,
  DossierBuildStrategy,
  DocumentNumberingMode,
  DocumentNumberingStylePreset,
  SessionInputUploadResponse,
  UploadMode,
  UploadProgressSnapshot,
} from "@/features/upload/api/sessionApi"
import type {
  ArchiveEntry,
  FolderNode,
  ParsedPlan,
  ProcessState,
} from "@/features/upload/types"
import type { ClusterGroup } from "@/features/upload/lib/clusterGroups"
import {
  DEFAULT_DOCUMENT_NUMBERING_MODE,
  DEFAULT_DOCUMENT_NUMBERING_STYLE_PRESET,
  DEFAULT_DOSSIER_BUILD_STRATEGY,
  DEFAULT_NUMBERING_STYLE_OVERRIDES,
  EMPTY_PARSED_PLAN,
  planToTree,
  type NumberingStyleOverrides,
} from "./UploadPage.planUtils"

interface UploadPageCache {
  doc1Has: boolean
  doc2Has: boolean
  zipHas: boolean
  zipEntries: ArchiveEntry[]
  folderTree: FolderNode[]
  parsedPlan: ParsedPlan
  clusterGroups: ClusterGroup[]
  doc1State: ProcessState
  doc2State: ProcessState
  zipState: ProcessState
  planAnalysisState: ProcessState
  dossierBuildStrategy: DossierBuildStrategy
  persistedDossierBuildStrategy: DossierBuildStrategy
  documentNumberingMode: DocumentNumberingMode
  persistedDocumentNumberingMode: DocumentNumberingMode
  documentNumberingStylePreset: DocumentNumberingStylePreset
  persistedDocumentNumberingStylePreset: DocumentNumberingStylePreset
  documentNumberingStyleOverrides: NumberingStyleOverrides
  persistedDocumentNumberingStyleOverrides: NumberingStyleOverrides
  documentNumberingModeSavePromise: Promise<ActivePlanResponse> | null
  sessionId: string | null
  sessionMetadata: SessionMetadataValues
  zipUpload: SessionInputUploadResponse | null
  arrangementPlanUpload: SessionInputUploadResponse | null
  retentionUpload: SessionInputUploadResponse | null
  zipFolderPath: string
  zipMaxFiles: string
  uploadMode: UploadMode
  activePlanVersionId: string
  activeClusterVersionId: string | null | undefined
  draftArrangementPlanFile: File | null
  draftRetentionFile: File | null
  draftZipFile: File | null
  zipUploadProgress: UploadProgressSnapshot | null
  arrangementPlanReuploaded: boolean
  retentionReuploaded: boolean
  rawZipReuploaded: boolean
}

export const uploadPageCache: UploadPageCache = {
  doc1Has: false,
  doc2Has: false,
  zipHas: false,
  zipEntries: [],
  folderTree: planToTree(EMPTY_PARSED_PLAN),
  parsedPlan: EMPTY_PARSED_PLAN,
  clusterGroups: [],
  doc1State: "idle",
  doc2State: "idle",
  zipState: "idle",
  planAnalysisState: "idle",
  dossierBuildStrategy: DEFAULT_DOSSIER_BUILD_STRATEGY,
  persistedDossierBuildStrategy: DEFAULT_DOSSIER_BUILD_STRATEGY,
  documentNumberingMode: DEFAULT_DOCUMENT_NUMBERING_MODE,
  persistedDocumentNumberingMode: DEFAULT_DOCUMENT_NUMBERING_MODE,
  documentNumberingStylePreset: DEFAULT_DOCUMENT_NUMBERING_STYLE_PRESET,
  persistedDocumentNumberingStylePreset: DEFAULT_DOCUMENT_NUMBERING_STYLE_PRESET,
  documentNumberingStyleOverrides: { ...DEFAULT_NUMBERING_STYLE_OVERRIDES },
  persistedDocumentNumberingStyleOverrides: { ...DEFAULT_NUMBERING_STYLE_OVERRIDES },
  documentNumberingModeSavePromise: null,
  sessionId: null,
  sessionMetadata: {
    archive_name: null,
    archive_code: null,
    fonds_name: null,
    fonds_creator_code: null,
  },
  zipUpload: null,
  arrangementPlanUpload: null,
  retentionUpload: null,
  zipFolderPath: "",
  zipMaxFiles: "",
  uploadMode: "append",
  activePlanVersionId: "",
  activeClusterVersionId: undefined,
  draftArrangementPlanFile: null,
  draftRetentionFile: null,
  draftZipFile: null,
  zipUploadProgress: null,
  arrangementPlanReuploaded: false,
  retentionReuploaded: false,
  rawZipReuploaded: false,
}
