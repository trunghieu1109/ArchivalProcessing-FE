import { useRef, useState } from "react"
import { CloudUpload, FolderOpen } from "lucide-react"
import { cn } from "@/shared/lib/utils"

interface DropZoneProps {
  accept: string
  onFile: (file: File) => void
  label: string
  hint: string
  maxSize?: string
  buttonColor?: "blue" | "purple" | "green"
}

export function DropZone({
  accept,
  onFile,
  label,
  hint,
  maxSize,
  buttonColor = "blue",
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
        const file = event.dataTransfer.files[0]
        if (file) onFile(file)
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-8 transition-all duration-300",
        dragging
          ? "scale-[1.01] border-primary bg-primary/5"
          : "border-[#CBD5E1] bg-[#F8FAFC]"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onFile(file)
        }}
      />

      <div
        className={cn(
          "flex size-12 items-center justify-center rounded-full",
          iconBg
        )}
      >
        <CloudUpload className="size-6" style={{ color: iconColor }} />
      </div>

      <p className="text-sm font-semibold text-[#0F172A]">{label}</p>
      <p className="text-xs text-[#94A3B8]">hoặc</p>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold transition-all hover:opacity-80"
        style={buttonStyle}
      >
        <FolderOpen className="size-4" />
        Chọn file
      </button>

      <p className="text-xs text-[#94A3B8]">
        Định dạng hỗ trợ: {hint}
        {maxSize && <span> &bull; Dung lượng tối đa: {maxSize}</span>}
      </p>
    </div>
  )
}
