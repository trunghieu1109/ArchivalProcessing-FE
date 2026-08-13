import { describe, expect, it } from "vitest"

import { ApiRequestError } from "@/features/upload/api/sessionApi.http"
import {
  deletionBlockerLabel,
  deletionErrorMessage,
} from "./DocumentDeletionDialog.logic"

describe("document deletion cluster-history blockers", () => {
  it("prefers the backend message", () => {
    expect(
      deletionBlockerLabel({
        code: "DOCUMENT_ALREADY_CLUSTERED",
        message: "Báo cáo A đã từng được lập hồ sơ.",
        file_name: "bao-cao-a.pdf",
      })
    ).toBe("Báo cáo A đã từng được lập hồ sơ.")
  })

  it("builds a per-document fallback message", () => {
    expect(
      deletionBlockerLabel({
        code: "DOCUMENT_ALREADY_CLUSTERED",
        file_name: "bao-cao-b.pdf",
        cluster_membership_count: 2,
      })
    ).toContain("bao-cao-b.pdf")
  })

  it("uses blocker messages from a 409 response", () => {
    const error = new Error(
      JSON.stringify({
        message: "Không thể xóa.",
        blocking_jobs: [
          {
            code: "DOCUMENT_ALREADY_CLUSTERED",
            message: "Tài liệu A đã từng được lập hồ sơ.",
          },
          {
            code: "DOCUMENT_ALREADY_CLUSTERED",
            message: "Tài liệu B đã từng được lập hồ sơ.",
          },
        ],
      })
    )

    expect(deletionErrorMessage(error, "Lỗi")).toBe(
      "Không thể xóa: Tài liệu A đã từng được lập hồ sơ, Tài liệu B đã từng được lập hồ sơ."
    )
  })

  it("reads blocker messages from the actual API error detail", () => {
    const error = new ApiRequestError(
      "Một hoặc nhiều tài liệu đã từng được lập hồ sơ và không thể xóa.",
      409,
      {
        code: "DOCUMENT_ALREADY_CLUSTERED",
        detail: {
          message:
            "Một hoặc nhiều tài liệu đã từng được lập hồ sơ và không thể xóa.",
          blocking_jobs: [
            {
              code: "DOCUMENT_ALREADY_CLUSTERED",
              message: 'Tài liệu "bao-cao-a.pdf" đã từng được lập hồ sơ.',
            },
          ],
        },
      }
    )

    expect(deletionErrorMessage(error, "Lỗi")).toBe(
      'Một hoặc nhiều tài liệu đã từng được lập hồ sơ và không thể xóa: Tài liệu "bao-cao-a.pdf" đã từng được lập hồ sơ.'
    )
  })

  it("keeps the legacy active-cluster blocker compatible", () => {
    expect(
      deletionBlockerLabel({
        code: "DOCUMENT_DELETION_LOCKED_AFTER_CLUSTERING",
        message: "Session đã lập hồ sơ.",
      })
    ).toBe("Session đã lập hồ sơ.")
  })
})
