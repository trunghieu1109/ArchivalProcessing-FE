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
}

export const DocxSection = forwardRef<SectionHandle, DocxSectionProps>(
  ({ index, label, sublabel, processState, onProcessStateChange, onHasFileChange }, ref) => {
    const [fileName, setFileName] = useState("")
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
      setError("")
      setHasContent(false)
      setFileName(file.name)
      onProcessStateChange("idle")
      setLoading(true)
      try {
        const arrayBuffer = await file.arrayBuffer()
        await mammoth.convertToHtml({ arrayBuffer })
        setHasContent(true)
        onHasFileChange(true)
      } catch {
        setError("Không thể đọc file DOCX này.")
        setFileName("")
        onHasFileChange(false)
      } finally {
        setLoading(false)
      }
    }

    const clear = () => {
      setHasContent(false)
      setFileName("")
      setError("")
      onProcessStateChange("idle")
      onHasFileChange(false)
    }

    const isDone = processState === "done"
    const isProcessing = processState === "processing"

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: index * 0.08 }}
        className={cn(
          "relative flex flex-col gap-4 overflow-hidden rounded-2xl border bg-card p-5 transition-all duration-300",
          isDone
            ? "border-primary/20 shadow-[0_4px_24px_rgba(0,82,255,0.08)]"
            : "border-border shadow-sm hover:shadow-md",
        )}
      >
        {/* Subtle gradient overlay when done */}
        {isDone && (
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/[0.04] to-transparent" />
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50">
              0{index}
            </span>
            <div>
              <p className="text-sm font-semibold leading-none text-foreground">{label}</p>
              <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                {sublabel}
              </p>
            </div>
          </div>

          {isDone && (
            <span
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold text-primary-foreground"
              style={{ background: "linear-gradient(to right, #0052FF, #4D7CFF)" }}
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

        {fileName ? (
          <FileChip fileName={fileName} loading={loading} processState={processState}
            onClear={clear} icon={<FileText className="size-4" />} />
        ) : (
          <DropZone accept=".docx" onFile={handleFile} label="Tài liệu Word" hint=".docx" />
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
            <AlertCircle className="size-3.5 shrink-0" /> {error}
          </div>
        )}
      </motion.div>
    )
  }
)
