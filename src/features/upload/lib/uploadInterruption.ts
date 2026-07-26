import type {
  FolderUploadSummary,
  SessionInputUploadResponse,
} from "@/features/upload/api/sessionApi"

export interface UploadInterruptionSnapshot {
  kind: "zip" | "folder"
  attemptKey: string
  fileName: string
  message: string
  status: "cancelled" | "interrupted"
  expectedFileCount: number | null
  recordedFileCount: number
  effectiveFileCount: number
  confirmedFileCount: number
  skippedFileCount: number
  failedFileCount: number
  cancelledFileCount: number
  unfinishedFileCount: number
}

interface ResolveUploadInterruptionOptions {
  hasLiveZipAttempt?: boolean
  hasLiveFolderAttempt?: boolean
}

export function resolveLatestUploadInterruption(
  zipAttempt: SessionInputUploadResponse | null | undefined,
  folderAttempt: FolderUploadSummary | null | undefined,
  {
    hasLiveZipAttempt = false,
    hasLiveFolderAttempt = false,
  }: ResolveUploadInterruptionOptions = {}
): UploadInterruptionSnapshot | null {
  const zipTime = uploadAttemptTime(
    zipAttempt?.created_at,
    zipAttempt?.updated_at
  )
  const folderTime = uploadAttemptTime(
    folderAttempt?.created_at,
    folderAttempt?.updated_at
  )

  if (folderAttempt && folderTime >= zipTime) {
    if (
      (hasLiveFolderAttempt && folderAttempt.status !== "cancelled") ||
      folderAttempt.status === "sealed"
    ) {
      return null
    }
    if (
      ![
        "open",
        "uploading",
        "attention_required",
        "cancelling",
        "cancelled",
        "failed",
      ].includes(folderAttempt.status)
    ) {
      return null
    }
    const recorded =
      folderAttempt.counts.confirmed + folderAttempt.counts.skipped
    const cancelled = folderAttempt.counts.cancelled
    const unfinished = folderAttempt.counts.unfinished
    const isCancelled = folderAttempt.status === "cancelled"
    return {
      kind: "folder",
      attemptKey: `folder:${folderAttempt.folder_upload_id}`,
      fileName: folderAttempt.root_name,
      status: isCancelled ? "cancelled" : "interrupted",
      message: isCancelled
        ? recorded > 0
          ? `Lần upload folder mới nhất đã bị hủy; ${recorded}/${folderAttempt.expected_file_count} file đã được ghi nhận, trong đó ${folderAttempt.counts.effective} tài liệu có thể tiếp tục xử lý.`
          : "Lần upload folder mới nhất đã bị hủy và không có tài liệu hoàn tất."
        : recorded > 0
          ? `Lần upload folder mới nhất bị gián đoạn; hệ thống đang đóng phần còn lại. ${recorded}/${folderAttempt.expected_file_count} file đã được ghi nhận.`
          : "Lần upload folder mới nhất bị gián đoạn; hệ thống đang đóng attempt và trình duyệt không khôi phục binary sau khi tải lại trang.",
      expectedFileCount: folderAttempt.expected_file_count,
      recordedFileCount: recorded,
      effectiveFileCount: folderAttempt.counts.effective,
      confirmedFileCount: folderAttempt.counts.confirmed,
      skippedFileCount: folderAttempt.counts.skipped,
      failedFileCount: folderAttempt.counts.failed,
      cancelledFileCount: cancelled,
      unfinishedFileCount: unfinished,
    }
  }

  const zipStatus = String(zipAttempt?.upload_status ?? "").toLowerCase()
  if (
    !zipAttempt ||
    !zipStatus ||
    ["completed", "completing"].includes(zipStatus) ||
    (hasLiveZipAttempt && zipStatus !== "cancelled")
  ) {
    return null
  }
  if (
    ![
      "creating",
      "uploading",
      "attention_required",
      "failed",
      "cancelled",
    ].includes(zipStatus)
  ) {
    return null
  }
  const isCancelled = zipStatus === "cancelled"
  return {
    kind: "zip",
    attemptKey: `zip:${
      zipAttempt.client_upload_id ?? zipAttempt.id ?? zipAttempt.file_name
    }`,
    fileName: zipAttempt.file_name,
    status: isCancelled ? "cancelled" : "interrupted",
    message: isCancelled
      ? "Lần upload ZIP mới nhất đã bị hủy. ZIP chưa complete không tạo ingestion run và không có tài liệu nào được ghi nhận."
      : "Lần upload ZIP mới nhất bị gián đoạn; hệ thống đang đóng attempt. ZIP chưa complete không thể tiếp tục sau khi tải lại trang.",
    expectedFileCount: null,
    recordedFileCount: 0,
    effectiveFileCount: 0,
    confirmedFileCount: 0,
    skippedFileCount: 0,
    failedFileCount: 0,
    cancelledFileCount: 0,
    unfinishedFileCount: 0,
  }
}

export function uploadAttemptTime(
  createdAt?: string | null,
  updatedAt?: string | null
): number {
  const value = Date.parse(createdAt || updatedAt || "")
  return Number.isFinite(value) ? value : 0
}
