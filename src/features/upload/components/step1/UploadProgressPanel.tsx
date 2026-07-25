import type { ReactNode } from "react"
import { FileArchive, FolderOpen } from "lucide-react"

type UploadProgressKind = "zip" | "folder"

interface UploadProgressPanelProps {
  kind: UploadProgressKind
  children: ReactNode
}

export function UploadProgressPanel({
  kind,
  children,
}: UploadProgressPanelProps) {
  const isZip = kind === "zip"
  const Icon = isZip ? FileArchive : FolderOpen

  return (
    <section
      className="mt-5 overflow-hidden rounded-xl border border-[#D8E1EC] bg-[#F8FAFC]"
      aria-live="polite"
    >
      <div className="flex items-start gap-3 border-b border-[#E2E8F0] bg-white px-4 py-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#EAF1FF] text-[#0052FF]">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#0F172A]">
            {isZip ? "Tiến độ upload file ZIP" : "Tiến độ upload folder"}
          </p>
          <p className="mt-0.5 text-xs leading-5 text-[#64748B]">
            {isZip
              ? "Theo dõi dung lượng và phần trăm của file ZIP."
              : "Theo dõi tiến trình và trạng thái xác nhận của từng PDF."}
          </p>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}
