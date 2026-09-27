export const HOMOGENEOUS_WORKFLOW_LABELS = [
  "Tải lên",
  "Cấu trúc",
  "Xử lý",
  "Phân cụm",
  "Hồ sơ tạm",
  "Kết quả",
  "Đánh số trang",
  "Tạo mục lục",
  "Xuất bản",
] as const

const HOMOGENEOUS_FLOW_STORAGE_PREFIX =
  "archival-processing:homogeneous-workflow:"

export function markHomogeneousWorkflow(sessionId: string) {
  if (!sessionId) return
  window.sessionStorage.setItem(
    `${HOMOGENEOUS_FLOW_STORAGE_PREFIX}${sessionId}`,
    "1"
  )
}

export function isHomogeneousWorkflow(sessionId: string | null | undefined) {
  if (!sessionId) return false
  return (
    window.sessionStorage.getItem(
      `${HOMOGENEOUS_FLOW_STORAGE_PREFIX}${sessionId}`
    ) === "1"
  )
}

export function homogeneousHeaderStepForAppStep(step: number) {
  return step <= 3 ? step : step + 2
}

export type HomogeneousContinuationStep = 4 | 5 | null

export function homogeneousContinuationStep({
  hasCurrentVersion,
  versionIsStale = false,
  provisionalDossierStatuses = [],
}: {
  hasCurrentVersion: boolean
  versionIsStale?: boolean
  provisionalDossierStatuses?: readonly string[]
}): HomogeneousContinuationStep {
  if (!hasCurrentVersion || versionIsStale) return null
  return provisionalDossierStatuses.some(
    (status) => status.trim().toLowerCase() === "draft"
  )
    ? 5
    : 4
}

export function homogeneousWorkflowRoute(sessionId: string, step: number) {
  const encodedSessionId = encodeURIComponent(sessionId)
  if (step <= 3) return `/sessions/${encodedSessionId}/step/${step}`
  if (step === 4) return `/sessions/${encodedSessionId}/clusters/review`
  if (step === 5) return `/sessions/${encodedSessionId}/dossiers/compose`
  return `/sessions/${encodedSessionId}/step/${Math.min(7, step - 2)}`
}
