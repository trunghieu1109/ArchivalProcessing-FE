import type { RefObject } from "react"
import type { FolderUploadSummary } from "@/features/folder-upload"
import type {
  SessionInputFileType,
  SessionInputUploadResponse,
  UploadMode,
  UploadProgressSnapshot,
} from "@/features/upload/api/sessionApi"
import type { SessionMetadataValues } from "@/features/upload/components/SessionMetadataBar"
import type { ProgressPhase } from "@/features/upload/components/ProgressTimeline"
import type {
  PendingDataUploadSummary,
  UnifiedDataUploadHandle,
} from "@/features/upload/components/step1/PendingDataUpload"
import type { UseOcrFolderResult } from "@/features/upload/hooks/useOcrFolder"
import type {
  ArchiveEntry,
  ProcessState,
  SectionHandle,
} from "@/features/upload/types"
import type { PlanAnalysisFailure } from "./UploadPage.progress"

export interface UploadPageStepOneProps {
  existingSessionMode: boolean
  planAnalyzing: boolean
  planAnalysisFailure: PlanAnalysisFailure | null
  planProgressMessage: string
  PLAN_PROGRESS_PHASES: ProgressPhase[]
  planProgressPhase: string | null
  planCompletedPhases: Set<string>
  zipRef: RefObject<SectionHandle | null>
  zipState: ProcessState
  syncZipState: (state: ProcessState) => void
  syncZipHas: (hasFile: boolean) => void
  syncZipEntries: (entries: ArchiveEntry[]) => void
  syncZipFolderPath: (folderPath: string) => void
  zipMaxFiles: string
  syncZipMaxFiles: (value: string) => void
  uploadInput: (
    fileType: SessionInputFileType,
    file: File
  ) => Promise<SessionInputUploadResponse>
  stageZipInput: (file: File) => Promise<SessionInputUploadResponse>
  discardStagedZipInput: () => void
  uploadRetentionInputs: (
    files: File[]
  ) => Promise<SessionInputUploadResponse[]>
  dossierTitleCatalogDraftFile: File | null
  dossierTitleCatalogUpload: SessionInputUploadResponse | null
  handleDossierTitleCatalogSelect: (
    file: File
  ) => Promise<SessionInputUploadResponse | void>
  handleDossierTitleCatalogClear: () => Promise<void>
  zipUploadProgress: UploadProgressSnapshot | null
  zipUploadFileName?: string
  zipInterruptionNotice?: {
    fileName: string
    status: string
    cancelReason: string | null
  } | null
  folderInterruptionNotice?: FolderUploadSummary | null
  planReuploadState?: {
    arrangement: boolean
    retention: boolean
  }
  ocr: UseOcrFolderResult
  zipHas: boolean
  allProcessing: boolean
  postUploadDiscoveryPending: boolean
  postUploadDiscoveryMessage: string
  sessionLoading: boolean
  uploadMode: UploadMode
  syncUploadMode: (mode: UploadMode) => void
  doc1Ref: RefObject<SectionHandle | null>
  doc2Ref: RefObject<SectionHandle | null>
  doc1State: ProcessState
  doc2State: ProcessState
  syncDoc1State: (state: ProcessState) => void
  syncDoc2State: (state: ProcessState) => void
  syncDoc1Has: (hasFile: boolean) => void
  syncDoc2Has: (hasFile: boolean) => void
  doc1Has: boolean
  doc2Has: boolean
  statusItems: Array<{ label: string; has: boolean; state: string }>
  allDone: boolean
  zipSupplementUploaded: boolean
  folderUploadReady: boolean
  folderUploadMetadataNavigationReady: boolean
  folderUploadWasCancelled: boolean
  folderUploadEffectiveCount: number
  hasAnyFile: boolean
  hasPlanReady: boolean
  readyCount: number
  requiredFileCount: number
  selectedInputLabels: string[]
  primaryActionDisabled: boolean
  primaryActionAvailable: boolean
  primaryActionPending: boolean
  handleStartAll: () => void | Promise<void>
  planInputsReuploaded: boolean
  sessionMetadata?: SessionMetadataValues
  syncSessionMetadataDraft?: (metadata: SessionMetadataValues) => void
  sessionId: string | null
  ensureSession: () => Promise<string>
  openZipUpload: boolean
  zipUploadFocusKey?: string | null
  openFolderUpload: boolean
  folderUploadFocusKey?: string | null
  parsedPlan?: unknown
  dataUploadRef: RefObject<UnifiedDataUploadHandle | null>
  pendingDataUpload: PendingDataUploadSummary | null
  onPendingDataUploadChange: (pending: PendingDataUploadSummary | null) => void
}
