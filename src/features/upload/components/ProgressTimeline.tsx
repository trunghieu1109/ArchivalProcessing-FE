import {
  Archive,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Clock3,
  CircleAlert,
  Database,
  FileSearch,
  FileSignature,
  FileSpreadsheet,
  FileText,
  FolderCog,
  ListTree,
  Loader2,
  Network,
  Save,
  Search,
  ShieldCheck,
  Tags,
  UploadCloud,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"

export interface ProgressPhase {
  id: string
  label: string
  icon?: LucideIcon
}

interface ProgressTimelineProps {
  phases: ProgressPhase[]
  activePhase?: string | null
  completedPhases?: Set<string>
  title?: string
  message?: string
  compact?: boolean
  visiblePhaseIds?: Set<string>
  failedPhase?: string | null
}

export function ProgressTimeline({
  phases,
  activePhase,
  completedPhases,
  title = "Tiến độ",
  message,
  compact = false,
  visiblePhaseIds,
  failedPhase,
}: ProgressTimelineProps) {
  const visiblePhases = visiblePhaseIds
    ? phases.filter((phase) => visiblePhaseIds.has(phase.id))
    : phases
  const activeIndex = activePhase
    ? visiblePhases.findIndex((phase) => phase.id === activePhase)
    : -1

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-[#D8E1EC] bg-white shadow-sm",
        compact ? "p-3" : "p-4"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-[#64748B] uppercase">
            {title}
          </p>
          {message && <p className="mt-1 text-sm text-[#0F172A]">{message}</p>}
        </div>
        {activePhase && (
          <Loader2 className="size-4 shrink-0 animate-spin text-[#0052FF]" />
        )}
      </div>
      <div
        className={cn(
          "mt-4 flex gap-0 overflow-x-auto pb-1",
          compact && "mt-3"
        )}
      >
        {visiblePhases.map((phase, index) => {
          const isComplete =
            completedPhases?.has(phase.id) ||
            (activeIndex >= 0 && index < activeIndex)
          const isActive = phase.id === activePhase
          const isFailed = phase.id === failedPhase
          const isLineComplete = isComplete || isActive
          const Icon = isFailed
            ? CircleAlert
            : (phase.icon ?? PHASE_ICONS[phase.id] ?? ClipboardList)
          return (
            <div
              key={phase.id}
              className={cn(
                "relative flex min-w-32 flex-1 flex-col items-center text-center",
                compact && "min-w-28"
              )}
            >
              {index > 0 && (
                <div
                  className={cn(
                    "absolute top-5 right-1/2 left-[-50%] h-px",
                    isFailed
                      ? "bg-red-300"
                      : isLineComplete
                        ? "bg-emerald-300"
                        : "bg-[#D8E1EC]"
                  )}
                />
              )}
              <div
                className={cn(
                  "relative z-10 flex size-10 items-center justify-center rounded-2xl border bg-white transition-all",
                  isFailed
                    ? "border-red-200 bg-red-50 text-red-600 shadow-sm"
                    : isComplete
                      ? "border-emerald-200 bg-emerald-50 text-emerald-600 shadow-sm"
                      : isActive
                        ? "border-[#BFD3FF] text-[#64748B] shadow-[0_0_0_5px_rgba(0,82,255,0.06)]"
                        : "border-[#D8E1EC] text-[#94A3B8]",
                  compact && "size-9 rounded-xl"
                )}
              >
                <Icon className={cn(compact ? "size-4" : "size-5")} />
              </div>
              <div className="mt-2 flex min-h-9 max-w-36 items-start justify-center gap-1.5">
                {isActive && !isComplete && !isFailed && (
                  <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-[#0052FF]" />
                )}
                <span
                  className={cn(
                    "text-xs leading-4 font-medium",
                    isFailed
                      ? "text-red-700"
                      : isComplete
                        ? "text-emerald-700"
                        : isActive
                          ? "text-[#0F172A]"
                          : "text-[#94A3B8]"
                  )}
                >
                  {phase.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const PHASE_ICONS: Record<string, LucideIcon> = {
  upload_inputs: UploadCloud,
  resolving_inputs: FileSearch,
  retention_schedule: ShieldCheck,
  plan_text: BookOpen,
  extracting_outline: FileText,
  classification_criteria: ListTree,
  file_register_analysis: FileText,
  normalizing_tree: Network,
  group_definitions: Search,
  validating_result: BadgeCheck,
  persisting_plan: Save,
  loading_verified_documents: Database,
  preparing_plan_file: BookOpen,
  building_dossiers: FolderCog,
  updating_dossiers: FolderCog,
  naming_dossiers: FileSignature,
  classifying_retention: Tags,
  classifying_dossiers: Tags,
  finding_retention: Clock3,
  retention_period: Clock3,
  reviewing_dossiers: BadgeCheck,
  persisting_clusters: Save,
  loading_data: Archive,
  creating_xlsx: FileSpreadsheet,
  writing_manifest: ClipboardList,
  completed: CheckCircle2,
  retention: Clock3,
}
