import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const apiMocks = vi.hoisted(() => ({
  exportMetadata: vi.fn(),
  downloadArtifact: vi.fn(),
  saveBlob: vi.fn(),
}))

vi.mock("@/features/auth/lib/AuthContext", () => ({
  useAuth: () => ({ user: { role: "admin" } }),
}))

vi.mock("@/features/upload/api/sessionApi", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/features/upload/api/sessionApi")
  >()),
  getNumberingStyles: vi.fn().mockResolvedValue({ styles: [] }),
  getDocumentNumberingStatus: vi.fn().mockResolvedValue({
    session_id: "session-1",
    cluster_version_id: "version-1",
    document_numbering_mode: "page",
    active: false,
    job: null,
    summary: {
      total_documents: 100,
      total_dossiers: 20,
      status_counts: {},
      done: 100,
      failed: 0,
      pending: 0,
      running: 0,
    },
    documents: [],
    dossiers: [],
  }),
  exportMetadataSnapshot: apiMocks.exportMetadata,
  downloadArtifact: apiMocks.downloadArtifact,
}))

vi.mock("./NumberingStep.preview", () => ({
  NumberedPdfPreviewPanel: () => null,
}))

vi.mock("./NumberingStep.utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./NumberingStep.utils")>()),
  saveBlob: apiMocks.saveBlob,
}))

import { NumberingStep } from "./NumberingStep"
import {
  createDossierMetadataDraft,
  dossierPatchPayloadFromDraft,
  DOSSIER_METADATA_EDIT_FIELDS,
} from "../step4/FinalResult.metadataUtils"

describe("NumberingStep metadata export", () => {
  it("keeps normal dossier metadata edits available without sending a hidden dossier number", () => {
    const draft = createDossierMetadataDraft(null)
    draft.dossierNumber = "HS-01"
    draft.title = "Updated title"
    expect(DOSSIER_METADATA_EDIT_FIELDS.map((field) => field.key)).not.toContain(
      "dossierNumber"
    )
    const fullPayload = dossierPatchPayloadFromDraft(draft)
    expect(fullPayload).not.toHaveProperty("dossier_number")
    expect(fullPayload.title).toBe("Updated title")
    expect(
      dossierPatchPayloadFromDraft(draft, new Set(["title", "dossierNumber"]))
    ).toEqual({ title: "Updated title" })
  })

  it("exports and downloads the entire session directly without a dossier picker", async () => {
    const blob = new Blob(["metadata"])
    apiMocks.exportMetadata.mockResolvedValue({
      artifacts: [{ id: 17, file_name: "metadata.xlsx" }],
    })
    apiMocks.downloadArtifact.mockResolvedValue({
      blob,
      fileName: "metadata.xlsx",
    })

    render(
      <NumberingStep
        sessionId="session-1"
        documentNumberingMode="page"
        documentNumberingStylePreset="pencil_miama"
        onContinue={() => undefined}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Xuất metadata" }))

    await waitFor(() =>
      expect(apiMocks.saveBlob).toHaveBeenCalledWith(blob, "metadata.xlsx")
    )
    expect(apiMocks.exportMetadata).toHaveBeenCalledWith("session-1", {
      created_by: "ui",
      metadata_export_mode: "combined",
    })
    expect(apiMocks.downloadArtifact).toHaveBeenCalledWith("session-1", 17)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Nhập số hộp thủ công" })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Nhập metadata" })
    ).toBeEnabled()
  })
})
