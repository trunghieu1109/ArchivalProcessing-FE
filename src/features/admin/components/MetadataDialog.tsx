import { useRef, useState, type ReactNode } from "react"
import { Dialog } from "radix-ui"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/shared/lib/utils"

export function MetadataDialog({
  title,
  description,
  busy,
  onClose,
  children,
  className,
}: {
  title: string
  description: string
  busy: boolean
  onClose: () => void
  children: ReactNode
  className?: string
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [returnFocus] = useState(() => document.activeElement)

  return (
    <Dialog.Root open onOpenChange={(open) => !open && !busy && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#0F172A]/45 backdrop-blur-[2px]" />
        <Dialog.Content
          ref={contentRef}
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex max-h-[90svh] w-[calc(100%_-_2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl border border-[#D8E1EC] bg-white text-[#0F172A] shadow-2xl outline-none",
            className
          )}
          onOpenAutoFocus={(event) => {
            const field = contentRef.current?.querySelector<HTMLElement>(
              "input:not(:disabled), textarea:not(:disabled), select:not(:disabled)"
            )
            if (field) {
              event.preventDefault()
              field.focus()
            }
          }}
          onEscapeKeyDown={(event) => busy && event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => {
            if (returnFocus instanceof HTMLElement && returnFocus.isConnected) {
              event.preventDefault()
              returnFocus.focus()
            }
          }}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#E2E8F0] px-5 py-5 sm:px-6">
            <div>
              <Dialog.Title className="text-lg font-bold">{title}</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm leading-6 text-[#64748B]">
                {description}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={busy}
                aria-label="Đóng hộp thoại"
                className="shrink-0 rounded-xl text-[#64748B]"
              >
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>
          <div className="overflow-y-auto overscroll-contain p-5 sm:p-6">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
