import { useCallback, useRef } from "react"

import {
  getHomogeneousCluster,
  type SessionClusterSummary,
} from "@/features/upload/api/sessionApi"

/**
 * Keeps full cluster payloads outside render state so navigating between cluster
 * previews does not repeat the same request or rerender the whole page.
 */
export function useHomogeneousClusterDetailCache(
  sessionId: string,
  clusterVersionId = ""
) {
  const cacheRef = useRef(new Map<string, SessionClusterSummary>())
  const inFlightRef = useRef(
    new Map<string, Promise<SessionClusterSummary | null>>()
  )

  const cacheKey = useCallback(
    (clusterId: string) => `${sessionId}:${clusterVersionId}:${clusterId}`,
    [clusterVersionId, sessionId]
  )

  const getCached = useCallback(
    (clusterId: string) => cacheRef.current.get(cacheKey(clusterId)) ?? null,
    [cacheKey]
  )

  const loadClusterDetail = useCallback(
    async (clusterId: string): Promise<SessionClusterSummary | null> => {
      if (!sessionId || !clusterId) return null

      const key = cacheKey(clusterId)
      const cached = cacheRef.current.get(key)
      if (cached) return cached

      const inFlight = inFlightRef.current.get(key)
      if (inFlight) return inFlight

      const request = getHomogeneousCluster(sessionId, clusterId)
        .then((detail) => {
          cacheRef.current.set(key, detail)
          return detail
        })
        .finally(() => {
          inFlightRef.current.delete(key)
        })

      inFlightRef.current.set(key, request)
      return request
    },
    [cacheKey, sessionId]
  )

  const prefetchClusterDetails = useCallback(
    (clusterIds: string[]) => {
      for (const clusterId of new Set(clusterIds.filter(Boolean))) {
        if (getCached(clusterId)) continue
        void loadClusterDetail(clusterId).catch(() => undefined)
      }
    },
    [getCached, loadClusterDetail]
  )

  return {
    getCached,
    loadClusterDetail,
    prefetchClusterDetails,
  }
}
