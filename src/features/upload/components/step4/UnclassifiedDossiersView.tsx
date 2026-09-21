import { useCallback, useEffect, useState } from "react"
import {
  ArrowLeft,
  CheckSquare,
  ChevronDown,
  FileText,
  FolderClock,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ApiRequestError } from "@/features/upload/api/sessionApi.http"
import {
  classifyUnclassifiedSessionDossiers,
  listUnclassifiedSessionDossiers,
  patchSessionDossier,
  type UnclassifiedSessionDossierSummary,
} from "@/features/upload/api/sessionApi"
import { cn } from "@/shared/lib/utils"

interface UnclassifiedDossiersViewProps {
  sessionId: string | null
  onBack: () => void
}

function dossierTitle(dossier: UnclassifiedSessionDossierSummary): string {
  return (
    dossier.title_override?.trim() ||
    dossier.title?.trim() ||
    dossier.generated_title?.trim() ||
    dossier.dossier_id
  )
}

function unclassifiedDossierErrorMessage(error: unknown): string {
  if (
    error instanceof ApiRequestError &&
    error.status === 404 &&
    error.message.toLowerCase().includes("no cluster version")
  ) {
    return ""
  }
  return error instanceof Error
    ? error.message
    : "Không tải được hồ sơ chờ phân loại."
}

export function UnclassifiedDossiersView({
  sessionId,
  onBack,
}: UnclassifiedDossiersViewProps) {
  const [dossiers, setDossiers] = useState<UnclassifiedSessionDossierSummary[]>(
    []
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [expanded, setExpanded] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [classifying, setClassifying] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editRetentionPeriod, setEditRetentionPeriod] = useState("")
  const [saving, setSaving] = useState(false)

  const requestDossiers = useCallback(async () => {
    if (!sessionId) {
      throw new Error("Chưa có phiên làm việc để xem hồ sơ.")
    }
    return listUnclassifiedSessionDossiers(sessionId)
  }, [sessionId])

  const loadDossiers = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await requestDossiers()
      setDossiers(response.dossiers)
      setSelectedIds((current) => {
        const available = new Set(
          response.dossiers.map((dossier) => dossier.dossier_id)
        )
        return new Set([...current].filter((value) => available.has(value)))
      })
    } catch (loadError) {
      setDossiers([])
      setError(unclassifiedDossierErrorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [requestDossiers])

  const classifySelected = async () => {
    if (!sessionId || selectedIds.size === 0) return
    setClassifying(true)
    setError("")
    try {
      const response = await classifyUnclassifiedSessionDossiers(sessionId, [
        ...selectedIds,
      ])
      toast.success(
        `Đã đưa ${response.selected_dossier_count} hồ sơ vào hàng đợi cập nhật.`
      )
      setSelectedIds(new Set())
    } catch (caught) {
      setError(unclassifiedDossierErrorMessage(caught))
    } finally {
      setClassifying(false)
    }
  }

  const saveDossierMetadata = async () => {
    if (!sessionId || !editingId) return
    setSaving(true)
    setError("")
    try {
      await patchSessionDossier(sessionId, editingId, {
        title: editTitle,
        retention_period: editRetentionPeriod,
      })
      toast.success(
        "Đã lưu thông tin hồ sơ. Các giá trị người dùng nhập sẽ được giữ nguyên khi phân loại."
      )
      setEditingId(null)
      await loadDossiers()
    } catch (caught) {
      setError(unclassifiedDossierErrorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    let active = true
    void requestDossiers()
      .then((response) => {
        if (!active) return
        setDossiers(response.dossiers)
        setError("")
      })
      .catch((loadError: unknown) => {
        if (!active) return
        setDossiers([])
        setError(unclassifiedDossierErrorMessage(loadError))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [requestDossiers])

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-[#D8E1EC] bg-white px-5 py-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls="unclassified-dossiers-content"
          onClick={() => setExpanded((value) => !value)}
          className="flex min-w-0 flex-1 items-start gap-3 rounded-xl text-left focus-visible:ring-2 focus-visible:ring-[#0052FF] focus-visible:outline-none"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
            <FolderClock className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold text-[#0F172A]">
                Hồ sơ chờ phân loại
              </span>
              {!loading && !error ? (
                <Badge variant="secondary">{dossiers.length} hồ sơ</Badge>
              ) : null}
            </span>
            <span className="mt-1 block max-w-3xl text-sm leading-6 text-[#64748B]">
              Chọn một hoặc nhiều hồ sơ để đưa vào kết quả phân loại. Các hồ sơ
              không được chọn tiếp tục ở trạng thái chưa phân loại.
            </span>
          </span>
          <ChevronDown
            className={cn(
              "mt-2 size-5 shrink-0 text-[#64748B] transition-transform",
              expanded && "rotate-180"
            )}
          />
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" onClick={onBack}>
            <ArrowLeft />
            Quay lại
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void loadDossiers()}
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Tải lại
          </Button>
        </div>
      </div>

      {expanded ? (
        <div id="unclassified-dossiers-content">
          {loading ? (
            <div className="flex min-h-56 items-center justify-center rounded-2xl border border-[#D8E1EC] bg-white text-sm text-[#64748B] shadow-sm">
              <Loader2 className="mr-2 size-5 animate-spin text-[#0052FF]" />
              Đang tải hồ sơ chờ phân loại...
            </div>
          ) : error ? (
            <div
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700"
            >
              {error}
            </div>
          ) : dossiers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white px-6 py-12 text-center shadow-sm">
              <FolderClock className="mx-auto size-10 text-[#94A3B8]" />
              <h3 className="mt-3 text-base font-semibold text-[#0F172A]">
                Không có hồ sơ chờ phân loại
              </h3>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#64748B]">
                Các hồ sơ chuyển Phông chưa được đưa vào cluster version sẽ xuất
                hiện tại đây.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-[#64748B]">
                  <input
                    type="checkbox"
                    checked={
                      dossiers.length > 0 &&
                      selectedIds.size === dossiers.length
                    }
                    onChange={(event) =>
                      setSelectedIds(
                        event.target.checked
                          ? new Set(
                              dossiers.map((dossier) => dossier.dossier_id)
                            )
                          : new Set()
                      )
                    }
                    className="size-4 rounded border-slate-300"
                  />
                  Chọn tất cả {dossiers.length} hồ sơ
                </label>
                <Button
                  type="button"
                  disabled={selectedIds.size === 0 || classifying}
                  onClick={() => void classifySelected()}
                >
                  {classifying ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <CheckSquare />
                  )}
                  Cập nhật {selectedIds.size || ""} hồ sơ đã chọn
                </Button>
              </div>
              {dossiers.map((dossier) => (
                <article
                  key={dossier.id ?? dossier.dossier_id}
                  className="overflow-hidden rounded-2xl border border-[#D8E1EC] bg-white shadow-sm"
                >
                  <div className="flex flex-col gap-3 border-b border-[#E2E8F0] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <input
                        type="checkbox"
                        aria-label={`Chọn hồ sơ ${dossierTitle(dossier)}`}
                        checked={selectedIds.has(dossier.dossier_id)}
                        onChange={(event) =>
                          setSelectedIds((current) => {
                            const next = new Set(current)
                            if (event.target.checked) {
                              next.add(dossier.dossier_id)
                            } else {
                              next.delete(dossier.dossier_id)
                            }
                            return next
                          })
                        }
                        className="mt-1 size-4 shrink-0 rounded border-slate-300"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-[#0F172A]">
                            {dossierTitle(dossier)}
                          </h3>
                          <Badge
                            variant="outline"
                            className="border-amber-200 bg-amber-50 text-amber-700"
                          >
                            Chưa phân loại
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs break-all text-[#64748B]">
                          Mã hồ sơ: {dossier.dossier_id}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[#475569]">
                      <span>
                        {dossier.document_ids?.length ??
                          dossier.documents.length}{" "}
                        tài liệu
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingId(dossier.dossier_id)
                          setEditTitle(dossierTitle(dossier))
                          setEditRetentionPeriod(dossier.retention_period || "")
                        }}
                      >
                        <Pencil />
                        Sửa
                      </Button>
                    </div>
                  </div>

                  {editingId === dossier.dossier_id ? (
                    <div className="grid gap-3 border-b border-[#E2E8F0] bg-blue-50/40 px-5 py-4 sm:grid-cols-[1fr_220px_auto] sm:items-end">
                      <label className="text-sm font-medium text-[#334155]">
                        Tiêu đề hồ sơ
                        <input
                          value={editTitle}
                          onChange={(event) => setEditTitle(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"
                        />
                      </label>
                      <label className="text-sm font-medium text-[#334155]">
                        Thời hạn bảo quản
                        <input
                          value={editRetentionPeriod}
                          onChange={(event) =>
                            setEditRetentionPeriod(event.target.value)
                          }
                          placeholder="Ví dụ: 20 năm"
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"
                        />
                      </label>
                      <Button
                        type="button"
                        disabled={saving || !editTitle.trim()}
                        onClick={() => void saveDossierMetadata()}
                      >
                        {saving ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <Save />
                        )}
                        Lưu
                      </Button>
                    </div>
                  ) : null}

                  <div className="grid gap-3 px-5 py-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <p className="text-xs text-[#64748B]">Số hồ sơ</p>
                      <p className="mt-1 font-medium text-[#0F172A]">
                        {dossier.dossier_number || "Chưa có"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[#64748B]">
                        Thời hạn bảo quản
                      </p>
                      <p className="mt-1 font-medium text-[#0F172A]">
                        {dossier.retention_period || "Chưa có"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[#64748B]">Số trang</p>
                      <p className="mt-1 font-medium text-[#0F172A]">
                        {dossier.page_count ?? "Chưa xác định"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[#64748B]">Nguồn tạo</p>
                      <p className="mt-1 font-medium text-[#0F172A]">
                        Chuyển Phông
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4">
                    <h4 className="text-sm font-semibold text-[#334155]">
                      Tài liệu trong hồ sơ
                    </h4>
                    <div className="mt-3 space-y-2">
                      {dossier.documents.length > 0 ? (
                        dossier.documents.map((document) => (
                          <div
                            key={document.id}
                            className="flex items-start gap-3 rounded-xl border border-[#E2E8F0] bg-white px-4 py-3"
                          >
                            <FileText className="mt-0.5 size-4 shrink-0 text-[#0052FF]" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-[#0F172A]">
                                {document.title || document.file_name}
                              </p>
                              <p className="mt-1 truncate text-xs text-[#64748B]">
                                {document.file_name}
                                {document.document_number
                                  ? ` · Số ${document.document_number}`
                                  : ""}
                                {document.issued_date
                                  ? ` · ${document.issued_date}`
                                  : ""}
                                {document.page_count != null
                                  ? ` · ${document.page_count} trang`
                                  : ""}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-[#64748B]">
                          Chưa tải được thông tin chi tiết của tài liệu.
                        </p>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  )
}
