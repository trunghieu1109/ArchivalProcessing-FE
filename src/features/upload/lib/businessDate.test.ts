import { describe, expect, it } from "vitest"

import {
  isValidBusinessDate,
  normalizeBusinessDate,
  parseBusinessDate,
} from "./businessDate"

describe("businessDate", () => {
  it("normalizes full and partial canonical dates", () => {
    expect(normalizeBusinessDate("3/5/2026")).toBe("03/05/2026")
    expect(normalizeBusinessDate("3/2026")).toBe("03/2026")
    expect(normalizeBusinessDate("2026")).toBe("2026")
  })

  it("normalizes transitional ISO values", () => {
    expect(normalizeBusinessDate("2026-03-25")).toBe("25/03/2026")
  })

  it("rejects invalid dates and month-first input", () => {
    expect(isValidBusinessDate("29/02/2025")).toBe(false)
    expect(isValidBusinessDate("03/25/2026")).toBe(false)
    expect(() => normalizeBusinessDate("03/25/2026")).toThrow()
  })

  it("returns chronological parts", () => {
    expect(parseBusinessDate("25/03/2026")).toEqual({
      year: 2026,
      month: 3,
      day: 25,
    })
  })
})
