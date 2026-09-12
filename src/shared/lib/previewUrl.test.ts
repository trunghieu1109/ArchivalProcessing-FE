import { describe, expect, it } from "vitest"

import { rewritePreviewUrl } from "./previewUrl"

const browserUrl = "http://42.1.75.16:8080/upload"

describe("rewritePreviewUrl", () => {
  it("routes the observed Chinhly URL shape through the backend", () => {
    expect(
      rewritePreviewUrl(
        "http://chinhly-api-gateway:8088/api/files/document.pdf?X-Amz-Signature=abc#page=2",
        { backendBaseUrl: "/api", browserUrl }
      )
    ).toBe(
      "http://42.1.75.16:8080/api/preview-proxy/api/files/document.pdf?X-Amz-Signature=abc#page=2"
    )
  })

  it("supports an absolute backend base including its path prefix", () => {
    expect(
      rewritePreviewUrl("http://chinhly-api-gateway:8088/api/file.pdf", {
        backendBaseUrl: "https://backend.example.com:8443/api",
        browserUrl,
      })
    ).toBe("https://backend.example.com:8443/api/preview-proxy/api/file.pdf")
  })

  it("preserves signed query ordering and escaping", () => {
    const url =
      "http://chinhly-api-gateway:8088/api/files/a%2Fb.pdf?X-Amz-Credential=a%2Fb&X-Amz-Signature=abc%2B123"

    expect(rewritePreviewUrl(url, { backendBaseUrl: "/api", browserUrl })).toBe(
      "http://42.1.75.16:8080/api/preview-proxy/api/files/a%2Fb.pdf?X-Amz-Credential=a%2Fb&X-Amz-Signature=abc%2B123"
    )
  })

  it("keeps a URL already using the backend host unchanged", () => {
    const url = "http://42.1.75.16:8080/api/preview-proxy/api/file.pdf"

    expect(rewritePreviewUrl(url, { backendBaseUrl: "/api", browserUrl })).toBe(
      url
    )
  })

  it("keeps relative, non-HTTP, and invalid URLs unchanged", () => {
    for (const url of [
      "/api/documents/1/download",
      "data:application/pdf;base64,AAAA",
      "http://[invalid",
    ]) {
      expect(rewritePreviewUrl(url, { browserUrl })).toBe(url)
    }
  })
})
