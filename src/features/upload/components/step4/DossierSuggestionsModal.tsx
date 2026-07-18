import { useMemo, useState } from "react"
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
  FolderPlus,
  Loader2,
  ListChecks,
  MoveRight,
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
import type {
  ClusterDocument,
  ClusterGroup,
} from "@/features/upload/lib/clusterGroups"

export function DossierSuggestionsModal({
  documents,
  suggestions: candidateSuggestions,
  dossiers,
  representativeDocuments,
  loading,
  refreshing,
  creatingDossier,
  moveDisabled,
  error,
  onClose,
  onRefresh,
  onCreateDossier,
  onMoveToDossier,
}: {
  documents: ClusterDocument[]
  suggestions: SessionDossierSuggestion[] | null
  dossiers: ClusterGroup[]
  representativeDocuments: ClusterDocument[]
  loading: boolean
  refreshing: boolean
  creatingDossier: boolean
  moveDisabled: boolean
  error: string
  onClose: () => void
  onRefresh: () => void
  onCreateDossier: () => Promise<boolean>
  onMoveToDossier: (suggestion: SessionDossierSuggestion) => Promise<boolean>
}) {
  const [selectedSuggestionKey, setSelectedSuggestionKey] = useState<
    string | null
  >(null)
  const [selectedRepresentativeKey, setSelectedRepresentativeKey] = useState<
    string | null
  >(null)
  const [selectedDocumentKey, setSelectedDocumentKey] = useState<string | null>(
    null
  )
  const [movingSuggestionKey, setMovingSuggestionKey] = useState<string | null>(
    null
  )
  const busy = loading || refreshing
  const selectedDocument =
    documents.find(
      (document) => documentKey(document) === selectedDocumentKey
    ) ?? null
  const suggestions = busy ? [] : (candidateSuggestions ?? [])
  const selectedSuggestion =
    suggestions.find(
      (suggestion) => suggestionKey(suggestion) === selectedSuggestionKey
    ) ?? null
  const selectedRepresentative =
    selectedSuggestion?.representative_documents.find(
      (representative) =>
        representativeKey(representative) === selectedRepresentativeKey
    ) ?? null
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

  const handleMoveToDossier = async (suggestion: SessionDossierSuggestion) => {
    const key = suggestionKey(suggestion)
    setMovingSuggestionKey(key)
    let moved = false
    try {
      moved = await onMoveToDossier(suggestion)
    } finally {
      setMovingSuggestionKey(null)
    }
    if (moved) onClose()
  }

  const handleCreateDossier = async () => {
    const created = await onCreateDossier()
    if (created) onClose()
  }

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
                  Đối chiếu metadata của tài liệu đã chọn với các hồ sơ và tài
                  liệu đại diện.
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
                  {documents.length === 1
                    ? documents[0]?.fileName
                    : `${documents.length} tài liệu được chọn`}
                </p>
                <p className="mt-0.5 truncate text-xs text-[#64748B]">
                  {documents.length === 1
                    ? documents[0]?.filePath
                    : "Hồ sơ được xếp theo số tài liệu cùng tương thích, sau đó theo điểm trung bình."}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => void handleCreateDossier()}
                  disabled={moveDisabled || loading || refreshing}
                  title="Ghi nhận hồ sơ mới từ các tài liệu trong modal"
                >
                  {creatingDossier ? (
                    <Loader2
                      data-icon="inline-start"
                      className="animate-spin"
                    />
                  ) : (
                    <FolderPlus data-icon="inline-start" />
                  )}
                  {creatingDossier
                    ? "Đang tạo và gợi ý..."
                    : "Tạo hồ sơ từ tài liệu đã chọn"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={onRefresh}
                  disabled={moveDisabled || loading || refreshing}
                  title="Tải lại danh sách gợi ý"
                >
                  {refreshing ? (
                    <Loader2
                      data-icon="inline-start"
                      className="animate-spin"
                    />
                  ) : (
                    <RefreshCw data-icon="inline-start" />
                  )}
                  {refreshing ? "Đang tính lại..." : "Tải lại gợi ý"}
                </Button>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto xl:grid-cols-[minmax(280px,0.9fr)_minmax(320px,1fr)_minmax(320px,1.1fr)] xl:overflow-hidden">
              <SelectedDocumentsPanel
                documents={documents}
                selectedDocument={selectedDocument}
                onSelect={(document) => {
                  const key = documentKey(document)
                  setSelectedDocumentKey((current) =>
                    current === key ? null : key
                  )
                }}
              />
              <SuggestionList
                suggestions={suggestions}
                selectedSuggestion={selectedSuggestion}
                selectedDocumentCount={documents.length}
                dossiers={dossiers}
                loading={busy}
                moveDisabled={moveDisabled || movingSuggestionKey !== null}
                movingSuggestionKey={movingSuggestionKey}
                error={error}
                onSelect={(suggestion) => {
                  const key = suggestionKey(suggestion)
                  setSelectedSuggestionKey((current) =>
                    current === key ? null : key
                  )
                  setSelectedRepresentativeKey(null)
                }}
                onMoveToDossier={(suggestion) =>
                  void handleMoveToDossier(suggestion)
                }
              />
              <RepresentativeDocumentList
                suggestion={selectedSuggestion}
                selectedRepresentative={selectedRepresentative}
                selectedRepresentativeDocument={selectedRepresentativeDocument}
                loading={busy}
                onSelect={(representative) => {
                  const key = representativeKey(representative)
                  setSelectedRepresentativeKey((current) =>
                    current === key ? null : key
                  )
                }}
              />
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function SelectedDocumentsPanel({
  documents,
  selectedDocument,
  onSelect,
}: {
  documents: ClusterDocument[]
  selectedDocument: ClusterDocument | null
  onSelect: (document: ClusterDocument) => void
}) {
  return (
    <section className="min-h-0 border-b border-[#E2E8F0] p-4 xl:overflow-y-auto xl:border-r xl:border-b-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="size-4 shrink-0 text-[#0052FF]" />
          <h3 className="truncate text-sm font-semibold text-[#0F172A]">
            Tài liệu đã chọn
          </h3>
        </div>
        <span className="shrink-0 rounded-full bg-[#EAF1FF] px-2 py-0.5 text-[10px] font-semibold text-[#0052FF]">
          {documents.length}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {documents.map((document) => {
          const selected =
            selectedDocument !== null &&
            documentKey(document) === documentKey(selectedDocument)
          return (
            <div key={documentKey(document)} className="min-w-0">
              <button
                type="button"
                className={`flex w-full min-w-0 items-start gap-2 rounded-lg border p-3 text-left transition-colors ${
                  selected
                    ? "border-[#0052FF] bg-[#F0F5FF]"
                    : "border-[#E2E8F0] bg-white hover:border-[#9DBBFF] hover:bg-[#F8FAFF]"
                }`}
                aria-expanded={selected}
                title={
                  selected ? "Ẩn metadata tài liệu" : "Xem metadata tài liệu"
                }
                onClick={() => onSelect(document)}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-[#0F172A]">
                    {document.fileName}
                  </span>
                  <span className="mt-1 block truncate text-[11px] text-[#64748B]">
                    {document.filePath}
                  </span>
                </span>
                {selected ? (
                  <ChevronDown className="mt-0.5 size-4 shrink-0 text-[#0052FF]" />
                ) : (
                  <ChevronRight className="mt-0.5 size-4 shrink-0 text-[#94A3B8]" />
                )}
              </button>
              {selected ? <DocumentMetadataPanel document={document} /> : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function DocumentMetadataPanel({ document }: { document: ClusterDocument }) {
  const metadataRows = METADATA_FIELDS.map((field) => [
    field.label,
    metadataFieldText(document.metadata, field.aliases),
  ])

  return <MetadataPanel title="Metadata tài liệu" rows={metadataRows} />
}

function SuggestionList({
  suggestions,
  selectedSuggestion,
  selectedDocumentCount,
  dossiers,
  loading,
  moveDisabled,
  movingSuggestionKey,
  error,
  onSelect,
  onMoveToDossier,
}: {
  suggestions: SessionDossierSuggestion[]
  selectedSuggestion: SessionDossierSuggestion | null
  selectedDocumentCount: number
  dossiers: ClusterGroup[]
  loading: boolean
  moveDisabled: boolean
  movingSuggestionKey: string | null
  error: string
  onSelect: (suggestion: SessionDossierSuggestion) => void
  onMoveToDossier: (suggestion: SessionDossierSuggestion) => void
}) {
  return (
    <section className="min-h-0 border-b border-[#E2E8F0] p-4 xl:overflow-y-auto xl:border-r xl:border-b-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#0F172A]">
            Danh sách hồ sơ
          </h3>
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
            const selected =
              selectedSuggestion !== null &&
              suggestionKey(selectedSuggestion) === suggestionKey(suggestion)
            const dossier = dossierForSuggestion(dossiers, suggestion)
            const moving = movingSuggestionKey === suggestionKey(suggestion)
            return (
              <div
                key={`${suggestion.cluster_id}-${suggestion.rank}`}
                className={`min-w-0 overflow-hidden rounded-lg border transition-colors ${
                  selected
                    ? "border-[#0052FF] bg-[#F0F5FF]"
                    : "border-[#E2E8F0] bg-white"
                }`}
              >
                <button
                  type="button"
                  className="flex w-full min-w-0 items-start gap-3 p-3 text-left transition-colors hover:bg-[#F8FAFF]"
                  aria-expanded={selected}
                  title={selected ? "Ẩn metadata hồ sơ" : "Xem metadata hồ sơ"}
                  onClick={() => onSelect(suggestion)}
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#EAF1FF] text-xs font-bold text-[#0052FF]">
                    {suggestion.rank}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold break-words text-[#0F172A]">
                      {suggestion.title || suggestion.dossier_id}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-[#64748B]">
                      <span>{formatSimilarity(suggestion)} tương đồng</span>
                      {selectedDocumentCount > 1 ? (
                        <>
                          <span>·</span>
                          <span>
                            Khớp {matchingDocumentCount(suggestion)}/
                            {selectedDocumentCount} tài liệu
                          </span>
                        </>
                      ) : null}
                      <span>·</span>
                      <span>{suggestion.document_count} tài liệu</span>
                      <span>·</span>
                      <span>
                        {suggestion.representative_documents.length} đại diện
                      </span>
                    </span>
                  </span>
                  {selected ? (
                    <ChevronDown className="mt-1 size-4 shrink-0 text-[#0052FF]" />
                  ) : (
                    <ChevronRight className="mt-1 size-4 shrink-0 text-[#94A3B8]" />
                  )}
                </button>

                {selected ? (
                  <DossierMetadataPanel
                    suggestion={suggestion}
                    dossier={dossier}
                    selectedDocumentCount={selectedDocumentCount}
                  />
                ) : null}

                <div className="flex justify-end border-t border-[#E2E8F0] bg-white px-3 py-2">
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1.5"
                    disabled={moveDisabled || !dossier}
                    title={
                      dossier
                        ? "Ghi feedback chuyển tài liệu; cần bấm Cập nhật hồ sơ để áp dụng"
                        : "Không tìm thấy hồ sơ đích trong phiên bản đang xem"
                    }
                    onClick={(event) => {
                      event.stopPropagation()
                      onMoveToDossier(suggestion)
                    }}
                  >
                    {moving ? (
                      <Loader2
                        data-icon="inline-start"
                        className="animate-spin"
                      />
                    ) : (
                      <MoveRight data-icon="inline-start" />
                    )}
                    {moving ? "Đang ghi feedback..." : "Chuyển tới hồ sơ"}
                  </Button>
                </div>
              </div>
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
  onSelect: (document: SessionDossierSuggestionRepresentativeDocument) => void
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
                <div
                  key={`${document.session_document_id}-${document.document_id}`}
                  className="min-w-0"
                >
                  <button
                    type="button"
                    className={`flex w-full min-w-0 items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                      selected
                        ? "border-[#0052FF] bg-[#F0F5FF]"
                        : "border-[#E2E8F0] bg-white hover:border-[#9DBBFF] hover:bg-[#F8FAFF]"
                    }`}
                    onClick={() => onSelect(document)}
                    aria-expanded={selected}
                    title={
                      selected
                        ? "Ẩn metadata tài liệu đại diện"
                        : "Xem metadata tài liệu đại diện"
                    }
                  >
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#EAF1FF] text-[#0052FF]">
                      <Eye className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold break-words text-[#0F172A]">
                        {document.file_name || document.document_id}
                      </span>
                      {document.title && (
                        <span className="mt-1 line-clamp-2 block text-[11px] leading-4 text-[#64748B]">
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
                    {selected ? (
                      <ChevronDown className="mt-1 size-4 shrink-0 text-[#0052FF]" />
                    ) : (
                      <ChevronRight className="mt-1 size-4 shrink-0 text-[#94A3B8]" />
                    )}
                  </button>
                  {selected ? (
                    <RepresentativeMetadataPanel
                      representative={document}
                      document={selectedRepresentativeDocument}
                    />
                  ) : null}
                </div>
              )
            })}
          </div>
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
    <MetadataPanel
      title="Metadata tài liệu đại diện"
      subtitle={
        document?.fileName ||
        representative.file_name ||
        representative.document_id
      }
      rows={metadataRows}
    />
  )
}

function DossierMetadataPanel({
  suggestion,
  dossier,
  selectedDocumentCount,
}: {
  suggestion: SessionDossierSuggestion
  dossier: ClusterGroup | null
  selectedDocumentCount: number
}) {
  const dateRange = [dossier?.startDate, dossier?.endDate]
    .filter((value): value is string => Boolean(value))
    .join(" – ")
  const rows = [
    ["Mã hồ sơ", suggestion.dossier_id],
    ["Mã cụm", suggestion.cluster_id],
    ["Độ tương đồng", formatSimilarity(suggestion)],
    [
      "Tài liệu phù hợp",
      `${matchingDocumentCount(suggestion)}/${selectedDocumentCount}`,
    ],
    ["Số tài liệu", String(suggestion.document_count)],
    ["Thời hạn bảo quản", dossier?.retentionPeriod ?? ""],
    ["Khoảng thời gian", dateRange],
    ["Ngôn ngữ", dossier?.language ?? ""],
    ["Ký hiệu thông tin", dossier?.informationSign ?? ""],
    ["Mã hồ sơ gốc giấy", dossier?.paperDossierId ?? ""],
    ["Ghi chú", dossier?.note ?? ""],
  ]

  return (
    <MetadataPanel
      title="Metadata hồ sơ"
      subtitle={dossier?.label || suggestion.title || suggestion.dossier_id}
      rows={rows}
      inset
    />
  )
}

function MetadataPanel({
  title,
  subtitle,
  rows,
  inset = false,
}: {
  title: string
  subtitle?: string
  rows: string[][]
  inset?: boolean
}) {
  return (
    <div
      className={`border border-[#BFD3FF] bg-[#F8FAFF] p-3 ${
        inset ? "mx-3 mb-3 rounded-lg" : "mt-2 rounded-lg"
      }`}
    >
      <div className="mb-3 flex items-start gap-2">
        <FileText className="mt-0.5 size-4 shrink-0 text-[#0052FF]" />
        <div className="min-w-0">
          <h4 className="text-xs font-semibold text-[#0F172A]">{title}</h4>
          {subtitle ? (
            <p className="mt-0.5 truncate text-[11px] text-[#64748B]">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
      <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[10px] font-semibold tracking-[0.06em] text-[#94A3B8] uppercase">
              {label}
            </dt>
            <dd className="mt-0.5 text-xs leading-5 break-words text-[#334155]">
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

function suggestionKey(suggestion: SessionDossierSuggestion): string {
  return (
    suggestion.cluster_id ||
    suggestion.dossier_id ||
    String(suggestion.session_dossier_id)
  )
}

function dossierForSuggestion(
  dossiers: ClusterGroup[],
  suggestion: SessionDossierSuggestion
): ClusterGroup | null {
  return (
    dossiers.find(
      (dossier) =>
        !dossier.isTemporary &&
        (dossier.id === suggestion.dossier_id ||
          dossier.dossierId === suggestion.dossier_id ||
          dossier.dossierStorageId === suggestion.dossier_id)
    ) ??
    dossiers.find(
      (dossier) =>
        !dossier.isTemporary &&
        (dossier.clusterId === suggestion.cluster_id ||
          dossier.id === suggestion.cluster_id)
    ) ??
    null
  )
}

function matchingDocumentCount(suggestion: SessionDossierSuggestion): number {
  return (
    suggestion.matching_document_count ??
    suggestion.matched_session_document_ids?.length ??
    1
  )
}

function documentKey(document: ClusterDocument): string {
  return `${document.sessionDocumentId ?? "local"}:${document.documentId}`
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
    Math.min(
      100,
      Number(
        suggestion.average_similarity ?? suggestion.best_other_similarity ?? 0
      ) * 100
    )
  )
  return `${similarity.toFixed(1)}%`
}
