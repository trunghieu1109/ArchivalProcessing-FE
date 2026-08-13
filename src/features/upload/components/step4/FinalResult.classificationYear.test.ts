import { describe, expect, it } from "vitest"
import type { SessionDossierSummary } from "@/features/upload/api/sessionApi"
import {
  versionToGroups,
  type ClusterGroup,
} from "@/features/upload/lib/clusterGroups"
import { updateDossierGroupFromResponse } from "./FinalResult.metadataUtils"
import { resultTreePath } from "./FinalResult.treeUtils"
import { updateClusterVersionDossier } from "./FinalResult.versionUtils"

const baseGroup: ClusterGroup = {
  id: "cluster-1",
  clusterId: "cluster-1",
  dossierId: "dossier-1",
  label: "Hồ sơ kiểm thử",
  files: [],
  documents: [],
  startDate: "2025-02-03",
  classificationPath: ["Hành chính"],
  classificationGroupIds: ["administration"],
}

const manuallyAssignedDossier = {
  dossier_id: "dossier-1",
  cluster_id: "cluster-1",
  title: "Hồ sơ kiểm thử",
  generated_title: "Hồ sơ kiểm thử",
  start_date: "2025-02-03",
  metadata_revision: 2,
  classification_status: "current",
  classification: {
    group_id: "records-2024",
    group_ids: ["administration", "year-2024", "records-2024"],
    group_path: ["Hành chính", "Năm 2024", "Hồ sơ tổng hợp"],
    confidence: null,
    requires_review: false,
  },
} as SessionDossierSummary

describe("manual classification year remains authoritative", () => {
  it("keeps selected year A immediately after submit and polling hydration", () => {
    const afterSubmit = updateDossierGroupFromResponse(
      [baseGroup],
      baseGroup.id,
      manuallyAssignedDossier
    )[0]

    expect(resultTreePath(afterSubmit)).toEqual([
      "Hành chính",
      "Năm 2024",
      "Hồ sơ tổng hợp",
    ])
    expect(resultTreePath(afterSubmit)).not.toContain("Năm 2025")
    expect(afterSubmit.classificationGroupIds).toEqual([
      "administration",
      "year-2024",
      "records-2024",
    ])

    const afterPolling = updateDossierGroupFromResponse(
      [afterSubmit],
      baseGroup.id,
      manuallyAssignedDossier
    )[0]
    expect(resultTreePath(afterPolling)).toContain("Năm 2024")
    expect(resultTreePath(afterPolling)).not.toContain("Năm 2025")
  })

  it("keeps selected year A after snapshot hydration and reload", () => {
    const staleDossier = {
      ...manuallyAssignedDossier,
      classification: {
        ...manuallyAssignedDossier.classification,
        group_ids: ["administration"],
        group_path: ["Hành chính"],
      },
    }
    const version = {
      id: "version-1",
      cluster_version_id: "version-1",
      session_id: "session-1",
      version_number: 1,
      status: "active",
      clusters: [
        {
          cluster_id: "cluster-1",
          title: "Hồ sơ kiểm thử",
          document_ids: [],
          placements: [],
          dossier: staleDossier,
          dossiers: [staleDossier],
        },
      ],
    }

    const synchronized = updateClusterVersionDossier(
      version as never,
      manuallyAssignedDossier
    )
    const reloadedGroup = versionToGroups(synchronized, []).find(
      (group) => group.dossierId === "dossier-1"
    )

    expect(reloadedGroup).toBeDefined()
    expect(resultTreePath(reloadedGroup!)).toContain("Năm 2024")
    expect(resultTreePath(reloadedGroup!)).not.toContain("Năm 2025")
  })

  it("falls back to metadata year B when classification path has no year", () => {
    expect(resultTreePath(baseGroup)).toEqual(["Năm 2025", "Hành chính"])
  })
})
