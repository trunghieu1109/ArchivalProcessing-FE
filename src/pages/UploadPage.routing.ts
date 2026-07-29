import type { AppStep } from "@/features/upload/types"

export function workflowStepFromLocation(
  routeStep: string | undefined,
  pathname: string
): AppStep {
  const pathnameStep = pathname.match(/\/step\/([^/]+)\/?$/)?.[1]
  const parsed = Number.parseInt(pathnameStep ?? routeStep ?? "1", 10)
  const safeStep = Number.isFinite(parsed) ? parsed : 1
  return Math.min(Math.max(safeStep, 1), 7) as AppStep
}
