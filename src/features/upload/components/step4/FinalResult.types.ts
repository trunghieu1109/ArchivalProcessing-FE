import type {
  ClusterDossierChangeType,
  ClusterGroupChangeType,
} from "@/features/upload/api/sessionApi"
import type {
  ClusterDocument,
  ClusterGroup,
} from "@/features/upload/lib/clusterGroups"
import type { FolderNode, PdfMetadata } from "@/features/upload/types"
import type { UnclassifiedSessionDossierSummary } from "@/features/upload/api/sessionApi"

export interface FinalResultProps {
  sessionId: string | null
  groups: ClusterGroup[]
  fondsName?: string | null
  activePlanVersionId?: string | null
  classificationTree?: FolderNode[]
  metadataItems?: PdfMetadata[]
  readOnly?: boolean
  onFinish: () => void
}

export interface DraggedDocument {
  document: ClusterDocument
  fromClusterId: string
}

export interface PreviewDocumentEntry {
  groupId: string
  inDraftDossier: boolean
  document: ClusterDocument
  sessionDocumentId: number
}

export interface ResultTreeNode {
  id: string
  label: string
  type:
    | "fonds"
    | "retention"
    | "year"
    | "classification"
    | "dossier"
    | "pending_dossier"
    | "temporary"
    | "unclassified_folder"
    | "unclassified_dossier"
  children: ResultTreeNode[]
  group?: ClusterGroup
  unclassifiedDossier?: UnclassifiedSessionDossierSummary
  changeTypes?: Array<ClusterGroupChangeType | ClusterDossierChangeType>
  documentCount: number
  pageCount: number
  classificationGroupId?: string
}
