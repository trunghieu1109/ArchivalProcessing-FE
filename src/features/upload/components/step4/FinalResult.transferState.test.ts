import { describe, expect, it } from "vitest"

import type { ClusterDocument } from "@/features/upload/lib/clusterGroups"
import {
  documentTransferLockLabel,
  hasDraftSupplementalDocuments,
  hasPendingSupplementalDocuments,
  isDocumentTransferLocked,
  isSupplementalPlacementPending,
  supplementalPlacementDetails,
  supplementalPlacementLabel,
  transferSelectionError,
} from "./FinalResult.transferState"

function document(
  fileName: string,
  overrides: Partial<ClusterDocument> = {}
): ClusterDocument {
  return {
    documentId: fileName,
    sessionDocumentId: 1,
    filePath: fileName,
    fileName,
    remoteMetadataStatus: "done",
    ocrStatus: "done",
    signatureStatus: "unsigned",
    positionIndex: 0,
    pageCount: 1,
    sheetCount: 1,
    requiresReview: false,
    metadata: {},
    clusterWarning: null,
    lifecycleStatus: "active",
    ...overrides,
  }
}

describe("document transfer UI state", () => {
  it("treats an active request item lock as unavailable", () => {
    const locked = document("locked.pdf", {
      activeTransferRequestId: "transfer-request-1",
      activeTransferRequestStatus: "pending_target_approval",
    })

    expect(isDocumentTransferLocked(locked)).toBe(true)
    expect(documentTransferLockLabel(locked)).toBe("Đang chờ chuyển Phông")
  })

  it("explains which selected document blocks opening the dialog", () => {
    const message = transferSelectionError([
      document("normal.pdf"),
      document("locked.pdf", {
        activeTransferRequestId: "transfer-request-1",
      }),
    ])

    expect(message).toContain("locked.pdf")
    expect(message).toContain("yêu cầu chuyển chưa được xử lý")
  })

  it("presents a supplemental draft as draft instead of delete pending", () => {
    const supplementalDraft = document("supplemental.pdf", {
      metadata: {
        supplemental_intake_id: "intake-1",
        arrangement_status: "draft",
      },
    })

    expect(isSupplementalPlacementPending(supplementalDraft)).toBe(true)
    expect(supplementalPlacementLabel(supplementalDraft)).toBe("Bản nháp")
    expect(supplementalPlacementDetails(supplementalDraft)).toContain(
      "chưa được xác nhận OCR"
    )
  })

  it("presents a verified supplemental document as waiting for dossier update", () => {
    const verifiedSupplement = document("verified.pdf", {
      metadata: {
        supplemental_intake_id: "intake-1",
        arrangement_status: "active",
      },
    })

    expect(supplementalPlacementLabel(verifiedSupplement)).toBe(
      "Chờ cập nhật hồ sơ"
    )
  })

  it("marks a dossier with supplemental draft documents as unavailable", () => {
    const verifiedSupplement = document("verified.pdf", {
      metadata: {
        supplemental_intake_id: "intake-1",
        arrangement_status: "active",
      },
    })
    const draftSupplement = document("draft.pdf", {
      metadata: {
        supplemental_intake_id: "intake-1",
        arrangement_status: "draft",
      },
    })

    expect(hasDraftSupplementalDocuments([verifiedSupplement])).toBe(false)
    expect(hasPendingSupplementalDocuments([verifiedSupplement])).toBe(true)
    expect(
      hasDraftSupplementalDocuments([verifiedSupplement, draftSupplement])
    ).toBe(true)
  })
})
