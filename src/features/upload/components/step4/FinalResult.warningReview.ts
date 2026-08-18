import type { SessionDossierSuggestion } from "@/features/upload/api/sessionApi"
import type {
  ClusterDocument,
  ClusterGroup,
} from "@/features/upload/lib/clusterGroups"

export interface WarningDocumentEntry {
  document: ClusterDocument
  sourceGroup: ClusterGroup
}

export function warningDocumentEntries(
  groups: ClusterGroup[]
): WarningDocumentEntry[] {
  return groups.flatMap((sourceGroup) =>
    sourceGroup.documents.flatMap((document) =>
      document.clusterWarning ? [{ document, sourceGroup }] : []
    )
  )
}

export function isActiveWarningDocument(document: ClusterDocument): boolean {
  if (!document.clusterWarning) return false
  const pendingAction = document.pendingFeedback?.action
  return (
    pendingAction !== "manual_move" &&
    pendingAction !== "move_to_temporary_folder"
  )
}

export function warningSuggestionKey(
  suggestion: SessionDossierSuggestion
): string {
  return (
    suggestion.cluster_id ||
    suggestion.dossier_id ||
    String(suggestion.session_dossier_id)
  )
}

export function warningReviewSuggestionCandidates(
  document: ClusterDocument,
  groups: ClusterGroup[]
): SessionDossierSuggestion[] {
  if (document.dossierSuggestions?.length) {
    return document.dossierSuggestions
  }

  const warning = document.clusterWarning
  if (!warning) return []

  const targetGroup = findWarningTargetGroup(groups, warning)
  const clusterId =
    targetGroup?.clusterId || warning.nearestOtherClusterId.trim()
  const dossierId =
    targetGroup?.dossierId ||
    targetGroup?.dossierStorageId ||
    targetGroup?.id ||
    clusterId
  const title =
    targetGroup?.label || warning.nearestOtherDossierTitle.trim() || dossierId

  if (!clusterId && !dossierId && !title) return []

  const representativeWarnings =
    warning.nearestOtherRepresentativeDocuments.length > 0
      ? warning.nearestOtherRepresentativeDocuments
      : warning.nearestOtherClusterRepresentativeId ||
          warning.nearestOtherRepresentativeFileName ||
          warning.nearestOtherRepresentativeTitle
        ? [
            {
              documentId: warning.nearestOtherClusterRepresentativeId,
              fileName: warning.nearestOtherRepresentativeFileName,
              title: warning.nearestOtherRepresentativeTitle,
              documentSummary: "",
              documentType: "",
              issuedDate: "",
            },
          ]
        : []
  const representativeDocuments = representativeWarnings.map(
    (representative) => {
      const matchingDocument = targetGroup?.documents.find(
        (candidate) => candidate.documentId === representative.documentId
      )
      return {
        session_document_id: matchingDocument?.sessionDocumentId ?? 0,
        document_id:
          representative.documentId || matchingDocument?.documentId || "",
        file_name: representative.fileName || matchingDocument?.fileName || "",
        title:
          representative.title ||
          metadataString(matchingDocument?.metadata, [
            "document_summary",
            "trich_yeu_van_ban",
            "title",
          ]),
        issued_date:
          representative.issuedDate ||
          metadataString(matchingDocument?.metadata, [
            "issued_date",
            "ngay_ban_hanh",
          ]),
        document_number: metadataString(matchingDocument?.metadata, [
          "document_number",
          "document_number_part",
          "so_ky_hieu",
        ]),
      }
    }
  )

  return [
    {
      rank: 1,
      session_dossier_id: targetGroup?.draftId ?? 0,
      dossier_id: dossierId,
      cluster_id: clusterId,
      title,
      best_other_similarity: warning.nearestOtherClusterSimilarity ?? 0,
      average_similarity: warning.nearestOtherClusterSimilarity ?? 0,
      matching_document_count: 1,
      matched_document_ids: [document.documentId],
      matched_session_document_ids:
        document.sessionDocumentId === null ? [] : [document.sessionDocumentId],
      representative_document_ids: representativeDocuments
        .map((representative) => representative.document_id)
        .filter(Boolean),
      representative_documents: representativeDocuments,
      document_count:
        targetGroup?.documents.length ?? representativeDocuments.length,
    },
  ]
}

function findWarningTargetGroup(
  groups: ClusterGroup[],
  warning: NonNullable<ClusterDocument["clusterWarning"]>
): ClusterGroup | null {
  const targetId = warning.nearestOtherClusterId.trim()
  const targetTitle = warning.nearestOtherDossierTitle.trim()
  return (
    groups.find(
      (group) =>
        Boolean(targetId) &&
        (group.clusterId === targetId ||
          group.id === targetId ||
          group.dossierId === targetId ||
          group.dossierStorageId === targetId)
    ) ??
    groups.find(
      (group) => Boolean(targetTitle) && group.label.trim() === targetTitle
    ) ??
    null
  )
}

function metadataString(
  metadata: Record<string, unknown> | undefined,
  keys: string[]
): string {
  if (!metadata) return ""
  for (const key of keys) {
    const value = metadata[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number") return String(value)
  }
  return ""
}
