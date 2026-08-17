import { CheckCircle2, Loader2, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { DossierTitleCandidate } from "@/features/upload/api/sessionApi"
import { cn } from "@/shared/lib/utils"

const TITLE_KIND_LABELS: Record<string, string> = {
  case_work: "Hồ sơ vụ việc",
  conference: "Hồ sơ hội nghị",
  file_register: "Tập lưu",
  generic: "Hồ sơ tổng quát",
  legacy: "Tiêu đề chính hiện tại",
  named_people: "Theo tên người",
  periodic_report: "Báo cáo định kỳ",
  thematic_plan_report: "Hồ sơ chuyên đề",
  type_led: "Theo loại văn bản",
}

export function DossierTitleCandidatePanel({
  candidates,
  currentTitle,
  saving,
  onClose,
  onSelect,
}: {
  candidates: DossierTitleCandidate[]
  currentTitle: string
  saving: boolean
  onClose: () => void
  onSelect: (candidate: DossierTitleCandidate) => void
}) {
  const normalizedCurrentTitle = normalizeTitle(currentTitle)

  return (
    <div className="absolute inset-x-3 top-16 bottom-3 z-40 flex flex-col overflow-hidden rounded-xl border border-[#CBD5E1] bg-white shadow-2xl">
      <div className="flex items-start justify-between gap-3 border-b border-[#E2E8F0] px-4 py-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#0F172A]">
            <Sparkles className="size-4 text-[#0052FF]" />
            Gợi ý tiêu đề hồ sơ
          </p>
          <p className="mt-0.5 text-[11px] leading-5 text-[#64748B]">
            Chọn một phương án để dùng làm tiêu đề chính. Phương án đầu tiên là
            tiêu đề chính do hệ thống sinh ban đầu.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Đóng gợi ý tiêu đề"
          onClick={onClose}
        >
          <X className="size-3.5" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#F8FAFC] p-3">
        {candidates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#CBD5E1] bg-white px-3 py-8 text-center text-sm text-[#64748B]">
            Hồ sơ này chưa có phương án tiêu đề. Hãy sinh lại hồ sơ để tạo gợi
            ý.
          </div>
        ) : (
          <div className="space-y-2">
            {candidates.map((candidate, index) => {
              const isCurrent =
                normalizeTitle(candidate.title) === normalizedCurrentTitle
              const isInitial = index === 0 || candidate.selected
              return (
                <button
                  key={`${candidate.kind}-${index}-${candidate.title}`}
                  type="button"
                  aria-pressed={isCurrent}
                  disabled={saving || isCurrent}
                  className={cn(
                    "w-full rounded-lg border bg-white p-3 text-left shadow-sm transition hover:border-[#0052FF] hover:bg-[#F8FBFF] focus-visible:ring-2 focus-visible:ring-[#0052FF] focus-visible:outline-none disabled:cursor-not-allowed",
                    isCurrent
                      ? "border-[#0052FF] bg-[#F8FBFF]"
                      : "border-[#D8E1EC]",
                    saving && "opacity-60"
                  )}
                  onClick={() => onSelect(candidate)}
                >
                  <div className="mb-1.5 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-[#EAF1FF] px-2 py-0.5 text-[10px] font-semibold text-[#0052FF]">
                        Phương án {index + 1}
                      </span>
                      <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-medium text-[#475569]">
                        {TITLE_KIND_LABELS[candidate.kind] || candidate.kind}
                      </span>
                      {isInitial && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                          Đề xuất chính ban đầu
                        </span>
                      )}
                    </div>
                    {saving && !isCurrent ? (
                      <Loader2 className="size-4 shrink-0 animate-spin text-[#0052FF]" />
                    ) : isCurrent ? (
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                    ) : null}
                  </div>
                  <p className="text-xs leading-5 font-medium [overflow-wrap:anywhere] text-[#0F172A]">
                    {candidate.title}
                  </p>
                  {isCurrent && (
                    <p className="mt-1 text-[10px] font-medium text-emerald-700">
                      Đang được dùng làm tiêu đề chính
                    </p>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function normalizeTitle(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("vi")
}
