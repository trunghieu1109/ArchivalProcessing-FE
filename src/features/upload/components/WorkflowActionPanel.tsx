import type { HTMLAttributes, ReactNode } from "react"
import { cn } from "@/shared/lib/utils"

export type WorkflowActionTone = "neutral" | "progress" | "success" | "warning"

export const workflowActionPanelClassName =
  "overflow-hidden rounded-2xl border border-[#D8E1EC] bg-white/95 shadow-[0_10px_32px_rgba(15,23,42,0.09)] backdrop-blur"

const statusToneClassNames: Record<
  WorkflowActionTone,
  { icon: string; title: string; description: string }
> = {
  neutral: {
    icon: "border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B]",
    title: "text-[#0F172A]",
    description: "text-[#64748B]",
  },
  progress: {
    icon: "border-[#BFD3FF] bg-[#F3F7FF] text-[#0052FF]",
    title: "text-[#0F172A]",
    description: "text-[#64748B]",
  },
  success: {
    icon: "border-emerald-200 bg-emerald-50 text-emerald-600",
    title: "text-[#0F172A]",
    description: "text-[#64748B]",
  },
  warning: {
    icon: "border-amber-200 bg-amber-50 text-amber-600",
    title: "text-[#78350F]",
    description: "text-[#A16207]",
  },
}

export function WorkflowActionPanel({
  sticky = false,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { sticky?: boolean }) {
  return (
    <div
      data-slot="workflow-action-panel"
      className={cn(
        workflowActionPanelClassName,
        sticky && "sticky bottom-0 z-20",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function WorkflowActionPanelBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col items-stretch gap-3 px-4 py-3.5 sm:px-5 lg:flex-row lg:items-center lg:gap-5",
        className
      )}
      {...props}
    />
  )
}

export function WorkflowActionStatus({
  icon,
  title,
  description,
  tone = "neutral",
  className,
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  icon: ReactNode
  title: ReactNode
  description?: ReactNode
  tone?: WorkflowActionTone
}) {
  const toneClassNames = statusToneClassNames[tone]

  return (
    <div
      className={cn("flex min-w-0 flex-1 items-start gap-3", className)}
      {...props}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl border",
          toneClassNames.icon
        )}
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className="min-w-0 self-center">
        <p className={cn("text-sm font-semibold", toneClassNames.title)}>
          {title}
        </p>
        {description ? (
          <div
            className={cn(
              "mt-0.5 text-xs leading-5 break-words",
              toneClassNames.description
            )}
          >
            {description}
          </div>
        ) : null}
      </div>
    </div>
  )
}
