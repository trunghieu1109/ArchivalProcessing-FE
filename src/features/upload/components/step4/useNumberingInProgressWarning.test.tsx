import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const api = vi.hoisted(() => ({
  getDocumentNumberingStatus: vi.fn(),
}))

vi.mock("@/features/upload/api/sessionApi", () => api)

import { useNumberingInProgressWarning } from "./useNumberingInProgressWarning"

function numberingStatus(active: boolean) {
  return {
    active,
    job: active ? { status: "running" } : null,
    summary: {
      pending: active ? 1 : 0,
      running: active ? 1 : 0,
    },
  }
}

describe("useNumberingInProgressWarning", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    api.getDocumentNumberingStatus.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("polls while numbering is active and clears the warning when it stops", async () => {
    api.getDocumentNumberingStatus
      .mockResolvedValueOnce(numberingStatus(true))
      .mockResolvedValueOnce(numberingStatus(false))

    const { result } = renderHook(() =>
      useNumberingInProgressWarning("session-1")
    )

    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current).toBe(true)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000)
    })

    expect(result.current).toBe(false)
    expect(api.getDocumentNumberingStatus).toHaveBeenCalledTimes(2)
  })

  it("does not request status without a session", () => {
    const { result } = renderHook(() => useNumberingInProgressWarning(null))

    expect(result.current).toBe(false)
    expect(api.getDocumentNumberingStatus).not.toHaveBeenCalled()
  })
})
