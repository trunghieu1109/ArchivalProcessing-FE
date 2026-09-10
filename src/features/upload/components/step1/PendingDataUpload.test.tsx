import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { PendingDataUploadNotice } from "./PendingDataUpload"

describe("PendingDataUploadNotice", () => {
  it("lets the user replace a folder selected before upload starts", () => {
    const onClear = vi.fn()

    render(
      <PendingDataUploadNotice
        summary={{
          kind: "folder",
          label: "Tai-lieu-2026",
          fileCount: 12,
          totalBytes: 1024,
        }}
        onClear={onClear}
      />
    )

    expect(
      screen.getByText("12 PDF · 1.0 KB · Chờ bắt đầu")
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Chọn lại" }))
    expect(onClear).toHaveBeenCalledOnce()
  })
})
