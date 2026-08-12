import { describe, expect, it } from "vitest"

import { responseTextErrorMessage } from "./sessionApi.http"

describe("responseTextErrorMessage", () => {
  it("uses the natural message from a structured metadata validation error", () => {
    const message = responseTextErrorMessage(
      400,
      JSON.stringify({
        detail: {
          code: "inconsistent_dossier_metadata",
          message:
            "Không thể nhập file metadata.\nCác dòng 2–4 không thống nhất.",
          conflicts: [{ dossier_id: "dossier-1" }],
        },
      })
    )

    expect(message).toBe(
      "Không thể nhập file metadata.\nCác dòng 2–4 không thống nhất."
    )
  })

  it("joins FastAPI validation messages and avoids exposing raw JSON", () => {
    const message = responseTextErrorMessage(
      422,
      JSON.stringify({
        detail: [
          { msg: "Thiếu file metadata" },
          { message: "Sai cấu trúc cột" },
        ],
      })
    )

    expect(message).toBe("Thiếu file metadata\nSai cấu trúc cột")
  })

  it("uses a readable fallback for structured details without a message", () => {
    const message = responseTextErrorMessage(
      400,
      JSON.stringify({ detail: { conflicts: [{ row_numbers: [2, 3] }] } })
    )

    expect(message).toBe(
      "Yêu cầu không thể xử lý (lỗi 400). Vui lòng kiểm tra dữ liệu và thử lại."
    )
    expect(message).not.toContain("row_numbers")
  })
})
