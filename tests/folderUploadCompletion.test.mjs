import assert from "node:assert/strict"
import test from "node:test"

import { waitForFolderUploadCompletion } from "../src/features/folder-upload/folderUploadCompletion.ts"

function fakeManager(initialJob) {
  let snapshot = [initialJob]
  const listeners = new Set()
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    update(job) {
      snapshot = [job]
      listeners.forEach((listener) => listener())
    },
  }
}

test("folder completion waits for reconciliation-ready job", async () => {
  const manager = fakeManager({
    id: "folder-1",
    status: "uploading",
    summary: null,
    error: null,
  })
  const completion = waitForFolderUploadCompletion(manager, "folder-1")
  const summary = {
    session_id: "session-1",
    folder_upload_id: "folder-1",
  }

  manager.update({
    id: "folder-1",
    status: "completed",
    summary,
    error: null,
  })

  assert.equal(await completion, summary)
})

test("folder completion rejects a failed upload", async () => {
  const manager = fakeManager({
    id: "folder-2",
    status: "uploading",
    summary: null,
    error: null,
  })
  const completion = waitForFolderUploadCompletion(manager, "folder-2")

  manager.update({
    id: "folder-2",
    status: "attention_required",
    summary: null,
    error: "folder failed",
  })

  await assert.rejects(completion, /folder failed/)
})
