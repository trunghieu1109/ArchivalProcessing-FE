import type {
  ClusterDossierChangeType,
  ClusterDocumentChangeType,
  ClusterGroupChangeType,
  ClusterVersionChangesResponse,
} from "@/features/upload/api/sessionApi"

export interface ClusterChangeHighlights {
  classificationGroups: Map<string, ClusterGroupChangeType[]>
  dossiers: Map<string, ClusterDossierChangeType[]>
  documents: Map<number, ClusterDocumentChangeType[]>
}

export type ClusterChangeScope = "group" | "dossier" | "document"

export interface ClusterChangeTag {
  label: string
  title: string
  className: string
}

const CHANGE_TAG_CLASS_BY_SCOPE: Record<ClusterChangeScope, string> = {
  group: "border-violet-200 bg-violet-50 text-violet-700",
  dossier: "border-amber-200 bg-amber-50 text-amber-800",
  document: "border-sky-200 bg-sky-50 text-sky-700",
}

export function buildClusterChangeHighlights(
  changes: ClusterVersionChangesResponse | null
): ClusterChangeHighlights {
  return {
    classificationGroups: new Map(
      (changes?.classification_groups ?? []).map((change) => [
        change.group_id,
        change.change_types,
      ])
    ),
    dossiers: new Map(
      (changes?.dossiers ?? []).map((change) => [
        change.dossier_id,
        change.change_types,
      ])
    ),
    documents: new Map(
      (changes?.documents ?? []).map((change) => [
        change.session_document_id,
        change.change_types,
      ])
    ),
  }
}

export function clusterVersionChangeSummaryText(
  changes: ClusterVersionChangesResponse
): string {
  const parts: string[] = []
  const changedGroupCount = changes.classification_groups.length

  if (changedGroupCount > 0) {
    parts.push(`${changedGroupCount} nh\u00f3m ph\u00e2n lo\u1ea1i`)
  }
  if (changes.summary.changed_dossier_count > 0) {
    parts.push(`${changes.summary.changed_dossier_count} h\u1ed3 s\u01a1`)
  }
  if (changes.summary.changed_document_count > 0) {
    parts.push(`${changes.summary.changed_document_count} t\u00e0i li\u1ec7u`)
  }

  return parts.length > 0
    ? parts.join(" \u00b7 ")
    : "Kh\u00f4ng c\u00f3 thay \u0111\u1ed5i so v\u1edbi phi\u00ean b\u1ea3n tr\u01b0\u1edbc."
}

export function changeTagPresentation(
  scope: ClusterChangeScope,
  changeTypes: readonly string[] | undefined
): ClusterChangeTag | null {
  if (!changeTypes || changeTypes.length === 0) return null

  const labels = changeTypes.map((type) => changeTypeLabel(scope, type))
  return {
    label: labels.length === 1 ? labels[0] : "V\u1eeba thay \u0111\u1ed5i",
    title: `So v\u1edbi phi\u00ean b\u1ea3n tr\u01b0\u1edbc: ${labels.join(", ").toLocaleLowerCase("vi")}`,
    className: CHANGE_TAG_CLASS_BY_SCOPE[scope],
  }
}

function changeTypeLabel(
  scope: ClusterChangeScope,
  changeType: string
): string {
  const shared: Record<string, string> = {
    created:
      scope === "group" ? "Nh\u00f3m m\u1edbi" : "H\u1ed3 s\u01a1 m\u1edbi",
    removed: "\u0110\u00e3 x\u00f3a",
    moved: "V\u1eeba di chuy\u1ec3n",
    updated: "V\u1eeba c\u1eadp nh\u1eadt",
    reordered: "\u0110\u1ed5i th\u1ee9 t\u1ef1",
    added: "T\u00e0i li\u1ec7u m\u1edbi",
    arrangement_status_changed: "\u0110\u1ed5i tr\u1ea1ng th\u00e1i",
  }
  return shared[changeType] ?? "V\u1eeba thay \u0111\u1ed5i"
}
