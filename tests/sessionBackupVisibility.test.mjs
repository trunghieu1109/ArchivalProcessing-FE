import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const sessionsPageSource = await readFile(
  new URL("../src/pages/SessionsPage.tsx", import.meta.url),
  "utf8"
)
const sessionCardSource = await readFile(
  new URL("../src/pages/SessionsPage.components.tsx", import.meta.url),
  "utf8"
)

test("hides the session backup action while keeping the API module", () => {
  assert.doesNotMatch(sessionsPageSource, /collectSessionBackupUrls/)
  assert.doesNotMatch(sessionCardSource, /Backup JSON/)
})
