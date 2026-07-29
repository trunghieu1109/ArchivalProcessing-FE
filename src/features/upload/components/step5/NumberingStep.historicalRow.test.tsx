import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { NumberingDocumentStatus } from "@/features/upload/api/sessionApi"
import { NumberingDocumentRow } from "./NumberingStep.parts"

describe("NumberingDocumentRow historical lifecycle", () => {
  it("shows an unversioned deleted document as a non-interactive row", () => {
    const document = {
      session_document_id: 83,
      document_id: "document-83",
      file_name: "083.pdf",
      data_path: "session/083.pdf",
      cluster_id: "historical",
      dossier_id: "__inactive_documents__",
      dossier_title: "Tài liệu đã xóa/chuyển",
      position_index: 83,
      status: "historical",
      mode: "page",
      document_number_start: 0,
      document_number_end: 0,
      entry_count: 0,
      source_page_count: 1,
      output_page_count: 1,
      blank_pages: [],
      numbering_entries: [],
      numbering_versions: [],
      selected_numbering_version_id: null,
      historical_only: true,
      lifecycle_status: "deleted",
    } satisfies NumberingDocumentStatus

    render(
      <NumberingDocumentRow
        document={document}
        updateMode="cascade"
        previewing={false}
        onPreview={vi.fn()}
        onUpdateFromPage={vi.fn()}
        onRetry={vi.fn()}
        updating={false}
        retrying={false}
        retryable={false}
        stalled={false}
        disabled
      />
    )

    expect(screen.getByText("083.pdf")).toBeInTheDocument()
    expect(screen.getByText("Đã xóa")).toBeInTheDocument()
    expect(
      screen.getByText("Chưa có phiên bản đánh số trước khi xóa/chuyển")
    ).toBeInTheDocument()
    expect(screen.getByText("Chỉ đọc")).toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  })
})
