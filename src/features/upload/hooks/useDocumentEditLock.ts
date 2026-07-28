import { useCallback, useEffect, useRef, useState } from "react"

import {
  acquireDocumentEditLock,
  heartbeatDocumentEditLock,
  releaseDocumentEditLock,
  releaseDocumentEditLockOnPageUnload,
} from "@/features/upload/api/sessionApi"

export const DOCUMENT_EDIT_LOCK_HEARTBEAT_INTERVAL_MS = 4 * 60 * 1_000

export type DocumentEditLockStatus =
  | "idle"
  | "acquiring"
  | "held"
  | "releasing"
  | "lost"

interface UseDocumentEditLockOptions {
  sessionId: string | null
  documentId: number
  onLockLost?: (error: unknown) => void
}

export function useDocumentEditLock({
  sessionId,
  documentId,
  onLockLost,
}: UseDocumentEditLockOptions) {
  const [status, setStatus] = useState<DocumentEditLockStatus>("idle")
  const [lockToken, setLockToken] = useState<string | null>(null)
  const tokenRef = useRef<string | null>(null)
  const acquirePromiseRef = useRef<Promise<string> | null>(null)
  const releasePromiseRef = useRef<Promise<void> | null>(null)
  const mountedRef = useRef(true)
  const onLockLostRef = useRef(onLockLost)

  useEffect(() => {
    onLockLostRef.current = onLockLost
  }, [onLockLost])

  const clearLocalLock = useCallback((nextStatus: DocumentEditLockStatus) => {
    tokenRef.current = null
    if (mountedRef.current) {
      setLockToken(null)
      setStatus(nextStatus)
    }
  }, [])

  const acquire = useCallback(async (): Promise<string> => {
    if (!sessionId) throw new Error("Chưa có session để khóa chỉnh sửa.")
    if (releasePromiseRef.current) {
      await releasePromiseRef.current.catch(() => undefined)
    }
    if (tokenRef.current) return tokenRef.current
    if (acquirePromiseRef.current) return acquirePromiseRef.current

    setStatus("acquiring")
    const request = acquireDocumentEditLock(sessionId, documentId)
      .then((response) => {
        const token = String(response.lock_token ?? "").trim()
        if (!token) throw new Error("Backend không trả lock_token.")
        if (!mountedRef.current) {
          void releaseDocumentEditLock(sessionId, documentId, token).catch(
            () => undefined
          )
          return token
        }
        tokenRef.current = token
        setLockToken(token)
        setStatus("held")
        return token
      })
      .catch((error: unknown) => {
        clearLocalLock("idle")
        throw error
      })
      .finally(() => {
        acquirePromiseRef.current = null
      })
    acquirePromiseRef.current = request
    return request
  }, [clearLocalLock, documentId, sessionId])

  const release = useCallback(async (): Promise<void> => {
    if (releasePromiseRef.current) return releasePromiseRef.current
    const token = tokenRef.current
    if (!sessionId || !token) {
      clearLocalLock("idle")
      return
    }

    tokenRef.current = null
    if (mountedRef.current) {
      setLockToken(null)
      setStatus("releasing")
    }
    const request = releaseDocumentEditLock(sessionId, documentId, token)
      .then(() => undefined)
      .finally(() => {
        clearLocalLock("idle")
        releasePromiseRef.current = null
      })
    releasePromiseRef.current = request
    return request
  }, [clearLocalLock, documentId, sessionId])

  useEffect(() => {
    if (!sessionId || status !== "held" || !lockToken) return
    const intervalId = window.setInterval(() => {
      const token = tokenRef.current
      if (!token) return
      void heartbeatDocumentEditLock(sessionId, documentId, token).catch(
        (error: unknown) => {
          if (tokenRef.current !== token) return
          clearLocalLock("lost")
          onLockLostRef.current?.(error)
        }
      )
    }, DOCUMENT_EDIT_LOCK_HEARTBEAT_INTERVAL_MS)
    return () => window.clearInterval(intervalId)
  }, [clearLocalLock, documentId, lockToken, sessionId, status])

  useEffect(() => {
    if (!sessionId) return
    const handlePageHide = () => {
      const token = tokenRef.current
      if (!token) return
      releaseDocumentEditLockOnPageUnload(sessionId, documentId, token)
      clearLocalLock("idle")
    }
    window.addEventListener("pagehide", handlePageHide)
    window.addEventListener("beforeunload", handlePageHide)
    return () => {
      window.removeEventListener("pagehide", handlePageHide)
      window.removeEventListener("beforeunload", handlePageHide)
    }
  }, [clearLocalLock, documentId, sessionId])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      const token = tokenRef.current
      tokenRef.current = null
      if (sessionId && token) {
        void releaseDocumentEditLock(sessionId, documentId, token).catch(
          () => undefined
        )
      }
    }
  }, [documentId, sessionId])

  return {
    status,
    lockToken,
    held: status === "held" && Boolean(lockToken),
    acquire,
    release,
  }
}
