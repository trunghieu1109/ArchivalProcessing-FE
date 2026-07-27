import assert from "node:assert/strict"
import test from "node:test"

import {
  canNavigateDirectlyToMetadata,
  planWorkflowActionLabel,
} from "../src/pages/UploadPage.workflowPolicy.ts"

test("ưu tiên xem phương án khi đã có phương án sẵn sàng", () => {
  assert.equal(
    planWorkflowActionLabel({
      hasPlanReady: true,
      hasArrangementPlan: true,
      hasRetentionSchedule: true,
    }),
    "Xem phương án phân loại"
  )
})

test("hiển thị hành động phân tích cả PAPL và THBQ", () => {
  assert.equal(
    planWorkflowActionLabel({
      hasPlanReady: false,
      hasArrangementPlan: true,
      hasRetentionSchedule: true,
    }),
    "Phân tích phương án và thời hạn"
  )
})

test("hiển thị hành động phân tích PAPL khi chỉ có PAPL", () => {
  assert.equal(
    planWorkflowActionLabel({
      hasPlanReady: false,
      hasArrangementPlan: true,
      hasRetentionSchedule: false,
    }),
    "Phân tích phương án phân loại"
  )
})

test("hiển thị hành động phân tích THBQ khi chỉ có THBQ", () => {
  assert.equal(
    planWorkflowActionLabel({
      hasPlanReady: false,
      hasArrangementPlan: false,
      hasRetentionSchedule: true,
    }),
    "Phân tích thời hạn bảo quản"
  )
})

test("chỉ chuyển thẳng sang metadata khi không có PAPL và THBQ", () => {
  assert.equal(canNavigateDirectlyToMetadata(false, false), true)
  assert.equal(canNavigateDirectlyToMetadata(true, false), false)
  assert.equal(canNavigateDirectlyToMetadata(false, true), false)
  assert.equal(
    planWorkflowActionLabel({
      hasPlanReady: false,
      hasArrangementPlan: false,
      hasRetentionSchedule: false,
    }),
    "Chuyển sang Extract Metadata"
  )
})
