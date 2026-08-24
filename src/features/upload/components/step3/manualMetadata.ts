interface MetadataReviewSubmissionState {
  metadataReady: boolean
  metadataPending: boolean
  metadataFailed: boolean
  metadata?: Record<string, unknown>
}

export function canSubmitMetadataReview({
  metadataReady,
  metadataPending,
  metadataFailed,
  metadata,
}: MetadataReviewSubmissionState): boolean {
  if (metadataReady) return true
  const hasManualMetadata = Boolean(metadata && Object.keys(metadata).length > 0)
  return hasManualMetadata && (metadataPending || metadataFailed)
}
