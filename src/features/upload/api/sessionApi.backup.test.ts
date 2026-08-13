import { beforeEach, describe, expect, it, vi } from "vitest"

import { requestJson } from "./sessionApi.http"
import { collectSessionBackupUrls } from "./sessionApi.backup"

vi.mock("./sessionApi.http", () => ({
  requestJson: vi.fn(),
}))

const requestJsonMock = vi.mocked(requestJson)

describe("collectSessionBackupUrls", () => {
  beforeEach(() => {
    requestJsonMock.mockReset()
  })

  it("collects every document page and detects a changed source fingerprint", async () => {
    requestJsonMock
      .mockResolvedValueOnce(manifest("before", 3))
      .mockResolvedValueOnce({ session: { session_id: "session-1" } })
      .mockResolvedValueOnce({ files: [] })
      .mockResolvedValueOnce(documentPage([1, 2], true, 2, 3))
      .mockResolvedValueOnce(documentPage([3], false, null, 3))
      .mockResolvedValueOnce({ artifacts: [] })
      .mockResolvedValueOnce(manifest("after", 3))
    const progress = vi.fn()

    const result = await collectSessionBackupUrls("session-1", progress)

    expect(result.documents.map((item) => item.id)).toEqual([1, 2, 3])
    expect(result.source_changed_during_export).toBe(true)
    expect(progress).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: "documents",
        processedDocuments: 3,
        batchNumber: 2,
      })
    )
    expect(requestJsonMock).toHaveBeenCalledWith(
      expect.stringContaining("after_id=2")
    )
  })

  it("fails closed when the document cursor does not advance", async () => {
    requestJsonMock
      .mockResolvedValueOnce(manifest("same", 2))
      .mockResolvedValueOnce({ session: {} })
      .mockResolvedValueOnce({ files: [] })
      .mockResolvedValueOnce(documentPage([1], true, 0, 2))

    await expect(collectSessionBackupUrls("session-1")).rejects.toThrow(
      "Phân trang backup document"
    )
  })

  it("propagates a failed page and does not request artifacts", async () => {
    requestJsonMock
      .mockResolvedValueOnce(manifest("same", 2))
      .mockResolvedValueOnce({ session: {} })
      .mockResolvedValueOnce({ files: [] })
      .mockRejectedValueOnce(new Error("page failed"))

    await expect(collectSessionBackupUrls("session-1")).rejects.toThrow(
      "page failed"
    )
    expect(requestJsonMock).toHaveBeenCalledTimes(4)
  })
})

function manifest(sourceFingerprint: string, documents: number) {
  return {
    schema_version: 1,
    session_id: "session-1",
    generated_at: "2026-08-13T00:00:00Z",
    source_fingerprint: sourceFingerprint,
    counts: { documents },
  }
}

function documentPage(
  ids: number[],
  hasMore: boolean,
  nextAfterId: number | null,
  total: number
) {
  return {
    schema_version: 1,
    session_id: "session-1",
    generated_at: "2026-08-13T00:00:00Z",
    pagination: {
      after_id: 0,
      limit: 100,
      returned: ids.length,
      total,
      has_more: hasMore,
      next_after_id: nextAfterId,
    },
    variants: ["original", "blank_removed", "numbered"],
    documents: ids.map((id) => ({ id })),
  }
}
