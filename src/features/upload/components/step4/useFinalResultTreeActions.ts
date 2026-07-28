import { useEffect, type DragEvent as ReactDragEvent } from "react"
import { toast } from "sonner"
import {
  addMetadataEditKeepClusterFeedback,
  moveDocumentBetweenClusters,
  moveSelectedDocumentsToCluster,
  patchSessionDossier,
  patchSessionDossierDraft,
  patchDocumentMetadata,
  promoteSelectedDocumentsToDossier,
  promoteTemporaryFolderDocuments,
  suggestSessionDossierRetention,
  suggestSessionDossierTitle,
  type ClusterFeedbackResponse,
  type DossierPromoteResponse,
  type SessionDossierSuggestionPayload,
  type SessionDocumentResponse,
} from "@/features/upload/api/sessionApi"
import { documentEditLockErrorMessage } from "@/features/upload/lib/documentEditLockErrors"
import { buildDisplayMetadata } from "@/features/upload/lib/metadata"
import { documentSignatureStatus } from "@/features/upload/lib/signatureStatus"
import {
  clusterDocumentCountsFromMetadata,
  clusterDocumentTotals,
  type ClusterDocument,
  type ClusterGroup,
  type PendingClusterFeedbackMarker,
} from "@/features/upload/lib/clusterGroups"
import type { DossierMetadataDraft } from "./FinalResult.metadataUtils"
import {
  dossierPatchPayloadFromDraft,
  updateDossierGroupFromResponse,
} from "./FinalResult.metadataUtils"
import { applyPendingDossierDrafts } from "./FinalResult.pendingFeedback"
import {
  moveDocumentLocally,
  moveSelectedDocumentsLocally,
} from "./FinalResult.treeUtils"

const RESULT_TREE_AUTO_SCROLL_EDGE_PX = 84
const RESULT_TREE_AUTO_SCROLL_MAX_STEP_PX = 22

export function useFinalResultTreeActions(context: Record<string, any>) {
  const {
    draggedDocument,
    groups,
    loading,
    movingSelectedDocumentsTargetId,
    pendingClusterVersion,
    promotingSelectedDocuments,
    promotingTemporaryFolder,
    rebuildBaselineVersionId,
    rebuildSubmitting,
    resultTreeAutoScrollFrameRef,
    resultTreeDragYRef,
    resultTreeScrollRef,
    selectableSessionDocumentIdSet,
    selectedSessionDocumentIds,
    sessionId,
    viewingHistoricalClusterVersion,
    setDraggedDocument,
    setDropTargetId,
    setGroups,
    setMovingSelectedDocumentsTargetId,
    setOpenNodeIds,
    setPendingFeedbackCount,
    setPendingFeedbackRefreshKey,
    setPromotingSelectedDocuments,
    setPromotingTemporaryFolder,
    setSavingDossierMetadataId,
    setSelectedSessionDocumentIds,
    setStatus,
  } = context

  const toggleNode = (nodeId: string) => {
    setOpenNodeIds((previous: Set<string>) => {
      const next = new Set(previous)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }

  const stopResultTreeAutoScroll = () => {
    if (resultTreeAutoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(resultTreeAutoScrollFrameRef.current)
      resultTreeAutoScrollFrameRef.current = null
    }
    resultTreeDragYRef.current = null
  }

  useEffect(() => {
    if (!draggedDocument) {
      stopResultTreeAutoScroll()
      return
    }

    const handleWindowDragOver = (event: DragEvent) => {
      resultTreeDragYRef.current = event.clientY
    }

    const tick = () => {
      const container = resultTreeScrollRef.current
      const clientY = resultTreeDragYRef.current
      if (container && clientY !== null) {
        autoScrollResultTree(container, clientY)
      }
      resultTreeAutoScrollFrameRef.current = window.requestAnimationFrame(tick)
    }

    window.addEventListener("dragover", handleWindowDragOver)
    resultTreeAutoScrollFrameRef.current = window.requestAnimationFrame(tick)

    return () => {
      window.removeEventListener("dragover", handleWindowDragOver)
      stopResultTreeAutoScroll()
    }
  }, [draggedDocument])

  const handleResultTreeDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!draggedDocument) return
    resultTreeDragYRef.current = event.clientY
  }

  const handleToggleDocumentSelection = (
    sessionDocumentId: number,
    checked: boolean
  ) => {
    setSelectedSessionDocumentIds((current: Set<number>) => {
      const next = new Set(current)
      if (checked) {
        next.add(sessionDocumentId)
      } else {
        next.delete(sessionDocumentId)
      }
      return next
    })
  }

  const handleToggleGroupSelection = (
    group: ClusterGroup,
    checked: boolean
  ) => {
    const sessionDocumentIds = group.documents
      .map((document) => document.sessionDocumentId)
      .filter((id): id is number => id !== null)
    if (sessionDocumentIds.length === 0) return
    setSelectedSessionDocumentIds((current: Set<number>) => {
      const next = new Set(current)
      sessionDocumentIds.forEach((sessionDocumentId) => {
        if (checked) {
          next.add(sessionDocumentId)
        } else {
          next.delete(sessionDocumentId)
        }
      })
      return next
    })
  }

  const handleDropOnDossier = async (targetClusterId: string) => {
    if (!draggedDocument) return
    if (viewingHistoricalClusterVersion) {
      stopResultTreeAutoScroll()
      setDraggedDocument(null)
      setDropTargetId(null)
      toast.error(
        "Bạn đang xem phiên bản cũ. Hãy kích hoạt phiên bản này trước khi chỉnh hồ sơ."
      )
      return
    }
    const sourceGroup = groups.find(
      (group: ClusterGroup) => group.id === draggedDocument.fromClusterId
    )
    const targetGroup = groups.find(
      (group: ClusterGroup) => group.id === targetClusterId
    )
    const sourceFeedbackClusterId =
      sourceGroup?.clusterId ?? draggedDocument.fromClusterId
    const targetFeedbackClusterId = targetGroup?.clusterId ?? targetClusterId
    if (
      draggedDocument.fromClusterId === targetClusterId ||
      sourceFeedbackClusterId === targetFeedbackClusterId
    ) {
      stopResultTreeAutoScroll()
      setDraggedDocument(null)
      setDropTargetId(null)
      return
    }
    if (!sessionId) {
      toast.error("Chưa có session để ghi feedback.")
      return
    }
    if (!draggedDocument.document.sessionDocumentId) {
      toast.error(
        "Tài liệu này chưa có mã trong session để ghi nhận di chuyển."
      )
      return
    }

    const moving = draggedDocument
    const targetIsTemporary = Boolean(targetGroup?.isTemporary)
    const sessionDocumentId = draggedDocument.document.sessionDocumentId
    const optimisticFeedback = pendingFeedbackMarker({
      id: -sessionDocumentId,
      action: targetIsTemporary ? "move_to_temporary_folder" : "manual_move",
      sourceClusterId: sourceFeedbackClusterId,
      targetClusterId: targetFeedbackClusterId,
    })
    stopResultTreeAutoScroll()
    setDraggedDocument(null)
    setDropTargetId(null)
    setGroups((previous: any) =>
      moveDocumentLocally(previous, moving, targetClusterId, optimisticFeedback)
    )
    setStatus("Đang lưu feedback di chuyển tài liệu...")

    try {
      const response = await moveDocumentBetweenClusters(sessionId, {
        session_document_id: sessionDocumentId,
        source_cluster_id: sourceFeedbackClusterId,
        target_cluster_id: targetFeedbackClusterId,
        details: {
          action: targetIsTemporary
            ? "move_to_temporary_folder"
            : "manual_move",
          document_id: moving.document.documentId,
          file_name: moving.document.fileName,
          source_cluster_id: sourceFeedbackClusterId,
          target_cluster_id: targetFeedbackClusterId,
        },
      })
      const cancelledFeedbackCount =
        response.cancelled_metadata_keep_feedback_ids?.length ?? 0
      setGroups((previous: ClusterGroup[]) =>
        replacePendingFeedbackMarkerLocally(
          previous,
          sessionDocumentId,
          response
        )
      )
      setPendingFeedbackCount((count: number) =>
        Math.max(0, count - cancelledFeedbackCount + 1)
      )
      setPendingFeedbackRefreshKey((key: number) => key + 1)
      setStatus(
        targetIsTemporary
          ? "Đã lưu việc chuyển tài liệu vào Thư mục tạm. Bấm Cập nhật hồ sơ để áp dụng."
          : "Đã lưu feedback di chuyển tài liệu. Bấm Cập nhật hồ sơ khi bạn muốn lập hồ sơ lại."
      )
      toast.success(
        targetIsTemporary
          ? "Đã chuyển tài liệu vào Thư mục tạm."
          : "Đã lưu feedback chuyển tài liệu."
      )
    } catch (err) {
      setGroups((previous: ClusterGroup[]) =>
        moveDocumentLocally(
          previous,
          {
            document: moving.document,
            fromClusterId: targetClusterId,
          },
          moving.fromClusterId
        )
      )
      setStatus("Không lưu được feedback di chuyển tài liệu. Vui lòng thử lại.")
      toast.error(
        err instanceof Error
          ? err.message
          : "Không gửi được feedback di chuyển tài liệu."
      )
    }
  }

  const handleSaveDossierMetadata = async (
    group: ClusterGroup,
    draft: DossierMetadataDraft,
    dirtyFields: ReadonlySet<keyof DossierMetadataDraft>
  ) => {
    if (viewingHistoricalClusterVersion) {
      toast.error(
        "Bạn đang xem phiên bản cũ. Hãy kích hoạt phiên bản này trước khi sửa metadata hồ sơ."
      )
      throw new Error("Cannot edit a historical cluster version")
    }
    if (!sessionId) {
      toast.error("Chưa có session để cập nhật metadata hồ sơ.")
      throw new Error("Missing session id")
    }
    const dossierId = group.dossierId ?? group.id
    if (!dossierId) {
      toast.error("Hồ sơ này chưa có mã để cập nhật metadata.")
      throw new Error("Missing dossier id")
    }
    if (dirtyFields.size === 0) {
      toast.info("Không có thay đổi metadata để lưu.")
      return
    }

    setSavingDossierMetadataId(dossierId)
    try {
      const payload = dossierPatchPayloadFromDraft(draft, dirtyFields)
      if (group.isPendingDossier) {
        if (!group.draftId) {
          toast.error("Hồ sơ tạm này chưa có bản nháp metadata để lưu.")
          throw new Error("Missing dossier draft id")
        }
        const response = await patchSessionDossierDraft(
          sessionId,
          group.draftId,
          payload
        )
        setGroups((previous: ClusterGroup[]) =>
          applyPendingDossierDrafts(previous, [response])
        )
        setStatus(
          `Đã lưu metadata nháp hồ sơ "${String(response.metadata?.title || group.label)}". Bấm Cập nhật hồ sơ để áp dụng.`
        )
        toast.success("Đã lưu metadata nháp hồ sơ.")
        return
      }
      const response = await patchSessionDossier(sessionId, dossierId, payload)
      setGroups((previous: any) =>
        updateDossierGroupFromResponse(previous, group.id, response)
      )
      setStatus(
        `Đã cập nhật metadata hồ sơ "${response.title || response.generated_title || group.label}".`
      )
      toast.success("Đã cập nhật metadata hồ sơ.")
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Không thể cập nhật metadata hồ sơ."
      )
      throw err
    } finally {
      setSavingDossierMetadataId(null)
    }
  }

  const handleSaveDocumentMetadata = async (
    document: ClusterDocument,
    clusterId: string,
    metadata: Record<string, unknown>,
    lockToken: string
  ) => {
    if (viewingHistoricalClusterVersion) {
      toast.error(
        "Bạn đang xem phiên bản cũ. Hãy kích hoạt phiên bản này trước khi sửa metadata tài liệu."
      )
      throw new Error("Cannot edit a historical cluster version")
    }
    if (!sessionId) {
      toast.error("Chưa có session để cập nhật metadata tài liệu.")
      throw new Error("Missing session id")
    }
    const sessionDocumentId = document.sessionDocumentId
    if (!sessionDocumentId) {
      toast.error("Tài liệu này chưa có mã session để cập nhật metadata.")
      throw new Error("Missing session document id")
    }
    if (pendingClusterVersion) {
      toast.error(
        "Có phiên bản hồ sơ mới. Hãy áp dụng trước khi sửa metadata tài liệu."
      )
      throw new Error("Pending cluster version exists")
    }
    if (
      loading ||
      rebuildSubmitting ||
      rebuildBaselineVersionId ||
      promotingTemporaryFolder ||
      promotingSelectedDocuments ||
      movingSelectedDocumentsTargetId
    ) {
      toast.error("Đang cập nhật hồ sơ. Vui lòng chờ xong rồi thử lại.")
      throw new Error("Cluster update is busy")
    }

    let updatedDocument: SessionDocumentResponse | null = null
    try {
      const patchedDocument = await patchDocumentMetadata(
        sessionId,
        sessionDocumentId,
        metadata,
        { lockToken }
      )
      updatedDocument = patchedDocument
      const feedback = await addMetadataEditKeepClusterFeedback(sessionId, {
        session_document_id: sessionDocumentId,
        target_cluster_id: clusterId,
        details: {
          action: "metadata_edit_keep_cluster",
          document_id: document.documentId,
          file_name: document.fileName,
          target_cluster_id: clusterId,
        },
      })
      setGroups((previous: ClusterGroup[]) =>
        updateDocumentMetadataLocally(
          previous,
          sessionDocumentId,
          patchedDocument,
          {
            id: feedback.id,
            action: "metadata_edit_keep_cluster",
            sourceClusterId: feedback.source_cluster_id ?? null,
            targetClusterId: feedback.target_cluster_id ?? clusterId,
            createdAt: feedback.created_at,
          }
        )
      )
      const cancelledFeedbackCount =
        feedback.cancelled_metadata_keep_feedback_ids?.length ?? 0
      setPendingFeedbackCount((count: number) =>
        Math.max(0, count - cancelledFeedbackCount + 1)
      )
      setPendingFeedbackRefreshKey((key: number) => key + 1)
      setStatus(
        "Đã lưu metadata tài liệu. Bấm Cập nhật hồ sơ để áp dụng vào lập cụm."
      )
      toast.success("Đã lưu metadata tài liệu.")
    } catch (err) {
      if (updatedDocument) {
        const persistedDocument = updatedDocument
        setGroups((previous: ClusterGroup[]) =>
          updateDocumentMetadataOnlyLocally(
            previous,
            sessionDocumentId,
            persistedDocument
          )
        )
        setStatus(
          "Metadata đã được lưu, nhưng chưa ghi nhận được feedback giữ cụm."
        )
        toast.error(
          "Metadata đã được lưu. Không ghi nhận được feedback giữ cụm; vui lòng thử lưu lại."
        )
      } else {
        setStatus("Không thể lưu metadata tài liệu.")
        toast.error(
          documentEditLockErrorMessage(err, "Không thể lưu metadata tài liệu.")
        )
      }
      throw err
    }
  }

  const buildPendingDossierSuggestionMetadata = async (
    sessionDocumentIds: number[]
  ): Promise<Record<string, unknown>> => {
    if (!sessionId || sessionDocumentIds.length === 0) return {}
    const metadata: Record<string, unknown> = {}
    const suggestionPayload: SessionDossierSuggestionPayload = {
      session_document_ids: sessionDocumentIds,
      metadata,
    }
    const failedParts: string[] = []

    setStatus("Đang gợi ý tiêu đề và thời hạn bảo quản cho hồ sơ tạm...")

    try {
      const titleResponse = await suggestSessionDossierTitle(
        sessionId,
        suggestionPayload
      )
      const title = titleSuggestionFromResponse(titleResponse)
      if (title) {
        metadata.title = title
      }
    } catch (err) {
      failedParts.push("tiêu đề")
      console.warn("Failed to suggest pending dossier title", err)
    }

    try {
      const retentionResponse = await suggestSessionDossierRetention(
        sessionId,
        {
          ...suggestionPayload,
          metadata: {
            ...metadata,
          },
          options: { limit: 10 },
        }
      )
      const retentionPeriod =
        retentionPeriodSuggestionFromResponse(retentionResponse)
      if (retentionPeriod) {
        metadata.retention_period = retentionPeriod
      }
      const retentionRecommendation =
        retentionRecommendationFromResponse(retentionResponse)
      if (Object.keys(retentionRecommendation).length > 0) {
        metadata.retention_recommendation = retentionRecommendation
      }
    } catch (err) {
      failedParts.push("thời hạn bảo quản")
      console.warn("Failed to suggest pending dossier retention period", err)
    }

    if (Object.keys(metadata).length === 0) {
      if (failedParts.length > 0) {
        toast.warning(
          `Chưa gợi ý được ${failedParts.join(" và ")} cho hồ sơ tạm.`
        )
      }
      setStatus(
        "Chưa có gợi ý tiêu đề hoặc thời hạn bảo quản phù hợp. Đang ghi nhận hồ sơ tạm với metadata cơ bản."
      )
      return metadata
    }

    const suggestedParts = [
      metadata.title ? "tiêu đề" : "",
      metadata.retention_period
        ? "thời hạn bảo quản"
        : metadata.retention_recommendation
          ? "danh sách gợi ý thời hạn bảo quản"
          : "",
    ].filter(Boolean)
    setStatus(
      `Đã tự gợi ý ${suggestedParts.join(" và ")} cho hồ sơ tạm. Đang ghi nhận hồ sơ tạm...`
    )
    if (failedParts.length > 0) {
      toast.warning(`Chưa gợi ý được ${failedParts.join(" và ")}.`)
    }
    return metadata
  }

  const handleCreateDossierFromSelection = async (
    requestedSessionDocumentIds?: Iterable<number>
  ): Promise<boolean> => {
    if (viewingHistoricalClusterVersion) {
      toast.error(
        "Bạn đang xem phiên bản cũ. Hãy kích hoạt phiên bản này trước khi tạo hồ sơ."
      )
      return false
    }
    if (!sessionId) {
      toast.error("Chưa có session để tạo hồ sơ từ tài liệu đã chọn.")
      return false
    }
    if (pendingClusterVersion) {
      toast.error(
        "Có phiên bản hồ sơ mới. Hãy áp dụng trước khi tạo hồ sơ khác."
      )
      return false
    }
    if (
      loading ||
      rebuildSubmitting ||
      rebuildBaselineVersionId ||
      promotingTemporaryFolder ||
      promotingSelectedDocuments ||
      movingSelectedDocumentsTargetId
    ) {
      toast.error("Đang cập nhật hồ sơ. Vui lòng chờ xong rồi thử lại.")
      return false
    }
    const sessionDocumentIds = Array.from(
      new Set(
        requestedSessionDocumentIds ??
          (selectedSessionDocumentIds as Set<number>)
      )
    ).filter((sessionDocumentId) =>
      selectableSessionDocumentIdSet.has(sessionDocumentId)
    )
    if (sessionDocumentIds.length === 0) {
      toast.error("Chưa chọn tài liệu hợp lệ để tạo hồ sơ mới.")
      return false
    }

    setPromotingSelectedDocuments(true)
    try {
      const metadata =
        await buildPendingDossierSuggestionMetadata(sessionDocumentIds)
      const response = await promoteSelectedDocumentsToDossier(sessionId, {
        session_document_ids: sessionDocumentIds,
        metadata,
      })
      setGroups((previous: ClusterGroup[]) =>
        applyPendingDossierPromotionLocally(
          previous,
          response,
          response.action ?? "promote_selected_documents"
        )
      )
      const cancelledFeedbackCount =
        response.cancelled_metadata_keep_feedback_ids?.length ?? 0
      setPendingFeedbackCount((count: number) =>
        Math.max(0, count - cancelledFeedbackCount + response.feedback_count)
      )
      setPendingFeedbackRefreshKey((key: number) => key + 1)
      setSelectedSessionDocumentIds((current: Set<number>) => {
        const next = new Set(current)
        sessionDocumentIds.forEach((sessionDocumentId) =>
          next.delete(sessionDocumentId)
        )
        return next
      })
      setStatus(
        Object.keys(metadata).length > 0
          ? "Đã ghi nhận hồ sơ tạm kèm metadata gợi ý. Bạn có thể sửa trước khi bấm Cập nhật hồ sơ."
          : "Đã ghi nhận hồ sơ tạm. Bạn có thể sửa metadata trước khi bấm Cập nhật hồ sơ."
      )
      toast.success("Đã ghi nhận hồ sơ mới từ tài liệu đã chọn.")
      return true
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Không thể tạo hồ sơ mới từ tài liệu đã chọn."
      )
      return false
    } finally {
      setPromotingSelectedDocuments(false)
    }
  }

  const handleMoveSelectionToDossier = async (
    group: ClusterGroup,
    requestedSessionDocumentIds?: Iterable<number>
  ): Promise<boolean> => {
    if (viewingHistoricalClusterVersion) {
      toast.error(
        "Bạn đang xem phiên bản cũ. Hãy kích hoạt phiên bản này trước khi chuyển tài liệu."
      )
      return false
    }
    if (!sessionId) {
      toast.error("Chưa có session để chuyển tài liệu đã chọn.")
      return false
    }
    if (pendingClusterVersion) {
      toast.error(
        "Có phiên bản hồ sơ mới. Hãy áp dụng trước khi chuyển tài liệu."
      )
      return false
    }
    if (
      loading ||
      rebuildSubmitting ||
      rebuildBaselineVersionId ||
      promotingTemporaryFolder ||
      promotingSelectedDocuments ||
      movingSelectedDocumentsTargetId
    ) {
      toast.error("Đang cập nhật hồ sơ. Vui lòng chờ xong rồi thử lại.")
      return false
    }
    const sessionDocumentIds = Array.from(
      new Set(
        requestedSessionDocumentIds ??
          (selectedSessionDocumentIds as Set<number>)
      )
    ).filter((sessionDocumentId) =>
      selectableSessionDocumentIdSet.has(sessionDocumentId)
    )
    if (sessionDocumentIds.length === 0) {
      toast.error("Chưa chọn tài liệu hợp lệ để chuyển.")
      return false
    }

    const targetIsTemporary = Boolean(group.isTemporary)
    const optimisticFeedback = pendingFeedbackMarker({
      id: -Date.now(),
      action: targetIsTemporary ? "move_to_temporary_folder" : "manual_move",
      sourceClusterId: null,
      targetClusterId: group.clusterId,
    })
    setMovingSelectedDocumentsTargetId(group.id)
    let previousGroups: ClusterGroup[] | null = null
    setGroups((previous: ClusterGroup[]) => {
      previousGroups = previous
      return moveSelectedDocumentsLocally(
        previous,
        sessionDocumentIds,
        group.id,
        optimisticFeedback
      )
    })
    try {
      const response = await moveSelectedDocumentsToCluster(sessionId, {
        session_document_ids: sessionDocumentIds,
        target_cluster_id: group.clusterId,
      })
      const cancelledFeedbackCount =
        response.cancelled_metadata_keep_feedback_ids?.length ?? 0
      setPendingFeedbackCount((count: number) =>
        Math.max(0, count - cancelledFeedbackCount + response.feedback_count)
      )
      setPendingFeedbackRefreshKey((key: number) => key + 1)
      setSelectedSessionDocumentIds((current: Set<number>) => {
        const next = new Set(current)
        sessionDocumentIds.forEach((sessionDocumentId) =>
          next.delete(sessionDocumentId)
        )
        return next
      })
      setStatus(
        targetIsTemporary
          ? `Đã ghi nhận ${response.moved_document_ids.length} tài liệu chuyển vào Thư mục tạm. Bấm Cập nhật hồ sơ để áp dụng.`
          : `Đã ghi nhận ${response.moved_document_ids.length} tài liệu chuyển tới hồ sơ "${group.label}". Bấm Cập nhật hồ sơ để áp dụng.`
      )
      toast.success(
        targetIsTemporary
          ? "Đã ghi nhận chuyển tài liệu vào Thư mục tạm."
          : "Đã ghi nhận chuyển tài liệu tới hồ sơ."
      )
      return true
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : targetIsTemporary
            ? "Không thể chuyển tài liệu đã chọn vào Thư mục tạm."
            : "Không thể chuyển tài liệu đã chọn tới hồ sơ."
      )
      if (previousGroups) {
        setGroups(previousGroups)
      }
      return false
    } finally {
      setMovingSelectedDocumentsTargetId(null)
    }
  }

  const handlePromoteTemporaryFolder = async (group: ClusterGroup) => {
    if (viewingHistoricalClusterVersion) {
      toast.error(
        "Bạn đang xem phiên bản cũ. Hãy kích hoạt phiên bản này trước khi cập nhật Thư mục tạm."
      )
      return
    }
    if (!sessionId) {
      toast.error("Chưa có session để cập nhật Thư mục tạm.")
      return
    }
    if (pendingClusterVersion) {
      toast.error(
        "Có phiên bản hồ sơ mới. Hãy áp dụng trước khi cập nhật Thư mục tạm."
      )
      return
    }
    if (
      loading ||
      rebuildSubmitting ||
      rebuildBaselineVersionId ||
      promotingTemporaryFolder ||
      promotingSelectedDocuments ||
      movingSelectedDocumentsTargetId
    ) {
      toast.error("Đang cập nhật hồ sơ. Vui lòng chờ xong rồi thử lại.")
      return
    }
    const sessionDocumentIds = group.documents
      .map((document) => document.sessionDocumentId)
      .filter((id): id is number => id !== null)
    if (sessionDocumentIds.length === 0) {
      toast.error("Thư mục tạm chưa có tài liệu hợp lệ để tạo hồ sơ.")
      return
    }
    if (sessionDocumentIds.length !== group.documents.length) {
      toast.error("Một số tài liệu trong Thư mục tạm chưa có mã session.")
      return
    }

    setPromotingTemporaryFolder(true)
    try {
      const metadata =
        await buildPendingDossierSuggestionMetadata(sessionDocumentIds)
      const response = await promoteTemporaryFolderDocuments(sessionId, {
        session_document_ids: sessionDocumentIds,
        metadata,
      })
      setGroups((previous: ClusterGroup[]) =>
        applyPendingDossierPromotionLocally(
          previous,
          response,
          response.action ?? "promote_temporary_folder"
        )
      )
      const cancelledFeedbackCount =
        response.cancelled_metadata_keep_feedback_ids?.length ?? 0
      setPendingFeedbackCount((count: number) =>
        Math.max(0, count - cancelledFeedbackCount + response.feedback_count)
      )
      setPendingFeedbackRefreshKey((key: number) => key + 1)
      setStatus(
        Object.keys(metadata).length > 0
          ? "Đã ghi nhận hồ sơ tạm kèm metadata gợi ý. Bạn có thể sửa trước khi bấm Cập nhật hồ sơ."
          : "Đã ghi nhận hồ sơ tạm. Bạn có thể sửa metadata trước khi bấm Cập nhật hồ sơ."
      )
      toast.success("Đã ghi nhận Thư mục tạm thành hồ sơ mới.")
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Không thể cập nhật Thư mục tạm thành hồ sơ mới."
      )
    } finally {
      setPromotingTemporaryFolder(false)
    }
  }

  return {
    handleCreateDossierFromSelection,
    handleDropOnDossier,
    handleMoveSelectionToDossier,
    handlePromoteTemporaryFolder,
    handleResultTreeDragOver,
    handleSaveDossierMetadata,
    handleSaveDocumentMetadata,
    handleToggleDocumentSelection,
    handleToggleGroupSelection,
    stopResultTreeAutoScroll,
    toggleNode,
  }
}

function plainObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return { ...(value as Record<string, unknown>) }
}

function titleSuggestionFromResponse(response: unknown): string {
  const payload = plainObject(response)
  const suggestions = Array.isArray(payload.suggestions)
    ? payload.suggestions
    : []
  for (const suggestion of suggestions) {
    const title = textValue(plainObject(suggestion).title)
    if (title) return title
  }
  return ""
}

function retentionPeriodSuggestionFromResponse(response: unknown): string {
  const payload = plainObject(response)
  const recommendation = plainObject(
    payload.recommendation ?? payload.retention_recommendation
  )
  const recommendedPeriod = textValue(recommendation.retention_period)
  if (recommendedPeriod) return recommendedPeriod

  const candidates = Array.isArray(payload.candidates) ? payload.candidates : []
  for (const candidate of candidates) {
    const retentionPeriod = textValue(plainObject(candidate).retention_period)
    if (retentionPeriod) return retentionPeriod
  }
  return ""
}

function retentionRecommendationFromResponse(
  response: unknown
): Record<string, unknown> {
  const payload = plainObject(response)
  const recommendation = {
    ...plainObject(payload.recommendation ?? payload.retention_recommendation),
  }
  const candidates = Array.isArray(payload.candidates)
    ? payload.candidates
    : Array.isArray(recommendation.candidates)
      ? recommendation.candidates
      : []
  const versions = Array.isArray(payload.versions)
    ? payload.versions
    : Array.isArray(recommendation.versions)
      ? recommendation.versions
      : []
  const retentionPeriod =
    textValue(recommendation.retention_period) ||
    retentionPeriodSuggestionFromResponse(payload)
  const hasVersionCandidates = versions.some((version) => {
    const record = plainObject(version)
    return Array.isArray(record.candidates) && record.candidates.length > 0
  })
  if (!retentionPeriod && candidates.length === 0 && !hasVersionCandidates) {
    return {}
  }
  if (retentionPeriod) recommendation.retention_period = retentionPeriod
  if (candidates.length > 0) recommendation.candidates = candidates
  if (versions.length > 0) recommendation.versions = versions
  ;[
    "active_candidate_version_id",
    "candidate_count",
    "candidates_truncated",
    "plan_version_id",
    "status",
  ].forEach((key) => {
    if (payload[key] !== undefined && recommendation[key] === undefined) {
      recommendation[key] = payload[key]
    }
  })
  return Object.fromEntries(
    Object.entries(recommendation).filter(([, value]) => value !== undefined)
  )
}

function textValue(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return ""
}

function pendingFeedbackMarker({
  id,
  action,
  sourceClusterId,
  targetClusterId,
}: {
  id: number
  action: string
  sourceClusterId: string | null
  targetClusterId: string
}): PendingClusterFeedbackMarker {
  return {
    id,
    action,
    sourceClusterId,
    targetClusterId,
    createdAt: new Date().toISOString(),
  }
}

function applyPendingDossierPromotionLocally(
  groups: ClusterGroup[],
  response: DossierPromoteResponse,
  action: string
): ClusterGroup[] {
  const promotedSessionDocumentIds = new Set(
    response.promoted_session_document_ids
  )
  if (promotedSessionDocumentIds.size === 0) return groups

  const pendingFeedback = pendingFeedbackMarker({
    id: -(response.feedback_event_id ?? Date.now()),
    action,
    sourceClusterId: null,
    targetClusterId: response.target_cluster_id,
  })
  const promotedDocuments: ClusterDocument[] = []
  const groupsWithoutPromotedDocuments = groups.map((group) => {
    const documents = group.documents.filter((document) => {
      const sessionDocumentId = document.sessionDocumentId
      if (
        sessionDocumentId !== null &&
        promotedSessionDocumentIds.has(sessionDocumentId)
      ) {
        promotedDocuments.push(document)
        return false
      }
      return true
    })
    if (documents.length === group.documents.length) return group
    return groupWithDocumentSnapshot(group, documents)
  })

  if (promotedDocuments.length === 0) return groups

  const targetGroupIndex = groupsWithoutPromotedDocuments.findIndex(
    (group) => group.id === response.target_cluster_id
  )
  const pendingDocuments = promotedDocuments.map((document, index) => ({
    ...document,
    positionIndex: index,
    pendingFeedback,
  }))

  if (targetGroupIndex >= 0) {
    const nextGroups = groupsWithoutPromotedDocuments.map((group, index) => {
      if (index !== targetGroupIndex) return group
      return groupWithDocumentSnapshot(
        {
          ...group,
          draftId: response.draft_id ?? response.draft?.id ?? group.draftId,
          isPendingDossier: true,
          createdFromTemporaryFolder: action === "promote_temporary_folder",
          hasPendingFeedback: true,
        },
        [
          ...group.documents,
          ...pendingDocuments.map((document, offset) => ({
            ...document,
            positionIndex: group.documents.length + offset,
          })),
        ]
      )
    })
    return response.draft
      ? applyPendingDossierDrafts(nextGroups, [response.draft])
      : nextGroups
  }

  const pendingGroup = groupWithDocumentSnapshot(
    {
      id: response.target_cluster_id,
      clusterId: response.target_cluster_id,
      dossierId: response.target_cluster_id,
      draftId: response.draft_id ?? response.draft?.id ?? null,
      label: "Hồ sơ tạm thời",
      files: [],
      documents: [],
      isPendingDossier: true,
      createdFromTemporaryFolder: action === "promote_temporary_folder",
      classificationPath: [],
      requiresReview: false,
      hasPendingFeedback: true,
      pendingFeedbackCount: pendingDocuments.length,
      pageCount: 0,
      sheetCount: 0,
    },
    pendingDocuments
  )

  const nextGroups = [pendingGroup, ...groupsWithoutPromotedDocuments]
  return response.draft
    ? applyPendingDossierDrafts(nextGroups, [response.draft])
    : nextGroups
}

function groupWithDocumentSnapshot(
  group: ClusterGroup,
  documents: ClusterDocument[]
): ClusterGroup {
  const pendingFeedbackCount = documents.filter(
    (document) => document.pendingFeedback
  ).length
  const totals = clusterDocumentTotals(documents)
  return {
    ...group,
    documents,
    files: documents.map((document) => document.filePath),
    pageCount: totals.pageCount,
    sheetCount: totals.sheetCount,
    pendingFeedbackCount,
    hasPendingFeedback: pendingFeedbackCount > 0,
  }
}

function replacePendingFeedbackMarkerLocally(
  groups: ClusterGroup[],
  sessionDocumentId: number,
  feedback: ClusterFeedbackResponse
): ClusterGroup[] {
  return groups.map((group) => {
    let changed = false
    const documents = group.documents.map((document) => {
      if (document.sessionDocumentId !== sessionDocumentId) return document
      changed = true
      return {
        ...document,
        pendingFeedback: {
          id: feedback.id,
          action: String(feedback.details?.action ?? feedback.feedback_type),
          sourceClusterId: feedback.source_cluster_id ?? null,
          targetClusterId: feedback.target_cluster_id ?? null,
          createdAt: feedback.created_at,
        },
      }
    })
    if (!changed) return group
    const pendingFeedbackCount = documents.filter(
      (document) => document.pendingFeedback
    ).length
    return {
      ...group,
      documents,
      pendingFeedbackCount,
      hasPendingFeedback: pendingFeedbackCount > 0,
    }
  })
}

function autoScrollResultTree(container: HTMLDivElement, clientY: number) {
  const rect = container.getBoundingClientRect()
  const edge = RESULT_TREE_AUTO_SCROLL_EDGE_PX
  const maxStep = RESULT_TREE_AUTO_SCROLL_MAX_STEP_PX
  const canScrollUp = container.scrollTop > 0
  const canScrollDown =
    container.scrollTop + container.clientHeight < container.scrollHeight

  if (clientY >= rect.top - edge && clientY < rect.top + edge && canScrollUp) {
    const intensity = (rect.top + edge - clientY) / edge
    container.scrollTop -= Math.ceil(maxStep * clampScrollIntensity(intensity))
    return
  }

  if (
    clientY > rect.bottom - edge &&
    clientY <= rect.bottom + edge &&
    canScrollDown
  ) {
    const intensity = (clientY - (rect.bottom - edge)) / edge
    container.scrollTop += Math.ceil(maxStep * clampScrollIntensity(intensity))
  }
}

function clampScrollIntensity(value: number): number {
  return Math.min(1, Math.max(0.15, value))
}

function updateDocumentMetadataLocally(
  groups: ClusterGroup[],
  sessionDocumentId: number,
  updatedDocument: SessionDocumentResponse,
  pendingFeedback: NonNullable<ClusterDocument["pendingFeedback"]>
): ClusterGroup[] {
  return groups.map((group) => {
    let changed = false
    let pendingDelta = 0
    const documents = group.documents.map((document) => {
      if (document.sessionDocumentId !== sessionDocumentId) return document
      changed = true
      pendingDelta = document.pendingFeedback ? 0 : 1
      return updatedClusterDocument(document, updatedDocument, pendingFeedback)
    })
    if (!changed) return group
    const totals = clusterDocumentTotals(documents)
    return {
      ...group,
      documents,
      files: documents.map((document) => document.filePath),
      pageCount: totals.pageCount,
      sheetCount: totals.sheetCount,
      pendingFeedbackCount: (group.pendingFeedbackCount ?? 0) + pendingDelta,
      hasPendingFeedback: true,
    }
  })
}

function updateDocumentMetadataOnlyLocally(
  groups: ClusterGroup[],
  sessionDocumentId: number,
  updatedDocument: SessionDocumentResponse
): ClusterGroup[] {
  return groups.map((group) => {
    let changed = false
    const documents = group.documents.map((document) => {
      if (document.sessionDocumentId !== sessionDocumentId) return document
      changed = true
      return updatedClusterDocument(
        document,
        updatedDocument,
        document.pendingFeedback ?? null
      )
    })
    if (!changed) return group
    const totals = clusterDocumentTotals(documents)
    return {
      ...group,
      documents,
      files: documents.map((document) => document.filePath),
      pageCount: totals.pageCount,
      sheetCount: totals.sheetCount,
    }
  })
}

function updatedClusterDocument(
  document: ClusterDocument,
  updatedDocument: SessionDocumentResponse,
  pendingFeedback: ClusterDocument["pendingFeedback"]
): ClusterDocument {
  const metadata = buildDisplayMetadata(updatedDocument)
  const remoteMetadataStatus =
    updatedDocument.remote_metadata_status ?? document.remoteMetadataStatus
  const ocrStatus = updatedDocument.ocr_status ?? document.ocrStatus
  const signatureStatus =
    updatedDocument.signature_status ??
    String(metadata.signature_status ?? metadata.signatureStatus ?? "")
  const dossierCounts = clusterDocumentCountsFromMetadata(metadata, {
    pageCount: document.pageCount,
    sheetCount: document.sheetCount,
    sourcePageCount: document.sourcePageCount,
    outputPageCount: document.outputPageCount,
    documentNumberingMode: document.documentNumberingMode,
    pdfPreprocessing: updatedDocument.pdf_preprocessing,
  })
  return {
    ...document,
    metadata,
    remoteMetadataStatus,
    ocrStatus,
    signatureStatus: documentSignatureStatus({
      signatureStatus,
      remoteMetadataStatus,
      ocrStatus,
    }),
    pageCount: dossierCounts.pageCount,
    sheetCount: dossierCounts.sheetCount,
    sourcePageCount: dossierCounts.sourcePageCount,
    outputPageCount: dossierCounts.outputPageCount,
    documentNumberingMode: dossierCounts.documentNumberingMode,
    pendingFeedback,
  }
}
