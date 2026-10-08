import { useState } from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { UploadSessionSetupPanel } from "./UploadSessionSetupPanel"
import type { SessionMetadataValues } from "../SessionMetadataBar"
import { createUploadPageActions } from "@/pages/UploadPage.actions"
import { uploadPageCache as cache } from "@/pages/UploadPage.cache"
import { LAST_SESSION_KEY } from "@/pages/UploadPage.progress"

const baseProps = {
  existingSessionMode: false,
  allProcessing: false,
  sessionLoading: false,
  uploadMode: "append" as const,
  syncUploadMode: vi.fn(),
  uploadPurpose: "session_data" as const,
}

function CreationForm() {
  const [metadata, setMetadata] = useState<SessionMetadataValues>({
    processType: "arrangement",
  })
  return (
    <>
      <UploadSessionSetupPanel
        {...baseProps}
        sessionMetadata={metadata}
        syncSessionMetadataDraft={setMetadata}
      />
      <button
        onClick={() => {
          cache.sessionId = null
          cache.sessionMetadata = metadata
          const actions = createUploadPageActions({
            setSessionId: vi.fn(),
            syncSessionMetadata: vi.fn(),
          })
          void actions.ensureSession()
        }}
      >
        Create
      </button>
    </>
  )
}

describe("session process type at creation", () => {
  it("offers two types and preserves the choice while editing fonds metadata", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          session_id: "created",
          processType: "arrangement_digitization",
          status: "created",
        }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      )
    )
    vi.stubGlobal("fetch", fetchMock)
    const originalLastSession = window.localStorage.getItem(LAST_SESSION_KEY)
    const originalSessionId = cache.sessionId
    const originalMetadata = cache.sessionMetadata
    const originalClusterVersion = cache.activeClusterVersionId
    try {
      render(<CreationForm />)
      expect(screen.getAllByRole("radio")).toHaveLength(2)
      expect(screen.getByRole("radio", { name: /^Chỉnh lý$/ })).toBeChecked()
      fireEvent.click(
        screen.getByRole("radio", { name: /^Chỉnh lý \+ số hóa/ })
      )
      fireEvent.change(screen.getByRole("textbox", { name: "Tên phông" }), {
        target: { value: "Phông thử nghiệm" },
      })
      expect(
        screen.getByRole("radio", { name: /^Chỉnh lý \+ số hóa/ })
      ).toBeChecked()
      fireEvent.click(screen.getByRole("button", { name: "Create" }))
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const payload = JSON.parse(fetchMock.mock.calls[0][1]?.body as string)
      expect(payload).toMatchObject({
        processType: "arrangement_digitization",
        fonds_name: "Phông thử nghiệm",
      })
      await waitFor(() => expect(cache.sessionId).toBe("created"))
    } finally {
      if (originalLastSession === null)
        window.localStorage.removeItem(LAST_SESSION_KEY)
      else window.localStorage.setItem(LAST_SESSION_KEY, originalLastSession)
      cache.sessionId = originalSessionId
      cache.sessionMetadata = originalMetadata
      cache.activeClusterVersionId = originalClusterVersion
      vi.unstubAllGlobals()
    }
  })

  it("shows an API-created digitization session without offering another type", () => {
    render(
      <UploadSessionSetupPanel
        {...baseProps}
        existingSessionMode
        sessionId="digitization-session"
        sessionMetadata={{ processType: "digitization" }}
      />
    )
    expect(screen.queryAllByRole("radio")).toHaveLength(0)
    expect(screen.getByText("Số hóa")).toBeInTheDocument()
  })

  it("disables the selector after the session has been created", () => {
    render(
      <UploadSessionSetupPanel
        {...baseProps}
        sessionId="created-session"
        sessionMetadata={{ processType: "arrangement_digitization" }}
      />
    )
    for (const radio of screen.getAllByRole("radio"))
      expect(radio).toBeDisabled()
  })
})
