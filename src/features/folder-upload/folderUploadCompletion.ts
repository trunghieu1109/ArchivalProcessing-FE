import type { FolderUploadManager } from "./FolderUploadManager"
import type { FolderUploadSummary } from "./types"

const FAILED_FOLDER_UPLOAD_STATUSES = new Set([
  "attention_required",
  "cancelled",
])

export function waitForFolderUploadCompletion(
  manager: FolderUploadManager,
  jobId: string
): Promise<FolderUploadSummary> {
  return new Promise((resolve, reject) => {
    let settled = false
    let unsubscribe: () => void = () => undefined

    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      unsubscribe()
      callback()
    }

    const inspect = () => {
      const job = manager
        .getSnapshot()
        .find((candidate) => candidate.id === jobId)
      if (!job) {
        finish(() =>
          reject(new Error("Không tìm thấy tiến trình upload folder."))
        )
        return
      }
      if (job.status === "completed" && job.summary) {
        finish(() => resolve(job.summary as FolderUploadSummary))
        return
      }
      if (FAILED_FOLDER_UPLOAD_STATUSES.has(job.status)) {
        finish(() =>
          reject(
            new Error(
              job.error ||
                "Upload folder chưa hoàn tất nên chưa thể tiếp tục xử lý."
            )
          )
        )
      }
    }

    unsubscribe = manager.subscribe(inspect)
    inspect()
  })
}
