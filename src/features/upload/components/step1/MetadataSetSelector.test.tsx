import { useState } from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

vi.mock("@/shared/config/featureFlags", () => ({
  DYNAMIC_METADATA_ENABLED: true,
  FONDS_MERGE_ENABLED: false,
}))
import { afterEach, describe, expect, it, vi } from "vitest"
import { MetadataSetSelector } from "./MetadataSetSelector"
import type { SessionMetadataValues } from "../SessionMetadataBar"
import { createUploadPageActions } from "@/pages/UploadPage.actions"
import { uploadPageCache as cache } from "@/pages/UploadPage.cache"

const api = vi.hoisted(() => ({
  list: vi.fn(),
  defaults: vi.fn(),
  update: vi.fn(),
}))
vi.mock("@/features/admin/api/metadataApi", () => ({
  listMetadataSets: api.list,
  getDefaultMetadataConfig: api.defaults,
  updateSessionMetadataSelection: api.update,
}))

function Form() {
  const [metadata, setMetadata] = useState<SessionMetadataValues>({
    processType: "arrangement",
  })
  return (
    <>
      <MetadataSetSelector
        metadata={metadata}
        disabled={false}
        readOnly={false}
        onChange={setMetadata}
      />
      <output data-testid="choice">{JSON.stringify(metadata)}</output>
    </>
  )
}

afterEach(() => vi.clearAllMocks())

describe("metadata set selection", () => {
  it("requires a choice, disables empty sets and preserves selected IDs", async () => {
    api.list.mockResolvedValue([
      {
        id: 12,
        name: "Tài liệu Đảng",
        field_keys: ["document_code"],
        fields: [{ key: "document_code", label: "Mã văn bản" }],
      },
      { id: 13, name: "Bộ rỗng", field_keys: [], fields: [] },
    ])
    api.defaults.mockResolvedValue({
      fields: [{ key: "so_hieu_tai_lieu", label: "Số hiệu" }],
    })
    render(
      <MemoryRouter>
        <Form />
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByRole("combobox")).toBeEnabled())
    expect(screen.getByRole("combobox")).toHaveValue("")
    expect(screen.getByRole("option", { name: /Bộ rỗng/ })).toBeDisabled()
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "12" } })
    expect(JSON.parse(screen.getByTestId("choice").textContent!)).toMatchObject(
      {
        metadata_source: "set",
        metadata_set_id: 12,
        processType: "arrangement",
      }
    )
    expect(screen.getByText("Mã văn bản")).toBeInTheDocument()
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "default" },
    })
    expect(JSON.parse(screen.getByTestId("choice").textContent!)).toMatchObject(
      { metadata_source: "default", metadata_set_id: null }
    )
  })

  it("shows the frozen set without fetching admin-only endpoints", () => {
    render(
      <MemoryRouter>
        <MetadataSetSelector
          sessionId="s1"
          metadata={{
            metadata_source: "set",
            metadata_set_id: 12,
            metadata_set_name: "Bộ đã chốt",
            metadata_selection_locked: true,
          }}
          disabled={false}
          readOnly={false}
        />
      </MemoryRouter>
    )
    expect(screen.getByText("Bộ đã chốt")).toBeInTheDocument()
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    expect(api.list).not.toHaveBeenCalled()
  })

  it("reports loading errors without silently selecting defaults", async () => {
    api.list.mockRejectedValue(new Error("Gateway chưa expose API metadata"))
    api.defaults.mockResolvedValue({ fields: [] })
    render(
      <MemoryRouter>
        <Form />
      </MemoryRouter>
    )
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Gateway chưa expose API metadata"
    )
    expect(screen.getByRole("combobox")).toHaveValue("")
  })

  it("blocks session creation without a selection", async () => {
    const previousId = cache.sessionId
    const previous = cache.sessionMetadata
    try {
      cache.sessionId = null
      cache.sessionMetadata = { processType: "arrangement" }
      await expect(createUploadPageActions({}).ensureSession()).rejects.toThrow(
        "Hãy chọn bộ metadata"
      )
    } finally {
      cache.sessionId = previousId
      cache.sessionMetadata = previous
    }
  })
})
