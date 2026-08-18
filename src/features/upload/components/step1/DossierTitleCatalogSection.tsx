import { useState } from "react"
import { AlertCircle, FileSpreadsheet, Info } from "lucide-react"
import { DropZone } from "./DropZone"
import { FileChip } from "./FileChip"
import type { SessionInputUploadResponse } from "@/features/upload/api/sessionApi"

interface DossierTitleCatalogSectionProps {
  draftFile: File | null
  upload: SessionInputUploadResponse | null
  disabled?: boolean
  onSelect: (file: File) => Promise<SessionInputUploadResponse | void>
  onClear: () => Promise<void>
}

export function DossierTitleCatalogSection({
  draftFile,
  upload,
  disabled = false,
  onSelect,
  onClear,
}: DossierTitleCatalogSectionProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const fileName = draftFile?.name ?? upload?.file_name ?? ""
  const hasFile = Boolean(fileName)

  const handleFile = async (file: File) => {
    if (disabled || loading) return
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setError("Chỉ hỗ trợ file .xlsx.")
      return
    }
    setError("")
    setLoading(true)
    try {
      await onSelect(file)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không thể tải lên file dữ liệu."
      )
    } finally {
      setLoading(false)
    }
  }

  const handleClear = async () => {
    if (disabled || loading) return
    setError("")
    setLoading(true)
    try {
      await onClear()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không thể xóa file dữ liệu."
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-2xl border border-[#D8E1EC] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
            <FileSpreadsheet className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold text-[#0F172A]">Upload dữ liệu</p>
            <p className="mt-1 text-sm leading-6 text-[#64748B]">
              Tải lên file dữ liệu phục vụ Lập hồ sơ nhanh. Hệ thống sẽ phân tích
              dữ liệu trong file để hỗ trợ quá trình lập hồ sơ.
            </p>
          </div>
        </div>

        <div className="w-full lg:max-w-md">
          {hasFile ? (
            <FileChip
              fileName={fileName}
              loading={loading}
              processState={upload ? "done" : "idle"}
              onClear={() => void handleClear()}
              icon={<FileSpreadsheet className="size-4" />}
            />
          ) : (
            <DropZone
              accept=".xlsx"
              onFile={(file) => void handleFile(file)}
              label="Tải file dữ liệu"
              hint=".xlsx"
              maxSize="10MB"
              compact
            />
          )}
        </div>
      </div>

      {upload?.mapping_count != null && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
          <Info className="size-3.5 shrink-0" />
          Đã phân tích thành công file dữ liệu:{" "}
          {upload.mapping_count.toLocaleString("vi-VN")} bản ghi hợp lệ.
        </div>
      )}
      {(upload?.warnings ?? []).map((warning, index) => (
        <div
          key={`${warning}-${index}`}
          className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900"
        >
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <span>{warning}</span>
        </div>
      ))}
      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium whitespace-pre-line text-destructive">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </section>
  )
}
