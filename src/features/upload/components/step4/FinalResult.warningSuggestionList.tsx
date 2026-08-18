import { useState } from "react"
import {
  ChevronDown,
  ChevronRight,
  FileText,
  FolderInput,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import type { SessionDossierSuggestion } from "@/features/upload/api/sessionApi"
import type {
  ClusterDocument,
  ClusterGroup,
} from "@/features/upload/lib/clusterGroups"
import { cn } from "@/shared/lib/utils"
import { metadataText } from "./FinalResult.metadataUtils"
import { warningSuggestionKey } from "./FinalResult.warningReview"

interface WarningSuggestionListProps {
  groups: ClusterGroup[]
  suggestions: SessionDossierSuggestion[] | null
  loading: boolean
  error: string
  hasSelectedDocument: boolean
  moveDisabled: boolean
  movingSuggestionKey: string | null
  onMove: (suggestion: SessionDossierSuggestion) => void
}

const DOCUMENT_METADATA_FIELDS: Array<{
  label: string
  aliases: string[]
}> = [
  {
    label: "Trích yếu",
    aliases: ["document_summary", "trich_yeu_van_ban", "title", "long_summary"],
  },
  {
    label: "Loại tài liệu",
    aliases: ["document_type", "loai_van_ban", "loai_tai_lieu"],
  },
  {
    label: "Số, ký hiệu",
    aliases: [
      "document_number",
      "document_number_part",
      "so_ky_hieu",
      "so_hieu_tai_lieu",
    ],
  },
  {
    label: "Ngày ban hành",
    aliases: ["issued_date", "ngay_ban_hanh", "ngay_thang_van_ban"],
  },
  {
    label: "Cơ quan ban hành",
    aliases: ["issuing_agency", "co_quan_ban_hanh", "don_vi_ban_hanh"],
  },
  { label: "Người ký", aliases: ["signer", "nguoi_ky", "nguoi ky"] },
  {
    label: "Đối tượng trực tiếp",
    aliases: ["direct_target_subject", "doi_tuong_truc_tiep"],
  },
  {
    label: "Chủ thể được nhắc đến",
    aliases: ["mentioned_subjects", "chu_the_duoc_nhac_den"],
  },
]

export function WarningSuggestionList({
  groups,
  suggestions,
  loading,
  error,
  hasSelectedDocument,
  moveDisabled,
  movingSuggestionKey,
  onMove,
}: WarningSuggestionListProps) {
  const [openSuggestionKeys, setOpenSuggestionKeys] = useState<Set<string>>(
    () => new Set()
  )
  const [openDocumentKeys, setOpenDocumentKeys] = useState<Set<string>>(
    () => new Set()
  )

  if (!hasSelectedDocument) {
    return (
      <EmptyState text="Chọn một tài liệu cần xem xét để tải danh sách hồ sơ gợi ý." />
    )
  }

  const toggleSuggestion = (key: string) => {
    setOpenSuggestionKeys((current) => toggledSet(current, key))
  }
  const toggleDocument = (key: string) => {
    setOpenDocumentKeys((current) => toggledSet(current, key))
  }

  return (
    <div className="flex flex-col gap-3">
      {loading ? (
        <div className="flex items-center gap-2 rounded-lg border border-[#BFD3FF] bg-[#F8FAFF] px-3 py-2 text-xs text-[#0052FF]">
          <Loader2 className="size-3.5 animate-spin" />
          Đang tính danh sách hồ sơ phù hợp...
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          {error}
        </div>
      ) : null}
      {suggestions?.map((suggestion) => {
        const key = warningSuggestionKey(suggestion)
        const dossier = dossierForSuggestion(groups, suggestion)
        const moving = movingSuggestionKey === key
        const expanded = openSuggestionKeys.has(key)
        const documentCount =
          dossier?.documents.length ?? suggestion.document_count
        return (
          <article
            key={key}
            className="overflow-hidden rounded-xl border border-[#C9D8EE] bg-white shadow-sm"
          >
            <button
              type="button"
              className="flex w-full min-w-0 items-start gap-3 p-4 text-left transition-colors hover:bg-[#F8FAFF]"
              aria-expanded={expanded}
              aria-label={`${expanded ? "Thu gọn" : "Xem"} tài liệu trong hồ sơ ${
                dossier?.label || suggestion.title || suggestion.dossier_id
              }`}
              onClick={() => toggleSuggestion(key)}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#EAF1FF] text-xs font-bold text-[#0052FF]">
                {suggestion.rank}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold break-words text-[#0F172A]">
                  {dossier?.label || suggestion.title || suggestion.dossier_id}
                </span>
                <span className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-bold text-[#0052FF]">
                    {formatSimilarity(suggestion)} tương đồng
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 font-bold text-[#334155]">
                    {documentCount} tài liệu
                  </span>
                  <span className="text-[#64748B]">Nhấn để xem metadata</span>
                </span>
              </span>
              {expanded ? (
                <ChevronDown className="mt-1 size-4 shrink-0 text-[#0052FF]" />
              ) : (
                <ChevronRight className="mt-1 size-4 shrink-0 text-[#64748B]" />
              )}
            </button>

            <div className="border-t border-[#E2E8F0] px-4 py-3">
              {dossier ? (
                <dl className="grid gap-2 text-[11px] sm:grid-cols-3">
                  <DossierFact
                    label="Thời hạn"
                    value={dossier.retentionPeriod}
                  />
                  <DossierFact label="Từ ngày" value={dossier.startDate} />
                  <DossierFact label="Đến ngày" value={dossier.endDate} />
                </dl>
              ) : (
                <p className="text-xs text-[#64748B]">
                  Chưa ánh xạ được hồ sơ này vào dữ liệu hiện tại.
                </p>
              )}
            </div>

            {expanded ? (
              <div className="border-t border-[#B8C8DC] bg-[#EAF0F7] p-3">
                <p className="mb-2 text-[11px] font-bold tracking-wide text-[#475569] uppercase">
                  Danh sách tài liệu và metadata
                </p>
                {dossier?.documents.length ? (
                  <div className="space-y-2">
                    {dossier.documents.map((document) => {
                      const documentKey = `${key}:${document.documentId}`
                      return (
                        <SuggestedDossierDocument
                          key={documentKey}
                          document={document}
                          expanded={openDocumentKeys.has(documentKey)}
                          onToggle={() => toggleDocument(documentKey)}
                        />
                      )
                    })}
                  </div>
                ) : (
                  <RepresentativeDocumentFallback suggestion={suggestion} />
                )}
              </div>
            ) : null}

            <div className="border-t border-[#E2E8F0] bg-white p-3">
              <Button
                type="button"
                size="sm"
                className="w-full gap-1.5 sm:w-auto"
                disabled={moveDisabled || !dossier}
                title={
                  dossier
                    ? "Ghi nhận chuyển tài liệu tới hồ sơ này"
                    : "Không tìm thấy hồ sơ đích trong dữ liệu hiện tại"
                }
                onClick={() => onMove(suggestion)}
              >
                {moving ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                ) : (
                  <FolderInput data-icon="inline-start" />
                )}
                {moving ? "Đang chuyển..." : "Chuyển tới hồ sơ này"}
              </Button>
            </div>
          </article>
        )
      })}
      {!loading && suggestions !== null && suggestions.length === 0 ? (
        <EmptyState text="Không tìm thấy hồ sơ phù hợp cho tài liệu này." />
      ) : null}
    </div>
  )
}

function SuggestedDossierDocument({
  document,
  expanded,
  onToggle,
}: {
  document: ClusterDocument
  expanded: boolean
  onToggle: () => void
}) {
  const summary = metadataText(document.metadata, [
    "document_summary",
    "trich_yeu_van_ban",
    "title",
    "long_summary",
  ])
  const metadata = DOCUMENT_METADATA_FIELDS.map((field) => ({
    label: field.label,
    value: metadataValue(document.metadata, field.aliases),
  })).filter((field) => field.value)

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-white shadow-sm",
        expanded
          ? "border-[#7EA6FF] ring-1 ring-[#0052FF]/10"
          : "border-[#B8C8DC]"
      )}
    >
      <button
        type="button"
        className="flex w-full min-w-0 items-start gap-2.5 p-3 text-left hover:bg-[#F8FAFC]"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <FileText className="mt-0.5 size-4 shrink-0 text-[#0052FF]" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-[#1E293B]">
            {document.fileName}
          </span>
          {summary ? (
            <span className="mt-1 line-clamp-2 block text-[11px] leading-4 text-[#64748B]">
              {summary}
            </span>
          ) : null}
        </span>
        {expanded ? (
          <ChevronDown className="size-3.5 shrink-0 text-[#0052FF]" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0 text-[#64748B]" />
        )}
      </button>
      {expanded ? (
        <div className="border-t border-[#B8C8DC] bg-[#EEF3F8] p-3">
          <dl className="grid gap-2 sm:grid-cols-2">
            {metadata.map((field) => (
              <div
                key={field.label}
                className={cn(
                  "rounded-lg border border-[#C2CEDD] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
                  field.label === "Trích yếu" && "sm:col-span-2"
                )}
              >
                <dt className="text-[10px] font-bold tracking-wide text-[#64748B] uppercase">
                  {field.label}
                </dt>
                <dd className="mt-1 text-xs leading-5 font-medium break-words whitespace-pre-wrap text-[#0F172A]">
                  {field.value}
                </dd>
              </div>
            ))}
          </dl>
          {metadata.length === 0 ? (
            <p className="text-xs text-[#94A3B8] italic">
              Tài liệu chưa có metadata để hiển thị.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function RepresentativeDocumentFallback({
  suggestion,
}: {
  suggestion: SessionDossierSuggestion
}) {
  if (suggestion.representative_documents.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-[#CBD5E1] bg-white p-3 text-xs text-[#64748B]">
        Hồ sơ hiện chưa có danh sách tài liệu để hiển thị.
      </p>
    )
  }
  return (
    <div className="space-y-2">
      {suggestion.representative_documents.map((document) => (
        <div
          key={`${document.session_document_id}:${document.document_id}`}
          className="rounded-lg border border-[#D8E1EC] bg-white p-3"
        >
          <p className="text-xs font-semibold text-[#1E293B]">
            {document.file_name || document.title || document.document_id}
          </p>
          <p className="mt-1 text-[11px] text-[#64748B]">
            {[document.document_number, document.issued_date]
              .filter(Boolean)
              .join(" · ") || "Chưa có metadata chi tiết"}
          </p>
        </div>
      ))}
    </div>
  )
}

function DossierFact({
  label,
  value,
}: {
  label: string
  value?: string | null
}) {
  return (
    <div className="min-w-0 rounded-lg border border-[#D8E1EC] bg-[#F1F5F9] px-3 py-2.5">
      <dt className="font-semibold text-[#64748B]">{label}</dt>
      <dd className="mt-1 truncate text-xs font-bold text-[#0F172A]">
        {value || "Chưa có"}
      </dd>
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

function dossierForSuggestion(
  groups: ClusterGroup[],
  suggestion: SessionDossierSuggestion
): ClusterGroup | null {
  return (
    groups.find(
      (group) =>
        !group.isTemporary &&
        (group.id === suggestion.dossier_id ||
          group.dossierId === suggestion.dossier_id ||
          group.dossierStorageId === suggestion.dossier_id)
    ) ??
    groups.find(
      (group) =>
        !group.isTemporary &&
        (group.clusterId === suggestion.cluster_id ||
          group.id === suggestion.cluster_id)
    ) ??
    null
  )
}

function formatSimilarity(suggestion: SessionDossierSuggestion): string {
  const similarity = Math.max(
    0,
    Math.min(
      100,
      Number(
        suggestion.average_similarity ?? suggestion.best_other_similarity ?? 0
      ) * 100
    )
  )
  return similarity.toFixed(1) + "%"
}

function metadataValue(
  metadata: Record<string, unknown>,
  aliases: string[]
): string {
  for (const alias of aliases) {
    const value = metadata[alias]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value))
      return String(value)
    if (Array.isArray(value) && value.length > 0) {
      return value.map((item) => String(item)).join(", ")
    }
  }
  return ""
}

function toggledSet(current: Set<string>, key: string): Set<string> {
  const next = new Set(current)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  return next
}
