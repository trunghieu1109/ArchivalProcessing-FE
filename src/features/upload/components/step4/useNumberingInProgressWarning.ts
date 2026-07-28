import { useEffect, useState } from "react"
import { getDocumentNumberingStatus } from "@/features/upload/api/sessionApi"

const NUMBERING_WARNING_POLL_INTERVAL_MS = 3 * 1_000

export function useNumberingInProgressWarning(sessionId: string | null) {
  const [status, setStatus] = useState<{
    sessionId: string
    inProgress: boolean
  } | null>(null)

  useEffect(() => {
    if (!sessionId) return

    let cancelled = false
    let timeoutId: number | undefined

    const refresh = async () => {
      try {
        const response = await getDocumentNumberingStatus(sessionId, {
          includeDocuments: false,
          summaryOnly: true,
        })
        if (cancelled) return

        const jobStatus = String(response.job?.status ?? "").toLowerCase()
        const inProgress =
          response.active === true &&
          (jobStatus === "queued" ||
            jobStatus === "running" ||
            response.summary.pending > 0 ||
            response.summary.running > 0)
        setStatus({ sessionId, inProgress })

        if (inProgress) {
          timeoutId = window.setTimeout(
            refresh,
            NUMBERING_WARNING_POLL_INTERVAL_MS
          )
        }
      } catch {
        if (!cancelled) setStatus({ sessionId, inProgress: false })
      }
    }

    void refresh()
    return () => {
      cancelled = true
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [sessionId])

  return Boolean(
    sessionId && status?.sessionId === sessionId && status.inProgress
  )
}
