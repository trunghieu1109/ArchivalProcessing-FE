import { Download, Eye, X } from "lucide-react"
import type { NumberingDocumentStatus } from "@/features/upload/api/sessionApi"
import { pdfEmbedUrl } from "./NumberingStep.utils"

export function NumberedPdfPreviewPanel({
  document,
  onClose,
}: {
  document: NumberingDocumentStatus | null
  onClose: () => void
}) {
  const previewUrl = document?.download_url
    ? pdfEmbedUrl(document.download_url)
    : ""
  return (
    <section className="min-h-[420px] min-w-0 overflow-hidden rounded-2xl border border-[#D8E1EC] bg-white shadow-sm xl:sticky xl:top-4 xl:self-start">
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-[#EEF2F7] px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#0F172A]">
            Preview PDF đã đánh số
          </p>
          <p className="mt-0.5 truncate text-xs text-[#64748B]">
            {document
              ? document.file_name || document.document_id
              : "Chọn một PDF đã đánh số để xem trước."}
          </p>
        </div>
        {document ? (
          <div className="flex shrink-0 items-center gap-2">
            {document.download_url ? (
              <a
                href={document.download_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3 text-xs font-medium text-[#475569] transition-colors hover:border-[#0052FF]/40 hover:text-[#0052FF]"
              >
                <Download className="size-3.5" />
                Mở PDF
              </a>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex size-8 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white text-[#475569] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A]"
              title="Đóng preview"
              aria-label="Đóng preview"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : null}
      </div>
      {document && previewUrl ? (
        <iframe
          title={`Preview PDF đã đánh số ${document.file_name || document.document_id}`}
          src={previewUrl}
          className="h-[min(72svh,760px)] min-h-[420px] w-full border-0 bg-white"
        />
      ) : (
        <div className="flex h-[min(72svh,760px)] min-h-[420px] flex-col items-center justify-center px-8 text-center text-sm text-[#64748B]">
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-[#EAF1FF] text-[#0052FF]">
            <Eye className="size-6" />
          </div>
          <p className="font-medium text-[#0F172A]">
            Chọn một PDF đã đánh số để preview.
          </p>
        </div>
      )}
    </section>
  )
}
