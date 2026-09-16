import type { ClusterVersionResponse } from "@/features/upload/api/sessionApi"

export function selectApplicableDraftClusterVersion(
  versions: ClusterVersionResponse[],
  activeClusterVersionId: string | null
): ClusterVersionResponse | null {
  const drafts = versions
    .filter(
      (version) =>
        version.status === "draft" &&
        (!version.is_stale || version.stale_reason === "inputs_updated")
    )
    .sort((left, right) => right.version_number - left.version_number)

  if (!activeClusterVersionId) return drafts[0] ?? null

  const activeVersionNumber = versions.find(
    (version) => version.id === activeClusterVersionId
  )?.version_number
  if (activeVersionNumber == null) return drafts[0] ?? null

  return (
    drafts.find((version) => version.version_number > activeVersionNumber) ??
    null
  )
}

export function shouldDisplayWorkingClusterVersion(options: {
  activeClusterVersionId: string | null
  displayedClusterVersionId: string | null
  hasClusterData: boolean
  workingClusterVersionId: string | null
}): boolean {
  const {
    activeClusterVersionId,
    displayedClusterVersionId,
    hasClusterData,
    workingClusterVersionId,
  } = options
  if (!workingClusterVersionId) return false
  if (!displayedClusterVersionId || !hasClusterData) return true
  return Boolean(
    activeClusterVersionId &&
    displayedClusterVersionId === activeClusterVersionId &&
    workingClusterVersionId !== activeClusterVersionId
  )
}
