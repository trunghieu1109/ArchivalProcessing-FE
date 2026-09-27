import { describe, expect, it } from "vitest"

import { normalizeClusterContentSummary } from "./homogeneousClusterSummary"

describe("normalizeClusterContentSummary", () => {
  it("removes dossier-title wording from a cluster narrative", () => {
    expect(
      normalizeClusterContentSummary(
        "Hồ sơ về việc báo cáo hiện trạng tuyến ngõ tại phường Hải Thành năm 2015."
      )
    ).toBe("Báo cáo hiện trạng tuyến ngõ tại phường Hải Thành năm 2015.")
  })

  it("keeps no more than two distinct narrative sentences", () => {
    expect(
      normalizeClusterContentSummary(
        "Nhóm tài liệu về việc kiểm tra tuyến đường. Biên bản ghi nhận hư hỏng. Công văn đề nghị sửa chữa."
      )
    ).toBe("Kiểm tra tuyến đường. Biên bản ghi nhận hư hỏng.")
  })

  it("removes a near-duplicate document summary", () => {
    expect(
      normalizeClusterContentSummary(
        "Hồ sơ về việc báo cáo hiện trạng tuyến ngõ tại các tổ dân phố và đường nội đồng trên địa bàn phường Hải Thành năm 2015. Báo cáo hiện trạng tuyến ngõ tại các TDP và đường nội đồng trên địa bàn phường."
      )
    ).toBe(
      "Báo cáo hiện trạng tuyến ngõ tại các tổ dân phố và đường nội đồng trên địa bàn phường Hải Thành năm 2015."
    )
  })

  it("uses a neutral fallback for missing summaries", () => {
    expect(normalizeClusterContentSummary("")).toBe(
      "Nhóm tài liệu có nội dung tương đồng."
    )
  })
})
