import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react"
import { CloudUpload, FileArchive, FolderOpen } from "lucide-react"
import { toast } from "sonner"
import {
  FolderUploadSection,
  type FolderUploadSummary,
  useFolderUploadJobs,
  useFolderUploadManager,
} from "@/features/folder-upload"
import type {
  SessionInputUploadResponse,
  UploadMode,
  UploadProgressSnapshot,
} from "@/features/upload/api/sessionApi"
import { UploadInterruptionNotice } from "@/features/upload/components/step1/UploadInterruptionNotice"
import {
  PendingDataUploadNotice,
  type PendingDataUploadSummary,
  type UnifiedDataUploadHandle,
} from "@/features/upload/components/step1/PendingDataUpload"
import { UploadProgressPanel } from "@/features/upload/components/step1/UploadProgressPanel"
import { ZipSection } from "@/features/upload/components/step1/ZipSection"
import type { UseOcrFolderResult } from "@/features/upload/hooks/useOcrFolder"
import type {
  ArchiveEntry,
  ProcessState,
  SectionHandle,
} from "@/features/upload/types"
import { cn } from "@/shared/lib/utils"
import {
  detectDroppedUploadSource,
  isPdfFile,
  isZipFile,
} from "./uploadSourceDetection"

type UploadSourceKind = "zip" | "folder"

interface ZipInterruptionNotice {
  fileName: string
  status: string
  cancelReason: string | null
}

type PendingUploadSource =
  | {
      kind: "zip"
      file: File
      summary: PendingDataUploadSummary
      ownerSessionId: string | null
    }
  | {
      kind: "folder"
      files: File[]
      summary: PendingDataUploadSummary
      ownerSessionId: string | null
    }

interface UnifiedDataUploadSectionProps {
  folderUploadEnabled: boolean
  sessionId: string | null
  ensureSession: () => Promise<string>
  uploadMode: UploadMode
  disabled: boolean
  zipRef: RefObject<SectionHandle | null>
  zipState: ProcessState
  syncZipState: (state: ProcessState) => void
  syncZipHas: (hasFile: boolean) => void
  syncZipEntries: (entries: ArchiveEntry[]) => void
  syncZipFolderPath: (folderPath: string) => void
  zipMaxFiles: string
  syncZipMaxFiles: (value: string) => void
  uploadZip: (file: File) => Promise<SessionInputUploadResponse>
  discardStagedZip: () => void
  zipUploadProgress: UploadProgressSnapshot | null
  zipUploadFileName?: string
  zipInterruptionNotice?: ZipInterruptionNotice | null
  folderInterruptionNotice?: FolderUploadSummary | null
  ocr: UseOcrFolderResult
  openZipUpload: boolean
  zipUploadFocusKey?: string | null
  openFolderUpload: boolean
  folderUploadFocusKey?: string | null
  onPendingUploadChange: (pending: PendingDataUploadSummary | null) => void
}

export const UnifiedDataUploadSection = forwardRef<
  UnifiedDataUploadHandle,
  UnifiedDataUploadSectionProps
>(function UnifiedDataUploadSection(
  {
    folderUploadEnabled,
    sessionId,
    ensureSession,
    uploadMode,
    disabled,
    zipRef,
    zipState,
    syncZipState,
    syncZipHas,
    syncZipEntries,
    syncZipFolderPath,
    zipMaxFiles,
    syncZipMaxFiles,
    uploadZip,
    discardStagedZip,
    zipUploadProgress,
    zipUploadFileName,
    zipInterruptionNotice,
    folderInterruptionNotice,
    ocr,
    openZipUpload,
    zipUploadFocusKey,
    openFolderUpload,
    folderUploadFocusKey,
    onPendingUploadChange,
  },
  ref
) {
  const folderManager = useFolderUploadManager()
  const folderJobs = useFolderUploadJobs()
  const previousSessionRef = useRef(sessionId)
  const expectedSessionTransitionRef = useRef(false)
  const zipInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [startingFolder, setStartingFolder] = useState(false)
  const [pendingSource, setPendingSource] =
    useState<PendingUploadSource | null>(null)
  const relevantFolderJob = useMemo(
    () =>
      sessionId
        ? ([...folderJobs]
            .filter((job) => job.sessionId === sessionId)
            .sort((left, right) => right.startedAt - left.startedAt)[0] ?? null)
        : null,
    [folderJobs, sessionId]
  )
  const folderJobNeedsProgress = Boolean(
    relevantFolderJob &&
    !["completed", "cancelled"].includes(relevantFolderJob.status)
  )
  const zipJobNeedsProgress = Boolean(
    zipUploadProgress && !["done", "error"].includes(zipUploadProgress.phase)
  )
  const zipPanelShouldOpen = Boolean(
    pendingSource?.kind === "zip" || zipJobNeedsProgress || zipUploadFileName
  )
  const [selectedKind, setSelectedKind] = useState<UploadSourceKind | null>(
    openZipUpload
      ? "zip"
      : folderUploadEnabled && openFolderUpload
        ? "folder"
        : zipUploadFileName || zipJobNeedsProgress
          ? "zip"
          : folderUploadEnabled && folderJobNeedsProgress
            ? "folder"
            : null
  )
  const folderRemoteStillOpen = Boolean(
    relevantFolderJob?.summary &&
    ["open", "uploading", "attention_required", "cancelling"].includes(
      relevantFolderJob.summary.status
    )
  )
  const selectionDisabled =
    disabled || folderRemoteStillOpen || detecting || startingFolder

  const clearPendingSource = useCallback(() => {
    expectedSessionTransitionRef.current = false
    setPendingSource(null)
    onPendingUploadChange(null)
  }, [onPendingUploadChange])

  useEffect(() => {
    if (previousSessionRef.current === sessionId) return
    const previousSessionId = previousSessionRef.current
    previousSessionRef.current = sessionId
    if (pendingSource && pendingSource.ownerSessionId !== sessionId) {
      if (
        expectedSessionTransitionRef.current &&
        previousSessionId === null &&
        sessionId !== null &&
        pendingSource.ownerSessionId === null
      ) {
        expectedSessionTransitionRef.current = false
        setPendingSource({ ...pendingSource, ownerSessionId: sessionId })
      } else {
        if (pendingSource.kind === "zip") discardStagedZip()
        clearPendingSource()
      }
    }
    const timer = window.setTimeout(() => {
      setSelectedKind(
        openZipUpload
          ? "zip"
          : folderUploadEnabled && openFolderUpload
            ? "folder"
            : zipPanelShouldOpen
              ? "zip"
              : folderUploadEnabled && folderJobNeedsProgress
                ? "folder"
                : null
      )
    }, 0)
    return () => window.clearTimeout(timer)
  }, [
    folderUploadEnabled,
    openFolderUpload,
    openZipUpload,
    folderJobNeedsProgress,
    zipPanelShouldOpen,
    sessionId,
    pendingSource,
    clearPendingSource,
    discardStagedZip,
  ])

  useEffect(() => {
    const requestedKind = openZipUpload
      ? "zip"
      : folderUploadEnabled && openFolderUpload
        ? "folder"
        : null
    if (!requestedKind) return
    const timer = window.setTimeout(() => {
      setSelectedKind(requestedKind)
      document
        .getElementById("upload-data-source-panel")
        ?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [
    folderUploadEnabled,
    folderUploadFocusKey,
    openFolderUpload,
    openZipUpload,
    zipUploadFocusKey,
  ])

  useEffect(() => {
    if (
      !zipPanelShouldOpen ||
      openFolderUpload ||
      pendingSource?.kind === "folder"
    ) {
      return
    }
    const timer = window.setTimeout(() => setSelectedKind("zip"), 0)
    return () => window.clearTimeout(timer)
  }, [openFolderUpload, pendingSource?.kind, zipPanelShouldOpen])

  useEffect(() => {
    if (!folderUploadEnabled || !folderJobNeedsProgress || openZipUpload) return
    const timer = window.setTimeout(() => setSelectedKind("folder"), 0)
    return () => window.clearTimeout(timer)
  }, [folderJobNeedsProgress, folderUploadEnabled, openZipUpload])

  const selectZip = async (file: File) => {
    if (!isZipFile(file)) {
      toast.error("Dữ liệu được chọn không phải file ZIP.")
      return
    }
    setSelectedKind("zip")
    const handle = zipRef.current
    if (!handle?.selectFile) {
      toast.error("Giao diện ZIP chưa sẵn sàng. Vui lòng thử lại.")
      return
    }
    const summary: PendingDataUploadSummary = {
      kind: "zip",
      label: file.name,
      fileCount: 1,
      totalBytes: file.size,
    }
    try {
      await handle.selectFile(file)
      setPendingSource({
        kind: "zip",
        file,
        summary,
        ownerSessionId: sessionId,
      })
      onPendingUploadChange(summary)
    } catch (error) {
      clearPendingSource()
      toast.error(
        error instanceof Error ? error.message : "Không thể chọn file ZIP."
      )
    }
  }

  const selectFolder = (sourceFiles: FileList | File[]) => {
    const files = Array.from(sourceFiles)
    const pdfFiles = files.filter(isPdfFile)
    if (!pdfFiles.length) {
      toast.error("Folder không có file PDF hợp lệ để upload.")
      return
    }
    const firstPath = pdfFiles[0]?.webkitRelativePath.replaceAll("\\", "/")
    const rootName = firstPath?.split("/").filter(Boolean)[0] || "Tài liệu PDF"
    const summary: PendingDataUploadSummary = {
      kind: "folder",
      label: rootName,
      fileCount: pdfFiles.length,
      totalBytes: pdfFiles.reduce((total, file) => total + file.size, 0),
    }
    if (pendingSource?.kind === "zip") {
      discardStagedZip()
    }
    setSelectedKind("folder")
    setPendingSource({
      kind: "folder",
      files,
      summary,
      ownerSessionId: sessionId,
    })
    onPendingUploadChange(summary)
    const ignoredCount = files.length - pdfFiles.length
    if (ignoredCount > 0) {
      toast.info(
        `Đã bỏ qua ${ignoredCount.toLocaleString("vi-VN")} file không phải PDF hoặc file rỗng.`
      )
    }
  }

  const startPending = async (): Promise<"workflow" | "started" | null> => {
    if (!pendingSource) return null
    if (pendingSource.ownerSessionId !== sessionId) {
      if (pendingSource.kind === "zip") discardStagedZip()
      clearPendingSource()
      toast.error(
        "Dữ liệu đã chọn thuộc session khác. Vui lòng chọn lại trước khi upload."
      )
      return null
    }
    if (pendingSource.kind === "zip") {
      expectedSessionTransitionRef.current = sessionId === null
      return "workflow"
    }
    setStartingFolder(true)
    try {
      expectedSessionTransitionRef.current = sessionId === null
      const targetSessionId = sessionId ?? (await ensureSession())
      folderManager.start({
        sessionId: targetSessionId,
        files: pendingSource.files,
        mode: uploadMode,
      })
      clearPendingSource()
      toast.success(
        "Đã bắt đầu upload folder. Bạn có thể chuyển sang màn hình khác."
      )
      return "started"
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Không thể bắt đầu upload folder."
      )
      return null
    } finally {
      setStartingFolder(false)
    }
  }

  const acceptPending = () => {
    clearPendingSource()
  }

  useImperativeHandle(ref, () => ({ startPending, acceptPending }))

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    if (selectionDisabled) return
    setDetecting(true)
    try {
      const source = await detectDroppedUploadSource(event.dataTransfer)
      if (source.kind === "zip") {
        await selectZip(source.file)
      } else if (folderUploadEnabled) {
        selectFolder(source.files)
      } else {
        toast.error("Upload folder chưa được bật ở môi trường này.")
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không thể đọc dữ liệu đã thả."
      )
    } finally {
      setDetecting(false)
    }
  }

  return (
    <section
      id="upload-data-source-panel"
      className="scroll-mt-24 rounded-2xl border border-[#D8E1EC] bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF1FF] text-[#0052FF]">
            <CloudUpload className="size-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-[#0F172A]">
                Upload dữ liệu tài liệu
              </h3>
              {selectedKind && (
                <span className="rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 py-1 text-[11px] font-semibold text-[#1D4ED8]">
                  Đã nhận diện: {selectedKind === "zip" ? "ZIP" : "Folder PDF"}
                </span>
              )}
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[#64748B]">
              Kéo thả một file ZIP hoặc nguyên folder PDF. Hệ thống tự chọn
              pipeline phù hợp trước khi bắt đầu upload.
            </p>
          </div>
        </div>
      </div>

      <UploadInterruptionNotice
        zip={zipInterruptionNotice}
        folder={folderInterruptionNotice}
        folderRemoteStillOpen={folderRemoteStillOpen}
      />

      <div
        onDragOver={(event) => {
          event.preventDefault()
          if (!selectionDisabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => void handleDrop(event)}
        className={cn(
          "mt-4 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-center transition",
          dragging
            ? "scale-[1.01] border-[#0052FF] bg-[#EFF6FF]"
            : "border-[#CBD5E1] bg-[#F8FAFC]",
          selectionDisabled && "cursor-not-allowed opacity-60"
        )}
      >
        <div className="flex items-center gap-2 text-[#0052FF]">
          <FileArchive className="size-5" />
          <span className="text-[#94A3B8]">hoặc</span>
          <FolderOpen className="size-5" />
        </div>
        <p className="text-sm font-semibold text-[#0F172A]">
          {detecting
            ? "Đang nhận diện dữ liệu..."
            : "Kéo thả file ZIP hoặc nguyên folder PDF vào đây"}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={selectionDisabled}
            onClick={() => zipInputRef.current?.click()}
            className="flex h-10 items-center gap-2 rounded-lg bg-[#0052FF] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#0047DB] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FileArchive className="size-4" />
            Upload file ZIP
          </button>
          {folderUploadEnabled && (
            <button
              type="button"
              disabled={selectionDisabled}
              onClick={() => folderInputRef.current?.click()}
              className="flex h-10 items-center gap-2 rounded-lg border border-[#0052FF] bg-white px-4 text-sm font-semibold text-[#0052FF] hover:bg-[#EFF6FF] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FolderOpen className="size-4" />
              {startingFolder ? "Đang khởi tạo..." : "Upload folder"}
            </button>
          )}
        </div>
        <p className="text-xs text-[#94A3B8]">
          ZIP được xử lý theo extract-job; folder giữ nguyên relative path.
        </p>
      </div>

      <input
        ref={zipInputRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ""
          if (file) void selectZip(file)
        }}
      />
      <input
        ref={(node) => {
          folderInputRef.current = node
          node?.setAttribute("webkitdirectory", "")
          node?.setAttribute("directory", "")
        }}
        type="file"
        multiple
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(event) => {
          const files = event.currentTarget.files
          if (files?.length) selectFolder(files)
          event.currentTarget.value = ""
        }}
      />

      <div className={selectedKind === "zip" ? "block" : "hidden"}>
        <UploadProgressPanel kind="zip">
          {pendingSource?.kind === "zip" && (
            <PendingDataUploadNotice summary={pendingSource.summary} />
          )}
          <ZipSection
            ref={zipRef}
            processState={zipState}
            onProcessStateChange={syncZipState}
            onHasFileChange={syncZipHas}
            onEntriesChange={syncZipEntries}
            onFolderPathChange={syncZipFolderPath}
            maxFiles={zipMaxFiles}
            onMaxFilesChange={syncZipMaxFiles}
            onUploadFile={uploadZip}
            uploadProgress={
              pendingSource?.kind === "zip" ? null : zipUploadProgress
            }
            managedFileName={
              pendingSource?.kind === "zip" ? undefined : zipUploadFileName
            }
            ocr={ocr}
            embedded
            hidePicker
            onClearFile={clearPendingSource}
          />
        </UploadProgressPanel>
      </div>
      {selectedKind === "folder" && (
        <UploadProgressPanel kind="folder">
          {pendingSource?.kind === "folder" && (
            <PendingDataUploadNotice summary={pendingSource.summary} />
          )}
          <FolderUploadSection
            sessionId={sessionId}
            ensureSession={ensureSession}
            uploadMode={uploadMode}
            disabled={disabled}
            embedded
            showPicker={false}
            showInterruptionNotice={false}
          />
        </UploadProgressPanel>
      )}
    </section>
  )
})
