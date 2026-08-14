import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { updateClusterVersionDossier } from "../src/features/upload/components/step4/FinalResult.versionUtils.ts"

const primaryDossier = {
  dossier_id: "dossier-1",
  cluster_id: "cluster-1",
  title: "Primary old title",
  generated_title: "Primary generated title",
}
const secondaryDossier = {
  dossier_id: "dossier-2",
  cluster_id: "cluster-1",
  title: "Secondary old title",
  generated_title: "Secondary generated title",
}
const version = {
  id: "version-1",
  clusters: [
    {
      cluster_id: "cluster-1",
      dossier: primaryDossier,
      dossiers: [primaryDossier, secondaryDossier],
    },
  ],
}

test("updates the edited dossier in every cluster snapshot location", () => {
  const updatedPrimary = {
    ...primaryDossier,
    title: "Primary reviewed title",
    title_override: "Primary reviewed title",
    metadata_revision: 1,
  }

  const next = updateClusterVersionDossier(version, updatedPrimary)

  assert.notEqual(next, version)
  assert.equal(next.clusters[0].dossier, updatedPrimary)
  assert.equal(next.clusters[0].dossiers[0], updatedPrimary)
  assert.equal(next.clusters[0].dossiers[1], secondaryDossier)
})

test("updates a non-primary dossier without replacing the primary dossier", () => {
  const updatedSecondary = {
    ...secondaryDossier,
    title: "Secondary reviewed title",
    title_override: "Secondary reviewed title",
    metadata_revision: 1,
  }

  const next = updateClusterVersionDossier(version, updatedSecondary)

  assert.equal(next.clusters[0].dossier, primaryDossier)
  assert.equal(next.clusters[0].dossiers[0], primaryDossier)
  assert.equal(next.clusters[0].dossiers[1], updatedSecondary)
})

test("keeps the original snapshot when the dossier is not present", () => {
  const missingDossier = {
    ...secondaryDossier,
    dossier_id: "dossier-missing",
  }

  assert.equal(updateClusterVersionDossier(version, missingDossier), version)
})

test("dossier save synchronizes the snapshot and invalidates stale hydration", async () => {
  const actionSource = await readFile(
    new URL(
      "../src/features/upload/components/step4/useFinalResultTreeActions.ts",
      import.meta.url
    ),
    "utf8"
  )
  const resultSource = await readFile(
    new URL(
      "../src/features/upload/components/step4/FinalResult.tsx",
      import.meta.url
    ),
    "utf8"
  )

  assert.match(
    actionSource,
    /feedbackHydrationRevisionRef\.current \+= 1[\s\S]*setDisplayedClusterVersion\([\s\S]*updateClusterVersionDossier\(previous, response\)/
  )
  assert.match(
    resultSource,
    /hydrationRevision !== feedbackHydrationRevisionRef\.current/
  )
})
