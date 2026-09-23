import { describe, expect, it } from "vitest"

import { rewritePreviewUrl } from "./previewUrl"

const browserUrl = "http://42.1.75.16:8080/upload"
const localRewriteOptions = {
  backendBaseUrl: "/api",
  browserUrl,
  enabled: true,
}

describe("rewritePreviewUrl", () => {
  it("keeps the backend URL unchanged when local rewriting is disabled", () => {
    const url =
      "https://backend.example.com/preview-proxy/api/v1/storage/document.pdf"

    expect(
      rewritePreviewUrl(url, {
        backendBaseUrl: "/api",
        browserUrl,
        enabled: false,
      })
    ).toBe(url)
  })

  it("routes the observed Chinhly URL shape through the backend", () => {
    expect(
      rewritePreviewUrl(
        "http://chinhly-api-gateway:8088/api/files/document.pdf?X-Amz-Signature=abc#page=2",
        localRewriteOptions
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
        enabled: true,
      })
    ).toBe("https://backend.example.com:8443/api/preview-proxy/api/file.pdf")
  })

  it("preserves signed query ordering and escaping", () => {
    const url =
      "http://chinhly-api-gateway:8088/api/files/a%2Fb.pdf?X-Amz-Credential=a%2Fb&X-Amz-Signature=abc%2B123"

    expect(rewritePreviewUrl(url, localRewriteOptions)).toBe(
      "http://42.1.75.16:8080/api/preview-proxy/api/files/a%2Fb.pdf?X-Amz-Credential=a%2Fb&X-Amz-Signature=abc%2B123"
    )
  })

  it("does not duplicate a preview-proxy path returned by the backend", () => {
    const url =
      "http://nginx/preview-proxy/api/v1/storage/document.pdf?X-Amz-Signature=abc"

    expect(rewritePreviewUrl(url, localRewriteOptions)).toBe(
      "http://42.1.75.16:8080/api/preview-proxy/api/v1/storage/document.pdf?X-Amz-Signature=abc"
    )
  })

  it("keeps a URL already using the backend host unchanged", () => {
    const url = "http://42.1.75.16:8080/api/preview-proxy/api/file.pdf"

    expect(rewritePreviewUrl(url, localRewriteOptions)).toBe(url)
  })

  it("keeps relative, non-HTTP, and invalid URLs unchanged", () => {
    for (const url of [
      "/api/documents/1/download",
      "data:application/pdf;base64,AAAA",
      "http://[invalid",
    ]) {
      expect(rewritePreviewUrl(url, localRewriteOptions)).toBe(url)
    }
  })
})
