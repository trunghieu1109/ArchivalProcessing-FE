import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MetadataAdminPage } from "@/pages/MetadataAdminPage"
import { MetadataSetSelector } from "./MetadataSetSelector"
import { createSession, patchSessionMetadata } from "../../api/sessionApi.core"
import { DYNAMIC_METADATA_ENABLED } from "@/shared/config/featureFlags"

const api = vi.hoisted(() => ({
  fields: vi.fn(),
  sets: vi.fn(),
  defaults: vi.fn(),
  mutate: vi.fn(),
  update: vi.fn(),
}))
vi.mock("@/features/auth/lib/AuthContext", () => ({
  useAuth: () => ({ user: { role: "admin" } }),
}))
vi.mock("@/features/auth/components/UserMenu", () => ({ UserMenu: () => null }))
vi.mock("@/features/admin/api/metadataApi", () => ({
  listMetadataFields: api.fields,
  listMetadataSets: api.sets,
  getDefaultMetadataConfig: api.defaults,
  mutateMetadata: api.mutate,
  updateSessionMetadataSelection: api.update,
}))

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe("dynamic metadata disabled by default", () => {
  it("renders neither admin management nor the selector and never loads the library", async () => {
    expect(DYNAMIC_METADATA_ENABLED).toBe(false)
    const { container } = render(
      <MemoryRouter>
        <MetadataAdminPage />
        <MetadataSetSelector
          disabled={false}
          readOnly={false}
          metadata={{ metadata_source: "set", metadata_set_id: 12 }}
        />
      </MemoryRouter>
    )
    await waitFor(() => expect(container).toBeEmptyDOMElement())
    expect(
      screen.queryByRole("combobox", { name: "Bộ metadata" })
    ).not.toBeInTheDocument()
    // Flush the deferred effects that normally fetch the library.
    await new Promise((resolve) => window.setTimeout(resolve, 20))
    expect(api.fields).not.toHaveBeenCalled()
    expect(api.sets).not.toHaveBeenCalled()
    expect(api.defaults).not.toHaveBeenCalled()
  })

  it("sends the old create payload even when a caller retains a cached set selection", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ session_id: "created" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)
    await createSession("ui", {
      processType: "arrangement",
      fonds_name: "Example",
      metadata_source: "set",
      metadata_set_id: 12,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
      created_by: "ui",
      processType: "arrangement",
      fonds_name: "Example",
    })
  })

  it("keeps the empty creation payload and classic metadata patch contract", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(
      async () =>
        new Response(JSON.stringify({ session_id: "created" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
    )
    vi.stubGlobal("fetch", fetchMock)
    await createSession()
    await patchSessionMetadata("created", {
      fonds_name: "Changed",
      metadata_source: "set",
      metadata_set_id: 12,
      metadata_config_snapshot: { version: 2 },
      metadata_binding_error: "hidden",
    } as Parameters<typeof patchSessionMetadata>[1])
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
      created_by: "ui",
    })
    expect(JSON.parse(fetchMock.mock.calls[1][1]?.body as string)).toEqual({
      fonds_name: "Changed",
    })
    expect(fetchMock.mock.calls[1][1]?.method).toBe("PATCH")
  })
})
