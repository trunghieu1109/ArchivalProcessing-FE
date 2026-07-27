export interface MetadataDiscoveryState {
  currentStep: number
  targetIngestionRunId: number | null
  targetIngestionRunStatus: string
  batchDiscoveryComplete: boolean
}

export function isMetadataDiscoveryPending({
  currentStep,
  targetIngestionRunId,
  targetIngestionRunStatus,
  batchDiscoveryComplete,
}: MetadataDiscoveryState): boolean {
  return (
    currentStep === 3 &&
    targetIngestionRunId !== null &&
    targetIngestionRunStatus === "ready" &&
    !batchDiscoveryComplete
  )
}
