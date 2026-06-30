import type { ReactNode } from "react"
import { cn } from "@/shared/lib/utils"
import type { MetadataBatchGroup } from "./ProcessStep.types"

export function ReviewModeButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon?: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-colors",
        active
          ? "bg-[#0052FF] text-white shadow-sm"
          : "text-[#475569] hover:bg-[#EFF6FF] hover:text-[#0F172A]"
      )}
    >
      {icon ? icon : null}
      {label}
    </button>
  )
}

export function BatchMetric({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <span className="rounded-full border border-[#D8E1EC] bg-[#F8FAFC] px-2 py-1">
      {label}: <strong className="text-[#0F172A]">{value}</strong>
    </span>
  )
}

export function MetadataBatchButton({
  group,
  active,
  onClick,
  scopeLabel,
}: {
  group: MetadataBatchGroup
  active: boolean
  onClick: () => void
  scopeLabel?: string
}) {
  const progress =
    group.totalCount > 0 ? (group.reviewedCount / group.totalCount) * 100 : 0
  const done = group.reviewedCount === group.totalCount
  const needsReview = group.warningCount > 0 || group.pendingReadyCount > 0
  const scopedTitleSuffix = scopeLabel ? ` (${scopeLabel})` : ""

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${group.label}${scopedTitleSuffix}: ${group.reviewedCount}/${group.totalCount} đã review`}
      className={cn(
        "min-w-[9.5rem] rounded-lg border px-3 py-2 text-left transition-colors",
        active
          ? "border-[#0052FF] bg-[#EFF6FF] text-[#0F172A] shadow-sm"
          : done
            ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300"
            : needsReview
              ? "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300"
              : "border-[#D8E1EC] bg-[#F8FAFC] text-[#475569] hover:border-[#BFD3FF]"
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold">{group.label}</span>
        <span className="text-[10px]">
          {group.reviewedCount}/{group.totalCount}
          {scopeLabel ? (
            <span className="ml-1 opacity-75">{scopeLabel}</span>
          ) : null}
        </span>
      </span>
      <span className="mt-1 block text-[10px] opacity-80">
        {group.kind === "manual"
          ? group.assigneeName || group.assigneeEmail
            ? (group.assigneeName ?? group.assigneeEmail)
            : `${group.totalCount} tài liệu`
          : group.kind === "reviewed"
            ? "Đã review"
            : group.kind === "unassigned"
              ? "Chưa chia"
              : `${group.start}-${group.end}`}
      </span>
      <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-white/70">
        <span
          className={cn(
            "block h-full rounded-full",
            done ? "bg-emerald-500" : "bg-[#0052FF]"
          )}
          style={{ width: `${progress}%` }}
        />
      </span>
    </button>
  )
}

export function ProgressMetric({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="min-w-20 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
      <p className="text-[10px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">
        {label}
      </p>
      <p className="text-base font-bold text-[#0F172A]">{value}</p>
    </div>
  )
}
