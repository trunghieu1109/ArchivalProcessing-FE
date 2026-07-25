import { CircleAlert, Loader2 } from "lucide-react"
import type { FolderUploadSummary } from "@/features/folder-upload"

interface ZipInterruptionNotice {
  fileName: string
  status: string
  cancelReason: string | null
}

interface UploadInterruptionNoticeProps {
  zip?: ZipInterruptionNotice | null
  folder?: FolderUploadSummary | null
  folderRemoteStillOpen: boolean
}

export function UploadInterruptionNotice({
  zip,
  folder,
  folderRemoteStillOpen,
}: UploadInterruptionNoticeProps) {
  if (!zip && !folder) return null
  return (
    <div className="mt-4 rounded-xl border border-[#FCD34D] bg-[#FFFBEB] px-4 py-3 text-sm text-[#92400E]">
      <div className="flex items-start gap-2">
        <CircleAlert className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 space-y-3">
          {zip && (
            <div>
              <p className="font-semibold">
                Lần upload ZIP gần nhất chưa hoàn thành
              </p>
              <p className="mt-1 break-words">
                File <strong>{zip.fileName}</strong> chưa được đưa vào xử lý.
              </p>
              {zip.cancelReason && (
                <p className="mt-1 text-xs">
                  {cancelReasonLabel(zip.cancelReason)}
                </p>
              )}
            </div>
          )}
          {folder && (
            <div>
              <p className="font-semibold">
                Lần upload folder gần nhất chưa hoàn thành
              </p>
              <p className="mt-1">
                {folder.counts.confirmed} thành công · {folder.counts.skipped}{" "}
                bỏ qua · {folder.counts.failed} lỗi kỹ thuật ·{" "}
                {folder.counts.unfinished} chưa hoàn thành.
              </p>
              {folder.cancel_reason && (
                <p className="mt-1 text-xs">
                  {cancelReasonLabel(folder.cancel_reason)}
                </p>
              )}
              {(folderRemoteStillOpen ||
                ["pending", "running"].includes(
                  folder.document_sync_status
                )) && (
                <p className="mt-1 flex items-center gap-1.5 text-xs font-medium">
                  <Loader2 className="size-3.5 animate-spin" />
                  Đang đối soát kết quả cuối cùng với Chỉnh Lý…
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function cancelReasonLabel(reason: string): string {
  if (reason === "page_closed" || reason === "lease_expired") {
    return "Upload bị gián đoạn do tab đã đóng hoặc tải lại."
  }
  if (reason === "logout") return "Upload bị gián đoạn do người dùng đăng xuất."
  if (reason === "user_cancelled") return "Upload đã được người dùng hủy."
  return `Lý do: ${reason}`
}
