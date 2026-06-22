import { useState, type ReactNode } from "react"
import {
  CheckCircle2,
  Eye,
  FileText,
  FolderOpen,
  ListChecks,
  Loader2,
  Table2,
  X,
} from "lucide-react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/shared/lib/utils"
import { listSessionDossierRetentionCandidates } from "@/features/upload/api/sessionApi"
import type {
  ClusterGroupInformationRow,
  ClusterGroupInformationTableResponse,
  RetentionCandidateSummary,
  RetentionReference,
} from "@/features/upload/api/sessionApi"

export function ClusterGroupInformationPanel({
  table,
  groupLabel,
  loading,
  error,
  className,
  onClose,
  onSelectDossier,
  onSelectDocument,
  onSelectRetentionCandidate,
  retentionSelectionDisabled = false,
  sessionId,
}: {
  table: ClusterGroupInformationTableResponse | null
  groupLabel: string
  loading: boolean
  error: string
  className?: string
  sessionId?: string | null
  onClose: () => void
  onSelectDossier: (dossierId: string) => void
  onSelectDocument: (sessionDocumentId: number) => void
  onSelectRetentionCandidate: (
    dossierId: string,
    entryId: string
  ) => Promise<void>
  retentionSelectionDisabled?: boolean
}) {
  const rows = table?.rows ?? []
  const [candidatePanel, setCandidatePanel] = useState<{
    row: ClusterGroupInformationRow
    candidates: RetentionCandidateSummary[]
    loading: boolean
    error: string
    selectingEntryId: string
  } | null>(null)
  const countLabel = table?.count_label || "Số tờ/trang"

  const openRetentionCandidates = async (row: ClusterGroupInformationRow) => {
    if (!sessionId) {
      toast.error("Chưa có session để tải gợi ý thời hạn bảo quản.")
      return
    }
    setCandidatePanel({
      row,
      candidates: [],
      loading: true,
      error: "",
      selectingEntryId: "",
    })
    try {
      const response = await listSessionDossierRetentionCandidates(
        sessionId,
        row.dossier_id,
        20
      )
      setCandidatePanel({
        row,
        candidates: response.candidates,
        loading: false,
        error: "",
        selectingEntryId: "",
      })
    } catch (err) {
      setCandidatePanel({
        row,
        candidates: [],
        loading: false,
        error:
          err instanceof Error
            ? err.message
            : "Không thể tải gợi ý thời hạn bảo quản.",
        selectingEntryId: "",
      })
    }
  }

  const selectRetentionCandidate = async (
    row: ClusterGroupInformationRow,
    candidate: RetentionCandidateSummary
  ) => {
    if (retentionSelectionDisabled) {
      toast.error("Không thể sửa thời hạn bảo quản khi đang xem phiên bản cũ.")
      return
    }
    setCandidatePanel((current) =>
      current ? { ...current, selectingEntryId: candidate.entry_id } : current
    )
    try {
      await onSelectRetentionCandidate(row.dossier_id, candidate.entry_id)
      setCandidatePanel(null)
    } finally {
      setCandidatePanel((current) =>
        current ? { ...current, selectingEntryId: "" } : current
      )
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.16 }}
      className={cn(
        "relative flex min-h-[360px] min-w-0 flex-col overflow-hidden rounded-2xl border border-[#D8E1EC] bg-white shadow-sm sm:min-h-[520px]",
        className
      )}
    >
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#EAF1FF] text-[#0052FF]">
            <Table2 className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#0F172A]">
              Thông tin nhóm hồ sơ
            </p>
            <p className="truncate text-[11px] text-[#64748B]">
              {groupLabel || table?.group_label || "Nhóm đang chọn"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {table && (
            <span className="rounded-full bg-[#F1F5F9] px-2.5 py-1 text-[11px] font-medium text-[#475569]">
              {table.dossier_count} hồ sơ · {table.document_count} tài liệu
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title="Đóng thông tin nhóm"
            onClick={onClose}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden bg-[#F8FAFC] p-3">
        {loading ? (
          <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-dashed border-[#CBD5E1] bg-white text-sm text-[#64748B]">
            <Loader2 className="mr-2 size-4 animate-spin text-[#0052FF]" />
            Đang tải thông tin nhóm hồ sơ...
          </div>
        ) : error ? (
          <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-dashed border-red-200 bg-red-50 px-4 text-center text-sm text-red-700">
            {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-dashed border-[#CBD5E1] bg-white px-4 text-center text-sm text-[#64748B]">
            Nhóm này chưa có hồ sơ để hiển thị.
          </div>
        ) : (
          <div className="h-full min-h-[320px] overflow-auto rounded-xl border border-[#D8E1EC] bg-white">
            <table className="w-full min-w-[760px] table-fixed border-collapse text-left text-xs text-[#0F172A]">
              <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_#CBD5E1]">
                <tr>
                  <HeaderCell className="w-12">Hồ sơ số</HeaderCell>
                  <HeaderCell className="w-[230px]">
                    Tiêu đề hồ sơ/Trích yếu nội dung văn bản
                  </HeaderCell>
                  <HeaderCell className="w-14">{countLabel}</HeaderCell>
                  <HeaderCell className="w-24">
                    Ngày ĐB&KT/Ngày tháng VB
                  </HeaderCell>
                  <HeaderCell className="w-24">Số, ký hiệu văn bản</HeaderCell>
                  <HeaderCell className="w-24">Tác giả văn bản</HeaderCell>
                  <HeaderCell className="w-20">Thời hạn bảo quản</HeaderCell>
                  <HeaderCell className="w-24">Căn cứ</HeaderCell>
                  <HeaderCell className="w-12 text-center">Thao tác</HeaderCell>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <GroupInformationRow
                    key={`${row.row_index}-${row.row_type}-${row.dossier_id}-${row.document_id ?? ""}`}
                    row={row}
                    onSelectDossier={onSelectDossier}
                    onSelectDocument={onSelectDocument}
                    onOpenRetentionCandidates={openRetentionCandidates}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {candidatePanel && (
        <RetentionCandidatePanel
          row={candidatePanel.row}
          candidates={candidatePanel.candidates}
          loading={candidatePanel.loading}
          error={candidatePanel.error}
          selectingEntryId={candidatePanel.selectingEntryId}
          selectionDisabled={retentionSelectionDisabled}
          onClose={() => setCandidatePanel(null)}
          onSelect={(candidate) =>
            selectRetentionCandidate(candidatePanel.row, candidate)
          }
        />
      )}
    </motion.div>
  )
}

function GroupInformationRow({
  row,
  onSelectDossier,
  onSelectDocument,
  onOpenRetentionCandidates,
}: {
  row: ClusterGroupInformationRow
  onSelectDossier: (dossierId: string) => void
  onSelectDocument: (sessionDocumentId: number) => void
  onOpenRetentionCandidates: (row: ClusterGroupInformationRow) => void
}) {
  const isDossier = row.row_type === "dossier"
  return (
    <tr className={cn(isDossier ? "bg-[#F8FAFC]" : "bg-white")}>
      <BodyCell className="align-top font-semibold text-[#0F172A]">
        {row.dossier_number}
      </BodyCell>
      <BodyCell
        className={cn(
          "align-top leading-5",
          isDossier ? "font-semibold text-[#0F172A]" : "text-[#334155]"
        )}
      >
        <div className="flex min-w-0 items-start gap-2">
          {isDossier ? (
            <FolderOpen className="mt-0.5 size-3.5 shrink-0 text-[#0052FF]" />
          ) : (
            <FileText className="mt-0.5 size-3.5 shrink-0 text-[#64748B]" />
          )}
          <span className="min-w-0 [overflow-wrap:anywhere] whitespace-normal">
            {row.title || row.file_name || "Chưa có"}
          </span>
        </div>
      </BodyCell>
      <BodyCell className="align-top tabular-nums">
        {formatCount(row.count_value)}
      </BodyCell>
      <BodyCell className="align-top [overflow-wrap:anywhere] whitespace-normal">
        {row.date_text}
      </BodyCell>
      <BodyCell className="align-top [overflow-wrap:anywhere] whitespace-normal">
        {row.document_number}
      </BodyCell>
      <BodyCell className="align-top [overflow-wrap:anywhere] whitespace-normal">
        {row.author}
      </BodyCell>
      <BodyCell className="align-top [overflow-wrap:anywhere] whitespace-normal">
        {row.retention_period}
      </BodyCell>
      <BodyCell className="align-top">
        <RetentionBasisCell
          row={row}
          onOpenCandidates={() => onOpenRetentionCandidates(row)}
        />
      </BodyCell>
      <BodyCell className="align-top">
        <div className="flex justify-center">
          {isDossier ? (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              title="Xem metadata hồ sơ"
              onClick={() => onSelectDossier(row.dossier_id)}
            >
              <FolderOpen className="size-3.5" />
            </Button>
          ) : typeof row.session_document_id === "number" ? (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              title="Preview PDF"
              onClick={() => onSelectDocument(row.session_document_id!)}
            >
              <Eye className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </BodyCell>
    </tr>
  )
}

function RetentionBasisCell({
  row,
  onOpenCandidates,
}: {
  row: ClusterGroupInformationRow
  onOpenCandidates: () => void
}) {
  const hasReference = hasRetentionReference(row.retention_reference)
  const candidateCount = row.retention_candidate_count ?? 0
  return (
    <div className="group/basis relative">
      <button
        type="button"
        className={cn(
          "flex w-full min-w-0 items-start gap-1.5 rounded px-1.5 py-1 text-left text-[11px] leading-5 text-[#0F172A] transition hover:bg-[#EAF1FF] focus-visible:ring-2 focus-visible:ring-[#0052FF] focus-visible:outline-none",
          !row.basis && "text-[#94A3B8]"
        )}
        onClick={onOpenCandidates}
      >
        <span className="min-w-0 flex-1 [overflow-wrap:anywhere] whitespace-normal underline decoration-dotted underline-offset-2">
          {row.basis || "Chưa có căn cứ"}
        </span>
        <ListChecks className="mt-1 size-3.5 shrink-0 text-[#0052FF]" />
      </button>
      {hasReference && (
        <div className="pointer-events-none absolute top-full right-0 z-30 hidden w-80 rounded-lg border border-[#CBD5E1] bg-white p-3 text-[11px] leading-5 shadow-xl group-hover/basis:block">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-semibold text-[#0F172A]">
              Căn cứ thời hạn bảo quản
            </span>
            {candidateCount > 0 && (
              <span className="rounded-full bg-[#EAF1FF] px-2 py-0.5 text-[10px] font-semibold text-[#0052FF]">
                {candidateCount} gợi ý
              </span>
            )}
          </div>
          <RetentionReferenceDetails reference={row.retention_reference} />
        </div>
      )}
    </div>
  )
}

function RetentionCandidatePanel({
  row,
  candidates,
  loading,
  error,
  selectingEntryId,
  selectionDisabled,
  onClose,
  onSelect,
}: {
  row: ClusterGroupInformationRow
  candidates: RetentionCandidateSummary[]
  loading: boolean
  error: string
  selectingEntryId: string
  selectionDisabled: boolean
  onClose: () => void
  onSelect: (candidate: RetentionCandidateSummary) => void
}) {
  const currentEntryId = textValue(row.retention_reference?.entry_id)
  return (
    <div className="absolute top-16 right-3 bottom-3 z-40 flex w-[min(640px,calc(100%-24px))] flex-col overflow-hidden rounded-xl border border-[#CBD5E1] bg-white shadow-2xl">
      <div className="flex items-start justify-between gap-3 border-b border-[#E2E8F0] px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#0F172A]">
            Gợi ý thời hạn bảo quản
          </p>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-5 text-[#64748B]">
            {row.title}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Đóng gợi ý"
          onClick={onClose}
        >
          <X className="size-3.5" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-[#F8FAFC] p-3">
        {loading ? (
          <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-[#CBD5E1] bg-white text-sm text-[#64748B]">
            <Loader2 className="mr-2 size-4 animate-spin text-[#0052FF]" />
            Đang tải gợi ý...
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : candidates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#CBD5E1] bg-white px-3 py-8 text-center text-sm text-[#64748B]">
            Chưa có gợi ý thời hạn bảo quản.
          </div>
        ) : (
          <div className="space-y-2">
            {candidates.map((candidate) => {
              const reference = candidateReference(candidate)
              const selected = candidate.entry_id === currentEntryId
              const saving = selectingEntryId === candidate.entry_id
              return (
                <button
                  key={candidate.entry_id}
                  type="button"
                  disabled={selectionDisabled || Boolean(selectingEntryId)}
                  className={cn(
                    "w-full rounded-lg border bg-white p-2.5 text-left text-[11px] leading-5 shadow-sm transition hover:border-[#0052FF] hover:bg-[#F8FBFF] focus-visible:ring-2 focus-visible:ring-[#0052FF] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60",
                    selected ? "border-[#0052FF]" : "border-[#D8E1EC]"
                  )}
                  onClick={() => onSelect(candidate)}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-[#0F172A]">
                      #{candidate.rank ?? "?"} ·{" "}
                      {reference.retention_period || "Chưa rõ thời hạn"}
                    </span>
                    {saving ? (
                      <Loader2 className="size-4 animate-spin text-[#0052FF]" />
                    ) : selected ? (
                      <CheckCircle2 className="size-4 text-emerald-600" />
                    ) : null}
                  </div>
                  <RetentionReferenceDetails reference={reference} />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function RetentionReferenceDetails({
  reference,
}: {
  reference?: RetentionReference | null
}) {
  const mergeNames =
    reference?.merge_path
      ?.map((item) => textValue(item.name))
      .filter(Boolean)
      .join(" > ") || textValue(reference?.breadcrumb)
  const rows = [
    ["Phụ lục", appendixDisplayValue(reference)],
    ["Nhóm", mergeNames],
    ["Nội dung", reference?.document_type],
    ["Số thứ tự điều", reference?.source_unit_index],
    ["Thời hạn", reference?.retention_period],
    ["Thông tư", reference?.source_file_name],
    ["Ghi chú", reference?.note],
  ].filter(([, value]) => textValue(value))
  return (
    <dl className="space-y-1.5 text-[11px] leading-5">
      {rows.map(([label, value]) => (
        <div key={String(label)} className="grid grid-cols-[78px_1fr] gap-2">
          <dt className="font-medium text-[#64748B]">{label}</dt>
          <dd className="min-w-0 [overflow-wrap:anywhere] text-[#0F172A]">
            {textValue(value)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function appendixDisplayValue(reference?: RetentionReference | null): string {
  const raw = textValue(reference?.appendix_name)
  if (!raw) return ""

  const normalized = stripVietnameseMarks(raw).toUpperCase()
  const appendixMatch = normalized.match(
    /\bPHU\s+LUC(?:\s+SO)?[\s:.-]*([IVXLCDM]+|\d+)\b/
  )
  const standaloneMatch = normalized.match(/^([IVXLCDM]+|\d+)$/)
  const label = appendixMatch?.[1] ?? standaloneMatch?.[1]
  return label ? `Phụ lục ${label.toUpperCase()}` : raw
}

function stripVietnameseMarks(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "D")
}

function candidateReference(
  candidate: RetentionCandidateSummary
): RetentionReference {
  const context = candidate.context ?? null
  return {
    ...context,
    ...candidate,
    merge_path: candidate.merge_path ?? context?.merge_path ?? [],
    appendix_name: candidate.appendix_name ?? context?.appendix_name ?? "",
    source_file_name:
      candidate.source_file_name ?? context?.source_file_name ?? "",
    document_type: candidate.document_type ?? "",
    retention_period: candidate.retention_period ?? "",
  }
}

function hasRetentionReference(reference?: RetentionReference | null): boolean {
  return Boolean(
    textValue(reference?.appendix_name) ||
    textValue(reference?.document_type) ||
    textValue(reference?.retention_period) ||
    textValue(reference?.source_file_name) ||
    textValue(reference?.source_unit_index)
  )
}

function textValue(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return ""
}

function HeaderCell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <th
      scope="col"
      className={cn(
        "border border-[#CBD5E1] px-2 py-2 text-center text-[11px] leading-5 font-bold text-[#0F172A]",
        className
      )}
    >
      {children}
    </th>
  )
}

function BodyCell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <td
      className={cn(
        "border border-[#E2E8F0] px-2 py-2 leading-5 text-[#334155]",
        className
      )}
    >
      {children || ""}
    </td>
  )
}

function formatCount(value: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return ""
  return String(value)
}
