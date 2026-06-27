import type { ClusterVersionResponse } from "@/features/upload/api/sessionApi"

export const CLUSTER_PROGRESS_PHASES = [
  { id: "updating_dossiers", label: "Đang cập nhật hồ sơ" },
  { id: "naming_dossiers", label: "Đặt tiêu đề hồ sơ" },
  { id: "classifying_dossiers", label: "Phân loại hồ sơ" },
  { id: "finding_retention", label: "Tìm thời hạn bảo quản" },
  { id: "reviewing_dossiers", label: "Rà soát hồ sơ" },
]
export const CLUSTER_ALL_PHASE_IDS = CLUSTER_PROGRESS_PHASES.map(
  (phase) => phase.id
)
export const FIRST_CLUSTER_PROGRESS_PHASE_ID = CLUSTER_PROGRESS_PHASES[0].id
const CLUSTER_PROGRESS_PHASE_ALIASES: Record<string, string> = {
  loading_verified_documents: "updating_dossiers",
  building_dossiers: "updating_dossiers",
  naming_dossiers: "naming_dossiers",
  classifying_retention: "finding_retention",
  persisting_clusters: "reviewing_dossiers",
}

export type ClusterJobMode =
  | "new"
  | "update"
  | "plan_reanalysis"
  | "file_register"

export function completedClusterPhaseSet(): Set<string> {
  return new Set(CLUSTER_ALL_PHASE_IDS)
}

export function completedClusterPhaseSetBefore(phaseId: string): Set<string> {
  const phaseIndex = CLUSTER_PROGRESS_PHASES.findIndex(
    (phase) => phase.id === phaseId
  )
  return new Set(
    CLUSTER_PROGRESS_PHASES.slice(0, Math.max(phaseIndex, 0)).map(
      (phase) => phase.id
    )
  )
}

export function clusterProgressPhaseIndex(
  phaseId: string | null | undefined
): number {
  if (!phaseId) return -1
  return CLUSTER_PROGRESS_PHASES.findIndex((phase) => phase.id === phaseId)
}

export function latestClusterProgressPhase(
  currentPhase: string | null | undefined,
  incomingPhase: string | null | undefined
): string | null {
  if (!incomingPhase) return currentPhase ?? null
  if (!currentPhase) return incomingPhase
  const currentIndex = clusterProgressPhaseIndex(currentPhase)
  const incomingIndex = clusterProgressPhaseIndex(incomingPhase)
  if (incomingIndex < 0) return currentPhase
  if (currentIndex < 0) return incomingPhase
  return incomingIndex >= currentIndex ? incomingPhase : currentPhase
}

export function mergeCompletedClusterPhaseSetBefore(
  previous: Set<string>,
  phaseId: string | null | undefined
): Set<string> {
  if (!phaseId) return previous
  const next = completedClusterPhaseSetBefore(phaseId)
  previous.forEach((item) => next.add(item))
  return next
}

export function normalizeClusterProgressPhase(
  phase: string | null | undefined
): string | null {
  if (!phase || phase === "completed") return null
  if (CLUSTER_ALL_PHASE_IDS.includes(phase)) return phase
  return CLUSTER_PROGRESS_PHASE_ALIASES[phase] ?? null
}

export function nextClusterProgressPhase(
  phase: string | null | undefined
): string {
  const currentPhase =
    normalizeClusterProgressPhase(phase) ?? FIRST_CLUSTER_PROGRESS_PHASE_ID
  const currentIndex = CLUSTER_PROGRESS_PHASES.findIndex(
    (item) => item.id === currentPhase
  )
  const nextIndex = Math.min(
    Math.max(currentIndex, 0) + 1,
    CLUSTER_PROGRESS_PHASES.length - 1
  )
  return CLUSTER_PROGRESS_PHASES[nextIndex].id
}

export function clusterProgressLabel(phaseId: string): string {
  return (
    CLUSTER_PROGRESS_PHASES.find((phase) => phase.id === phaseId)?.label ?? ""
  )
}

export function clusterProgressMessageForPhase(
  phaseId: string,
  mode: ClusterJobMode
): string {
  switch (phaseId) {
    case "updating_dossiers":
      return mode === "plan_reanalysis"
        ? "Đang lập lại hồ sơ theo phương án chỉnh lý và thời hạn bảo quản mới."
        : mode === "file_register"
          ? "Đang sắp xếp tài liệu theo loại văn bản, thời gian và giới hạn số trang của tập lưu."
          : mode === "update"
            ? "Đang áp dụng feedback và cập nhật cấu trúc hồ sơ."
            : "Đang gom tài liệu đã xác nhận vào hồ sơ."
    case "naming_dossiers":
      return "Đang đặt tiêu đề hồ sơ từ nội dung tài liệu."
    case "classifying_dossiers":
      return "Đang phân loại hồ sơ theo phương án chỉnh lý."
    case "finding_retention":
      return "Đang tìm thời hạn bảo quản phù hợp."
    case "reviewing_dossiers":
      return "Đang rà soát kết quả trước khi hiển thị phiên bản mới."
    default:
      return mode === "plan_reanalysis"
        ? "Đang lập lại hồ sơ theo phương án chỉnh lý mới."
        : mode === "file_register"
          ? "Đang lập lại hồ sơ theo phương án tập lưu."
          : mode === "update"
            ? "Đang cập nhật hồ sơ từ feedback đã lưu."
            : "Đang lập hồ sơ mới từ các tài liệu đã xác nhận."
  }
}

export function isTerminalClusterProgressMessage(message: string): boolean {
  return (
    !message ||
    message.startsWith("Đã ") ||
    message.includes("xong") ||
    message.includes("Không có job")
  )
}

export function dossierUiMessage(message: string): string {
  return message
    .replace(/phiên bản cụm/g, "phiên bản hồ sơ")
    .replace(/cập nhật cụm/g, "cập nhật hồ sơ")
    .replace(/phân cụm/g, "lập hồ sơ")
    .replace(/cụm/g, "hồ sơ")
}

export function clusterJobModeFromPayload(
  payload: Record<string, unknown> | null | undefined
): ClusterJobMode {
  return clusterJobModeFromSource(payload?.source)
}

export function clusterJobModeFromSource(source: unknown): ClusterJobMode {
  if (source === "plan_reanalysis") return "plan_reanalysis"
  if (source === "user_file_register") return "file_register"
  return source === "user_feedback" ? "update" : "new"
}

export function clusterVersionSourceLabel(source: unknown): string {
  if (source === "plan_reanalysis") return "theo phương án mới"
  if (source === "user_file_register") return "theo tập lưu"
  if (source === "user_feedback") return "từ feedback"
  if (source === "user_metadata_import") return "nhập metadata"
  if (source === "system") return "tự động"
  const text = String(source || "").trim()
  return text || "không rõ nguồn"
}

export function clusterVersionOptionLabel(
  version: ClusterVersionResponse,
  activeClusterVersionId: string | null
): string {
  const status =
    version.id === activeClusterVersionId
      ? "đang dùng"
      : version.status === "active"
        ? "active"
        : "cũ"
  return `Phiên bản ${version.version_number} - ${status} - ${clusterVersionSourceLabel(version.source)}`
}
