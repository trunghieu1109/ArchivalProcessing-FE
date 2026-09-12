const CONFIGURED_BACKEND_BASE_URL = String(
  import.meta.env.VITE_ARCHIVAL_API_BASE_URL ?? "/api"
).trim()
const PREVIEW_PROXY_PATH = "/preview-proxy"

interface PreviewUrlRewriteOptions {
  backendBaseUrl?: string
  browserUrl?: string
}

/** Route an absolute remote preview URL through ArchivalProcessing. */
export function rewritePreviewUrl(
  url: string,
  options: PreviewUrlRewriteOptions = {}
): string {
  if (!url) return url

  const browserUrl =
    options.browserUrl ??
    (typeof window === "undefined" ? "" : window.location.href)
  if (!browserUrl) return url

  try {
    // Relative URLs already belong to this application and should not enter the
    // remote preview proxy.
    const previewUrl = new URL(url)
    if (!isHttpUrl(previewUrl)) return url

    const backendUrl = new URL(
      (options.backendBaseUrl ?? CONFIGURED_BACKEND_BASE_URL) || "/api",
      browserUrl
    )
    if (!isHttpUrl(backendUrl) || previewUrl.origin === backendUrl.origin) {
      return url
    }

    const backendBasePath = backendUrl.pathname.replace(/\/+$/, "")
    const sourcePath = previewUrl.pathname.startsWith("/")
      ? previewUrl.pathname
      : `/${previewUrl.pathname}`

    backendUrl.pathname = `${backendBasePath}${PREVIEW_PROXY_PATH}${sourcePath}`
    // The X-Amz query signs the upstream path and must be forwarded unchanged.
    backendUrl.search = previewUrl.search
    backendUrl.hash = previewUrl.hash
    return backendUrl.toString()
  } catch {
    return url
  }
}

function isHttpUrl(url: URL): boolean {
  return url.protocol === "http:" || url.protocol === "https:"
}
