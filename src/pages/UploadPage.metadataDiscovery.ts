import type { FolderStatusResponse } from "@/features/upload/api/ocrApi"

export function isMetadataDiscoveryPending({
  currentStep,
  targetIngestionRunId,
  status,
}: {
  currentStep: number
  targetIngestionRunId: number | null
  status: FolderStatusResponse | null
}): boolean {
  if (currentStep !== 3 || targetIngestionRunId === null || !status) {
    return false
  }
  const targetRun = status.ingestion_runs?.find(
    (run) => run.id === targetIngestionRunId
  )
  if (
    String(targetRun?.status ?? "")
      .trim()
      .toLowerCase() !== "ready"
  ) {
    return false
  }
  if (status.updating_ingestion_run_ids) {
    return status.updating_ingestion_run_ids.includes(targetIngestionRunId)
  }
  return (status.updating_ingestion_runs ?? 0) > 0
}
