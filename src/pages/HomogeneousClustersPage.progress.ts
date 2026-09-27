import type { ClusterBuildProgressMetrics } from "@/features/upload/api/sessionApi"

export interface HomogeneousProgressPhase {
  id: "pairing" | "clustering" | "summarizing"
  label: string
  percentage: number
  status: "completed" | "active" | "pending"
}

export interface HomogeneousProgressView {
  percentage: number
  phaseTitle: string
  progressLabel: string
  phases: HomogeneousProgressPhase[]
}

const PHASE_LABELS: Array<Pick<HomogeneousProgressPhase, "id" | "label">> = [
  { id: "pairing", label: "Tính pair và phân cụm" },
  { id: "clustering", label: "Chốt cụm tài liệu" },
  { id: "summarizing", label: "Sinh tóm tắt" },
]

function ratioPercentage(completed?: number, total?: number) {
  if (completed == null || total == null || total <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((completed / total) * 100)))
}

function possiblePairCount(documentCount?: number) {
  if (documentCount == null || documentCount <= 1) return 0
  return (documentCount * (documentCount - 1)) / 2
}

export function buildHomogeneousProgressView(
  metrics: ClusterBuildProgressMetrics | null
): HomogeneousProgressView {
  const stage = String(metrics?.stage ?? "preparing")
  const documentCount = metrics?.document_count
  const processedDocumentCount =
    metrics?.processed_document_count ?? metrics?.clustered_document_count ?? 0
  const pairScoreCount = metrics?.pair_score_count ?? 0
  const pairTotal =
    metrics?.possible_pair_count ?? possiblePairCount(documentCount)
  const clusterCount = metrics?.cluster_count ?? metrics?.dossier_count
  const summarizedClusterCount = metrics?.summarized_cluster_count ?? 0
  const isSummarizing = stage === "summarizing"
  const isPostSummary = [
    "enriching",
    "reviewing",
    "persisting",
    "completed",
  ].includes(stage)
  const isFinalizing =
    stage === "finalizing" || stage === "building_distance_matrix"
  const activePhaseIndex = isPostSummary
    ? 3
    : isSummarizing
      ? 2
      : isFinalizing
        ? 1
        : 0

  const documentPercentage = ratioPercentage(
    processedDocumentCount,
    documentCount
  )
  const pairPercentage = ratioPercentage(pairScoreCount, pairTotal)
  const pairingPercentage = Math.max(documentPercentage, pairPercentage)
  const clusteringPercentage = isFinalizing
    ? Math.min(
        100,
        Math.max(
          0,
          metrics?.stage_progress_percentage ??
            (stage === "building_distance_matrix" ? 100 : 0)
        )
      )
    : isSummarizing
      ? 100
      : 0
  const summaryPercentage = isPostSummary
    ? 100
    : isSummarizing
      ? clusterCount === 0
        ? 100
        : ratioPercentage(summarizedClusterCount, clusterCount)
      : 0

  const phasePercentages = [
    pairingPercentage,
    clusteringPercentage,
    summaryPercentage,
  ]
  const phases = PHASE_LABELS.map(
    (phase, index): HomogeneousProgressPhase => ({
      ...phase,
      percentage:
        index < activePhaseIndex
          ? 100
          : index === activePhaseIndex
            ? phasePercentages[index]
            : 0,
      status:
        index < activePhaseIndex
          ? "completed"
          : index === activePhaseIndex
            ? "active"
            : "pending",
    })
  )

  const percentage = isPostSummary
    ? 100
    : isSummarizing
      ? 85 + Math.round(summaryPercentage * 0.15)
      : isFinalizing
        ? 70 + Math.round(clusteringPercentage * 0.15)
        : Math.round(pairingPercentage * 0.7)
  return {
    percentage: Math.min(100, percentage),
    phaseTitle: isPostSummary
      ? "Đang lưu kết quả cụm"
      : isSummarizing
        ? "Đang sinh tóm tắt cụm"
        : isFinalizing
          ? "Đang chốt cụm tài liệu"
          : stage === "preparing"
            ? "Đang chuẩn bị phân tích tài liệu"
            : "Đang tính pair và phân cụm tài liệu",
    progressLabel: "Tiến độ xử lý và tạo cụm tạm thời",
    phases,
  }
}
