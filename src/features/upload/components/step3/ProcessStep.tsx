import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react"
import {
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  List,
  Loader2,
} from "lucide-react"
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
import { DocumentDownloadDialog } from "./DocumentDownloadDialog"
import { MetadataCard } from "./MetadataCard"
import type { ClusterGroup } from "@/features/upload/lib/clusterGroups"
import type { PdfMetadata } from "@/features/upload/types"

type MetadataReviewMode = "list" | "batch"

interface MetadataBatchGroup {
  index: number
  label: string
  start: number
  end: number
  items: PdfMetadata[]
  readyCount: number
  verifiedCount: number
  warningCount: number
  pendingReadyCount: number
}

const DEFAULT_METADATA_BATCH_SIZE = 25
const MIN_METADATA_BATCH_SIZE = 5
const MAX_METADATA_BATCH_SIZE = 1000
const METADATA_BATCH_SIZE_OPTIONS = [25, 50, 100, 200, 500, 1000]
const MAX_LOADING_PLACEHOLDERS = 12
const REVIEW_MODE_STORAGE_KEY = "archival-processing.metadata-review-mode"
const BATCH_SIZE_STORAGE_KEY = "archival-processing.metadata-review-batch-size"

interface ProcessStepProps {
  sessionId: string | null
  pdfPaths: string[]
  metadataItems?: PdfMetadata[]
  metadataLoading?: boolean
  metadataReloading?: boolean
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
  metadataReloading = false,
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
  const [reviewMode, setReviewMode] = useState<MetadataReviewMode>(() =>
    readStoredReviewMode()
  )
  const [batchSize, setBatchSize] = useState(() => readStoredBatchSize())
  const [batchSizeInput, setBatchSizeInput] = useState(() =>
    String(readStoredBatchSize())
  )
  const [activeBatchIndex, setActiveBatchIndex] = useState(0)
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
  const batchGroups = useMemo(
    () => buildMetadataBatchGroups(sortedItems, batchSize),
    [batchSize, sortedItems]
  )
  const activeBatch = batchGroups[activeBatchIndex] ?? batchGroups[0] ?? null
  const displayedItems =
    reviewMode === "batch" ? (activeBatch?.items ?? []) : sortedItems
  const displayedPendingReadyItems = useMemo(
    () =>
      displayedItems.filter(
        (item) => item.metadata_ready && item.review_status !== "verified"
      ),
    [displayedItems]
  )
  const bulkVerifyItems =
    reviewMode === "batch" ? displayedPendingReadyItems : pendingReadyItems
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
    writeStoredReviewMode(reviewMode)
  }, [reviewMode])

  useEffect(() => {
    writeStoredBatchSize(batchSize)
  }, [batchSize])

  useEffect(() => {
    if (batchGroups.length === 0) {
      if (activeBatchIndex !== 0) {
        setActiveBatchIndex(0)
      }
      return
    }
    if (activeBatchIndex > batchGroups.length - 1) {
      setActiveBatchIndex(batchGroups.length - 1)
    }
  }, [activeBatchIndex, batchGroups.length])

  useEffect(() => {
    if (reviewMode !== "batch" || !activeBatch) return
    if (
      selectedDocumentId !== null &&
      activeBatch.items.some((item) => item.id === selectedDocumentId)
    ) {
      return
    }
    setSelectedDocumentId(
      firstPreferredMetadataItem(activeBatch.items)?.id ?? null
    )
  }, [activeBatch, reviewMode, selectedDocumentId])

  useEffect(() => {
    if (reviewMode !== "list") return
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
  }, [reviewMode, selectedDocumentId, sortedItems])

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
    if (bulkVerifyItems.length === 0) return

    setBulkVerifying(true)
    setVerifyingIds((previous) => {
      const next = new Set(previous)
      bulkVerifyItems.forEach((item) => next.add(item.id))
      return next
    })
    try {
      const results = await Promise.allSettled(
        bulkVerifyItems.map((item) =>
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
        bulkVerifyItems.forEach((item) => next.delete(item.id))
        return next
      })
    }
  }

  const handleReviewModeChange = (mode: MetadataReviewMode) => {
    setReviewMode(mode)
    if (mode === "batch" && activeBatch) {
      setSelectedDocumentId(
        firstPreferredMetadataItem(activeBatch.items)?.id ?? null
      )
    }
  }

  const handleBatchSizeChange = (value: number) => {
    const nextBatchSize = normalizeBatchSize(value)
    setBatchSize(nextBatchSize)
    setActiveBatchIndex(0)
    setSelectedDocumentId(
      firstPreferredMetadataItem(sortedItems.slice(0, nextBatchSize))?.id ??
        null
    )
  }

  const handleBatchSizeInputChange = (value: string) => {
    setBatchSizeInput(value)
    const trimmed = value.trim()
    if (!/^\d+$/.test(trimmed)) return
    handleBatchSizeChange(Number(trimmed))
  }

  const handleBatchSizeInputBlur = () => {
    const trimmed = batchSizeInput.trim()
    if (!/^\d+$/.test(trimmed)) {
      setBatchSizeInput(String(batchSize))
      return
    }
    const nextBatchSize = normalizeBatchSize(Number(trimmed))
    handleBatchSizeChange(nextBatchSize)
    setBatchSizeInput(String(nextBatchSize))
  }

  const handleSelectBatch = (group: MetadataBatchGroup) => {
    setActiveBatchIndex(group.index)
    setSelectedDocumentId(firstPreferredMetadataItem(group.items)?.id ?? null)
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
  const visibleLoadingPlaceholderCount = Math.min(
    loadingPlaceholderCount,
    MAX_LOADING_PLACEHOLDERS
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
                ? `${
                    metadataReloading
                      ? "Đang trích xuất lại metadata"
                      : "Đang trích xuất metadata"
                  }: đã extract ${readyItems.length}/${expectedCount || "..."} tài liệu.`
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
            <ProgressMetric
              label="Chữ ký xong"
              value={signatureStatus.extracted}
            />
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
              <DocumentDownloadDialog sessionId={sessionId} items={items} />
              {metadataLoading && (
                <span className="flex items-center gap-1.5 text-xs text-[#64748B]">
                  <Loader2 className="size-3 animate-spin text-[#0052FF]" />
                  {metadataReloading ? "Đang extract lại" : "Đã extract"}{" "}
                  {readyItems.length}/{expectedCount || "..."}
                </span>
              )}
              {bulkVerifyItems.length > 0 && (
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
                  {reviewMode === "batch" ? "Xác nhận lô" : "Xác nhận tất cả"}
                </Button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-2">
            <div className="inline-flex rounded-lg border border-[#CBD5E1] bg-white p-1">
              <ReviewModeButton
                active={reviewMode === "list"}
                icon={<List className="size-3.5" />}
                label="Danh sách"
                onClick={() => handleReviewModeChange("list")}
              />
              <ReviewModeButton
                active={reviewMode === "batch"}
                icon={<FolderOpen className="size-3.5" />}
                label="Theo lô"
                onClick={() => handleReviewModeChange("batch")}
              />
            </div>
            {reviewMode === "batch" && (
              <label className="flex items-center gap-2 text-xs font-medium text-[#475569]">
                Cỡ lô
                <input
                  type="text"
                  inputMode="numeric"
                  value={batchSizeInput}
                  onChange={(event) =>
                    handleBatchSizeInputChange(event.target.value)
                  }
                  onBlur={handleBatchSizeInputBlur}
                  className="h-8 w-20 rounded-lg border border-[#CBD5E1] bg-white px-2 text-xs text-[#0F172A] transition-colors outline-none focus-visible:border-[#0052FF] focus-visible:ring-3 focus-visible:ring-[#0052FF]/20"
                  list="metadata-batch-size-options"
                />
                <datalist id="metadata-batch-size-options">
                  {METADATA_BATCH_SIZE_OPTIONS.map((value) => (
                    <option key={value} value={value} />
                  ))}
                </datalist>
              </label>
            )}
            {reviewMode === "batch" && activeBatch && (
              <span className="text-xs text-[#64748B]">
                {activeBatch.label}: {activeBatch.verifiedCount}/
                {activeBatch.items.length} đã xác nhận
              </span>
            )}
          </div>
          {reviewMode === "batch" && batchGroups.length > 0 && activeBatch && (
            <div className="flex flex-col gap-2 rounded-xl border border-[#D8E1EC] bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#0F172A]">
                    {activeBatch.label}
                  </p>
                  <p className="text-[11px] text-[#64748B]">
                    Tài liệu {activeBatch.start}-{activeBatch.end} /{" "}
                    {sortedItems.length}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] text-[#475569]">
                  <BatchMetric
                    label="Sẵn sàng"
                    value={activeBatch.readyCount}
                  />
                  <BatchMetric
                    label="Cảnh báo"
                    value={activeBatch.warningCount}
                  />
                  <BatchMetric
                    label="Còn lại"
                    value={activeBatch.pendingReadyCount}
                  />
                </div>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {batchGroups.map((group) => (
                  <MetadataBatchButton
                    key={group.index}
                    group={group}
                    active={group.index === activeBatch.index}
                    onClick={() => handleSelectBatch(group)}
                  />
                ))}
              </div>
            </div>
          )}
          <ScrollArea className="h-[min(70svh,640px)] min-h-[360px]">
            <div className="flex flex-col gap-2 pr-1">
              {displayedItems.map((item) => (
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
              {Array.from({ length: visibleLoadingPlaceholderCount }).map(
                (_, i) => (
                  <div
                    key={`skel-${i}`}
                    className="h-14 animate-pulse rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]"
                  />
                )
              )}
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

function ReviewModeButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-colors",
        active
          ? "bg-[#0052FF] text-white shadow-sm"
          : "text-[#475569] hover:bg-[#EFF6FF] hover:text-[#0F172A]"
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function BatchMetric({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-full border border-[#D8E1EC] bg-[#F8FAFC] px-2 py-1">
      {label}: <strong className="text-[#0F172A]">{value}</strong>
    </span>
  )
}

function MetadataBatchButton({
  group,
  active,
  onClick,
}: {
  group: MetadataBatchGroup
  active: boolean
  onClick: () => void
}) {
  const progress =
    group.items.length > 0
      ? (group.verifiedCount / group.items.length) * 100
      : 0
  const done = group.verifiedCount === group.items.length
  const needsReview = group.warningCount > 0 || group.pendingReadyCount > 0

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${group.label}: ${group.verifiedCount}/${group.items.length} đã xác nhận`}
      className={cn(
        "min-w-[9.5rem] rounded-lg border px-3 py-2 text-left transition-colors",
        active
          ? "border-[#0052FF] bg-[#EFF6FF] text-[#0F172A] shadow-sm"
          : done
            ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300"
            : needsReview
              ? "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300"
              : "border-[#D8E1EC] bg-[#F8FAFC] text-[#475569] hover:border-[#BFD3FF]"
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold">{group.label}</span>
        <span className="text-[10px]">
          {group.verifiedCount}/{group.items.length}
        </span>
      </span>
      <span className="mt-1 block text-[10px] opacity-80">
        {group.start}-{group.end}
      </span>
      <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-white/70">
        <span
          className={cn(
            "block h-full rounded-full",
            done ? "bg-emerald-500" : "bg-[#0052FF]"
          )}
          style={{ width: `${progress}%` }}
        />
      </span>
    </button>
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
      const normalizedMetadata =
        item.normalized_metadata ?? local.normalized_metadata
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

function buildMetadataBatchGroups(
  items: PdfMetadata[],
  batchSize: number
): MetadataBatchGroup[] {
  const normalizedBatchSize = normalizeBatchSize(batchSize)
  const groups: MetadataBatchGroup[] = []

  for (let start = 0; start < items.length; start += normalizedBatchSize) {
    const groupItems = items.slice(start, start + normalizedBatchSize)
    const index = groups.length
    const verifiedCount = groupItems.filter(
      (item) => item.review_status === "verified"
    ).length
    const readyCount = groupItems.filter((item) => item.metadata_ready).length
    const warningCount = groupItems.filter(
      (item) => item.review_status !== "verified" && hasMetadataWarning(item)
    ).length
    const pendingReadyCount = groupItems.filter(
      (item) => item.metadata_ready && item.review_status !== "verified"
    ).length

    groups.push({
      index,
      label: `Lô ${String(index + 1).padStart(2, "0")}`,
      start: start + 1,
      end: start + groupItems.length,
      items: groupItems,
      readyCount,
      verifiedCount,
      warningCount,
      pendingReadyCount,
    })
  }

  return groups
}

function firstPreferredMetadataItem(items: PdfMetadata[]): PdfMetadata | null {
  return (
    items.find(
      (item) => item.review_status !== "verified" && hasMetadataWarning(item)
    ) ??
    items.find(
      (item) => item.metadata_ready && item.review_status !== "verified"
    ) ??
    items[0] ??
    null
  )
}

function normalizeBatchSize(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_METADATA_BATCH_SIZE
  return Math.min(
    MAX_METADATA_BATCH_SIZE,
    Math.max(MIN_METADATA_BATCH_SIZE, Math.round(value))
  )
}

function readStoredReviewMode(): MetadataReviewMode {
  if (typeof window === "undefined") return "list"
  try {
    return window.localStorage.getItem(REVIEW_MODE_STORAGE_KEY) === "batch"
      ? "batch"
      : "list"
  } catch {
    return "list"
  }
}

function writeStoredReviewMode(value: MetadataReviewMode) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(REVIEW_MODE_STORAGE_KEY, value)
  } catch {
    // localStorage can be unavailable in private or restricted browser contexts.
  }
}

function readStoredBatchSize(): number {
  if (typeof window === "undefined") return DEFAULT_METADATA_BATCH_SIZE
  try {
    const value = Number(window.localStorage.getItem(BATCH_SIZE_STORAGE_KEY))
    return normalizeBatchSize(value)
  } catch {
    return DEFAULT_METADATA_BATCH_SIZE
  }
}

function writeStoredBatchSize(value: number) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(
      BATCH_SIZE_STORAGE_KEY,
      String(normalizeBatchSize(value))
    )
  } catch {
    // localStorage can be unavailable in private or restricted browser contexts.
  }
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
