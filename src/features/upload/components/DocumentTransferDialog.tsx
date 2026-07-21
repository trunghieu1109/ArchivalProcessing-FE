import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Dialog } from "radix-ui"
import {
  AlertTriangle,
  ArrowRightLeft,
  Bot,
  CheckCircle2,
  FolderPlus,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  listSessionDocumentTransferTargets,
  previewSessionDocumentTransfer,
  promoteTemporaryFolderDocuments,
  suggestSessionDossierRetention,
  suggestSessionDossierTitle,
  transferSessionDocuments,
  type DocumentTransferOperationResponse,
  type DocumentTransferPreviewResponse,
  type DocumentTransferTargetSession,
  type RetentionCandidateSummary,
  type SessionDossierRetentionSuggestionResponse,
} from "@/features/upload/api/sessionApi"
import { cn } from "@/shared/lib/utils"

export interface DocumentTransferTarget {
  id: number
  name: string
}

type TransferMode = "automatic" | "temporary_dossier"

interface TemporaryDossierDraft {
  title: string
  startDate: string
  endDate: string
  retentionPeriod: string
  retentionBasis: string
}

interface RetentionCandidateOption {
  key: string
  candidate: RetentionCandidateSummary
  label: string
  basis: string
}

interface DocumentTransferDialogProps {
  open: boolean
  sourceSessionId: string | null
  targets: DocumentTransferTarget[]
  onOpenChange: (open: boolean) => void
  onMutationCompleted: (
    result: DocumentTransferOperationResponse,
    targetedDocumentIds: number[]
  ) => void | Promise<void>
}

const EMPTY_DOSSIER_DRAFT: TemporaryDossierDraft = {
  title: "",
  startDate: "",
  endDate: "",
  retentionPeriod: "",
  retentionBasis: "",
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
  const [mode, setMode] = useState<TransferMode>("automatic")
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [nextOffset, setNextOffset] = useState<number | null>(null)
  const [reason, setReason] = useState("")
  const [preview, setPreview] =
    useState<DocumentTransferPreviewResponse | null>(null)
  const [dossierDraft, setDossierDraft] =
    useState<TemporaryDossierDraft>(EMPTY_DOSSIER_DRAFT)
  const [retentionRecommendation, setRetentionRecommendation] = useState<
    Record<string, unknown>
  >({})
  const [retentionCandidates, setRetentionCandidates] = useState<
    RetentionCandidateOption[]
  >([])
  const [selectedRetentionCandidateKey, setSelectedRetentionCandidateKey] =
    useState("")
  const [completedTransfer, setCompletedTransfer] =
    useState<DocumentTransferOperationResponse | null>(null)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [loadingMoreSessions, setLoadingMoreSessions] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [suggestionError, setSuggestionError] = useState("")
  const loadedSuggestionScopeRef = useRef("")
  const suggestionRequestRef = useRef(0)
  const documentIds = useMemo(
    () => [...new Set(targets.map((target) => target.id))],
    [targets]
  )
  const documentScope = documentIds.join(",")

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
      documentIds.length === 0 ||
      completedTransfer
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
  }, [
    completedTransfer,
    documentIds,
    open,
    selectedTargetSessionId,
    sourceSessionId,
  ])

  const loadDossierSuggestions = useCallback(
    async (force = false) => {
      if (
        !sourceSessionId ||
        !selectedTargetSessionId ||
        documentIds.length === 0 ||
        !preview?.allowed
      ) {
        return
      }
      const scope = `${sourceSessionId}:${documentScope}->${selectedTargetSessionId}`
      if (!force && loadedSuggestionScopeRef.current === scope) return
      loadedSuggestionScopeRef.current = scope
      const requestId = suggestionRequestRef.current + 1
      suggestionRequestRef.current = requestId
      setLoadingSuggestions(true)
      setSuggestionError("")

      const dates = preview.documents
        .map((document) => textValue(document.issued_date))
        .filter(Boolean)
        .sort()
      setDossierDraft({
        ...EMPTY_DOSSIER_DRAFT,
        startDate: dates[0] ?? "",
        endDate: dates[dates.length - 1] ?? "",
      })
      setRetentionRecommendation({})
      setRetentionCandidates([])
      setSelectedRetentionCandidateKey("")

      const failedParts: string[] = []
      let suggestedTitle = ""
      try {
        const response = await suggestSessionDossierTitle(sourceSessionId, {
          session_document_ids: documentIds,
        })
        suggestedTitle = titleSuggestionFromResponse(response)
        if (suggestionRequestRef.current === requestId && suggestedTitle) {
          setDossierDraft((current) => ({
            ...current,
            title: suggestedTitle,
          }))
        }
      } catch (caught) {
        failedParts.push("tiêu đề")
        console.warn("Failed to suggest transfer dossier title", caught)
      }

      try {
        const response = await suggestSessionDossierRetention(
          selectedTargetSessionId,
          {
            metadata: {
              title: suggestedTitle || undefined,
              start_date: dates[0] || undefined,
              end_date: dates[dates.length - 1] || undefined,
            },
            options: { limit: 10 },
          }
        )
        if (suggestionRequestRef.current === requestId) {
          applyRetentionSuggestion(
            response,
            setRetentionRecommendation,
            setRetentionCandidates,
            setSelectedRetentionCandidateKey,
            setDossierDraft
          )
        }
      } catch (caught) {
        failedParts.push("thời hạn bảo quản và căn cứ")
        console.warn("Failed to suggest transfer dossier retention", caught)
      }

      if (suggestionRequestRef.current === requestId) {
        setSuggestionError(
          failedParts.length > 0
            ? `Chưa gợi ý được ${failedParts.join("; ")}. Bạn vẫn có thể nhập thủ công.`
            : ""
        )
        setLoadingSuggestions(false)
      }
    },
    [
      documentIds,
      documentScope,
      preview,
      selectedTargetSessionId,
      sourceSessionId,
    ]
  )

  useEffect(() => {
    if (open && mode === "temporary_dossier" && preview?.allowed) {
      const timer = window.setTimeout(() => {
        void loadDossierSuggestions()
      }, 0)
      return () => window.clearTimeout(timer)
    }
  }, [loadDossierSuggestions, mode, open, preview?.allowed])

  const selectedSession = sessions.find(
    (session) => session.session_id === selectedTargetSessionId
  )
  const blockers = preview?.blocking_jobs ?? []
  const duplicates = preview?.duplicates ?? []
  const validationErrors = preview?.validation_errors ?? []
  const sourceProjection = preview?.source_cluster_projection
  const selectedRetentionCandidate = retentionCandidates.find(
    (candidate) => candidate.key === selectedRetentionCandidateKey
  )

  const resetDialogState = () => {
    setSearch("")
    setDebouncedSearch("")
    setReason("")
    setMode("automatic")
    setCompletedTransfer(null)
    setDossierDraft(EMPTY_DOSSIER_DRAFT)
    setRetentionRecommendation({})
    setRetentionCandidates([])
    setSelectedRetentionCandidateKey("")
    setSuggestionError("")
    setError("")
    loadedSuggestionScopeRef.current = ""
    suggestionRequestRef.current += 1
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetDialogState()
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

  const createTemporaryDossier = async (
    result: DocumentTransferOperationResponse
  ) => {
    const metadata = temporaryDossierMetadata(
      dossierDraft,
      retentionRecommendation,
      selectedRetentionCandidate?.candidate
    )
    await promoteTemporaryFolderDocuments(result.target_session_id, {
      session_document_ids: result.target_session_document_ids,
      metadata,
      created_by: "document_transfer_ui",
    })
  }

  const retryTemporaryDossier = async () => {
    if (!completedTransfer) return
    setSubmitting(true)
    setError("")
    try {
      await createTemporaryDossier(completedTransfer)
      toast.success(
        `Đã tạo hồ sơ tạm từ ${completedTransfer.transferred_count} tài liệu và ghi nhận feedback.`
      )
      handleOpenChange(false)
    } catch (caught) {
      const message = transferErrorMessage(
        caught,
        "Tài liệu đã được chuyển nhưng chưa thể tạo hồ sơ tạm."
      )
      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const submitTransfer = async () => {
    if (completedTransfer) {
      await retryTemporaryDossier()
      return
    }
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
    let result: DocumentTransferOperationResponse
    try {
      result = await transferSessionDocuments(
        sourceSessionId,
        selectedTargetSessionId,
        documentIds,
        reason
      )
    } catch (caught) {
      const message = transferErrorMessage(
        caught,
        "Không thể chuyển tài liệu sang phông đích."
      )
      setError(message)
      toast.error(message)
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
      setSubmitting(false)
      return
    }

    try {
      await onMutationCompleted(result, documentIds)
    } catch (caught) {
      console.warn(
        "Transferred documents but could not refresh source UI",
        caught
      )
    }

    if (mode === "automatic") {
      toast.success(
        `Đã chuyển ${result.transferred_count} tài liệu sang ${targetSessionLabel(
          selectedSession
        )} và bắt đầu luồng phân loại tự động.`
      )
      setSubmitting(false)
      handleOpenChange(false)
      return
    }

    setCompletedTransfer(result)
    try {
      await createTemporaryDossier(result)
      toast.success(
        `Đã chuyển ${result.transferred_count} tài liệu, tạo hồ sơ tạm và ghi nhận feedback.`
      )
      setSubmitting(false)
      handleOpenChange(false)
    } catch (caught) {
      const detail = transferErrorMessage(
        caught,
        "Không thể tạo hồ sơ tạm ở phông đích."
      )
      const message = `Tài liệu đã chuyển thành công nhưng chưa tạo được hồ sơ tạm: ${detail}`
      setError(message)
      toast.error(message)
      setSubmitting(false)
    }
  }

  const chooseRetentionCandidate = (key: string) => {
    setSelectedRetentionCandidateKey(key)
    const option = retentionCandidates.find(
      (candidate) => candidate.key === key
    )
    if (!option) return
    setDossierDraft((current) => ({
      ...current,
      retentionPeriod:
        textValue(option.candidate.retention_period) || current.retentionPeriod,
      retentionBasis: option.basis || current.retentionBasis,
    }))
  }

  const transferDisabled =
    submitting ||
    loadingPreview ||
    loadingSuggestions ||
    !selectedTargetSessionId ||
    (!completedTransfer && !preview?.allowed)

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#0F172A]/50 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[92svh] w-[calc(100%-2rem)] max-w-6xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[#CBD5E1] bg-white shadow-2xl outline-none">
          <div className="flex items-start gap-3 border-b border-[#E2E8F0] px-5 py-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0052FF]">
              <ArrowRightLeft className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base font-semibold text-[#0F172A]">
                Chuyển phông tài liệu
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-[#64748B]">
                Chọn phông đích và cách xử lý các tài liệu sau khi chuyển. Tài
                liệu được giữ nguyên dữ liệu số, không upload hoặc OCR lại.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" className="size-8 p-0">
                <X className="size-4" />
                <span className="sr-only">Đóng</span>
              </Button>
            </Dialog.Close>
          </div>

          <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[minmax(280px,0.34fr)_minmax(0,0.66fr)]">
            <div className="flex min-h-0 flex-col border-b border-[#E2E8F0] bg-[#F8FAFC] lg:border-r lg:border-b-0">
              <div className="border-b border-[#E2E8F0] px-4 py-3">
                <p className="mb-2 text-xs font-semibold tracking-wide text-[#475569] uppercase">
                  1. Chọn phông đích
                </p>
                <label className="flex h-10 items-center gap-2 rounded-lg border border-[#CBD5E1] bg-white px-3 focus-within:border-[#0052FF] focus-within:ring-2 focus-within:ring-[#0052FF]/15">
                  <Search className="size-4 text-[#94A3B8]" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Tên phông hoặc mã session"
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                    disabled={Boolean(completedTransfer)}
                  />
                </label>
              </div>
              <div className="min-h-40 flex-1 overflow-y-auto p-3 lg:min-h-80">
                {loadingSessions ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#64748B]">
                    <Loader2 className="size-4 animate-spin" />
                    Đang tải danh sách phông...
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
                          onClick={() => {
                            setSelectedTargetSessionId(session.session_id)
                            setError("")
                          }}
                          disabled={Boolean(completedTransfer)}
                          className={cn(
                            "w-full rounded-xl border px-3 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-70",
                            selected
                              ? "border-[#0052FF] bg-white ring-2 ring-[#0052FF]/10"
                              : "border-[#E2E8F0] bg-white hover:border-[#BFD3FF] hover:bg-[#F8FAFF]"
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <div
                              className={cn(
                                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                                selected
                                  ? "border-[#0052FF] bg-[#0052FF] text-white"
                                  : "border-[#CBD5E1]"
                              )}
                            >
                              {selected ? (
                                <CheckCircle2 className="size-3.5" />
                              ) : null}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[#0F172A]">
                                {session.fonds_name || "Phông chưa đặt tên"}
                              </p>
                              <p className="mt-1 truncate text-xs text-[#64748B]">
                                {session.session_id}
                                {session.fonds_creator_code
                                  ? ` · ${session.fonds_creator_code}`
                                  : ""}
                              </p>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                    {nextOffset !== null ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        disabled={
                          loadingMoreSessions || Boolean(completedTransfer)
                        }
                        onClick={() => void loadMoreTargetSessions()}
                      >
                        {loadingMoreSessions ? (
                          <Loader2
                            data-icon="inline-start"
                            className="animate-spin"
                          />
                        ) : null}
                        Tải thêm
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-[#CBD5E1] bg-white px-3 py-8 text-center text-sm text-[#64748B]">
                    Không có phông đích phù hợp mà bạn được phép quản lý.
                  </p>
                )}
              </div>
            </div>

            <div className="min-h-0 overflow-y-auto px-5 py-4">
              <section>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold tracking-wide text-[#475569] uppercase">
                    Tài liệu được chọn
                  </p>
                  <span className="rounded-full bg-[#EAF1FF] px-2.5 py-1 text-xs font-semibold text-[#0052FF]">
                    {documentIds.length} tài liệu
                  </span>
                </div>
                <ul className="mt-2 max-h-24 space-y-1 overflow-y-auto rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#475569]">
                  {targets.map((target) => (
                    <li key={target.id} className="truncate">
                      {target.name}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="mt-5">
                <p className="text-xs font-semibold tracking-wide text-[#475569] uppercase">
                  2. Chọn cách xử lý
                </p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <TransferModeCard
                    selected={mode === "automatic"}
                    disabled={Boolean(completedTransfer)}
                    icon={<Bot className="size-5" />}
                    title="Tự động phân loại"
                    description="Chuyển tài liệu rồi chạy luồng phân loại tự động hiện có ở phông đích."
                    onClick={() => setMode("automatic")}
                  />
                  <TransferModeCard
                    selected={mode === "temporary_dossier"}
                    disabled={Boolean(completedTransfer)}
                    icon={<FolderPlus className="size-5" />}
                    title="Tạo hồ sơ tạm"
                    description="Chuyển tài liệu, gom thành hồ sơ tạm và ghi nhận làm feedback lập hồ sơ."
                    onClick={() => setMode("temporary_dossier")}
                  />
                </div>
              </section>

              {selectedSession ? (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-950">
                  <ArrowRightLeft className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="font-semibold">Phông đích</p>
                    <p className="mt-0.5">
                      {targetSessionLabel(selectedSession)} ·{" "}
                      {selectedSession.session_id}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-4 rounded-lg border border-dashed border-[#CBD5E1] px-3 py-5 text-center text-sm text-[#64748B]">
                  Chọn một phông ở danh sách để kiểm tra điều kiện chuyển.
                </p>
              )}

              {loadingPreview ? (
                <div className="mt-4 flex items-center gap-2 rounded-lg bg-[#F8FAFC] px-3 py-3 text-sm text-[#64748B]">
                  <Loader2 className="size-4 animate-spin" />
                  Đang kiểm tra job và tài liệu trùng lặp...
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

              {preview?.allowed && mode === "automatic" ? (
                <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-950">
                  <p className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="size-4" />
                    Sẵn sàng chuyển và phân loại tự động
                  </p>
                  <p className="mt-1 text-xs leading-5">
                    Sau khi chuyển, phông đích sẽ chạy lại luồng phân loại hiện
                    có và sử dụng cache ma trận khoảng cách đã tính.
                  </p>
                  <p className="mt-1 text-xs leading-5">
                    {sourceProjection?.status === "eligible"
                      ? "Kết quả hồ sơ ở phông nguồn cũng được cập nhật ngay từ baseline hiện tại."
                      : sourceProjection?.status === "not_applicable"
                        ? "Phông nguồn chưa có phiên bản hồ sơ nên không cần cập nhật lại."
                        : "Phông nguồn sẽ được đánh dấu cần cập nhật nếu baseline hiện tại không thể chiếu lại."}
                  </p>
                </div>
              ) : null}

              {preview?.allowed && mode === "temporary_dossier" ? (
                <TemporaryDossierForm
                  draft={dossierDraft}
                  loading={loadingSuggestions}
                  suggestionError={suggestionError}
                  candidates={retentionCandidates}
                  selectedCandidateKey={selectedRetentionCandidateKey}
                  disabled={submitting}
                  onChange={setDossierDraft}
                  onSelectCandidate={chooseRetentionCandidate}
                  onRefresh={() => void loadDossierSuggestions(true)}
                />
              ) : null}

              {completedTransfer ? (
                <WarningBox title="Tài liệu đã chuyển, hồ sơ tạm chưa được tạo">
                  <li>
                    Không chuyển lại tài liệu. Hãy kiểm tra metadata rồi bấm
                    “Thử tạo hồ sơ tạm lại”.
                  </li>
                  <li>
                    Session đích: {completedTransfer.target_session_id} · thao
                    tác {completedTransfer.operation_id}
                  </li>
                </WarningBox>
              ) : null}

              {error ? (
                <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
                  {error}
                </p>
              ) : null}

              <label className="mt-4 block text-xs font-medium text-[#475569]">
                Lý do chuyển (không bắt buộc)
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={2}
                  disabled={Boolean(completedTransfer)}
                  className="mt-1 w-full resize-none rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/15 disabled:bg-[#F1F5F9]"
                />
              </label>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[#64748B]">
              {mode === "temporary_dossier"
                ? "Hồ sơ tạm sẽ được ghi nhận bằng cơ chế feedback hiện có."
                : "Chế độ phân loại tự động sử dụng nguyên luồng hiện tại."}
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Dialog.Close asChild>
                <Button variant="outline" disabled={submitting}>
                  Đóng
                </Button>
              </Dialog.Close>
              <Button
                onClick={() => void submitTransfer()}
                disabled={transferDisabled}
              >
                {submitting ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                ) : mode === "temporary_dossier" ? (
                  <FolderPlus data-icon="inline-start" />
                ) : (
                  <ArrowRightLeft data-icon="inline-start" />
                )}
                {completedTransfer
                  ? "Thử tạo hồ sơ tạm lại"
                  : mode === "temporary_dossier"
                    ? "Chuyển và tạo hồ sơ tạm"
                    : "Chuyển và tự động phân loại"}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function TransferModeCard({
  selected,
  disabled,
  icon,
  title,
  description,
  onClick,
}: {
  selected: boolean
  disabled: boolean
  icon: React.ReactNode
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-70",
        selected
          ? "border-[#0052FF] bg-[#F3F7FF] ring-2 ring-[#0052FF]/10"
          : "border-[#CBD5E1] bg-white hover:border-[#8CB2FF]"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            selected ? "bg-[#0052FF] text-white" : "bg-[#F1F5F9] text-[#475569]"
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#0F172A]">{title}</p>
          <p className="mt-1 text-xs leading-5 text-[#64748B]">{description}</p>
        </div>
      </div>
    </button>
  )
}

function TemporaryDossierForm({
  draft,
  loading,
  suggestionError,
  candidates,
  selectedCandidateKey,
  disabled,
  onChange,
  onSelectCandidate,
  onRefresh,
}: {
  draft: TemporaryDossierDraft
  loading: boolean
  suggestionError: string
  candidates: RetentionCandidateOption[]
  selectedCandidateKey: string
  disabled: boolean
  onChange: (draft: TemporaryDossierDraft) => void
  onSelectCandidate: (key: string) => void
  onRefresh: () => void
}) {
  const updateField = (field: keyof TemporaryDossierDraft, value: string) => {
    onChange({ ...draft, [field]: value })
  }

  return (
    <section className="mt-4 rounded-xl border border-violet-200 bg-violet-50/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-[#0F172A]">
            <Sparkles className="size-4 text-violet-600" />
            Thông tin hồ sơ tạm
          </p>
          <p className="mt-1 text-xs text-[#64748B]">
            Kiểm tra và chỉnh lại gợi ý trước khi chuyển tài liệu.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || disabled}
          onClick={onRefresh}
        >
          {loading ? (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          ) : (
            <RefreshCw data-icon="inline-start" />
          )}
          Gợi ý lại
        </Button>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-white px-3 py-3 text-sm text-[#64748B]">
          <Loader2 className="size-4 animate-spin text-violet-600" />
          Đang gợi ý tiêu đề, thời gian và thời hạn bảo quản...
        </div>
      ) : null}

      {suggestionError ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {suggestionError}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <FieldLabel>Tiêu đề hồ sơ</FieldLabel>
          <textarea
            value={draft.title}
            onChange={(event) => updateField("title", event.target.value)}
            rows={2}
            disabled={disabled}
            className="mt-1 w-full resize-none rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/15 disabled:bg-[#F1F5F9]"
          />
        </label>
        <label>
          <FieldLabel>Thời gian bắt đầu</FieldLabel>
          <input
            value={draft.startDate}
            onChange={(event) => updateField("startDate", event.target.value)}
            disabled={disabled}
            className="mt-1 h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/15 disabled:bg-[#F1F5F9]"
          />
        </label>
        <label>
          <FieldLabel>Thời gian kết thúc</FieldLabel>
          <input
            value={draft.endDate}
            onChange={(event) => updateField("endDate", event.target.value)}
            disabled={disabled}
            className="mt-1 h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/15 disabled:bg-[#F1F5F9]"
          />
        </label>
        <label className="sm:col-span-2">
          <FieldLabel>Thời hạn bảo quản</FieldLabel>
          <input
            value={draft.retentionPeriod}
            onChange={(event) =>
              updateField("retentionPeriod", event.target.value)
            }
            disabled={disabled}
            className="mt-1 h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/15 disabled:bg-[#F1F5F9]"
          />
        </label>
        {candidates.length > 1 ? (
          <label className="sm:col-span-2">
            <FieldLabel>Chọn căn cứ được gợi ý</FieldLabel>
            <select
              value={selectedCandidateKey}
              onChange={(event) => onSelectCandidate(event.target.value)}
              disabled={disabled}
              className="mt-1 h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/15 disabled:bg-[#F1F5F9]"
            >
              {candidates.map((candidate) => (
                <option key={candidate.key} value={candidate.key}>
                  {candidate.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="sm:col-span-2">
          <FieldLabel>Căn cứ thời hạn bảo quản</FieldLabel>
          <textarea
            value={draft.retentionBasis}
            onChange={(event) =>
              updateField("retentionBasis", event.target.value)
            }
            rows={2}
            disabled={disabled}
            className="mt-1 w-full resize-none rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/15 disabled:bg-[#F1F5F9]"
          />
        </label>
      </div>
    </section>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-xs font-medium text-[#475569]">{children}</span>
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
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5">
        {children}
      </ul>
    </div>
  )
}

function applyRetentionSuggestion(
  response: SessionDossierRetentionSuggestionResponse,
  setRecommendation: (value: Record<string, unknown>) => void,
  setCandidates: (value: RetentionCandidateOption[]) => void,
  setSelectedCandidateKey: (value: string) => void,
  setDraft: React.Dispatch<React.SetStateAction<TemporaryDossierDraft>>
) {
  const recommendation = retentionRecommendationFromResponse(response)
  const candidates = retentionCandidateOptions(response)
  const recommendedEntryId = textValue(recommendation.entry_id)
  const selectedCandidate =
    candidates.find(
      (option) => option.candidate.entry_id === recommendedEntryId
    ) ?? candidates[0]
  const retentionPeriod =
    textValue(selectedCandidate?.candidate.retention_period) ||
    textValue(recommendation.retention_period)
  const retentionBasis =
    selectedCandidate?.basis || retentionBasisLabel(recommendation)

  setRecommendation(recommendation)
  setCandidates(candidates)
  setSelectedCandidateKey(selectedCandidate?.key ?? "")
  setDraft((current) => ({
    ...current,
    retentionPeriod,
    retentionBasis,
  }))
}

function temporaryDossierMetadata(
  draft: TemporaryDossierDraft,
  baseRecommendation: Record<string, unknown>,
  selectedCandidate?: RetentionCandidateSummary
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {}
  const title = draft.title.trim()
  const startDate = draft.startDate.trim()
  const endDate = draft.endDate.trim()
  const retentionPeriod = draft.retentionPeriod.trim()
  const retentionBasis = draft.retentionBasis.trim()
  if (title) metadata.title = title
  if (startDate) metadata.start_date = startDate
  if (endDate) metadata.end_date = endDate
  if (retentionPeriod) metadata.retention_period = retentionPeriod

  const recommendation: Record<string, unknown> = {
    ...baseRecommendation,
    ...(selectedCandidate ?? {}),
  }
  if (retentionPeriod) recommendation.retention_period = retentionPeriod
  if (retentionBasis) recommendation.basis_override = retentionBasis
  if (Object.keys(recommendation).length > 0) {
    metadata.retention_recommendation = recommendation
  }
  return metadata
}

function retentionCandidateOptions(
  response: SessionDossierRetentionSuggestionResponse
): RetentionCandidateOption[] {
  const topLevelCandidates = Array.isArray(response.candidates)
    ? response.candidates
    : []
  const versionCandidates = Array.isArray(response.versions)
    ? [...response.versions]
        .reverse()
        .flatMap((version) => version.candidates ?? [])
    : []
  const seen = new Set<string>()
  return [...topLevelCandidates, ...versionCandidates]
    .filter((candidate) => {
      const key = textValue(candidate.entry_id)
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((candidate, index) => {
      const basis = retentionBasisLabel(candidate)
      const period = textValue(candidate.retention_period)
      return {
        key: `${candidate.entry_id}:${index}`,
        candidate,
        basis,
        label:
          [period, basis].filter(Boolean).join(" · ") || candidate.entry_id,
      }
    })
}

function retentionRecommendationFromResponse(
  response: SessionDossierRetentionSuggestionResponse
): Record<string, unknown> {
  const recommendation = {
    ...plainObject(
      response.recommendation ?? response.retention_recommendation
    ),
  }
  if (response.candidates.length > 0) {
    recommendation.candidates = response.candidates
  }
  if (response.versions?.length) recommendation.versions = response.versions
  if (response.active_candidate_version_id) {
    recommendation.active_candidate_version_id =
      response.active_candidate_version_id
  }
  recommendation.candidate_count = response.candidate_count
  recommendation.candidates_truncated = response.candidates_truncated
  if (response.plan_version_id) {
    recommendation.plan_version_id = response.plan_version_id
  }
  recommendation.status = response.status
  return recommendation
}

function retentionBasisLabel(input: unknown): string {
  const value = plainObject(input)
  const sourceUnit = textValue(
    value.source_unit_index ?? value.unit_index ?? value.source_row_index
  )
  const appendix = textValue(value.appendix_name ?? value.appendix)
  const sourceName = textValue(value.source_file_name ?? value.file_name)
  const parts = [
    sourceUnit ? `Điều ${sourceUnit}` : "",
    appendix
      ? appendix.toLocaleLowerCase("vi").startsWith("phụ lục")
        ? appendix
        : `Phụ lục ${appendix}`
      : "",
    sourceName
      ? sourceName.toLocaleLowerCase("vi").startsWith("thông tư")
        ? sourceName
        : `Thông tư ${sourceName}`
      : "",
  ].filter(Boolean)
  return parts.join(" | ") || textValue(value.breadcrumb)
}

function titleSuggestionFromResponse(response: unknown): string {
  const suggestions = plainObject(response).suggestions
  if (!Array.isArray(suggestions)) return ""
  for (const suggestion of suggestions) {
    const title = textValue(plainObject(suggestion).title)
    if (title) return title
  }
  return ""
}

function plainObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return { ...(value as Record<string, unknown>) }
}

function textValue(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return ""
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
