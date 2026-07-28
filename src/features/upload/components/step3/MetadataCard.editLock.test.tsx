import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { PdfMetadata } from "@/features/upload/types"

const api = vi.hoisted(() => ({
  acquireDocumentEditLock: vi.fn(),
  heartbeatDocumentEditLock: vi.fn(),
  releaseDocumentEditLock: vi.fn(),
  releaseDocumentEditLockOnPageUnload: vi.fn(),
}))

vi.mock("@/features/upload/api/sessionApi", () => api)

import { MetadataCard } from "./MetadataCard"

const baseItem: PdfMetadata = {
  id: 11,
  document_id: "document-11",
  data_path: "documents/document-11.pdf",
  status: "done",
  review_status: "pending",
  metadata_ready: true,
  metadata_final: true,
  light_metadata: { document_type: "Công văn" },
  applied: false,
}

describe("MetadataCard edit lock", () => {
  beforeEach(() => {
    api.acquireDocumentEditLock.mockResolvedValue({
      session_id: "session-1",
      document_id: 11,
      locked: true,
      lock_token: "token-1",
    })
    api.heartbeatDocumentEditLock.mockResolvedValue({ locked: true })
    api.releaseDocumentEditLock.mockResolvedValue({ locked: false })
  })

  it("hides delete while the document has an active lock", () => {
    render(
      <MetadataCard
        item={{
          ...baseItem,
          edit_lock: {
            locked: true,
            locked_by: { name: "Worker A" },
            lock_expires_at: "2026-07-28T10:10:00Z",
          },
        }}
        sessionId="session-1"
        onApply={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    expect(screen.getByText("Worker A đang sửa")).toBeInTheDocument()
    expect(
      screen.queryByTitle("Xóa tài liệu khỏi session")
    ).not.toBeInTheDocument()
  })

  it("acquires before opening the editor and releases when cancelled", async () => {
    render(
      <MetadataCard item={baseItem} sessionId="session-1" onApply={vi.fn()} />
    )

    fireEvent.click(screen.getByRole("button", { name: /document-11\.pdf/i }))
    fireEvent.click(await screen.findByRole("button", { name: "Sửa" }))

    await waitFor(() =>
      expect(api.acquireDocumentEditLock).toHaveBeenCalledWith("session-1", 11)
    )
    expect(await screen.findByRole("button", { name: "Hủy" })).toBeEnabled()
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }))
    await waitFor(() =>
      expect(api.releaseDocumentEditLock).toHaveBeenCalledWith(
        "session-1",
        11,
        "token-1"
      )
    )
  })
})
