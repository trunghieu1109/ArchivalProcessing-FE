import { useEffect, useMemo, useRef, useState } from "react"
import {
  ExternalLink,
  FileSearch,
  Loader2,
  RefreshCw,
  TriangleAlert,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { getDocumentPreviewUrl } from "@/features/upload/api/sessionApi"
import { cn } from "@/shared/lib/utils"

export interface DocumentPreviewTarget {
  id: number | null
  fileName: string
  dataPath: string
}

interface DocumentPdfPreviewProps {
  sessionId: string | null
  document: DocumentPreviewTarget | null
  className?: string
  onClose?: () => void
}

interface PreviewState {
  status: "idle" | "loading" | "ready" | "error"
  url: string
  error: string
}

export function DocumentPdfPreview({
  sessionId,
  document,
  className,
  onClose,
}: DocumentPdfPreviewProps) {
  const [refreshKey, setRefreshKey] = useState(0)
  const previewUrlCacheRef = useRef<Map<string, string>>(new Map())
  const [state, setState] = useState<PreviewState>({
    status: "idle",
    url: "",
    error: "",
  })
  const documentId = document?.id ?? null
  const documentKey = useMemo(() => {
    if (!sessionId || documentId === null) return ""
    return `${sessionId}:${documentId}`
  }, [documentId, sessionId])

  useEffect(() => {
    let cancelled = false

    if (!document) {
      setState({ status: "idle", url: "", error: "" })
      return () => {
        cancelled = true
      }
    }
    if (!sessionId) {
      setState({
        status: "error",
        url: "",
        error: "Chưa có session để lấy preview PDF.",
      })
      return () => {
        cancelled = true
      }
    }
    if (documentId === null) {
      setState({
        status: "error",
        url: "",
        error: "Tài liệu này chưa có mã trong session.",
      })
      return () => {
        cancelled = true
      }
    }

    const load = async () => {
      const cachedUrl = previewUrlCacheRef.current.get(documentKey)
      if (cachedUrl) {
        setState((current) =>
          current.url === cachedUrl
            ? current
            : { status: "ready", url: cachedUrl, error: "" }
        )
        return
      }

      setState((current) => ({
        status: "loading",
        url: current.url,
        error: "",
      }))
      try {
        const response = await getDocumentPreviewUrl(sessionId, documentId)
        const url = String(response.download_url ?? "").trim()
        if (!url) throw new Error("Backend chưa trả về URL preview PDF.")
        previewUrlCacheRef.current.set(documentKey, url)
        if (!cancelled) setState({ status: "ready", url, error: "" })
      } catch (err) {
        if (!cancelled) {
          setState((current) => ({
            status: "error",
            url: current.url,
            error:
              err instanceof Error ? err.message : "Không thể tải preview PDF.",
          }))
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [documentId, documentKey, refreshKey, sessionId])

  const canRefresh = Boolean(document && sessionId && document.id !== null)
  const iframeUrl = state.url ? pdfEmbedUrl(state.url) : ""
  const refreshPreview = () => {
    if (documentKey) previewUrlCacheRef.current.delete(documentKey)
    setRefreshKey((key) => key + 1)
  }

  return (
    <div
      className={cn(
        "flex min-h-[520px] min-w-0 flex-col overflow-hidden rounded-2xl border border-[#D8E1EC] bg-white shadow-sm",
        className
      )}
    >
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-[#E2E8F0] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#EAF1FF] text-[#0052FF]">
            <FileSearch className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#0F172A]">
              {document?.fileName || "Chưa chọn tài liệu"}
            </p>
            <p className="truncate text-[11px] text-[#64748B]">
              {document?.dataPath || "Preview PDF"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            title="Làm mới preview"
            disabled={!canRefresh || state.status === "loading"}
            onClick={refreshPreview}
          >
            {state.status === "loading" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
          </Button>
          <a
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-lg border border-[#CBD5E1] bg-white text-[#475569] transition-colors hover:bg-[#F8FAFC] hover:text-[#0052FF]",
              !state.url && "pointer-events-none opacity-50"
            )}
            href={state.url || undefined}
            target="_blank"
            rel="noreferrer"
            title="Mở PDF trong tab mới"
          >
            <ExternalLink className="size-3.5" />
          </a>
          {onClose && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              title="Đóng preview"
              onClick={onClose}
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 bg-[#F8FAFC]">
        {state.status === "ready" && iframeUrl ? (
          <iframe
            src={iframeUrl}
            title={
              document ? `PDF preview ${document.fileName}` : "PDF preview"
            }
            className="h-full min-h-[480px] w-full border-0 bg-white"
          />
        ) : (
          <PreviewEmptyState state={state} hasDocument={Boolean(document)} />
        )}
      </div>
    </div>
  )
}

function PreviewEmptyState({
  state,
  hasDocument,
}: {
  state: PreviewState
  hasDocument: boolean
}) {
  if (state.status === "loading") {
    return (
      <div className="flex h-full min-h-[480px] items-center justify-center text-sm text-[#64748B]">
        <Loader2 className="mr-2 size-4 animate-spin text-[#0052FF]" />
        Đang tải preview PDF...
      </div>
    )
  }

  if (state.status === "error") {
    return (
      <div className="flex h-full min-h-[480px] items-center justify-center px-6 text-center">
        <div className="max-w-sm text-sm text-[#64748B]">
          <TriangleAlert className="mx-auto mb-3 size-8 text-amber-500" />
          <p className="font-medium text-[#0F172A]">
            Không mở được preview PDF
          </p>
          <p className="mt-1">{state.error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-[480px] items-center justify-center px-6 text-center">
      <div className="max-w-sm text-sm text-[#64748B]">
        <FileSearch className="mx-auto mb-3 size-8 text-[#94A3B8]" />
        <p className="font-medium text-[#0F172A]">
          {hasDocument ? "Preview PDF chưa sẵn sàng" : "Chưa chọn tài liệu"}
        </p>
        <p className="mt-1">
          {hasDocument
            ? "Bấm làm mới để lấy lại URL preview."
            : "Chọn một tài liệu trong danh sách."}
        </p>
      </div>
    </div>
  )
}

function pdfEmbedUrl(url: string): string {
  if (!url || url.includes("#")) return url
  return `${url}#toolbar=1&navpanes=0&view=FitH&zoom=page-fit`
}
