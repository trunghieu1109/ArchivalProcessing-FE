import { describe, expect, it } from "vitest"
import { hasDossierEmbeddingMetadata } from "@/features/upload/lib/metadata"
import type { PdfMetadata } from "@/features/upload/types"
import { normalizeDocumentReviewStatus } from "@/features/upload/api/sessionApi"
import { isMetadataConfirmable } from "./ProcessStep.metadataUtils"

function metadataItem(lightMetadata: Record<string, unknown>): PdfMetadata {
  return {
    status: "done",
    review_status: "warning",
    metadata_ready: true,
    is_reviewed: false,
    light_metadata: lightMetadata,
  } as PdfMetadata
}

describe("dossier embedding metadata verification", () => {
  it("recognizes only metadata fields consumed by the dossier model", () => {
    expect(hasDossierEmbeddingMetadata({})).toBe(false)
    expect(
      hasDossierEmbeddingMetadata({
        title: "Title only",
        mentioned_subjects: ["subject"],
      })
    ).toBe(false)
    expect(
      hasDossierEmbeddingMetadata({ trich_yeu_tai_lieu: "Tóm tắt" })
    ).toBe(true)
    expect(
      hasDossierEmbeddingMetadata({ co_quan_ban_hanh: "Cơ quan" })
    ).toBe(true)
  })

  it("does not allow an empty document into the verify selection", () => {
    expect(isMetadataConfirmable(metadataItem({}))).toBe(false)
    expect(
      isMetadataConfirmable(
        metadataItem({ document_type: "Quyết định" })
      )
    ).toBe(true)
  })

  it("does not present a verified status when embedding metadata is missing", () => {
    expect(
      normalizeDocumentReviewStatus(
        { review_status: "verified", metadata_ready: true },
        { title: "Title only" }
      )
    ).toBe("warning")
  })
})
