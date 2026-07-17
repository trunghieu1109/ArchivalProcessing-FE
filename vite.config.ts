import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv, normalizePath } from "vite"
import { viteStaticCopy } from "vite-plugin-static-copy"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_")
  const apiProxyTarget =
    process.env.VITE_ARCHIVAL_DEV_API_PROXY_TARGET ||
    env.VITE_ARCHIVAL_DEV_API_PROXY_TARGET ||
    "http://127.0.0.1:8000"
  const hmrClientPort = parsePositiveInt(
    process.env.VITE_ARCHIVAL_DEV_HMR_CLIENT_PORT ||
      env.VITE_ARCHIVAL_DEV_HMR_CLIENT_PORT
  )

  return {
    plugins: [
      react(),
      tailwindcss(),
      viteStaticCopy({
        targets: [
          {
            src: normalizePath("node_modules/pdfjs-dist/build/pdf.worker.mjs"),
            dest: "pdfjs",
            rename: { stripBase: true, name: "pdf.worker.js" },
          },
          {
            src: normalizePath("node_modules/pdfjs-dist/wasm/*"),
            dest: "pdfjs/wasm",
            rename: { stripBase: true },
          },
          {
            src: normalizePath("node_modules/pdfjs-dist/cmaps/*"),
            dest: "pdfjs/cmaps",
            rename: { stripBase: true },
          },
          {
            src: normalizePath("node_modules/pdfjs-dist/standard_fonts/*"),
            dest: "pdfjs/standard_fonts",
            rename: { stripBase: true },
          },
        ],
      }),
    ],
    server: {
      hmr: hmrClientPort ? { clientPort: hmrClientPort } : undefined,
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
          timeout: 0,
          proxyTimeout: 0,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  }
})

function parsePositiveInt(value: string | undefined): number | undefined {
  const parsed = Number.parseInt(String(value ?? ""), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}
