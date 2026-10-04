import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { NumberingMetadataExportModal } from "./NumberingMetadataExportModal"

const apiMocks = vi.hoisted(() => ({
  listSessionDossiers: vi.fn(),
}))

vi.mock("@/features/upload/api/sessionApi", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/features/upload/api/sessionApi")
  >()),
  listSessionDossiers: apiMocks.listSessionDossiers,
}))

describe("NumberingMetadataExportModal", () => {
  beforeEach(() => {
    apiMocks.listSessionDossiers.mockReset()
    apiMocks.listSessionDossiers.mockResolvedValue({
      session_id: "session-1",
      cluster_version_id: "version-1",
      version_number: 1,
      dossiers: [
        {
          dossier_id: "dossier-1",
          cluster_id: "cluster-1",
          generated_title: "Hồ sơ 1",
          title: "Hồ sơ 1",
          title_override: null,
          dossier_number: "HS-01",
          box_number: "H-01",
          folder_name: null,
          retention_period: null,
          document_ids: ["doc-1", "doc-2"],
        },
        {
          dossier_id: "dossier-2",
          cluster_id: "cluster-2",
          generated_title: "Hồ sơ 2",
          title: "Hồ sơ 2",
          title_override: null,
          dossier_number: "HS-02",
          box_number: null,
          folder_name: null,
          retention_period: null,
          document_ids: ["doc-3"],
        },
      ],
    })
  })

  it("exports only the dossiers left selected by the user", async () => {
    const onExport = vi.fn().mockResolvedValue(true)
    const onClose = vi.fn()

    render(
      <NumberingMetadataExportModal
        open
        sessionId="session-1"
        dossiers={[]}
        exporting={false}
        onClose={onClose}
        onExport={onExport}
      />
    )

    await waitFor(() => expect(screen.getAllByRole("checkbox")).toHaveLength(2))
    expect(screen.getByText("Đã chọn 2/2 hồ sơ")).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole("checkbox")[1])
    fireEvent.click(
      screen.getByRole("button", { name: "Xuất metadata cho 1 hồ sơ" })
    )

    await waitFor(() => expect(onExport).toHaveBeenCalledWith(["dossier-1"]))
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  })
})
