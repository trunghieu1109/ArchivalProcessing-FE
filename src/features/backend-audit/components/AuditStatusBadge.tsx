export function AuditStatusBadge({ value }: { value: string }) {
  const normalized = value.trim().toLowerCase()
  const className = [
    "completed",
    "complete",
    "ready",
    "active",
    "success",
    "final",
    "verified",
    "reviewed",
    "created",
    "available",
  ].some((item) => normalized.includes(item))
    ? "bg-emerald-100 text-emerald-800"
    : ["failed", "error", "cancelled", "canceled", "warning", "stale"].some(
          (item) => normalized.includes(item)
        )
      ? "bg-rose-100 text-rose-800"
      : ["processing", "running", "queued", "pending", "extracting"].some(
            (item) => normalized.includes(item)
          )
        ? "bg-amber-100 text-amber-800"
        : "bg-slate-100 text-slate-600"
  return (
    <span
      className={`inline-flex max-w-36 truncate rounded-full px-2 py-1 text-[9px] font-bold tracking-wide uppercase ${className}`}
      title={value}
    >
      {value || "unknown"}
    </span>
  )
}
