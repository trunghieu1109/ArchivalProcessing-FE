export type DossierBuildInputKey =
  | "arrangement_plan"
  | "retention_schedule"
  | "verified_documents"
  | "active_plan"

const INPUT_LABELS: Record<DossierBuildInputKey, string> = {
  arrangement_plan: "phương án chỉnh lý",
  retention_schedule: "thông tư thời hạn bảo quản",
  verified_documents: "tài liệu đã được chuyên gia xác thực",
  active_plan: "phương án chỉnh lý đã được duyệt",
}

export function hasExpertReviewedDocuments({
  reviewedCount,
  documents,
}: {
  reviewedCount: number
  documents: Array<{ metadata_ready?: boolean; is_reviewed?: boolean }>
}): boolean {
  return (
    reviewedCount > 0 ||
    documents.some(
      (document) =>
        document.metadata_ready === true && document.is_reviewed === true
    )
  )
}

export function missingDossierBuildInputs({
  hasArrangementPlan,
  hasRetentionSchedule,
  hasVerifiedDocuments,
  hasActivePlan,
}: {
  hasArrangementPlan: boolean
  hasRetentionSchedule: boolean
  hasVerifiedDocuments: boolean
  hasActivePlan: boolean
}): DossierBuildInputKey[] {
  const missing: DossierBuildInputKey[] = []
  if (!hasArrangementPlan) missing.push("arrangement_plan")
  else if (!hasActivePlan) missing.push("active_plan")
  if (!hasRetentionSchedule) missing.push("retention_schedule")
  if (!hasVerifiedDocuments) missing.push("verified_documents")
  return missing
}

export function dossierBuildMissingMessage(
  missingInputs: DossierBuildInputKey[]
): string {
  if (missingInputs.length === 0) return ""
  return `Chưa thể lập hồ sơ. Còn thiếu: ${missingInputs
    .map((input) => INPUT_LABELS[input])
    .join(", ")}.`
}

export function dossierBuildMissingLabels(
  missingInputs: DossierBuildInputKey[]
): string {
  return missingInputs.map((input) => INPUT_LABELS[input]).join(", ")
}

export function selectedUploadLabels({
  hasArrangementPlan,
  hasRetentionSchedule,
  hasRawZip,
}: {
  hasArrangementPlan: boolean
  hasRetentionSchedule: boolean
  hasRawZip: boolean
}): string[] {
  const labels: string[] = []
  if (hasArrangementPlan) labels.push("Phương án")
  if (hasRetentionSchedule) labels.push("Thông tư")
  if (hasRawZip) labels.push("Data ZIP")
  return labels
}
