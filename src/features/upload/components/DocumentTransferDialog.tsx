import { useEffect, useMemo, useState } from "react"
import { Dialog } from "radix-ui"
import { AlertTriangle, ArrowRightLeft, Loader2, Search, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  listSessionDocumentTransferTargets,
  previewSessionDocumentTransfer,
  transferSessionDocuments,
  type DocumentTransferOperationResponse,
  type DocumentTransferPreviewResponse,
  type DocumentTransferTargetSession,
} from "@/features/upload/api/sessionApi"
import { cn } from "@/shared/lib/utils"

export interface DocumentTransferTarget {
  id: number
  name: string
}

interface DocumentTransferDialogProps {
  open: boolean
  sourceSessionId: string | null
  targets: DocumentTransferTarget[]
  onOpenChange: (open: boolean) => void
  onMutationCompleted: (
    result: DocumentTransferOperationResponse,
    targetedDocumentIds: number[]
  ) => void
}

export function DocumentTransferDialog({
  open,
  sourceSessionId,
  targets,
  onOpenChange,
  onMutationCompleted,
}: DocumentTransferDialogProps) {
  const [sessions, setSessions] = useState<DocumentTransferTargetSession[]>([])
  const [selectedTargetSessionId, setSelectedTargetSessionId] = useState("")
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [reason, setReason] = useState("")
  const [preview, setPreview] =
    useState<DocumentTransferPreviewResponse | null>(null)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [loadingMoreSessions, setLoadingMoreSessions] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const documentIds = useMemo(
    () => [...new Set(targets.map((target) => target.id))],
    [targets]
  )

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, 300)
    return () => window.clearTimeout(timer)
  }, [open, search])

  useEffect(() => {
    if (!open || !sourceSessionId) return
    let cancelled = false
    const loadTargetSessions = async () => {
      await Promise.resolve()
      if (cancelled) return
      setLoadingSessions(true)
      setSessions([])
      setSelectedTargetSessionId("")
      setNextOffset(null)
      setPreview(null)
      setError("")
      try {
        const response = await listSessionDocumentTransferTargets(
          sourceSessionId,
          { q: debouncedSearch, limit: 50, offset: 0 }
        )
        if (cancelled) return
        setSessions(response.targets)
        setNextOffset(response.pagination.next_offset ?? null)
      } catch (caught) {
        if (!cancelled) {
          setError(
            transferErrorMessage(caught, "Không thể tải danh sách phông đích.")
          )
        }
      } finally {
        if (!cancelled) setLoadingSessions(false)
      }
    }
    void loadTargetSessions()
    return () => {
      cancelled = true
    }
  }, [debouncedSearch, open, sourceSessionId])

  useEffect(() => {
    if (
      !open ||
      !sourceSessionId ||
      !selectedTargetSessionId ||
      documentIds.length === 0
    ) {
      return
    }
    let cancelled = false
    const loadPreview = async () => {
      await Promise.resolve()
      if (cancelled) return
      setLoadingPreview(true)
      setPreview(null)
      setError("")
      try {
        const response = await previewSessionDocumentTransfer(
          sourceSessionId,
          selectedTargetSessionId,
          documentIds
        )
        if (!cancelled) setPreview(response)
      } catch (caught) {
        if (!cancelled) {
          setError(
            transferErrorMessage(
              caught,
              "Không thể kiểm tra điều kiện chuyển phông."
            )
          )
        }
      } finally {
        if (!cancelled) setLoadingPreview(false)
      }
    }
    void loadPreview()
    return () => {
      cancelled = true
    }
  }, [documentIds, open, selectedTargetSessionId, sourceSessionId])

  const selectedSession = sessions.find(
    (session) => session.session_id === selectedTargetSessionId
  )
  const blockers = preview?.blocking_jobs ?? []
  const duplicates = preview?.duplicates ?? []
  const validationErrors = preview?.validation_errors ?? []
  const sourceProjection = preview?.source_cluster_projection

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSearch("")
      setDebouncedSearch("")
      setReason("")
    }
    onOpenChange(nextOpen)
  }

  const loadMoreTargetSessions = async () => {
    if (!sourceSessionId || nextOffset === null || loadingMoreSessions) return
    setLoadingMoreSessions(true)
    setError("")
    try {
      const response = await listSessionDocumentTransferTargets(
        sourceSessionId,
        { q: debouncedSearch, limit: 50, offset: nextOffset }
      )
      setSessions((current) => [
        ...current,
        ...response.targets.filter(
          (target) =>
            !current.some(
              (candidate) => candidate.session_id === target.session_id
            )
        ),
      ])
      setNextOffset(response.pagination.next_offset ?? null)
    } catch (caught) {
      setError(
        transferErrorMessage(caught, "Không thể tải thêm danh sách phông đích.")
      )
    } finally {
      setLoadingMoreSessions(false)
    }
  }

  const submitTransfer = async () => {
    if (
      !sourceSessionId ||
      !selectedTargetSessionId ||
      !preview?.allowed ||
      documentIds.length === 0
    ) {
      return
    }
    setSubmitting(true)
    setError("")
    try {
      const result = await transferSessionDocuments(
        sourceSessionId,
        selectedTargetSessionId,
        documentIds,
        reason
      )
      onMutationCompleted(result, documentIds)
      toast.success(
        `Đã chuyển ${result.transferred_count} tài liệu sang ${targetSessionLabel(
          selectedSession
        )}.`
      )
      handleOpenChange(false)
    } catch (caught) {
      const message = transferErrorMessage(
        caught,
        "Không thể chuyển tài liệu sang phông đích."
      )
      setError(message)
      toast.error(message)
      if (sourceSessionId && selectedTargetSessionId) {
        try {
          const nextPreview = await previewSessionDocumentTransfer(
            sourceSessionId,
            selectedTargetSessionId,
            documentIds
          )
          setPreview(nextPreview)
        } catch {
          // Keep the mutation error; the user can close and reopen to retry preview.
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#0F172A]/50 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[90svh] w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-[#CBD5E1] bg-white shadow-2xl outline-none">
          <div className="flex items-start gap-3 border-b border-[#E2E8F0] px-5 py-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#0052FF]">
              <ArrowRightLeft className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base font-semibold text-[#0F172A]">
                Chuyển phông tài liệu
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-[#64748B]">
                Tài liệu được tham chiếu sang session đích, không upload và
                không OCR lại. Phông nguồn sẽ tự loại tài liệu khỏi phiên bản
                hiện tại khi baseline đủ điều kiện; phông đích vẫn cần cập nhật
                hồ sơ thủ công.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" className="size-8 p-0">
                <X className="size-4" />
                <span className="sr-only">Đóng</span>
              </Button>
            </Dialog.Close>
          </div>

          <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)]">
            <div className="flex min-h-0 flex-col border-b border-[#E2E8F0] lg:border-r lg:border-b-0">
              <div className="border-b border-[#E2E8F0] px-4 py-3">
                <label className="flex h-10 items-center gap-2 rounded-lg border border-[#CBD5E1] bg-white px-3 focus-within:border-[#0052FF] focus-within:ring-2 focus-within:ring-[#0052FF]/15">
                  <Search className="size-4 text-[#94A3B8]" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Tìm theo tên phông hoặc mã session"
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                  />
                </label>
              </div>
              <div className="min-h-40 flex-1 overflow-y-auto p-3 lg:min-h-80">
                {loadingSessions ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#64748B]">
                    <Loader2 className="size-4 animate-spin" />
                    Đang tải danh sách session...
                  </div>
                ) : sessions.length > 0 ? (
                  <div className="space-y-2">
                    {sessions.map((session) => {
                      const selected =
                        session.session_id === selectedTargetSessionId
                      return (
                        <button
                          key={session.session_id}
                          type="button"
                          onClick={() =>
                            setSelectedTargetSessionId(session.session_id)
                          }
                          className={cn(
                            "w-full rounded-xl border px-3 py-3 text-left transition-colors",
                            selected
                              ? "border-[#0052FF] bg-[#F3F7FF] ring-2 ring-[#0052FF]/10"
                              : "border-[#E2E8F0] bg-white hover:border-[#BFD3FF] hover:bg-[#F8FAFF]"
                          )}
                        >
                          <p className="truncate text-sm font-semibold text-[#0F172A]">
                            {session.fonds_name || "Phông chưa đặt tên"}
                          </p>
                          <p className="mt-1 truncate text-xs text-[#64748B]">
                            {session.session_id}
                            {session.fonds_creator_code
                              ? ` · ${session.fonds_creator_code}`
                              : ""}
                          </p>
                        </button>
                      )
                    })}
                    {nextOffset !== null ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        disabled={loadingMoreSessions}
                        onClick={() => void loadMoreTargetSessions()}
                      >
                        {loadingMoreSessions ? (
                          <Loader2 data-icon="inline-start" className="animate-spin" />
                        ) : null}
                        Tải thêm
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-3 py-8 text-center text-sm text-[#64748B]">
                    Không có session đích phù hợp mà bạn được phép quản lý.
                  </p>
                )}
              </div>
            </div>

            <div className="min-h-0 overflow-y-auto px-5 py-4">
              <p className="text-sm font-semibold text-[#0F172A]">
                {targets.length} tài liệu được chọn
              </p>
              <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#475569]">
                {targets.map((target) => (
                  <li key={target.id} className="truncate">
                    {target.name}
                  </li>
                ))}
              </ul>

              {selectedSession ? (
                <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-950">
                  <p className="font-semibold">Phông đích</p>
                  <p className="mt-1">
                    {targetSessionLabel(selectedSession)} ·{" "}
                    {selectedSession.session_id}
                  </p>
                </div>
              ) : (
                <p className="mt-4 rounded-lg border border-dashed border-[#CBD5E1] px-3 py-5 text-center text-sm text-[#64748B]">
                  Chọn một session ở danh sách để kiểm tra điều kiện chuyển.
                </p>
              )}

              {loadingPreview ? (
                <div className="mt-4 flex items-center gap-2 rounded-lg bg-[#F8FAFC] px-3 py-3 text-sm text-[#64748B]">
                  <Loader2 className="size-4 animate-spin" />
                  Đang kiểm tra job, trùng lặp và phạm vi ảnh hưởng...
                </div>
              ) : null}

              {blockers.length > 0 ? (
                <WarningBox title="Chưa thể chuyển vì có job đang chạy">
                  {blockers.map((blocker, index) => (
                    <li
                      key={`${blocker.session_id}-${blocker.job_id ?? index}`}
                    >
                      {blocker.session_role === "target"
                        ? "Phông đích"
                        : "Phông nguồn"}
                      {" · "}
                      {jobTypeLabel(blocker.job_type)} · {blocker.status}
                    </li>
                  ))}
                </WarningBox>
              ) : null}

              {validationErrors.length > 0 ? (
                <WarningBox title="Có tài liệu chưa đủ điều kiện chuyển">
                  {validationErrors.map((item) => (
                    <li key={`${item.code}-${item.session_document_id}`}>
                      #{item.session_document_id}:{" "}
                      {validationErrorLabel(item.code)}
                    </li>
                  ))}
                </WarningBox>
              ) : null}

              {duplicates.length > 0 ? (
                <WarningBox title="Phông đích đã có tài liệu trùng">
                  {duplicates.map((item) => (
                    <li key={item.target_session_document_id}>
                      {item.file_name} · {item.match_types.join(", ")}
                    </li>
                  ))}
                </WarningBox>
              ) : null}

              {preview?.allowed ? (
                <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-950">
                  <p className="font-semibold">Có thể chuyển phông</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                    <li>File và remote document ID được giữ nguyên.</li>
                    <li>Không gọi API chuyển/xóa/upload bên Chỉnh lý.</li>
                    <li>
                      Tài liệu ở phông đích không thể chạy lại OCR/extract
                      metadata.
                    </li>
                    <li>
                      {sourceProjection?.status === "eligible"
                        ? "Phông nguồn sẽ tạo ngay một phiên bản cập nhật, không chạy lại thuật toán lập hồ sơ."
                        : sourceProjection?.status === "not_applicable"
                          ? "Phông nguồn chưa có phiên bản hồ sơ nên không cần cập nhật lại."
                          : "Baseline nguồn chưa đủ điều kiện projection; phông nguồn sẽ được đánh dấu cần cập nhật hồ sơ."}
                    </li>
                    <li>
                      Phông đích coi các tài liệu này là tài liệu mới và chỉ đưa
                      vào hồ sơ/matrix khi người dùng chủ động cập nhật hồ sơ.
                    </li>
                  </ul>
                </div>
              ) : null}

              {error ? (
                <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </p>
              ) : null}

              <label className="mt-4 block text-xs font-medium text-[#475569]">
                Lý do chuyển (không bắt buộc)
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={2}
                  className="mt-1 w-full resize-none rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/15"
                />
              </label>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3 sm:flex-row sm:justify-end">
            <Dialog.Close asChild>
              <Button variant="outline" disabled={submitting}>
                Đóng
              </Button>
            </Dialog.Close>
            <Button
              onClick={() => void submitTransfer()}
              disabled={
                submitting ||
                loadingPreview ||
                !selectedTargetSessionId ||
                !preview?.allowed
              }
            >
              {submitting ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <ArrowRightLeft data-icon="inline-start" />
              )}
              Chuyển tới session này
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function WarningBox({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
      <p className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="size-4" />
        {title}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">{children}</ul>
    </div>
  )
}

function targetSessionLabel(
  session: DocumentTransferTargetSession | undefined
): string {
  return session?.fonds_name || session?.archive_name || "Phông chưa đặt tên"
}

function jobTypeLabel(jobType: string): string {
  return (
    {
      build_clusters: "Lập hồ sơ",
      refresh_dossier_classification: "Cập nhật phân loại hồ sơ",
      number_documents: "Đánh số tài liệu",
      finalize_artifacts: "Tạo mục lục",
      build_publication_archive: "Tạo gói xuất bản",
      poll_ingestion_extract: "Giải nén dữ liệu đầu vào",
      start_digitization: "Bắt đầu số hóa",
      poll_digitization: "Theo dõi số hóa",
      process_digitization_document: "OCR tài liệu",
      sync_digitization_document_metadata: "Đồng bộ metadata",
      refresh_final_metadata: "Cập nhật metadata cuối",
      document_mutation: "Thay đổi tập tài liệu",
    }[jobType] ?? jobType
  )
}

function validationErrorLabel(code: string): string {
  return (
    {
      DOCUMENT_NOT_ACTIVE: "Tài liệu không còn active.",
      REMOTE_REFERENCE_MISSING: "Thiếu remote batch/document ID.",
      METADATA_NOT_READY: "Metadata chưa sẵn sàng.",
      METADATA_NOT_FINAL: "Metadata chưa hoàn tất.",
      METADATA_NOT_VERIFIED: "Metadata chưa được xác nhận.",
    }[code] ?? code
  )
}

function transferErrorMessage(caught: unknown, fallback: string): string {
  if (!(caught instanceof Error) || !caught.message) return fallback
  try {
    const detail = JSON.parse(caught.message) as {
      message?: unknown
      detail?: unknown
    }
    if (typeof detail.message === "string" && detail.message.trim()) {
      return detail.message
    }
    if (typeof detail.detail === "string" && detail.detail.trim()) {
      return detail.detail
    }
  } catch {
    // The request helper can also return a plain text message.
  }
  return caught.message
}
