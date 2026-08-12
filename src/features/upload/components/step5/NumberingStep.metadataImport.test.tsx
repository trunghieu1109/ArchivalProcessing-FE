import { createRef } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type {
  MetadataBoxNumberImportResponse,
  MetadataCountConflict,
} from "@/features/upload/api/sessionApi"
import {
  MetadataCountConflictCard,
  NumberingMetadataPanel,
} from "./NumberingStep.parts"

const conflicts: MetadataCountConflict[] = [
  {
    session_dossier_id: 10,
    dossier_id: "dossier-1",
    cluster_id: "cluster-1",
    dossier_number: "HS-01",
    dossier_title: "Hồ sơ 01",
    field: "sheet_count",
    numbering_mode: "sheet",
    old_value: 4,
    new_value: 7,
    tag: "Không đồng nhất số tờ",
    row_numbers: [8, 4, 5, 6, 8, 10],
  },
  {
    session_dossier_id: 10,
    dossier_id: "dossier-1",
    cluster_id: "cluster-1",
    dossier_number: "HS-01",
    dossier_title: "Hồ sơ 01",
    field: "page_count",
    numbering_mode: "sheet",
    old_value: 8,
    new_value: 12,
    tag: "Không đồng nhất số trang",
    row_numbers: [4, 5],
  },
]

describe("metadata import review UI", () => {
  it("summarizes imported rows and counts unique dossiers requiring confirmation", () => {
    const review: MetadataBoxNumberImportResponse = {
      session_id: "session-1",
      cluster_version_id: "version-1",
      cluster_version_number: 1,
      sheet_name: "Metadata",
      header_row: 1,
      data_row_count: 12,
      imported_box_rows: 10,
      skipped_empty_box_rows: 0,
      matched_rows: 9,
      unmatched_rows: 1,
      updated_dossiers: 3,
      unchanged_dossiers: 0,
      conflict_count: 3,
      row_conflict_count: 1,
      count_conflict_count: 2,
      count_conflicts: conflicts,
    }

    render(
      <NumberingMetadataPanel
        metadataImportInputRef={createRef<HTMLInputElement>()}
        sessionId="session-1"
        active={false}
        metadataBusy={false}
        metadataExporting={false}
        metadataImporting={false}
        metadataImportReview={review}
        onExportMetadata={() => undefined}
        onImportMetadataBoxNumbers={() => undefined}
      />
    )

    expect(screen.getByRole("alert")).toHaveTextContent("Kiểm tra sau khi nhập")
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Phát hiện 1 hồ sơ có số lượng khác nhau"
    )
    expect(screen.getByRole("alert")).toHaveTextContent("12")
    expect(screen.getByRole("alert")).toHaveTextContent("Sheet: Metadata")
    expect(screen.getByRole("alert")).toHaveTextContent("2 dòng chưa xử lý")
  })

  it("shows compact Excel row ranges and wires both resolution actions", () => {
    const onKeepCurrent = vi.fn()
    const onUseImported = vi.fn()

    render(
      <MetadataCountConflictCard
        conflicts={conflicts}
        disabled={false}
        onKeepCurrent={onKeepCurrent}
        onUseImported={onUseImported}
      />
    )

    expect(screen.getByText("Dòng Excel 4–6, 8, 10")).toBeInTheDocument()
    expect(
      screen.getAllByText("Hiện tại")[0].nextElementSibling
    ).toHaveTextContent("4")
    expect(
      screen.getAllByText("Trong Excel")[0].nextElementSibling
    ).toHaveTextContent("7")

    fireEvent.click(screen.getByRole("button", { name: "Giữ số hiện tại" }))
    fireEvent.click(screen.getByRole("button", { name: "Dùng số từ Excel" }))
    expect(onKeepCurrent).toHaveBeenCalledOnce()
    expect(onUseImported).toHaveBeenCalledOnce()
  })
})
