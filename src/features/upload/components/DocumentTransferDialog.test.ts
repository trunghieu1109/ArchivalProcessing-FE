import { describe, expect, it } from "vitest"

import {
  buildClassificationTree,
  classificationLeafKey,
} from "./documentTransferClassificationTree"
import { transferValidationMessages } from "./documentTransferValidation"

describe("transferValidationMessages", () => {
  it("identifies the locked document and request", () => {
    const messages = transferValidationMessages(
      [
        {
          code: "DOCUMENT_TRANSFER_LOCKED",
          session_document_id: 12,
          message:
            "Tài liệu đang thuộc một yêu cầu chuyển Phông chưa được xử lý.",
          request_id: "transfer-request-1",
        },
      ],
      [
        { id: 11, name: "normal.pdf" },
        { id: 12, name: "locked.pdf" },
      ]
    )

    expect(messages).toEqual([
      "locked.pdf: Tài liệu đang thuộc một yêu cầu chuyển Phông chưa được xử lý. Yêu cầu: transfer-request-1.",
    ])
  })
})

describe("transfer classification tree", () => {
  it("keeps parent paths visible and only attaches selection to leaf nodes", () => {
    const leaves = [
      {
        group_id: "2025",
        group_ids: ["finance", "2025"],
        group_path: ["Tài chính", "Năm 2025"],
      },
      {
        group_id: "2025",
        group_ids: ["personnel", "2025"],
        group_path: ["Tổ chức cán bộ", "Năm 2025"],
      },
    ]

    const tree = buildClassificationTree(leaves)

    expect(tree).toHaveLength(2)
    expect(tree[0]).toMatchObject({
      name: "Tài chính",
      children: [{ name: "Năm 2025", leaf: leaves[0] }],
    })
    expect(tree[0].leaf).toBeUndefined()
    expect(classificationLeafKey(leaves[0])).not.toBe(
      classificationLeafKey(leaves[1])
    )
  })
})
