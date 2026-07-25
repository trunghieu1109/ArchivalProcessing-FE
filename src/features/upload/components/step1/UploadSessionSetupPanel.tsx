import { useState } from "react"
import { Archive } from "lucide-react"
import type { UploadMode } from "@/features/upload/api/sessionApi"
import type { SessionMetadataValues } from "@/features/upload/components/SessionMetadataBar"
import { UploadConfirmDialog } from "@/features/upload/components/UploadConfirmDialog"
import { cn } from "@/shared/lib/utils"

interface UploadSessionSetupPanelProps {
  existingSessionMode: boolean
  allProcessing: boolean
  sessionLoading: boolean
  sessionMetadata?: SessionMetadataValues
  syncSessionMetadataDraft?: (metadata: SessionMetadataValues) => void
  uploadMode: UploadMode
  syncUploadMode: (mode: UploadMode) => void
}

export function UploadSessionSetupPanel({
  existingSessionMode,
  allProcessing,
  sessionLoading,
  sessionMetadata,
  syncSessionMetadataDraft,
  uploadMode,
  syncUploadMode,
}: UploadSessionSetupPanelProps) {
  const [overwriteDialogOpen, setOverwriteDialogOpen] = useState(false)
  const controlsDisabled = allProcessing || sessionLoading

  const selectUploadMode = (mode: UploadMode) => {
    if (mode === "overwrite" && uploadMode !== "overwrite") {
      setOverwriteDialogOpen(true)
      return
    }
    syncUploadMode(mode)
  }

  return (
    <>
      <div className="rounded-2xl border border-[#D8E1EC] bg-white px-5 py-4 shadow-sm">
        <p className="text-sm font-semibold text-[#0F172A]">
          {existingSessionMode
            ? "Bổ sung dữ liệu cho session"
            : "Tạo session mới"}
        </p>
        <p className="mt-1 text-sm text-[#64748B]">
          {existingSessionMode
            ? "Bạn có thể tải thêm ZIP hoặc nguyên folder PDF; hệ thống tự chọn đúng pipeline sau khi nhận diện dữ liệu."
            : "Chọn phương án chỉnh lý, thông tư thời hạn bảo quản và kéo thả ZIP hoặc nguyên folder PDF vào Upload Center."}
        </p>
      </div>

      {!existingSessionMode && (
        <div className="rounded-2xl border border-[#D8E1EC] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#EAF1FF] text-[#0052FF]">
              <Archive className="size-5" />
            </div>
            <div>
              <p className="text-base font-bold text-[#0F172A]">
                Thông tin phông
              </p>
              <p className="mt-1 text-sm text-[#64748B]">
                Nhập thông tin nền cho session. Khi nhấn Bắt đầu xử lý, hệ thống
                sẽ tạo session mới và lưu các thông tin này tự động.
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SessionMetadataInput
              label="Tên đơn vị lưu trữ"
              value={sessionMetadata?.archive_name ?? ""}
              disabled={controlsDisabled}
              onChange={(value) =>
                updateSessionMetadataDraft(
                  sessionMetadata,
                  syncSessionMetadataDraft,
                  "archive_name",
                  value
                )
              }
            />
            <SessionMetadataInput
              label="Mã đơn vị lưu trữ"
              value={sessionMetadata?.archive_code ?? ""}
              disabled={controlsDisabled}
              onChange={(value) =>
                updateSessionMetadataDraft(
                  sessionMetadata,
                  syncSessionMetadataDraft,
                  "archive_code",
                  value
                )
              }
            />
            <SessionMetadataInput
              label="Tên phông"
              value={sessionMetadata?.fonds_name ?? ""}
              disabled={controlsDisabled}
              onChange={(value) =>
                updateSessionMetadataDraft(
                  sessionMetadata,
                  syncSessionMetadataDraft,
                  "fonds_name",
                  value
                )
              }
            />
            <SessionMetadataInput
              label="Mã đơn vị hình thành phông"
              value={sessionMetadata?.fonds_creator_code ?? ""}
              disabled={controlsDisabled}
              onChange={(value) =>
                updateSessionMetadataDraft(
                  sessionMetadata,
                  syncSessionMetadataDraft,
                  "fonds_creator_code",
                  value
                )
              }
            />
          </div>
        </div>
      )}

      {existingSessionMode && (
        <div className="rounded-2xl border border-[#D8E1EC] bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-[#0F172A]">
            Chế độ upload bổ sung
          </p>
          <p className="mt-1 text-sm text-[#64748B]">
            Append bỏ qua PDF đã có trong phông. Overwrite ghi đè file trùng và
            extract lại metadata của file đó.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(["append", "overwrite"] as UploadMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => selectUploadMode(mode)}
                disabled={controlsDisabled}
                className={cn(
                  "rounded-xl border px-4 py-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60",
                  uploadMode === mode
                    ? "border-[#0052FF] bg-[#EAF1FF] text-[#0F172A] shadow-sm"
                    : "border-[#CBD5E1] bg-white text-[#475569] hover:border-[#0052FF]/40"
                )}
              >
                <span className="block text-sm font-bold">
                  {mode === "append"
                    ? "Append - bỏ qua file trùng"
                    : "Overwrite - ghi đè file trùng"}
                </span>
                <span className="mt-1 block text-xs leading-5 text-[#64748B]">
                  {mode === "append"
                    ? "Chỉ xử lý tài liệu mới trong dữ liệu bổ sung."
                    : "Ghi đè nội dung PDF trùng path bằng bản mới."}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <UploadConfirmDialog
        open={overwriteDialogOpen}
        onOpenChange={setOverwriteDialogOpen}
        title="Chuyển sang chế độ Overwrite?"
        description={
          <>
            File PDF trùng path sẽ bị ghi đè. Metadata và trạng thái review liên
            quan có thể được extract lại theo bản mới.
          </>
        }
        confirmLabel="Dùng Overwrite"
        onConfirm={() => {
          syncUploadMode("overwrite")
          setOverwriteDialogOpen(false)
        }}
      />
    </>
  )
}

function SessionMetadataInput({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-semibold tracking-[0.08em] text-[#64748B] uppercase">
        {label}
      </span>
      <input
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Nhập thông tin"
        className="mt-1 h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm font-medium text-[#0F172A] transition-colors outline-none placeholder:text-[#94A3B8] focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/10 disabled:bg-[#F1F5F9] disabled:text-[#64748B]"
      />
    </label>
  )
}

function updateSessionMetadataDraft(
  metadata: SessionMetadataValues | undefined,
  syncDraft: ((metadata: SessionMetadataValues) => void) | undefined,
  field: keyof SessionMetadataValues,
  value: string
) {
  if (!syncDraft) return
  syncDraft({
    archive_name: metadata?.archive_name ?? null,
    archive_code: metadata?.archive_code ?? null,
    fonds_name: metadata?.fonds_name ?? null,
    fonds_creator_code: metadata?.fonds_creator_code ?? null,
    [field]: value,
  })
}
