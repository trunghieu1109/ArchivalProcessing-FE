import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

const api = vi.hoisted(() => ({
  downloadAllArtifacts: vi.fn(),
  downloadArtifact: vi.fn(),
  enqueueFinalizeArtifacts: vi.fn(),
  getArtifactPreviewHtml: vi.fn(),
  getArtifactRemoteSignedUrl: vi.fn(),
  getFinalizeArtifactsStatus: vi.fn(),
  listArtifacts: vi.fn(),
}))

vi.mock("@/features/upload/api/sessionApi", () => api)

import { FinalizeArtifactsStep } from "./FinalizeArtifactsPage"

describe("FinalizeArtifactsStep polling", () => {
  beforeEach(() => {
    api.listArtifacts.mockResolvedValue({
      session_id: "session-1",
      artifacts: [
        {
          id: 10,
          session_id: "session-1",
          artifact_type: "muc_luc_ho_so_xlsx",
          file_name: "muc-luc-ho-so.xlsx",
          status: "ready",
        },
      ],
    })
    api.getFinalizeArtifactsStatus.mockResolvedValue({
      session_id: "session-1",
      job_type: "finalize_artifacts",
      active: false,
      job: null,
      progress: null,
      result: null,
    })
  })

  it("does not poll an old done job before dispatch returns the new job ID", async () => {
    let resolveDispatch: ((value: Record<string, unknown>) => void) | undefined
    api.enqueueFinalizeArtifacts.mockReturnValue(
      new Promise((resolve) => {
        resolveDispatch = resolve
      })
    )

    render(
      <MemoryRouter>
        <FinalizeArtifactsStep sessionId="session-1" embedded />
      </MemoryRouter>
    )

    const recreateButton = await screen.findByRole("button", {
      name: "Tạo lại",
    })
    await waitFor(() =>
      expect(api.getFinalizeArtifactsStatus).toHaveBeenCalled()
    )
    api.getFinalizeArtifactsStatus.mockClear()

    fireEvent.click(recreateButton)
    await waitFor(() => expect(api.enqueueFinalizeArtifacts).toHaveBeenCalled())
    expect(api.getFinalizeArtifactsStatus).not.toHaveBeenCalled()

    api.getFinalizeArtifactsStatus.mockResolvedValue({
      session_id: "session-1",
      job_type: "finalize_artifacts",
      active: true,
      job: { id: 23, status: "running" },
      progress: null,
      result: null,
    })
    await act(async () => {
      resolveDispatch?.({
        session_id: "session-1",
        job_id: 23,
        job_type: "finalize_artifacts",
        status: "queued",
        created: true,
        payload: {},
        worker_required: true,
      })
    })

    await waitFor(() =>
      expect(api.getFinalizeArtifactsStatus).toHaveBeenCalledWith(
        "session-1",
        23
      )
    )
  })
})
