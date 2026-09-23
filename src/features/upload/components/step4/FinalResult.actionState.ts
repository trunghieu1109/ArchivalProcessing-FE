export interface FinalResultActionStateInput {
  hasPendingClusterVersion: boolean
  pendingClusterVersionStatus: string | null
  pendingClusterVersionNeedsRefresh: boolean
  pendingFeedbackCount: number
  supplementalVerificationPendingCount: number
  supplementalPendingDocumentCount: number
  supplementalPendingUpdateDocumentCount: number
  unclassifiedDossierCount?: number
  clusterVersionStale: boolean
  busy: boolean
  viewingHistoricalClusterVersion: boolean
  readOnly?: boolean
  hasSession: boolean
  totalFiles: number
  totalDossiers: number
}

export interface FinalResultActionState {
  clusterMutationBlockedReason: string | null
  approvalBlockedReason: string | null
  canApprovePendingVersion: boolean
  updateNeeded: boolean
  showUpdateAction: boolean
  updateBlockedReason: string | null
  canUpdateDossiers: boolean
  finishBlockedReason: string | null
  canFinish: boolean
}

export function resolveFinalResultActionState(
  input: FinalResultActionStateInput
): FinalResultActionState {
  const hasDraft =
    input.hasPendingClusterVersion &&
    input.pendingClusterVersionStatus === "draft"
  const clusterMutationBlockedReason = !input.hasSession
    ? "Chưa có session để cập nhật hồ sơ."
    : input.readOnly
      ? "Phông gộp chỉ cho phép xem kết quả lập hồ sơ."
    : input.totalFiles <= 0 && (input.unclassifiedDossierCount ?? 0) <= 0
      ? "Chưa có tài liệu để cập nhật hồ sơ."
      : input.viewingHistoricalClusterVersion
        ? "Bạn đang xem phiên bản cũ. Hãy quay về phiên bản đang làm việc trước khi cập nhật hồ sơ."
        : input.busy
          ? "Hồ sơ đang được cập nhật. Vui lòng chờ thao tác hoàn tất."
          : null
  const approvalBlockedReason = !hasDraft
    ? null
    : input.readOnly
      ? "Phông gộp không cho phép duyệt hoặc thay đổi kết quả lập hồ sơ tại đây."
    : input.busy
      ? "Hồ sơ đang được cập nhật. Vui lòng chờ thao tác hoàn tất."
      : input.viewingHistoricalClusterVersion
        ? "Bạn đang xem phiên bản cũ. Hãy quay về phiên bản draft đang làm việc trước khi duyệt."
        : input.supplementalVerificationPendingCount > 0
          ? `Còn ${input.supplementalVerificationPendingCount} đợt tài liệu bổ sung chưa verify đủ.`
          : input.supplementalPendingUpdateDocumentCount > 0
            ? `Còn ${input.supplementalPendingUpdateDocumentCount} tài liệu bổ sung chưa có trong phiên bản này.`
            : input.pendingFeedbackCount > 0
              ? `Còn ${input.pendingFeedbackCount} feedback mới chưa được cập nhật vào phiên bản này.`
              : (input.unclassifiedDossierCount ?? 0) > 0
                ? `Còn ${input.unclassifiedDossierCount} hồ sơ chưa được phân loại.`
                : input.pendingClusterVersionNeedsRefresh
                  ? "Phiên bản chờ duyệt chưa chứa các thay đổi mới nhất."
                  : null

  const updateNeeded = Boolean(
    input.clusterVersionStale ||
    input.pendingFeedbackCount > 0 ||
    (input.unclassifiedDossierCount ?? 0) > 0 ||
    input.supplementalPendingUpdateDocumentCount > 0 ||
    (hasDraft && input.pendingClusterVersionNeedsRefresh)
  )
  const updateBlockedReason = !updateNeeded
    ? "Không có thay đổi mới cần cập nhật vào hồ sơ."
    : clusterMutationBlockedReason

  const finishBlockedReason = input.viewingHistoricalClusterVersion
    ? "Bạn đang xem phiên bản hồ sơ cũ. Hãy quay về phiên bản đang dùng trước khi đánh số trang."
    : input.supplementalVerificationPendingCount > 0
      ? `Còn ${input.supplementalVerificationPendingCount} đợt tài liệu bổ sung chưa verify đủ.`
      : input.pendingFeedbackCount > 0
        ? `Còn ${input.pendingFeedbackCount} feedback chưa được cập nhật vào hồ sơ.`
        : (input.unclassifiedDossierCount ?? 0) > 0
          ? `Còn ${input.unclassifiedDossierCount} hồ sơ chưa phân loại. Hãy cập nhật hồ sơ trước khi đánh số trang.`
          : hasDraft
            ? approvalBlockedReason
              ? `Phiên bản draft chưa thể duyệt: ${approvalBlockedReason}`
              : "Có phiên bản hồ sơ draft đang chờ duyệt và kích hoạt."
            : input.clusterVersionStale
              ? "Danh sách tài liệu đã thay đổi. Hãy cập nhật hồ sơ trước khi đánh số trang."
              : input.supplementalPendingDocumentCount > 0
                ? `Còn ${input.supplementalPendingDocumentCount} tài liệu bổ sung chưa có trong phiên bản hồ sơ active.`
                : input.totalDossiers <= 0
                  ? "Chưa có hồ sơ để chuyển sang bước Đánh số trang."
                  : input.busy
                    ? "Hồ sơ đang được cập nhật. Vui lòng chờ thao tác hoàn tất."
                    : null

  return {
    clusterMutationBlockedReason,
    approvalBlockedReason,
    canApprovePendingVersion: hasDraft && approvalBlockedReason === null,
    updateNeeded,
    showUpdateAction: true,
    updateBlockedReason,
    canUpdateDossiers: updateBlockedReason === null,
    finishBlockedReason,
    canFinish: finishBlockedReason === null,
  }
}
