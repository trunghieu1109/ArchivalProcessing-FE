interface OcrBatchDiscoveryStatus {
  id: number
  remote_discovery_complete?: boolean
}

export function hasPendingLatestBatchDiscovery(
  result: { batches: OcrBatchDiscoveryStatus[] } | null
): boolean {
  const latestBatch = result?.batches.reduce<
    OcrBatchDiscoveryStatus | undefined
  >(
    (latest, batch) => (!latest || batch.id > latest.id ? batch : latest),
    undefined
  )
  return Boolean(latestBatch && latestBatch.remote_discovery_complete !== true)
}
