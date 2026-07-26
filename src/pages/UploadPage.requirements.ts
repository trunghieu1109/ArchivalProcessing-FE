export type DossierBuildInputKey =
  | "arrangement_plan"
  | "retention_schedule"
  | "verified_documents"
  | "active_plan"
  | "active_plan_data"

const INPUT_LABELS: Record<DossierBuildInputKey, string> = {
  arrangement_plan: "phương án chỉnh lý",
  retention_schedule: "thông tư thời hạn bảo quản",
  verified_documents: "tài liệu đã xác thực",
  active_plan: "phương án chỉnh lý đã được duyệt",
  active_plan_data: "dữ liệu cây của phương án đã duyệt",
}

export function missingDossierBuildInputs({
  hasArrangementPlan,
  hasRetentionSchedule,
  hasVerifiedDocuments,
  hasActivePlan,
  hasActivePlanData,
}: {
  hasArrangementPlan: boolean
  hasRetentionSchedule: boolean
  hasVerifiedDocuments: boolean
  hasActivePlan: boolean
  hasActivePlanData: boolean
}): DossierBuildInputKey[] {
  const missing: DossierBuildInputKey[] = []
  if (!hasArrangementPlan) missing.push("arrangement_plan")
  else if (!hasActivePlan) missing.push("active_plan")
  else if (!hasActivePlanData) missing.push("active_plan_data")
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
