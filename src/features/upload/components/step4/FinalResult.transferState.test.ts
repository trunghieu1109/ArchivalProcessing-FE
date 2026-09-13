import { describe, expect, it } from "vitest"

import type { ClusterDocument } from "@/features/upload/lib/clusterGroups"
import {
  documentTransferLockLabel,
  isDocumentTransferLocked,
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
})
