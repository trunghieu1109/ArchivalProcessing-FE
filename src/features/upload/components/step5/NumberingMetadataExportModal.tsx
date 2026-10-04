import { useEffect, useMemo, useState } from "react"
import { Check, FileSpreadsheet, Loader2, Search, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  listSessionDossiers,
  type NumberingDossierStatus,
} from "@/features/upload/api/sessionApi"

type SelectableDossier = {
  dossierId: string
  title: string
  dossierNumber: string | null
  boxNumber: string | null
  documentCount: number | null
}

export function NumberingMetadataExportModal({
  open,
  sessionId,
  dossiers,
  exporting,
  onClose,
  onExport,
}: {
  open: boolean
  sessionId: string | null
  dossiers: NumberingDossierStatus[]
  exporting: boolean
  onClose: () => void
  onExport: (dossierIds: string[]) => Promise<boolean>
}) {
  const fallbackDossiers = useMemo(
    () =>
      dossiers.map((dossier) => ({
        dossierId: dossier.dossier_id,
        title: dossier.title || dossier.dossier_id,
        dossierNumber: dossier.dossier_number ?? null,
        boxNumber: dossier.box_number ?? null,
        documentCount: dossier.document_count,
      })),
    [dossiers]
  )
  const [availableDossiers, setAvailableDossiers] = useState<
    SelectableDossier[]
  >([])
  const [selectedDossierIds, setSelectedDossierIds] = useState<string[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return

    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setQuery("")
      if (!sessionId) {
        setAvailableDossiers(fallbackDossiers)
        setSelectedDossierIds(
          fallbackDossiers.map((dossier) => dossier.dossierId)
        )
        setLoading(false)
        return
      }
      setLoading(true)
      void listSessionDossiers(sessionId)
        .then((response) => {
          if (cancelled) return
          const nextDossiers = response.dossiers.map((dossier) => ({
            dossierId: dossier.dossier_id,
            title:
              dossier.title || dossier.generated_title || dossier.dossier_id,
            dossierNumber: dossier.dossier_number ?? null,
            boxNumber: dossier.box_number ?? null,
            documentCount: dossier.document_ids?.length ?? null,
          }))
          setAvailableDossiers(nextDossiers)
          setSelectedDossierIds(
            nextDossiers.map((dossier) => dossier.dossierId)
          )
        })
        .catch((error) => {
          if (cancelled) return
          setAvailableDossiers(fallbackDossiers)
          setSelectedDossierIds(
            fallbackDossiers.map((dossier) => dossier.dossierId)
          )
          toast.error(
            error instanceof Error
              ? error.message
              : "Không thể tải đầy đủ danh sách hồ sơ."
          )
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    })
    return () => {
      cancelled = true
    }
  }, [fallbackDossiers, open, sessionId])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !exporting) onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [exporting, onClose, open])

  const visibleDossiers = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query)
    if (!normalizedQuery) return availableDossiers
    return availableDossiers.filter((dossier) =>
      normalizeSearchText(
        [
          dossier.dossierNumber,
          dossier.title,
          dossier.boxNumber,
          dossier.dossierId,
        ].join(" ")
      ).includes(normalizedQuery)
    )
  }, [availableDossiers, query])

  if (!open) return null

  const selectedIds = new Set(selectedDossierIds)
  const allVisibleSelected =
    visibleDossiers.length > 0 &&
    visibleDossiers.every((dossier) => selectedIds.has(dossier.dossierId))

  const toggleDossier = (dossierId: string) => {
    setSelectedDossierIds((current) =>
      current.includes(dossierId)
        ? current.filter((value) => value !== dossierId)
        : [...current, dossierId]
    )
  }

  const toggleVisibleDossiers = () => {
    const visibleIds = new Set(
      visibleDossiers.map((dossier) => dossier.dossierId)
    )
    setSelectedDossierIds((current) =>
      allVisibleSelected
        ? current.filter((dossierId) => !visibleIds.has(dossierId))
        : Array.from(new Set([...current, ...visibleIds]))
    )
  }

  const submit = async () => {
    if (selectedDossierIds.length === 0) {
      toast.error("Vui lòng chọn ít nhất một hồ sơ để xuất metadata.")
      return
    }
    const succeeded = await onExport(selectedDossierIds)
    if (succeeded) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !exporting) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="metadata-export-modal-title"
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <FileSpreadsheet className="size-4" />
            </span>
            <div>
              <h2
                id="metadata-export-modal-title"
                className="text-lg font-semibold text-slate-900"
              >
                Chọn hồ sơ xuất metadata
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                File xuất giữ nguyên cấu trúc hiện tại và bao gồm toàn bộ tài
                liệu thuộc các hồ sơ được chọn.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={exporting}
          >
            <X className="size-4" />
            <span className="sr-only">Đóng</span>
          </Button>
        </div>

        <div className="border-b border-slate-200 p-5">
          <label className="relative block">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <span className="sr-only">Tìm hồ sơ</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm theo số, tiêu đề hoặc số hộp..."
              className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-3 pl-9 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              disabled={loading || exporting}
            />
          </label>
        </div>

        <fieldset className="min-h-0 flex-1 overflow-hidden">
          <legend className="sr-only">Danh sách hồ sơ cần xuất</legend>
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-2.5">
            <span className="text-sm font-medium text-slate-700">
              Đã chọn {selectedDossierIds.length}/{availableDossiers.length} hồ
              sơ
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={toggleVisibleDossiers}
              disabled={loading || exporting || visibleDossiers.length === 0}
            >
              {allVisibleSelected ? "Bỏ chọn kết quả" : "Chọn tất cả kết quả"}
            </Button>
          </div>
          <div className="max-h-[50vh] divide-y divide-slate-100 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-slate-500">
                <Loader2 className="size-4 animate-spin" />
                Đang tải danh sách hồ sơ...
              </div>
            ) : (
              visibleDossiers.map((dossier) => {
                const checked = selectedIds.has(dossier.dossierId)
                return (
                  <label
                    key={dossier.dossierId}
                    className="flex cursor-pointer items-start gap-3 px-5 py-3 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 rounded border-slate-300"
                      checked={checked}
                      disabled={exporting}
                      onChange={() => toggleDossier(dossier.dossierId)}
                    />
                    <span className="min-w-0 flex-1 text-sm text-slate-800">
                      <span className="block truncate font-medium">
                        {dossier.dossierNumber
                          ? `${dossier.dossierNumber} · `
                          : ""}
                        {dossier.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {[
                          dossier.boxNumber
                            ? `Hộp ${dossier.boxNumber}`
                            : "Chưa có số hộp",
                          dossier.documentCount == null
                            ? null
                            : `${dossier.documentCount} tài liệu`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    {checked ? (
                      <Check className="mt-0.5 size-4 shrink-0 text-blue-600" />
                    ) : null}
                  </label>
                )
              })
            )}
            {!loading && visibleDossiers.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-500">
                Không tìm thấy hồ sơ phù hợp.
              </p>
            ) : null}
          </div>
        </fieldset>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={exporting}
          >
            Hủy
          </Button>
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={
              loading ||
              exporting ||
              !sessionId ||
              selectedDossierIds.length === 0
            }
          >
            {exporting ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <FileSpreadsheet data-icon="inline-start" />
            )}
            Xuất metadata cho {selectedDossierIds.length} hồ sơ
          </Button>
        </div>
      </div>
    </div>
  )
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim()
}
