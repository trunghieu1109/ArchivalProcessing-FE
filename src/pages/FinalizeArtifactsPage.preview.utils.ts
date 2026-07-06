import * as XLSX from "xlsx"

export type ArtifactPreviewKind =
  | "metadata-spreadsheet"
  | "template-spreadsheet"
  | "template-docx"
  | "html"

export const ARTIFACT_PREVIEW_ZOOM_LEVELS = [0.75, 1, 1.25, 1.5, 2] as const
export type ArtifactPreviewZoom = (typeof ARTIFACT_PREVIEW_ZOOM_LEVELS)[number]

export interface SpreadsheetSheet {
  name: string
  rows: string[][]
  columnCount: number
  rowCount: number
}

export interface SpreadsheetPreviewData {
  sheets: SpreadsheetSheet[]
}

export function artifactPreviewKind(fileName: string): ArtifactPreviewKind | null {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? ""
  if (extension === "docx") return "template-docx"
  if (extension === "xlsx" || extension === "xls" || extension === "csv") {
    return "metadata-spreadsheet"
  }
  return null
}

export function artifactPreviewKindLabel(kind: ArtifactPreviewKind): string {
  const labels: Record<ArtifactPreviewKind, string> = {
    "metadata-spreadsheet": "Excel",
    "template-spreadsheet": "Excel",
    "template-docx": "Word",
    html: "Tài liệu",
  }
  return labels[kind]
}

export async function parseSpreadsheetBlob(
  blob: Blob
): Promise<SpreadsheetPreviewData> {
  const arrayBuffer = await blob.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, {
    type: "array",
    cellDates: true,
    dense: true,
  })

  const sheets = workbook.SheetNames.map((name) => {
    const worksheet = workbook.Sheets[name]
    const rawRows = XLSX.utils.sheet_to_json<
      (string | number | boolean | Date | null | undefined)[]
    >(worksheet, {
      header: 1,
      defval: "",
      raw: false,
    })
    const rows = normalizeSpreadsheetRows(rawRows)
    return {
      name,
      rows,
      columnCount: rows.reduce((max, row) => Math.max(max, row.length), 0),
      rowCount: rows.length,
    }
  })

  return { sheets: sheets.filter((sheet) => sheet.rowCount > 0) }
}

function normalizeSpreadsheetRows(
  rawRows: (string | number | boolean | Date | null | undefined)[][]
): string[][] {
  const rows = rawRows.map((row) =>
    row.map((cell) => formatSpreadsheetCell(cell))
  )
  trimTrailingEmptyRows(rows)
  trimTrailingEmptyColumns(rows)
  return rows.length > 0 ? rows : [[""]]
}

function formatSpreadsheetCell(
  value: string | number | boolean | Date | null | undefined
): string {
  if (value === null || value === undefined) return ""
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? ""
      : new Intl.DateTimeFormat("vi-VN").format(value)
  }
  return String(value).trim()
}

function trimTrailingEmptyRows(rows: string[][]): void {
  while (rows.length > 0 && rows[rows.length - 1].every((cell) => !cell)) {
    rows.pop()
  }
}

function trimTrailingEmptyColumns(rows: string[][]): void {
  let lastMeaningfulColumn = -1
  rows.forEach((row) => {
    for (let index = row.length - 1; index >= 0; index -= 1) {
      if (row[index]) {
        lastMeaningfulColumn = Math.max(lastMeaningfulColumn, index)
        break
      }
    }
  })
  const columnCount = lastMeaningfulColumn + 1
  if (columnCount <= 0) return
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    rows[rowIndex] = rows[rowIndex].slice(0, columnCount)
  }
}

export function columnIndexLabel(index: number): string {
  let label = ""
  let current = index
  do {
    label = String.fromCharCode(65 + (current % 26)) + label
    current = Math.floor(current / 26) - 1
  } while (current >= 0)
  return label
}

export function wrapTemplateDocxPreviewHtml(html: string, title: string): string {
  const trimmed = html.trim()
  if (!trimmed) return ""
  if (/<!doctype html>|<html[\s>]/i.test(trimmed)) return trimmed

  return `<!DOCTYPE html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        background: #e8edf3;
        color: #111827;
      }
      body {
        padding: 1.5rem 1rem 2rem;
        text-align: left;
      }
      .docx-template-shell {
        margin: 0 auto;
        width: fit-content;
        max-width: 100%;
      }
      .docx-template-shell table {
        border-collapse: collapse;
      }
      .docx-template-shell td,
      .docx-template-shell th {
        vertical-align: top;
      }
    </style>
  </head>
  <body>
    <div class="docx-template-shell">
      ${trimmed}
    </div>
  </body>
</html>`
}

export function wrapArtifactHtmlPreview(html: string, title: string): string {
  const trimmed = html.trim()
  if (!trimmed) return ""
  if (/<!doctype html>|<html[\s>]/i.test(trimmed)) return trimmed

  return `<!DOCTYPE html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        background: #f1f5f9;
        color: #0f172a;
        font-family: "Segoe UI", "Inter", system-ui, sans-serif;
        line-height: 1.5;
      }
      body { padding: 1.25rem; }
      .artifact-preview-sheet {
        overflow: auto;
        border: 1px solid #dbe3ee;
        border-radius: 12px;
        background: #fff;
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
      }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td {
        border: 1px solid #e2e8f0;
        padding: 0.5rem 0.625rem;
        text-align: left;
        vertical-align: top;
      }
      th {
        position: sticky;
        top: 0;
        z-index: 1;
        background: #f8fafc;
        color: #334155;
        font-weight: 600;
      }
    </style>
  </head>
  <body>
    <div class="artifact-preview-sheet">${trimmed}</div>
  </body>
</html>`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}