import { CheckCircle2, Loader2, X } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/shared/lib/utils"
import type { ProcessState } from "@/features/upload/types"

interface FileChipProps {
  fileName: string
  loading: boolean
  processState: ProcessState
  onClear: () => void
  icon: ReactNode
}

export function FileChip({
  fileName,
  loading,
  processState,
  onClear,
  icon,
}: FileChipProps) {
  const done = processState === "done"
  const processing = processState === "processing"

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-300",
        done
          ? "border-primary/20 bg-primary/[0.03] shadow-[0_4px_14px_rgba(0,82,255,0.08)]"
          : "border-border bg-card"
      )}
    >
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-lg shadow-[0_4px_14px_rgba(0,82,255,0.25)]"
        style={{ background: "linear-gradient(135deg, #0052FF, #4D7CFF)" }}
      >
        {loading || processing ? (
          <Loader2 className="size-4 animate-spin text-white" />
        ) : done ? (
          <CheckCircle2 className="size-4 text-white" />
        ) : (
          <div className="text-white">{icon}</div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm leading-none font-semibold text-foreground">
          {fileName}
        </p>
        <p className="mt-1 font-roboto text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          {loading ? "Đang đọc..." : done ? "Đã xử lý" : "Sẵn sàng"}
        </p>
      </div>

      {!processing && !loading && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="size-7 shrink-0 p-0 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </Button>
      )}
    </div>
  )
}
