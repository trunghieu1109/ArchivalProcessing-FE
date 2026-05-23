import { CheckCircle2, Loader2, X } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import type { ProcessState } from "@/features/upload/types"

interface FileChipProps {
  fileName: string
  loading: boolean
  processState: ProcessState
  onClear: () => void
  icon: React.ReactNode
}

export function FileChip({ fileName, loading, processState, onClear, icon }: FileChipProps) {
  const done = processState === "done"
  const processing = processState === "processing"

  return (
    <div className={cn(
      "flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-300",
      done
        ? "border-[#0052FF]/20 bg-[#0052FF]/5"
        : "border-[#E2E8F0] bg-white",
    )}>
      <div className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-lg transition-all duration-300",
        done
          ? "bg-gradient-to-br from-[#0052FF] to-[#4D7CFF]"
          : "bg-gradient-to-br from-[#0052FF] to-[#4D7CFF]",
      )}
        style={{ boxShadow: "0 4px 14px rgba(0,82,255,0.25)" }}
      >
        {loading
          ? <Loader2 className="size-4 animate-spin text-white" />
          : done
            ? <CheckCircle2 className="size-4 text-white" />
            : <div className="text-white">{icon}</div>
        }
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#0F172A] leading-none">{fileName}</p>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-[#64748B]">
          {loading ? "Reading…" : done ? "Processed" : "Ready"}
        </p>
      </div>

      {!processing && !loading && (
        <button
          onClick={onClear}
          className="shrink-0 rounded-md p-1 text-[#64748B] transition-all duration-200 hover:bg-[#F1F5F9] hover:text-[#0F172A]"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}
