import type {
  ClusterVersionResponse,
  SessionDossierSummary,
} from "@/features/upload/api/sessionApi"

export function updateClusterVersionDossier(
  version: ClusterVersionResponse | null,
  dossier: SessionDossierSummary
): ClusterVersionResponse | null {
  if (!version?.clusters) return version

  let versionChanged = false
  const clusters = version.clusters.map((cluster) => {
    let clusterChanged = false
    const primaryDossier = replaceMatchingDossier(cluster.dossier, dossier)
    if (primaryDossier !== cluster.dossier) clusterChanged = true

    const dossiers = cluster.dossiers?.map((item) => {
      const next = replaceMatchingDossier(item, dossier)
      if (next !== item) clusterChanged = true
      return next
    })
    if (!clusterChanged) return cluster

    versionChanged = true
    return {
      ...cluster,
      dossier: primaryDossier,
      ...(dossiers ? { dossiers } : {}),
    }
  })

  return versionChanged ? { ...version, clusters } : version
}

function replaceMatchingDossier(
  current: SessionDossierSummary,
  updated: SessionDossierSummary
): SessionDossierSummary
function replaceMatchingDossier(
  current: SessionDossierSummary | null,
  updated: SessionDossierSummary
): SessionDossierSummary | null
function replaceMatchingDossier(
  current: SessionDossierSummary | null,
  updated: SessionDossierSummary
): SessionDossierSummary | null {
  return current?.dossier_id === updated.dossier_id ? updated : current
}
