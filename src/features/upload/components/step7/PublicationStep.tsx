import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Archive,
  Box,
  Check,
  ChevronDown,
  Download,
  Edit2,
  FileText,
  Folder,
  FolderOpen,
  Loader2,
  RefreshCw,
  TriangleAlert,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  downloadPublicationAll,
  downloadPublicationBox,
  downloadPublicationDocument,
  downloadPublicationDossier,
  getPublicationManifest,
  updatePublicationName,
  type PublicationManifest,
} from "@/features/upload/api/sessionApi"
import { cn } from "@/shared/lib/utils"

interface PublicationStepProps {
  sessionId: string | null
}

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
        setDownloadingKey("")
      }
    },
    []
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
              void download("all", () => downloadPublicationAll(sessionId))
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
        <div className="flex flex-col gap-3 border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-[#E8F0FF] text-[#0052FF]">
              <FolderOpen className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">
                Cấu trúc gói xuất bản
              </p>
              <p className="text-xs text-[#64748B]">Hộp / Hồ sơ / Tài liệu</p>
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

        <div className="max-h-[min(68svh,620px)] overflow-y-auto p-3">
          {(manifest?.boxes ?? []).map((box) => {
            const boxCollapsed = collapsedBoxes.has(box.box_number)
            const boxKey = `box:${box.box_number}`
            return (
              <section key={box.box_number}>
                <div className="group/row flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-[#F1F5F9]">
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
                    <EditablePublicationName
                      value={box.name}
                      editing={editingName?.type === "box" && editingName.id === box.box_number}
                      draft={editingName?.value ?? ""}
                      saving={savingNameKey === `box:${box.box_number}`}
                      textClassName="text-sm font-semibold text-[#0F172A]"
                      onStart={(event) => {
                        event.stopPropagation()
                        setEditingName({
                          type: "box",
                          id: box.box_number,
                          value: box.name,
                        })
                      }}
                      onChange={(value) =>
                        setEditingName((current) =>
                          current ? { ...current, value } : current
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
                    <CountBadge>{box.dossiers.length} hồ sơ</CountBadge>
                  </button>
                  <IconDownloadButton
                    loading={downloadingKey === boxKey}
                    disabled={!box.download_ready || downloadingKey !== ""}
                    label={`Tải ${box.name}`}
                    onClick={() =>
                      sessionId &&
                      void download(boxKey, () =>
                        downloadPublicationBox(sessionId, box.box_number)
                      )
                    }
                  />
                </div>

                {!boxCollapsed ? (
                  <div className="ml-[15px] border-l border-[#D8E1EC] pl-3">
                    {box.dossiers.map((dossier) => {
                      const dossierCollapsed = collapsedDossiers.has(
                        dossier.session_dossier_id
                      )
                      const dossierKey = `dossier:${dossier.session_dossier_id}`
                      return (
                        <div key={dossier.session_dossier_id}>
                          <div className="group/row flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-[#F1F5F9]">
                            <button
                              type="button"
                              className="flex min-w-0 flex-1 items-center gap-2 text-left"
                              onClick={() =>
                                setCollapsedDossiers((current) =>
                                  toggleSet(current, dossier.session_dossier_id)
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
                                <EditablePublicationName
                                  value={dossier.standard_name}
                                  editing={
                                    editingName?.type === "dossier" &&
                                    editingName.id ===
                                      dossier.session_dossier_id
                                  }
                                  draft={editingName?.value ?? ""}
                                  saving={
                                    savingNameKey ===
                                    `dossier:${dossier.session_dossier_id}`
                                  }
                                  textClassName="text-sm font-medium text-[#0F172A]"
                                  onStart={(event) => {
                                    event.stopPropagation()
                                    setEditingName({
                                      type: "dossier",
                                      id: dossier.session_dossier_id,
                                      value: dossier.standard_name,
                                    })
                                  }}
                                  onChange={(value) =>
                                    setEditingName((current) =>
                                      current ? { ...current, value } : current
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
                                <span className="block truncate text-xs text-[#64748B]">
                                  {dossier.title}
                                </span>
                              </span>
                              <CountBadge>
                                {dossier.documents.length}
                              </CountBadge>
                            </button>
                            <IconDownloadButton
                              loading={downloadingKey === dossierKey}
                              disabled={
                                !dossier.download_ready || downloadingKey !== ""
                              }
                              label={`Tải hồ sơ ${dossier.standard_name}`}
                              onClick={() =>
                                sessionId &&
                                void download(dossierKey, () =>
                                  downloadPublicationDossier(
                                    sessionId,
                                    dossier.session_dossier_id
                                  )
                                )
                              }
                            />
                          </div>

                          {!dossierCollapsed ? (
                            <div className="ml-[15px] border-l border-[#E2E8F0] pl-3">
                              {dossier.documents.map((document) => {
                                const documentKey = `document:${document.session_document_id}`
                                return (
                                  <div
                                    key={document.session_document_id}
                                    className="group/row flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[#F8FAFC]"
                                  >
                                    <span className="block size-3.5 shrink-0" />
                                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-[#E8F0FF] text-[#0052FF]">
                                      <FileText className="size-3.5" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <EditablePublicationName
                                        value={document.standard_file_name}
                                        editing={
                                          editingName?.type === "document" &&
                                          editingName.id ===
                                            document.session_document_id
                                        }
                                        draft={editingName?.value ?? ""}
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
                                            value: document.standard_file_name,
                                          })
                                        }}
                                        onChange={(value) =>
                                          setEditingName((current) =>
                                            current
                                              ? { ...current, value }
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
                                        {document.issued_date || "Chưa có ngày"}
                                      </p>
                                    </div>
                                    <IconDownloadButton
                                      loading={downloadingKey === documentKey}
                                      disabled={
                                        !document.download_ready ||
                                        downloadingKey !== ""
                                      }
                                      label={`Tải ${document.standard_file_name}`}
                                      onClick={() =>
                                        sessionId &&
                                        void download(documentKey, () =>
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
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                ) : null}
              </section>
            )
          })}
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

function CountBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="shrink-0 rounded-full bg-[#E8F0FF] px-2 py-0.5 text-[10px] font-semibold text-[#0052FF]">
      {children}
    </span>
  )
}

function toggleSet<T>(current: Set<T>, value: T): Set<T> {
  const next = new Set(current)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
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
