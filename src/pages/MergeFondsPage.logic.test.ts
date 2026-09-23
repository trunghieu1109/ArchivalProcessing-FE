import { describe, expect, it } from "vitest"

import { mergeFondsUiState } from "./MergeFondsPage.logic"

describe("mergeFondsUiState", () => {
  it("allows refresh when one source changed and the others are synced", () => {
    expect(
      mergeFondsUiState([
        { sync_status: "source_changed" },
        { sync_status: "synced" },
      ])
    ).toEqual({
      requiresRefresh: true,
      canRefresh: true,
      blocksDownstream: true,
      statusLabel: "Cần cập nhật từ phông nguồn",
    })
  })

  it("does not allow refresh while another source is still pending", () => {
    const state = mergeFondsUiState([
      { sync_status: "source_changed" },
      { sync_status: "pending" },
    ])

    expect(state.canRefresh).toBe(false)
    expect(state.blocksDownstream).toBe(true)
  })

  it("keeps downstream actions available when every source is synced", () => {
    expect(
      mergeFondsUiState([
        { sync_status: "synced" },
        { sync_status: "synced" },
      ])
    ).toEqual({
      requiresRefresh: false,
      canRefresh: false,
      blocksDownstream: false,
      statusLabel: "Đã đồng bộ",
    })
  })
})
