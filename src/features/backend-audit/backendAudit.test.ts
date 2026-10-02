import { afterEach, describe, expect, it, vi } from "vitest"

import {
  AUDIT_ENDPOINTS,
  auditEndpointPath,
  buildAuditUrl,
  extractAuditSessions,
  normalizeAuditBaseUrl,
  normalizeAuditPath,
  runAuditRequest,
} from "./backendAudit"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("backend audit URL handling", () => {
  it("normalizes absolute and relative API bases", () => {
    expect(normalizeAuditBaseUrl(" https://audit.example.vn/api/ ")).toBe(
      "https://audit.example.vn/api"
    )
    expect(normalizeAuditBaseUrl("/api/")).toBe("/api")
    expect(buildAuditUrl("https://audit.example.vn/api/", "health")).toBe(
      "https://audit.example.vn/health"
    )
    expect(
      buildAuditUrl("https://audit.example.vn", "/api/sessions?limit=200")
    ).toBe("https://audit.example.vn/api/sessions?limit=200")
    expect(
      buildAuditUrl("https://audit.example.vn/api", "/api/sessions?limit=200")
    ).toBe("https://audit.example.vn/api/sessions?limit=200")
  })

  it("rejects unsafe URLs and protocol-relative endpoint paths", () => {
    expect(() => normalizeAuditBaseUrl("javascript:alert(1)")).toThrow(
      "HTTP hoặc HTTPS"
    )
    expect(() => normalizeAuditPath("//other-host/health")).toThrow("tương đối")
  })

  it("resolves session endpoints with encoded IDs", () => {
    const endpoint = AUDIT_ENDPOINTS.find(
      (item) => item.id === "session-detail"
    )!
    expect(auditEndpointPath(endpoint, "fonds/2026")).toBe(
      "/api/sessions/fonds%2F2026"
    )
  })
})

describe("backend audit requests", () => {
  it("uses bearer auth and captures JSON response metadata", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json", "X-Trace": "trace-1" },
      })
    )
    vi.stubGlobal("fetch", fetchMock)

    const result = await runAuditRequest(
      {
        baseUrl: "https://audit.example.vn/api",
        authMode: "bearer",
        credential: "secret-token",
        apiKeyHeader: "X-API-Key",
      },
      { id: "health", title: "Sức khỏe dịch vụ" },
      "/health"
    )

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ status: "ok" })
    expect(result.headers["x-trace"]).toBe("trace-1")
    const request = fetchMock.mock.calls[0]
    expect(request[0]).toBe("https://audit.example.vn/health")
    expect((request[1].headers as Headers).get("Authorization")).toBe(
      "Bearer secret-token"
    )
  })

  it("normalizes session list payloads", () => {
    expect(
      extractAuditSessions({
        sessions: [
          { session_id: "session-1", fonds_name: "Phông A" },
          { invalid: true },
        ],
      })
    ).toEqual([{ session_id: "session-1", fonds_name: "Phông A" }])
  })
})
