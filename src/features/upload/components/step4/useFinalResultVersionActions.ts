import type { PointerEvent as ReactPointerEvent } from "react"
import { toast } from "sonner"
import {
  activateClusterVersion,
  approveClusterVersion,
  ensureClusterBuild,
  getActiveClusters,
  getClusterVersion,
  listUnclassifiedSessionDossiers,
  classifyUnclassifiedSessionDossiers,
} from "@/features/upload/api/sessionApi"
import type {
  ClusterDocument,
  ClusterGroup,
} from "@/features/upload/lib/clusterGroups"
import { versionToGroups } from "@/features/upload/lib/clusterGroups"
import {
  FIRST_CLUSTER_PROGRESS_PHASE_ID,
  clusterJobModeFromSource,
  clusterProgressMessageForPhase,
  completedClusterPhaseSet,
} from "./FinalResult.progress"
import {
  clusteredDocumentIds,
  regularDossierCount,
  temporaryDocumentCount,
} from "./FinalResult.metadataUtils"

const NO_CLUSTER_VERSION = "__none__"

export function useFinalResultVersionActions(context: Record<string, any>) {
  const {
    activeClusterVersionId,
    clusterJobMode,
    clusterActionState,
    displayedClusterVersion,
    displayedClusterVersionId,
    metadataItems,
    onFinish,
    pendingClusterVersion,
    previewLayoutRef,
    sessionId,
    verifiedItems,
    viewingHistoricalClusterVersion,
    setActiveClusterVersionId,
    setCheckingClusters,
    setClusterCompletedPhases,
    setClusterJobMode,
    setClusterProgressMessage,
    setClusterProgressPhase,
    setDisplayedClusterVersion,
    setDisplayedClusterVersionId,
    setDraggedDocument,
    setDropTargetId,
    setGroups,
    setLoading,
    setLoadingClusterVersionId,
    setPendingClusterVersion,
    setPendingFeedbackCount,
    setPendingFeedbackRefreshKey,
    setPreviewWidthPercent,
    setRebuildBaselineVersionId,
    setRebuildPollKey,
    setRebuildSubmitting,
    setRestoringClusterVersion,
    setSelectedMetadataGroupId,
    setSelectedPreviewDocumentId,
    setSelectedSessionDocumentIds,
    setStatus,
  } = context

  const handleRebuildClusters = async (
    mode: "update" | "file_register" = "update"
  ) => {
    const forceFileRegister = mode === "file_register"
    const previousJobMode = clusterJobMode
    const blockedReason = forceFileRegister
      ? clusterActionState.clusterMutationBlockedReason
      : clusterActionState.updateBlockedReason
    if (viewingHistoricalClusterVersion) {
      toast.error(
        "Bạn đang xem phiên bản cũ. Hãy kích hoạt phiên bản này trước khi cập nhật hồ sơ."
      )
      return
    }
    if (!sessionId) {
      toast.error("Chưa có session để cập nhật hồ sơ.")
      return
    }
    let waitingDossiers: Awaited<
      ReturnType<typeof listUnclassifiedSessionDossiers>
    >["dossiers"] = []
    try {
      waitingDossiers = forceFileRegister
        ? []
        : (await listUnclassifiedSessionDossiers(sessionId)).dossiers
    } catch {
      if (blockedReason) {
        toast.error(blockedReason)
        return
      }
    }
    const staleUnclassifiedState =
      !forceFileRegister &&
      waitingDossiers.length > 0 &&
      !clusterActionState.updateNeeded
    if (blockedReason && !staleUnclassifiedState) {
      toast.error(blockedReason)
      return
    }
    setClusterJobMode(mode)
    setRebuildSubmitting(true)
    try {
      const activeVersion = await getActiveClusters(sessionId)
      const currentVersion =
        pendingClusterVersion ??
        (displayedClusterVersion?.status === "draft"
          ? displayedClusterVersion
          : activeVersion)
      const baselineVersionId =
        currentVersion?.id ?? activeClusterVersionId ?? NO_CLUSTER_VERSION
      setActiveClusterVersionId(
        activeVersion?.id ?? activeClusterVersionId ?? null
      )
      if (waitingDossiers.length > 0) {
        const response = await classifyUnclassifiedSessionDossiers(sessionId)
        setRebuildBaselineVersionId(baselineVersionId)
        setRebuildPollKey((key: number) => key + 1)
        setLoading(true)
        setCheckingClusters(false)
        setStatus(
          `Đã gửi yêu cầu cập nhật ${response.selected_dossier_count} hồ sơ chưa phân loại. Đang chờ backend tạo phiên bản mới.`
        )
        toast.success("Đã gửi job cập nhật hồ sơ chưa phân loại.")
        return
      }
      const response = await ensureClusterBuild(sessionId, {
        source: forceFileRegister ? "user_file_register" : "user_feedback",
        apply_ready_supplemental_intakes: true,
        ...(forceFileRegister
          ? { dossier_build_strategy: "file_register" as const }
          : {}),
      })
      if (response.status === "not_needed") {
        setClusterJobMode(previousJobMode)
        setStatus(
          forceFileRegister
            ? "Hồ sơ theo tập lưu đã được cập nhật với dữ liệu mới nhất."
            : "Hồ sơ đã được cập nhật với dữ liệu mới nhất."
        )
        toast.info(
          forceFileRegister
            ? "Không có thay đổi mới để lập lại hồ sơ theo tập lưu."
            : "Không có tài liệu hoặc feedback mới để cập nhật hồ sơ."
        )
        return
      }
      setRebuildBaselineVersionId(baselineVersionId)
      setRebuildPollKey((key: number) => key + 1)
      setLoading(true)
      setCheckingClusters(false)
      setClusterJobMode(mode)
      setClusterProgressPhase(FIRST_CLUSTER_PROGRESS_PHASE_ID)
      setClusterProgressMessage(
        clusterProgressMessageForPhase(FIRST_CLUSTER_PROGRESS_PHASE_ID, mode)
      )
      setClusterCompletedPhases(new Set())
      setStatus(
        forceFileRegister
          ? "Đã gửi job lập lại hồ sơ theo tập lưu. Đang chờ backend tạo phiên bản mới."
          : "Đã gửi job cập nhật hồ sơ. Đang chờ backend tạo phiên bản mới."
      )
      toast.success(
        response.status === "already_queued_or_running"
          ? forceFileRegister
            ? "Đã có job lập hồ sơ đang chạy."
            : "Đã có job cập nhật hồ sơ đang chạy."
          : forceFileRegister
            ? "Đã gửi job lập lại hồ sơ theo tập lưu."
            : "Đã gửi job cập nhật hồ sơ."
      )
    } catch (err) {
      setClusterJobMode(previousJobMode)
      toast.error(
        err instanceof Error
          ? err.message
          : forceFileRegister
            ? "Không gửi được job lập lại hồ sơ theo tập lưu."
            : "Không gửi được job cập nhật hồ sơ."
      )
    } finally {
      setRebuildSubmitting(false)
    }
  }

  const handleApplyPendingClusterVersion = async () => {
    if (!pendingClusterVersion || !sessionId) return
    if (clusterActionState.approvalBlockedReason) {
      toast.error(clusterActionState.approvalBlockedReason)
      return
    }
    setRestoringClusterVersion(true)
    try {
      const appliedVersion =
        pendingClusterVersion.status === "draft"
          ? await approveClusterVersion(sessionId, pendingClusterVersion.id)
          : pendingClusterVersion
      const nextGroups = versionToGroups(appliedVersion, metadataItems)
      const clusteredIds = clusteredDocumentIds(appliedVersion)
      const hasMetadataItems = metadataItems.length > 0
      const missingVerified = hasMetadataItems
        ? verifiedItems.filter(
            (item: { document_id: string }) =>
              !clusteredIds.has(item.document_id)
          )
        : []
      setGroups(nextGroups)
      setDisplayedClusterVersionId(appliedVersion.id)
      setDisplayedClusterVersion(appliedVersion)
      setActiveClusterVersionId(appliedVersion.id)
      setPendingClusterVersion(null)
      if (
        appliedVersion.source === "user_feedback" ||
        appliedVersion.source === "user_file_register"
      ) {
        setPendingFeedbackCount(0)
        setPendingFeedbackRefreshKey((key: number) => key + 1)
      }
      setClusterJobMode(clusterJobModeFromSource(appliedVersion.source))
      setClusterProgressPhase(null)
      setClusterCompletedPhases(completedClusterPhaseSet())
      setClusterProgressMessage("Đã áp dụng phiên bản hồ sơ mới.")
      const nextDossierCount = regularDossierCount(nextGroups)
      const nextTemporaryCount = temporaryDocumentCount(nextGroups)
      setStatus(
        nextDossierCount > 0 &&
          (!hasMetadataItems ||
            verifiedItems.length === 0 ||
            missingVerified.length === 0)
          ? `Đã lập ${nextDossierCount} hồ sơ${verifiedItems.length > 0 ? ` từ ${verifiedItems.length} tài liệu đã xác nhận` : ""}.${nextTemporaryCount > 0 ? ` Có ${nextTemporaryCount} tài liệu trong Thư mục tạm.` : ""}`
          : hasMetadataItems &&
              nextDossierCount > 0 &&
              missingVerified.length > 0
            ? `Đã có ${nextDossierCount} hồ sơ. Có ${missingVerified.length} tài liệu đã xác nhận chưa được cập nhật vào hồ sơ.`
            : nextTemporaryCount > 0
              ? `Có ${nextTemporaryCount} tài liệu trong Thư mục tạm; chưa có hồ sơ để tạo mục lục.`
              : "Chưa có kết quả lập hồ sơ từ backend."
      )
      toast.success(
        pendingClusterVersion.status === "draft"
          ? "Đã duyệt và kích hoạt phiên bản hồ sơ mới."
          : "Đã áp dụng phiên bản hồ sơ mới."
      )
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Không thể duyệt phiên bản hồ sơ đang chờ."
      )
    } finally {
      setRestoringClusterVersion(false)
    }
  }

  const handleViewClusterVersion = async (clusterVersionId: string) => {
    if (!sessionId) {
      toast.error("Chưa có session để xem phiên bản hồ sơ.")
      return
    }
    if (!clusterVersionId || clusterVersionId === displayedClusterVersionId) {
      return
    }

    setLoadingClusterVersionId(clusterVersionId)
    try {
      const version = await getClusterVersion(sessionId, clusterVersionId)
      const nextGroups = versionToGroups(version, metadataItems)
      setGroups(nextGroups)
      setDisplayedClusterVersionId(version.id)
      setDisplayedClusterVersion(version)
      setSelectedSessionDocumentIds(new Set())
      setSelectedPreviewDocumentId(null)
      setSelectedMetadataGroupId(null)
      setDraggedDocument(null)
      setDropTargetId(null)
      setClusterJobMode(clusterJobModeFromSource(version.source))
      setClusterProgressPhase(null)
      setClusterCompletedPhases(completedClusterPhaseSet())
      setClusterProgressMessage(
        version.id === activeClusterVersionId
          ? "Đang xem phiên bản hồ sơ đang dùng."
          : "Đang xem phiên bản hồ sơ cũ. Các thao tác chỉnh sửa đang tạm khóa."
      )
      setStatus(
        `Đang xem phiên bản ${version.version_number} với ${regularDossierCount(nextGroups)} hồ sơ.`
      )
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Không thể tải phiên bản hồ sơ."
      )
    } finally {
      setLoadingClusterVersionId(null)
    }
  }

  const handleActivateDisplayedClusterVersion = async () => {
    if (!sessionId || !displayedClusterVersionId) {
      toast.error("Chưa có phiên bản hồ sơ để kích hoạt.")
      return
    }
    if (displayedClusterVersionId === activeClusterVersionId) return
    if (pendingClusterVersion) {
      toast.error("Hãy xử lý phiên bản hồ sơ đang chờ áp dụng trước.")
      return
    }

    setRestoringClusterVersion(true)
    try {
      const version = await activateClusterVersion(
        sessionId,
        displayedClusterVersionId
      )
      const nextGroups = versionToGroups(version, metadataItems)
      setGroups(nextGroups)
      setActiveClusterVersionId(version.id)
      setDisplayedClusterVersionId(version.id)
      setDisplayedClusterVersion(version)
      setSelectedSessionDocumentIds(new Set())
      setPendingClusterVersion(null)
      setRebuildBaselineVersionId(null)
      setClusterJobMode(clusterJobModeFromSource(version.source))
      setClusterProgressPhase(null)
      setClusterCompletedPhases(completedClusterPhaseSet())
      setClusterProgressMessage(
        "Đã đặt phiên bản đang xem làm phiên bản đang dùng."
      )
      setStatus(
        `Đã đặt phiên bản ${version.version_number} làm phiên bản đang dùng.`
      )
      toast.success("Đã kích hoạt phiên bản hồ sơ đang xem.")
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Không thể kích hoạt phiên bản hồ sơ đang xem."
      )
    } finally {
      setRestoringClusterVersion(false)
    }
  }

  const handleRestorePreviousClusterVersion = async () => {
    const previousVersionId = displayedClusterVersion?.previous_version_id
    if (!sessionId || !previousVersionId) {
      toast.error("Không tìm thấy phiên bản hồ sơ ban đầu để quay trở lại.")
      return
    }
    if (pendingClusterVersion) {
      toast.error("Hãy xử lý phiên bản hồ sơ đang chờ áp dụng trước.")
      return
    }

    setRestoringClusterVersion(true)
    try {
      const version = await activateClusterVersion(sessionId, previousVersionId)
      const nextGroups = versionToGroups(version, metadataItems)
      setGroups(nextGroups)
      setActiveClusterVersionId(version.id)
      setDisplayedClusterVersionId(version.id)
      setDisplayedClusterVersion(version)
      setPendingClusterVersion(null)
      setRebuildBaselineVersionId(null)
      setClusterJobMode(clusterJobModeFromSource(version.source))
      setClusterProgressPhase(null)
      setClusterCompletedPhases(completedClusterPhaseSet())
      setClusterProgressMessage("Đã quay trở lại phiên bản hồ sơ ban đầu.")
      setStatus(
        `Đã quay trở lại phiên bản hồ sơ ban đầu với ${regularDossierCount(nextGroups)} hồ sơ.`
      )
      toast.success("Đã quay trở lại phiên bản hồ sơ ban đầu.")
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Không thể quay trở lại phiên bản hồ sơ ban đầu."
      )
    } finally {
      setRestoringClusterVersion(false)
    }
  }

  const handleSelectPreviewDocument = (document: ClusterDocument) => {
    if (document.sessionDocumentId === null) {
      toast.error("Tài liệu này chưa có mã trong session để lấy preview.")
      return
    }
    setSelectedMetadataGroupId(null)
    setSelectedPreviewDocumentId(document.sessionDocumentId)
  }

  const handleSelectDossierMetadata = (group: ClusterGroup) => {
    setSelectedPreviewDocumentId(null)
    setSelectedMetadataGroupId((current: string | null) =>
      current === group.id ? null : group.id
    )
  }

  const handlePreviewResizePointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>
  ) => {
    const container = previewLayoutRef.current
    if (!container) return
    event.preventDefault()

    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"

    const updatePreviewWidth = (clientX: number) => {
      const rect = container.getBoundingClientRect()
      const rawPercent = ((rect.right - clientX) / rect.width) * 100
      setPreviewWidthPercent(Math.min(65, Math.max(50, rawPercent)))
    }

    updatePreviewWidth(event.clientX)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      updatePreviewWidth(moveEvent.clientX)
    }
    const handlePointerUp = () => {
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
      window.removeEventListener("pointercancel", handlePointerUp)
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)
    window.addEventListener("pointercancel", handlePointerUp)
  }

  const handleFinish = () => {
    if (clusterActionState.finishBlockedReason) {
      toast.error(clusterActionState.finishBlockedReason)
      return
    }
    onFinish()
  }

  return {
    handleActivateDisplayedClusterVersion,
    handleApplyPendingClusterVersion,
    handleFinish,
    handlePreviewResizePointerDown,
    handleRebuildClusters,
    handleRestorePreviousClusterVersion,
    handleSelectDossierMetadata,
    handleSelectPreviewDocument,
    handleViewClusterVersion,
  }
}
