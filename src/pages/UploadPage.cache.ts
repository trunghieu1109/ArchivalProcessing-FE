import type { SessionMetadataValues } from "@/features/upload/components/SessionMetadataBar"
import type {
  ActivePlanResponse,
  DossierBuildStrategy,
  DocumentNumberingMode,
  DocumentNumberingStylePreset,
  PlanVersionStatus,
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
  activeFolderTree: FolderNode[]
  activeParsedPlan: ParsedPlan
  activePlanSettings: {
    dossierBuildStrategy: DossierBuildStrategy
    documentNumberingMode: DocumentNumberingMode
    documentNumberingStylePreset: DocumentNumberingStylePreset
    documentNumberingStyleOverrides: NumberingStyleOverrides
  }
  clusterGroups: ClusterGroup[]
  doc1State: ProcessState
  doc2State: ProcessState
  zipState: ProcessState
  planAnalysisState: ProcessState
  planAnalysisJobId: number | null
  dossierBuildStrategy: DossierBuildStrategy
  persistedDossierBuildStrategy: DossierBuildStrategy
  documentNumberingMode: DocumentNumberingMode
  persistedDocumentNumberingMode: DocumentNumberingMode
  documentNumberingStylePreset: DocumentNumberingStylePreset
  persistedDocumentNumberingStylePreset: DocumentNumberingStylePreset
  documentNumberingStyleOverrides: NumberingStyleOverrides
  persistedDocumentNumberingStyleOverrides: NumberingStyleOverrides
  workingPlanSavePromise: Promise<ActivePlanResponse> | null
  planDraftDirty: boolean
  planDraftRevision: number
  planDraftBaseSignature: string
  workingPlanSignature: string
  activePlanSignature: string
  workingPlanResponse: ActivePlanResponse | null
  activePlanResponse: ActivePlanResponse | null
  sessionId: string | null
  sessionMetadata: SessionMetadataValues
  zipUpload: SessionInputUploadResponse | null
  arrangementPlanUpload: SessionInputUploadResponse | null
  retentionUpload: SessionInputUploadResponse | null
  retentionUploads: SessionInputUploadResponse[]
  zipFolderPath: string
  zipMaxFiles: string
  uploadMode: UploadMode
  workingPlanVersionId: string
  workingPlanStatus: PlanVersionStatus | ""
  activePlanVersionId: string
  planViewTab: "draft" | "active"
  activeClusterVersionId: string | null | undefined
  draftArrangementPlanFile: File | null
  draftRetentionFile: File | null
  draftRetentionFiles: File[]
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
  activeFolderTree: planToTree(EMPTY_PARSED_PLAN),
  activeParsedPlan: EMPTY_PARSED_PLAN,
  activePlanSettings: {
    dossierBuildStrategy: DEFAULT_DOSSIER_BUILD_STRATEGY,
    documentNumberingMode: DEFAULT_DOCUMENT_NUMBERING_MODE,
    documentNumberingStylePreset: DEFAULT_DOCUMENT_NUMBERING_STYLE_PRESET,
    documentNumberingStyleOverrides: {
      ...DEFAULT_NUMBERING_STYLE_OVERRIDES,
    },
  },
  clusterGroups: [],
  doc1State: "idle",
  doc2State: "idle",
  zipState: "idle",
  planAnalysisState: "idle",
  planAnalysisJobId: null,
  dossierBuildStrategy: DEFAULT_DOSSIER_BUILD_STRATEGY,
  persistedDossierBuildStrategy: DEFAULT_DOSSIER_BUILD_STRATEGY,
  documentNumberingMode: DEFAULT_DOCUMENT_NUMBERING_MODE,
  persistedDocumentNumberingMode: DEFAULT_DOCUMENT_NUMBERING_MODE,
  documentNumberingStylePreset: DEFAULT_DOCUMENT_NUMBERING_STYLE_PRESET,
  persistedDocumentNumberingStylePreset:
    DEFAULT_DOCUMENT_NUMBERING_STYLE_PRESET,
  documentNumberingStyleOverrides: { ...DEFAULT_NUMBERING_STYLE_OVERRIDES },
  persistedDocumentNumberingStyleOverrides: {
    ...DEFAULT_NUMBERING_STYLE_OVERRIDES,
  },
  workingPlanSavePromise: null,
  planDraftDirty: false,
  planDraftRevision: 0,
  planDraftBaseSignature: "",
  workingPlanSignature: "",
  activePlanSignature: "",
  workingPlanResponse: null,
  activePlanResponse: null,
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
  retentionUploads: [],
  zipFolderPath: "",
  zipMaxFiles: "",
  uploadMode: "append",
  workingPlanVersionId: "",
  workingPlanStatus: "",
  activePlanVersionId: "",
  planViewTab: "draft",
  activeClusterVersionId: undefined,
  draftArrangementPlanFile: null,
  draftRetentionFile: null,
  draftRetentionFiles: [],
  draftZipFile: null,
  zipUploadProgress: null,
  arrangementPlanReuploaded: false,
  retentionReuploaded: false,
  rawZipReuploaded: false,
}
