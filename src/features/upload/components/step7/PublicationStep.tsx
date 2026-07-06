import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Archive,
  Box,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Edit2,
  FileText,
  Folder,
  FolderOpen,
  Loader2,
  RefreshCw,
  Search,
  TriangleAlert,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { PaginationControls } from "@/features/upload/components/PaginationControls"
import {
  downloadPublicationArchiveArtifact,
  downloadPublicationDocument,
  enqueuePublicationArchive,
  getPublicationArchiveStatus,
  getPublicationManifest,
  updatePublicationName,
  type PublicationArchiveScope,
  type PublicationBox,
  type PublicationDossier,
  type PublicationManifest,
} from "@/features/upload/api/sessionApi"
import { visibleAwareDelay } from "@/shared/lib/pageVisibility"
import { cn } from "@/shared/lib/utils"

interface PublicationStepProps {
  sessionId: string | null
}

const PUBLICATION_ARCHIVE_POLL_MS = 5_000
const PUBLICATION_ARCHIVE_TIMEOUT_MS = 30 * 60 * 1000
const PUBLICATION_ARCHIVE_FAILED_STATUSES = new Set([
  "failed",
  "dead",
  "cancelled",
  "canceled",
])
const DEFAULT_FONDS_LABEL = "Chưa đặt tên phông"
const DEFAULT_RETENTION_GROUPS = [
  "Vĩnh viễn",
  "Có thời hạn",
  "Tài liệu loại",
]

export function PublicationStep({ sessionId }: PublicationStepProps) {
  const [manifest, setManifest] = useState<PublicationManifest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [downloadingKey, setDownloadingKey] = useState("")
  const [collapsedBoxes, setCollapsedBoxes] = useState<Set<string>>(
    () => new Set()
  )
  const [collapsedDossiers, setCollapsedDossiers] = useState<Set<number>>(
    () => new Set()
  )
  const [editingName, setEditingName] = useState<{
    type: "box" | "dossier" | "document"
    id: string | number
    value: string
  } | null>(null)
  const [savingNameKey, setSavingNameKey] = useState("")
  const [dossierPageByBox, setDossierPageByBox] = useState<
    Record<string, number>
  >({})
  const [documentPageByDossier, setDocumentPageByDossier] = useState<
    Record<number, number>
  >({})
  const [dossierPageSize, setDossierPageSize] = useState(25)
  const [documentPageSize, setDocumentPageSize] = useState(100)
  const [publicationSearch, setPublicationSearch] = useState("")
  const [publicationSearchIndex, setPublicationSearchIndex] = useState(0)
  const activeDownloadKeyRef = useRef("")

  const refresh = useCallback(async () => {
    if (!sessionId) {
      setManifest(null)
      setError("Chưa có session để xuất bản.")
      setLoading(false)
      return
    }
    setLoading(true)
    setError("")
    try {
      const response = await getPublicationManifest(sessionId)
      setManifest(response)
      if (response.reused) {
        toast.info("Đang sử dụng lại cấu trúc xuất bản hiện có.")
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không thể chuẩn bị cấu trúc xuất bản."
      )
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void refresh(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [refresh])

  const download = useCallback(
    async (
      key: string,
      action: () => Promise<{ blob: Blob; fileName: string }>
    ) => {
      if (activeDownloadKeyRef.current) return
      activeDownloadKeyRef.current = key
      setDownloadingKey(key)
      setError("")
      try {
        const result = await action()
        saveBlob(result.blob, result.fileName)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Không thể tải tệp xuất bản."
        setError(message)
        toast.error(message)
      } finally {
        activeDownloadKeyRef.current = ""
        setDownloadingKey("")
      }
    },
    []
  )

  const downloadArchive = useCallback(
    async (key: string, scope: PublicationArchiveScope) => {
      if (!sessionId) return
      if (activeDownloadKeyRef.current) return
      activeDownloadKeyRef.current = key
      setDownloadingKey(key)
      setError("")
      try {
        let status = await getPublicationArchiveStatus(sessionId, scope)
        if (!status.artifact) {
          if (status.active) {
            toast.info("ZIP xuất bản đang được tạo, sẽ tải khi hoàn tất.")
          } else {
            await enqueuePublicationArchive(sessionId, scope)
            toast.info("Đã đưa ZIP xuất bản vào hàng đợi.")
          }
          status = await waitForPublicationArchive(sessionId, scope)
        }
        const artifactId = status.artifact?.artifact_id ?? status.artifact?.id
        if (!artifactId) {
          throw new Error("ZIP xuất bản chưa sẵn sàng để tải.")
        }
        const result = await downloadPublicationArchiveArtifact(
          sessionId,
          artifactId
        )
        saveBlob(result.blob, result.fileName)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Không thể tải ZIP xuất bản."
        setError(message)
        toast.error(message)
      } finally {
        activeDownloadKeyRef.current = ""
        setDownloadingKey("")
      }
    },
    [sessionId]
  )

  const summaryItems = useMemo(
    () =>
      [
        ["Hộp", manifest?.summary.box_count ?? 0],
        ["Hồ sơ", manifest?.summary.dossier_count ?? 0],
        ["Tài liệu", manifest?.summary.document_count ?? 0],
      ] as const,
    [manifest]
  )
  const publicationTree = useMemo(
    () => buildPublicationTree(manifest),
    [manifest]
  )
  const publicationSearchMatches = useMemo(
    () => buildPublicationSearchMatches(manifest, publicationSearch),
    [manifest, publicationSearch]
  )
  const activePublicationSearchMatch =
    publicationSearchMatches[publicationSearchIndex] ?? null

  useEffect(() => {
    setPublicationSearchIndex(0)
  }, [publicationSearch])

  useEffect(() => {
    if (publicationSearchIndex < publicationSearchMatches.length) return
    setPublicationSearchIndex(0)
  }, [publicationSearchIndex, publicationSearchMatches.length])

  useEffect(() => {
    if (!activePublicationSearchMatch) return
    if (activePublicationSearchMatch.boxNumber) {
      setCollapsedBoxes((current) =>
        removeSetValue(current, activePublicationSearchMatch.boxNumber!)
      )
    }
    if (
      activePublicationSearchMatch.boxNumber &&
      activePublicationSearchMatch.dossierIndex !== undefined
    ) {
      const pageIndex = Math.floor(
        activePublicationSearchMatch.dossierIndex / dossierPageSize
      )
      setDossierPageByBox((current) =>
        setRecordPage(
          current,
          activePublicationSearchMatch.boxNumber!,
          pageIndex
        )
      )
    }
    if (activePublicationSearchMatch.dossierId !== undefined) {
      setCollapsedDossiers((current) =>
        removeSetValue(current, activePublicationSearchMatch.dossierId!)
      )
    }
    if (
      activePublicationSearchMatch.dossierId !== undefined &&
      activePublicationSearchMatch.documentIndex !== undefined
    ) {
      const pageIndex = Math.floor(
        activePublicationSearchMatch.documentIndex / documentPageSize
      )
      setDocumentPageByDossier((current) =>
        setRecordPage(
          current,
          activePublicationSearchMatch.dossierId!,
          pageIndex
        )
      )
    }
    const timeoutId = window.setTimeout(() => {
      scrollPublicationNodeIntoView(activePublicationSearchMatch.id)
    }, 120)
    return () => window.clearTimeout(timeoutId)
  }, [
    activePublicationSearchMatch,
    dossierPageSize,
    documentPageSize,
  ])

  const navigatePublicationSearch = useCallback(
    (direction: number) => {
      setPublicationSearchIndex((current) => {
        const total = publicationSearchMatches.length
        if (total === 0) return 0
        return (current + direction + total) % total
      })
    },
    [publicationSearchMatches.length]
  )

  const saveName = useCallback(async () => {
    if (!sessionId || !editingName) return
    const nextName = editingName.value.trim()
    if (!nextName) {
      toast.error("Tên không được để trống.")
      return
    }
    const key = `${editingName.type}:${editingName.id}`
    setSavingNameKey(key)
    setError("")
    try {
      const response = await updatePublicationName(sessionId, {
        target_type: editingName.type,
        target_id: editingName.id,
        name: nextName,
      })
      setManifest(response)
      setEditingName(null)
      toast.success("Đã cập nhật tên xuất bản.")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Không thể cập nhật tên xuất bản."
      setError(message)
      toast.error(message)
    } finally {
      setSavingNameKey("")
    }
  }, [editingName, sessionId])

  if (loading) {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-xl border border-[#CBD5E1] bg-white text-sm text-[#64748B]">
        <Loader2 className="mr-2 size-4 animate-spin text-[#0052FF]" />
        Đang thiết lập tên và cấu trúc xuất bản...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-4 border-b border-[#CBD5E1] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-[#64748B] uppercase">
            Xuất bản
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-[#0F172A]">
            Đóng gói hộp, hồ sơ và tài liệu
          </h2>
          <p className="mt-2 text-sm text-[#64748B]">
            {manifest?.archive_code || "Chưa có mã lưu trữ"} ·{" "}
            {manifest?.fonds_creator_code || "Chưa có mã phông"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void refresh()}
          >
            <RefreshCw data-icon="inline-start" />
            Làm mới
          </Button>
          <Button
            type="button"
            disabled={!manifest?.ready || downloadingKey !== ""}
            onClick={() =>
              sessionId &&
              void downloadArchive("all", { scope: "all" })
            }
          >
            {downloadingKey === "all" ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <Archive data-icon="inline-start" />
            )}
            Tải toàn bộ ZIP
          </Button>
        </div>
      </header>

      {manifest && manifest.validation_errors.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="flex items-center gap-2 font-semibold">
            <TriangleAlert className="size-4" />
            Cần hoàn thiện dữ liệu trước khi tải toàn bộ
          </div>
          <ul className="mt-2 grid gap-1">
            {manifest.validation_errors.slice(0, 12).map((message) => (
              <li key={message}>• {message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-[#CBD5E1] bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-[#E8F0FF] text-[#0052FF]">
                <FolderOpen className="size-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-[#0F172A]">
                  Cấu trúc gói xuất bản
                </p>
                <p className="text-xs text-[#64748B]">
                  Phông / Loại tài liệu / Hộp / Hồ sơ / Tài liệu
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {summaryItems.map(([label, value]) => (
                <span
                  key={label}
                  className="rounded-full border border-[#D8E1EC] bg-white px-2.5 py-1 text-xs text-[#64748B]"
                >
                  <strong className="font-semibold text-[#0F172A]">
                    {value}
                  </strong>{" "}
                  {label.toLocaleLowerCase("vi")}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-3 transition-colors focus-within:border-[#0052FF] focus-within:ring-2 focus-within:ring-[#0052FF]/15">
              <Search className="size-4 shrink-0 text-[#94A3B8]" />
              <input
                value={publicationSearch}
                onChange={(event) => setPublicationSearch(event.target.value)}
                placeholder="Tìm phông, loại tài liệu, hộp, hồ sơ hoặc tài liệu"
                className="min-w-0 flex-1 bg-transparent text-sm text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
              />
              {publicationSearch ? (
                <button
                  type="button"
                  onClick={() => setPublicationSearch("")}
                  title="Xóa tìm kiếm"
                  aria-label="Xóa tìm kiếm"
                  className="flex size-6 shrink-0 items-center justify-center rounded-md text-[#64748B] hover:bg-[#F1F5F9]"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </label>
            <div className="flex items-center justify-end gap-1.5">
              <span className="min-w-16 text-right text-xs font-medium text-[#64748B]">
                {publicationSearch
                  ? publicationSearchMatches.length > 0
                    ? `${publicationSearchIndex + 1}/${publicationSearchMatches.length}`
                    : "0/0"
                  : ""}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                title="Kết quả trước"
                disabled={publicationSearchMatches.length === 0}
                onClick={() => navigatePublicationSearch(-1)}
              >
                <ChevronUp className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                title="Kết quả tiếp theo"
                disabled={publicationSearchMatches.length === 0}
                onClick={() => navigatePublicationSearch(1)}
              >
                <ChevronDown className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
        <div className="max-h-[min(68svh,620px)] overflow-y-auto p-3">
          {publicationTree.map((fonds) => (
            <section key={fonds.label}>
              <div
                data-publication-node-id="fonds:root"
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2 py-2",
                  activePublicationSearchMatch?.id === "fonds:root" &&
                    "bg-[#EAF1FF] ring-2 ring-[#0052FF]/25"
                )}
              >
                <FolderOpen className="size-4 shrink-0 text-[#0052FF]" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#0F172A]">
                  {fonds.label}
                </span>
              </div>

              <div className="ml-[15px] border-l border-[#D8E1EC] pl-3">
                {fonds.retentionGroups.map((group) => {
                  const groupKey = `retention:${group.label}`
                  return (
                    <section key={group.label}>
                      <div
                        data-publication-node-id={groupKey}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-2 py-2",
                          activePublicationSearchMatch?.id === groupKey &&
                            "bg-[#EAF1FF] ring-2 ring-[#0052FF]/25"
                        )}
                      >
                        <Folder className="size-4 shrink-0 text-[#0052FF]" />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#0F172A]">
                          {group.label}
                        </span>
                      </div>

                      <div className="ml-[15px] border-l border-[#D8E1EC] pl-3">
                        {group.boxes.map((box) => {
                          const boxCollapsed = collapsedBoxes.has(box.box_number)
                          const boxKey = `box:${box.box_number}`
                          const dossierPagination = paginationFromState(
                            box.dossiers.length,
                            dossierPageByBox[box.box_number] ?? 0,
                            dossierPageSize
                          )
                          const pagedDossiers = box.dossiers.slice(
                            dossierPagination.startIndex,
                            dossierPagination.endIndex
                          )
                          return (
                            <section key={`${group.label}:${box.box_number}`}>
                              <div
                                data-publication-node-id={boxKey}
                                className={cn(
                                  "group/row flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-[#F1F5F9]",
                                  activePublicationSearchMatch?.id === boxKey &&
                                    "bg-[#EAF1FF] ring-2 ring-[#0052FF]/25"
                                )}
                              >
                                <button
                                  type="button"
                                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                  onClick={() =>
                                    setCollapsedBoxes((current) =>
                                      toggleSet(current, box.box_number)
                                    )
                                  }
                                >
                                  <ChevronDown
                                    className={cn(
                                      "size-3.5 shrink-0 text-[#64748B] transition-transform",
                                      boxCollapsed && "-rotate-90"
                                    )}
                                  />
                                  <Box className="size-4 shrink-0 text-[#0052FF]" />
                                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#0F172A]">
                                    {box.name}
                                  </span>
                                </button>
                                <IconDownloadButton
                                  loading={downloadingKey === boxKey}
                                  disabled={
                                    !box.download_ready || downloadingKey !== ""
                                  }
                                  label={`Tải ${box.name}`}
                                  onClick={() =>
                                    sessionId &&
                                    void downloadArchive(boxKey, {
                                      scope: "box",
                                      box_number: box.box_number,
                                    })
                                  }
                                />
                              </div>

                              {!boxCollapsed ? (
                                <div className="ml-[15px] border-l border-[#D8E1EC] pl-3">
                                  {pagedDossiers.map((dossier) => {
                                    const dossierCollapsed = collapsedDossiers.has(
                                      dossier.session_dossier_id
                                    )
                                    const dossierKey = `dossier:${dossier.session_dossier_id}`
                                    const documentPagination = paginationFromState(
                                      dossier.documents.length,
                                      documentPageByDossier[
                                        dossier.session_dossier_id
                                      ] ?? 0,
                                      documentPageSize
                                    )
                                    const pagedDocuments = dossier.documents.slice(
                                      documentPagination.startIndex,
                                      documentPagination.endIndex
                                    )
                                    return (
                                      <div key={dossier.session_dossier_id}>
                                        <div
                                          data-publication-node-id={dossierKey}
                                          className={cn(
                                            "group/row flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-[#F1F5F9]",
                                            activePublicationSearchMatch?.id ===
                                              dossierKey &&
                                              "bg-[#EAF1FF] ring-2 ring-[#0052FF]/25"
                                          )}
                                        >
                                          <button
                                            type="button"
                                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                            onClick={() =>
                                              setCollapsedDossiers((current) =>
                                                toggleSet(
                                                  current,
                                                  dossier.session_dossier_id
                                                )
                                              )
                                            }
                                          >
                                            <ChevronDown
                                              className={cn(
                                                "size-3.5 shrink-0 text-[#64748B] transition-transform",
                                                dossierCollapsed && "-rotate-90"
                                              )}
                                            />
                                            {dossierCollapsed ? (
                                              <Folder className="size-4 shrink-0 text-[#0052FF]" />
                                            ) : (
                                              <FolderOpen className="size-4 shrink-0 text-[#0052FF]" />
                                            )}
                                            <span className="min-w-0 flex-1">
                                              <span className="block truncate text-sm font-medium text-[#0F172A]">
                                                {dossier.standard_name}
                                              </span>
                                              <span className="block truncate text-xs text-[#64748B]">
                                                {dossier.title}
                                              </span>
                                            </span>
                                          </button>
                                          <IconDownloadButton
                                            loading={downloadingKey === dossierKey}
                                            disabled={
                                              !dossier.download_ready ||
                                              downloadingKey !== ""
                                            }
                                            label={`Tải hồ sơ ${dossier.standard_name}`}
                                            onClick={() =>
                                              sessionId &&
                                              void downloadArchive(dossierKey, {
                                                scope: "dossier",
                                                session_dossier_id:
                                                  dossier.session_dossier_id,
                                              })
                                            }
                                          />
                                        </div>

                                        {!dossierCollapsed ? (
                                          <div className="ml-[15px] border-l border-[#E2E8F0] pl-3">
                                            {pagedDocuments.map((document) => {
                                              const documentKey = `document:${document.session_document_id}`
                                              return (
                                                <div
                                                  key={
                                                    document.session_document_id
                                                  }
                                                  data-publication-node-id={
                                                    documentKey
                                                  }
                                                  className={cn(
                                                    "group/row flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[#F8FAFC]",
                                                    activePublicationSearchMatch?.id ===
                                                      documentKey &&
                                                      "bg-[#EAF1FF] ring-2 ring-[#0052FF]/25"
                                                  )}
                                                >
                                                  <span className="block size-3.5 shrink-0" />
                                                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-[#E8F0FF] text-[#0052FF]">
                                                    <FileText className="size-3.5" />
                                                  </span>
                                                  <div className="min-w-0 flex-1">
                                                    <EditablePublicationName
                                                      value={
                                                        document.standard_file_name
                                                      }
                                                      editing={
                                                        editingName?.type ===
                                                          "document" &&
                                                        editingName.id ===
                                                          document.session_document_id
                                                      }
                                                      draft={
                                                        editingName?.value ?? ""
                                                      }
                                                      saving={
                                                        savingNameKey ===
                                                        `document:${document.session_document_id}`
                                                      }
                                                      textClassName="text-sm text-[#0F172A]"
                                                      onStart={(event) => {
                                                        event.stopPropagation()
                                                        setEditingName({
                                                          type: "document",
                                                          id: document.session_document_id,
                                                          value:
                                                            document.standard_file_name,
                                                        })
                                                      }}
                                                      onChange={(value) =>
                                                        setEditingName(
                                                          (current) =>
                                                            current
                                                              ? {
                                                                  ...current,
                                                                  value,
                                                                }
                                                              : current
                                                        )
                                                      }
                                                      onSave={(event) => {
                                                        event.stopPropagation()
                                                        void saveName()
                                                      }}
                                                      onCancel={(event) => {
                                                        event.stopPropagation()
                                                        setEditingName(null)
                                                      }}
                                                    />
                                                    <p className="truncate text-xs text-[#94A3B8]">
                                                      {document.source_file_name} ·{" "}
                                                      {document.issued_date ||
                                                        "Chưa có ngày"}
                                                    </p>
                                                  </div>
                                                  <IconDownloadButton
                                                    loading={
                                                      downloadingKey ===
                                                      documentKey
                                                    }
                                                    disabled={
                                                      !document.download_ready ||
                                                      !document.numbered_pdf_version_id ||
                                                      downloadingKey !== ""
                                                    }
                                                    label={`Tải ${document.standard_file_name}`}
                                                    onClick={() =>
                                                      sessionId &&
                                                      void download(
                                                        documentKey,
                                                        () =>
                                                          downloadPublicationDocument(
                                                            sessionId,
                                                            document.session_document_id
                                                          )
                                                      )
                                                    }
                                                  />
                                                </div>
                                              )
                                            })}
                                            {dossier.documents.length >
                                              documentPagination.pageSize && (
                                              <PaginationControls
                                                total={documentPagination.total}
                                                pageIndex={
                                                  documentPagination.pageIndex
                                                }
                                                pageSize={
                                                  documentPagination.pageSize
                                                }
                                                pageCount={
                                                  documentPagination.pageCount
                                                }
                                                startNumber={
                                                  documentPagination.startNumber
                                                }
                                                endNumber={
                                                  documentPagination.endNumber
                                                }
                                                itemLabel="tài liệu"
                                                onPageChange={(pageIndex) =>
                                                  setDocumentPageByDossier(
                                                    (current) => ({
                                                      ...current,
                                                      [dossier.session_dossier_id]:
                                                        pageIndex,
                                                    })
                                                  )
                                                }
                                                onPageSizeChange={(pageSize) => {
                                                  setDocumentPageSize(pageSize)
                                                  setDocumentPageByDossier({})
                                                }}
                                                className="my-2"
                                              />
                                            )}
                                          </div>
                                        ) : null}
                                      </div>
                                    )
                                  })}
                                  {box.dossiers.length >
                                    dossierPagination.pageSize && (
                                    <PaginationControls
                                      total={dossierPagination.total}
                                      pageIndex={dossierPagination.pageIndex}
                                      pageSize={dossierPagination.pageSize}
                                      pageCount={dossierPagination.pageCount}
                                      startNumber={dossierPagination.startNumber}
                                      endNumber={dossierPagination.endNumber}
                                      itemLabel="hồ sơ"
                                      onPageChange={(pageIndex) =>
                                        setDossierPageByBox((current) => ({
                                          ...current,
                                          [box.box_number]: pageIndex,
                                        }))
                                      }
                                      onPageSizeChange={(pageSize) => {
                                        setDossierPageSize(pageSize)
                                        setDossierPageByBox({})
                                      }}
                                      className="my-2"
                                    />
                                  )}
                                </div>
                              ) : null}
                            </section>
                          )
                        })}
                      </div>
                    </section>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

function EditablePublicationName({
  value,
  editing,
  draft,
  saving,
  textClassName,
  onStart,
  onChange,
  onSave,
  onCancel,
}: {
  value: string
  editing: boolean
  draft: string
  saving: boolean
  textClassName: string
  onStart: (event: React.MouseEvent<HTMLButtonElement>) => void
  onChange: (value: string) => void
  onSave: (event: React.MouseEvent<HTMLButtonElement>) => void
  onCancel: (event: React.MouseEvent<HTMLButtonElement>) => void
}) {
  if (editing) {
    return (
      <span
        className="flex min-w-0 flex-1 items-center gap-1.5"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          value={draft}
          autoFocus
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              const buttonEvent =
                event as unknown as React.MouseEvent<HTMLButtonElement>
              onSave(buttonEvent)
            }
            if (event.key === "Escape") {
              event.preventDefault()
              const buttonEvent =
                event as unknown as React.MouseEvent<HTMLButtonElement>
              onCancel(buttonEvent)
            }
          }}
          className="h-8 min-w-0 flex-1 rounded-md border border-[#BFD3FF] bg-white px-2 text-sm text-[#0F172A] outline-none focus-visible:border-[#0052FF] focus-visible:ring-2 focus-visible:ring-[#0052FF]/20"
        />
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          title="Lưu tên"
          aria-label="Lưu tên"
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Check className="size-3.5" />
          )}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onCancel}
          title="Hủy"
          aria-label="Hủy"
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-[#64748B] hover:bg-[#F1F5F9] disabled:opacity-50"
        >
          <X className="size-3.5" />
        </button>
      </span>
    )
  }

  return (
    <span className="flex min-w-0 flex-1 items-center gap-1.5">
      <span className={cn("truncate", textClassName)}>{value}</span>
      <button
        type="button"
        onClick={onStart}
        title="Đổi tên"
        aria-label="Đổi tên"
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-[#64748B] opacity-100 transition-all hover:bg-[#E8F0FF] hover:text-[#0052FF] focus-visible:opacity-100 sm:opacity-0 sm:group-hover/row:opacity-100"
      >
        <Edit2 className="size-3.5" />
      </button>
    </span>
  )
}

function IconDownloadButton({
  loading,
  disabled,
  label,
  onClick,
}: {
  loading: boolean
  disabled: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={label}
      aria-label={label}
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-[#64748B] opacity-100 transition-all hover:bg-[#E8F0FF] hover:text-[#0052FF] focus-visible:opacity-100 disabled:cursor-not-allowed disabled:opacity-30 sm:opacity-0 sm:group-hover/row:opacity-100"
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Download className="size-4" />
      )}
    </button>
  )
}

interface PublicationRetentionGroup {
  label: string
  boxes: PublicationBox[]
}

interface PublicationFondsGroup {
  label: string
  retentionGroups: PublicationRetentionGroup[]
}

function buildPublicationTree(
  manifest: PublicationManifest | null
): PublicationFondsGroup[] {
  if (!manifest) return []
  const labels = retentionLabelsForManifest(manifest)
  const groupsByLabel = new Map<string, PublicationRetentionGroup>()
  const ensureGroup = (label: string) => {
    const existing = groupsByLabel.get(label)
    if (existing) return existing
    const group: PublicationRetentionGroup = {
      label,
      boxes: [],
    }
    groupsByLabel.set(label, group)
    if (!labels.includes(label)) labels.push(label)
    return group
  }

  manifest.boxes.forEach((box) => {
    const dossiersByGroup = new Map<string, PublicationDossier[]>()
    box.dossiers.forEach((dossier) => {
      const label = retentionGroupLabel(dossier)
      const dossiers = dossiersByGroup.get(label) ?? []
      dossiers.push(dossier)
      dossiersByGroup.set(label, dossiers)
      ensureGroup(label)
    })

    dossiersByGroup.forEach((dossiers, label) => {
      const group = ensureGroup(label)
      group.boxes.push({
        ...box,
        dossiers,
      })
    })
  })

  return [
    {
      label: (manifest.fonds_name ?? "").trim() || DEFAULT_FONDS_LABEL,
      retentionGroups: labels
        .map((label) => groupsByLabel.get(label))
        .filter(
          (group): group is PublicationRetentionGroup =>
            Boolean(group && group.boxes.length > 0)
        ),
    },
  ]
}

function retentionLabelsForManifest(manifest: PublicationManifest): string[] {
  const labels = manifest.retention_groups?.length
    ? [...manifest.retention_groups]
    : [...DEFAULT_RETENTION_GROUPS]
  manifest.boxes.forEach((box) => {
    box.dossiers.forEach((dossier) => {
      const label = retentionGroupLabel(dossier)
      if (!labels.includes(label)) labels.push(label)
    })
  })
  return labels.filter((label, index) => label && labels.indexOf(label) === index)
}

function retentionGroupLabel(dossier: PublicationDossier): string {
  const direct = (dossier.retention_group ?? "").trim()
  if (direct) return direct
  const normalized = normalizeSearchText(dossier.retention_period)
  if (!normalized) return "Có thời hạn"
  if (normalized.includes("loai") || normalized.includes("huy")) {
    return "Tài liệu loại"
  }
  if (normalized.includes("vinh vien") || normalized.replace(/\s+/g, "") === "vv") {
    return "Vĩnh viễn"
  }
  return "Có thời hạn"
}

function toggleSet<T>(current: Set<T>, value: T): Set<T> {
  const next = new Set(current)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

interface PublicationSearchMatch {
  id: string
  boxIndex?: number
  boxNumber?: string
  dossierIndex?: number
  dossierId?: number
  documentIndex?: number
}

function buildPublicationSearchMatches(
  manifest: PublicationManifest | null,
  query: string
): PublicationSearchMatch[] {
  const normalizedQuery = normalizeSearchText(query)
  if (!manifest || !normalizedQuery) return []
  const matches: PublicationSearchMatch[] = []
  const fondsLabel = (manifest.fonds_name ?? "").trim() || DEFAULT_FONDS_LABEL
  if (normalizeSearchText(fondsLabel).includes(normalizedQuery)) {
    matches.push({ id: "fonds:root" })
  }
  retentionLabelsForManifest(manifest).forEach((label) => {
    if (!normalizeSearchText(label).includes(normalizedQuery)) return
    matches.push({ id: `retention:${label}` })
  })
  manifest.boxes.forEach((box, boxIndex) => {
    const boxId = `box:${box.box_number}`
    if (
      normalizeSearchText([box.name, box.box_number].join(" ")).includes(
        normalizedQuery
      )
    ) {
      matches.push({
        id: boxId,
        boxIndex,
        boxNumber: box.box_number,
      })
    }
    box.dossiers.forEach((dossier, dossierIndex) => {
      const dossierId = `dossier:${dossier.session_dossier_id}`
      if (
        normalizeSearchText(
          [
            dossier.standard_name,
            dossier.title,
            dossier.dossier_id,
            dossier.dossier_number,
            dossier.dossier_code,
            dossier.retention_group,
            dossier.retention_period,
            dossier.fonds_name,
          ].join(" ")
        ).includes(normalizedQuery)
      ) {
        matches.push({
          id: dossierId,
          boxIndex,
          boxNumber: box.box_number,
          dossierIndex,
          dossierId: dossier.session_dossier_id,
        })
      }
      dossier.documents.forEach((document, documentIndex) => {
        if (
          !normalizeSearchText(
            [
              document.standard_file_name,
              document.source_file_name,
              document.document_id,
              document.sequence_code,
            ].join(" ")
          ).includes(normalizedQuery)
        ) {
          return
        }
        matches.push({
          id: `document:${document.session_document_id}`,
          boxIndex,
          boxNumber: box.box_number,
          dossierIndex,
          dossierId: dossier.session_dossier_id,
          documentIndex,
        })
      })
    })
  })
  return matches
}

function normalizeSearchText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function removeSetValue<T>(current: Set<T>, value: T): Set<T> {
  if (!current.has(value)) return current
  const next = new Set(current)
  next.delete(value)
  return next
}

function setRecordPage<T extends string | number>(
  current: Record<T, number>,
  key: T,
  pageIndex: number
): Record<T, number> {
  if (current[key] === pageIndex) return current
  return { ...current, [key]: pageIndex }
}

function scrollPublicationNodeIntoView(nodeId: string) {
  const nodes =
    document.querySelectorAll<HTMLElement>("[data-publication-node-id]")
  for (const node of nodes) {
    if (node.dataset.publicationNodeId !== nodeId) continue
    node.scrollIntoView({ block: "center", behavior: "smooth" })
    return
  }
}

function paginationFromState(
  total: number,
  pageIndex: number,
  pageSize: number
) {
  const safePageSize = Math.max(1, pageSize)
  const pageCount = Math.max(1, Math.ceil(total / safePageSize))
  const safePageIndex = Math.min(Math.max(0, pageIndex), pageCount - 1)
  const startIndex = safePageIndex * safePageSize
  const endIndex = Math.min(total, startIndex + safePageSize)
  return {
    total,
    pageIndex: safePageIndex,
    pageSize: safePageSize,
    pageCount,
    startIndex,
    endIndex,
    startNumber: total === 0 ? 0 : startIndex + 1,
    endNumber: endIndex,
  }
}

async function waitForPublicationArchive(
  sessionId: string,
  scope: PublicationArchiveScope
) {
  const deadline = Date.now() + PUBLICATION_ARCHIVE_TIMEOUT_MS
  while (Date.now() < deadline) {
    const status = await getPublicationArchiveStatus(sessionId, scope)
    if (status.artifact) return status
    const jobStatus = status.job?.status ?? ""
    if (PUBLICATION_ARCHIVE_FAILED_STATUSES.has(jobStatus)) {
      throw new Error(
        status.job?.error || "Job tạo ZIP xuất bản thất bại."
      )
    }
    await delay(visibleAwareDelay(PUBLICATION_ARCHIVE_POLL_MS))
  }
  throw new Error("Quá thời gian chờ tạo ZIP xuất bản.")
}

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
