import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const apiMocks = vi.hoisted(() => ({
  listDossiers: vi.fn(),
  listConflicts: vi.fn(),
  updateBoxNumbers: vi.fn(),
  verifyConflict: vi.fn(),
}))

vi.mock("@/features/upload/api/sessionApi", () => ({
  listSessionDossiers: apiMocks.listDossiers,
  listSessionDossierBoxNumberConflicts: apiMocks.listConflicts,
  updateSessionDossierBoxNumbers: apiMocks.updateBoxNumbers,
  verifySessionDossierBoxNumberConflict: apiMocks.verifyConflict,
}))

import { NumberingBoxNumberModal } from "./NumberingBoxNumberModal"

describe("NumberingBoxNumberModal", () => {
  beforeEach(() => {
    apiMocks.listDossiers.mockReset().mockResolvedValue({
      session_id: "session-1",
      cluster_version_id: "version-1",
      version_number: 1,
      dossiers: [
        {
          dossier_id: "dossier-1",
          title: "Hồ sơ 1",
          dossier_number: "HS-01",
          box_number: null,
        },
        {
          dossier_id: "dossier-2",
          title: "Hồ sơ 2",
          dossier_number: "HS-02",
          box_number: null,
        },
      ],
    })
    apiMocks.listConflicts.mockReset().mockResolvedValue({
      session_id: "session-1",
      cluster_version_id: "version-1",
      conflict_count: 0,
      conflicts: [],
    })
    apiMocks.updateBoxNumbers.mockReset().mockResolvedValue({
      session_id: "session-1",
      cluster_version_id: "version-1",
      cluster_version_number: 1,
      source: "manual",
      updated_by: { user_id: "worker-a", name: "Worker A", email: null },
      submitted_dossiers: 1,
      updated_dossiers: 1,
      pending_verification_dossiers: 0,
      unchanged_dossiers: 0,
      results: [],
    })
    apiMocks.verifyConflict.mockReset()
  })

  it("assigns one box number to all selected dossiers", async () => {
    const onChanged = vi.fn()
    render(
      <NumberingBoxNumberModal
        open
        sessionId="session-1"
        dossiers={[
          {
            dossier_id: "dossier-1",
            title: "Hồ sơ 1",
            dossier_number: "HS-01",
            box_number: null,
            document_count: 1,
            status_counts: {},
          },
          {
            dossier_id: "dossier-2",
            title: "Hồ sơ 2",
            dossier_number: "HS-02",
            box_number: null,
            document_count: 1,
            status_counts: {},
          },
        ]}
        canVerify={false}
        onClose={vi.fn()}
        onChanged={onChanged}
      />
    )

    const dossierCheckboxes = screen.getAllByRole("checkbox")
    fireEvent.click(dossierCheckboxes[0])
    fireEvent.click(dossierCheckboxes[1])
    fireEvent.change(screen.getByLabelText("Số hộp áp dụng chung"), {
      target: { value: "H-01" },
    })
    fireEvent.click(
      screen.getByRole("button", { name: "Gán số hộp cho 2 hồ sơ" })
    )

    await waitFor(() =>
      expect(apiMocks.updateBoxNumbers).toHaveBeenCalledWith(
        "session-1",
        ["dossier-1", "dossier-2"],
        "H-01"
      )
    )
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })
})
