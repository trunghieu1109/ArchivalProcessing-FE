import { useRef, useState } from "react"
import { CloudUpload } from "lucide-react"
import { cn } from "@/shared/lib/utils"

interface DropZoneProps {
  accept: string
  onFile: (file: File) => void
  label: string
  hint: string
}

export function DropZone({ accept, onFile, label, hint }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        const f = e.dataTransfer.files[0]
        if (f) onFile(f)
      }}
      className={cn(
        "group flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed py-10 transition-all duration-300",
        dragging
          ? "scale-[1.01] border-[#0052FF] bg-[#0052FF]/5"
          : "border-[#E2E8F0] hover:border-[#0052FF]/40 hover:bg-[#0052FF]/[0.02]",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }}
      />
      <div
        className="flex size-14 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110"
        style={{ background: "linear-gradient(135deg, #0052FF, #4D7CFF)", boxShadow: dragging ? "0 8px 24px rgba(0,82,255,0.35)" : "0 4px 14px rgba(0,82,255,0.25)" }}
      >
        <CloudUpload className="size-6 text-white" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-[#0F172A]">{label}</p>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.15em] text-[#64748B]">{hint}</p>
      </div>
      <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#64748B]/60 transition-colors group-hover:text-[#0052FF]/60">
        Kéo thả hoặc nhấn để chọn
      </span>
    </div>
  )
}
