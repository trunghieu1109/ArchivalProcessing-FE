import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { cn } from "@/shared/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import {
  documentHasUserMetadataEdit,
  normalizeDocumentReviewStatus,
  verifyDocumentMetadata,
  type SessionDocumentResponse,
} from "@/features/upload/api/sessionApi"
import {
  buildDisplayMetadata,
  hasMetadataWarning,
} from "@/features/upload/lib/metadata"
import {
  DocumentPdfPreview,
  type DocumentPreviewTarget,
} from "@/features/upload/components/DocumentPdfPreview"
import { MetadataCard } from "./MetadataCard"
import type { ClusterGroup } from "@/features/upload/lib/clusterGroups"
import type { PdfMetadata } from "@/features/upload/types"

interface ProcessStepProps {
  sessionId: string | null
  pdfPaths: string[]
  metadataItems?: PdfMetadata[]
  metadataLoading?: boolean
  metadataMessage?: string
  signatureStatus?: {
    extracted: number
    pending: number
    failed: number
  }
  onDocumentsVerified?: (documents: SessionDocumentResponse[]) => void
  onRetryMetadata?: (documentId: number) => Promise<SessionDocumentResponse>
  onContinue: (groups: ClusterGroup[]) => void
}

export function ProcessStep({
  sessionId,
  pdfPaths,
  metadataItems = [],
  metadataLoading = false,
  metadataMessage = "Đang chờ kết quả số hóa từ backend...",
  signatureStatus = { extracted: 0, pending: 0, failed: 0 },
  onDocumentsVerified,
  onRetryMetadata,
  onContinue,
}: ProcessStepProps) {
  const [items, setItems] = useState<PdfMetadata[]>([])
  const [verifyingIds, setVerifyingIds] = useState<Set<number>>(() => new Set())
  const [retryingIds, setRetryingIds] = useState<Set<number>>(() => new Set())
  const [bulkVerifying, setBulkVerifying] = useState(false)
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(
    null
  )
  const [previewWidthPercent, setPreviewWidthPercent] = useState(48)
  const previewLayoutRef = useRef<HTMLDivElement | null>(null)
  const didAutoSelectRef = useRef(false)

  const metadataKey = useMemo(
    () =>
      metadataItems
        .map(
          (item) =>
            `${item.id}:${item.status}:${item.remote_metadata_status ?? ""}:${item.review_status}:${String(item.metadata_ready)}:${String(item.metadata_final)}:${String(item.metadata_user_edited ?? false)}`
        )
        .join("\n"),
    [metadataItems]
  )

  useEffect(() => {
    setItems((previous) => mergeIncomingMetadata(previous, metadataItems))
  }, [metadataItems, metadataKey])

  const paths = useMemo(
    () =>
      metadataItems.length > 0
        ? metadataItems.map((item) => item.data_path)
        : pdfPaths,
    [metadataItems, pdfPaths]
  )

  const readyItems = useMemo(
    () => items.filter((item) => item.metadata_ready),
    [items]
  )
  const verifiedItems = useMemo(
    () => items.filter((item) => item.review_status === "verified"),
    [items]
  )
  const pendingReadyItems = useMemo(
    () => readyItems.filter((item) => item.review_status !== "verified"),
    [readyItems]
  )
  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => metadataSortScore(a) - metadataSortScore(b)),
    [items]
  )
  const selectedItem = useMemo(
    () => sortedItems.find((item) => item.id === selectedDocumentId) ?? null,
    [selectedDocumentId, sortedItems]
  )
  const previewDocument = useMemo<DocumentPreviewTarget | null>(
    () =>
      selectedItem
        ? {
            id: selectedItem.id,
            fileName: fileNameFromPath(selectedItem.data_path),
            dataPath: selectedItem.data_path,
          }
        : null,
    [selectedItem]
  )

  useEffect(() => {
    if (sortedItems.length === 0) {
      setSelectedDocumentId(null)
      didAutoSelectRef.current = false
      return
    }
    if (
      selectedDocumentId !== null &&
      sortedItems.some((item) => item.id === selectedDocumentId)
    ) {
      return
    }
    if (selectedDocumentId !== null) {
      setSelectedDocumentId(null)
      return
    }
    if (didAutoSelectRef.current) {
      return
    }
    const firstWarning =
      sortedItems.find(
        (item) => item.review_status !== "verified" && hasMetadataWarning(item)
      ) ?? sortedItems[0]
    setSelectedDocumentId(firstWarning.id)
    didAutoSelectRef.current = true
  }, [selectedDocumentId, sortedItems])

  const handleApply = async (
    dataPath: string,
    meta?: Record<string, unknown>
  ) => {
    const item = items.find((candidate) => candidate.data_path === dataPath)
    if (!item) throw new Error("Không tìm thấy tài liệu trong session.")
    if (!sessionId) throw new Error("Chưa có session để xác nhận metadata.")
    if (!item.metadata_ready) {
      throw new Error("Metadata của tài liệu này chưa sẵn sàng để xác nhận.")
    }

    setVerifyingIds((previous) => addId(previous, item.id))
    try {
      const verified = await verifyDocumentMetadata(sessionId, item.id, meta)
      const nextItems = replaceVerifiedDocument(items, verified)
      setItems(nextItems)
      onDocumentsVerified?.([verified])
    } finally {
      setVerifyingIds((previous) => removeId(previous, item.id))
    }
  }

  const handleVerifyAllReady = async () => {
    if (!sessionId) {
      toast.error("Chưa có session để xác nhận metadata.")
      return
    }
    if (pendingReadyItems.length === 0) return

    setBulkVerifying(true)
    setVerifyingIds((previous) => {
      const next = new Set(previous)
      pendingReadyItems.forEach((item) => next.add(item.id))
      return next
    })
    try {
      const results = await Promise.allSettled(
        pendingReadyItems.map((item) =>
          verifyDocumentMetadata(sessionId, item.id)
        )
      )
      const verified = results
        .filter(
          (result): result is PromiseFulfilledResult<SessionDocumentResponse> =>
            result.status === "fulfilled"
        )
        .map((result) => result.value)
      if (verified.length > 0) {
        const nextItems = replaceVerifiedDocuments(items, verified)
        setItems(nextItems)
        onDocumentsVerified?.(verified)
      }

      const failedCount = results.length - verified.length
      if (failedCount > 0) {
        toast.error(
          `${failedCount} tài liệu chưa xác nhận được. Vui lòng kiểm tra lại.`
        )
      }
      if (verified.length > 0) {
        toast.success(`Đã xác nhận ${verified.length} tài liệu.`)
      }
    } finally {
      setBulkVerifying(false)
      setVerifyingIds((previous) => {
        const next = new Set(previous)
        pendingReadyItems.forEach((item) => next.delete(item.id))
        return next
      })
    }
  }

  const handleRetryMetadata = async (item: PdfMetadata) => {
    if (!onRetryMetadata) {
      toast.error("Backend chưa bật chức năng chạy lại metadata.")
      return
    }
    setRetryingIds((previous) => addId(previous, item.id))
    try {
      const restarted = await onRetryMetadata(item.id)
      setItems((previous) => replaceDocument(previous, restarted))
      toast.success("Đã gửi yêu cầu chạy lại metadata cho tài liệu.")
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Không thể chạy lại metadata cho tài liệu."
      )
    } finally {
      setRetryingIds((previous) => removeId(previous, item.id))
    }
  }

  const handlePreviewResizePointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>
  ) => {
    const container = previewLayoutRef.current
    if (!container) return
    event.preventDefault()

    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"

    const updatePreviewWidth = (clientX: number) => {
      const rect = container.getBoundingClientRect()
      const rawPercent = ((rect.right - clientX) / rect.width) * 100
      setPreviewWidthPercent(Math.min(68, Math.max(35, rawPercent)))
    }

    updatePreviewWidth(event.clientX)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      updatePreviewWidth(moveEvent.clientX)
    }
    const handlePointerUp = () => {
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
      window.removeEventListener("pointercancel", handlePointerUp)
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)
    window.addEventListener("pointercancel", handlePointerUp)
  }

  const warningCount = items.filter(
    (item) => item.review_status !== "verified" && hasMetadataWarning(item)
  ).length
  const loadingPlaceholderCount = Math.max(
    metadataLoading && items.length === 0 ? 1 : 0,
    Math.max(paths.length - items.length, 0)
  )
  const expectedCount = Math.max(paths.length, items.length)
  const readyPercent =
    expectedCount > 0
      ? Math.min(100, (readyItems.length / expectedCount) * 100)
      : 0
  const verifiedPercent =
    expectedCount > 0
      ? Math.min(100, (verifiedItems.length / expectedCount) * 100)
      : 0
  const canContinue = verifiedItems.length > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl text-foreground">Xử lý & lập hồ sơ</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Metadata được lấy từ backend. Sau khi metadata được xác nhận, màn
            hình sẽ chuyển sang kết quả lập hồ sơ.
          </p>
        </div>
        {warningCount > 0 && (
          <div className="shrink-0 text-right">
            <p className="font-roboto text-[11px] text-amber-600">
              Cần kiểm tra
            </p>
            <p className="text-xl font-bold text-amber-600">{warningCount}</p>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#D8E1EC] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-[#64748B] uppercase">
              Tiến độ metadata
            </p>
            <p className="mt-1 text-sm text-[#0F172A]">
              {metadataLoading
                ? `Đang trích xuất metadata: đã extract ${readyItems.length}/${expectedCount || "..."} tài liệu.`
                : readyItems.length > 0
                  ? `Có ${readyItems.length} tài liệu sẵn sàng, ${verifiedItems.length} đã xác nhận.`
                  : metadataMessage}
            </p>
            {(signatureStatus.pending > 0 || signatureStatus.failed > 0) && (
              <p className="mt-1 text-xs text-[#64748B]">
                Chữ ký: {signatureStatus.extracted} xong
                {signatureStatus.pending > 0
                  ? `, ${signatureStatus.pending} đang chờ`
                  : ""}
                {signatureStatus.failed > 0
                  ? `, ${signatureStatus.failed} lỗi`
                  : ""}
                .
              </p>
            )}
          </div>
          <div className="grid w-full grid-cols-2 gap-2 text-center sm:w-auto sm:grid-cols-4">
            <ProgressMetric label="Tài liệu" value={expectedCount} />
            <ProgressMetric label="Đã extract" value={readyItems.length} />
            <ProgressMetric label="Chữ ký xong" value={signatureStatus.extracted} />
            <ProgressMetric label="Đã xác nhận" value={verifiedItems.length} />
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#E2E8F0]">
          <motion.div
            className="h-full rounded-full bg-[#BFD3FF]"
            initial={false}
            animate={{ width: `${readyPercent}%` }}
            transition={{ duration: 0.35 }}
          />
          <motion.div
            className="-mt-2 h-full rounded-full bg-[#0052FF]"
            initial={false}
            animate={{ width: `${verifiedPercent}%` }}
            transition={{ duration: 0.35 }}
          />
        </div>
      </div>

      <div
        ref={previewLayoutRef}
        className="grid min-w-0 gap-4 xl:[grid-template-columns:var(--process-preview-columns)]"
        style={
          {
            "--process-preview-columns": `minmax(0, ${
              100 - previewWidthPercent
            }fr) minmax(360px, ${previewWidthPercent}fr)`,
          } as CSSProperties
        }
      >
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <span className="font-roboto text-[11px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">
              Metadata tài liệu
            </span>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {metadataLoading && (
                <span className="flex items-center gap-1.5 text-xs text-[#64748B]">
                  <Loader2 className="size-3 animate-spin text-[#0052FF]" />
                  Đã extract {readyItems.length}/{expectedCount || "..."}
                </span>
              )}
              {pendingReadyItems.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleVerifyAllReady()}
                  disabled={bulkVerifying}
                  className="h-8 gap-1.5 text-xs"
                >
                  {bulkVerifying ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-3" />
                  )}
                  Xác nhận tất cả
                </Button>
              )}
            </div>
          </div>
          <ScrollArea className="h-[min(70svh,640px)] min-h-[360px]">
            <div className="flex flex-col gap-2 pr-1">
              {sortedItems.map((item) => (
                <MetadataCard
                  key={item.id}
                  item={item}
                  selected={item.id === selectedDocumentId}
                  submitting={verifyingIds.has(item.id)}
                  retrying={retryingIds.has(item.id)}
                  onSelect={(expanded) =>
                    setSelectedDocumentId((current) =>
                      expanded ? item.id : current === item.id ? null : current
                    )
                  }
                  onApply={handleApply}
                  onRetry={() => void handleRetryMetadata(item)}
                />
              ))}
              {Array.from({ length: loadingPlaceholderCount }).map((_, i) => (
                <div
                  key={`skel-${i}`}
                  className="h-14 animate-pulse rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]"
                />
              ))}
              {!metadataLoading && items.length === 0 && (
                <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-white p-6 text-center text-sm text-muted-foreground">
                  Chưa có metadata từ backend.
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
        <div className="relative min-w-0">
          <button
            type="button"
            aria-label="Kéo để đổi kích thước preview"
            title="Kéo để đổi kích thước preview"
            onPointerDown={handlePreviewResizePointerDown}
            className="group absolute top-0 bottom-0 -left-3 z-20 hidden w-5 cursor-col-resize items-center justify-center xl:flex"
          >
            <span className="h-16 w-1 rounded-full bg-[#0052FF] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
          </button>
          <DocumentPdfPreview
            sessionId={sessionId}
            document={previewDocument}
            className="h-[min(72svh,678px)] min-h-[420px] min-w-0"
          />
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-[#CBD5E1] bg-white px-4 py-4 shadow-sm sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 text-sm text-[#475569]">
          {pendingReadyItems.length > 0 && verifiedItems.length === 0 ? (
            <span className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="size-4" />
              Còn {pendingReadyItems.length} tài liệu cần xác nhận metadata.
            </span>
          ) : pendingReadyItems.length > 0 ? (
            <span className="flex items-center gap-2 text-[#475569]">
              <CheckCircle2 className="size-4 text-emerald-600" />
              Có thể lập hồ sơ với {verifiedItems.length} tài liệu đã xác nhận;
              {` ${pendingReadyItems.length}`} tài liệu còn lại có thể cập nhật
              hồ sơ sau.
            </span>
          ) : readyItems.length > 0 ? (
            <span className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="size-4" /> Metadata đã được xác nhận.
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin text-[#0052FF]" />
              {metadataMessage}
            </span>
          )}
        </div>
        <button
          disabled={!canContinue}
          onClick={() => onContinue([])}
          className={cn(
            "group flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all duration-200 sm:w-auto",
            canContinue
              ? "text-white hover:-translate-y-0.5 active:scale-[0.98]"
              : "cursor-not-allowed bg-[#CBD5E1] text-[#475569]"
          )}
          style={
            canContinue
              ? {
                  background: "linear-gradient(to right, #0052FF, #4D7CFF)",
                  boxShadow: "0 4px 14px rgba(0,82,255,0.25)",
                }
              : {}
          }
        >
          {canContinue
            ? `Xem kết quả (${verifiedItems.length} tài liệu)`
            : "Xem kết quả"}
        </button>
      </div>
    </motion.div>
  )
}

function ProgressMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-20 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
      <p className="text-[10px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">
        {label}
      </p>
      <p className="text-base font-bold text-[#0F172A]">{value}</p>
    </div>
  )
}

function mergeIncomingMetadata(
  previous: PdfMetadata[],
  incoming: PdfMetadata[]
): PdfMetadata[] {
  const previousById = new Map(previous.map((item) => [item.id, item]))
  return incoming.map((rawItem) => {
    const item = normalizePdfMetadata(rawItem)
    const local = previousById.get(item.id)
    if (
      local?.review_status === "verified" &&
      item.review_status !== "verified"
    ) {
      const normalizedMetadata = item.normalized_metadata ?? local.normalized_metadata
      const rawMetadata = item.raw_metadata ?? local.raw_metadata
      return {
        ...local,
        status: item.status,
        remote_metadata_status: item.remote_metadata_status,
        metadata_ready: item.metadata_ready,
        metadata_final: item.metadata_final,
        normalized_metadata: normalizedMetadata,
        raw_metadata: rawMetadata,
        light_metadata: buildDisplayMetadata({
          light_metadata: local.light_metadata,
          normalized_metadata: normalizedMetadata,
          raw_metadata: rawMetadata,
          remote_metadata_status: item.remote_metadata_status,
          status: item.status,
        }),
      }
    }
    return item
  })
}

function replaceVerifiedDocument(
  items: PdfMetadata[],
  document: SessionDocumentResponse
): PdfMetadata[] {
  const next = documentResponseToPdfMetadata(document)
  return items.map((item) => (item.id === next.id ? next : item))
}

function replaceDocument(
  items: PdfMetadata[],
  document: SessionDocumentResponse
): PdfMetadata[] {
  const next = documentResponseToPdfMetadata(document)
  return items.map((item) => (item.id === next.id ? next : item))
}

function replaceVerifiedDocuments(
  items: PdfMetadata[],
  documents: SessionDocumentResponse[]
): PdfMetadata[] {
  const byId = new Map(
    documents.map((document) => {
      const item = documentResponseToPdfMetadata(document)
      return [item.id, item] as const
    })
  )
  return items.map((item) => byId.get(item.id) ?? item)
}

function documentResponseToPdfMetadata(
  document: SessionDocumentResponse
): PdfMetadata {
  const lightMetadata = buildDisplayMetadata(document)
  const reviewStatus = normalizeDocumentReviewStatus(document, lightMetadata)
  return {
    id: document.id,
    document_id: document.document_id,
    data_path: document.data_path,
    status: document.ocr_status,
    remote_metadata_status: document.remote_metadata_status,
    review_status: reviewStatus,
    metadata_ready: document.metadata_ready,
    metadata_final: document.metadata_final,
    metadata_version_count: document.metadata_version_count,
    metadata_user_edited: documentHasUserMetadataEdit(document),
    error: document.error,
    light_metadata: lightMetadata,
    normalized_metadata: document.normalized_metadata,
    raw_metadata: document.raw_metadata,
    applied: reviewStatus === "verified",
  }
}

function normalizePdfMetadata(item: PdfMetadata): PdfMetadata {
  const reviewStatus = normalizeDocumentReviewStatus(
    {
      review_status: item.review_status,
      metadata_ready: item.metadata_ready,
    },
    item.light_metadata
  )
  if (
    reviewStatus === item.review_status &&
    item.applied === (reviewStatus === "verified")
  ) {
    return item
  }
  return {
    ...item,
    review_status: reviewStatus,
    applied: reviewStatus === "verified",
  }
}

function metadataSortScore(item: PdfMetadata): number {
  if (item.review_status === "verified") return 3
  if (hasMetadataWarning(item)) return 0
  if (item.metadata_ready) return 1
  return 2
}

function addId(values: Set<number>, id: number): Set<number> {
  const next = new Set(values)
  next.add(id)
  return next
}

function removeId(values: Set<number>, id: number): Set<number> {
  const next = new Set(values)
  next.delete(id)
  return next
}

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() || path
}
