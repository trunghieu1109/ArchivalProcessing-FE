import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  getDocumentPreviewUrl,
  type DocumentPreviewUrlResponse,
} from "@/features/upload/api/sessionApi"
import {
  getCachedDocumentPreview,
  invalidateDocumentPreview,
  loadDocumentPreview,
} from "./documentPreviewCache"

vi.mock("@/features/upload/api/sessionApi", () => ({
  getDocumentPreviewUrl: vi.fn(),
}))

const getDocumentPreviewUrlMock = vi.mocked(getDocumentPreviewUrl)
const previewResponse = {
  active_variant_key: "original",
  variants: [],
} as unknown as DocumentPreviewUrlResponse

describe("documentPreviewCache", () => {
  beforeEach(() => {
    getDocumentPreviewUrlMock.mockReset()
  })

  it("deduplicates concurrent preview URL requests", async () => {
    let resolveRequest!: (value: DocumentPreviewUrlResponse) => void
    getDocumentPreviewUrlMock.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve
      })
    )

    const first = loadDocumentPreview("session-dedupe", 17, "dossier_review")
    const second = loadDocumentPreview("session-dedupe", 17, "dossier_review")

    expect(getDocumentPreviewUrlMock).toHaveBeenCalledTimes(1)
    resolveRequest(previewResponse)
    await expect(Promise.all([first, second])).resolves.toEqual([
      previewResponse,
      previewResponse,
    ])
  })

  it("reuses a ready response until it is invalidated", async () => {
    getDocumentPreviewUrlMock.mockResolvedValue(previewResponse)

    await loadDocumentPreview("session-cache", 23, "dossier_review")
    await loadDocumentPreview("session-cache", 23, "dossier_review")

    expect(getDocumentPreviewUrlMock).toHaveBeenCalledTimes(1)
    expect(
      getCachedDocumentPreview("session-cache", 23, "dossier_review")
    ).toBe(previewResponse)

    invalidateDocumentPreview("session-cache", 23, "dossier_review")
    await loadDocumentPreview("session-cache", 23, "dossier_review")
    expect(getDocumentPreviewUrlMock).toHaveBeenCalledTimes(2)
  })
})
