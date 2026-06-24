import type {
  ClusterDocument,
  ClusterGroup,
} from "@/features/upload/lib/clusterGroups"
import type { PdfMetadata } from "@/features/upload/types"

export interface FinalResultProps {
  sessionId: string | null
  groups: ClusterGroup[]
  fondsName?: string | null
  metadataItems?: PdfMetadata[]
  onFinish: () => void
}

export interface DraggedDocument {
  document: ClusterDocument
  fromClusterId: string
}

export interface PreviewDocumentEntry {
  groupId: string
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
    | "temporary"
  children: ResultTreeNode[]
  group?: ClusterGroup
  documentCount: number
  pageCount: number
}
