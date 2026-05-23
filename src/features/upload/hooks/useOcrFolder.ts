import { useState, useRef, useCallback } from "react"
import { startFolderPreview, getFolderStatus } from "@/features/upload/api/ocrApi"
import type { FolderStatusResponse } from "@/features/upload/api/ocrApi"

const TERMINAL_STATUSES = new Set(["done", "failed", "final_failed", "cancelled"])
const POLL_INTERVAL_MS = 3000

export type OcrFolderState = "idle" | "starting" | "polling" | "done" | "error"

export interface UseOcrFolderResult {
  state: OcrFolderState
  status: FolderStatusResponse | null
  error: string
  start: (folderPath: string) => Promise<void>
  reset: () => void
}

export function useOcrFolder(): UseOcrFolderResult {
  const [state, setState] = useState<OcrFolderState>("idle")
  const [status, setStatus] = useState<FolderStatusResponse | null>(null)
  const [error, setError] = useState("")
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  const reset = useCallback(() => {
    stopPolling()
    setState("idle")
    setStatus(null)
    setError("")
  }, [])

  const start = useCallback(async (folderPath: string) => {
    stopPolling()
    setState("starting")
    setError("")
    setStatus(null)

    try {
      await startFolderPreview({
        folder_path: folderPath,
        recursive: true,
        max_files: 1,
        metadata_fields: [],
        force: false,
      })
    } catch (err) {
      // 409 means jobs already exist — still proceed to poll
      if (!(err instanceof Error && err.message.startsWith("409"))) {
        setError(err instanceof Error ? err.message : "Failed to start folder processing.")
        setState("error")
        return
      }
    }

    setState("polling")

    const poll = async () => {
      try {
        const result = await getFolderStatus(folderPath, true, 1)
        setStatus(result)

        const allTerminal = result.jobs.every((j) => TERMINAL_STATUSES.has(j.status))
        if (allTerminal && result.jobs.length > 0) {
          stopPolling()
          setState("done")
        }
      } catch (err) {
        stopPolling()
        setError(err instanceof Error ? err.message : "Failed to poll folder status.")
        setState("error")
      }
    }

    await poll()
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS)
  }, [])

  return { state, status, error, start, reset }
}
