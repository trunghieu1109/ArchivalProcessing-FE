import { useState, type ReactNode } from "react"
import { AlertTriangle, Loader2, X } from "lucide-react"
import { Dialog } from "radix-ui"
import { cn } from "@/shared/lib/utils"

interface UploadConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  cancelLabel?: string
  busyLabel?: string
  danger?: boolean
  onConfirm: () => void | Promise<void>
}

export function UploadConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Quay lại",
  busyLabel = "Đang xử lý...",
  danger = false,
  onConfirm,
}: UploadConfirmDialogProps) {
  const [busy, setBusy] = useState(false)

  const handleConfirm = async () => {
    if (busy) return
    setBusy(true)
    try {
      await onConfirm()
    } finally {
      setBusy(false)
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (busy) return
    onOpenChange(nextOpen)
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[120] bg-[#0F172A]/55 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 z-[121] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-[#CBD5E1] bg-white shadow-2xl outline-none"
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault()
          }}
          onPointerDownOutside={(event) => {
            if (busy) event.preventDefault()
          }}
        >
          <div className="flex items-start gap-3 border-b border-[#E2E8F0] px-5 py-4">
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl",
                danger
                  ? "bg-[#FEF2F2] text-[#DC2626]"
                  : "bg-[#FFF7ED] text-[#D97706]"
              )}
            >
              <AlertTriangle className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base font-bold text-[#0F172A]">
                {title}
              </Dialog.Title>
              <Dialog.Description asChild>
                <div className="mt-1 text-sm leading-6 text-[#64748B]">
                  {description}
                </div>
              </Dialog.Description>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => onOpenChange(false)}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#F1F5F9] disabled:opacity-50"
              aria-label="Đóng"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="flex flex-col-reverse gap-2 bg-[#F8FAFC] px-5 py-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={() => onOpenChange(false)}
              className="h-10 rounded-xl border border-[#CBD5E1] bg-white px-4 text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC] disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleConfirm()}
              className={cn(
                "flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-60",
                danger
                  ? "bg-[#DC2626] hover:bg-[#B91C1C]"
                  : "bg-[#0052FF] hover:bg-[#0047DB]"
              )}
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {busy ? busyLabel : confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
