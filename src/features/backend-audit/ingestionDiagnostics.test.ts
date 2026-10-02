import { describe, expect, it } from "vitest"

import { diagnoseIngestionRun } from "./ingestionDiagnostics"

describe("diagnoseIngestionRun", () => {
  it("marks a failed extract as critical and preserves the backend error", () => {
    const diagnostic = diagnoseIngestionRun(
      {
        id: 7,
        status: "extract_failed",
        error: "Remote worker ran out of memory",
        updated_at: "2026-10-02T03:00:00Z",
      },
      [],
      Date.parse("2026-10-02T03:01:00Z")
    )

    expect(diagnostic.severity).toBe("critical")
    expect(diagnostic.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "extract_failed",
          detail: "Remote worker ran out of memory",
        }),
      ])
    )
  })

  it("detects stalled runs and count mismatches", () => {
    const diagnostic = diagnoseIngestionRun(
      {
        id: 8,
        status: "extracting",
        remote_ingestion_batch_id: "remote-1",
        remote_extract_job_id: "job-1",
        total_pdf_files: 10,
        extracted_count: 3,
        last_polled_at: "2026-10-02T02:00:00Z",
      },
      [],
      Date.parse("2026-10-02T03:00:00Z")
    )

    expect(diagnostic.severity).toBe("critical")
    expect(
      diagnostic.findings.some((item) => item.code === "stale_activity")
    ).toBe(true)
    expect(diagnostic.progressPercent).toBe(30)
  })

  it("surfaces OCR discovery and metadata inconsistencies", () => {
    const diagnostic = diagnoseIngestionRun(
      {
        id: 9,
        status: "ready",
        total_pdf_files: 2,
        extracted_count: 2,
        ocr_batch_ids: [31],
      },
      [
        {
          id: 31,
          ingestion_run_id: 9,
          status: "done",
          remote_discovery_complete: false,
          metadata_extraction_status: "running",
        },
      ]
    )

    expect(diagnostic.severity).toBe("warning")
    expect(diagnostic.findings.map((item) => item.code)).toEqual(
      expect.arrayContaining(["batch_31_discovery", "batch_31_metadata"])
    )
  })

  it("keeps a complete run healthy", () => {
    const diagnostic = diagnoseIngestionRun(
      {
        id: 10,
        status: "ready",
        total_pdf_files: 2,
        extracted_count: 2,
        ocr_batch_ids: [32],
      },
      [
        {
          id: 32,
          ingestion_run_id: 10,
          status: "done",
          remote_discovery_complete: true,
          metadata_extraction_status: "ready",
        },
      ]
    )

    expect(diagnostic.severity).toBe("healthy")
    expect(diagnostic.findings).toEqual([])
    expect(diagnostic.progressPercent).toBe(100)
  })

  it("flags a remote-source run that lost its remote batch reference", () => {
    const diagnostic = diagnoseIngestionRun(
      {
        id: 11,
        status: "ready",
        ingestion_source: "remote",
        total_pdf_files: 1,
        extracted_count: 1,
        ocr_batch_ids: [33],
      },
      [
        {
          id: 33,
          ingestion_run_id: 11,
          status: "done",
          remote_discovery_complete: true,
          metadata_extraction_status: "ready",
        },
      ]
    )

    expect(diagnostic.severity).toBe("critical")
    expect(diagnostic.findings.map((item) => item.code)).toContain(
      "missing_remote_batch"
    )
  })
})
