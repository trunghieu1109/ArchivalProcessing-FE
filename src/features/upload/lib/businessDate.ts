export const BUSINESS_DATE_PLACEHOLDER = "MM/DD/YYYY, MM/YYYY hoặc YYYY"

export interface BusinessDateParts {
  year: number
  month: number
  day: number
}

export function parseBusinessDate(
  value: unknown
): BusinessDateParts | null {
  const text = String(value ?? "").trim()
  if (!text) return null

  let match = text.match(/^(\d{4})$/)
  if (match) return validParts(Number(match[1]), 0, 0)

  match = text.match(/^(\d{1,2})\/(\d{4})$/)
  if (match) return validParts(Number(match[2]), Number(match[1]), 0)

  match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (match) {
    return validParts(Number(match[3]), Number(match[1]), Number(match[2]))
  }

  // Transitional support for values produced before the canonical format change.
  match = text.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/)
  if (match) {
    return validParts(
      Number(match[1]),
      Number(match[2]),
      Number(match[3] ?? 0)
    )
  }
  return null
}

export function normalizeBusinessDate(value: unknown): string {
  const text = String(value ?? "").trim()
  if (!text) return ""
  const parsed = parseBusinessDate(text)
  if (!parsed) {
    throw new Error(`Ngày phải theo định dạng ${BUSINESS_DATE_PLACEHOLDER}.`)
  }
  if (!parsed.month) return String(parsed.year).padStart(4, "0")
  if (!parsed.day) {
    return `${pad2(parsed.month)}/${String(parsed.year).padStart(4, "0")}`
  }
  return `${pad2(parsed.month)}/${pad2(parsed.day)}/${String(parsed.year).padStart(4, "0")}`
}

export function isValidBusinessDate(value: unknown): boolean {
  const text = String(value ?? "").trim()
  return !text || parseBusinessDate(text) !== null
}

export function businessDateError(value: unknown): string | null {
  return isValidBusinessDate(value)
    ? null
    : `Dùng định dạng ${BUSINESS_DATE_PLACEHOLDER}.`
}

function validParts(
  year: number,
  month: number,
  day: number
): BusinessDateParts | null {
  if (!Number.isInteger(year) || year < 1 || year > 9999) return null
  if (!month) return day === 0 ? { year, month: 0, day: 0 } : null
  if (!Number.isInteger(month) || month < 1 || month > 12) return null
  if (!day) return { year, month, day: 0 }
  const daysInMonth = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][month - 1]
  if (!Number.isInteger(day) || day < 1 || day > daysInMonth) return null
  return { year, month, day }
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

function pad2(value: number): string {
  return String(value).padStart(2, "0")
}
