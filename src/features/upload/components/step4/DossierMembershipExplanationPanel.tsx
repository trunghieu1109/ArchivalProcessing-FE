import { useState } from "react"
import {
  BrainCircuit,
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import type {
  DossierMembershipExplanationDocument,
  DossierMembershipExplanationNeighbor,
  DossierMembershipExplanationResponse,
} from "@/features/upload/api/sessionApi"
import type { ClusterDocument } from "@/features/upload/lib/clusterGroups"
import { cn } from "@/shared/lib/utils"
import { metadataText } from "./FinalResult.metadataUtils"

export function DossierMembershipExplanationPanel({
  document,
  result,
  loading,
  error,
  className,
  onClose,
  onRefresh,
}: {
  document: ClusterDocument
  result: DossierMembershipExplanationResponse | null
  loading: boolean
  error: string
  className?: string
  onClose: () => void
  onRefresh: () => void
}) {
  const relationships = new Map(
    (result?.explanation.relationships ?? []).map((item) => [
      item.neighbor_document_id,
      item,
    ])
  )
  const selectedDocumentSummary = metadataText(document.metadata, [
    "document_summary",
    "trich_yeu_van_ban",
    "title",
    "long_summary",
  ])

  return (
    <aside
      aria-label="Giải thích tài liệu thuộc hồ sơ"
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#CBD5E1] bg-white shadow-sm",
        className
      )}
    >
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#E2E8F0] px-4 py-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF1FF] text-[#0052FF]">
            <BrainCircuit className="size-4.5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[#0F172A]">
              Giải thích tài liệu thuộc hồ sơ
            </h2>
            <p
              className="mt-1 line-clamp-2 text-xs leading-5 text-[#64748B]"
              title={selectedDocumentSummary}
            >
              {selectedDocumentSummary || "Tài liệu đang được xem xét"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {result && !loading ? (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Tạo lại lời giải thích"
              title="Tạo lại lời giải thích"
              onClick={onRefresh}
            >
              <RefreshCw className="size-3.5" />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Đóng phần giải thích"
            title="Đóng"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
            <Loader2 className="size-7 animate-spin text-[#0052FF]" />
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">
                Đang phân tích mối liên hệ
              </p>
              <p className="mt-1 text-xs leading-5 text-[#64748B]">
                Hệ thống đang đối chiếu metadata và các tài liệu gần nhất.
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p className="font-semibold">Không thể tạo lời giải thích</p>
            <p className="mt-1 text-xs leading-5">{error}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={onRefresh}
            >
              Thử lại
            </Button>
          </div>
        ) : result ? (
          <div className="grid gap-4">
            <section className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold tracking-wide text-[#64748B] uppercase">
                    Tài liệu đang giải thích
                  </p>
                  <h3 className="mt-1 text-sm font-semibold break-words text-[#0F172A]">
                    {documentContentLabel(result.document)}
                  </h3>
                </div>
              </div>
              <p className="mt-2 text-xs leading-5 text-[#64748B]">
                Thuộc hồ sơ: {result.dossier.title || "Hồ sơ hiện tại"}
              </p>

              <div className="mt-3 border-t border-blue-200 pt-3">
                <h4 className="text-xs font-bold text-[#0F172A]">
                  Lý do xếp tài liệu vào hồ sơ này
                </h4>
              </div>
              <p className="mt-2 text-sm leading-6 text-[#334155]">
                {humanExplanationText(result.explanation.summary, result)}
              </p>
              {result.explanation.dossier_fit.length > 0 ? (
                <div className="mt-3">
                  <p className="text-[10px] font-bold tracking-wide text-[#64748B] uppercase">
                    Các điểm phù hợp
                  </p>
                  <ul className="mt-1.5 grid gap-1.5 text-xs leading-5 text-[#334155]">
                    {result.explanation.dossier_fit.map((item, index) => (
                      <li key={`${index}-${item}`} className="flex gap-2">
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#0052FF]" />
                        <span>{humanExplanationText(item, result)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>

            <section>
              <div className="mb-2.5">
                <h3 className="text-sm font-semibold text-[#0F172A]">
                  Mối quan hệ với các tài liệu gần nhất
                </h3>
                <p className="mt-0.5 text-xs leading-5 text-[#64748B]">
                  Đối chiếu với {Math.max(0, result.dossier.document_count - 1)}
                  {" tài liệu cùng hồ sơ, hiển thị Top "}
                  {result.top_k}. Nhấn vào từng tài liệu để xem metadata.
                </p>
              </div>
              {result.nearest_documents.length > 0 ? (
                <div className="grid gap-2.5">
                  {result.nearest_documents.map((neighbor) => (
                    <NeighborCard
                      key={neighbor.document_id}
                      neighbor={neighbor}
                      result={result}
                      relationship={relationships.get(neighbor.document_id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-4 text-xs leading-5 text-[#64748B]">
                  Hồ sơ chỉ có một tài liệu nên chưa có tài liệu lân cận để đối
                  chiếu.
                </div>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </aside>
  )
}

function NeighborCard({
  neighbor,
  result,
  relationship,
}: {
  neighbor: DossierMembershipExplanationNeighbor
  result: DossierMembershipExplanationResponse
  relationship?: {
    reason: string
  }
}) {
  const [metadataExpanded, setMetadataExpanded] = useState(false)

  return (
    <article className="rounded-xl border border-[#D8E1EC] bg-white p-3.5 shadow-sm">
      <div className="flex items-start gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#EAF1FF] text-[#0052FF]">
          <FileText className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs leading-5 font-semibold break-words text-[#0F172A]">
                {neighbor.file_name || "Tài liệu liên quan"}
              </p>
              <p className="mt-0.5 text-xs leading-5 break-words text-[#64748B]">
                {documentContentLabel(neighbor)}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-bold text-[#047857]">
              {formatSimilarity(neighbor.similarity)}
            </span>
          </div>
          {relationship ? (
            <div className="mt-2.5 rounded-lg bg-[#F8FAFC] px-3 py-2">
              <p className="text-xs leading-5 text-[#334155]">
                {humanExplanationText(relationship.reason, result)}
              </p>
            </div>
          ) : (
            <div className="mt-2.5 rounded-lg bg-[#F8FAFC] px-3 py-2">
              <p className="text-xs leading-5 text-[#334155]">
                Tài liệu này có mức tương đồng{" "}
                {formatSimilarity(neighbor.similarity)} với tài liệu đang giải
                thích; chưa có mô tả quan hệ nghiệp vụ riêng.
              </p>
            </div>
          )}
          <button
            type="button"
            className="mt-2.5 flex w-full items-center justify-between gap-2 border-t border-[#E2E8F0] pt-2.5 text-left text-xs font-semibold text-[#0052FF]"
            aria-expanded={metadataExpanded}
            onClick={() => setMetadataExpanded((value) => !value)}
          >
            <span>
              {metadataExpanded
                ? "Ẩn thông tin tài liệu"
                : "Xem thông tin tài liệu"}
            </span>
            {metadataExpanded ? (
              <ChevronDown className="size-3.5 shrink-0" />
            ) : (
              <ChevronRight className="size-3.5 shrink-0" />
            )}
          </button>
          {metadataExpanded ? (
            <NeighborDocumentDetails document={neighbor} />
          ) : null}
        </div>
      </div>
    </article>
  )
}

function NeighborDocumentDetails({
  document,
}: {
  document: DossierMembershipExplanationDocument
}) {
  const fields = [
    { label: "Ngày ban hành", value: document.issued_date },
    { label: "Loại văn bản", value: document.document_type },
    { label: "Cơ quan ban hành", value: document.issuing_agency },
  ].filter((field) => field.value)

  if (fields.length === 0) {
    return (
      <p className="mt-2.5 text-xs text-[#64748B] italic">
        Chưa có thêm thông tin tài liệu.
      </p>
    )
  }

  return (
    <dl className="mt-2.5 grid gap-x-4 gap-y-2 border-t border-[#E2E8F0] pt-2.5 sm:grid-cols-2">
      {fields.map((field) => (
        <div key={field.label} className="min-w-0">
          <dt className="text-[9px] font-bold tracking-wide text-[#64748B] uppercase">
            {field.label}
          </dt>
          <dd className="mt-1 text-[11px] leading-4 font-medium break-words whitespace-pre-wrap text-[#0F172A]">
            {field.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function documentContentLabel(
  document: DossierMembershipExplanationDocument
): string {
  return (
    document.document_summary ||
    document.title ||
    document.document_type ||
    "Tài liệu liên quan"
  )
}

function humanExplanationText(
  value: string,
  result: DossierMembershipExplanationResponse
): string {
  const replacements = [result.document, ...result.nearest_documents]
    .flatMap((document) => {
      const label = documentContentLabel(document)
      return [document.document_id, document.file_name]
        .filter(Boolean)
        .map((source) => ({ source, replacement: `“${label}”` }))
    })
    .sort((left, right) => right.source.length - left.source.length)

  return replacements.reduce(
    (text, item) => text.replaceAll(item.source, item.replacement),
    value
  )
}

function formatSimilarity(value: number): string {
  return `${Math.round(value * 1000) / 10}%`
}
