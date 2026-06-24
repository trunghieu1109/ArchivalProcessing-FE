import type { SessionDocumentResponse } from "@/features/upload/api/sessionApi"
import type { ClusterGroup } from "@/features/upload/lib/clusterGroups"
import { createProcessStepActions } from "./ProcessStep.actions"
import { ProcessStepView } from "./ProcessStep.view"
import { useProcessStepModel } from "./useProcessStepModel"
import type { PdfMetadata } from "@/features/upload/types"
import type { MetadataServerPaginationControls } from "./ProcessStep.types"

interface ProcessStepProps {
  sessionId: string | null
  pdfPaths: string[]
  metadataTotal?: number
  metadataItems?: PdfMetadata[]
  metadataLoading?: boolean
  metadataReloading?: boolean
  metadataMessage?: string
  metadataPagination?: MetadataServerPaginationControls
  metadataReadyTotal?: number
  metadataProcessingTotal?: number
  metadataFailedTotal?: number
  metadataReviewedTotal?: number
  metadataWarningTotal?: number
  hasDataInput?: boolean
  buildBlockedMessage?: string
  signatureStatus?: {
    extracted: number
    pending: number
    failed: number
  }
  onDocumentsVerified?: (documents: SessionDocumentResponse[]) => void
  onRetryMetadata?: (documentId: number) => Promise<SessionDocumentResponse>
  onContinue: (groups: ClusterGroup[]) => void
}

export function ProcessStep({
  sessionId,
  pdfPaths,
  metadataTotal = 0,
  metadataItems = [],
  metadataLoading = false,
  metadataReloading = false,
  metadataPagination,
  metadataReadyTotal,
  metadataProcessingTotal,
  metadataFailedTotal,
  metadataReviewedTotal,
  metadataWarningTotal,
  metadataMessage = "Đang chờ kết quả số hóa từ backend...",
  hasDataInput = true,
  buildBlockedMessage = "",
  signatureStatus = { extracted: 0, pending: 0, failed: 0 },
  onDocumentsVerified,
  onRetryMetadata,
  onContinue,
}: ProcessStepProps) {
  const model = useProcessStepModel({
    sessionId,
    pdfPaths,
    metadataItems,
    metadataPagination,
  })
  const actions = createProcessStepActions({
    ...model,
    sessionId,
    onDocumentsVerified,
    onRetryMetadata,
  })

  return (
    <ProcessStepView
      {...model}
      {...actions}
      metadataTotal={metadataTotal}
      metadataLoading={metadataLoading}
      metadataReloading={metadataReloading}
      metadataMessage={metadataMessage}
      metadataReadyTotal={metadataReadyTotal}
      metadataProcessingTotal={metadataProcessingTotal}
      metadataFailedTotal={metadataFailedTotal}
      metadataReviewedTotal={metadataReviewedTotal}
      metadataWarningTotal={metadataWarningTotal}
      hasDataInput={hasDataInput}
      buildBlockedMessage={buildBlockedMessage}
      signatureStatus={signatureStatus}
      sessionId={sessionId}
      onContinue={onContinue}
    />
  )
}
