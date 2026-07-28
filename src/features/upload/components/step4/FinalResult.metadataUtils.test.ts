import { describe, expect, it } from "vitest"
import type { PdfMetadata } from "@/features/upload/types"
import { stableFinalResultMetadataItems } from "./FinalResult.metadataUtils"

describe("stableFinalResultMetadataItems", () => {
  it("reuses one empty array when metadata items are omitted", () => {
    expect(stableFinalResultMetadataItems(undefined)).toBe(
      stableFinalResultMetadataItems(undefined)
    )
  })

  it("keeps the provided collection reference", () => {
    const items: PdfMetadata[] = []

    expect(stableFinalResultMetadataItems(items)).toBe(items)
  })
})
