import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const adminAccessSource = await readFile(
  new URL("../src/pages/AdminAccessPage.tsx", import.meta.url),
  "utf8"
)
const adminApiSource = await readFile(
  new URL("../src/features/admin/api/adminDashboardApi.ts", import.meta.url),
  "utf8"
)

test("loads coordinator and worker session responsibilities", () => {
  assert.match(adminApiSource, /\/admin\/access-responsibilities/)
  assert.match(adminAccessSource, /responsibility\.coordinator_sessions/)
  assert.match(adminAccessSource, /responsibility\.worker_sessions/)
  assert.match(adminAccessSource, /Session có tài liệu đang đảm nhiệm/)
})

test("removes coordinator assignments before allowing demotion", () => {
  assert.match(
    adminAccessSource,
    /assignSessionCoordinator\(managedSession\.session_id, null\)/
  )
  assert.match(
    adminAccessSource,
    /responsibility\.coordinator_sessions\.length === 0/
  )
  assert.match(adminAccessSource, /role: "worker"/)
  assert.match(adminAccessSource, /Gỡ quyền quản lý/)
  assert.match(adminAccessSource, /Hạ quyền/)
})
