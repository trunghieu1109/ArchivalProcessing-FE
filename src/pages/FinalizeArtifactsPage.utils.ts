import type { SessionArtifact } from "@/features/upload/api/sessionApi"

export const FINALIZE_POLL_INTERVAL_MS = 5_000
export const FINALIZE_POLL_TIMEOUT_MS = 10 * 60 * 1_000
const EXCLUDED_FILE_NAMES = new Set(["tai lieu can kiem tra khi phan cum.xlsx"])
const HIDDEN_ARTIFACT_TYPES = new Set(["manifest", "publication_manifest"])
export const ARTIFACT_SECTION_DEFINITIONS = [
  { id: "metadata", ordinal: "01", label: "Tổng hợp metadata" },
  { id: "dossierIndex", ordinal: "02", label: "Mục lục hồ sơ" },
  { id: "documentIndex", ordinal: "03", label: "Mục lục văn bản" },
  { id: "phieuTin", ordinal: "04", label: "Phiếu tin" },
  { id: "nhanHop", ordinal: "05", label: "Nhãn hộp" },
] as const
export type ArtifactSectionId =
  | (typeof ARTIFACT_SECTION_DEFINITIONS)[number]["id"]
  | "other"
export interface ArtifactSection {
  id: ArtifactSectionId
  ordinal: string
  label: string
  artifacts: SessionArtifact[]
}
const SECTION_ARTIFACT_TYPE_ORDER: Record<string, string[]> = {
  metadata: [
    "tong_hop_data_so_hoa_xlsx",
    "metadata_digitalized_documents_xlsx",
    "metadata_extracted_documents_xlsx",
    "metadata_snapshot_xlsx",
    "metadata_dossiers_xlsx",
    "metadata_documents_xlsx",
    "metadata_snapshot_dossiers_xlsx",
    "metadata_snapshot_documents_xlsx",
  ],
  dossierIndex: [
    "muc_luc_ho_so_xlsx",
    "muc_luc_ho_so_co_thoi_han_xlsx",
    "muc_luc_ho_so",
    "muc_luc_ho_so_co_thoi_han",
    "danh_muc_ho_so",
  ],
  documentIndex: [
    "muc_luc_van_ban_xlsx",
    "muc_luc_van_ban_co_thoi_han_xlsx",
    "muc_luc_van_ban",
    "muc_luc_van_ban_co_thoi_han",
  ],
}
const VI_NATURAL_COLLATOR = new Intl.Collator("vi", {
  numeric: true,
  sensitivity: "base",
})
export const FINALIZE_PROGRESS_PHASES = [
  { id: "loading_data", label: "Tổng hợp dữ liệu hồ sơ" },
  { id: "creating_xlsx", label: "Tạo các file Excel" },
  { id: "writing_manifest", label: "Ghi danh sách tệp" },
  { id: "completed", label: "Hoàn tất" },
]

export interface FinalizeProgressViewState {
  activePhase: string | null
  failedPhase: string | null
  completedPhases: Set<string>
}

export function buildFinalizeProgressViewState(
  phase: string | null | undefined,
  jobStatus: string | null | undefined
): FinalizeProgressViewState {
  const normalizedPhase = String(phase ?? "").trim()
  const phaseIndex = FINALIZE_PROGRESS_PHASES.findIndex(
    (item) => item.id === normalizedPhase
  )
  const completedPhases = new Set<string>()
  const isDone = jobStatus === "done" || normalizedPhase === "completed"
  const isFailed = jobStatus === "failed"

  if (isDone) {
    FINALIZE_PROGRESS_PHASES.forEach((item) => completedPhases.add(item.id))
  } else if (phaseIndex > 0) {
    FINALIZE_PROGRESS_PHASES.slice(0, phaseIndex).forEach((item) =>
      completedPhases.add(item.id)
    )
  }

  return {
    activePhase:
      !isDone && !isFailed && phaseIndex >= 0 ? normalizedPhase : null,
    failedPhase: isFailed && phaseIndex >= 0 ? normalizedPhase : null,
    completedPhases,
  }
}

export function filterVisibleArtifacts(
  artifacts: SessionArtifact[]
): SessionArtifact[] {
  return artifacts.filter((artifact) => {
    if (artifact.status !== "ready") return false
    if (HIDDEN_ARTIFACT_TYPES.has(normalizeFilterText(artifact.artifact_type)))
      return false
    if (EXCLUDED_FILE_NAMES.has(normalizeFilterText(artifact.file_name)))
      return false
    return true
  })
}

export function buildArtifactSections(
  artifacts: SessionArtifact[]
): ArtifactSection[] {
  const buckets: Record<ArtifactSectionId, SessionArtifact[]> = {
    metadata: [],
    dossierIndex: [],
    documentIndex: [],
    phieuTin: [],
    nhanHop: [],
    other: [],
  }
  artifacts.forEach((artifact) => {
    buckets[artifactSectionId(artifact)].push(artifact)
  })

  const sections: ArtifactSection[] = ARTIFACT_SECTION_DEFINITIONS.map(
    (section) => ({
      ...section,
      artifacts: sortArtifactsForSection(buckets[section.id], section.id),
    })
  ).filter((section) => section.artifacts.length > 0)

  if (buckets.other.length > 0) {
    sections.push({
      id: "other",
      ordinal: "06",
      label: "Tệp khác",
      artifacts: sortArtifactsForSection(buckets.other, "other"),
    })
  }
  return sections
}

export function artifactSectionId(
  artifact: SessionArtifact
): ArtifactSectionId {
  const type = normalizeFilterText(artifact.artifact_type)
  if (type === "phieu_tin") return "phieuTin"
  if (type === "nhan_hop") return "nhanHop"
  if (type.includes("metadata") || type.includes("tong_hop")) {
    return "metadata"
  }
  if (type.startsWith("muc_luc_ho_so") || type === "danh_muc_ho_so") {
    return "dossierIndex"
  }
  if (type.startsWith("muc_luc_van_ban")) return "documentIndex"
  return "other"
}

export function isMetadataArtifact(artifact: SessionArtifact): boolean {
  return artifactSectionId(artifact) === "metadata"
}

function sortArtifactsForSection(
  artifacts: SessionArtifact[],
  sectionId: ArtifactSectionId
): SessionArtifact[] {
  const typeOrder = SECTION_ARTIFACT_TYPE_ORDER[sectionId] ?? []
  return [...artifacts].sort((left, right) => {
    const priorityDelta =
      artifactTypePriority(left, typeOrder) -
      artifactTypePriority(right, typeOrder)
    if (priorityDelta !== 0) return priorityDelta
    return (
      VI_NATURAL_COLLATOR.compare(left.file_name, right.file_name) ||
      left.id - right.id
    )
  })
}

function artifactTypePriority(
  artifact: SessionArtifact,
  typeOrder: string[]
): number {
  const index = typeOrder.indexOf(normalizeFilterText(artifact.artifact_type))
  return index >= 0 ? index : typeOrder.length
}

function normalizeFilterText(value: string): string {
  return value.trim().toLowerCase()
}

export function latestArtifactDate(
  artifacts: SessionArtifact[]
): string | null {
  return (
    artifacts
      .map((artifact) => artifact.generated_at)
      .filter((value): value is string => Boolean(value))
      .sort(
        (left, right) => new Date(right).getTime() - new Date(left).getTime()
      )[0] ?? null
  )
}

export function artifactExtension(fileName: string): string {
  const index = fileName.lastIndexOf(".")
  return index >= 0 ? fileName.slice(index + 1) : "file"
}

export function artifactTypeLabel(value: string): string {
  const labels: Record<string, string> = {
    muc_luc_ho_so: "Mục lục hồ sơ",
    muc_luc_ho_so_co_thoi_han: "Mục lục hồ sơ có thời hạn",
    muc_luc_ho_so_xlsx: "Mục lục hồ sơ Excel",
    muc_luc_ho_so_co_thoi_han_xlsx: "Mục lục hồ sơ có thời hạn Excel",
    danh_muc_ho_so: "Danh mục hồ sơ",
    muc_luc_van_ban: "Mục lục văn bản",
    muc_luc_van_ban_co_thoi_han: "Mục lục văn bản có thời hạn",
    muc_luc_van_ban_xlsx: "Mục lục văn bản Excel",
    muc_luc_van_ban_co_thoi_han_xlsx: "Mục lục văn bản có thời hạn Excel",
    phieu_tin: "Phiếu tin",
    nhan_hop: "Nhãn hộp",
    metadata_extracted_documents_xlsx: "Metadata tài liệu trích xuất",
    metadata_digitalized_documents_xlsx: "Metadata tài liệu số hóa",
    metadata_snapshot_xlsx: "Snapshot metadata",
    metadata_dossiers_xlsx: "Metadata hồ sơ",
    metadata_documents_xlsx: "Metadata tài liệu",
    metadata_snapshot_dossiers_xlsx: "Snapshot metadata hồ sơ",
    metadata_snapshot_documents_xlsx: "Snapshot metadata tài liệu",
  }
  return labels[value] ?? value.replace(/_/g, " ")
}

export function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
