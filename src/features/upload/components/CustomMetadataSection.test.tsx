import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
  CustomMetadataProvider,
  CustomMetadataSection,
} from "./CustomMetadataSection"
import { OcrResultsTable } from "./OcrResultsTable"
import type { FolderStatusResponse } from "@/features/upload/api/ocrApi"

const snapshot = {
  metadata_config: {
    selected_fields: ["document_summary", "priority", "empty_custom"],
    custom_fields: ["priority", "empty_custom"],
    field_labels: { priority: "Mức ưu tiên", empty_custom: "Ghi chú bổ sung" },
    custom_field_definitions: [
      { key: "priority", options: [{ value: "HIGH", label: "Cao" }] },
    ],
  },
}

describe("custom metadata section", () => {
  it("renders separate read-only fields with snapshot labels and missing-value placeholders", () => {
    render(
      <CustomMetadataProvider snapshot={snapshot}>
        <CustomMetadataSection
          sources={[{ priority: "HIGH", document_summary: "Trích yếu" }]}
        />
      </CustomMetadataProvider>
    )
    const section = screen.getByRole("region", { name: "Metadata tùy chỉnh" })
    expect(within(section).getByText("Mức ưu tiên")).toBeInTheDocument()
    expect(within(section).getByText("Cao")).toBeInTheDocument()
    expect(within(section).getByText("Ghi chú bổ sung")).toBeInTheDocument()
    expect(within(section).getByText("Chưa có dữ liệu")).toBeInTheDocument()
    expect(within(section).queryByText("Trích yếu")).not.toBeInTheDocument()
    expect(within(section).queryByRole("textbox")).not.toBeInTheDocument()
  })

  it("does not add an empty section for documents with only main metadata", () => {
    const { container } = render(
      <CustomMetadataSection
        sources={[{ document_type: "Công văn", _warnings: {} }]}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("uses loaded raw values for partial document views without mixing documents", () => {
    render(
      <CustomMetadataProvider
        snapshot={snapshot}
        documents={[
          { document_id: "doc-1", raw_metadata: { priority: "HIGH" } },
          { document_id: "doc-2", raw_metadata: { priority: "LOW" } },
        ]}
      >
        <CustomMetadataSection
          documentId="doc-2"
          sources={[{ document_summary: "Trích yếu" }]}
        />
      </CustomMetadataProvider>
    )
    const section = screen.getByRole("region", { name: "Metadata tùy chỉnh" })
    expect(within(section).getByText("LOW")).toBeInTheDocument()
    expect(within(section).queryByText("Cao")).not.toBeInTheDocument()
  })

  it("shows raw custom metadata beside the existing OCR fields", () => {
    const status: FolderStatusResponse = {
      folder_path: "documents",
      recursive: true,
      total_files: 1,
      total_jobs: 1,
      signature_extracted_documents: 0,
      signature_pending_documents: 0,
      signature_failed_documents: 0,
      status_counts: { done: 1 },
      missing_files: [],
      jobs: [
        {
          id: 1,
          document_id: "doc-1",
          data_path: "documents/file.pdf",
          status: "done",
          review_status: "pending",
          metadata_ready: true,
          metadata_final: true,
          light_metadata: { trich_yeu_tai_lieu: "Trích yếu hiện tại" },
          raw_metadata: { priority: "HIGH" },
        },
      ],
    }
    render(
      <CustomMetadataProvider snapshot={snapshot}>
        <OcrResultsTable status={status} isPolling={false} />
      </CustomMetadataProvider>
    )
    expect(screen.getByText("Trích yếu hiện tại")).toBeInTheDocument()
    expect(
      screen.getByRole("region", { name: "Metadata tùy chỉnh" })
    ).toHaveTextContent("Mức ưu tiênCao")
  })
})
