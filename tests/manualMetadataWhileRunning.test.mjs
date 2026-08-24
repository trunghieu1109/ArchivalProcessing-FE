import assert from "node:assert/strict"
import test from "node:test"

import { canSubmitMetadataReview } from "../src/features/upload/components/step3/manualMetadata.ts"

test("cho phép lưu metadata thủ công khi job OCR đang pending hoặc running", () => {
  assert.equal(
    canSubmitMetadataReview({
      metadataReady: false,
      metadataPending: true,
      metadataFailed: false,
      metadata: { document_summary: "Nhập thủ công" },
    }),
    true
  )
})

test("không cho xác nhận tài liệu đang chạy nếu chưa nhập metadata", () => {
  assert.equal(
    canSubmitMetadataReview({
      metadataReady: false,
      metadataPending: true,
      metadataFailed: false,
    }),
    false
  )
})

test("giữ hỗ trợ nhập thủ công cho tài liệu OCR thất bại", () => {
  assert.equal(
    canSubmitMetadataReview({
      metadataReady: false,
      metadataPending: false,
      metadataFailed: true,
      metadata: { document_type: "Quyết định" },
    }),
    true
  )
})

test("vẫn cho xác nhận metadata đã sẵn sàng mà không cần bản vá", () => {
  assert.equal(
    canSubmitMetadataReview({
      metadataReady: true,
      metadataPending: false,
      metadataFailed: false,
    }),
    true
  )
})
