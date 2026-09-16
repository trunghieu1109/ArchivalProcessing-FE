import { describe, expect, it } from "vitest"

import {
  flattenSupplementalClassificationTargets,
  isSupplementalYearLevel,
  parseSupplementalClassificationPath,
  sanitizeSupplementalGroupName,
  selectedSupplementalClassificationLeaf,
  supplementalClassificationPathFromChoices,
  supplementalClassificationLevels,
  supplementalExistingOptionsForNewPath,
  supplementalNewPathLevels,
  updateSupplementalClassificationSelection,
} from "./SupplementalIntakeUploadSection.logic"

describe("supplemental intake upload form", () => {
  it("flattens the active classification tree and marks only terminal groups as leaves", () => {
    const targets = flattenSupplementalClassificationTargets([
      {
        id: "series-1",
        name: "Hành chính",
        type: "series",
        definition: "",
        children: [
          {
            id: "year-2025",
            name: "Năm 2025",
            type: "year",
            definition: "",
            children: [],
          },
        ],
      },
    ])

    expect(targets).toEqual([
      {
        id: "series-1",
        ids: ["series-1"],
        path: ["Hành chính"],
        isLeaf: false,
      },
      {
        id: "year-2025",
        ids: ["series-1", "year-2025"],
        path: ["Hành chính", "Năm 2025"],
        isLeaf: true,
      },
    ])
  })

  it("parses each new classification level from type and name", () => {
    expect(
      parseSupplementalClassificationPath("year|Năm 2026\nsubject|Tài chính")
    ).toEqual([
      {
        kind: "new",
        client_group_id: "new-0-nam-2026",
        type: "year",
        name: "Năm 2026",
      },
      {
        kind: "new",
        client_group_id: "new-1-tai-chinh",
        type: "subject",
        name: "Tài chính",
      },
    ])
  })

  it("filters each next level and accepts only a complete leaf path", () => {
    const targets = flattenSupplementalClassificationTargets([
      {
        id: "root-a",
        name: "Root A",
        type: "series",
        definition: "",
        children: [
          {
            id: "middle-a",
            name: "Middle A",
            type: "year",
            definition: "",
            children: [
              {
                id: "leaf-a",
                name: "Leaf A",
                type: "subject",
                definition: "",
                children: [],
              },
            ],
          },
        ],
      },
      {
        id: "root-b",
        name: "Root B",
        type: "series",
        definition: "",
        children: [],
      },
    ])

    expect(supplementalClassificationLevels(targets, [])[0].options).toEqual([
      { id: "root-a", name: "Root A" },
      { id: "root-b", name: "Root B" },
    ])

    const rootSelection = updateSupplementalClassificationSelection(
      [],
      0,
      "root-a"
    )
    expect(
      supplementalClassificationLevels(targets, rootSelection)[1].options
    ).toEqual([{ id: "middle-a", name: "Middle A" }])
    expect(
      selectedSupplementalClassificationLeaf(targets, rootSelection)
    ).toBeUndefined()

    const middleSelection = updateSupplementalClassificationSelection(
      rootSelection,
      1,
      "middle-a"
    )
    expect(
      selectedSupplementalClassificationLeaf(targets, middleSelection)
    ).toBeUndefined()

    const leafSelection = updateSupplementalClassificationSelection(
      middleSelection,
      2,
      "leaf-a"
    )
    expect(
      selectedSupplementalClassificationLeaf(targets, leafSelection)?.ids
    ).toEqual(["root-a", "middle-a", "leaf-a"])

    expect(
      updateSupplementalClassificationSelection(leafSelection, 0, "root-b")
    ).toEqual(["root-b"])
    expect(
      selectedSupplementalClassificationLeaf(targets, ["root-b"])
    ).toMatchObject({ id: "root-b", isLeaf: true })
  })

  it("builds TH3 rows from plan levels and mixes existing with new groups", () => {
    const groups = [
      {
        id: "root-a",
        name: "Hành chính",
        type: "series",
        definition: "Theo lĩnh vực hoạt động",
        children: [
          {
            id: "year-2025",
            name: "2025",
            type: "year",
            definition: "",
            children: [],
          },
        ],
      },
    ]
    const targets = flattenSupplementalClassificationTargets(groups)
    const levels = supplementalNewPathLevels(groups, [
      { group_level: "series", criteria: ["Lĩnh vực"] },
      { group_level: "year", criteria: ["Năm hình thành"] },
    ])
    const choices = [
      { kind: "existing" as const, groupId: "root-a", name: "" },
      { kind: "new" as const, groupId: "", name: "2026" },
    ]

    expect(levels).toEqual([
      {
        depth: 0,
        type: "series",
        criteria: ["Lĩnh vực"],
        definition: "Theo lĩnh vực hoạt động",
      },
      {
        depth: 1,
        type: "year",
        criteria: ["Năm hình thành"],
        definition: "",
      },
    ])
    expect(supplementalExistingOptionsForNewPath(targets, choices, 1)).toEqual([
      { id: "year-2025", name: "2025" },
    ])
    expect(supplementalClassificationPathFromChoices(levels, choices)).toEqual([
      { kind: "existing", group_id: "root-a" },
      {
        kind: "new",
        client_group_id: "new-1-2026",
        type: "year",
        name: "2026",
      },
    ])
    expect(sanitizeSupplementalGroupName("year", "Năm 20a26")).toBe("2026")
    expect(isSupplementalYearLevel("Năm")).toBe(true)
    expect(sanitizeSupplementalGroupName("subject", "Tài chính 2026")).toBe(
      "Tài chính 2026"
    )
  })
})
