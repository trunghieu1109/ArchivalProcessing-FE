import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const api = vi.hoisted(() => ({
  acquireDocumentEditLock: vi.fn(),
  heartbeatDocumentEditLock: vi.fn(),
  releaseDocumentEditLock: vi.fn(),
  releaseDocumentEditLockOnPageUnload: vi.fn(),
}))

vi.mock("@/features/upload/api/sessionApi", () => api)

import {
  DOCUMENT_EDIT_LOCK_HEARTBEAT_INTERVAL_MS,
  useDocumentEditLock,
} from "./useDocumentEditLock"

describe("useDocumentEditLock", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    api.acquireDocumentEditLock.mockResolvedValue({
      session_id: "session-1",
      document_id: 11,
      locked: true,
      lock_token: "token-1",
    })
    api.heartbeatDocumentEditLock.mockResolvedValue({ locked: true })
    api.releaseDocumentEditLock.mockResolvedValue({ locked: false })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("acquires, heartbeats after four minutes, and releases on unmount", async () => {
    const { result, unmount } = renderHook(() =>
      useDocumentEditLock({ sessionId: "session-1", documentId: 11 })
    )

    await act(async () => {
      await result.current.acquire()
    })
    expect(result.current.held).toBe(true)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        DOCUMENT_EDIT_LOCK_HEARTBEAT_INTERVAL_MS
      )
    })
    expect(api.heartbeatDocumentEditLock).toHaveBeenCalledWith(
      "session-1",
      11,
      "token-1"
    )

    unmount()
    expect(api.releaseDocumentEditLock).toHaveBeenCalledTimes(1)
  })

  it("deduplicates repeated release calls", async () => {
    let resolveRelease: (() => void) | undefined
    api.releaseDocumentEditLock.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveRelease = resolve
      })
    )
    const { result } = renderHook(() =>
      useDocumentEditLock({ sessionId: "session-1", documentId: 11 })
    )
    await act(async () => {
      await result.current.acquire()
    })

    await act(async () => {
      const first = result.current.release()
      const second = result.current.release()
      resolveRelease?.()
      await Promise.all([first, second])
    })
    expect(api.releaseDocumentEditLock).toHaveBeenCalledTimes(1)
    expect(result.current.held).toBe(false)
  })

  it("marks the lock lost when heartbeat fails", async () => {
    const onLockLost = vi.fn()
    const heartbeatError = new Error("expired")
    api.heartbeatDocumentEditLock.mockRejectedValue(heartbeatError)
    const { result } = renderHook(() =>
      useDocumentEditLock({
        sessionId: "session-1",
        documentId: 11,
        onLockLost,
      })
    )
    await act(async () => {
      await result.current.acquire()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        DOCUMENT_EDIT_LOCK_HEARTBEAT_INTERVAL_MS
      )
    })

    await act(async () => {
      await Promise.resolve()
    })
    expect(onLockLost).toHaveBeenCalledWith(heartbeatError)
    expect(result.current.status).toBe("lost")
    expect(result.current.lockToken).toBeNull()
  })

  it("uses one keepalive release for repeated unload events", async () => {
    const { result } = renderHook(() =>
      useDocumentEditLock({ sessionId: "session-1", documentId: 11 })
    )
    await act(async () => {
      await result.current.acquire()
    })

    act(() => {
      window.dispatchEvent(new Event("pagehide"))
      window.dispatchEvent(new Event("beforeunload"))
    })
    expect(api.releaseDocumentEditLockOnPageUnload).toHaveBeenCalledTimes(1)
    expect(result.current.held).toBe(false)
  })

  it("releases a lock whose acquire response arrives after unmount", async () => {
    let resolveAcquire:
      | ((value: {
          session_id: string
          document_id: number
          locked: boolean
          lock_token: string
        }) => void)
      | undefined
    api.acquireDocumentEditLock.mockReturnValue(
      new Promise((resolve) => {
        resolveAcquire = resolve
      })
    )
    const { result, unmount } = renderHook(() =>
      useDocumentEditLock({ sessionId: "session-1", documentId: 11 })
    )

    let acquirePromise: Promise<string> | undefined
    act(() => {
      acquirePromise = result.current.acquire()
    })
    unmount()
    resolveAcquire?.({
      session_id: "session-1",
      document_id: 11,
      locked: true,
      lock_token: "late-token",
    })
    await act(async () => {
      await acquirePromise
    })

    expect(api.releaseDocumentEditLock).toHaveBeenCalledWith(
      "session-1",
      11,
      "late-token"
    )
  })
})
