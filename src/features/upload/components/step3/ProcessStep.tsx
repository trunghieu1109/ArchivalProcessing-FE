import { useEffect } from "react"
import type { SessionDocumentResponse } from "@/features/upload/api/sessionApi"
import type { ClusterGroup } from "@/features/upload/lib/clusterGroups"
import { createProcessStepActions } from "./ProcessStep.actions"
import { metadataDocumentScopeForGroup } from "./ProcessStep.batchUtils"
import { ProcessStepView } from "./ProcessStep.view"
import { useProcessStepModel } from "./useProcessStepModel"
import type { PdfMetadata } from "@/features/upload/types"
import type {
  MetadataBatchSummary,
  MetadataDocumentScope,
  MetadataServerPaginationControls,
} from "./ProcessStep.types"

interface ProcessStepProps {
  sessionId: string | null
  pdfPaths: string[]
  metadataTotal?: number
  metadataItems?: PdfMetadata[]
  metadataBatchSummaries?: MetadataBatchSummary[]
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
  metadataDocumentScope?: MetadataDocumentScope
  onMetadataDocumentScopeChange?: (scope: MetadataDocumentScope) => void
  onMetadataDocumentsChanged?: () => void
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
  metadataBatchSummaries = [],
  metadataLoading = false,
  metadataReloading = false,
  metadataPagination,
  metadataReadyTotal,
  metadataProcessingTotal,
  metadataFailedTotal,
  metadataReviewedTotal,
  metadataWarningTotal,
  metadataDocumentScope = { scope: "all" },
  onMetadataDocumentScopeChange,
  onMetadataDocumentsChanged,
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
    metadataBatchSummaries,
    metadataDocumentScope,
    metadataPagination,
  })
  const actions = createProcessStepActions({
    ...model,
    sessionId,
    onDocumentsVerified,
    onRetryMetadata,
    onMetadataDocumentScopeChange,
    onMetadataDocumentsChanged,
  })

  useEffect(() => {
    if (
      model.reviewMode !== "batch" ||
      metadataBatchSummaries.length === 0 ||
      metadataDocumentScope.scope !== "all" ||
      !model.activeBatch
    ) {
      return
    }
    onMetadataDocumentScopeChange?.(
      metadataDocumentScopeForGroup(model.activeBatch)
    )
  }, [
    metadataBatchSummaries.length,
    metadataDocumentScope.scope,
    model.activeBatch,
    model.reviewMode,
    onMetadataDocumentScopeChange,
  ])

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
