import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { cn } from "@/shared/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import {
  verifyDocumentMetadata,
  type SessionDocumentResponse,
} from "@/features/upload/api/sessionApi"
import { MetadataCard, getWarningFields } from "./MetadataCard"
import type { ClusterGroup } from "@/features/upload/lib/clusterGroups"
import type { PdfMetadata } from "@/features/upload/types"

interface ProcessStepProps {
  sessionId: string | null
  pdfPaths: string[]
  metadataItems?: PdfMetadata[]
  metadataLoading?: boolean
  metadataMessage?: string
  onContinue: (groups: ClusterGroup[]) => void
}

export function ProcessStep({
  sessionId,
  pdfPaths,
  metadataItems = [],
  metadataLoading = false,
  metadataMessage = "Đang chờ kết quả số hóa từ backend...",
  onContinue,
}: ProcessStepProps) {
  const [items, setItems] = useState<PdfMetadata[]>([])
  const [verifyingIds, setVerifyingIds] = useState<Set<number>>(() => new Set())
  const [bulkVerifying, setBulkVerifying] = useState(false)

  const metadataKey = useMemo(
    () =>
      metadataItems
        .map(
          (item) =>
            `${item.id}:${item.status}:${item.review_status}:${String(item.metadata_ready)}:${String(item.metadata_final)}`
        )
        .join("\n"),
    [metadataItems]
  )

  useEffect(() => {
    setItems((previous) => mergeIncomingMetadata(previous, metadataItems))
  }, [metadataItems, metadataKey])

  const paths = useMemo(
    () => (metadataItems.length > 0 ? metadataItems.map((item) => item.data_path) : pdfPaths),
    [metadataItems, pdfPaths]
  )

  const readyItems = useMemo(
    () => items.filter((item) => item.metadata_ready),
    [items]
  )
  const pendingReadyItems = useMemo(
    () => readyItems.filter((item) => item.review_status !== "verified"),
    [readyItems]
  )

  const handleApply = async (dataPath: string, meta: Record<string, unknown>) => {
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
      if (allReadyItemsVerified(nextItems)) {
        onContinue([])
      }
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
          verifyDocumentMetadata(sessionId, item.id, item.light_metadata)
        )
      )
      const verified = results
        .filter((result): result is PromiseFulfilledResult<SessionDocumentResponse> =>
          result.status === "fulfilled"
        )
        .map((result) => result.value)
      if (verified.length > 0) {
        const nextItems = replaceVerifiedDocuments(items, verified)
        setItems(nextItems)
        if (allReadyItemsVerified(nextItems)) {
          onContinue([])
        }
      }

      const failedCount = results.length - verified.length
      if (failedCount > 0) {
        toast.error(`${failedCount} tài liệu chưa xác nhận được. Vui lòng kiểm tra lại.`)
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

  const warningCount = items.filter(
    (item) =>
      getWarningFields(item.light_metadata).size > 0 &&
      item.review_status !== "verified"
  ).length
  const loadingPlaceholderCount = Math.max(
    metadataLoading && items.length === 0 ? 1 : 0,
    Math.max(paths.length - items.length, 0)
  )
  const canContinue = readyItems.length > 0 && pendingReadyItems.length === 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl text-foreground">Xử lý & lập hồ sơ</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Metadata được lấy từ backend. Sau khi metadata được xác nhận, màn hình sẽ chuyển sang kết quả lập hồ sơ.
          </p>
        </div>
        {warningCount > 0 && (
          <div className="shrink-0 text-right">
            <p className="font-roboto text-[11px] text-amber-600">Cần kiểm tra</p>
            <p className="text-xl font-bold text-amber-600">{warningCount}</p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="font-roboto text-[11px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">
            Metadata tài liệu
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {metadataLoading && (
              <span className="flex items-center gap-1.5 text-xs text-[#64748B]">
                <Loader2 className="size-3 animate-spin text-[#0052FF]" />
                Đang tải {items.length}/{Math.max(paths.length, items.length)}
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
        <ScrollArea className="h-[520px]">
          <div className="flex flex-col gap-2 pr-1">
            {[...items]
              .sort((a, b) => metadataSortScore(a) - metadataSortScore(b))
              .map((item) => (
                <MetadataCard
                  key={item.id}
                  item={item}
                  submitting={verifyingIds.has(item.id)}
                  onApply={handleApply}
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

      <div className="flex items-center justify-between rounded-2xl border border-[#CBD5E1] bg-white px-6 py-4 shadow-sm">
        <div className="text-sm text-[#475569]">
          {pendingReadyItems.length > 0 ? (
            <span className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="size-4" />
              Còn {pendingReadyItems.length} tài liệu cần xác nhận metadata.
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
            "group flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all duration-200",
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
          Xem kết quả
        </button>
      </div>
    </motion.div>
  )
}

function mergeIncomingMetadata(
  previous: PdfMetadata[],
  incoming: PdfMetadata[]
): PdfMetadata[] {
  const previousById = new Map(previous.map((item) => [item.id, item]))
  return incoming.map((item) => {
    const local = previousById.get(item.id)
    if (local?.review_status === "verified" && item.review_status !== "verified") {
      return local
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

function documentResponseToPdfMetadata(document: SessionDocumentResponse): PdfMetadata {
  return {
    id: document.id,
    document_id: document.document_id,
    data_path: document.data_path,
    status: document.ocr_status,
    review_status: document.review_status,
    metadata_ready: document.metadata_ready,
    metadata_final: document.metadata_final,
    light_metadata:
      document.normalized_metadata ?? document.metadata ?? document.raw_metadata ?? {},
    applied: document.review_status === "verified",
  }
}

function metadataSortScore(item: PdfMetadata): number {
  if (item.review_status === "verified") return 3
  if (getWarningFields(item.light_metadata).size > 0) return 0
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

function allReadyItemsVerified(items: PdfMetadata[]): boolean {
  const readyItems = items.filter((item) => item.metadata_ready)
  return readyItems.length > 0 && readyItems.every((item) => item.review_status === "verified")
}
