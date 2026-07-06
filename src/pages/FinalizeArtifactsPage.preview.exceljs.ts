import ExcelJS from "exceljs"
import type { BorderStyle, Cell, Worksheet } from "exceljs"

export interface StyledSpreadsheetSheet {
  name: string
  html: string
  rowCount: number
  columnCount: number
}

export interface StyledSpreadsheetPreviewData {
  sheets: StyledSpreadsheetSheet[]
}

type CellSlot =
  | { kind: "skip" }
  | { kind: "render"; rowspan: number; colspan: number }

export async function parseStyledSpreadsheetBlob(
  blob: Blob
): Promise<StyledSpreadsheetPreviewData> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await blob.arrayBuffer())

  const sheets = workbook.worksheets
    .map((worksheet) => buildStyledSheet(worksheet))
    .filter((sheet): sheet is StyledSpreadsheetSheet => sheet !== null)

  if (sheets.length === 0) {
    throw new Error("File Excel không có sheet nào để hiển thị.")
  }

  return { sheets }
}

function buildStyledSheet(worksheet: Worksheet): StyledSpreadsheetSheet | null {
  const bounds = resolveWorksheetBounds(worksheet)
  if (!bounds) return null

  const { top, left, bottom, right } = bounds
  const rowCount = bottom - top + 1
  const columnCount = right - left + 1
  const mergeGrid = buildMergeGrid(
    worksheet.model.merges ?? [],
    top,
    left,
    bottom,
    right
  )

  const colgroup = Array.from({ length: columnCount }, (_, index) => {
    const width = worksheet.getColumn(left + index).width
    const px = Math.max(42, Math.round((width ?? 8.43) * 7.5))
    return `<col style="width:${px}px" />`
  }).join("")

  const rows: string[] = []
  for (let rowNumber = top; rowNumber <= bottom; rowNumber += 1) {
    const cells: string[] = []
    const row = worksheet.getRow(rowNumber)
    const rowHeight = row.height
    const rowStyle =
      rowHeight && rowHeight > 0
        ? ` style="height:${Math.round(rowHeight * 1.33)}px"`
        : ""

    for (let columnNumber = left; columnNumber <= right; columnNumber += 1) {
      const slot = mergeGrid[rowNumber - top][columnNumber - left]
      if (slot.kind === "skip") continue

      const cell = worksheet.getCell(rowNumber, columnNumber)
      const cellMarkup = renderStyledCell(cell, slot.rowspan, slot.colspan)
      cells.push(cellMarkup)
    }

    rows.push(`<tr${rowStyle}>${cells.join("")}</tr>`)
  }

  const html = `<table class="artifact-excel-template" cellspacing="0" cellpadding="0"><colgroup>${colgroup}</colgroup><tbody>${rows.join("")}</tbody></table>`

  return {
    name: worksheet.name,
    html,
    rowCount,
    columnCount,
  }
}

function resolveWorksheetBounds(worksheet: Worksheet): {
  top: number
  left: number
  bottom: number
  right: number
} | null {
  const dimensions = worksheet.dimensions
  if (dimensions) {
    return {
      top: dimensions.top,
      left: dimensions.left,
      bottom: dimensions.bottom,
      right: dimensions.right,
    }
  }

  let top = Number.POSITIVE_INFINITY
  let left = Number.POSITIVE_INFINITY
  let bottom = 0
  let right = 0

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    row.eachCell({ includeEmpty: false }, (_cell, columnNumber) => {
      top = Math.min(top, rowNumber)
      left = Math.min(left, columnNumber)
      bottom = Math.max(bottom, rowNumber)
      right = Math.max(right, columnNumber)
    })
  })

  if (!Number.isFinite(top) || bottom <= 0 || right <= 0) return null
  return { top, left, bottom, right }
}

function buildMergeGrid(
  merges: string[],
  top: number,
  left: number,
  bottom: number,
  right: number
): CellSlot[][] {
  const rowCount = bottom - top + 1
  const columnCount = right - left + 1
  const grid: CellSlot[][] = Array.from({ length: rowCount }, () =>
    Array.from({ length: columnCount }, () => ({
      kind: "render" as const,
      rowspan: 1,
      colspan: 1,
    }))
  )

  for (const merge of merges) {
    const [startAddress, endAddress = merge] = merge.split(":")
    const start = decodeCellAddress(startAddress)
    const end = decodeCellAddress(endAddress)
    const rowspan = end.row - start.row + 1
    const colspan = end.col - start.col + 1

    for (let row = start.row; row <= end.row; row += 1) {
      for (let col = start.col; col <= end.col; col += 1) {
        const gridRow = row - top
        const gridCol = col - left
        if (
          gridRow < 0 ||
          gridCol < 0 ||
          gridRow >= rowCount ||
          gridCol >= columnCount
        ) {
          continue
        }
        if (row === start.row && col === start.col) {
          grid[gridRow][gridCol] = { kind: "render", rowspan, colspan }
        } else {
          grid[gridRow][gridCol] = { kind: "skip" }
        }
      }
    }
  }

  return grid
}

function renderStyledCell(
  cell: Cell,
  rowspan: number,
  colspan: number
): string {
  const value = formatCellValue(cell)
  const style = buildCellStyle(cell)
  const spanAttributes = [
    rowspan > 1 ? ` rowspan="${rowspan}"` : "",
    colspan > 1 ? ` colspan="${colspan}"` : "",
  ].join("")

  return `<td${spanAttributes}${style ? ` style="${style}"` : ""}>${value}</td>`
}

function buildCellStyle(cell: Cell): string {
  const rules: string[] = [
    "box-sizing:border-box",
    "padding:2px 4px",
    "overflow:hidden",
  ]

  const alignment = cell.alignment
  if (alignment?.horizontal) {
    rules.push(`text-align:${mapHorizontalAlignment(alignment.horizontal)}`)
  }
  if (alignment?.vertical) {
    rules.push(`vertical-align:${mapVerticalAlignment(alignment.vertical)}`)
  }
  if (alignment?.wrapText) {
    rules.push("white-space:pre-wrap", "word-break:break-word")
  } else {
    rules.push("white-space:pre", "word-break:keep-all")
  }
  if (alignment?.indent) {
    rules.push(`padding-left:${alignment.indent * 10}px`)
  }

  const font = cell.font
  if (font?.bold) rules.push("font-weight:700")
  if (font?.italic) rules.push("font-style:italic")
  if (font?.underline) rules.push("text-decoration:underline")
  if (font?.size) rules.push(`font-size:${font.size}pt`)
  if (font?.name) rules.push(`font-family:${escapeCssString(font.name)}`)
  const fontColor = colorToCss(font?.color)
  if (fontColor) rules.push(`color:${fontColor}`)

  const fillColor = extractFillColor(cell.fill)
  if (fillColor) rules.push(`background-color:${fillColor}`)

  const borderCss = borderToCss(cell.border)
  if (borderCss) rules.push(borderCss)

  return rules.join(";")
}

function formatCellValue(cell: Cell): string {
  if (cell.type === ExcelJS.ValueType.Null || cell.value === null) {
    return "&nbsp;"
  }

  if (cell.text) {
    return escapeHtml(cell.text)
  }

  const value = cell.value
  if (value instanceof Date) {
    return escapeHtml(
      Number.isNaN(value.getTime())
        ? ""
        : new Intl.DateTimeFormat("vi-VN").format(value)
    )
  }

  if (typeof value === "object") {
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText
        .map((item) => {
          const text = "text" in item ? String(item.text ?? "") : ""
          const styles: string[] = []
          if ("font" in item && item.font && typeof item.font === "object") {
            const richFont = item.font as ExcelJS.Font
            if (richFont.bold) styles.push("font-weight:700")
            if (richFont.italic) styles.push("font-style:italic")
            const richColor = colorToCss(richFont.color)
            if (richColor) styles.push(`color:${richColor}`)
          }
          const styleAttr =
            styles.length > 0 ? ` style="${styles.join(";")}"` : ""
          return `<span${styleAttr}>${escapeHtml(text)}</span>`
        })
        .join("")
    }
    if ("formula" in value || "sharedFormula" in value) {
      const result = "result" in value ? value.result : ""
      return escapeHtml(formatPrimitiveValue(result))
    }
    if ("text" in value) {
      return escapeHtml(String(value.text ?? ""))
    }
  }

  return escapeHtml(formatPrimitiveValue(value))
}

function formatPrimitiveValue(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? ""
      : new Intl.DateTimeFormat("vi-VN").format(value)
  }
  return String(value)
}

function borderToCss(border: Partial<ExcelJS.Borders> | undefined): string {
  if (!border) return ""
  const rules: string[] = []
  const sides = ["top", "right", "bottom", "left"] as const
  for (const side of sides) {
    const sideBorder = border[side]
    if (!sideBorder?.style) continue
    const width = mapBorderWidth(sideBorder.style)
    const lineStyle = mapBorderLineStyle(sideBorder.style)
    const color = colorToCss(sideBorder.color) ?? "#000000"
    rules.push(`border-${side}:${width} ${lineStyle} ${color}`)
  }
  return rules.join(";")
}

function mapBorderWidth(style: BorderStyle): string {
  switch (style) {
    case "medium":
    case "mediumDashed":
    case "mediumDashDot":
    case "mediumDashDotDot":
      return "2px"
    case "thick":
      return "3px"
    case "double":
      return "3px"
    default:
      return "1px"
  }
}

function mapBorderLineStyle(style: BorderStyle): string {
  switch (style) {
    case "dotted":
    case "hair":
      return "dotted"
    case "dashDot":
    case "dashDotDot":
    case "mediumDashed":
    case "mediumDashDot":
    case "mediumDashDotDot":
    case "dashed":
    case "slantDashDot":
      return "dashed"
    case "double":
      return "double"
    default:
      return "solid"
  }
}

function mapHorizontalAlignment(
  value: "left" | "center" | "right" | "fill" | "justify" | "centerContinuous" | "distributed"
): string {
  switch (value) {
    case "center":
    case "centerContinuous":
      return "center"
    case "right":
      return "right"
    case "justify":
    case "distributed":
      return "justify"
    default:
      return "left"
  }
}

function mapVerticalAlignment(
  value: "top" | "middle" | "bottom" | "distributed" | "justify"
): string {
  switch (value) {
    case "middle":
      return "middle"
    case "bottom":
      return "bottom"
    case "justify":
    case "distributed":
      return "middle"
    default:
      return "top"
  }
}

function extractFillColor(fill: ExcelJS.Fill | undefined): string | null {
  if (!fill) return null
  if (fill.type === "pattern") {
    return colorToCss(fill.fgColor) ?? colorToCss(fill.bgColor)
  }
  if (fill.type === "gradient") {
    return colorToCss(fill.stops?.[0]?.color)
  }
  return null
}

function colorToCss(
  color: Partial<ExcelJS.Color> | undefined
): string | null {
  if (!color) return null
  if (color.argb && color.argb.length >= 6) {
    const hex = color.argb.slice(-6)
    return `#${hex}`
  }
  if (color.theme !== undefined) return null
  return null
}

function decodeCellAddress(address: string): { row: number; col: number } {
  const match = /^([A-Z]+)(\d+)$/i.exec(address.trim())
  if (!match) return { row: 1, col: 1 }
  return {
    row: Number(match[2]),
    col: columnLettersToNumber(match[1].toUpperCase()),
  }
}

function columnLettersToNumber(letters: string): number {
  let col = 0
  for (const letter of letters) {
    col = col * 26 + (letter.charCodeAt(0) - 64)
  }
  return col
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function escapeCssString(value: string): string {
  return value.replaceAll('"', '\\"')
}