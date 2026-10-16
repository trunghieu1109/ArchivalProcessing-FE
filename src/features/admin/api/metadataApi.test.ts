import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const gatewayBase = "http://gateway.example/api/v1"
const fetchMock = vi.fn()

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv("VITE_CHINHLY_METADATA_API_BASE_URL", `${gatewayBase}/`)
  vi.stubEnv("VITE_ARCHIVAL_API_BASE_URL", "/api")
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockReset()
  fetchMock.mockImplementation(
    async () =>
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
  )
  localStorage.setItem(
    "archival-processing:chinhly-auth",
    JSON.stringify({ access_token: "test-user-token", user: { role: "admin" } })
  )
})

afterEach(() => {
  localStorage.clear()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("direct Chinhly metadata library API", () => {
  it.each([
    ["listMetadataFields", "/metadata-fields"],
    ["listMetadataSets", "/metadata-sets"],
    ["getDefaultMetadataConfig", "/metadata-sets/default-config"],
  ] as const)(
    "routes %s to the Gateway with the user's token",
    async (name, path) => {
      const api = await import("./metadataApi")
      await api[name]()
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe(`${gatewayBase}${path}`)
      expect(new Headers(init.headers).get("Authorization")).toBe(
        "Bearer test-user-token"
      )
    }
  )

  it("loads set details directly", async () => {
    const api = await import("./metadataApi")
    await api.getMetadataSet(5)
    expect(fetchMock.mock.calls[0][0]).toBe(`${gatewayBase}/metadata-sets/5`)
  })

  it.each([
    ["metadata-sets", "POST"],
    ["metadata-fields/dia_diem", "PATCH"],
    ["metadata-sets/5/fields", "POST"],
    ["metadata-sets/5/fields/dia_diem", "PATCH"],
    ["metadata-sets/5", "PATCH"],
  ] as const)("sends %s %s and its payload directly", async (path, method) => {
    const api = await import("./metadataApi")
    const payload = { label: "Địa điểm", description: "Trích địa điểm." }
    await api.mutateMetadata(path, method, payload)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${gatewayBase}/${path}`)
    expect(init.method).toBe(method)
    expect(JSON.parse(init.body)).toEqual(payload)
    expect(new Headers(init.headers).get("Content-Type")).toBe(
      "application/json"
    )
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer test-user-token"
    )
  })

  it("supports DELETE with an empty 204 response", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    const api = await import("./metadataApi")
    await expect(
      api.mutateMetadata("metadata-sets/5/fields/dia_diem", "DELETE")
    ).resolves.toBeUndefined()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${gatewayBase}/metadata-sets/5/fields/dia_diem`)
    expect(init.method).toBe("DELETE")
    expect(init.body).toBeUndefined()
  })

  it("still binds a set to the session through the archival backend", async () => {
    const api = await import("./metadataApi")
    await api.updateSessionMetadataSelection("session 1", "set", 5)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("/api/sessions/session%201/metadata-selection")
    expect(init.method).toBe("PATCH")
    expect(JSON.parse(init.body)).toEqual({
      metadata_source: "set",
      metadata_set_id: 5,
    })
  })

  it("retains the backend adapter when no direct base is configured", async () => {
    vi.stubEnv("VITE_CHINHLY_METADATA_API_BASE_URL", "")
    const api = await import("./metadataApi")
    await api.listMetadataSets()
    await api.mutateMetadata("metadata-fields", "POST", { key: "dia_diem" })
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/admin/metadata-sets",
      "/api/admin/metadata-fields",
    ])
  })

  it.each(["error", "detail"])(
    "preserves the Gateway's %s error without retrying",
    async (key) => {
      fetchMock.mockResolvedValue(
        new Response(
          JSON.stringify({
            [key]: { code: "FIELD_EXISTS", message: "Trường đã tồn tại." },
          }),
          { status: 409 }
        )
      )
      const api = await import("./metadataApi")
      await expect(
        api.mutateMetadata("metadata-fields", "POST", { key: "x" })
      ).rejects.toMatchObject({
        status: 409,
        code: "FIELD_EXISTS",
        message: "Trường đã tồn tại.",
      })
      expect(fetchMock).toHaveBeenCalledTimes(1)
    }
  )

  it("deduplicates simultaneous GETs with the same authentication", async () => {
    const api = await import("./metadataApi")
    await Promise.all([api.listMetadataSets(), api.listMetadataSets()])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("does not share a pending GET across different users", async () => {
    const api = await import("./metadataApi")
    const first = api.listMetadataSets()
    localStorage.setItem(
      "archival-processing:chinhly-auth",
      JSON.stringify({ access_token: "second-user" })
    )
    const second = api.listMetadataSets()
    await Promise.all([first, second])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("does not silently fall back when the browser cannot reach the Gateway", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"))
    const api = await import("./metadataApi")
    await expect(api.listMetadataSets()).rejects.toThrow("Failed to fetch")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
