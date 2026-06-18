import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FolderOpen,
  List,
  Loader2,
  Plus,
  Scissors,
  UserRound,
  X,
} from "lucide-react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { cn } from "@/shared/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { listChinhlyUsers, type ChinhlyUser } from "@/features/auth/api/authApi"
import { useAuth } from "@/features/auth/lib/AuthContext"
import {
  closeMetadataBatch,
  documentHasUserMetadataEdit,
  createMetadataBatch,
  downloadSessionMetadataReviewXlsx,
  normalizeDocumentReviewStatus,
  verifyDocumentMetadata,
  type SessionDocumentResponse,
} from "@/features/upload/api/sessionApi"
import {
  buildDisplayMetadata,
  hasMetadataWarning,
} from "@/features/upload/lib/metadata"
import {
  DocumentPdfPreview,
  type DocumentPreviewTarget,
} from "@/features/upload/components/DocumentPdfPreview"
import { DocumentDownloadDialog } from "./DocumentDownloadDialog"
import { MetadataCard } from "./MetadataCard"
import type { ClusterGroup } from "@/features/upload/lib/clusterGroups"
import type { PdfMetadata } from "@/features/upload/types"

type MetadataReviewMode = "list" | "batch"
type MetadataBatchMode = "auto" | "manual"

interface MetadataBatchGroup {
  index: number
  kind: "auto" | "manual" | "reviewed" | "unassigned"
  batchId?: string | null
  label: string
  start: number
  end: number
  items: PdfMetadata[]
  readyCount: number
  reviewedCount: number
  warningCount: number
  pendingReadyCount: number
  assigneeName?: string | null
  assigneeEmail?: string | null
  assigneeUserId?: string | number | null
}

interface MetadataActorIdentity {
  id: string
  email: string
  name: string
  isCoordinator: boolean
}

const DEFAULT_METADATA_BATCH_SIZE = 25
const MIN_METADATA_BATCH_SIZE = 5
const MAX_METADATA_BATCH_SIZE = 1000
const METADATA_BATCH_SIZE_OPTIONS = [25, 50, 100, 200, 500, 1000]
const MAX_LOADING_PLACEHOLDERS = 12
const REVIEW_MODE_STORAGE_KEY = "archival-processing.metadata-review-mode"
const BATCH_SIZE_STORAGE_KEY = "archival-processing.metadata-review-batch-size"
const EMPTY_METADATA_ITEMS: PdfMetadata[] = []
const METADATA_REVIEWED_BATCH_ID = "metadata-reviewed"
const LEGACY_METADATA_VERIFIED_BATCH_ID = "metadata-verified"

interface ProcessStepProps {
  sessionId: string | null
  pdfPaths: string[]
  metadataTotal?: number
  metadataItems?: PdfMetadata[]
  metadataLoading?: boolean
  metadataReloading?: boolean
  metadataMessage?: string
  signatureStatus?: {
    extracted: number
    pending: number
    failed: number
  }
  onDocumentsVerified?: (documents: SessionDocumentResponse[]) => void
  onRetryMetadata?: (documentId: number) => Promise<SessionDocumentResponse>
  onContinue: (groups: ClusterGroup[]) => void
}

export function ProcessStep({
  sessionId,
  pdfPaths,
  metadataTotal = 0,
  metadataItems = [],
  metadataLoading = false,
  metadataReloading = false,
  metadataMessage = "Đang chờ kết quả số hóa từ backend...",
  signatureStatus = { extracted: 0, pending: 0, failed: 0 },
  onDocumentsVerified,
  onRetryMetadata,
  onContinue,
}: ProcessStepProps) {
  const { user } = useAuth()
  const [items, setItems] = useState<PdfMetadata[]>([])
  const [verifyingIds, setVerifyingIds] = useState<Set<number>>(() => new Set())
  const [retryingIds, setRetryingIds] = useState<Set<number>>(() => new Set())
  const [bulkVerifying, setBulkVerifying] = useState(false)
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(
    null
  )
  const [previewWidthPercent, setPreviewWidthPercent] = useState(48)
  const [reviewMode, setReviewMode] = useState<MetadataReviewMode>("list")
  const [batchSize, setBatchSize] = useState(() => readStoredBatchSize())
  const [batchSizeInput, setBatchSizeInput] = useState(() =>
    String(readStoredBatchSize())
  )
  const [batchMode, setBatchMode] = useState<MetadataBatchMode>("manual")
  const [manualSplitActive, setManualSplitActive] = useState(false)
  const [creatingManualBatch, setCreatingManualBatch] = useState(false)
  const [closingBatchIds, setClosingBatchIds] = useState<Set<string>>(
    () => new Set()
  )
  const [manualSelectedIds, setManualSelectedIds] = useState<Set<number>>(
    () => new Set()
  )
  const [exportingMetadataReview, setExportingMetadataReview] = useState(false)
  const [workers, setWorkers] = useState<ChinhlyUser[]>([])
  const [workersLoading, setWorkersLoading] = useState(false)
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("")
  const [activeBatchIndex, setActiveBatchIndex] = useState(0)
  const previewLayoutRef = useRef<HTMLDivElement | null>(null)
  const didAutoSelectRef = useRef(false)
  const manualLastSelectedIdRef = useRef<number | null>(null)
  const metadataSessionIdRef = useRef(sessionId)
  const currentUserRole = String(user?.role ?? "")
    .trim()
    .toLowerCase()
  const currentUserId = String(user?.id ?? user?.user_id ?? "").trim()
  const currentUserEmail = String(user?.email ?? user?.username ?? "").trim()
  const currentUserName = String(user?.display_name ?? user?.name ?? "").trim()
  const isCoordinator =
    currentUserRole === "admin" || currentUserRole === "coordinator"
  const currentUserIdentity = useMemo<MetadataActorIdentity>(
    () => ({
      id: currentUserId,
      email: currentUserEmail,
      name: currentUserName,
      isCoordinator,
    }),
    [currentUserEmail, currentUserId, currentUserName, isCoordinator]
  )
  const canManageMetadataBatches = isCoordinator
  const canExportMetadataReview = isCoordinator

  const metadataKey = useMemo(
    () =>
      metadataItems
        .map(
          (item) =>
            `${item.id}:${item.ocr_batch_id ?? ""}:${item.import_action ?? ""}:${item.status}:${item.remote_metadata_status ?? ""}:${item.review_status}:${String(item.is_reviewed ?? false)}:${String(item.metadata_ready)}:${String(item.metadata_final)}:${String(item.metadata_user_edited ?? false)}:${item.metadata_batch_id ?? ""}:${item.metadata_batch_assigned_to_user_id ?? ""}:${item.metadata_batch_assigned_to_email ?? ""}:${item.metadata_batch_assigned_to_name ?? ""}:${item.metadata_verified_by_user_id ?? ""}:${item.metadata_verified_by_email ?? ""}:${item.metadata_verified_by_name ?? ""}`
        )
        .join("\n"),
    [metadataItems]
  )

  useEffect(() => {
    const sessionChanged = metadataSessionIdRef.current !== sessionId
    if (sessionChanged) {
      metadataSessionIdRef.current = sessionId
    }
    setItems((previous) =>
      mergeIncomingMetadata(sessionChanged ? [] : previous, metadataItems)
    )
  }, [metadataItems, metadataKey, sessionId])

  const paths = useMemo(
    () =>
      metadataItems.length > 0
        ? metadataItems.map((item) => item.data_path)
        : pdfPaths,
    [metadataItems, pdfPaths]
  )

  const readyItems = useMemo(
    () => items.filter((item) => item.metadata_ready),
    [items]
  )
  const reviewedItems = useMemo(
    () => items.filter((item) => item.is_reviewed === true),
    [items]
  )
  const failedMetadataItems = useMemo(
    () => items.filter(isMetadataFailedItem),
    [items]
  )
  const pendingExtractionItems = useMemo(
    () => items.filter(isMetadataExtractionPending),
    [items]
  )
  const needsReviewItems = useMemo(
    () => items.filter(needsMetadataReview),
    [items]
  )
  const autoVerifiedItems = useMemo(
    () => items.filter(isAutomaticallyVerifiedMetadata),
    [items]
  )
  const dossierReadyItems = useMemo(
    () =>
      items.filter(
        (item) => item.is_reviewed === true || item.review_status === "verified"
      ),
    [items]
  )
  const pendingReadyItems = useMemo(
    () => readyItems.filter(needsMetadataReview),
    [readyItems]
  )
  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => metadataSortScore(a) - metadataSortScore(b)),
    [items]
  )
  const sortedItemIdsKey = useMemo(
    () => sortedItems.map((item) => item.id).join("|"),
    [sortedItems]
  )
  const batchScopeItems = useMemo(
    () =>
      isCoordinator
        ? sortedItems
        : sortedItems.filter((item) =>
            isMetadataItemAssignedToUser(item, currentUserIdentity)
          ),
    [currentUserIdentity, isCoordinator, sortedItems]
  )
  const batchGroups = useMemo(
    () =>
      batchMode === "manual"
        ? buildManualMetadataBatchGroups(batchScopeItems)
        : buildMetadataBatchGroups(batchScopeItems, batchSize),
    [batchMode, batchSize, batchScopeItems]
  )
  const unassignedBatch = useMemo(
    () => batchGroups.find((group) => group.kind === "unassigned") ?? null,
    [batchGroups]
  )
  const activeBatch = batchGroups[activeBatchIndex] ?? batchGroups[0] ?? null
  const displayedItems =
    reviewMode === "batch"
      ? manualSplitActive
        ? (unassignedBatch?.items ?? EMPTY_METADATA_ITEMS)
        : (activeBatch?.items ?? EMPTY_METADATA_ITEMS)
      : sortedItems
  const displayedItemIdsKey = useMemo(
    () => displayedItems.map((item) => item.id).join("|"),
    [displayedItems]
  )
  const displayedPendingReadyItems = useMemo(
    () => displayedItems.filter(needsMetadataReview),
    [displayedItems]
  )
  const bulkVerifyItems =
    reviewMode === "batch"
      ? displayedPendingReadyItems.filter((item) =>
          canUserEditMetadataItem(item, currentUserIdentity)
        )
      : EMPTY_METADATA_ITEMS
  const selectedItem = useMemo(
    () =>
      displayedItems.find((item) => item.id === selectedDocumentId) ?? null,
    [displayedItems, selectedDocumentId]
  )
  const previewDocument = useMemo<DocumentPreviewTarget | null>(
    () =>
      selectedItem
        ? {
            id: selectedItem.id,
            fileName: fileNameFromPath(selectedItem.data_path),
            dataPath: selectedItem.data_path,
          }
        : null,
    [selectedItem]
  )

  useEffect(() => {
    writeStoredReviewMode(reviewMode)
  }, [reviewMode])

  useEffect(() => {
    writeStoredBatchSize(batchSize)
  }, [batchSize])

  useEffect(() => {
    if (!canManageMetadataBatches) {
      setManualSplitActive(false)
      setManualSelectedIds(new Set())
      setSelectedAssigneeId("")
      setWorkers([])
      return
    }

    let cancelled = false
    setWorkersLoading(true)
    listChinhlyUsers({ role: "worker", active: true, limit: 500 })
      .then((nextWorkers) => {
        if (cancelled) return
        setWorkers(nextWorkers)
        setSelectedAssigneeId((current) => {
          if (
            current &&
            nextWorkers.some((worker) => chinhlyUserId(worker) === current)
          ) {
            return current
          }
          return ""
        })
      })
      .catch((err) => {
        if (cancelled) return
        setWorkers([])
        toast.error(
          err instanceof Error
            ? err.message
            : "Khong the tai danh sach nhan vien."
        )
      })
      .finally(() => {
        if (!cancelled) setWorkersLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [canManageMetadataBatches])

  useEffect(() => {
    const availableItems = manualSplitActive ? displayedItems : batchScopeItems
    const availableIds = new Set(availableItems.map((item) => item.id))
    setManualSelectedIds((previous) => {
      const next = new Set<number>()
      let changed = false
      previous.forEach((id) => {
        if (availableIds.has(id)) {
          next.add(id)
        } else {
          changed = true
        }
      })
      return changed ? next : previous
    })
  }, [
    displayedItems,
    displayedItemIdsKey,
    manualSplitActive,
    batchScopeItems,
    sortedItemIdsKey,
  ])

  useEffect(() => {
    if (batchGroups.length === 0) {
      if (activeBatchIndex !== 0) {
        setActiveBatchIndex(0)
      }
      return
    }
    if (activeBatchIndex > batchGroups.length - 1) {
      setActiveBatchIndex(batchGroups.length - 1)
    }
  }, [activeBatchIndex, batchGroups.length])

  useEffect(() => {
    if (
      reviewMode !== "batch" ||
      batchMode !== "manual" ||
      !manualSplitActive
    ) {
      return
    }
    const unassignedIndex = findUnassignedBatchIndex(batchGroups)
    if (unassignedIndex >= 0 && activeBatchIndex !== unassignedIndex) {
      setActiveBatchIndex(unassignedIndex)
      return
    }
    if (unassignedIndex < 0 && activeBatchIndex !== 0) {
      setActiveBatchIndex(0)
    }
  }, [activeBatchIndex, batchGroups, batchMode, manualSplitActive, reviewMode])

  useEffect(() => {
    if (reviewMode !== "batch") return
    if (!activeBatch) {
      if (selectedDocumentId !== null) setSelectedDocumentId(null)
      return
    }
    if (batchMode === "manual" && manualSplitActive) {
      if (!unassignedBatch) {
        if (selectedDocumentId !== null) setSelectedDocumentId(null)
        return
      }
      if (activeBatch.kind !== "unassigned") return
    }
    if (
      selectedDocumentId !== null &&
      activeBatch.items.some((item) => item.id === selectedDocumentId)
    ) {
      return
    }
    setSelectedDocumentId(
      firstPreferredMetadataItem(activeBatch.items)?.id ?? null
    )
  }, [
    activeBatch,
    batchMode,
    manualSplitActive,
    reviewMode,
    selectedDocumentId,
    unassignedBatch,
  ])

  useEffect(() => {
    if (reviewMode !== "list") return
    if (sortedItems.length === 0) {
      setSelectedDocumentId(null)
      didAutoSelectRef.current = false
      return
    }
    if (
      selectedDocumentId !== null &&
      sortedItems.some((item) => item.id === selectedDocumentId)
    ) {
      return
    }
    if (selectedDocumentId !== null) {
      setSelectedDocumentId(null)
      return
    }
    if (didAutoSelectRef.current) {
      return
    }
    const firstWarning =
      sortedItems.find(
        (item) => item.is_reviewed !== true && hasMetadataWarning(item)
      ) ?? sortedItems[0]
    setSelectedDocumentId(firstWarning.id)
    didAutoSelectRef.current = true
  }, [reviewMode, selectedDocumentId, sortedItems])

  const handleApply = async (
    dataPath: string,
    meta?: Record<string, unknown>
  ) => {
    const item = items.find((candidate) => candidate.data_path === dataPath)
    if (!item) throw new Error("Không tìm thấy tài liệu trong session.")
    if (!sessionId) throw new Error("Chưa có session để xác nhận metadata.")
    if (!item.metadata_ready) {
      throw new Error("Metadata của tài liệu này chưa sẵn sàng để xác nhận.")
    }
    if (
      !isCoordinator &&
      (reviewMode !== "batch" ||
        !canUserEditMetadataItem(item, currentUserIdentity))
    ) {
      throw new Error(
        "Bạn chỉ có thể sửa/xác nhận tài liệu trong lô được giao."
      )
    }

    setVerifyingIds((previous) => addId(previous, item.id))
    try {
      const verified = await verifyDocumentMetadata(sessionId, item.id, meta)
      const nextItems = replaceVerifiedDocument(items, verified)
      setItems(nextItems)
      onDocumentsVerified?.([verified])
    } finally {
      setVerifyingIds((previous) => removeId(previous, item.id))
    }
  }

  const handleVerifyAllReady = async () => {
    if (!sessionId) {
      toast.error("Chưa có session để xác nhận metadata.")
      return
    }
    if (bulkVerifyItems.length === 0) return

    setBulkVerifying(true)
    setVerifyingIds((previous) => {
      const next = new Set(previous)
      bulkVerifyItems.forEach((item) => next.add(item.id))
      return next
    })
    try {
      const results = await Promise.allSettled(
        bulkVerifyItems.map((item) =>
          verifyDocumentMetadata(sessionId, item.id)
        )
      )
      const verified = results
        .filter(
          (result): result is PromiseFulfilledResult<SessionDocumentResponse> =>
            result.status === "fulfilled"
        )
        .map((result) => result.value)
      if (verified.length > 0) {
        const nextItems = replaceVerifiedDocuments(items, verified)
        setItems(nextItems)
        onDocumentsVerified?.(verified)
      }

      const failedCount = results.length - verified.length
      if (failedCount > 0) {
        toast.error(
          `${failedCount} tài liệu chưa xác nhận được. Vui lòng kiểm tra lại.`
        )
      }
      if (verified.length > 0) {
        toast.success(`Đã xác nhận ${verified.length} tài liệu.`)
      }
    } finally {
      setBulkVerifying(false)
      setVerifyingIds((previous) => {
        const next = new Set(previous)
        bulkVerifyItems.forEach((item) => next.delete(item.id))
        return next
      })
    }
  }

  const handleReviewModeChange = (mode: MetadataReviewMode) => {
    setReviewMode(mode)
    setManualSplitActive(false)
    setManualSelectedIds(new Set())
    if (mode === "batch") {
      setSelectedDocumentId(
        firstPreferredMetadataItem(activeBatch?.items ?? EMPTY_METADATA_ITEMS)
          ?.id ?? null
      )
    }
  }

  const handleBatchSizeChange = (value: number) => {
    const nextBatchSize = normalizeBatchSize(value)
    setBatchSize(nextBatchSize)
    setActiveBatchIndex(0)
    setSelectedDocumentId(
      firstPreferredMetadataItem(batchScopeItems.slice(0, nextBatchSize))?.id ??
        null
    )
  }

  const handleBatchSizeInputChange = (value: string) => {
    setBatchSizeInput(value)
    const trimmed = value.trim()
    if (!/^\d+$/.test(trimmed)) return
    handleBatchSizeChange(Number(trimmed))
  }

  const handleBatchSizeInputBlur = () => {
    const trimmed = batchSizeInput.trim()
    if (!/^\d+$/.test(trimmed)) {
      setBatchSizeInput(String(batchSize))
      return
    }
    const nextBatchSize = normalizeBatchSize(Number(trimmed))
    handleBatchSizeChange(nextBatchSize)
    setBatchSizeInput(String(nextBatchSize))
  }

  const handleSelectBatch = (group: MetadataBatchGroup) => {
    setActiveBatchIndex(group.index)
    setManualSplitActive(false)
    setManualSelectedIds(new Set())
    setSelectedAssigneeId("")
    setSelectedDocumentId(firstPreferredMetadataItem(group.items)?.id ?? null)
  }

  const handleBatchModeChange = (mode: MetadataBatchMode) => {
    setBatchMode(mode)
    setManualSplitActive(false)
    setManualSelectedIds(new Set())
    setSelectedAssigneeId("")
    setActiveBatchIndex(0)
    const nextGroups =
      mode === "manual"
        ? buildManualMetadataBatchGroups(batchScopeItems)
        : buildMetadataBatchGroups(batchScopeItems, batchSize)
    setSelectedDocumentId(
      firstPreferredMetadataItem(nextGroups[0]?.items ?? batchScopeItems)?.id ??
        null
    )
  }

  const startManualSplit = () => {
    if (!canManageMetadataBatches) return
    setReviewMode("batch")
    setBatchMode("manual")
    setManualSplitActive(true)
    setManualSelectedIds(new Set())
    const nextGroups = buildManualMetadataBatchGroups(sortedItems)
    const unassignedIndex = findUnassignedBatchIndex(nextGroups)
    const targetGroup = nextGroups[unassignedIndex] ?? nextGroups[0] ?? null
    setActiveBatchIndex(unassignedIndex >= 0 ? unassignedIndex : 0)
    setSelectedDocumentId(
      firstPreferredMetadataItem(targetGroup?.items ?? [])?.id ?? null
    )
    manualLastSelectedIdRef.current = null
  }

  const cancelManualSplit = () => {
    setManualSplitActive(false)
    setManualSelectedIds(new Set())
    setSelectedAssigneeId("")
    manualLastSelectedIdRef.current = null
  }

  const toggleManualSelection = (
    item: PdfMetadata,
    checked: boolean,
    shiftKey: boolean
  ) => {
    setManualSelectedIds((previous) => {
      const next = new Set(previous)
      const lastSelectedId = manualLastSelectedIdRef.current
      if (shiftKey && lastSelectedId !== null) {
        selectedRange(displayedItems, lastSelectedId, item.id).forEach(
          (rangeItem) => {
            if (checked) next.add(rangeItem.id)
            else next.delete(rangeItem.id)
          }
        )
      } else if (checked) {
        next.add(item.id)
      } else {
        next.delete(item.id)
      }
      return next
    })
    manualLastSelectedIdRef.current = item.id
  }

  const selectAllDisplayedForManualSplit = () => {
    setManualSelectedIds(new Set(displayedItems.map((item) => item.id)))
    manualLastSelectedIdRef.current =
      displayedItems[displayedItems.length - 1]?.id ?? null
  }

  const clearManualSelection = () => {
    setManualSelectedIds(new Set())
    manualLastSelectedIdRef.current = null
  }

  const createManualBatchFromSelection = async () => {
    if (!sessionId) {
      toast.error("Chưa có session để tạo lô metadata.")
      return
    }
    if (manualSelectedIds.size === 0) {
      toast.error("Chọn ít nhất một tài liệu để tạo lô mới.")
      return
    }
    if (!selectedAssigneeId) {
      toast.error("Chon nhan vien phu trach lo truoc khi tao.")
      return
    }
    const selectedIds = new Set(manualSelectedIds)
    const orderedSelectedIds = displayedItems
      .filter((item) => selectedIds.has(item.id))
      .map((item) => item.id)
    if (orderedSelectedIds.length === 0) return

    setCreatingManualBatch(true)
    try {
      const response = await createMetadataBatch(
        sessionId,
        orderedSelectedIds,
        selectedAssigneeId
      )
      const updatedDocuments = response.documents ?? []
      if (updatedDocuments.length > 0) {
        setItems((previous) => replaceDocuments(previous, updatedDocuments))
        onDocumentsVerified?.(updatedDocuments)
      }
      setManualSelectedIds(new Set())
      setSelectedAssigneeId("")
      manualLastSelectedIdRef.current = null
      setManualSplitActive(true)
      setBatchMode("manual")
      setSelectedDocumentId(null)
      toast.success(`Đã tạo lô mới với ${response.updated_count} tài liệu.`)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Không thể tạo lô metadata."
      )
    } finally {
      setCreatingManualBatch(false)
    }
  }

  const finishMetadataBatch = async (group: MetadataBatchGroup) => {
    if (!sessionId) {
      toast.error("Chưa có session để kết thúc lô metadata.")
      return
    }
    if (!canManageMetadataBatches) return
    const batchId = normalizedMetadataBatchId(group.batchId)
    if (!batchId || group.kind !== "manual") return

    setClosingBatchIds((previous) => addTextId(previous, batchId))
    try {
      const response = await closeMetadataBatch(sessionId, batchId)
      const updatedDocuments = response.documents ?? []
      if (updatedDocuments.length > 0) {
        setItems((previous) => replaceDocuments(previous, updatedDocuments))
        onDocumentsVerified?.(updatedDocuments)
      }
      setManualSelectedIds(new Set())
      manualLastSelectedIdRef.current = null
      setManualSplitActive(true)
      setBatchMode("manual")
      setSelectedDocumentId(null)
      toast.success(
        `Đã kết thúc lô: ${response.reviewed_count ?? response.verified_count ?? 0} tài liệu đã review, ${response.unassigned_count} tài liệu quay lại chưa chia.`
      )
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Không thể kết thúc lô metadata."
      )
    } finally {
      setClosingBatchIds((previous) => removeTextId(previous, batchId))
    }
  }

  const handleRetryMetadata = async (item: PdfMetadata) => {
    if (
      !isCoordinator &&
      (reviewMode !== "batch" ||
        !canUserEditMetadataItem(item, currentUserIdentity))
    ) {
      toast.error("Bạn chỉ có thể chạy lại metadata trong lô được giao.")
      return
    }
    if (!onRetryMetadata) {
      toast.error("Backend chưa bật chức năng chạy lại metadata.")
      return
    }
    setRetryingIds((previous) => addId(previous, item.id))
    try {
      const restarted = await onRetryMetadata(item.id)
      setItems((previous) => replaceDocument(previous, restarted))
      toast.success("Đã gửi yêu cầu chạy lại metadata cho tài liệu.")
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Không thể chạy lại metadata cho tài liệu."
      )
    } finally {
      setRetryingIds((previous) => removeId(previous, item.id))
    }
  }

  const handleExportMetadataReview = async () => {
    if (!sessionId || !canExportMetadataReview) return
    setExportingMetadataReview(true)
    try {
      const result = await downloadSessionMetadataReviewXlsx(sessionId)
      saveBlob(result.blob, result.fileName)
      toast.success("Đã xuất XLSX metadata và người xác thực.")
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Không thể xuất XLSX metadata và người xác thực."
      )
    } finally {
      setExportingMetadataReview(false)
    }
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
      setPreviewWidthPercent(Math.min(68, Math.max(35, rawPercent)))
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

  const warningCount = needsReviewItems.length
  const expectedCount = Math.max(metadataTotal, paths.length, items.length)
  const pendingMetadataCount = Math.max(
    pendingExtractionItems.length,
    expectedCount - readyItems.length - failedMetadataItems.length
  )
  const metadataInProgress = metadataLoading || pendingMetadataCount > 0
  const loadingPlaceholderCount = Math.max(
    metadataInProgress && items.length === 0 ? 1 : 0,
    Math.max(expectedCount - items.length, 0)
  )
  const visibleLoadingPlaceholderCount = Math.min(
    loadingPlaceholderCount,
    MAX_LOADING_PLACEHOLDERS
  )
  const readyPercent =
    expectedCount > 0
      ? Math.min(100, (readyItems.length / expectedCount) * 100)
      : 0
  const reviewedPercent =
    expectedCount > 0
      ? Math.min(100, (reviewedItems.length / expectedCount) * 100)
      : 0
  const canBuildDossiers = isCoordinator
  const canContinue = canBuildDossiers && dossierReadyItems.length > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl text-foreground">Xử lý & lập hồ sơ</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Metadata được lấy từ backend. Sau khi metadata được xác nhận, màn
            hình sẽ chuyển sang kết quả lập hồ sơ.
          </p>
        </div>
        {warningCount > 0 && (
          <div className="shrink-0 text-right">
            <p className="font-roboto text-[11px] text-amber-600">
              Cần kiểm tra
            </p>
            <p className="text-xl font-bold text-amber-600">{warningCount}</p>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#D8E1EC] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-[#64748B] uppercase">
              Tiến độ metadata
            </p>
            <p className="mt-1 text-sm text-[#0F172A]">
              {pendingMetadataCount > 0
                ? `${
                    metadataReloading
                      ? "Đang extract lại metadata"
                      : "Đang extract metadata"
                  } cho ${pendingMetadataCount} tài liệu. Đã extract ${readyItems.length}/${expectedCount || "..."} tài liệu.`
                : readyItems.length > 0
                  ? `Đã extract ${readyItems.length}/${expectedCount} tài liệu; ${needsReviewItems.length} cần xem xét; ${autoVerifiedItems.length} tự động xác thực; ${reviewedItems.length} chuyên gia xác thực.`
                  : metadataMessage}
            </p>
            {(signatureStatus.pending > 0 || signatureStatus.failed > 0) && (
              <p className="mt-1 text-xs text-[#64748B]">
                Chữ ký: {signatureStatus.extracted} xong
                {signatureStatus.pending > 0
                  ? `, ${signatureStatus.pending} đang chờ`
                  : ""}
                {signatureStatus.failed > 0
                  ? `, ${signatureStatus.failed} lỗi`
                  : ""}
                .
              </p>
            )}
          </div>
          <div className="grid w-full grid-cols-2 gap-2 text-center sm:w-auto lg:grid-cols-5">
            <ProgressMetric label="Tài liệu" value={expectedCount} />
            <ProgressMetric label="Đang extract" value={pendingMetadataCount} />
            <ProgressMetric label="Cần xem xét" value={needsReviewItems.length} />
            <ProgressMetric label="Tự động xác thực" value={autoVerifiedItems.length} />
            <ProgressMetric label="Chuyên gia xác thực" value={reviewedItems.length} />
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#E2E8F0]">
          <motion.div
            className="h-full rounded-full bg-[#BFD3FF]"
            initial={false}
            animate={{ width: `${readyPercent}%` }}
            transition={{ duration: 0.35 }}
          />
          <motion.div
            className="-mt-2 h-full rounded-full bg-[#0052FF]"
            initial={false}
            animate={{ width: `${reviewedPercent}%` }}
            transition={{ duration: 0.35 }}
          />
        </div>
      </div>

      <div
        ref={previewLayoutRef}
        className="grid min-w-0 gap-4 xl:[grid-template-columns:var(--process-preview-columns)]"
        style={
          {
            "--process-preview-columns": `minmax(0, ${
              100 - previewWidthPercent
            }fr) minmax(360px, ${previewWidthPercent}fr)`,
          } as CSSProperties
        }
      >
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <span className="font-roboto text-[11px] font-semibold tracking-[0.15em] text-muted-foreground uppercase">
              Metadata tài liệu
            </span>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              {metadataInProgress && (
                <span className="flex items-center gap-1.5 text-xs text-[#64748B]">
                  <Loader2 className="size-3 animate-spin text-[#0052FF]" />
                  {metadataReloading ? "Đang extract lại" : "Đã extract"}{" "}
                  {readyItems.length}/{expectedCount || "..."}
                </span>
              )}
              {canExportMetadataReview && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleExportMetadataReview()}
                  disabled={!sessionId || exportingMetadataReview}
                  className="h-8 gap-1.5 text-xs"
                >
                  {exportingMetadataReview ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Download className="size-3" />
                  )}
                  Xuất metadata review
                </Button>
              )}
              <DocumentDownloadDialog sessionId={sessionId} items={items} />
            </div>
          </div>
          <div className="flex flex-col gap-3 rounded-xl border border-[#D8E1EC] bg-white p-3 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] p-1">
                  <ReviewModeButton
                    active={reviewMode === "list"}
                    icon={<List className="size-3.5" />}
                    label="Danh sách"
                    onClick={() => handleReviewModeChange("list")}
                  />
                  <ReviewModeButton
                    active={reviewMode === "batch"}
                    icon={<FolderOpen className="size-3.5" />}
                    label="Theo lô"
                    onClick={() => handleReviewModeChange("batch")}
                  />
                </div>
                {canManageMetadataBatches && reviewMode === "batch" && (
                  <div className="inline-flex rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] p-1">
                    <ReviewModeButton
                      active={batchMode === "manual"}
                      label="Thủ công"
                      onClick={() => handleBatchModeChange("manual")}
                    />
                    <ReviewModeButton
                      active={batchMode === "auto"}
                      label="Tự động"
                      onClick={() => handleBatchModeChange("auto")}
                    />
                  </div>
                )}
                {canManageMetadataBatches &&
                  reviewMode === "batch" &&
                  batchMode === "auto" && (
                    <label className="flex h-8 items-center gap-2 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] px-2 text-xs font-medium text-[#475569]">
                      Cỡ lô
                      <input
                        type="text"
                        inputMode="numeric"
                        value={batchSizeInput}
                        onChange={(event) =>
                          handleBatchSizeInputChange(event.target.value)
                        }
                        onBlur={handleBatchSizeInputBlur}
                        className="h-6 w-14 rounded-md border border-[#CBD5E1] bg-white px-2 text-xs text-[#0F172A] outline-none focus-visible:border-[#0052FF] focus-visible:ring-2 focus-visible:ring-[#0052FF]/20"
                        list="metadata-batch-size-options"
                      />
                      <datalist id="metadata-batch-size-options">
                        {METADATA_BATCH_SIZE_OPTIONS.map((value) => (
                          <option key={value} value={value} />
                        ))}
                      </datalist>
                    </label>
                  )}
                {reviewMode === "batch" && activeBatch && (
                  <span className="rounded-full bg-[#EFF6FF] px-2.5 py-1 text-xs font-medium text-[#475569]">
                    {activeBatch.label}: {activeBatch.reviewedCount}/
                    {activeBatch.items.length} đã review
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                {bulkVerifyItems.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleVerifyAllReady()}
                    disabled={bulkVerifying}
                    className="h-8 gap-1.5 text-xs"
                  >
                    {bulkVerifying ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-3" />
                    )}
                    {reviewMode === "batch" ? "Xác nhận lô" : "Xác nhận tất cả"}
                  </Button>
                )}
                {reviewMode === "batch" &&
                  canManageMetadataBatches &&
                  batchMode === "manual" &&
                  !manualSplitActive &&
                  activeBatch?.kind === "manual" &&
                  activeBatch.batchId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void finishMetadataBatch(activeBatch)}
                      disabled={closingBatchIds.has(activeBatch.batchId)}
                      className="h-8 gap-1.5 text-xs"
                    >
                      {closingBatchIds.has(activeBatch.batchId) ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-3" />
                      )}
                      Kết thúc lô
                    </Button>
                  )}
                {reviewMode === "batch" &&
                  canManageMetadataBatches &&
                  batchMode === "manual" &&
                  !manualSplitActive && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={startManualSplit}
                      className="h-8 gap-1.5 text-xs"
                    >
                      <Scissors data-icon="inline-start" className="size-3" />
                      Chia lô
                    </Button>
                  )}
                {reviewMode === "batch" &&
                  canManageMetadataBatches &&
                  batchMode === "manual" &&
                  manualSplitActive && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={selectAllDisplayedForManualSplit}
                        disabled={displayedItems.length === 0}
                        className="h-8 gap-1.5 text-xs"
                      >
                        Chọn tất cả
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={clearManualSelection}
                        disabled={manualSelectedIds.size === 0}
                        className="h-8 gap-1.5 text-xs"
                      >
                        Bỏ chọn
                      </Button>
                      <label className="flex h-8 min-w-[13rem] items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-2 text-xs font-medium text-[#475569]">
                        {workersLoading ? (
                          <Loader2 className="size-3 animate-spin text-[#0052FF]" />
                        ) : (
                          <UserRound className="size-3 text-[#0052FF]" />
                        )}
                        <select
                          value={selectedAssigneeId}
                          onChange={(event) =>
                            setSelectedAssigneeId(event.target.value)
                          }
                          disabled={workersLoading || creatingManualBatch}
                          className="min-w-0 flex-1 bg-transparent text-xs text-[#0F172A] outline-none"
                        >
                          <option value="">Chọn nhân viên</option>
                          {workers.map((worker) => {
                            const id = chinhlyUserId(worker)
                            if (!id) return null
                            return (
                              <option key={id} value={id}>
                                {chinhlyUserLabel(worker)}
                              </option>
                            )
                          })}
                        </select>
                      </label>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void createManualBatchFromSelection()}
                        disabled={
                          manualSelectedIds.size === 0 ||
                          !selectedAssigneeId ||
                          creatingManualBatch
                        }
                        className="h-8 gap-1.5 text-xs"
                      >
                        {creatingManualBatch ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Plus data-icon="inline-start" className="size-3" />
                        )}
                        Tạo lô mới
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={cancelManualSplit}
                        className="h-8 gap-1.5 text-xs"
                      >
                        <X data-icon="inline-start" className="size-3" />
                        Hủy
                      </Button>
                    </>
                  )}
              </div>
            </div>
            {reviewMode === "batch" &&
              canManageMetadataBatches &&
              batchMode === "manual" &&
              manualSplitActive && (
                <div className="rounded-lg border border-[#BFD3FF] bg-[#EFF6FF] px-3 py-2 text-xs font-medium text-[#0F172A]">
                  Đã chọn {manualSelectedIds.size} tài liệu để tạo lô mới. Giữ
                  Shift khi chọn để chọn một dải.
                </div>
              )}
          </div>
          {reviewMode === "batch" && batchGroups.length > 0 && activeBatch && (
            <div className="flex flex-col gap-2 rounded-xl border border-[#D8E1EC] bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#0F172A]">
                    {activeBatch.label}
                  </p>
                  <p className="text-[11px] text-[#64748B]">
                    {activeBatch.kind === "manual"
                      ? `${activeBatch.items.length} tài liệu trong lô thủ công`
                      : activeBatch.kind === "reviewed"
                        ? `${activeBatch.items.length} tài liệu đã review`
                        : activeBatch.kind === "unassigned"
                          ? `${activeBatch.items.length} tài liệu chưa chia`
                          : `Tài liệu ${activeBatch.start}-${activeBatch.end} / ${sortedItems.length}`}
                  </p>
                  {activeBatch.assigneeName || activeBatch.assigneeEmail ? (
                    <p className="mt-0.5 text-[11px] text-[#475569]">
                      Phụ trách:{" "}
                      <span className="font-semibold text-[#0F172A]">
                        {activeBatch.assigneeName ?? activeBatch.assigneeEmail}
                      </span>
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#475569]">
                  <BatchMetric
                    label="Sẵn sàng"
                    value={activeBatch.readyCount}
                  />
                  <BatchMetric
                    label="Cảnh báo"
                    value={activeBatch.warningCount}
                  />
                  <BatchMetric
                    label="Còn lại"
                    value={activeBatch.pendingReadyCount}
                  />
                </div>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {batchGroups.map((group) => (
                  <MetadataBatchButton
                    key={group.index}
                    group={group}
                    active={group.index === activeBatch.index}
                    onClick={() => handleSelectBatch(group)}
                  />
                ))}
              </div>
            </div>
          )}
          <ScrollArea className="h-[min(70svh,640px)] min-h-[360px]">
            <div className="flex flex-col gap-2 pr-1">
              {displayedItems.map((item) => {
                const canEditItem =
                  isCoordinator ||
                  (reviewMode === "batch" &&
                    canUserEditMetadataItem(item, currentUserIdentity))
                return (
                  <MetadataCard
                    key={item.id}
                    item={item}
                    selected={item.id === selectedDocumentId}
                    selectionMode={manualSplitActive}
                    selectionChecked={manualSelectedIds.has(item.id)}
                    readOnly={!canEditItem}
                    onSelectionChange={(checked, shiftKey) =>
                      toggleManualSelection(item, checked, shiftKey)
                    }
                    submitting={verifyingIds.has(item.id)}
                    retrying={retryingIds.has(item.id)}
                    onSelect={(expanded) =>
                      setSelectedDocumentId((current) =>
                        expanded
                          ? item.id
                          : current === item.id
                            ? null
                            : current
                      )
                    }
                    onApply={handleApply}
                    onRetry={
                      canEditItem
                        ? () => void handleRetryMetadata(item)
                        : undefined
                    }
                  />
                )
              })}
              {Array.from({ length: visibleLoadingPlaceholderCount }).map(
                (_, i) => (
                  <div
                    key={`skel-${i}`}
                    className="h-14 animate-pulse rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]"
                  />
                )
              )}
              {manualSplitActive && displayedItems.length === 0 && (
                <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-white p-6 text-center text-sm text-muted-foreground">
                  Không còn tài liệu chưa chia.
                </div>
              )}
              {!manualSplitActive &&
                !metadataInProgress &&
                displayedItems.length === 0 &&
                items.length > 0 && (
                  <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-white p-6 text-center text-sm text-muted-foreground">
                    Không có tài liệu trong phạm vi này.
                  </div>
                )}
              {!metadataInProgress && items.length === 0 && (
                <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-white p-6 text-center text-sm text-muted-foreground">
                  Chưa có metadata từ backend.
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
        <div className="relative min-w-0 self-stretch xl:h-full">
          <button
            type="button"
            aria-label="Kéo để đổi kích thước preview"
            title="Kéo để đổi kích thước preview"
            onPointerDown={handlePreviewResizePointerDown}
            className="group absolute top-0 bottom-0 -left-3 z-20 hidden w-5 cursor-col-resize items-center justify-center xl:flex"
          >
            <span className="h-16 w-1 rounded-full bg-[#0052FF] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
          </button>
          <DocumentPdfPreview
            sessionId={sessionId}
            document={previewDocument}
            className="h-[min(72svh,678px)] min-h-[420px] min-w-0 xl:h-full xl:min-h-0"
          />
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-[#CBD5E1] bg-white px-4 py-4 shadow-sm sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 text-sm text-[#475569]">
          {pendingReadyItems.length > 0 && dossierReadyItems.length === 0 ? (
            <span className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="size-4" />
              Còn {pendingReadyItems.length} tài liệu cần review metadata.
            </span>
          ) : pendingReadyItems.length > 0 ? (
            <span className="flex items-center gap-2 text-[#475569]">
              <CheckCircle2 className="size-4 text-emerald-600" />
              Có thể lập hồ sơ với {dossierReadyItems.length} tài liệu đủ điều
              kiện;
              {` ${pendingReadyItems.length}`} tài liệu còn lại có thể cập nhật
              hồ sơ sau.
            </span>
          ) : readyItems.length > 0 ? (
            <span className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="size-4" /> Metadata đã được review.
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin text-[#0052FF]" />
              {metadataMessage}
            </span>
          )}
        </div>
        <button
          disabled={!canContinue}
          onClick={() => {
            if (!canContinue) return
            onContinue([])
          }}
          className={cn(
            "group flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all duration-200 sm:w-auto",
            canContinue
              ? "text-white hover:-translate-y-0.5 active:scale-[0.98]"
              : "cursor-not-allowed bg-[#CBD5E1] text-[#475569]"
          )}
          style={
            canContinue
              ? {
                  background: "linear-gradient(to right, #0052FF, #4D7CFF)",
                  boxShadow: "0 4px 14px rgba(0,82,255,0.25)",
                }
              : {}
          }
        >
          {canContinue
            ? `Lập hồ sơ (${dossierReadyItems.length} tài liệu)`
            : "Lập hồ sơ"}
        </button>
      </div>
    </motion.div>
  )
}

function ReviewModeButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon?: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition-colors",
        active
          ? "bg-[#0052FF] text-white shadow-sm"
          : "text-[#475569] hover:bg-[#EFF6FF] hover:text-[#0F172A]"
      )}
    >
      {icon ? icon : null}
      {label}
    </button>
  )
}

function BatchMetric({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-full border border-[#D8E1EC] bg-[#F8FAFC] px-2 py-1">
      {label}: <strong className="text-[#0F172A]">{value}</strong>
    </span>
  )
}

function MetadataBatchButton({
  group,
  active,
  onClick,
}: {
  group: MetadataBatchGroup
  active: boolean
  onClick: () => void
}) {
  const progress =
    group.items.length > 0
      ? (group.reviewedCount / group.items.length) * 100
      : 0
  const done = group.reviewedCount === group.items.length
  const needsReview = group.warningCount > 0 || group.pendingReadyCount > 0

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${group.label}: ${group.reviewedCount}/${group.items.length} đã review`}
      className={cn(
        "min-w-[9.5rem] rounded-lg border px-3 py-2 text-left transition-colors",
        active
          ? "border-[#0052FF] bg-[#EFF6FF] text-[#0F172A] shadow-sm"
          : done
            ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300"
            : needsReview
              ? "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300"
              : "border-[#D8E1EC] bg-[#F8FAFC] text-[#475569] hover:border-[#BFD3FF]"
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold">{group.label}</span>
        <span className="text-[10px]">
          {group.reviewedCount}/{group.items.length}
        </span>
      </span>
      <span className="mt-1 block text-[10px] opacity-80">
        {group.kind === "manual"
          ? group.assigneeName || group.assigneeEmail
            ? (group.assigneeName ?? group.assigneeEmail)
            : `${group.items.length} tài liệu`
          : group.kind === "reviewed"
            ? "Đã review"
            : group.kind === "unassigned"
              ? "Chưa chia"
              : `${group.start}-${group.end}`}
      </span>
      <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-white/70">
        <span
          className={cn(
            "block h-full rounded-full",
            done ? "bg-emerald-500" : "bg-[#0052FF]"
          )}
          style={{ width: `${progress}%` }}
        />
      </span>
    </button>
  )
}

function ProgressMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-20 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
      <p className="text-[10px] font-semibold tracking-[0.12em] text-[#94A3B8] uppercase">
        {label}
      </p>
      <p className="text-base font-bold text-[#0F172A]">{value}</p>
    </div>
  )
}

function mergeIncomingMetadata(
  previous: PdfMetadata[],
  incoming: PdfMetadata[]
): PdfMetadata[] {
  const previousById = new Map(previous.map((item) => [item.id, item]))
  const incomingIds = new Set(incoming.map((item) => item.id))
  const merged = incoming.map((rawItem) => {
    const item = normalizePdfMetadata(rawItem)
    const local = previousById.get(item.id)
    const sameOcrBatch =
      local?.ocr_batch_id === undefined ||
      item.ocr_batch_id === undefined ||
      local.ocr_batch_id === item.ocr_batch_id
    if (
      local?.is_reviewed === true &&
      item.is_reviewed !== true &&
      sameOcrBatch
    ) {
      const normalizedMetadata =
        item.normalized_metadata ?? local.normalized_metadata
      const rawMetadata = item.raw_metadata ?? local.raw_metadata
      return {
        ...local,
        ocr_batch_id: item.ocr_batch_id,
        import_action: item.import_action,
        status: item.status,
        remote_metadata_status: item.remote_metadata_status,
        metadata_batch_id: item.metadata_batch_id,
        metadata_batch_assigned_to_user_id:
          item.metadata_batch_assigned_to_user_id,
        metadata_batch_assigned_to_email: item.metadata_batch_assigned_to_email,
        metadata_batch_assigned_to_name: item.metadata_batch_assigned_to_name,
        metadata_batch_assigned_at: item.metadata_batch_assigned_at,
        metadata_verified_by_user_id: item.metadata_verified_by_user_id,
        metadata_verified_by_email: item.metadata_verified_by_email,
        metadata_verified_by_name: item.metadata_verified_by_name,
        metadata_verified_at: item.metadata_verified_at,
        is_reviewed: local.is_reviewed,
        metadata_ready: item.metadata_ready,
        metadata_final: item.metadata_final,
        normalized_metadata: normalizedMetadata,
        raw_metadata: rawMetadata,
        light_metadata: buildDisplayMetadata({
          light_metadata: local.light_metadata,
          normalized_metadata: normalizedMetadata,
          raw_metadata: rawMetadata,
          remote_metadata_status: item.remote_metadata_status,
          status: item.status,
        }),
      }
    }
    return item
  })
  previous.forEach((item) => {
    if (!incomingIds.has(item.id)) {
      merged.push(normalizePdfMetadata(item))
    }
  })
  return merged
}

function replaceVerifiedDocument(
  items: PdfMetadata[],
  document: SessionDocumentResponse
): PdfMetadata[] {
  const next = documentResponseToPdfMetadata(document)
  return items.map((item) => (item.id === next.id ? next : item))
}

function replaceDocument(
  items: PdfMetadata[],
  document: SessionDocumentResponse
): PdfMetadata[] {
  const next = documentResponseToPdfMetadata(document)
  return items.map((item) => (item.id === next.id ? next : item))
}

function replaceVerifiedDocuments(
  items: PdfMetadata[],
  documents: SessionDocumentResponse[]
): PdfMetadata[] {
  return replaceDocuments(items, documents)
}

function replaceDocuments(
  items: PdfMetadata[],
  documents: SessionDocumentResponse[]
): PdfMetadata[] {
  const byId = new Map(
    documents.map((document) => {
      const item = documentResponseToPdfMetadata(document)
      return [item.id, item] as const
    })
  )
  return items.map((item) => byId.get(item.id) ?? item)
}

function documentResponseToPdfMetadata(
  document: SessionDocumentResponse
): PdfMetadata {
  const lightMetadata = buildDisplayMetadata(document)
  const reviewStatus = normalizeDocumentReviewStatus(document, lightMetadata)
  return {
    id: document.id,
    ocr_batch_id: document.ocr_batch_id,
    document_id: document.document_id,
    data_path: document.data_path,
    import_action: document.import_action,
    metadata_batch_id: document.metadata_batch_id,
    metadata_batch_assigned_to_user_id:
      document.metadata_batch_assigned_to_user_id,
    metadata_batch_assigned_to_email: document.metadata_batch_assigned_to_email,
    metadata_batch_assigned_to_name: document.metadata_batch_assigned_to_name,
    metadata_batch_assigned_at: document.metadata_batch_assigned_at,
    metadata_verified_by_user_id: document.metadata_verified_by_user_id,
    metadata_verified_by_email: document.metadata_verified_by_email,
    metadata_verified_by_name: document.metadata_verified_by_name,
    metadata_verified_at: document.metadata_verified_at,
    status: document.ocr_status,
    remote_metadata_status: document.remote_metadata_status,
    review_status: reviewStatus,
    is_reviewed: document.is_reviewed === true,
    metadata_ready: document.metadata_ready,
    metadata_final: document.metadata_final,
    metadata_version_count: document.metadata_version_count,
    metadata_user_edited: documentHasUserMetadataEdit(document),
    error: document.error,
    light_metadata: lightMetadata,
    normalized_metadata: document.normalized_metadata,
    raw_metadata: document.raw_metadata,
    applied: document.is_reviewed === true || reviewStatus === "verified",
  }
}

function normalizePdfMetadata(item: PdfMetadata): PdfMetadata {
  const reviewStatus = normalizeDocumentReviewStatus(
    {
      review_status: item.review_status,
      metadata_ready: item.metadata_ready,
    },
    item.light_metadata
  )
  const applied = item.is_reviewed === true || reviewStatus === "verified"
  if (reviewStatus === item.review_status && item.applied === applied) {
    return item
  }
  return {
    ...item,
    review_status: reviewStatus,
    applied,
  }
}

function metadataSortScore(item: PdfMetadata): number {
  if (isMetadataExtractionPending(item)) return 0
  if (isMetadataFailedItem(item)) return 1
  if (needsMetadataReview(item)) return 2
  if (isAutomaticallyVerifiedMetadata(item)) return 3
  return 4
}

function normalizedMetadataStatus(item: PdfMetadata): string {
  return String(item.remote_metadata_status || item.status || "")
    .trim()
    .toLowerCase()
}

function isMetadataFailedItem(item: PdfMetadata): boolean {
  return ["failed", "final_failed", "signature_failed", "cancelled"].includes(
    normalizedMetadataStatus(item)
  )
}

function isMetadataExtractionPending(item: PdfMetadata): boolean {
  return !item.metadata_ready && !isMetadataFailedItem(item)
}

function needsMetadataReview(item: PdfMetadata): boolean {
  return (
    item.metadata_ready &&
    item.is_reviewed !== true &&
    (item.review_status !== "verified" || hasMetadataWarning(item))
  )
}

function isAutomaticallyVerifiedMetadata(item: PdfMetadata): boolean {
  return (
    item.metadata_ready &&
    item.is_reviewed !== true &&
    !needsMetadataReview(item)
  )
}

function buildMetadataBatchGroups(
  items: PdfMetadata[],
  batchSize: number
): MetadataBatchGroup[] {
  const normalizedBatchSize = normalizeBatchSize(batchSize)
  const groups: MetadataBatchGroup[] = []

  for (let start = 0; start < items.length; start += normalizedBatchSize) {
    const groupItems = items.slice(start, start + normalizedBatchSize)
    const index = groups.length
    groups.push(
      buildMetadataBatchGroup({
        kind: "auto",
        index,
        label: `Lô ${String(index + 1).padStart(2, "0")}`,
        start: start + 1,
        end: start + groupItems.length,
        batchId: null,
        items: groupItems,
      })
    )
  }

  return groups
}

function buildManualMetadataBatchGroups(
  items: PdfMetadata[]
): MetadataBatchGroup[] {
  const assignedIds = new Set<number>()
  const groups: MetadataBatchGroup[] = []
  const itemsByBatchId = new Map<string, PdfMetadata[]>()

  items.forEach((item) => {
    const batchId = normalizedMetadataBatchId(item.metadata_batch_id)
    if (!batchId) return
    const groupItems = itemsByBatchId.get(batchId) ?? []
    groupItems.push(item)
    itemsByBatchId.set(batchId, groupItems)
  })

  const reviewedItems = [
    ...(itemsByBatchId.get(METADATA_REVIEWED_BATCH_ID) ?? []),
    ...(itemsByBatchId.get(LEGACY_METADATA_VERIFIED_BATCH_ID) ?? []),
  ]
  if (reviewedItems.length > 0) {
    reviewedItems.forEach((item) => assignedIds.add(item.id))
    groups.push(
      buildMetadataBatchGroup({
        kind: "reviewed",
        index: groups.length,
        label: "Tài liệu đã review",
        start: 0,
        end: 0,
        batchId: METADATA_REVIEWED_BATCH_ID,
        items: reviewedItems,
      })
    )
  }

  let manualGroupNumber = 1
  itemsByBatchId.forEach((groupItems, batchId) => {
    if (
      batchId === METADATA_REVIEWED_BATCH_ID ||
      batchId === LEGACY_METADATA_VERIFIED_BATCH_ID
    ) {
      return
    }
    if (groupItems.length === 0) return
    groupItems.forEach((item) => assignedIds.add(item.id))
    const index = groups.length
    groups.push(
      buildMetadataBatchGroup({
        kind: "manual",
        index,
        label: `Lô ${String(manualGroupNumber).padStart(2, "0")}`,
        start: 0,
        end: 0,
        batchId,
        items: groupItems,
      })
    )
    manualGroupNumber += 1
  })

  const unassignedItems = items.filter((item) => !assignedIds.has(item.id))
  if (unassignedItems.length > 0 || groups.length === 0) {
    groups.push(
      buildMetadataBatchGroup({
        kind: "unassigned",
        index: groups.length,
        label: "Chưa chia",
        start: 1,
        end: unassignedItems.length,
        batchId: null,
        items: unassignedItems,
      })
    )
  }

  return groups
}

function normalizedMetadataBatchId(
  value: string | null | undefined
): string | null {
  const text = String(value ?? "").trim()
  return text || null
}

function canUserEditMetadataItem(
  item: PdfMetadata,
  actor: MetadataActorIdentity
): boolean {
  if (actor.isCoordinator) return true
  return isMetadataItemAssignedToUser(item, actor)
}

function isMetadataItemAssignedToUser(
  item: PdfMetadata,
  actor: MetadataActorIdentity
): boolean {
  const assignedTo = String(
    item.metadata_batch_assigned_to_user_id ?? ""
  ).trim()
  const assignedEmail = String(item.metadata_batch_assigned_to_email ?? "")
    .trim()
    .toLowerCase()
  const assignedName = String(item.metadata_batch_assigned_to_name ?? "").trim()
  if (actor.id && assignedTo && assignedTo === actor.id) return true
  if (
    actor.email &&
    assignedEmail &&
    assignedEmail === actor.email.toLowerCase()
  ) {
    return true
  }
  return Boolean(actor.name && assignedName && assignedName === actor.name)
}

function findUnassignedBatchIndex(groups: MetadataBatchGroup[]): number {
  return groups.findIndex((group) => group.kind === "unassigned")
}

function chinhlyUserId(user: ChinhlyUser): string {
  return String(user.id ?? user.user_id ?? "").trim()
}

function chinhlyUserLabel(user: ChinhlyUser): string {
  const name = String(user.display_name ?? user.name ?? "").trim()
  const email = String(user.email ?? user.username ?? "").trim()
  if (name && email) return `${name} (${email})`
  return name || email || chinhlyUserId(user)
}

function buildMetadataBatchGroup({
  kind,
  index,
  label,
  start,
  end,
  batchId,
  items,
}: {
  kind: MetadataBatchGroup["kind"]
  index: number
  label: string
  start: number
  end: number
  batchId?: string | null
  items: PdfMetadata[]
}): MetadataBatchGroup {
  const reviewedCount = items.filter((item) => item.is_reviewed === true).length
  const readyCount = items.filter((item) => item.metadata_ready).length
  const warningCount = items.filter(
    needsMetadataReview
  ).length
  const pendingReadyCount = items.filter(
    needsMetadataReview
  ).length
  const assignedItem = items.find(
    (item) =>
      item.metadata_batch_assigned_to_user_id ||
      item.metadata_batch_assigned_to_email ||
      item.metadata_batch_assigned_to_name
  )

  return {
    kind,
    index,
    label,
    start,
    end,
    batchId: batchId ?? null,
    items,
    readyCount,
    reviewedCount,
    warningCount,
    pendingReadyCount,
    assigneeName: assignedItem?.metadata_batch_assigned_to_name ?? null,
    assigneeEmail: assignedItem?.metadata_batch_assigned_to_email ?? null,
    assigneeUserId: assignedItem?.metadata_batch_assigned_to_user_id ?? null,
  }
}

function selectedRange(
  items: PdfMetadata[],
  fromId: number,
  toId: number
): PdfMetadata[] {
  const fromIndex = items.findIndex((item) => item.id === fromId)
  const toIndex = items.findIndex((item) => item.id === toId)
  if (fromIndex < 0 || toIndex < 0) {
    return items.filter((item) => item.id === toId)
  }
  const start = Math.min(fromIndex, toIndex)
  const end = Math.max(fromIndex, toIndex)
  return items.slice(start, end + 1)
}

function firstPreferredMetadataItem(items: PdfMetadata[]): PdfMetadata | null {
  return (
    items.find(
      (item) => item.is_reviewed !== true && hasMetadataWarning(item)
    ) ??
    items.find((item) => item.metadata_ready && item.is_reviewed !== true) ??
    items[0] ??
    null
  )
}

function normalizeBatchSize(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_METADATA_BATCH_SIZE
  return Math.min(
    MAX_METADATA_BATCH_SIZE,
    Math.max(MIN_METADATA_BATCH_SIZE, Math.round(value))
  )
}

function saveBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = objectUrl
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000)
}

function writeStoredReviewMode(value: MetadataReviewMode) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(REVIEW_MODE_STORAGE_KEY, value)
  } catch {
    // localStorage can be unavailable in private or restricted browser contexts.
  }
}

function readStoredBatchSize(): number {
  if (typeof window === "undefined") return DEFAULT_METADATA_BATCH_SIZE
  try {
    const value = Number(window.localStorage.getItem(BATCH_SIZE_STORAGE_KEY))
    return normalizeBatchSize(value)
  } catch {
    return DEFAULT_METADATA_BATCH_SIZE
  }
}

function writeStoredBatchSize(value: number) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(
      BATCH_SIZE_STORAGE_KEY,
      String(normalizeBatchSize(value))
    )
  } catch {
    // localStorage can be unavailable in private or restricted browser contexts.
  }
}

function addId(values: Set<number>, id: number): Set<number> {
  const next = new Set(values)
  next.add(id)
  return next
}

function removeId(values: Set<number>, id: number): Set<number> {
  const next = new Set(values)
  next.delete(id)
  return next
}

function addTextId(values: Set<string>, id: string): Set<string> {
  const next = new Set(values)
  next.add(id)
  return next
}

function removeTextId(values: Set<string>, id: string): Set<string> {
  const next = new Set(values)
  next.delete(id)
  return next
}

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop() || path
}
