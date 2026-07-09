import { useRef, useState } from "react"
import { CloudUpload, FolderOpen } from "lucide-react"
import { cn } from "@/shared/lib/utils"

interface DropZoneProps {
  accept: string
  onFile: (file: File) => void
  onFiles?: (files: File[]) => void
  label: string
  hint: string
  maxSize?: string
  buttonColor?: "blue" | "purple" | "green"
  multiple?: boolean
  compact?: boolean
}

export function DropZone({
  accept,
  onFile,
  onFiles,
  label,
  hint,
  maxSize,
  buttonColor = "blue",
  multiple = false,
  compact = false,
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const buttonStyle =
    buttonColor === "purple"
      ? { border: "1.5px solid #7C3AED", color: "#7C3AED" }
      : buttonColor === "green"
        ? { border: "1.5px solid #059669", color: "#059669" }
        : { border: "1.5px solid #0052FF", color: "#0052FF" }

  const iconBg =
    buttonColor === "purple"
      ? "bg-purple-50"
      : buttonColor === "green"
        ? "bg-emerald-50"
        : "bg-blue-50"

  const iconColor =
    buttonColor === "purple"
      ? "#7C3AED"
      : buttonColor === "green"
        ? "#059669"
        : "#0052FF"

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        const files = Array.from(event.dataTransfer.files)
        if (multiple) {
          if (files.length > 0) onFiles?.(files)
          return
        }
        const file = files[0]
        if (file) onFile(file)
      }}
      className={cn(
        "flex rounded-xl border-2 border-dashed transition-all duration-300",
        compact
          ? "flex-row flex-wrap items-center justify-center gap-3 px-4 py-3"
          : "flex-col items-center justify-center gap-3 py-8",
        dragging
          ? "scale-[1.01] border-primary bg-primary/5"
          : "border-[#CBD5E1] bg-[#F8FAFC]"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          if (multiple) {
            if (files.length > 0) onFiles?.(files)
          } else {
            const file = files[0]
            if (file) onFile(file)
          }
          event.target.value = ""
        }}
      />

      <div
        className={cn(
          "flex items-center justify-center rounded-full",
          compact ? "size-9" : "size-12",
          iconBg
        )}
      >
        <CloudUpload
          className={compact ? "size-5" : "size-6"}
          style={{ color: iconColor }}
        />
      </div>

      <p
        className={cn(
          "font-semibold text-[#0F172A]",
          compact ? "text-sm" : "text-sm"
        )}
      >
        {label}
      </p>
      {!compact && <p className="text-xs text-[#94A3B8]">hoặc</p>}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex items-center gap-2 rounded-lg bg-white font-semibold transition-all hover:opacity-80",
          compact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
        )}
        style={buttonStyle}
      >
        <FolderOpen className={compact ? "size-3.5" : "size-4"} />
        {compact ? "Thêm file" : "Chọn file"}
      </button>

      {!compact && (
        <p className="text-xs text-[#94A3B8]">
          Định dạng hỗ trợ: {hint}
          {maxSize && <span> &bull; Dung lượng tối đa: {maxSize}</span>}
        </p>
      )}
    </div>
  )
}
