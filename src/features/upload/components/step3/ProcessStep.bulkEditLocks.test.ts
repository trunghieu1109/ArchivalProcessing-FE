import { beforeEach, describe, expect, it, vi } from "vitest"

const api = vi.hoisted(() => ({
  acquireDocumentEditLock: vi.fn(),
}))

vi.mock("@/features/upload/api/sessionApi", () => api)

import { acquireBulkDocumentEditLocks } from "./ProcessStep.actions"

describe("bulk document edit lock acquisition", () => {
  beforeEach(() => {
    api.acquireDocumentEditLock.mockImplementation(
      async (_sessionId: string, documentId: number) => {
        if (documentId === 2) throw new Error("DOCUMENT_EDIT_LOCKED")
        return { lock_token: `token-${documentId}` }
      }
    )
  })

  it("keeps successful documents and reports locked documents as partial failures", async () => {
    const result = await acquireBulkDocumentEditLocks(
      "session-1",
      [{ id: 1 }, { id: 2 }, { id: 3 }],
      2
    )

    expect(result.acquired).toEqual([
      { item: { id: 1 }, token: "token-1" },
      { item: { id: 3 }, token: "token-3" },
    ])
    expect(result.failures).toHaveLength(1)
    expect(api.acquireDocumentEditLock).toHaveBeenCalledTimes(3)
  })
})
