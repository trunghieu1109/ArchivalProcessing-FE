import type { HTMLAttributes, ReactNode } from "react"
import { cn } from "@/shared/lib/utils"

export type WorkflowActionTone = "neutral" | "progress" | "success" | "warning"

export const workflowActionPanelClassName =
  "overflow-hidden rounded-2xl border border-[#D8E1EC] bg-white shadow-sm"

const statusToneClassNames: Record<
  WorkflowActionTone,
  { icon: string; title: string; description: string }
> = {
  neutral: {
    icon: "text-[#64748B]",
    title: "text-[#0F172A]",
    description: "text-[#64748B]",
  },
  progress: {
    icon: "text-[#0052FF]",
    title: "text-[#0F172A]",
    description: "text-[#64748B]",
  },
  success: {
    icon: "text-emerald-600",
    title: "text-[#0F172A]",
    description: "text-[#64748B]",
  },
  warning: {
    icon: "text-amber-600",
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
        sticky &&
          "sticky bottom-0 z-20 bg-white/95 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur",
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
        "flex flex-col items-stretch gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:gap-5",
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
      className={cn("flex min-w-0 flex-1 items-start gap-2", className)}
      {...props}
    >
      <span
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center [&>svg]:size-4",
          toneClassNames.icon
        )}
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className="min-w-0">
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
