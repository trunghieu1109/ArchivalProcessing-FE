import { type FormEvent, useCallback, useEffect, useState } from "react"
import { AlertTriangle, Check, Loader2, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  listSessionDossiers,
  listSessionDossierBoxNumberConflicts,
  updateSessionDossierBoxNumbers,
  verifySessionDossierBoxNumberConflict,
  type DossierBoxNumberState,
  type NumberingDossierStatus,
} from "@/features/upload/api/sessionApi"

type SelectableDossier = {
  dossier_id: string
  title: string
  dossier_number?: string | null
  box_number?: string | null
}

export function NumberingBoxNumberModal({
  open,
  sessionId,
  dossiers,
  canVerify,
  onClose,
  onChanged,
}: {
  open: boolean
  sessionId: string | null
  dossiers: NumberingDossierStatus[]
  canVerify: boolean
  onClose: () => void
  onChanged: () => void | Promise<unknown>
}) {
  const [selectedDossierIds, setSelectedDossierIds] = useState<string[]>([])
  const [boxNumber, setBoxNumber] = useState("")
  const [availableDossiers, setAvailableDossiers] =
    useState<SelectableDossier[]>(dossiers)
  const [submitting, setSubmitting] = useState(false)
  const [loadingConflicts, setLoadingConflicts] = useState(false)
  const [verifyingConflictId, setVerifyingConflictId] = useState<string | null>(
    null
  )
  const [conflicts, setConflicts] = useState<DossierBoxNumberState[]>([])

  const loadConflicts = useCallback(async () => {
    if (!sessionId) return
    setLoadingConflicts(true)
    try {
      const response = await listSessionDossierBoxNumberConflicts(sessionId)
      setConflicts(response.conflicts)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Không thể tải xung đột số hộp."
      )
    } finally {
      setLoadingConflicts(false)
    }
  }, [sessionId])

  const loadDossiers = useCallback(async () => {
    if (!sessionId) return
    try {
      const response = await listSessionDossiers(sessionId)
      setAvailableDossiers(response.dossiers)
    } catch (error) {
      setAvailableDossiers(dossiers)
      toast.error(
        error instanceof Error
          ? error.message
          : "Không thể tải đầy đủ danh sách hồ sơ."
      )
    }
  }, [dossiers, sessionId])

  useEffect(() => {
    if (!open) return
    queueMicrotask(() => void Promise.all([loadConflicts(), loadDossiers()]))
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [loadConflicts, loadDossiers, onClose, open])

  if (!open) return null

  const toggleDossier = (dossierId: string) => {
    setSelectedDossierIds((current) =>
      current.includes(dossierId)
        ? current.filter((value) => value !== dossierId)
        : [...current, dossierId]
    )
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!sessionId) return
    const normalizedBoxNumber = boxNumber.trim()
    if (selectedDossierIds.length === 0 || !normalizedBoxNumber) {
      toast.error("Vui lòng chọn ít nhất một hồ sơ và nhập số hộp.")
      return
    }

    setSubmitting(true)
    try {
      const response = await updateSessionDossierBoxNumbers(
        sessionId,
        selectedDossierIds,
        normalizedBoxNumber
      )
      const messages = [`Đã cập nhật ${response.updated_dossiers} hồ sơ.`]
      if (response.pending_verification_dossiers > 0) {
        messages.push(
          `${response.pending_verification_dossiers} thay đổi đang chờ coordinator hoặc admin duyệt.`
        )
      }
      toast.success(messages.join(" "))
      setSelectedDossierIds([])
      setBoxNumber("")
      await Promise.all([loadConflicts(), Promise.resolve(onChanged())])
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không thể cập nhật số hộp."
      )
    } finally {
      setSubmitting(false)
    }
  }

  const verify = async (
    dossierId: string,
    conflictId: string,
    action: "accept" | "reject"
  ) => {
    if (!sessionId) return
    setVerifyingConflictId(conflictId)
    try {
      await verifySessionDossierBoxNumberConflict(sessionId, dossierId, {
        action,
        conflict_id: conflictId,
      })
      toast.success(
        action === "accept"
          ? "Đã chấp nhận số hộp được đề xuất."
          : "Đã từ chối số hộp được đề xuất."
      )
      await Promise.all([loadConflicts(), Promise.resolve(onChanged())])
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không thể xác minh số hộp."
      )
    } finally {
      setVerifyingConflictId(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="box-number-modal-title"
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <h2
              id="box-number-modal-title"
              className="text-lg font-semibold text-slate-900"
            >
              Nhập số hộp thủ công
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Chọn một hoặc nhiều hồ sơ rồi gán cùng một số hộp. Hồ sơ không
              được chọn sẽ được giữ nguyên.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            <X className="size-4" />
            <span className="sr-only">Đóng</span>
          </Button>
        </div>

        <form
          className="space-y-4 border-b border-slate-200 p-5"
          onSubmit={submit}
        >
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Số hộp áp dụng chung
            <input
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500"
              value={boxNumber}
              onChange={(event) => setBoxNumber(event.target.value)}
              placeholder="Ví dụ: 12"
            />
          </label>

          <fieldset className="overflow-hidden rounded-xl border border-slate-200">
            <legend className="sr-only">
              Chọn các hồ sơ cùng thuộc số hộp này
            </legend>
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-sm font-medium text-slate-700">
                Chọn hồ sơ ({selectedDossierIds.length}/
                {availableDossiers.length})
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setSelectedDossierIds(
                    availableDossiers.length > 0 &&
                      selectedDossierIds.length === availableDossiers.length
                      ? []
                      : availableDossiers.map((dossier) => dossier.dossier_id)
                  )
                }
              >
                {availableDossiers.length > 0 &&
                selectedDossierIds.length === availableDossiers.length
                  ? "Bỏ chọn tất cả"
                  : "Chọn tất cả"}
              </Button>
            </div>
            <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
              {availableDossiers.map((dossier) => {
                const checked = selectedDossierIds.includes(dossier.dossier_id)
                return (
                  <label
                    key={dossier.dossier_id}
                    className="flex cursor-pointer items-start gap-3 px-3 py-3 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 rounded border-slate-300"
                      checked={checked}
                      onChange={() => toggleDossier(dossier.dossier_id)}
                    />
                    <span className="min-w-0 text-sm text-slate-800">
                      <span className="font-medium">
                        {dossier.dossier_number
                          ? `${dossier.dossier_number} · `
                          : ""}
                        {dossier.title || dossier.dossier_id}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {dossier.box_number
                          ? `Số hộp hiện tại: ${dossier.box_number}`
                          : "Chưa có số hộp"}
                      </span>
                    </span>
                  </label>
                )
              })}
              {availableDossiers.length === 0 ? (
                <p className="px-4 py-5 text-center text-sm text-slate-500">
                  Không có hồ sơ để lựa chọn.
                </p>
              ) : null}
            </div>
          </fieldset>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={
                submitting ||
                !sessionId ||
                selectedDossierIds.length === 0 ||
                !boxNumber.trim()
              }
            >
              {submitting ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <Check data-icon="inline-start" />
              )}
              Gán số hộp cho {selectedDossierIds.length} hồ sơ
            </Button>
          </div>
        </form>

        <section className="space-y-3 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-900">Chờ xác minh</h3>
              <p className="text-sm text-slate-600">
                Số đang dùng được giữ nguyên cho đến khi đề xuất được chấp nhận.
              </p>
            </div>
            {loadingConflicts ? (
              <Loader2 className="size-4 animate-spin text-slate-500" />
            ) : null}
          </div>

          {!loadingConflicts && conflicts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-5 text-center text-sm text-slate-500">
              Không có thay đổi số hộp nào đang chờ xác minh.
            </div>
          ) : null}

          {conflicts.map((item) => {
            const conflict = item.pending_box_number_conflict
            if (!conflict) return null
            const busy = verifyingConflictId === conflict.conflict_id
            const proposer =
              conflict.proposed_by.name ||
              conflict.proposed_by.email ||
              conflict.proposed_by.user_id ||
              "Không rõ người nhập"
            const currentOwner =
              conflict.current_updated_by?.name ||
              conflict.current_updated_by?.email ||
              conflict.current_updated_by?.user_id ||
              "Chưa rõ người nhập"
            return (
              <div
                key={conflict.conflict_id}
                className="rounded-xl border border-amber-200 bg-amber-50 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium text-slate-900">
                      <AlertTriangle className="size-4 shrink-0 text-amber-600" />
                      {item.dossier_number ? `${item.dossier_number} · ` : ""}
                      {item.dossier_title || item.dossier_id}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      Hộp hiện tại:{" "}
                      <strong>{conflict.current_box_number}</strong>
                      {" → "}Đề xuất:{" "}
                      <strong>{conflict.proposed_box_number}</strong>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Người đang được ghi nhận: {currentOwner}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Người đề xuất: {proposer}
                    </p>
                  </div>
                  {canVerify ? (
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          void verify(
                            item.dossier_id,
                            conflict.conflict_id,
                            "reject"
                          )
                        }
                      >
                        Từ chối
                      </Button>
                      <Button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void verify(
                            item.dossier_id,
                            conflict.conflict_id,
                            "accept"
                          )
                        }
                      >
                        {busy ? (
                          <Loader2
                            data-icon="inline-start"
                            className="animate-spin"
                          />
                        ) : null}
                        Chấp nhận
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs font-medium text-amber-700">
                      Chờ coordinator/admin
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </section>
      </div>
    </div>
  )
}
