import { afterEach, describe, expect, it, vi } from "vitest"

import { createClientId } from "./clientId"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("createClientId", () => {
  it("uses crypto.randomUUID when the browser provides it", () => {
    const randomUUID = vi.fn(() => "native-uuid")
    vi.stubGlobal("crypto", { randomUUID })

    expect(createClientId()).toBe("native-uuid")
    expect(randomUUID).toHaveBeenCalledOnce()
  })

  it("creates an RFC 4122 v4 UUID when randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(0xab)
        return bytes
      },
    })

    expect(createClientId()).toBe("abababab-abab-4bab-abab-abababababab")
  })

  it("still creates a UUID when the Web Crypto object is unavailable", () => {
    vi.stubGlobal("crypto", undefined)

    expect(createClientId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
  })
})
