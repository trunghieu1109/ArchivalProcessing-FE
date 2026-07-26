import { motion } from "framer-motion"
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Play,
} from "lucide-react"
import { ProgressTimeline } from "@/features/upload/components/ProgressTimeline"
import { DocxSection } from "@/features/upload/components/step1/DocxSection"
import { ZipSection } from "@/features/upload/components/step1/ZipSection"
import { cn } from "@/shared/lib/utils"
import type { UploadMode } from "@/features/upload/api/sessionApi"
import type { SessionMetadataValues } from "@/features/upload/components/SessionMetadataBar"
import { easeOut } from "./UploadPage.planUtils"

export function UploadPageStepOne(props: Record<string, any>) {
  const {
    currentSessionId,
    existingSessionMode,
    planAnalyzing,
    planProgressMessage,
    PLAN_PROGRESS_PHASES,
    planProgressPhase,
    planCompletedPhases,
    zipRef,
    zipState,
    syncZipState,
    syncZipHas,
    syncZipEntries,
    syncZipFolderPath,
    zipMaxFiles,
    syncZipMaxFiles,
    uploadInput,
    syncFolderSelection,
    uploadRetentionInputs,
    zipUploadProgress,
    latestUploadInterruption,
    planReuploadState,
    ocr,
    zipHas,
    allProcessing,
    sessionLoading,
    uploadMode,
    syncUploadMode,
    doc1Ref,
    doc2Ref,
    doc1State,
    doc2State,
    syncDoc1State,
    syncDoc2State,
    syncDoc1Has,
    syncDoc2Has,
    statusItems,
    allDone,
    zipSupplementUploaded,
    hasAnyFile,
    hasPlanReady,
    readyCount,
    requiredFileCount,
    selectedInputLabels,
    primaryActionDisabled,
    handleStartAll,
    planInputsReuploaded,
    sessionMetadata,
    syncSessionMetadataDraft,
    pendingFolderCount,
    hasPendingZip,
    latestUploadWarning,
    partialFolderCount,
    folderRunNeedsMetadataStart,
  } = props
  const zipUploadStatus = zipUploadProgress
    ? zipUploadProgress.phase === "error"
      ? "Upload ZIP thất bại"
      : zipUploadProgress.phase === "done"
        ? "Đã tải ZIP lên. Hệ thống đang giải nén trong nền."
        : zipUploadProgress.phase === "processing"
          ? "Đang xác nhận upload ZIP..."
          : "Đang upload ZIP..."
    : ""
  const zipUploadDetail = zipUploadProgress
    ? zipUploadProgress.percent !== null
      ? `${zipUploadProgress.percent}%`
      : `${zipUploadProgress.loadedMb.toFixed(2)} MB`
    : ""
  const planReanalysisActionLabel = planReuploadState?.retention
    ? planReuploadState?.arrangement
      ? "Phân tích lại phương án và thời hạn"
      : "Phân tích thời hạn bảo quản"
    : "Phân tích lại phương án"
  const retentionOnlyProcessing =
    planAnalyzing && doc2State === "processing" && doc1State !== "processing"
  const progressTitle =
    retentionOnlyProcessing ||
    (planReuploadState?.retention && !planReuploadState?.arrangement)
      ? "Phân tích thời hạn bảo quản"
      : "Phân tích phương án"
  const handleUploadModeSelect = (mode: UploadMode) => {
    if (mode === "overwrite" && uploadMode !== "overwrite") {
      const confirmed = window.confirm(
        "Bạn đang chọn overwrite. Hành động này sẽ ghi đè các file PDF trùng trong session và metadata/review liên quan có thể bị extract lại. Bạn có chắc muốn tiếp tục?"
      )
      if (!confirmed) return
    }
    syncUploadMode(mode)
  }

  return (
    <motion.div
      key="step1"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.4, ease: easeOut }}
      className="flex flex-col gap-4"
    >
      {latestUploadWarning && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-amber-900">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="text-sm font-bold">
              Lần upload gần nhất bị gián đoạn
            </p>
            <p className="mt-1 text-sm leading-6">{latestUploadWarning}</p>
          </div>
        </div>
      )}
      <div className="rounded-2xl border border-[#D8E1EC] bg-white px-5 py-4 shadow-sm">
        <p className="text-sm font-semibold text-[#0F172A]">
          {existingSessionMode
            ? "Bổ sung dữ liệu cho session"
            : "Tạo session mới"}
        </p>
        <p className="mt-1 text-sm text-[#64748B]">
          {existingSessionMode
            ? "Bạn có thể tải thêm ZIP, hoặc tải lại phương án chỉnh lý và thời hạn bảo quản để phân tích lại rồi lập lại hồ sơ mà không extract metadata lại."
            : "Chọn một hoặc nhiều file: phương án chỉnh lý, thông tư thời hạn bảo quản, hoặc file ZIP data."}
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
              disabled={allProcessing || sessionLoading}
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
              disabled={allProcessing || sessionLoading}
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
              disabled={allProcessing || sessionLoading}
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
              disabled={allProcessing || sessionLoading}
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

      {(planAnalyzing || planProgressMessage) && (
        <ProgressTimeline
          phases={PLAN_PROGRESS_PHASES}
          activePhase={planProgressPhase}
          completedPhases={planCompletedPhases}
          title={progressTitle}
          message={
            planProgressMessage || "Backend đang phân tích phương án chỉnh lý."
          }
        />
      )}

      {/* ZIP */}
      <ZipSection
        ref={zipRef}
        sessionId={currentSessionId}
        processState={zipState}
        onProcessStateChange={syncZipState}
        onHasFileChange={syncZipHas}
        onEntriesChange={syncZipEntries}
        onFolderPathChange={syncZipFolderPath}
        maxFiles={zipMaxFiles}
        onMaxFilesChange={syncZipMaxFiles}
        onUploadFile={(file) => uploadInput("raw_zip", file)}
        uploadProgress={zipUploadProgress}
        uploadInterruption={latestUploadInterruption}
        ocr={ocr}
        onFolderSelection={syncFolderSelection}
      />

      {existingSessionMode && zipHas && (
        <div className="rounded-2xl border border-[#D8E1EC] bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-[#0F172A]">
            Chế độ upload bổ sung
          </p>
          <p className="mt-1 text-sm text-[#64748B]">
            Append sẽ bỏ qua file PDF đã có trong phông. Overwrite sẽ ghi đè
            file trùng và metadata của file đó sẽ được extract lại.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(["append", "overwrite"] as UploadMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => handleUploadModeSelect(mode)}
                disabled={allProcessing || sessionLoading}
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
                    ? "An toàn hơn, chỉ xử lý tài liệu mới trong ZIP bổ sung."
                    : "Dùng khi muốn thay nội dung PDF đã có bằng bản mới trong ZIP."}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* DOCX */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DocxSection
          ref={doc1Ref}
          index={1}
          label="Phương án phân loại"
          sublabel={
            existingSessionMode
              ? "Tải lại file Word chứa phương án phân loại để phân tích lại session."
              : "Tải lên file Word chứa phương án phân loại tài liệu."
          }
          processState={doc1State}
          onProcessStateChange={syncDoc1State}
          onHasFileChange={syncDoc1Has}
          onUploadFile={(file) =>
            uploadInput("arrangement_plan", file).then(() => undefined)
          }
        />
        <DocxSection
          ref={doc2Ref}
          index={2}
          label="Thêm thông tư thời hạn bảo quản"
          sublabel={
            existingSessionMode
              ? "Bổ sung file Word chứa thông tư thời hạn bảo quản."
              : "Thêm file Word chứa thông tư thời hạn bảo quản."
          }
          processState={doc2State}
          onProcessStateChange={syncDoc2State}
          onHasFileChange={syncDoc2Has}
          multiple
          onUploadFiles={(files) =>
            uploadRetentionInputs(files).then(() => undefined)
          }
        />
      </div>

      {/* Action bar */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: easeOut, delay: 0.3 }}
        className="grid grid-cols-1 items-stretch gap-4 rounded-2xl border border-border bg-card px-4 py-4 shadow-sm sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
      >
        <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:gap-4">
          <div className="flex shrink-0 flex-wrap gap-2">
            {statusItems.map(
              (
                s: {
                  label: string
                  has: boolean
                  state: string
                },
                i: number
              ) => (
                <div
                  key={i}
                  className={cn(
                    "flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 font-roboto text-[11px] font-semibold tracking-[0.1em] whitespace-nowrap uppercase transition-all duration-200",
                    s.state === "done"
                      ? "text-primary-foreground"
                      : s.has
                        ? "border border-border bg-muted text-foreground"
                        : "border border-border bg-transparent text-muted-foreground"
                  )}
                  style={
                    s.state === "done"
                      ? {
                          background:
                            "linear-gradient(to right, #0052FF, #4D7CFF)",
                        }
                      : {}
                  }
                >
                  <div
                    className={cn(
                      "size-1.5 rounded-full",
                      s.state === "done"
                        ? "bg-white"
                        : s.has
                          ? "bg-primary"
                          : "bg-muted-foreground/40"
                    )}
                  />
                  {s.label}
                </div>
              )
            )}
          </div>
          <div className="min-w-0 text-sm font-medium [&>span]:max-w-full [&>span]:min-w-0">
            {sessionLoading ? (
              <span className="flex min-w-0 items-center gap-1.5 truncate text-muted-foreground">
                <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />{" "}
                Đang tải lại trạng thái session...
              </span>
            ) : allDone ? (
              <span className="flex min-w-0 items-center gap-1.5 truncate text-primary">
                <CheckCircle2 className="size-4 shrink-0" /> Phương án đã sẵn
                sàng
              </span>
            ) : planAnalyzing ? (
              <span className="flex min-w-0 items-center gap-1.5 truncate text-muted-foreground">
                <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />{" "}
                {retentionOnlyProcessing
                  ? "Đang phân tích thời hạn bảo quản..."
                  : "Đang phân tích phương án..."}
              </span>
            ) : zipUploadProgress ? (
              <span className="flex min-w-0 items-center gap-1.5 overflow-hidden text-muted-foreground">
                {zipUploadProgress.phase === "done" ? (
                  <CheckCircle2 className="size-4 shrink-0 text-primary" />
                ) : (
                  <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
                )}
                <span className="min-w-0 truncate">{zipUploadStatus}</span>
                {zipUploadDetail ? (
                  <span className="min-w-0 truncate font-bold text-foreground">
                    {zipUploadDetail}
                  </span>
                ) : null}
              </span>
            ) : allProcessing ? (
              <span className="flex min-w-0 items-center gap-1.5 truncate text-muted-foreground">
                <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />{" "}
                Đang xử lý tệp...
              </span>
            ) : existingSessionMode && zipSupplementUploaded ? (
              <span className="block truncate text-muted-foreground">
                ZIP bổ sung đã upload xong. Nhấn nút bên phải để extract
                metadata.
              </span>
            ) : folderRunNeedsMetadataStart ? (
              <span className="block truncate text-muted-foreground">
                Folder đã upload và ghi nhận xong. Có thể bắt đầu extract
                metadata.
              </span>
            ) : hasAnyFile ? (
              <span className="block truncate text-muted-foreground">
                Đã chọn:{" "}
                <span className="font-bold text-foreground">
                  {(selectedInputLabels ?? []).join(", ")}
                </span>
              </span>
            ) : Boolean(readyCount) && !readyCount ? (
              <span className="block truncate text-muted-foreground">
                <span className="font-bold text-foreground">{readyCount}</span>{" "}
                / {requiredFileCount} mục sẵn sàng
              </span>
            ) : (
              <span className="block truncate text-muted-foreground">
                {existingSessionMode
                  ? "Có thể bỏ qua bước tải ZIP để xem phương án"
                  : "Chọn ít nhất 1 file để bắt đầu"}
              </span>
            )}
          </div>
        </div>

        <button
          disabled={primaryActionDisabled}
          onClick={handleStartAll}
          className={cn(
            "group flex h-12 w-full min-w-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-all duration-200 sm:w-auto sm:min-w-44 lg:max-w-[16rem]",
            !primaryActionDisabled
              ? "text-primary-foreground hover:-translate-y-0.5 active:scale-[0.98]"
              : "cursor-not-allowed bg-muted text-muted-foreground"
          )}
          style={
            !primaryActionDisabled
              ? {
                  background: "linear-gradient(to right, #0052FF, #4D7CFF)",
                  boxShadow: "0 4px 14px rgba(0,82,255,0.25)",
                }
              : {}
          }
        >
          {allProcessing || sessionLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : allDone ? (
            <CheckCircle2 className="size-4" />
          ) : (
            <Play className="size-4" />
          )}
          <span className="min-w-0 truncate whitespace-nowrap">
            {sessionLoading
              ? "Đang tải..."
              : planAnalyzing
                ? existingSessionMode
                  ? "Xem trạng thái phân tích"
                  : "Đang phân tích..."
                : allProcessing
                  ? "Đang xử lý..."
                  : pendingFolderCount > 0
                    ? `Bắt đầu upload ${pendingFolderCount} PDF`
                    : hasPendingZip
                      ? "Bắt đầu upload ZIP"
                      : planInputsReuploaded
                        ? planReanalysisActionLabel
                        : partialFolderCount > 0
                          ? `Xử lý ${partialFolderCount} tài liệu đã tải thành công`
                          : folderRunNeedsMetadataStart
                            ? "Extract metadata folder"
                            : existingSessionMode && zipSupplementUploaded
                              ? "Extract metadata ZIP bổ sung"
                              : existingSessionMode && zipHas && !hasPlanReady
                                ? "Đi tới extract metadata"
                                : allDone
                                  ? "Tiếp tục"
                                  : existingSessionMode
                                    ? "Tiếp tục"
                                    : "Bắt đầu xử lý"}
          </span>
          {!primaryActionDisabled && (
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          )}
        </button>
      </motion.div>

      {/* Footer security note */}
      <p className="flex items-center justify-center gap-1.5 text-xs text-[#94A3B8]">
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        Dữ liệu của bạn được bảo mật và chỉ sử dụng cho mục đích xử lý tài liệu.
      </p>
    </motion.div>
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
