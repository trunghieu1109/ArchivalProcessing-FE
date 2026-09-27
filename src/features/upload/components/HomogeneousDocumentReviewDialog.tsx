import { useMemo, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  FileText,
  FolderPlus,
  Loader2,
  X,
} from "lucide-react"
import { Dialog } from "radix-ui"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type {
  ClusterPlacement,
  HomogeneousClusterNeighbor,
  ProvisionalDossier,
  ProvisionalDossierRecommendation,
  SessionClusterSummary,
} from "@/features/upload/api/sessionApi"
import {
  DocumentPdfPreview,
  type DocumentPreviewTarget,
} from "@/features/upload/components/DocumentPdfPreview"
import { normalizeClusterContentSummary } from "@/features/upload/lib/homogeneousClusterSummary"
import { cn } from "@/shared/lib/utils"

interface HomogeneousDocumentReviewDialogProps {
  sessionId: string
  cluster: SessionClusterSummary | null
  open: boolean
  onOpenChange: (open: boolean) => void
  neighbors?: HomogeneousClusterNeighbor[]
  neighborsLoading?: boolean
  dossierRecommendations?: ProvisionalDossierRecommendation[]
  provisionalDossiers?: ProvisionalDossier[]
  owner?: ProvisionalDossier | null
  assignmentBusy?: boolean
  readOnly?: boolean
  onCreateDossier?: (clusterIds: string[]) => Promise<ProvisionalDossier | null>
  onAddToDossier?: (
    dossierId: number,
    clusterIds: string[]
  ) => Promise<ProvisionalDossier | null>
  onOpenNeighbor?: (clusterId: string) => void
  clusterIndex?: number
  clusterCount?: number
  clusterNavigationLoading?: boolean
  onPreviousCluster?: () => void
  onNextCluster?: () => void
  onSelectDossierCluster?: (clusterId: string) => void
  onLoadClusterDetail?: (
    clusterId: string
  ) => Promise<SessionClusterSummary | null>
}

const DOCUMENTS_PER_PAGE = 6
const NEIGHBOR_DOCUMENTS_PER_PAGE = 6

const DOCUMENT_METADATA_FIELDS = [
  {
    label: "Trích yếu tài liệu",
    aliases: ["document_summary", "trich_yeu_tai_lieu", "trich_yeu", "summary"],
  },
  {
    label: "Tên loại văn bản",
    aliases: ["document_type", "loai_van_ban", "loai_tai_lieu"],
  },
  {
    label: "Số văn bản",
    aliases: [
      "document_number_part",
      "document_number_value",
      "so_hieu_tai_lieu_so",
      "so_cua_tai_lieu",
      "so_van_ban",
      "document_number",
    ],
  },
  {
    label: "Ký hiệu văn bản",
    aliases: [
      "document_notation_part",
      "document_notation",
      "document_symbol",
      "so_hieu_tai_lieu_hieu",
      "ky_hieu_tai_lieu",
      "ky_hieu_van_ban",
    ],
  },
  {
    label: "Ngày ban hành",
    aliases: ["issued_date", "ngay_ban_hanh", "ngay_thang_van_ban"],
  },
  {
    label: "Cơ quan ban hành",
    aliases: ["issuing_agency", "co_quan_ban_hanh", "don_vi_ban_hanh"],
  },
  {
    label: "Người ký",
    aliases: [
      "signer",
      "signer_name",
      "signed_by",
      "nguoi_ky",
      "nguoi_ki",
      "nguoi_ky_ten",
    ],
  },
] as const

export function HomogeneousDocumentReviewDialog({
  sessionId,
  cluster,
  open,
  onOpenChange,
  neighbors = [],
  neighborsLoading = false,
  dossierRecommendations = [],
  provisionalDossiers = [],
  owner = null,
  assignmentBusy = false,
  readOnly = false,
  onCreateDossier,
  onAddToDossier,
  onOpenNeighbor,
  clusterIndex = -1,
  clusterCount = 0,
  clusterNavigationLoading = false,
  onPreviousCluster,
  onNextCluster,
  onSelectDossierCluster,
  onLoadClusterDetail,
}: HomogeneousDocumentReviewDialogProps) {
  const placements = useMemo(() => cluster?.placements ?? [], [cluster])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [documentPage, setDocumentPage] = useState(1)
  const [neighborDocumentPage, setNeighborDocumentPage] = useState(1)
  const [activeTab, setActiveTab] = useState<
    "documents" | "neighbors" | "dossiers"
  >("documents")
  const [selectedDossierId, setSelectedDossierId] = useState("")
  const [assignedDossier, setAssignedDossier] =
    useState<ProvisionalDossier | null>(null)
  const [selectedNeighborId, setSelectedNeighborId] = useState<string | null>(
    null
  )
  const [selectedNeighborDocumentId, setSelectedNeighborDocumentId] = useState<
    number | null
  >(null)
  const [selectedNeighborClusterIds, setSelectedNeighborClusterIds] = useState<
    Set<string>
  >(() => new Set())
  const [neighborDetail, setNeighborDetail] =
    useState<SessionClusterSummary | null>(null)
  const [neighborDetailLoading, setNeighborDetailLoading] = useState(false)
  const [neighborDetailError, setNeighborDetailError] = useState("")
  const clusterId = cluster?.cluster_id ?? null
  const [selectionClusterId, setSelectionClusterId] = useState(clusterId)

  if (selectionClusterId !== clusterId) {
    setSelectionClusterId(clusterId)
    setSelectedId(null)
    setDocumentPage(1)
    setActiveTab("documents")
    setSelectedDossierId("")
    setAssignedDossier(null)
    setSelectedNeighborId(null)
    setSelectedNeighborClusterIds(new Set())
    setNeighborDetail(null)
    setNeighborDetailError("")
    setNeighborDocumentPage(1)
    setSelectedNeighborDocumentId(null)
  }

  const documentPageCount = Math.max(
    1,
    Math.ceil(placements.length / DOCUMENTS_PER_PAGE)
  )
  const visibleDocumentPage = Math.min(documentPage, documentPageCount)
  const visiblePlacements = placements.slice(
    (visibleDocumentPage - 1) * DOCUMENTS_PER_PAGE,
    visibleDocumentPage * DOCUMENTS_PER_PAGE
  )
  const selectedPlacement =
    placements.find((item) => item.id === selectedId) ??
    visiblePlacements[0] ??
    null
  const explicitlySelectedPlacement =
    placements.find((item) => item.id === selectedId) ?? null
  const previewDocument: DocumentPreviewTarget | null = selectedPlacement
    ? {
        id: selectedPlacement.session_document_id,
        fileName: placementFileName(selectedPlacement),
        dataPath: placementDataPath(selectedPlacement),
      }
    : null
  const metadataEntries = documentMetadataEntries(
    selectedPlacement?.metadata ?? {}
  )
  const draftDossiers = provisionalDossiers.filter(
    (dossier) => dossier.status === "draft"
  )
  const unassignedNeighbors = useMemo(
    () => neighbors.filter((neighbor) => !neighbor.provisional_dossier),
    [neighbors]
  )
  const selectedNeighbor =
    unassignedNeighbors.find(
      (item) => item.cluster_id === selectedNeighborId
    ) ?? null
  const assignmentClusterIds = useMemo(() => {
    if (!cluster) return []
    return [cluster.cluster_id, ...selectedNeighborClusterIds]
  }, [cluster, selectedNeighborClusterIds])
  const activeOwner = owner ?? assignedDossier
  const selectedDossierRecommendation = activeOwner
    ? null
    : (dossierRecommendations.find(
        (recommendation) => String(recommendation.id) === selectedDossierId
      ) ??
      dossierRecommendations[0] ??
      null)
  const selectedProvisionalDossier = selectedDossierRecommendation
    ? (provisionalDossiers.find(
        (dossier) => dossier.id === selectedDossierRecommendation.id
      ) ?? null)
    : null
  const neighborPlacements = neighborDetail?.placements ?? []
  const neighborDocumentPageCount = Math.max(
    1,
    Math.ceil(neighborPlacements.length / NEIGHBOR_DOCUMENTS_PER_PAGE)
  )
  const visibleNeighborDocumentPage = Math.min(
    neighborDocumentPage,
    neighborDocumentPageCount
  )
  const visibleNeighborPlacements = neighborPlacements.slice(
    (visibleNeighborDocumentPage - 1) * NEIGHBOR_DOCUMENTS_PER_PAGE,
    visibleNeighborDocumentPage * NEIGHBOR_DOCUMENTS_PER_PAGE
  )
  const selectedNeighborPlacement =
    neighborPlacements.find(
      (placement) => placement.id === selectedNeighborDocumentId
    ) ?? null
  const selectedNeighborPreviewDocument: DocumentPreviewTarget | null =
    selectedNeighborPlacement
      ? {
          id: selectedNeighborPlacement.session_document_id,
          fileName: placementFileName(selectedNeighborPlacement),
          dataPath: placementDataPath(selectedNeighborPlacement),
        }
      : null
  const selectedDossierPreviewDocument: DocumentPreviewTarget | null =
    explicitlySelectedPlacement
      ? {
          id: explicitlySelectedPlacement.session_document_id,
          fileName: placementFileName(explicitlySelectedPlacement),
          dataPath: placementDataPath(explicitlySelectedPlacement),
        }
      : null
  const dossierInView = activeOwner ?? selectedProvisionalDossier
  const dossierInViewId = activeOwner?.id ?? selectedDossierRecommendation?.id
  const dossierInViewSummary =
    activeOwner?.content_summary ??
    selectedDossierRecommendation?.content_summary ??
    ""
  const dossierInViewClusterCount =
    activeOwner?.statistics.cluster_count ??
    activeOwner?.clusters.length ??
    selectedDossierRecommendation?.cluster_count ??
    0
  const dossierInViewDocumentCount =
    activeOwner?.statistics.document_count ??
    selectedDossierRecommendation?.document_count ??
    0
  const showDossierSidebar = Boolean(activeOwner && onSelectDossierCluster)
  const activeOwnerLabel =
    activeOwner?.status === "promoted" ? "Hồ sơ đã chuyển" : "Hồ sơ tạm"

  const resetDialogSelection = () => {
    setSelectedId(null)
    setDocumentPage(1)
    setActiveTab("documents")
    setSelectedNeighborClusterIds(new Set())
    setSelectedNeighborId(null)
    setSelectedDossierId("")
    setAssignedDossier(null)
    setNeighborDetail(null)
    setNeighborDetailError("")
    setNeighborDocumentPage(1)
    setSelectedNeighborDocumentId(null)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetDialogSelection()
    onOpenChange(nextOpen)
  }

  const createDossier = async () => {
    if (!onCreateDossier) return
    const dossier = await onCreateDossier(assignmentClusterIds)
    if (!dossier) return
    setAssignedDossier(dossier)
    setSelectedDossierId(String(dossier.id))
    setSelectedNeighborClusterIds(new Set())
    setActiveTab("dossiers")
  }

  const addToDossier = async (dossierIdOverride?: number) => {
    const dossierId = dossierIdOverride ?? Number(selectedDossierId)
    if (!onAddToDossier || !dossierId) return
    const dossier = await onAddToDossier(dossierId, assignmentClusterIds)
    if (!dossier) return
    setAssignedDossier(dossier)
    setSelectedDossierId(String(dossier.id))
    setSelectedNeighborClusterIds(new Set())
    setActiveTab("dossiers")
  }

  const toggleNeighborCluster = (clusterId: string) => {
    setSelectedNeighborClusterIds((current) => {
      const next = new Set(current)
      if (next.has(clusterId)) next.delete(clusterId)
      else next.add(clusterId)
      return next
    })
  }

  const selectNeighbor = async (neighbor: HomogeneousClusterNeighbor) => {
    setSelectedNeighborId(neighbor.cluster_id)
    setNeighborDetail(null)
    setNeighborDetailError("")
    setNeighborDocumentPage(1)
    setSelectedNeighborDocumentId(null)
    if (!onLoadClusterDetail) return
    setNeighborDetailLoading(true)
    try {
      setNeighborDetail(await onLoadClusterDetail(neighbor.cluster_id))
    } catch (error) {
      setNeighborDetailError(
        error instanceof Error
          ? error.message
          : "Không tải được metadata của cụm."
      )
    } finally {
      setNeighborDetailLoading(false)
    }
  }

  const closeNeighborDetail = () => {
    setSelectedNeighborId(null)
    setNeighborDetail(null)
    setNeighborDetailError("")
    setNeighborDocumentPage(1)
    setSelectedNeighborDocumentId(null)
  }

  const showNeighbors = () => {
    setActiveTab("neighbors")
    closeNeighborDetail()
  }

  const showDossiers = () => {
    setActiveTab("dossiers")
    if (activeOwner) {
      setSelectedDossierId(String(activeOwner.id))
      return
    }
    if (!selectedDossierId && dossierRecommendations[0]) {
      setSelectedDossierId(String(dossierRecommendations[0].id))
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#0F172A]/55 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 flex h-[calc(100dvh-16px)] max-h-[900px] w-[calc(100vw-16px)] max-w-[1440px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-[#CBD5E1] bg-white shadow-2xl outline-none sm:h-[calc(100dvh-48px)] sm:w-[calc(100vw-48px)] sm:rounded-2xl lg:h-[calc(100dvh-64px)] lg:w-[calc(100vw-80px)]">
          <div className="flex items-center justify-between gap-4 bg-[#F8FAFC] px-4 py-3 sm:px-5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold tracking-[0.06em] text-[#0052FF] uppercase">
                  {clusterIndex >= 0
                    ? `Cụm tài liệu ${String(clusterIndex + 1).padStart(2, "0")}`
                    : "Cụm tài liệu"}
                </span>
                {activeOwner && (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                    Thuộc hồ sơ #{activeOwner.id}
                  </span>
                )}
              </div>
              <Dialog.Title className="mt-1 line-clamp-2 max-w-5xl text-base leading-6 font-semibold text-[#0F172A] sm:text-lg">
                {normalizeClusterContentSummary(cluster?.content_summary)}
              </Dialog.Title>
              <Dialog.Description className="sr-only">
                Xem tài liệu và thông tin của cụm.
              </Dialog.Description>
              {cluster && (
                <div className="mt-2 flex flex-wrap gap-2 text-xs [@media(max-height:620px)]:hidden">
                  <span className="rounded-md border border-[#D9E2F1] bg-white px-2 py-1 text-[#475569]">
                    <strong className="text-[#0F172A]">
                      {placements.length}
                    </strong>{" "}
                    tài liệu
                  </span>
                  <span className="rounded-md border border-[#BFD0FF] bg-[#EEF3FF] px-2 py-1 text-[#4769B2]">
                    Độ tin cậy{" "}
                    <strong className="text-[#0052FF]">
                      {formatPercent(cluster.cohesion_mean)}
                    </strong>
                  </span>
                  <span className="rounded-md border border-[#D9E2F1] bg-white px-2 py-1 font-medium text-[#475569]">
                    {dateRange(cluster.start_date, cluster.end_date)}
                  </span>
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {!showDossierSidebar && clusterIndex >= 0 && clusterCount > 0 && (
                <div className="flex items-center rounded-lg border border-[#D9E2F1] bg-white p-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={onPreviousCluster}
                    disabled={!onPreviousCluster}
                    aria-label="Xem cụm trước"
                  >
                    <ArrowLeft />
                  </Button>
                  <span className="flex min-w-24 items-center justify-center gap-1.5 text-center text-xs font-semibold text-[#475569] tabular-nums">
                    Cụm {clusterIndex + 1}/{clusterCount}
                    {clusterNavigationLoading && (
                      <Loader2 className="size-3.5 animate-spin text-[#0052FF]" />
                    )}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={onNextCluster}
                    disabled={!onNextCluster}
                    aria-label="Xem cụm sau"
                  >
                    <ArrowRight />
                  </Button>
                </div>
              )}
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon" aria-label="Đóng cửa sổ">
                  <X />
                </Button>
              </Dialog.Close>
            </div>
          </div>

          <div className="flex gap-6 overflow-x-auto border-y border-[#E2E8F0] bg-white px-4 sm:px-5">
            <button
              type="button"
              className={cn(
                "shrink-0 border-b-2 px-1 py-2.5 text-sm font-semibold whitespace-nowrap transition",
                activeTab === "documents"
                  ? "border-[#0052FF] text-[#0052FF]"
                  : "border-transparent text-[#64748B] hover:text-[#0F172A]"
              )}
              onClick={() => setActiveTab("documents")}
            >
              Tài liệu trong cụm ({placements.length})
            </button>
            {!activeOwner && (
              <button
                type="button"
                className={cn(
                  "shrink-0 border-b-2 px-1 py-2.5 text-sm font-semibold whitespace-nowrap transition",
                  activeTab === "neighbors"
                    ? "border-[#0052FF] text-[#0052FF]"
                    : "border-transparent text-[#64748B] hover:text-[#0F172A]"
                )}
                onClick={showNeighbors}
              >
                Cụm tài liệu tương tự ({unassignedNeighbors.length})
              </button>
            )}
            <button
              type="button"
              className={cn(
                "shrink-0 border-b-2 px-1 py-2.5 text-sm font-semibold whitespace-nowrap transition",
                activeTab === "dossiers"
                  ? "border-[#0052FF] text-[#0052FF]"
                  : "border-transparent text-[#64748B] hover:text-[#0F172A]"
              )}
              onClick={showDossiers}
            >
              Hồ sơ tạm phù hợp (
              {activeOwner ? 1 : dossierRecommendations.length})
            </button>
          </div>

          {activeTab === "documents" ? (
            showDossierSidebar && activeOwner ? (
              <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[310px_minmax(0,1fr)] lg:overflow-hidden 2xl:grid-cols-[340px_minmax(0,1fr)]">
                <aside className="min-h-0 overflow-y-auto border-b border-[#CBD5E1] bg-[#F8FAFC] p-3 lg:border-r lg:border-b-0">
                  <div className="flex items-center justify-between gap-2 px-1 pb-3">
                    <div>
                      <p className="text-xs font-semibold tracking-[0.08em] text-[#64748B] uppercase">
                        Cụm trong hồ sơ
                      </p>
                      <p className="mt-1 text-xs text-[#94A3B8]">
                        Chọn cụm để xem danh sách tài liệu
                      </p>
                    </div>
                    <span className="rounded-md border border-[#D9E2F1] bg-white px-2 py-1 text-[11px] font-semibold text-[#475569] tabular-nums">
                      {activeOwner.clusters.length} cụm
                    </span>
                  </div>
                  <div className="space-y-2">
                    {activeOwner.clusters.map((dossierCluster, index) => {
                      const selected =
                        dossierCluster.cluster_id === cluster?.cluster_id
                      return (
                        <button
                          key={dossierCluster.cluster_id}
                          type="button"
                          onClick={() =>
                            onSelectDossierCluster?.(dossierCluster.cluster_id)
                          }
                          className={cn(
                            "w-full rounded-xl border p-3 text-left transition-colors",
                            selected
                              ? "border-[#0052FF] bg-white shadow-[0_4px_14px_rgba(0,82,255,0.12)] ring-1 ring-[#0052FF]/10"
                              : "border-[#D9E2F1] bg-white hover:border-[#AFC4FF] hover:bg-[#F8FAFF]"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                                selected
                                  ? "bg-[#0052FF] text-white"
                                  : "bg-[#EEF2F7] text-[#475569]"
                              )}
                            >
                              {index + 1}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#0F172A]">
                              Cụm tài liệu {String(index + 1).padStart(2, "0")}
                            </span>
                            <span className="shrink-0 text-[11px] text-[#64748B]">
                              {dossierCluster.document_count} tài liệu
                            </span>
                          </div>
                          <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#64748B]">
                            {normalizeClusterContentSummary(
                              dossierCluster.content_summary
                            )}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                </aside>

                <div
                  className={cn(
                    "grid min-h-[1080px] overflow-visible bg-[#F1F5F9] lg:min-h-0 lg:overflow-y-auto xl:overflow-hidden",
                    selectedDossierPreviewDocument
                      ? "xl:grid-cols-[minmax(380px,0.9fr)_minmax(480px,1.1fr)]"
                      : "xl:grid-cols-1"
                  )}
                >
                  <section className="flex min-h-[560px] flex-col overflow-hidden p-3 sm:p-4 xl:min-h-0">
                    <div className="rounded-xl border border-[#D9E2F1] bg-white px-4 py-3 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-[#0F172A]">
                            Danh sách tài liệu trong cụm
                          </h3>
                          <p className="mt-1 line-clamp-2 max-w-4xl text-xs leading-5 text-[#64748B]">
                            {normalizeClusterContentSummary(
                              cluster?.content_summary
                            )}
                          </p>
                        </div>
                        <span className="rounded-lg bg-[#EEF2FF] px-2.5 py-1.5 text-xs font-semibold text-[#0052FF]">
                          {placements.length} tài liệu
                        </span>
                      </div>
                    </div>

                    {clusterNavigationLoading &&
                    visiblePlacements.length === 0 ? (
                      <div className="mt-4 flex items-center justify-center rounded-xl border border-[#D9E2F1] bg-white px-5 py-12 text-sm text-[#64748B]">
                        <Loader2 className="mr-2 size-4 animate-spin text-[#0052FF]" />
                        Đang tải danh sách tài liệu...
                      </div>
                    ) : visiblePlacements.length > 0 ? (
                      <>
                        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                          <div className="space-y-3">
                            {visiblePlacements.map((placement, index) => (
                              <DocumentMetadataCard
                                key={placement.id}
                                placement={placement}
                                index={
                                  (visibleDocumentPage - 1) *
                                    DOCUMENTS_PER_PAGE +
                                  index
                                }
                                selected={placement.id === selectedId}
                                onPreview={() => setSelectedId(placement.id)}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="mx-auto w-full max-w-sm pt-3">
                          <ListPagination
                            page={visibleDocumentPage}
                            pageCount={documentPageCount}
                            pageSize={DOCUMENTS_PER_PAGE}
                            total={placements.length}
                            onPageChange={(page) => {
                              setDocumentPage(page)
                              setSelectedId(null)
                            }}
                          />
                        </div>
                      </>
                    ) : (
                      <div className="mt-4 rounded-xl border border-dashed border-[#CBD5E1] bg-white px-5 py-12 text-center text-sm text-[#64748B]">
                        Cụm này chưa có tài liệu để hiển thị.
                      </div>
                    )}
                  </section>

                  {selectedDossierPreviewDocument && (
                    <DocumentInspectionPreview
                      sessionId={sessionId}
                      document={selectedDossierPreviewDocument}
                      onClose={() => setSelectedId(null)}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[360px_minmax(0,1fr)_300px] lg:overflow-hidden 2xl:grid-cols-[400px_minmax(0,1fr)_330px]">
                <aside className="flex min-h-0 flex-col overflow-hidden border-b border-[#E2E8F0] bg-white p-2.5 lg:border-r lg:border-b-0">
                  <p className="px-2 pb-2 text-xs font-semibold tracking-[0.08em] text-[#64748B] uppercase">
                    Danh sách tài liệu ({placements.length})
                  </p>
                  <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                      {visiblePlacements.map((placement) => {
                        const selected = placement.id === selectedPlacement?.id
                        const summary = documentMetadataText(
                          placement.metadata,
                          DOCUMENT_METADATA_FIELDS[0].aliases,
                          "Chưa có trích yếu tài liệu"
                        )
                        const documentType = documentMetadataText(
                          placement.metadata,
                          DOCUMENT_METADATA_FIELDS[1].aliases
                        )
                        const issuedDate = documentMetadataText(
                          placement.metadata,
                          DOCUMENT_METADATA_FIELDS[4].aliases
                        )
                        return (
                          <button
                            key={placement.id}
                            type="button"
                            onClick={() => setSelectedId(placement.id)}
                            className={cn(
                              "w-full rounded-xl border px-3 py-3 text-left transition-colors",
                              selected
                                ? "border-[#0052FF] bg-[#EEF2FF] shadow-[0_3px_10px_rgba(0,82,255,0.12)]"
                                : "border-[#E2E8F0] bg-white hover:border-[#AFC4FF] hover:bg-[#F8FAFF]"
                            )}
                          >
                            <p className="truncate text-sm leading-5 font-semibold text-[#0F172A]">
                              {placementFileName(placement)}
                            </p>
                            <p
                              className="mt-1 line-clamp-2 text-xs leading-5 text-[#475569]"
                              title={summary}
                            >
                              {summary}
                            </p>
                            <div className="mt-2 flex min-w-0 items-center gap-2 text-[11px] text-[#64748B]">
                              <span
                                className="min-w-0 flex-1 truncate"
                                title={`Loại văn bản: ${documentType}`}
                              >
                                Loại: {documentType}
                              </span>
                              <span
                                className="shrink-0 tabular-nums"
                                title={`Ngày ban hành: ${issuedDate}`}
                              >
                                Ngày: {issuedDate}
                              </span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="pt-3">
                    <ListPagination
                      page={visibleDocumentPage}
                      pageCount={documentPageCount}
                      pageSize={DOCUMENTS_PER_PAGE}
                      total={placements.length}
                      onPageChange={(page) => {
                        setDocumentPage(page)
                        setSelectedId(null)
                      }}
                    />
                  </div>
                </aside>

                <section className="min-h-[420px] min-w-0 bg-[#E9EEF5] p-2 lg:min-h-0">
                  {previewDocument ? (
                    <DocumentPdfPreview
                      sessionId={sessionId}
                      document={previewDocument}
                      presentation="dossier_review"
                      fitHeight
                      className="h-full min-h-0 min-w-0"
                    />
                  ) : (
                    <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl border border-dashed border-[#CBD5E1] bg-white text-sm text-[#64748B] lg:min-h-0">
                      Chưa có tài liệu để xem trước.
                    </div>
                  )}
                </section>

                <aside className="min-h-0 overflow-y-auto border-t border-[#E2E8F0] bg-white p-3 lg:border-t-0 lg:border-l">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-[#0052FF]" />
                    <h3 className="font-semibold text-[#0F172A]">
                      Metadata tài liệu
                    </h3>
                  </div>
                  <dl className="mt-3 divide-y divide-[#E2E8F0] border-y border-[#E2E8F0]">
                    {metadataEntries.map(({ label, value }) => (
                      <div key={label} className="py-3">
                        <dt className="text-xs font-medium text-[#64748B]">
                          {label}
                        </dt>
                        <dd className="mt-1 text-sm leading-5 break-words whitespace-pre-wrap text-[#0F172A]">
                          {metadataValue(value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </aside>
              </div>
            )
          ) : activeTab === "neighbors" ? (
            <div
              className={cn(
                "grid min-h-0 flex-1 overflow-y-auto transition-[grid-template-columns] duration-200 lg:overflow-hidden",
                selectedNeighbor
                  ? "lg:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)]"
                  : "lg:grid-cols-1"
              )}
            >
              <aside
                className={cn(
                  "min-h-0 overflow-y-auto border-b border-[#E2E8F0] bg-[#F8FAFC] lg:border-b-0",
                  selectedNeighbor ? "p-2 lg:border-r" : "p-3"
                )}
              >
                {neighborsLoading ? (
                  <div className="flex items-center gap-2 rounded-xl bg-white p-4 text-sm text-[#64748B]">
                    <Loader2 className="size-4 animate-spin text-[#0052FF]" />
                    Đang tải gợi ý...
                  </div>
                ) : unassignedNeighbors.length > 0 ? (
                  <div
                    className={selectedNeighbor ? "space-y-1.5" : "space-y-2"}
                  >
                    {unassignedNeighbors.map((neighbor, index) => {
                      const selected =
                        selectedNeighbor?.cluster_id === neighbor.cluster_id
                      const grouped = selectedNeighborClusterIds.has(
                        neighbor.cluster_id
                      )
                      const canGroup = !activeOwner && !readOnly
                      const similarityClassName = similarityBadgeClass(
                        neighbor.similarity ?? 0
                      )
                      return (
                        <article
                          key={neighbor.cluster_id}
                          onClick={() => void selectNeighbor(neighbor)}
                          className={cn(
                            "w-full cursor-pointer border text-left transition",
                            selectedNeighbor
                              ? "rounded-lg px-2.5 py-1.5"
                              : "rounded-xl p-3",
                            selected
                              ? "border-[#0052FF] bg-[#EEF2FF] shadow-sm"
                              : grouped
                                ? "border-[#7C9CFF] bg-[#F5F7FF] ring-1 ring-[#0052FF]/20"
                                : "border-[#E2E8F0] bg-white hover:border-[#AFC4FF]"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              {!selectedNeighbor && (
                                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-[#E8EEFF] text-[11px] font-bold text-[#0052FF]">
                                  {index + 1}
                                </span>
                              )}
                              <p className="min-w-0 truncate text-sm font-semibold text-[#0F172A]">
                                {neighbor.cluster_id}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <Badge
                                className={cn(
                                  similarityClassName,
                                  selectedNeighbor && "px-1.5 text-[11px]"
                                )}
                              >
                                {formatPercent(neighbor.similarity)}
                              </Badge>
                              <label
                                className={cn(
                                  "flex items-center",
                                  canGroup
                                    ? "cursor-pointer text-[#0052FF]"
                                    : "cursor-not-allowed text-[#94A3B8]"
                                )}
                                title="Gom cụm này cùng cụm đang xem"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  className="size-4 rounded border-[#94A3B8] accent-[#0052FF]"
                                  checked={grouped}
                                  disabled={!canGroup}
                                  onChange={() =>
                                    toggleNeighborCluster(neighbor.cluster_id)
                                  }
                                  aria-label={`Gom cụm ${neighbor.cluster_id}`}
                                />
                              </label>
                            </div>
                          </div>
                          {!selectedNeighbor && (
                            <>
                              <p className="mt-2 line-clamp-2 text-sm leading-5 text-[#475569]">
                                {normalizeClusterContentSummary(
                                  neighbor.content_summary
                                )}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[#64748B]">
                                <span>{neighbor.document_count} tài liệu</span>
                                <span>
                                  {dateRange(
                                    neighbor.start_date,
                                    neighbor.end_date
                                  )}
                                </span>
                              </div>
                            </>
                          )}
                        </article>
                      )
                    })}
                  </div>
                ) : (
                  <p className="mt-4 rounded-xl bg-white p-4 text-sm text-[#64748B]">
                    Không còn cụm chưa phân loại phù hợp để gợi ý.
                  </p>
                )}
              </aside>

              {selectedNeighbor && (
                <section className="flex min-h-[1200px] flex-col overflow-y-auto bg-white p-3 sm:p-4 lg:min-h-0 lg:overflow-hidden">
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-base leading-6 text-[#334155]">
                          {normalizeClusterContentSummary(
                            selectedNeighbor.content_summary
                          )}
                        </p>
                        <p className="mt-1 text-xs text-[#64748B]">
                          {selectedNeighbor.document_count} tài liệu ·{" "}
                          {dateRange(
                            selectedNeighbor.start_date,
                            selectedNeighbor.end_date
                          )}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {onOpenNeighbor && (
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() =>
                              onOpenNeighbor(selectedNeighbor.cluster_id)
                            }
                            title="Chuyển sang xem cụm này"
                            aria-label="Chuyển sang xem cụm này"
                          >
                            <Eye />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={closeNeighborDetail}
                          title="Đóng chi tiết cụm"
                          aria-label="Đóng chi tiết cụm"
                        >
                          <X />
                        </Button>
                      </div>
                    </div>

                    <div
                      className={cn(
                        "mt-4 grid min-h-[1050px] flex-1 overflow-visible rounded-xl border border-[#D9E2F1] bg-[#F1F5F9] transition-[grid-template-columns] duration-200 lg:min-h-0 lg:overflow-y-auto xl:overflow-hidden",
                        selectedNeighborPreviewDocument
                          ? "xl:grid-cols-[minmax(360px,0.82fr)_minmax(440px,1.18fr)]"
                          : "xl:grid-cols-1"
                      )}
                    >
                      <div className="flex min-h-[520px] flex-col p-3 xl:min-h-0">
                        <div className="flex items-center justify-between gap-3 px-1">
                          <h4 className="font-semibold text-[#0F172A]">
                            Tài liệu trong cụm
                          </h4>
                          {neighborDetailLoading && (
                            <span className="flex items-center gap-2 text-xs text-[#64748B]">
                              <Loader2 className="size-3.5 animate-spin" /> Đang
                              tải metadata...
                            </span>
                          )}
                        </div>
                        {neighborDetail?.placements?.length ? (
                          <>
                            <div className="mt-3 min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
                              {visibleNeighborPlacements.map(
                                (placement, index) => (
                                  <DocumentMetadataCard
                                    key={placement.id}
                                    placement={placement}
                                    index={
                                      (visibleNeighborDocumentPage - 1) *
                                        NEIGHBOR_DOCUMENTS_PER_PAGE +
                                      index
                                    }
                                    selected={
                                      placement.id ===
                                      selectedNeighborDocumentId
                                    }
                                    onPreview={() =>
                                      setSelectedNeighborDocumentId(
                                        placement.id
                                      )
                                    }
                                  />
                                )
                              )}
                            </div>
                            <div className="flex justify-end pt-2">
                              <ListPagination
                                page={visibleNeighborDocumentPage}
                                pageCount={neighborDocumentPageCount}
                                pageSize={NEIGHBOR_DOCUMENTS_PER_PAGE}
                                total={neighborPlacements.length}
                                compact
                                onPageChange={(page) => {
                                  setNeighborDocumentPage(page)
                                  setSelectedNeighborDocumentId(null)
                                }}
                              />
                            </div>
                          </>
                        ) : neighborDetailError ? (
                          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
                            {neighborDetailError}
                          </p>
                        ) : !neighborDetailLoading ? (
                          <p className="mt-3 rounded-xl border border-dashed border-[#CBD5E1] bg-white p-5 text-sm text-[#64748B]">
                            Chọn lại cụm bên trái để tải metadata chi tiết.
                          </p>
                        ) : null}
                      </div>

                      {selectedNeighborPreviewDocument && (
                        <DocumentInspectionPreview
                          sessionId={sessionId}
                          document={selectedNeighborPreviewDocument}
                          onClose={() => setSelectedNeighborDocumentId(null)}
                        />
                      )}
                    </div>
                  </div>
                </section>
              )}
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[400px_minmax(0,1fr)] lg:overflow-hidden 2xl:grid-cols-[440px_minmax(0,1fr)]">
              <aside className="min-h-0 overflow-y-auto border-b border-[#E2E8F0] bg-[#F8FAFC] p-3 lg:border-r lg:border-b-0">
                {activeOwner ? (
                  <button
                    type="button"
                    onClick={() => setSelectedDossierId(String(activeOwner.id))}
                    className="block w-full rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-left shadow-sm ring-1 ring-emerald-100"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold tracking-[0.06em] text-emerald-700 uppercase">
                          Hồ sơ đang chứa cụm này
                        </p>
                        <p className="mt-1 text-sm font-semibold text-[#0F172A]">
                          {activeOwnerLabel} #{activeOwner.id}
                        </p>
                      </div>
                      <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#64748B]">
                      <span>{dossierInViewClusterCount} cụm</span>
                      <span>{dossierInViewDocumentCount} tài liệu</span>
                    </div>
                    {dossierInViewSummary && (
                      <p className="mt-2 line-clamp-3 text-xs leading-5 text-[#334155]">
                        {dossierInViewSummary}
                      </p>
                    )}
                  </button>
                ) : neighborsLoading ? (
                  <div className="flex items-center gap-2 rounded-xl border border-[#E2E8F0] bg-white p-4 text-sm text-[#64748B]">
                    <Loader2 className="size-4 animate-spin text-[#0052FF]" />
                    Đang tải hồ sơ tạm...
                  </div>
                ) : dossierRecommendations.length > 0 ? (
                  <div className="space-y-2">
                    {dossierRecommendations.map((recommendation, index) => {
                      const selected =
                        selectedDossierRecommendation?.id === recommendation.id
                      return (
                        <label
                          key={recommendation.id}
                          className={cn(
                            "block w-full cursor-pointer rounded-xl border bg-white p-3 text-left transition",
                            selected
                              ? "border-[#0052FF] bg-[#EEF2FF] shadow-sm"
                              : "border-[#D9E2F1] hover:border-[#AFC4FF]"
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-2.5">
                              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[#E8EEFF] text-xs font-bold text-[#0052FF]">
                                {index + 1}
                              </span>
                              <p className="min-w-0 text-sm font-semibold text-[#0F172A]">
                                Hồ sơ tạm #{recommendation.id}
                              </p>
                            </div>
                            <input
                              type="radio"
                              name="recommended-provisional-dossier"
                              className="mt-1 size-4 shrink-0 accent-[#0052FF]"
                              checked={selected}
                              onChange={() =>
                                setSelectedDossierId(String(recommendation.id))
                              }
                              aria-label={`Chọn hồ sơ tạm ${recommendation.id}`}
                            />
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#64748B]">
                            <span>{recommendation.cluster_count} cụm</span>
                            <span>
                              {recommendation.document_count} tài liệu
                            </span>
                          </div>
                          <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#475569]">
                            {recommendation.content_summary}
                          </p>
                        </label>
                      )
                    })}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-[#CBD5E1] bg-white p-5 text-sm text-[#64748B]">
                    Chưa có hồ sơ tạm phù hợp.
                  </p>
                )}
              </aside>

              <section className="min-h-0 overflow-y-auto bg-white p-3 sm:p-4">
                {dossierInViewId ? (
                  <div className="mx-auto max-w-6xl">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-[#0F172A]">
                          {activeOwner ? activeOwnerLabel : "Hồ sơ tạm"} #
                          {dossierInViewId}
                        </h3>
                        <p className="mt-1 text-xs text-[#64748B]">
                          {dossierInViewClusterCount} cụm ·{" "}
                          {dossierInViewDocumentCount} tài liệu
                        </p>
                        <p className="mt-2 max-w-4xl text-sm leading-6 text-[#334155]">
                          {dossierInViewSummary}
                        </p>
                      </div>
                      {!activeOwner && selectedDossierRecommendation && (
                        <Button
                          onClick={() =>
                            void addToDossier(selectedDossierRecommendation.id)
                          }
                          disabled={assignmentBusy || readOnly}
                        >
                          {assignmentBusy ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <FolderPlus />
                          )}
                          Chuyển {assignmentClusterIds.length} cụm vào hồ sơ
                        </Button>
                      )}
                    </div>

                    <div className="mt-4 border-t border-[#E2E8F0] pt-4">
                      <h4 className="font-semibold text-[#0F172A]">
                        Các cụm đang thuộc hồ sơ
                      </h4>
                      {dossierInView?.clusters.length ? (
                        <div className="mt-3 space-y-2">
                          {dossierInView.clusters.map(
                            (dossierCluster, index) => (
                              <article
                                key={dossierCluster.cluster_id}
                                className="rounded-xl border border-[#D9E2F1] bg-[#F8FAFC] p-3"
                              >
                                <div className="flex items-start gap-2.5">
                                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#E8EEFF] text-xs font-bold text-[#0052FF]">
                                    {index + 1}
                                  </span>
                                  <div className="min-w-0">
                                    <h5 className="text-sm font-semibold text-[#0F172A]">
                                      {dossierCluster.title ||
                                        dossierCluster.cluster_id}
                                    </h5>
                                    <p className="mt-1 text-xs leading-5 text-[#475569]">
                                      {normalizeClusterContentSummary(
                                        dossierCluster.content_summary
                                      )}
                                    </p>
                                    <p className="mt-1.5 text-xs text-[#64748B]">
                                      {dossierCluster.document_count} tài liệu
                                    </p>
                                  </div>
                                </div>
                              </article>
                            )
                          )}
                        </div>
                      ) : (
                        <p className="mt-3 rounded-xl border border-dashed border-[#CBD5E1] p-5 text-sm text-[#64748B]">
                          Chưa tải được nội dung các cụm của hồ sơ tạm này.
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-[#64748B]">
                    Chọn một hồ sơ tạm để xem các cụm bên trong.
                  </div>
                )}
              </section>
            </div>
          )}

          {!activeOwner && (onCreateDossier || onAddToDossier) && (
            <div className="border-t border-[#E2E8F0] bg-white px-4 py-2.5 sm:px-5">
              <div className="grid items-center gap-2 lg:grid-cols-[minmax(220px,1fr)_auto]">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#0F172A]">
                    Lập hồ sơ cho {assignmentClusterIds.length} cụm đã chọn
                  </p>
                </div>
                <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                  {onCreateDossier && (
                    <Button
                      onClick={() => void createDossier()}
                      disabled={assignmentBusy || readOnly}
                    >
                      {assignmentBusy ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <FolderPlus />
                      )}
                      {assignmentClusterIds.length > 1
                        ? `Tạo hồ sơ từ ${assignmentClusterIds.length} cụm`
                        : "Tạo hồ sơ tạm mới"}
                    </Button>
                  )}
                  {onAddToDossier && draftDossiers.length > 0 && (
                    <>
                      <select
                        className="h-9 min-w-0 flex-1 rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm text-[#0F172A] outline-none focus:border-[#0052FF] focus:ring-2 focus:ring-[#0052FF]/20 sm:min-w-56 sm:flex-none lg:w-64"
                        value={selectedDossierId}
                        onChange={(event) =>
                          setSelectedDossierId(event.target.value)
                        }
                        aria-label="Chọn hồ sơ tạm đích"
                      >
                        <option value="">Chọn hồ sơ tạm...</option>
                        {draftDossiers.map((dossier) => (
                          <option key={dossier.id} value={dossier.id}>
                            Hồ sơ tạm #{dossier.id}
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="outline"
                        onClick={() => void addToDossier()}
                        disabled={
                          !selectedDossierId || assignmentBusy || readOnly
                        }
                      >
                        {assignmentClusterIds.length > 1
                          ? `Ghép ${assignmentClusterIds.length} cụm`
                          : "Ghép vào hồ sơ đã chọn"}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function DocumentMetadataCard({
  placement,
  index,
  selected = false,
  onPreview,
}: {
  placement: ClusterPlacement
  index: number
  selected?: boolean
  onPreview?: () => void
}) {
  const entries = documentMetadataEntries(placement.metadata ?? {})
  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-colors",
        selected
          ? "border-[#0052FF] ring-1 ring-[#0052FF]/15"
          : "border-[#D9E2F1]"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 bg-[#F8FAFC] px-3.5 py-3">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#E8EEFF] text-xs font-bold text-[#0052FF]">
            {index + 1}
          </span>
          <div className="min-w-0">
            <h5 className="text-sm font-semibold break-all text-[#0F172A]">
              {placementFileName(placement)}
            </h5>
          </div>
        </div>
        {onPreview && (
          <Button
            type="button"
            variant={selected ? "default" : "outline"}
            size="sm"
            onClick={onPreview}
            aria-pressed={selected}
          >
            <Eye /> {selected ? "Đang xem" : "Xem tài liệu"}
          </Button>
        )}
      </div>
      <dl className="grid gap-x-5 px-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {entries.map(({ label, value }, entryIndex) => (
          <div
            key={label}
            className={cn(
              "min-w-0 border-b border-[#E2E8F0] py-2",
              entryIndex === 0 && "sm:col-span-2 xl:col-span-3"
            )}
          >
            <dt className="text-[11px] text-[#64748B]">{label}</dt>
            <dd className="mt-0.5 text-xs leading-5 break-words whitespace-pre-wrap text-[#0F172A]">
              {metadataValue(value)}
            </dd>
          </div>
        ))}
      </dl>
    </article>
  )
}

function DocumentInspectionPreview({
  sessionId,
  document,
  emptyMessage = "Chọn tài liệu để mở PDF tại đây.",
  onClose,
}: {
  sessionId: string
  document: DocumentPreviewTarget | null
  emptyMessage?: string
  onClose?: () => void
}) {
  return (
    <aside className="min-h-[520px] border-t border-[#CBD5E1] bg-[#E9EEF5] p-2 xl:min-h-0 xl:border-t-0 xl:border-l">
      {document ? (
        <DocumentPdfPreview
          sessionId={sessionId}
          document={document}
          presentation="dossier_review"
          fitHeight
          onClose={onClose}
          className="h-full min-h-[500px] min-w-0 xl:min-h-0"
        />
      ) : (
        <div className="flex h-full min-h-[500px] items-center justify-center rounded-xl border border-dashed border-[#B8C5D6] bg-white px-8 text-center text-sm leading-6 text-[#64748B] xl:min-h-0">
          <div>
            <Eye className="mx-auto mb-3 size-6 text-[#0052FF]" />
            {emptyMessage}
          </div>
        </div>
      )}
    </aside>
  )
}

function ListPagination({
  page,
  pageCount,
  pageSize,
  total,
  compact = false,
  onPageChange,
}: {
  page: number
  pageCount: number
  pageSize: number
  total: number
  compact?: boolean
  onPageChange: (page: number) => void
}) {
  const start = total > 0 ? (page - 1) * pageSize + 1 : 0
  const end = Math.min(page * pageSize, total)

  return (
    <nav
      className={cn(
        "flex items-center justify-between border border-[#CBD5E1] bg-white",
        compact
          ? "inline-flex gap-0.5 rounded-md p-0.5"
          : "gap-2 rounded-lg p-1 shadow-sm"
      )}
      aria-label="Phân trang tài liệu"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={compact ? "size-7" : undefined}
        disabled={page <= 1}
        onClick={() => onPageChange(Math.max(1, page - 1))}
        aria-label="Trang tài liệu trước"
      >
        <ArrowLeft />
      </Button>
      <span
        className={cn(
          "text-center font-medium text-[#475569] tabular-nums",
          compact ? "px-1 text-[11px]" : "text-xs"
        )}
      >
        {compact ? (
          `${page}/${pageCount}`
        ) : (
          <>
            {start}–{end}/{total}
            <span className="mx-1 text-[#CBD5E1]">·</span>
            Trang {page}/{pageCount}
          </>
        )}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={compact ? "size-7" : undefined}
        disabled={page >= pageCount}
        onClick={() => onPageChange(Math.min(pageCount, page + 1))}
        aria-label="Trang tài liệu sau"
      >
        <ArrowRight />
      </Button>
    </nav>
  )
}

function placementFileName(placement: ClusterPlacement) {
  return String(
    placement.file_name ||
      placement.metadata.file_name ||
      placement.metadata.filename ||
      placement.metadata.source_file_name ||
      placement.document_id
  )
}

function placementDataPath(placement: ClusterPlacement) {
  return String(
    placement.data_path ||
      placement.metadata.data_path ||
      placement.metadata.file_path ||
      placement.metadata.path ||
      ""
  )
}

function documentMetadataEntries(metadata: Record<string, unknown>) {
  return DOCUMENT_METADATA_FIELDS.map(({ label, aliases }) => ({
    label,
    value:
      aliases.map((alias) => metadata[alias]).find(hasMetadataValue) ?? "—",
  }))
}

function documentMetadataText(
  metadata: Record<string, unknown>,
  aliases: readonly string[],
  fallback = "Chưa xác định"
) {
  const value = aliases.map((alias) => metadata[alias]).find(hasMetadataValue)
  return value === undefined ? fallback : metadataValue(value)
}

function hasMetadataValue(value: unknown) {
  if (value === null || value === undefined) return false
  if (typeof value === "string") return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return true
}

function metadataValue(value: unknown) {
  if (Array.isArray(value)) return value.map(String).join(", ")
  if (typeof value === "object" && value !== null) {
    return JSON.stringify(value, null, 2)
  }
  if (typeof value === "boolean") return value ? "Có" : "Không"
  return String(value)
}

function formatPercent(value: number | null | undefined) {
  return value == null ? "—" : `${Math.round(value * 100)}%`
}

function similarityBadgeClass(value: number) {
  if (value >= 0.8) {
    return "bg-emerald-100 text-emerald-700"
  }
  if (value >= 0.65) {
    return "bg-blue-100 text-blue-700"
  }
  if (value >= 0.5) {
    return "bg-amber-100 text-amber-700"
  }
  return "bg-slate-200 text-slate-700"
}

function dateRange(
  start: string | null | undefined,
  end: string | null | undefined
) {
  if (!start && !end) return "Chưa xác định thời gian"
  if (!start || start === end) return start || end || "—"
  return `${start} – ${end}`
}
