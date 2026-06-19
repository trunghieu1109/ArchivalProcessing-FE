import { motion } from "framer-motion"
import { ArrowRight, CheckCircle2, Loader2, Play } from "lucide-react"
import { ProgressTimeline } from "@/features/upload/components/ProgressTimeline"
import { DocxSection } from "@/features/upload/components/step1/DocxSection"
import { ZipSection } from "@/features/upload/components/step1/ZipSection"
import { cn } from "@/shared/lib/utils"
import type { UploadMode } from "@/features/upload/api/sessionApi"
import { easeOut } from "./UploadPage.planUtils"

export function UploadPageStepOne(props: Record<string, any>) {
  const {
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
    zipUploadProgress,
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
    readyCount,
    requiredFileCount,
    primaryActionDisabled,
    handleStartAll,
    planInputsReuploaded,
  } = props

  return (
    <motion.div
      key="step1"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.4, ease: easeOut }}
      className="flex flex-col gap-4"
    >
      <div className="rounded-2xl border border-[#D8E1EC] bg-white px-5 py-4 shadow-sm">
        <p className="text-sm font-semibold text-[#0F172A]">
          {existingSessionMode
            ? "Bổ sung dữ liệu cho session"
            : "Tạo session mới"}
        </p>
        <p className="mt-1 text-sm text-[#64748B]">
          {existingSessionMode
            ? "Bạn có thể tải thêm ZIP, hoặc tải lại phương án chỉnh lý và thời hạn bảo quản để phân tích lại rồi lập lại hồ sơ mà không extract metadata lại."
            : "Chọn đủ phương án chỉnh lý, thông tư thời hạn bảo quản và file ZIP. Session chỉ được tạo khi bạn bấm bắt đầu phân tích."}
        </p>
      </div>

      {(planAnalyzing || planProgressMessage) && (
        <ProgressTimeline
          phases={PLAN_PROGRESS_PHASES}
          activePhase={planProgressPhase}
          completedPhases={planCompletedPhases}
          title="Phân tích phương án"
          message={
            planProgressMessage || "Backend đang phân tích phương án chỉnh lý."
          }
        />
      )}

      {/* ZIP */}
      <ZipSection
        ref={zipRef}
        processState={zipState}
        onProcessStateChange={syncZipState}
        onHasFileChange={syncZipHas}
        onEntriesChange={syncZipEntries}
        onFolderPathChange={syncZipFolderPath}
        maxFiles={zipMaxFiles}
        onMaxFilesChange={syncZipMaxFiles}
        onUploadFile={(file) => uploadInput("raw_zip", file)}
        uploadProgress={zipUploadProgress}
        ocr={ocr}
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
                onClick={() => syncUploadMode(mode)}
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
          label="Thời hạn bảo quản"
          sublabel={
            existingSessionMode
              ? "Tải lại file Word chứa thời hạn bảo quản để phân loại lại hồ sơ."
              : "Tải lên file Word chứa thời hạn bảo quản."
          }
          processState={doc2State}
          onProcessStateChange={syncDoc2State}
          onHasFileChange={syncDoc2Has}
          onUploadFile={(file) =>
            uploadInput("retention_schedule", file).then(() => undefined)
          }
        />
      </div>

      {/* Action bar */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: easeOut, delay: 0.3 }}
        className="flex flex-col items-stretch gap-4 rounded-2xl border border-border bg-card px-4 py-4 shadow-sm sm:px-6 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
          <div className="flex flex-wrap gap-2">
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
                    "flex items-center gap-1.5 rounded-full px-3 py-1 font-roboto text-[11px] font-semibold tracking-[0.1em] uppercase transition-all duration-200",
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
          <div className="text-sm font-medium">
            {sessionLoading ? (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin text-primary" /> Đang
                tải lại trạng thái session...
              </span>
            ) : allDone ? (
              <span className="flex items-center gap-1.5 text-primary">
                <CheckCircle2 className="size-4" /> Phương án đã sẵn sàng
              </span>
            ) : planAnalyzing ? (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin text-primary" /> Đang
                phân tích phương án...
              </span>
            ) : allProcessing ? (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin text-primary" /> Đang
                xử lý tệp...
              </span>
            ) : existingSessionMode && zipSupplementUploaded ? (
              <span className="text-muted-foreground">
                ZIP bổ sung đã upload xong. Nhấn nút bên phải để extract
                metadata.
              </span>
            ) : hasAnyFile ? (
              <span className="text-muted-foreground">
                <span className="font-bold text-foreground">{readyCount}</span>{" "}
                / {requiredFileCount} mục sẵn sàng
              </span>
            ) : (
              <span className="text-muted-foreground">
                {existingSessionMode
                  ? "Có thể bỏ qua bước tải ZIP để xem phương án"
                  : "Tải lên đủ 3 file để bắt đầu"}
              </span>
            )}
          </div>
        </div>

        <button
          disabled={primaryActionDisabled}
          onClick={handleStartAll}
          className={cn(
            "group flex w-full min-w-44 items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all duration-200 sm:w-auto",
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
          <span>
            {sessionLoading
              ? "Đang tải..."
              : planAnalyzing
                ? "Đang phân tích..."
                : allProcessing
                  ? "Đang xử lý..."
                  : planInputsReuploaded
                    ? "Phân tích lại và lập hồ sơ"
                    : existingSessionMode && zipSupplementUploaded
                      ? "Extract metadata ZIP bổ sung"
                      : allDone
                        ? "Tiếp tục"
                        : existingSessionMode
                          ? "Tiếp tục"
                          : "Bắt đầu phân tích"}
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
