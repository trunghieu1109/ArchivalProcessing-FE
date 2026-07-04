import { useState, type KeyboardEvent } from "react"
import type { ReactNode } from "react"
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  CheckCircle2,
  FileText,
  Layers3,
  Loader2,
  ShieldCheck,
  Trash2,
  UserCog,
} from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/shared/lib/utils"
import type { ChinhlyUser } from "@/features/auth/api/authApi"
import type { SessionSummary } from "@/features/upload/api/sessionApi"
import { chinhlyUserId, type SessionAnalysisStatuses } from "./SessionsPage.utils"

export function SessionCard({
  session,
  index,
  onOpen,
  onDelete,
  deleting,
  isAdmin,
  coordinators,
  coordinator,
  analysisStatuses,
  assigning,
  onAssignCoordinator,
}: {
  session: SessionSummary
  index: number
  onOpen: () => void
  onDelete: () => void
  deleting: boolean
  isAdmin: boolean
  coordinators: ChinhlyUser[]
  coordinator?: ChinhlyUser
  analysisStatuses: SessionAnalysisStatuses
  assigning: boolean
  onAssignCoordinator: (coordinatorUserId: string | null) => void
}) {
  const [assignmentOpen, setAssignmentOpen] = useState(false)
  const [draftCoordinatorId, setDraftCoordinatorId] = useState<string | null>(
    null
  )
  const currentCoordinatorId = session.coordinator_user_id ?? ""
  const selectedCoordinatorId = draftCoordinatorId ?? currentCoordinatorId
  const hasPlan = Boolean(session.active_plan_version_id)
  const hasClusters = Boolean(session.active_cluster_version_id)
  const documentCount = session.document_count ?? 0
  const clusterCount = session.cluster_count ?? 0
  const incorrectCount = session.metadata_incorrect_document_count ?? 0
  const correctCount =
    session.metadata_correct_document_count ??
    Math.max(documentCount - incorrectCount, 0)
  const statusText = hasClusters
    ? "Đã lập hồ sơ"
    : hasPlan
      ? "Có phương án"
      : statusLabel(session.status)
  const displayName = session.fonds_name?.trim() || "Chưa đặt tên phông"
  const archiveName = session.archive_name?.trim()
  const coordinatorLabel = coordinator
    ? displayChinhlyUser(coordinator)
    : session.coordinator_user_id
      ? `User ${session.coordinator_user_id}`
      : "Chưa phân công"

  const saveAssignment = () => {
    onAssignCoordinator(selectedCoordinatorId.trim() || null)
    setDraftCoordinatorId(null)
    setAssignmentOpen(false)
  }

  const toggleAssignment = () => {
    const nextOpen = !assignmentOpen
    setAssignmentOpen(nextOpen)
    setDraftCoordinatorId(nextOpen ? currentCoordinatorId : null)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return
    event.preventDefault()
    onOpen()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: index * 0.035 }}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
      className="group flex min-h-56 cursor-pointer flex-col justify-between rounded-2xl border border-[#D8E1EC] bg-white p-5 text-left shadow-sm outline-none transition-all hover:-translate-y-1 hover:border-[#0052FF]/35 hover:shadow-[0_18px_42px_rgba(15,23,42,0.12)] focus-visible:border-[#0052FF] focus-visible:ring-2 focus-visible:ring-[#0052FF]/20"
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              className="truncate text-base font-bold text-[#0F172A]"
              title={displayName}
            >
              {displayName}
            </p>
            <p className="mt-1 text-xs text-[#64748B]">
              Mã session: {session.session_id}
            </p>
            <p className="mt-1 text-xs text-[#64748B]">
              Cập nhật {formatDate(session.updated_at ?? session.created_at)}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
              hasClusters
                ? "bg-emerald-50 text-emerald-700"
                : hasPlan
                  ? "bg-blue-50 text-[#0052FF]"
                  : "bg-slate-100 text-slate-600"
            )}
          >
            {statusText}
          </span>
        </div>
        <div className="mt-4 flex min-w-0 items-center gap-2 rounded-xl bg-[#F8FAFC] px-3 py-2 text-sm text-[#475569]">
          <Archive className="size-4 shrink-0 text-[#0052FF]" />
          <span className="shrink-0 text-[11px] font-semibold tracking-[0.1em] text-[#64748B] uppercase">
            Kho
          </span>
          <span
            className="truncate font-semibold text-[#0F172A]"
            title={archiveName || "Chưa có kho lưu trữ"}
          >
            {archiveName || "Chưa có kho lưu trữ"}
          </span>
        </div>
        {isAdmin && (
          <div className="mt-2 rounded-xl bg-[#F8FAFC] px-3 py-2 text-sm text-[#475569]">
            <div className="flex min-w-0 items-center gap-2">
              <UserCog className="size-4 shrink-0 text-[#0052FF]" />
              <span className="shrink-0 text-[11px] font-semibold tracking-[0.1em] text-[#64748B] uppercase">
                Người chịu trách nhiệm
              </span>
              <span
                className="truncate font-semibold text-[#0F172A]"
                title={coordinatorLabel}
              >
                {coordinatorLabel}
              </span>
            </div>
            {assignmentOpen && (
              <div
                className="mt-3 flex flex-col gap-2 sm:flex-row"
                onClick={(event) => event.stopPropagation()}
              >
                <select
                  value={selectedCoordinatorId}
                  onChange={(event) =>
                    setDraftCoordinatorId(event.target.value)
                  }
                  className="min-h-9 flex-1 rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm font-medium text-[#0F172A] transition-colors outline-none focus:border-[#0052FF]"
                >
                  <option value="">Chưa phân công</option>
                  {coordinators.map((item) => {
                    const id = chinhlyUserId(item)
                    if (!id) return null
                    return (
                      <option key={id} value={id}>
                        {displayChinhlyUser(item)}
                      </option>
                    )
                  })}
                </select>
                <button
                  type="button"
                  onClick={saveAssignment}
                  disabled={assigning}
                  className="rounded-lg bg-[#0052FF] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#0047D6] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {assigning ? "Đang lưu" : "Lưu"}
                </button>
              </div>
            )}
          </div>
        )}
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Metric
            icon={<FileText className="size-3.5" />}
            label="Số tài liệu"
            value={documentCount}
          />
          <Metric
            icon={<CheckCircle2 className="size-3.5" />}
            label="Extract Đúng"
            value={correctCount}
            valueClassName="text-emerald-700"
          />
          <Metric
            icon={<FileText className="size-3.5" />}
            label="PAPL"
            value={analysisStatuses.arrangement}
            valueClassName={analysisStatusClassName(
              analysisStatuses.arrangement
            )}
          />
          <Metric
            icon={<Layers3 className="size-3.5" />}
            label="Số hồ sơ"
            value={clusterCount}
          />
          <Metric
            icon={<AlertTriangle className="size-3.5" />}
            label="Extract Sai"
            value={incorrectCount}
            valueClassName={incorrectCount > 0 ? "text-amber-700" : undefined}
          />
          <Metric
            icon={<ShieldCheck className="size-3.5" />}
            label="THBQ"
            value={analysisStatuses.retention}
            valueClassName={analysisStatusClassName(analysisStatuses.retention)}
          />
        </div>
      </div>
      <div
        className="mt-5 flex flex-col gap-2 border-t border-[#EEF2F7] pt-4 sm:flex-row sm:items-center sm:justify-between"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onOpen}
          className="flex items-center justify-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-[#0052FF] transition-colors hover:bg-[#EAF1FF]"
        >
          Mở phông
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </button>
        <div className="flex items-center justify-end gap-2">
          {isAdmin && (
            <button
              type="button"
              onClick={toggleAssignment}
              disabled={assigning}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-[#CBD5E1] px-2.5 py-1 text-xs font-semibold text-[#475569] transition-colors hover:border-[#0052FF]/40 hover:text-[#0052FF] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {assigning ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <UserCog className="size-3.5" />
              )}
              Phân công
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 transition-colors hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
            {deleting ? "Đang xóa" : "Xóa"}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

export function SummaryPill({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="rounded-2xl border border-[#D8E1EC] bg-white px-4 py-2 text-right shadow-sm">
      <p className="text-[11px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">
        {label}
      </p>
      <p className="text-lg font-bold text-[#0F172A]">{value}</p>
    </div>
  )
}

function Metric({
  icon,
  label,
  value,
  valueClassName,
}: {
  icon: ReactNode
  label: string
  value: string | number
  valueClassName?: string
}) {
  return (
    <div className="rounded-xl bg-[#F8FAFC] px-3 py-2">
      <div className="flex items-center gap-1.5 text-[#64748B]">
        {icon}
        <span className="text-[11px] font-semibold uppercase">{label}</span>
      </div>
      <p
        className={cn(
          "mt-1 text-sm leading-tight font-semibold break-words text-[#0F172A]",
          valueClassName
        )}
      >
        {value}
      </p>
    </div>
  )
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

function displayChinhlyUser(user: ChinhlyUser): string {
  const id = chinhlyUserId(user)
  const name = String(
    user.display_name ||
      user.name ||
      user.email ||
      user.username ||
      id ||
      "Người chịu trách nhiệm"
  ).trim()
  const email = String(user.email || user.username || "").trim()
  return email && email !== name ? `${name} (${email})` : name
}

function analysisStatusClassName(
  status: SessionAnalysisStatuses[keyof SessionAnalysisStatuses]
): string {
  if (status === "Đã phân tích") return "text-emerald-700"
  if (status === "Đang phân tích") return "text-[#0052FF]"
  return "text-slate-600"
}

function statusLabel(value: string): string {
  const normalized = value.toLowerCase()
  if (normalized === "created") return "Mới tạo"
  if (normalized === "processing") return "Đang xử lý"
  if (normalized === "completed" || normalized === "done") return "Hoàn tất"
  if (normalized === "failed" || normalized === "error") return "Có lỗi"
  return value
}
