import { describe, expect, it } from "vitest"

import { buildHomogeneousProgressView } from "./HomogeneousClustersPage.progress"

describe("buildHomogeneousProgressView", () => {
  it("starts with a visible zero-percent bar and all three phases", () => {
    const view = buildHomogeneousProgressView({
      stage: "preparing",
      document_count: 24,
      considered_document_count: 0,
      pair_score_count: 0,
      possible_pair_count: 276,
      total_batches: 2,
    })

    expect(view.percentage).toBe(0)
    expect(view.phaseTitle).toBe("Đang chuẩn bị phân tích tài liệu")
    expect(view.phases).toEqual([
      {
        id: "pairing",
        label: "Tính pair và phân cụm",
        percentage: 0,
        status: "active",
      },
      {
        id: "clustering",
        label: "Chốt cụm tài liệu",
        percentage: 0,
        status: "pending",
      },
      {
        id: "summarizing",
        label: "Sinh tóm tắt",
        percentage: 0,
        status: "pending",
      },
    ])
  })

  it("uses both pair and document progress during clustering", () => {
    const view = buildHomogeneousProgressView({
      stage: "clustering",
      document_count: 29,
      considered_document_count: 29,
      processed_document_count: 0,
      pair_score_count: 128,
      possible_pair_count: 406,
      cluster_count: 0,
      unclustered_count: 0,
      batch_number: 1,
      completed_batch_count: 0,
      batch_status: "processing",
      total_batches: 1,
    })

    expect(view.percentage).toBe(22)
    expect(view.phases[0]).toMatchObject({
      id: "pairing",
      percentage: 32,
      status: "active",
    })
  })

  it("shows cluster finalization as a separate phase", () => {
    const view = buildHomogeneousProgressView({
      stage: "finalizing",
      stage_progress_percentage: 50,
      document_count: 29,
      processed_document_count: 29,
      pair_score_count: 406,
      possible_pair_count: 406,
      cluster_count: 21,
    })

    expect(view.percentage).toBe(78)
    expect(view.phaseTitle).toBe("Đang chốt cụm tài liệu")
    expect(view.phases[0].status).toBe("completed")
    expect(view.phases[1]).toMatchObject({
      percentage: 50,
      status: "active",
    })
  })

  it("continues the overall bar while summaries are generated", () => {
    const view = buildHomogeneousProgressView({
      stage: "summarizing",
      document_count: 29,
      processed_document_count: 29,
      pair_score_count: 406,
      possible_pair_count: 406,
      cluster_count: 20,
      summarized_cluster_count: 8,
    })

    expect(view.percentage).toBe(91)
    expect(view.phaseTitle).toBe("Đang sinh tóm tắt cụm")
    expect(view.phases[2]).toMatchObject({
      percentage: 40,
      status: "active",
    })
  })

  it("does not regress after summaries while results are persisted", () => {
    const view = buildHomogeneousProgressView({
      stage: "persisting",
      document_count: 29,
      processed_document_count: 29,
      cluster_count: 20,
      summarized_cluster_count: 20,
    })

    expect(view.percentage).toBe(100)
    expect(view.phaseTitle).toBe("Đang lưu kết quả cụm")
    expect(view.phases.every((phase) => phase.status === "completed")).toBe(
      true
    )
  })
})
