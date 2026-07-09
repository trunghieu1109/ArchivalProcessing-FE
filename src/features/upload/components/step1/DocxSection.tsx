import { forwardRef, useState, useImperativeHandle } from "react"
import mammoth from "mammoth"
import { FileText, CheckCircle2, Loader2, AlertCircle } from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/shared/lib/utils"
import { DropZone } from "./DropZone"
import { FileChip } from "./FileChip"
import type { ProcessState, SectionHandle } from "@/features/upload/types"

interface DocxSectionProps {
  index: number
  label: string
  sublabel: string
  processState: ProcessState
  onProcessStateChange: (s: ProcessState) => void
  onHasFileChange: (v: boolean) => void
  onUploadFile?: (file: File) => Promise<void>
  onUploadFiles?: (files: File[]) => Promise<void>
  multiple?: boolean
}

export const DocxSection = forwardRef<SectionHandle, DocxSectionProps>(
  (
    {
      index,
      label,
      sublabel,
      processState,
      onProcessStateChange,
      onHasFileChange,
      onUploadFile,
      onUploadFiles,
      multiple = false,
    },
    ref
  ) => {
    const [fileNames, setFileNames] = useState<string[]>([])
    const [hasContent, setHasContent] = useState(false)
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)

    useImperativeHandle(ref, () => ({
      hasFile: () => hasContent,
      process: async () => {
        onProcessStateChange("processing")
        await new Promise((r) => setTimeout(r, 1500))
        onProcessStateChange("done")
      },
    }))

    const handleFile = async (file: File) => {
      await handleFiles([file])
    }

    const handleFiles = async (files: File[]) => {
      const selectedFiles = (multiple ? files : files.slice(0, 1)).filter(
        Boolean
      )
      if (selectedFiles.length === 0) return
      setError("")
      if (!multiple) {
        setHasContent(false)
        setFileNames([])
      }
      const nextFileNames = selectedFiles.map((file) => file.name)
      setFileNames((previous) =>
        multiple ? [...previous, ...nextFileNames] : nextFileNames
      )
      onProcessStateChange("idle")
      setLoading(true)
      try {
        await Promise.all(
          selectedFiles.map(async (file) => {
            const arrayBuffer = await file.arrayBuffer()
            await mammoth.convertToHtml({ arrayBuffer })
          })
        )
        if (multiple) {
          if (!onUploadFiles) {
            throw new Error("Chưa cấu hình upload nhiều file DOCX.")
          }
          await onUploadFiles(selectedFiles)
        } else {
          if (!onUploadFile) {
            throw new Error("Chưa cấu hình upload file DOCX.")
          }
          await onUploadFile(selectedFiles[0])
        }
        setHasContent(true)
        onHasFileChange(true)
      } catch (err) {
        if (multiple) {
          setFileNames((previous) =>
            previous.slice(0, previous.length - selectedFiles.length)
          )
        } else {
          setFileNames([])
        }
        setError(
          err instanceof Error
            ? err.message
            : "Không thể đọc hoặc tải lên file DOCX này."
        )
        if (!multiple) {
          onHasFileChange(false)
        }
      } finally {
        setLoading(false)
      }
    }

    const clear = () => {
      setHasContent(false)
      setFileNames([])
      setError("")
      onProcessStateChange("idle")
      onHasFileChange(false)
    }

    const isDone = processState === "done"
    const isProcessing = processState === "processing"

    const iconBg = index === 1 ? "bg-purple-50" : "bg-emerald-50"
    const iconColor = index === 1 ? "#7C3AED" : "#059669"
    const buttonColor = index === 1 ? "purple" : ("green" as "purple" | "green")

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.5,
          ease: [0.16, 1, 0.3, 1],
          delay: index * 0.08,
        }}
        className={cn(
          "relative flex flex-col gap-4 overflow-hidden rounded-2xl border bg-white p-5 transition-all duration-300",
          isDone
            ? "border-primary/20 shadow-[0_4px_24px_rgba(0,82,255,0.08)]"
            : "border-[#E2E8F0] shadow-sm"
        )}
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl",
              iconBg
            )}
          >
            <FileText className="size-5" style={{ color: iconColor }} />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className="text-base font-bold text-[#0F172A]">{label}</p>
              {isDone && (
                <span
                  className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold text-white"
                  style={{
                    background: "linear-gradient(to right, #0052FF, #4D7CFF)",
                  }}
                >
                  <CheckCircle2 className="size-3" /> Xong
                </span>
              )}
              {isProcessing && (
                <span className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-semibold text-primary">
                  <Loader2 className="size-3 animate-spin" /> Đang xử lý
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-[#64748B]">{sublabel}</p>
          </div>
        </div>

        {fileNames.length > 0 && (
          <div className="flex flex-col gap-2">
            {fileNames.map((fileName, fileIndex) => (
              <FileChip
                key={`${fileName}-${fileIndex}`}
                fileName={fileName}
                loading={loading}
                processState={processState}
                onClear={clear}
                icon={<FileText className="size-4" />}
              />
            ))}
          </div>
        )}
        {multiple || fileNames.length === 0 ? (
          <DropZone
            accept=".docx"
            onFile={handleFile}
            onFiles={handleFiles}
            multiple={multiple}
            compact={multiple && fileNames.length > 0}
            label={
              multiple
                ? fileNames.length > 0
                  ? "Thêm thông tư thời hạn bảo quản"
                  : "Kéo thả các file .docx vào đây"
                : "Kéo thả file .docx vào đây"
            }
            hint=".docx"
            maxSize="50MB"
            buttonColor={buttonColor}
          />
        ) : null}

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
            <AlertCircle className="size-3.5 shrink-0" /> {error}
          </div>
        )}
      </motion.div>
    )
  }
)
