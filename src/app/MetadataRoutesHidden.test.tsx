import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import { App } from "./App"

vi.mock("@/features/auth/lib/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: true, user: { role: "admin" } }),
}))
vi.mock("@/pages/SessionsPage", () => ({
  SessionsPage: () => <p>Existing sessions</p>,
}))
vi.mock("@/pages/MetadataAdminPage", () => ({
  MetadataAdminPage: () => <p>Dynamic metadata</p>,
}))
vi.mock("@/pages/AdminAccessPage", () => ({
  AdminAccessPage: () => <p>Existing admin</p>,
}))
vi.mock("@/pages/PredefinedDocumentsPage", () => ({
  PredefinedDocumentsPage: () => null,
}))
vi.mock("@/pages/FinalizeArtifactsPage", () => ({
  FinalizeArtifactsPage: () => null,
}))
vi.mock("@/pages/LoginPage", () => ({ LoginPage: () => null }))
vi.mock("@/pages/MergeFondsPage", () => ({ MergeFondsPage: () => null }))
vi.mock("@/pages/UploadPage", () => ({ UploadPage: () => null }))
vi.mock("@/pages/BackendAuditPage", () => ({ BackendAuditPage: () => null }))

describe("routes with dynamic metadata disabled", () => {
  it("redirects an old metadata bookmark to the existing session list", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/metadata"]}>
        <App />
      </MemoryRouter>
    )
    expect(await screen.findByText("Existing sessions")).toBeInTheDocument()
    expect(screen.queryByText("Dynamic metadata")).not.toBeInTheDocument()
  })

  it("keeps the existing admin route available", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/access"]}>
        <App />
      </MemoryRouter>
    )
    expect(await screen.findByText("Existing admin")).toBeInTheDocument()
  })
})
