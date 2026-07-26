import { useMemo } from "react"
import { normalizeDocumentReviewStatus } from "@/features/upload/api/sessionApi"
import { useOcrFolder } from "@/features/upload/hooks/useOcrFolder"
import { buildDisplayMetadata } from "@/features/upload/lib/metadata"
import type { PdfMetadata } from "@/features/upload/types"

export function useUploadPageOcr(
  sessionId: string | null,
  options: { enabled?: boolean; externalRefreshKey?: string | null } = {}
) {
  const ocr = useOcrFolder(sessionId, {
    enabled: options.enabled ?? true,
    clearOnDisable: true,
    externalRefreshKey: options.externalRefreshKey,
  })
  const ocrMetadataItems = useMemo<PdfMetadata[]>(
    () =>
      ocr.status?.jobs.map((job) => {
        const lightMetadata = buildDisplayMetadata(job)
        const reviewStatus = normalizeDocumentReviewStatus(job, lightMetadata)
        const reviewed = job.is_reviewed === true
        return {
          id: job.id,
          ocr_batch_id: job.ocr_batch_id,
          metadata_retry_available: job.metadata_retry_available,
          metadata_retry_disabled_reason: job.metadata_retry_disabled_reason,
          document_id: job.document_id,
          data_path: job.data_path,
          import_action: job.import_action,
          metadata_batch_id: job.metadata_batch_id,
          metadata_batch_name: job.metadata_batch_name,
          metadata_batch_assigned_to_user_id:
            job.metadata_batch_assigned_to_user_id,
          metadata_batch_assigned_to_email:
            job.metadata_batch_assigned_to_email,
          metadata_batch_assigned_to_name: job.metadata_batch_assigned_to_name,
          metadata_batch_assigned_at: job.metadata_batch_assigned_at,
          metadata_verified_by_user_id: job.metadata_verified_by_user_id,
          metadata_verified_by_email: job.metadata_verified_by_email,
          metadata_verified_by_name: job.metadata_verified_by_name,
          metadata_verified_at: job.metadata_verified_at,
          status: job.status,
          remote_metadata_status: job.remote_metadata_status,
          signature_status: job.signature_status,
          review_status: reviewStatus,
          is_reviewed: reviewed,
          metadata_ready: job.metadata_ready,
          metadata_final: job.metadata_final,
          metadata_version_count: job.metadata_version_count,
          metadata_user_edited: job.metadata_user_edited,
          error: job.error,
          light_metadata: lightMetadata,
          normalized_metadata: job.normalized_metadata,
          raw_metadata: job.raw_metadata,
          pdf_preprocessing: job.pdf_preprocessing,
          applied: reviewed || reviewStatus === "verified",
        }
      }) ?? [],
    [ocr.status]
  )
  const ocrPdfPaths = useMemo(
    () => ocrMetadataItems.map((item) => item.data_path),
    [ocrMetadataItems]
  )
  const ocrSignatureStatus = useMemo(
    () => ({
      extracted: ocr.status?.signature_extracted_documents ?? 0,
      pending: ocr.status?.signature_pending_documents ?? 0,
      failed: ocr.status?.signature_failed_documents ?? 0,
    }),
    [ocr.status]
  )
  const ocrIsReextracting =
    ocr.status?.reextracting === true && ocr.status?.upload_mode !== "append"
  const ocrDocumentTotal = Math.max(
    ocr.status?.total_files ?? 0,
    ocr.status?.total_jobs ?? 0,
    ocr.status?.pagination?.total ?? 0,
    ocrMetadataItems.length
  )
  const extractingIngestionRuns =
    ocr.status?.ingestion_runs?.filter((run) =>
      ["extract_starting", "extracting", "legacy_unknown"].includes(run.status)
    ).length ?? 0
  const pendingIngestionRuns = Math.max(
    extractingIngestionRuns,
    ocr.status?.extracting_ingestion_runs ?? 0
  )
  const ocrPendingIngestionMessage =
    pendingIngestionRuns > 0
      ? pendingIngestionRuns === 1
        ? "Đang extract file ZIP..."
        : `Đang extract ${pendingIngestionRuns} file ZIP...`
      : ""
  const ocrMessage =
    ocr.state === "error"
      ? ocr.error || "Không thể lấy kết quả số hóa."
      : extractingIngestionRuns > 0
        ? extractingIngestionRuns === 1
          ? "Đang extract file ZIP..."
          : `Đang extract ${extractingIngestionRuns} file ZIP...`
        : ocrIsReextracting
          ? "Đang trích xuất lại metadata theo cách đánh số mới."
          : ocr.state === "metadata_ready"
            ? "Metadata da san sang de review. Chu ky/final metadata dang cap nhat nen."
            : ocr.state === "done"
              ? ocrDocumentTotal > 0
                ? `Đã nhận ${ocrMetadataItems.length} tài liệu từ backend.`
                : "Backend chưa trả về tài liệu số hóa."
              : "Đang chờ kết quả số hóa từ remote folder..."
  const ocrLoading = ocr.state === "starting" || ocr.state === "polling"

  return {
    ocr,
    ocrMetadataItems,
    ocrPdfPaths,
    ocrSignatureStatus,
    ocrIsReextracting,
    ocrPendingIngestionCount: pendingIngestionRuns,
    ocrPendingIngestionMessage,
    ocrMessage,
    ocrLoading,
  }
}
