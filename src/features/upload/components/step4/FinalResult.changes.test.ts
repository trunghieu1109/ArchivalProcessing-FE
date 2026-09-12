import { describe, expect, it } from "vitest"

import type { ClusterVersionChangesResponse } from "@/features/upload/api/sessionApi"
import {
  buildClusterChangeHighlights,
  changeTagPresentation,
  clusterVersionChangeSummaryText,
} from "./FinalResult.changes"

const changes: ClusterVersionChangesResponse = {
  session_id: "session-1",
  from: {
    cluster_version_id: "version-1",
    version_number: 1,
    plan_version_id: "plan-1",
  },
  to: {
    cluster_version_id: "version-2",
    version_number: 2,
    plan_version_id: "plan-2",
    source: "feedback_rebuild",
  },
  summary: {
    created_group_count: 1,
    removed_group_count: 0,
    changed_dossier_count: 1,
    changed_document_count: 1,
  },
  classification_groups: [
    {
      group_id: "group-1",
      change_types: ["created"],
      before: null,
      after: {
        name: "Nh\u00f3m 1",
        type: "series",
        parent_group_ids: [],
        definition: null,
        criteria: [],
      },
      changed_fields: [],
    },
  ],
  dossiers: [
    {
      dossier_id: "dossier-1",
      cluster_id: "cluster-1",
      change_types: ["moved", "updated"],
      before: null,
      after: null,
      changed_fields: [],
    },
  ],
  documents: [
    {
      session_document_id: 7,
      document_id: "document-7",
      file_name: "document.pdf",
      change_types: ["moved"],
      before: null,
      after: null,
      changed_fields: [],
    },
  ],
  affected_tree_paths: [],
  created_at: "2026-09-12T00:00:00Z",
}

describe("cluster version change highlights", () => {
  it("indexes changed entities for tree rendering", () => {
    const highlights = buildClusterChangeHighlights(changes)

    expect(highlights.classificationGroups.get("group-1")).toEqual(["created"])
    expect(highlights.dossiers.get("dossier-1")).toEqual(["moved", "updated"])
    expect(highlights.documents.get(7)).toEqual(["moved"])
  })

  it("builds concise Vietnamese summary and tags", () => {
    expect(clusterVersionChangeSummaryText(changes)).toBe(
      "1 nh\u00f3m ph\u00e2n lo\u1ea1i \u00b7 1 h\u1ed3 s\u01a1 \u00b7 1 t\u00e0i li\u1ec7u"
    )
    expect(changeTagPresentation("document", ["moved"])).toEqual({
      label: "V\u1eeba di chuy\u1ec3n",
      title:
        "So v\u1edbi phi\u00ean b\u1ea3n tr\u01b0\u1edbc: v\u1eeba di chuy\u1ec3n",
      className: "border-sky-200 bg-sky-50 text-sky-700",
    })
  })

  it("uses a distinct tag color for each change level", () => {
    expect(changeTagPresentation("group", ["updated"])?.className).toBe(
      "border-violet-200 bg-violet-50 text-violet-700"
    )
    expect(changeTagPresentation("dossier", ["updated"])?.className).toBe(
      "border-amber-200 bg-amber-50 text-amber-800"
    )
    expect(changeTagPresentation("document", ["updated"])?.className).toBe(
      "border-sky-200 bg-sky-50 text-sky-700"
    )
  })
})
