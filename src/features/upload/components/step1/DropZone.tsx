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
          ? "scale-[1.01] border-primary bg-primary/5"
          : "border-border hover:border-primary/50 hover:bg-primary/[0.02]",
      )}
    >
      <input ref={inputRef} type="file" accept={accept} className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }} />

      <div
        className={cn(
          "flex size-14 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110",
          dragging ? "shadow-[0_8px_24px_rgba(0,82,255,0.35)]" : "shadow-[0_4px_14px_rgba(0,82,255,0.25)]",
        )}
        style={{ background: "linear-gradient(135deg, #0052FF, #4D7CFF)" }}
      >
        <CloudUpload className="size-6 text-white" />
      </div>

      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">{hint}</p>
      </div>

      <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground/60 transition-colors group-hover:text-primary/60">
        Kéo thả hoặc nhấn để chọn
      </span>
    </div>
  )
}
