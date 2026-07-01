import { useEffect, type DragEvent as ReactDragEvent } from "react"
import { toast } from "sonner"
import {
  moveDocumentBetweenClusters,
  moveSelectedDocumentsToCluster,
  patchSessionDossier,
  promoteSelectedDocumentsToDossier,
  promoteTemporaryFolderDocuments,
} from "@/features/upload/api/sessionApi"
import type { ClusterGroup } from "@/features/upload/lib/clusterGroups"
import type { DossierMetadataDraft } from "./FinalResult.metadataUtils"
import {
  dossierPatchPayloadFromDraft,
  updateDossierGroupFromResponse,
} from "./FinalResult.metadataUtils"
import { moveDocumentLocally } from "./FinalResult.treeUtils"

const RESULT_TREE_AUTO_SCROLL_EDGE_PX = 84
const RESULT_TREE_AUTO_SCROLL_MAX_STEP_PX = 22

export function useFinalResultTreeActions(context: Record<string, any>) {
  const {
    draggedDocument,
    groups,
    handleRebuildClusters,
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
    stopResultTreeAutoScroll()
    setDraggedDocument(null)
    setDropTargetId(null)
    setGroups((previous: any) =>
      moveDocumentLocally(previous, moving, targetClusterId)
    )
    setStatus("Đang lưu feedback di chuyển tài liệu...")

    try {
      await moveDocumentBetweenClusters(sessionId, {
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
      setPendingFeedbackCount((count: number) => count + 1)
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
    draft: DossierMetadataDraft
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

    setSavingDossierMetadataId(dossierId)
    try {
      const response = await patchSessionDossier(
        sessionId,
        dossierId,
        dossierPatchPayloadFromDraft(draft)
      )
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

  const handleCreateDossierFromSelection = async () => {
    if (viewingHistoricalClusterVersion) {
      toast.error(
        "Bạn đang xem phiên bản cũ. Hãy kích hoạt phiên bản này trước khi tạo hồ sơ."
      )
      return
    }
    if (!sessionId) {
      toast.error("Chưa có session để tạo hồ sơ từ tài liệu đã chọn.")
      return
    }
    if (pendingClusterVersion) {
      toast.error(
        "Có phiên bản hồ sơ mới. Hãy áp dụng trước khi tạo hồ sơ khác."
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
    const sessionDocumentIds = Array.from(
      selectedSessionDocumentIds as Set<number>
    ).filter((sessionDocumentId) =>
      selectableSessionDocumentIdSet.has(sessionDocumentId)
    )
    if (sessionDocumentIds.length === 0) {
      toast.error("Chưa chọn tài liệu hợp lệ để tạo hồ sơ mới.")
      return
    }

    setPromotingSelectedDocuments(true)
    try {
      const response = await promoteSelectedDocumentsToDossier(sessionId, {
        session_document_ids: sessionDocumentIds,
      })
      setPendingFeedbackCount(
        (count: number) => count + Math.max(1, response.feedback_count)
      )
      setSelectedSessionDocumentIds(new Set())
      setStatus(
        `Đã ghi nhận ${response.promoted_document_ids.length} tài liệu thành hồ sơ mới. Đang gửi job cập nhật hồ sơ.`
      )
      toast.success("Đã ghi nhận hồ sơ mới từ tài liệu đã chọn.")
      await handleRebuildClusters("update")
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Không thể tạo hồ sơ mới từ tài liệu đã chọn."
      )
    } finally {
      setPromotingSelectedDocuments(false)
    }
  }

  const handleMoveSelectionToDossier = async (group: ClusterGroup) => {
    if (viewingHistoricalClusterVersion) {
      toast.error(
        "Bạn đang xem phiên bản cũ. Hãy kích hoạt phiên bản này trước khi chuyển tài liệu."
      )
      return
    }
    if (!sessionId) {
      toast.error("Chưa có session để chuyển tài liệu đã chọn.")
      return
    }
    if (pendingClusterVersion) {
      toast.error(
        "Có phiên bản hồ sơ mới. Hãy áp dụng trước khi chuyển tài liệu."
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
    const sessionDocumentIds = Array.from(
      selectedSessionDocumentIds as Set<number>
    ).filter((sessionDocumentId) =>
      selectableSessionDocumentIdSet.has(sessionDocumentId)
    )
    if (sessionDocumentIds.length === 0) {
      toast.error("Chưa chọn tài liệu hợp lệ để chuyển.")
      return
    }

    const targetIsTemporary = Boolean(group.isTemporary)
    setMovingSelectedDocumentsTargetId(group.id)
    try {
      const response = await moveSelectedDocumentsToCluster(sessionId, {
        session_document_ids: sessionDocumentIds,
        target_cluster_id: group.clusterId,
      })
      setPendingFeedbackCount(
        (count: number) => count + Math.max(1, response.feedback_count)
      )
      setSelectedSessionDocumentIds(new Set())
      setStatus(
        targetIsTemporary
          ? `Đã ghi nhận ${response.moved_document_ids.length} tài liệu chuyển vào Thư mục tạm. Đang gửi job cập nhật hồ sơ.`
          : `Đã ghi nhận ${response.moved_document_ids.length} tài liệu chuyển tới hồ sơ "${group.label}". Đang gửi job cập nhật hồ sơ.`
      )
      toast.success(
        targetIsTemporary
          ? "Đã ghi nhận chuyển tài liệu vào Thư mục tạm."
          : "Đã ghi nhận chuyển tài liệu tới hồ sơ."
      )
      await handleRebuildClusters("update")
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : targetIsTemporary
            ? "Không thể chuyển tài liệu đã chọn vào Thư mục tạm."
            : "Không thể chuyển tài liệu đã chọn tới hồ sơ."
      )
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
      const response = await promoteTemporaryFolderDocuments(sessionId, {
        session_document_ids: sessionDocumentIds,
      })
      setPendingFeedbackCount(
        (count: number) => count + Math.max(1, response.feedback_count)
      )
      setStatus(
        `Đã ghi nhận ${response.promoted_document_ids.length} tài liệu trong Thư mục tạm thành hồ sơ mới. Đang gửi job cập nhật hồ sơ.`
      )
      toast.success("Đã ghi nhận Thư mục tạm thành hồ sơ mới.")
      await handleRebuildClusters("update")
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
    handleToggleDocumentSelection,
    handleToggleGroupSelection,
    stopResultTreeAutoScroll,
    toggleNode,
  }
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
