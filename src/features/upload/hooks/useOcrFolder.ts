import { useState, useRef, useCallback, useEffect } from "react"
import type { FolderStatusResponse } from "@/features/upload/api/ocrApi"
import {
  digitizationToFolderStatus,
  getDigitizationStatus,
  isDigitizationComplete,
  startDigitization,
} from "@/features/upload/api/sessionApi"

export type OcrFolderState = "idle" | "starting" | "polling" | "done" | "error"

const OCR_POLL_TIMEOUT_MS = 10 * 60 * 1000

export interface UseOcrFolderResult {
  state: OcrFolderState
  status: FolderStatusResponse | null
  error: string
  start: (folderPath: string, options: { maxFiles?: number; confirmedPlanVersionId: string }) => Promise<void>
  refresh: () => Promise<FolderStatusResponse | null>
  reset: () => void
}

export function useOcrFolder(sessionId: string | null): UseOcrFolderResult {
  const [state, setState] = useState<OcrFolderState>("idle")
  const [status, setStatus] = useState<FolderStatusResponse | null>(null)
  const [error, setError] = useState("")
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tokenRef = useRef(0)
  const rejectRef = useRef<((error: Error) => void) | null>(null)

  const stop = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  const reset = useCallback(() => {
    stop()
    tokenRef.current += 1
    rejectRef.current?.(new Error("Đã hủy quá trình chờ kết quả OCR."))
    rejectRef.current = null
    setState("idle")
    setStatus(null)
    setError("")
  }, [])

  const refresh = useCallback(async () => {
    if (!sessionId) {
      setState("idle")
      setStatus(null)
      setError("")
      return null
    }

    const result = await getDigitizationStatus(sessionId)
    const fallbackFolderPath = result?.batches[0]?.folder_path ?? ""
    const hasExistingWork = Boolean(
      result && (result.batches.length > 0 || result.documents.length > 0)
    )
    if (!hasExistingWork) {
      setState("idle")
      setStatus(null)
      setError("")
      return null
    }

    const nextStatus = digitizationToFolderStatus(result, fallbackFolderPath)
    setStatus(nextStatus)
    setError("")
    setState(isDigitizationComplete(result) ? "done" : "polling")
    return nextStatus
  }, [sessionId])

  useEffect(() => {
    stop()
    tokenRef.current += 1
    const token = tokenRef.current

    if (!sessionId) {
      setState("idle")
      setStatus(null)
      setError("")
      return
    }

    const pollExistingStatus = async () => {
      if (tokenRef.current !== token) return
      try {
        const result = await getDigitizationStatus(sessionId)
        if (tokenRef.current !== token) return

        const fallbackFolderPath = result?.batches[0]?.folder_path ?? ""
        const hasExistingWork = Boolean(
          result && (result.batches.length > 0 || result.documents.length > 0)
        )
        if (!hasExistingWork) {
          setState("idle")
          setStatus(null)
          setError("")
          return
        }

        setStatus(digitizationToFolderStatus(result, fallbackFolderPath))
        setError("")
        if (isDigitizationComplete(result)) {
          setState("done")
          return
        }

        setState("polling")
        timeoutRef.current = setTimeout(pollExistingStatus, 2_000)
      } catch (err) {
        if (tokenRef.current !== token) return
        setError(err instanceof Error ? err.message : "Không thể tải trạng thái số hóa.")
        setState("error")
      }
    }

    void pollExistingStatus()
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [sessionId])

  const start = useCallback(
    async (folderPath: string, options: { maxFiles?: number; confirmedPlanVersionId: string }) => {
      if (!sessionId) {
        throw new Error("Chưa có session để bắt đầu OCR.")
      }
      if (!options.confirmedPlanVersionId) {
        throw new Error("ChÆ°a xÃ¡c nháº­n phÆ°Æ¡ng Ã¡n chá»‰nh lÃ½.")
      }
      stop()
      rejectRef.current?.(new Error("Quá trình chờ kết quả OCR đã được thay thế."))
      rejectRef.current = null
      const token = tokenRef.current + 1
      tokenRef.current = token
      const startedAt = Date.now()
      setState("starting")
      setStatus(null)
      setError("")

      await startDigitization(sessionId, {
        folder_path: folderPath,
        recursive: true,
        force: false,
        max_files: options.maxFiles,
        confirmed_plan_version_id: options.confirmedPlanVersionId,
      })
      setState("polling")

      await new Promise<void>((resolve, reject) => {
        rejectRef.current = reject
        const resolvePolling = () => {
          rejectRef.current = null
          resolve()
        }
        const rejectPolling = (error: Error) => {
          rejectRef.current = null
          reject(error)
        }
        const poll = async () => {
          if (tokenRef.current !== token) {
            rejectPolling(new Error("Đã hủy quá trình chờ kết quả OCR."))
            return
          }
          try {
            if (Date.now() - startedAt > OCR_POLL_TIMEOUT_MS) {
              throw new Error("Quá thời gian chờ trạng thái OCR. Hãy kiểm tra backend worker.")
            }
            const result = await getDigitizationStatus(sessionId)
            setStatus(digitizationToFolderStatus(result, folderPath))
            if (isDigitizationComplete(result)) {
              stop()
              setState("done")
              resolvePolling()
              return
            }
            timeoutRef.current = setTimeout(poll, 2_000)
          } catch (err) {
            stop()
            const message = err instanceof Error ? err.message : "Không thể kiểm tra trạng thái OCR."
            setError(message)
            setState("error")
            rejectPolling(new Error(message))
          }
        }

        void poll()
      })
    },
    [sessionId]
  )

  return { state, status, error, start, refresh, reset }
}
