import type { ClusterDocumentWarning } from "@/features/upload/lib/clusterGroups"

export function clusterWarningTooltip(warning: ClusterDocumentWarning): string {
  return clusterWarningMessages(warning).join("\n")
}

export function clusterWarningHasCloserReason(
  warning: ClusterDocumentWarning,
  messages: string[] = []
): boolean {
  return (
    warning.reasons.includes("closer_to_another_cluster") ||
    warning.reasons.includes("closer_to_another_dossier") ||
    messages.some(isCloserWarningMessage)
  )
}

export function clusterWarningMessages(
  warning: ClusterDocumentWarning
): string[] {
  const baseMessages = warning.displayMessages.length
    ? warning.displayMessages
    : warning.reasons.length
      ? warning.reasons.map((reason) =>
          clusterWarningReasonLabel(reason, warning)
        )
      : warning.message
        ? [warning.message]
        : []
  const messages = baseMessages
    .map((message) => refineClusterWarningMessage(message, warning))
    .filter(Boolean)
  addMissingClusterWarningReasonMessages(messages, warning)
  if (!messages.length) {
    messages.push("Tài liệu cần được kiểm tra lại trong hồ sơ hiện tại.")
  }
  return uniqueWarningMessages(messages)
}

export function addMissingClusterWarningReasonMessages(
  messages: string[],
  warning: ClusterDocumentWarning
) {
  const combined = messages.join(" ").toLowerCase()
  if (
    warning.reasons.includes("low_similarity_to_cluster") &&
    !combined.includes("không đồng nhất")
  ) {
    messages.push(
      clusterWarningReasonLabel("low_similarity_to_cluster", warning)
    )
  }
  if (
    warning.reasons.includes("closer_to_another_cluster") &&
    !combined.includes("tương đồng")
  ) {
    messages.push(
      clusterWarningReasonLabel("closer_to_another_cluster", warning)
    )
  }
  if (
    warning.reasons.includes("temporal_outlier") &&
    !combined.includes("năm ban hành")
  ) {
    messages.push(clusterWarningReasonLabel("temporal_outlier", warning))
  }
}

export function refineClusterWarningMessage(
  message: string,
  warning: ClusterDocumentWarning
): string {
  const text = message.trim()
  if (
    clusterWarningHasCloserReason(warning, [text]) &&
    isGenericCloserWarningMessage(text)
  ) {
    return clusterWarningReasonLabel("closer_to_another_cluster", warning)
  }
  return text
}

export function isGenericCloserWarningMessage(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes("hồ sơ khác") ||
    lower.includes("một hồ sơ khác") ||
    lower.includes("another dossier") ||
    lower.includes("another cluster")
  )
}

export function isCloserWarningMessage(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    (lower.includes("tương đồng") && lower.includes("hồ sơ")) ||
    lower.includes("another dossier") ||
    lower.includes("another cluster")
  )
}

export function clusterWarningReasonLabel(
  reason: string,
  warning?: ClusterDocumentWarning
): string {
  if (reason === "closer_to_another_cluster") {
    const dossierTitle = warning?.nearestOtherDossierTitle.trim()
    return dossierTitle
      ? `Tài liệu có độ tương đồng với hồ sơ "${dossierTitle}" cao hơn.`
      : "Tài liệu có độ tương đồng với hồ sơ khác cao hơn."
  }
  const labels: Record<string, string> = {
    low_similarity_to_cluster: "Tài liệu không đồng nhất với hồ sơ.",
    temporal_outlier:
      "Năm ban hành của tài liệu khác với đa số tài liệu trong hồ sơ.",
  }
  return labels[reason] ?? reason
}

export function uniqueWarningMessages(messages: string[]): string[] {
  const seen = new Set<string>()
  return messages.filter((message) => {
    const normalized = message.trim()
    if (!normalized || seen.has(normalized)) return false
    seen.add(normalized)
    return true
  })
}

export function clusterWarningLevelLabel(riskLevel: string): string {
  const normalized = riskLevel.toLowerCase()
  if (normalized === "high") return "Cảnh báo cao"
  if (normalized === "medium") return "Cảnh báo trung bình"
  if (normalized === "low") return "Cảnh báo thấp"
  return "Cảnh báo"
}

export function clusterWarningLevelClass(riskLevel: string): string {
  const normalized = riskLevel.toLowerCase()
  if (normalized === "high") {
    return "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
  }
  if (normalized === "medium") {
    return "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
  }
  if (normalized === "low") {
    return "border-yellow-300 bg-yellow-50 text-yellow-800 hover:bg-yellow-100"
  }
  return "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
}
