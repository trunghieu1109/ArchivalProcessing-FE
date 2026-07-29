import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { NumberingStatusResponse } from "@/features/upload/api/sessionApi"
import {
  NumberingTimelineControls,
  NumberingTimelineWorkingActions,
} from "./NumberingStep.parts"
import {
  mergeCachedNumberingPage,
  mergeNumberingSummaryResponse,
} from "./NumberingStep.utils"

describe("NumberingTimelineControls", () => {
  it("separates timeline browsing from working-state actions", () => {
    const onPrevious = vi.fn()
    const onNext = vi.fn()

    render(
      <NumberingTimelineControls
        applied={2}
        viewed={null}
        count={3}
        dirty
        busy={false}
        canPrevious
        canNext={false}
        canApply={false}
        onWorking={vi.fn()}
        onPrevious={onPrevious}
        onNext={onNext}
        onApply={vi.fn()}
      />
    )

    expect(
      screen.getByText("Đang sử dụng trạng thái 2/3 · Có thay đổi chưa lưu")
    ).toBeTruthy()
    expect(screen.getByRole("button", { name: "Trước" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Trước" }))
    expect(onPrevious).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Sau" })).toBeDisabled()
    expect(onNext).not.toHaveBeenCalled()
    expect(
      screen.queryByRole("button", { name: "Lưu trạng thái" })
    ).not.toBeInTheDocument()
  })

  it("marks an incompatible historical state as read-only", () => {
    const reason =
      "Chỉ có thể sử dụng state thuộc kết quả lập hồ sơ hiện hành."

    render(
      <NumberingTimelineControls
        applied={6}
        viewed={2}
        count={7}
        dirty={false}
        busy={false}
        canPrevious
        canNext
        canApply={false}
        applyBlockedReason={reason}
        onWorking={vi.fn()}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onApply={vi.fn()}
      />
    )

    expect(screen.getByText(reason)).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Sử dụng trạng thái" })
    ).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Sử dụng trạng thái" })
    ).toHaveAttribute(
      "title",
      reason
    )
    expect(screen.getByRole("button", { name: "Bản đang dùng" })).toBeEnabled()
  })

  it("renders save and discard as working actions", () => {
    const onDiscard = vi.fn()
    const onSave = vi.fn()
    render(
      <NumberingTimelineWorkingActions
        busy={false}
        canDiscard
        canSave
        onDiscard={onDiscard}
        onSave={onSave}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "Bỏ thay đổi" }))
    fireEvent.click(screen.getByRole("button", { name: "Lưu trạng thái" }))
    expect(onDiscard).toHaveBeenCalledOnce()
    expect(onSave).toHaveBeenCalledOnce()
  })

  it("keeps the latest timeline metadata when showing a cached document page", () => {
    const current = {
      session_id: "session-1",
      cluster_version_id: "cluster-current",
      document_numbering_mode: "page",
      active: false,
      job: null,
      summary: {
        total_documents: 1,
        status_counts: { done: 1 },
        done: 1,
        failed: 0,
        pending: 0,
        running: 0,
      },
      documents: [{ session_document_id: 1 }],
      dossiers: [],
      numbering_capabilities: { timeline_enabled: true },
      numbering_configuration: {
        id: 60,
        cluster_version_id: "cluster-current",
        document_numbering_mode: "page",
      },
      numbering_state: {
        current: {
          id: 106,
          configuration_id: 60,
          sequence_number: 6,
          created_by: "manager",
        },
        count: 7,
        dirty: false,
        can_previous: true,
        can_next: true,
        can_discard: false,
        inactive_document_count: 0,
      },
    } as unknown as NumberingStatusResponse
    const cachedDocuments = [{ session_document_id: 2 }]
    const cached = {
      ...current,
      documents: cachedDocuments,
      numbering_state: {
        ...current.numbering_state,
        current: {
          id: 102,
          configuration_id: 60,
          sequence_number: 2,
          created_by: "manager",
        },
      },
    } as unknown as NumberingStatusResponse

    const merged = mergeCachedNumberingPage(current, cached)

    expect(merged.numbering_state).toBe(current.numbering_state)
    expect(merged.numbering_configuration).toBe(current.numbering_configuration)
    expect(merged.numbering_capabilities).toBe(current.numbering_capabilities)
    expect(merged.documents).toBe(cachedDocuments)
  })

  it("keeps the visible rows until the final full status refresh is applied", () => {
    const visibleDocuments = [
      { session_document_id: 1, status: "running" },
      { session_document_id: 2, status: "running" },
    ]
    const visibleDossiers = [{ dossier_id: "dossier-1" }]
    const current = {
      session_id: "session-1",
      cluster_version_id: "cluster-current",
      document_numbering_mode: "page",
      active: true,
      job: { id: 10, status: "running" },
      summary: {
        total_documents: 2,
        status_counts: { running: 2 },
        done: 0,
        failed: 0,
        pending: 0,
        running: 2,
      },
      documents: visibleDocuments,
      dossiers: visibleDossiers,
      pagination: { total: 1, limit: 10, offset: 0, returned: 1 },
    } as unknown as NumberingStatusResponse
    const completedSummary = {
      ...current,
      active: false,
      job: null,
      summary: {
        total_documents: 2,
        status_counts: { done: 2 },
        done: 2,
        failed: 0,
        pending: 0,
        running: 0,
      },
      documents: [],
      dossiers: [],
      pagination: { total: 1, limit: null, offset: 0, returned: 0 },
    } as unknown as NumberingStatusResponse

    const merged = mergeNumberingSummaryResponse(current, completedSummary)

    expect(merged.active).toBe(false)
    expect(merged.summary.done).toBe(2)
    expect(merged.documents).toBe(visibleDocuments)
    expect(merged.dossiers).toBe(visibleDossiers)
    expect(merged.pagination?.returned).toBe(1)
  })
})
