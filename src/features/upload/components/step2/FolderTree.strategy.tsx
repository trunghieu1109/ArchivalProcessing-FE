import { Archive, ChevronRight, FolderKanban, Zap } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import type { DossierBuildStrategy } from "@/features/upload/api/sessionApi"
import type {
  FileRegisterConfig,
  FileRegisterTimeGranularity,
} from "@/features/upload/types"
import { DossierTitleMappingPreview } from "./DossierTitleMappingPreview"

interface DossierBuildStrategySectionProps {
  sessionId?: string | null
  readOnly: boolean
  dossierBuildStrategy: DossierBuildStrategy
  dossierTitleCatalogMappingCount?: number
  fileRegisterConfig: FileRegisterConfig
  onDossierBuildStrategyChange: (strategy: DossierBuildStrategy) => void
  onFileRegisterConfigChange: (
    config: FileRegisterConfig
  ) => void | Promise<void>
}

export function DossierBuildStrategySection({
  sessionId = null,
  readOnly,
  dossierBuildStrategy,
  dossierTitleCatalogMappingCount = 0,
  fileRegisterConfig,
  onDossierBuildStrategyChange,
  onFileRegisterConfigChange,
}: DossierBuildStrategySectionProps) {
  const groupByDocumentType =
    fileRegisterConfig.steps[0]?.criterion === "document_type"
  const timeGranularity =
    fileRegisterConfig.steps.find((step) => step.criterion === "issued_date")
      ?.granularity ?? "year"
  const analysisStatusLabel =
    fileRegisterConfig.analysis_status === "detected"
      ? "Đã nhận diện"
      : fileRegisterConfig.analysis_status === "ambiguous"
        ? "Cần rà soát"
        : "Mặc định"

  const updateFileRegisterConfig = (
    patch: Partial<{
      groupByDocumentType: boolean
      timeGranularity: FileRegisterTimeGranularity
      mergeSmallDossiers: boolean
    }>
  ) => {
    const nextGroupByDocumentType =
      patch.groupByDocumentType ?? groupByDocumentType
    const nextGranularity = patch.timeGranularity ?? timeGranularity
    void onFileRegisterConfigChange({
      ...fileRegisterConfig,
      steps: nextGroupByDocumentType
        ? [
            { criterion: "document_type" },
            { criterion: "issued_date", granularity: nextGranularity },
          ]
        : [{ criterion: "issued_date", granularity: nextGranularity }],
      merge_small_dossiers:
        patch.mergeSmallDossiers ?? fileRegisterConfig.merge_small_dossiers,
    })
  }

  return (
    <section
      className="rounded-2xl border border-[#D8E1EC] bg-white px-5 py-5 shadow-sm"
      aria-labelledby="dossier-build-strategy-title"
    >
      <div>
        <p
          id="dossier-build-strategy-title"
          className="text-sm font-semibold text-[#0F172A]"
        >
          Cách thức lập hồ sơ
        </p>
        <p className="mt-1 text-sm text-[#64748B]">
          Lựa chọn này sẽ quyết định cách hệ thống gom nhóm tài liệu khi lập hồ
          sơ.
        </p>
      </div>
      <div
        className="mt-4 grid gap-3 md:grid-cols-3"
        role="radiogroup"
        aria-label="Cách thức lập hồ sơ"
      >
        <button
          type="button"
          role="radio"
          aria-checked={dossierBuildStrategy === "incremental"}
          disabled={readOnly}
          onClick={() => onDossierBuildStrategyChange("incremental")}
          className={cn(
            "flex min-h-32 items-start gap-4 rounded-2xl border p-4 text-left transition-all focus-visible:ring-2 focus-visible:ring-[#0052FF] focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-100",
            dossierBuildStrategy === "incremental"
              ? "border-[#0052FF] bg-[#EEF4FF] shadow-[0_8px_24px_rgba(0,82,255,0.10)]"
              : "border-[#D8E1EC] bg-white hover:border-[#0052FF]/40 hover:bg-[#F8FAFC]"
          )}
        >
          <span
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-xl",
              dossierBuildStrategy === "incremental"
                ? "bg-[#0052FF] text-white"
                : "bg-[#EEF2F7] text-[#475569]"
            )}
          >
            <FolderKanban className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-[#0F172A]">
                Lập hồ sơ theo vụ việc
              </span>
              <span className="rounded-full bg-[#DBEAFE] px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#1D4ED8] uppercase">
                Mặc định
              </span>
            </span>
            <span className="mt-1.5 block text-sm leading-6 text-[#64748B]">
              Phân tích nội dung và mối liên hệ giữa các tài liệu để gom thành
              từng hồ sơ vụ việc.
            </span>
          </span>
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={dossierBuildStrategy === "file_register"}
          disabled={readOnly}
          onClick={() => onDossierBuildStrategyChange("file_register")}
          className={cn(
            "flex min-h-32 items-start gap-4 rounded-2xl border p-4 text-left transition-all focus-visible:ring-2 focus-visible:ring-[#0052FF] focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-100",
            dossierBuildStrategy === "file_register"
              ? "border-[#0052FF] bg-[#EEF4FF] shadow-[0_8px_24px_rgba(0,82,255,0.10)]"
              : "border-[#D8E1EC] bg-white hover:border-[#0052FF]/40 hover:bg-[#F8FAFC]"
          )}
        >
          <span
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-xl",
              dossierBuildStrategy === "file_register"
                ? "bg-[#0052FF] text-white"
                : "bg-[#EEF2F7] text-[#475569]"
            )}
          >
            <Archive className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="font-semibold text-[#0F172A]">
              Lập hồ sơ theo dạng tập lưu
            </span>
            <span className="mt-1.5 block text-sm leading-6 text-[#64748B]">
              Gom theo loại văn bản, năm ban hành, sắp xếp theo thời gian và
              chia thành các tập hồ sơ.
            </span>
          </span>
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={dossierBuildStrategy === "predefined"}
          disabled={readOnly}
          onClick={() => onDossierBuildStrategyChange("predefined")}
          className={cn(
            "flex min-h-32 items-start gap-4 rounded-2xl border p-4 text-left transition-all focus-visible:ring-2 focus-visible:ring-[#0052FF] focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-100",
            dossierBuildStrategy === "predefined"
              ? "border-[#0052FF] bg-[#EEF4FF] shadow-[0_8px_24px_rgba(0,82,255,0.10)]"
              : "border-[#D8E1EC] bg-white hover:border-[#0052FF]/40 hover:bg-[#F8FAFC]"
          )}
        >
          <span
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-xl",
              dossierBuildStrategy === "predefined"
                ? "bg-[#0052FF] text-white"
                : "bg-[#EEF2F7] text-[#475569]"
            )}
          >
            <Zap className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="font-semibold text-[#0F172A]">
              Lập hồ sơ nhanh
            </span>
            <span className="mt-1.5 block text-sm leading-6 text-[#64748B]">
              Tạo kết quả lập hồ sơ nhanh với ít bước xử lý, phù hợp để tiếp tục
              rà soát và hoàn thiện.
            </span>
          </span>
        </button>
      </div>

      {dossierBuildStrategy === "predefined" && (
        <DossierTitleMappingPreview
          sessionId={sessionId}
          mappingCount={dossierTitleCatalogMappingCount}
        />
      )}

      {dossierBuildStrategy === "file_register" && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-[#BFD3FF] bg-[#F8FAFF]">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#DCE7FF] px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-[#0F172A]">
                  Cấu hình tập lưu
                </p>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    fileRegisterConfig.analysis_status === "detected"
                      ? "bg-[#DCFCE7] text-[#15803D]"
                      : fileRegisterConfig.analysis_status === "ambiguous"
                        ? "bg-[#FEF3C7] text-[#A16207]"
                        : "bg-[#E2E8F0] text-[#475569]"
                  )}
                >
                  {analysisStatusLabel}
                </span>
              </div>
              <p className="mt-1 line-clamp-1 text-xs text-[#64748B]">
                {fileRegisterConfig.summary ||
                  "Không tìm thấy quy tắc rõ ràng, đang áp dụng cấu hình mặc định."}
              </p>
            </div>
          </div>

          <div className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(260px,1.6fr)_minmax(140px,0.7fr)_auto] md:items-end">
            <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-[#475569]">
              Thứ tự phân chia
              <select
                value={groupByDocumentType ? "document_type" : "issued_date"}
                disabled={readOnly}
                onChange={(event) =>
                  updateFileRegisterConfig({
                    groupByDocumentType: event.target.value === "document_type",
                  })
                }
                className="h-9 min-w-0 rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm font-medium text-[#0F172A] transition-colors outline-none focus:border-[#0052FF] disabled:cursor-not-allowed"
              >
                <option value="document_type">Loại văn bản → thời gian</option>
                <option value="issued_date">Chỉ theo thời gian</option>
              </select>
            </label>

            <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-[#475569]">
              Chu kỳ
              <select
                value={timeGranularity}
                disabled={readOnly}
                onChange={(event) =>
                  updateFileRegisterConfig({
                    timeGranularity: event.target
                      .value as FileRegisterTimeGranularity,
                  })
                }
                className="h-9 min-w-0 rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm font-medium text-[#0F172A] transition-colors outline-none focus:border-[#0052FF] disabled:cursor-not-allowed"
              >
                <option value="year">Năm</option>
                <option value="quarter">Quý</option>
                <option value="month">Tháng</option>
              </select>
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-[#475569]">
                Gộp hồ sơ nhỏ
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={fileRegisterConfig.merge_small_dossiers}
                aria-label="Gộp các hồ sơ nhỏ liên tiếp"
                onClick={() =>
                  updateFileRegisterConfig({
                    mergeSmallDossiers:
                      !fileRegisterConfig.merge_small_dossiers,
                  })
                }
                className={cn(
                  "flex h-9 w-12 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed",
                  fileRegisterConfig.merge_small_dossiers
                    ? "border-[#AFC7FF] bg-[#EEF4FF] text-[#0052FF]"
                    : "border-[#CBD5E1] bg-white text-[#64748B]"
                )}
                disabled={readOnly}
              >
                <span
                  className={cn(
                    "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                    fileRegisterConfig.merge_small_dossiers
                      ? "bg-[#0052FF]"
                      : "bg-[#CBD5E1]"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-sm transition-transform",
                      fileRegisterConfig.merge_small_dossiers
                        ? "translate-x-4"
                        : "translate-x-0"
                    )}
                  />
                </span>
                <span className="sr-only">
                  {fileRegisterConfig.merge_small_dossiers ? "Bật" : "Tắt"}
                </span>
              </button>
            </div>
          </div>

          {fileRegisterConfig.evidence.length > 0 && (
            <details className="group border-t border-[#DCE7FF] bg-white/50 px-4 py-2.5">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold text-[#475569]">
                <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
                Xem căn cứ phân tích ({fileRegisterConfig.evidence.length})
              </summary>
              <ul className="mt-2 space-y-1 pl-5 text-xs leading-5 text-[#64748B]">
                {fileRegisterConfig.evidence.map((evidence, index) => (
                  <li key={`${evidence}-${index}`} className="list-disc">
                    {evidence}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  )
}
