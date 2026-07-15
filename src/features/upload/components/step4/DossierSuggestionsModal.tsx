import { useMemo, useState } from "react"
import {
  CalendarDays,
  ChevronRight,
  Eye,
  FileText,
  Loader2,
  ListChecks,
  RefreshCw,
  X,
} from "lucide-react"
import { Dialog } from "radix-ui"
import { Button } from "@/components/ui/button"
import type {
  SessionDossierSuggestion,
  SessionDossierSuggestionRepresentativeDocument,
} from "@/features/upload/api/sessionApi"
import {
  METADATA_FIELDS,
  metadataFieldText,
} from "@/features/upload/components/step3/metadataCardUtils"
import type { ClusterDocument } from "@/features/upload/lib/clusterGroups"

export function DossierSuggestionsModal({
  document,
  representativeDocuments,
  loading,
  refreshing,
  error,
  onClose,
  onRefresh,
}: {
  document: ClusterDocument
  representativeDocuments: ClusterDocument[]
  loading: boolean
  refreshing: boolean
  error: string
  onClose: () => void
  onRefresh: () => void
}) {
  const [selectedSuggestionKey, setSelectedSuggestionKey] = useState<
    string | null
  >(null)
  const [selectedRepresentativeKey, setSelectedRepresentativeKey] = useState<
    string | null
  >(null)
  const busy = loading || refreshing
  const suggestions = busy ? [] : document.dossierSuggestions ?? []
  const selectedSuggestion =
    suggestions.find(
      (suggestion) => suggestion.cluster_id === selectedSuggestionKey
    ) ?? suggestions[0] ?? null
  const selectedRepresentative =
    selectedSuggestion?.representative_documents.find(
      (representative) =>
        representativeKey(representative) === selectedRepresentativeKey
    ) ??
    selectedSuggestion?.representative_documents[0] ??
    null
  const selectedRepresentativeDocument = useMemo(
    () =>
      selectedRepresentative
        ? (representativeDocuments.find(
            (item) =>
              item.sessionDocumentId ===
              selectedRepresentative.session_document_id
          ) ?? null)
        : null,
    [representativeDocuments, selectedRepresentative]
  )

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#0F172A]/50 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex h-[min(92svh,860px)] w-[calc(100%-1rem)] max-w-[1500px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-[#CBD5E1] bg-white shadow-2xl outline-none data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=closed]:fade-out data-[state=open]:animate-in data-[state=open]:zoom-in-95 data-[state=open]:fade-in">
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#E2E8F0] px-5 py-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#EAF1FF] text-[#0052FF]">
                <ListChecks className="size-4" />
              </div>
              <div className="min-w-0">
                <Dialog.Title className="text-base font-semibold text-[#0F172A]">
                  Hồ sơ được gợi ý
                </Dialog.Title>
                <Dialog.Description className="mt-1 truncate text-sm text-[#64748B]">
                  Đối chiếu metadata của tài liệu với các hồ sơ và tài liệu đại diện.
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                title="Đóng"
                aria-label="Đóng"
              >
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 flex-col gap-3 border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#0F172A]">
                  {document.fileName}
                </p>
                <p className="mt-0.5 truncate text-xs text-[#64748B]">
                  {document.filePath}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={onRefresh}
                disabled={loading || refreshing}
                title="Tải lại danh sách gợi ý"
              >
                {refreshing ? (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                ) : (
                  <RefreshCw data-icon="inline-start" />
                )}
                {refreshing ? "Đang tính lại..." : "Tải lại gợi ý"}
              </Button>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto xl:grid-cols-[minmax(250px,0.85fr)_minmax(320px,1fr)_minmax(320px,1.1fr)] xl:overflow-hidden">
              <DocumentMetadataPanel document={document} />
              <SuggestionList
                suggestions={suggestions}
                selectedSuggestion={selectedSuggestion}
                loading={busy}
                error={error}
                onSelect={(suggestion) => {
                  setSelectedSuggestionKey(suggestion.cluster_id)
                  setSelectedRepresentativeKey(null)
                }}
              />
              <RepresentativeDocumentList
                suggestion={selectedSuggestion}
                selectedRepresentative={selectedRepresentative}
                selectedRepresentativeDocument={selectedRepresentativeDocument}
                loading={busy}
                onSelect={(representative) =>
                  setSelectedRepresentativeKey(representativeKey(representative))
                }
              />
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function DocumentMetadataPanel({ document }: { document: ClusterDocument }) {
  const metadataRows = METADATA_FIELDS.map((field) => [
    field.label,
    metadataFieldText(document.metadata, field.aliases),
  ])

  return (
    <section className="min-h-0 border-b border-[#E2E8F0] p-4 xl:overflow-y-auto xl:border-r xl:border-b-0">
      <div className="mb-3 flex items-center gap-2">
        <FileText className="size-4 text-[#0052FF]" />
        <h3 className="text-sm font-semibold text-[#0F172A]">Metadata tài liệu</h3>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        {metadataRows.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#94A3B8]">
              {label}
            </dt>
            <dd className="mt-1 break-words text-xs leading-5 text-[#334155]">
              {value || "Chưa có dữ liệu"}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function SuggestionList({
  suggestions,
  selectedSuggestion,
  loading,
  error,
  onSelect,
}: {
  suggestions: SessionDossierSuggestion[]
  selectedSuggestion: SessionDossierSuggestion | null
  loading: boolean
  error: string
  onSelect: (suggestion: SessionDossierSuggestion) => void
}) {
  return (
    <section className="min-h-0 border-b border-[#E2E8F0] p-4 xl:overflow-y-auto xl:border-r xl:border-b-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#0F172A]">Danh sách hồ sơ</h3>
          <p className="mt-1 text-xs text-[#64748B]">
            {suggestions.length} hồ sơ phù hợp
          </p>
        </div>
        {loading && <Loader2 className="size-4 animate-spin text-[#0052FF]" />}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : loading && suggestions.length === 0 ? (
        <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-[#64748B]">
          <Loader2 className="size-4 animate-spin text-[#0052FF]" />
          Đang tải gợi ý hồ sơ...
        </div>
      ) : suggestions.length > 0 ? (
        <div className="flex flex-col gap-2">
          {suggestions.map((suggestion) => {
            const selected = selectedSuggestion?.cluster_id === suggestion.cluster_id
            return (
              <button
                key={`${suggestion.cluster_id}-${suggestion.rank}`}
                type="button"
                className={`flex min-w-0 items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                  selected
                    ? "border-[#0052FF] bg-[#F0F5FF]"
                    : "border-[#E2E8F0] bg-white hover:border-[#9DBBFF] hover:bg-[#F8FAFF]"
                }`}
                onClick={() => onSelect(suggestion)}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#EAF1FF] text-xs font-bold text-[#0052FF]">
                  {suggestion.rank}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-sm font-semibold text-[#0F172A]">
                    {suggestion.title || suggestion.dossier_id}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-[#64748B]">
                    <span>{formatSimilarity(suggestion)} tương đồng</span>
                    <span>·</span>
                    <span>{suggestion.document_count} tài liệu</span>
                    <span>·</span>
                    <span>
                      {suggestion.representative_documents.length} đại diện
                    </span>
                  </span>
                </span>
                <ChevronRight className="mt-1 size-4 shrink-0 text-[#94A3B8]" />
              </button>
            )
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-5 text-center text-sm text-[#64748B]">
          Chưa có hồ sơ phù hợp được tìm thấy.
        </div>
      )}
    </section>
  )
}

function RepresentativeDocumentList({
  suggestion,
  selectedRepresentative,
  selectedRepresentativeDocument,
  loading,
  onSelect,
}: {
  suggestion: SessionDossierSuggestion | null
  selectedRepresentative: SessionDossierSuggestionRepresentativeDocument | null
  selectedRepresentativeDocument: ClusterDocument | null
  loading: boolean
  onSelect: (
    document: SessionDossierSuggestionRepresentativeDocument
  ) => void
}) {
  return (
    <section className="min-h-0 p-4 xl:overflow-y-auto">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-[#0F172A]">
          Tài liệu đại diện
        </h3>
        <p className="mt-1 line-clamp-2 text-xs text-[#64748B]">
          {suggestion
            ? suggestion.title || suggestion.dossier_id
            : "Chọn một hồ sơ để đối chiếu"}
        </p>
      </div>

      {loading ? (
        <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-[#64748B]">
          <Loader2 className="size-4 animate-spin text-[#0052FF]" />
          Đang tải tài liệu đại diện...
        </div>
      ) : suggestion ? (
        <div className="flex flex-col gap-2">
          <div className="mb-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#64748B]">
            <span>{formatSimilarity(suggestion)} tương đồng</span>
            <span>{suggestion.document_count} tài liệu trong hồ sơ</span>
          </div>
          <div className="flex flex-col gap-2">
            {suggestion.representative_documents.map((document) => {
              const selected =
                representativeKey(document) ===
                (selectedRepresentative
                  ? representativeKey(selectedRepresentative)
                  : null)
              return (
                <button
                  key={`${document.session_document_id}-${document.document_id}`}
                  type="button"
                  className={`flex min-w-0 items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                    selected
                      ? "border-[#0052FF] bg-[#F0F5FF]"
                      : "border-[#E2E8F0] bg-white hover:border-[#9DBBFF] hover:bg-[#F8FAFF]"
                  }`}
                  onClick={() => onSelect(document)}
                  title="Xem metadata tài liệu đại diện"
                >
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#EAF1FF] text-[#0052FF]">
                    <Eye className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-xs font-semibold text-[#0F172A]">
                      {document.file_name || document.document_id}
                    </span>
                    {document.title && (
                      <span className="mt-1 block line-clamp-2 text-[11px] leading-4 text-[#64748B]">
                        {document.title}
                      </span>
                    )}
                    <span className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-[#94A3B8]">
                      {document.document_number && (
                        <span>{document.document_number}</span>
                      )}
                      {document.issued_date && (
                        <span className="flex items-center gap-1">
                          <CalendarDays className="size-3" />{" "}
                          {document.issued_date}
                        </span>
                      )}
                    </span>
                  </span>
                  <ChevronRight className="mt-1 size-4 shrink-0 text-[#94A3B8]" />
                </button>
              )
            })}
          </div>
          {selectedRepresentative && (
            <RepresentativeMetadataPanel
              representative={selectedRepresentative}
              document={selectedRepresentativeDocument}
            />
          )}
          {suggestion.representative_documents.length === 0 && (
            <p className="rounded-lg border border-dashed border-[#CBD5E1] p-4 text-center text-sm text-[#64748B]">
              Hồ sơ này chưa có tài liệu đại diện.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-5 text-center text-sm text-[#64748B]">
          Danh sách tài liệu đại diện sẽ hiện ở đây.
        </div>
      )}
    </section>
  )
}

function RepresentativeMetadataPanel({
  representative,
  document,
}: {
  representative: SessionDossierSuggestionRepresentativeDocument
  document: ClusterDocument | null
}) {
  const metadataRows = METADATA_FIELDS.map((field) => [
    field.label,
    document
      ? metadataFieldText(document.metadata, field.aliases)
      : representativeMetadataFallback(representative, field.key),
  ])

  return (
    <div className="mt-2 rounded-lg border border-[#BFD3FF] bg-[#F8FAFF] p-3">
      <div className="mb-3 flex items-start gap-2">
        <FileText className="mt-0.5 size-4 shrink-0 text-[#0052FF]" />
        <div className="min-w-0">
          <h4 className="text-xs font-semibold text-[#0F172A]">
            Metadata tài liệu đại diện
          </h4>
          <p className="mt-0.5 truncate text-[11px] text-[#64748B]">
            {document?.fileName || representative.file_name || representative.document_id}
          </p>
        </div>
      </div>
      <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        {metadataRows.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#94A3B8]">
              {label}
            </dt>
            <dd className="mt-0.5 break-words text-xs leading-5 text-[#334155]">
              {value || "Chưa có dữ liệu"}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function representativeKey(
  document: SessionDossierSuggestionRepresentativeDocument
): string {
  return `${document.session_document_id}:${document.document_id}`
}

function representativeMetadataFallback(
  representative: SessionDossierSuggestionRepresentativeDocument,
  key: string
): string {
  if (key === "document_summary") return representative.title ?? ""
  if (key === "issued_date") return representative.issued_date ?? ""
  if (key === "document_number_part") {
    return representative.document_number ?? ""
  }
  return ""
}

function formatSimilarity(suggestion: SessionDossierSuggestion): string {
  const similarity = Math.max(
    0,
    Math.min(100, Number(suggestion.best_other_similarity || 0) * 100)
  )
  return `${similarity.toFixed(1)}%`
}
