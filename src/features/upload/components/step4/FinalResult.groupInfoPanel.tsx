import type { ReactNode } from "react"
import { Eye, FileText, FolderOpen, Loader2, Table2, X } from "lucide-react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { cn } from "@/shared/lib/utils"
import type {
  ClusterGroupInformationRow,
  ClusterGroupInformationTableResponse,
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
}: {
  table: ClusterGroupInformationTableResponse | null
  groupLabel: string
  loading: boolean
  error: string
  className?: string
  onClose: () => void
  onSelectDossier: (dossierId: string) => void
  onSelectDocument: (sessionDocumentId: number) => void
}) {
  const rows = table?.rows ?? []
  const countLabel = table?.count_label || "Số tờ/trang"

  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.16 }}
      className={cn(
        "flex min-h-[360px] min-w-0 flex-col overflow-hidden rounded-2xl border border-[#D8E1EC] bg-white shadow-sm sm:min-h-[520px]",
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
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function GroupInformationRow({
  row,
  onSelectDossier,
  onSelectDocument,
}: {
  row: ClusterGroupInformationRow
  onSelectDossier: (dossierId: string) => void
  onSelectDocument: (sessionDocumentId: number) => void
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
        <span
          className={cn(
            "[overflow-wrap:anywhere] whitespace-normal",
            row.basis_detail &&
              "cursor-help underline decoration-dotted underline-offset-2"
          )}
          title={row.basis_detail || row.basis || undefined}
        >
          {row.basis}
        </span>
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
