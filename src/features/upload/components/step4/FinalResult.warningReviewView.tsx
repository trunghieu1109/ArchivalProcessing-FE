import { useMemo, useState, type ReactNode } from "react"
import { FileText, ListChecks } from "lucide-react"
import type { SessionDossierSuggestion } from "@/features/upload/api/sessionApi"
import type {
  ClusterDocument,
  ClusterGroup,
} from "@/features/upload/lib/clusterGroups"
import { cn } from "@/shared/lib/utils"
import { metadataText } from "./FinalResult.metadataUtils"
import {
  isActiveWarningDocument,
  warningDocumentEntries,
  warningSuggestionKey,
} from "./FinalResult.warningReview"
import { WarningSuggestionList } from "./FinalResult.warningSuggestionList"
import {
  clusterWarningLevelClass,
  clusterWarningLevelLabel,
  clusterWarningMessages,
} from "./FinalResult.warningUtils"

interface WarningDocumentsReviewProps {
  groups: ClusterGroup[]
  selectedDocumentId: number | null
  suggestions: SessionDossierSuggestion[] | null
  suggestionsLoading: boolean
  suggestionsError: string
  moveDisabled: boolean
  onSelectSuggestions: (document: ClusterDocument) => void
  onMoveSuggestion: (suggestion: SessionDossierSuggestion) => Promise<boolean>
}

export function WarningDocumentsReview({
  groups,
  selectedDocumentId,
  suggestions,
  suggestionsLoading,
  suggestionsError,
  moveDisabled,
  onSelectSuggestions,
  onMoveSuggestion,
}: WarningDocumentsReviewProps) {
  const warningEntries = useMemo(() => warningDocumentEntries(groups), [groups])
  const activeWarningCount = useMemo(
    () =>
      warningEntries.filter(({ document }) => isActiveWarningDocument(document))
        .length,
    [warningEntries]
  )
  const adjustedWarningCount = warningEntries.length - activeWarningCount
  const [movingSuggestionKey, setMovingSuggestionKey] = useState<string | null>(
    null
  )
  const selectedWarningEntry =
    warningEntries.find(
      ({ document }) =>
        document.sessionDocumentId === selectedDocumentId &&
        isActiveWarningDocument(document)
    ) ?? null

  const handleMove = async (suggestion: SessionDossierSuggestion) => {
    const key = warningSuggestionKey(suggestion)
    setMovingSuggestionKey(key)
    try {
      await onMoveSuggestion(suggestion)
    } finally {
      setMovingSuggestionKey(null)
    }
  }

  return (
    <section aria-label="Gợi ý điều chỉnh hồ sơ" className="space-y-3">
      <div className="flex flex-col gap-2 rounded-xl border border-[#BFD3FF] bg-[#F8FAFF] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2.5">
          <ListChecks className="mt-0.5 size-4 shrink-0 text-[#0052FF]" />
          <div>
            <p className="text-sm font-semibold text-[#0F172A]">
              Rà soát các gợi ý điều chỉnh
            </p>
            <p className="mt-0.5 text-xs leading-5 text-[#475569]">
              Hệ thống đề xuất một số tài liệu nên được xem xét. Chọn tài liệu,
              sau đó mở hồ sơ gợi ý để đối chiếu metadata trước khi điều chỉnh.
            </p>
          </div>
        </div>
        <span className="flex shrink-0 flex-wrap items-center gap-1.5">
          <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
            {activeWarningCount} tài liệu cần kiểm tra
          </span>
          {adjustedWarningCount > 0 ? (
            <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
              {adjustedWarningCount} đã điều chỉnh
            </span>
          ) : null}
        </span>
      </div>

      <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(320px,0.72fr)_minmax(560px,1.48fr)]">
        <ReviewPanel
          title="Tài liệu cần xem xét"
          subtitle="Chọn tài liệu để xem hồ sơ phù hợp"
          warning
        >
          {warningEntries.length > 0 ? (
            <div className="flex flex-col gap-2">
              {warningEntries.map(({ document, sourceGroup }) => {
                const warning = document.clusterWarning!
                const feedbackAction = document.pendingFeedback?.action
                const adjusted = !isActiveWarningDocument(document)
                const adjustedLabel =
                  feedbackAction === "manual_move"
                    ? "Đã chuyển"
                    : "Đã điều chỉnh"
                const selected =
                  document.sessionDocumentId !== null &&
                  document.sessionDocumentId === selectedDocumentId
                const summary = metadataText(document.metadata, [
                  "document_summary",
                  "trich_yeu_van_ban",
                  "title",
                ])
                return (
                  <button
                    key={`${sourceGroup.id}:${document.documentId}`}
                    type="button"
                    disabled={document.sessionDocumentId === null || adjusted}
                    aria-label={`Xem hồ sơ gợi ý cho ${document.fileName}`}
                    className={cn(
                      "w-full min-w-0 rounded-xl border p-3 text-left transition-colors",
                      selected
                        ? "border-[#0052FF] bg-[#F0F5FF] ring-2 ring-[#0052FF]/10"
                        : "border-[#E2E8F0] bg-white hover:border-blue-300 hover:bg-blue-50/40",
                      "disabled:cursor-default disabled:bg-slate-50 disabled:opacity-80"
                    )}
                    onClick={() => onSelectSuggestions(document)}
                  >
                    <span className="flex min-w-0 items-start gap-2.5">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                        <FileText className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[#0F172A]">
                          {document.fileName}
                        </span>
                        {summary ? (
                          <span className="mt-1 line-clamp-2 block text-xs leading-5 text-[#64748B]">
                            {summary}
                          </span>
                        ) : null}
                      </span>
                      <ListChecks
                        className={cn(
                          "mt-1 size-4 shrink-0",
                          adjusted ? "text-emerald-600" : "text-amber-600"
                        )}
                      />
                    </span>
                    <span className="mt-2 flex flex-wrap items-center gap-1.5">
                      {adjusted ? (
                        <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                          {adjustedLabel}
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                            clusterWarningLevelClass(warning.riskLevel)
                          )}
                        >
                          {clusterWarningLevelLabel(warning.riskLevel)}
                        </span>
                      )}
                      <span className="max-w-full truncate rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-medium text-[#475569]">
                        Hồ sơ hiện tại: {sourceGroup.label}
                      </span>
                    </span>
                    <span className="mt-2 line-clamp-2 block text-xs leading-5 text-[#64748B]">
                      {clusterWarningMessages(warning)[0]}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <EmptyState text="Không còn tài liệu nào được đề xuất xem xét." />
          )}
        </ReviewPanel>

        <ReviewPanel
          title="Hồ sơ được gợi ý"
          subtitle={
            selectedWarningEntry
              ? selectedWarningEntry.document.fileName
              : "Chưa chọn tài liệu"
          }
          suggestion
        >
          <WarningSuggestionList
            groups={groups}
            suggestions={suggestions}
            loading={suggestionsLoading}
            error={suggestionsError}
            hasSelectedDocument={selectedWarningEntry !== null}
            moveDisabled={moveDisabled || movingSuggestionKey !== null}
            movingSuggestionKey={movingSuggestionKey}
            onMove={(suggestion) => void handleMove(suggestion)}
          />
        </ReviewPanel>
      </div>
    </section>
  )
}

function ReviewPanel({
  title,
  subtitle,
  warning = false,
  suggestion = false,
  children,
}: {
  title: string
  subtitle: string
  warning?: boolean
  suggestion?: boolean
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-2xl border bg-white shadow-sm",
        warning ? "border-[#BFD3FF]" : "border-[#D8E1EC]"
      )}
    >
      <div
        className={cn(
          "border-b px-4 py-3",
          warning
            ? "border-[#BFD3FF] bg-[#F8FAFF]"
            : "border-[#BFD3FF] bg-[#F0F5FF]"
        )}
      >
        <div className="flex items-center gap-2">
          <ListChecks className="size-4 text-[#0052FF]" />
          <h3 className="min-w-0 truncate text-sm font-semibold text-[#0F172A]">
            {title}
          </h3>
        </div>
        <p className="mt-1 truncate text-xs text-[#64748B]" title={subtitle}>
          {subtitle}
        </p>
      </div>
      <div
        className={cn(
          "h-[min(74svh,640px)] min-h-[420px] overflow-y-auto p-3",
          suggestion && "p-4"
        )}
      >
        {children}
      </div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-5 text-center text-sm text-[#64748B]">
      {text}
    </div>
  )
}
