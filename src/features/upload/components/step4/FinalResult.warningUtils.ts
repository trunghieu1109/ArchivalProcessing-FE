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
    messages.push("Nên xem xét lại vị trí của tài liệu trong hồ sơ hiện tại.")
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
    !combined.includes("mức tương đồng thấp")
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
  const normalized = text.toLowerCase()
  if (
    warning.reasons.includes("low_similarity_to_cluster") &&
    normalized.includes("không đồng nhất")
  ) {
    return clusterWarningReasonLabel("low_similarity_to_cluster", warning)
  }
  if (normalized.includes("cần được kiểm tra lại")) {
    return "Nên xem xét lại vị trí của tài liệu trong hồ sơ hiện tại."
  }
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
    low_similarity_to_cluster:
      "Tài liệu có mức tương đồng thấp hơn so với các tài liệu khác trong hồ sơ.",
    temporal_outlier:
      "Năm ban hành của tài liệu khác với khoảng thời gian phổ biến trong hồ sơ.",
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
  void riskLevel
  return "Cần kiểm tra"
}

export function clusterWarningLevelClass(riskLevel: string): string {
  void riskLevel
  return "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
}
