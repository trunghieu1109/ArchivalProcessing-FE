import type { SupplementalClassificationPathNode } from "@/features/upload/api/sessionApi"
import type { PlanCriterionSet, PlanGroup } from "@/features/upload/types"

export interface SupplementalClassificationTarget {
  id: string
  ids: string[]
  path: string[]
  isLeaf: boolean
}

export interface SupplementalClassificationLevelOption {
  id: string
  name: string
}

export interface SupplementalClassificationLevel {
  depth: number
  options: SupplementalClassificationLevelOption[]
}

export interface SupplementalNewPathLevel {
  depth: number
  type: string
  criteria: string[]
  definition: string
  isYear: boolean
}

export interface SupplementalNewPathChoice {
  kind: "" | "existing" | "new"
  groupId: string
  name: string
}

export function flattenSupplementalClassificationTargets(
  groups: PlanGroup[]
): SupplementalClassificationTarget[] {
  const targets: SupplementalClassificationTarget[] = []

  const visit = (
    group: PlanGroup,
    parentIds: string[],
    parentPath: string[]
  ) => {
    const ids = [...parentIds, group.id]
    const path = [...parentPath, group.name]
    const children = Array.isArray(group.children) ? group.children : []
    targets.push({ id: group.id, ids, path, isLeaf: children.length === 0 })
    children.forEach((child) => visit(child, ids, path))
  }

  groups.forEach((group) => visit(group, [], []))
  return targets
}

export function supplementalClassificationLevels(
  targets: SupplementalClassificationTarget[],
  selectedIds: string[]
): SupplementalClassificationLevel[] {
  const levels: SupplementalClassificationLevel[] = []
  for (let depth = 0; ; depth += 1) {
    const options = new Map<string, SupplementalClassificationLevelOption>()
    for (const target of targets) {
      if (target.ids.length <= depth) continue
      const matchesParent = selectedIds
        .slice(0, depth)
        .every((id, index) => target.ids[index] === id)
      if (!matchesParent) continue
      const id = target.ids[depth]
      if (!options.has(id)) {
        options.set(id, { id, name: target.path[depth] || id })
      }
    }
    if (options.size === 0) break
    levels.push({ depth, options: [...options.values()] })
    if (!selectedIds[depth]) break
  }
  return levels
}

export function updateSupplementalClassificationSelection(
  selectedIds: string[],
  depth: number,
  groupId: string
): string[] {
  const parentIds = selectedIds.slice(0, depth)
  return groupId ? [...parentIds, groupId] : parentIds
}

export function selectedSupplementalClassificationLeaf(
  targets: SupplementalClassificationTarget[],
  selectedIds: string[]
): SupplementalClassificationTarget | undefined {
  return targets.find(
    (target) =>
      target.isLeaf &&
      target.ids.length === selectedIds.length &&
      target.ids.every((id, index) => id === selectedIds[index])
  )
}

export function supplementalNewPathLevels(
  groups: PlanGroup[],
  criterias: PlanCriterionSet[]
): SupplementalNewPathLevel[] {
  const groupsByDepth = new Map<number, PlanGroup[]>()
  const visit = (group: PlanGroup, depth: number) => {
    groupsByDepth.set(depth, [...(groupsByDepth.get(depth) ?? []), group])
    group.children.forEach((child) => visit(child, depth + 1))
  }
  groups.forEach((group) => visit(group, 0))

  // The active hierarchy is authoritative for the number of levels. Criteria
  // decorate those levels; stale/extra criteria must not create phantom rows.
  const depthCount =
    groupsByDepth.size > 0
      ? Math.max(...groupsByDepth.keys()) + 1
      : criterias.length
  return Array.from({ length: depthCount }, (_, depth) => {
    const depthGroups = groupsByDepth.get(depth) ?? []
    const observedType =
      depthGroups.find((group) => group.type.trim())?.type.trim() ?? ""
    const matchingCriteria =
      criterias.find(
        (item) =>
          observedType &&
          normalizedLevelType(item.group_level) ===
            normalizedLevelType(observedType)
      ) ?? criterias[depth]
    const criteria = [...(matchingCriteria?.criteria ?? [])]
    const type =
      matchingCriteria?.group_level.trim() ||
      observedType ||
      `level-${depth + 1}`
    return {
      depth,
      type,
      criteria,
      definition:
        depthGroups
          .find((group) => group.definition.trim())
          ?.definition.trim() ?? "",
      isYear: isSupplementalYearLevel(type, criteria),
    }
  })
}

export function supplementalExistingOptionsForNewPath(
  targets: SupplementalClassificationTarget[],
  choices: SupplementalNewPathChoice[],
  depth: number
): SupplementalClassificationLevelOption[] {
  const parentIds: string[] = []
  for (let index = 0; index < depth; index += 1) {
    const choice = choices[index]
    if (choice?.kind !== "existing" || !choice.groupId) return []
    parentIds.push(choice.groupId)
  }

  const options = new Map<string, SupplementalClassificationLevelOption>()
  for (const target of targets) {
    if (target.ids.length <= depth) continue
    if (!parentIds.every((groupId, index) => target.ids[index] === groupId)) {
      continue
    }
    const id = target.ids[depth]
    if (!options.has(id)) {
      options.set(id, { id, name: target.path[depth] || id })
    }
  }
  return [...options.values()]
}

export function supplementalClassificationPathFromChoices(
  levels: SupplementalNewPathLevel[],
  choices: SupplementalNewPathChoice[]
): SupplementalClassificationPathNode[] {
  const path: SupplementalClassificationPathNode[] = []
  levels.forEach((level, index) => {
    const choice = choices[index]
    if (choice?.kind === "existing" && choice.groupId) {
      path.push({ kind: "existing", group_id: choice.groupId })
      return
    }
    const name = choice?.kind === "new" ? choice.name.trim() : ""
    if (!name) return
    path.push({
      kind: "new",
      client_group_id: `new-${level.depth}-${slug(name)}`,
      type: level.type,
      name,
    })
  })
  return path
}

export function sanitizeSupplementalGroupName(
  type: string,
  value: string,
  criteria: string[] = []
): string {
  return isSupplementalYearLevel(type, criteria)
    ? value.replace(/\D/g, "")
    : value
}

export function isSupplementalYearLevel(
  type: string,
  criteria: string[] = []
): boolean {
  const normalized = normalizedLevelType(type)
  if (normalized === "year" || normalized === "nam") return true
  return criteria.some((item) => {
    const normalizedCriterion = normalizedLevelType(item)
    return (
      normalizedCriterion.includes("nam") ||
      normalizedCriterion.includes("year")
    )
  })
}

export function parseSupplementalClassificationPath(
  value: string
): SupplementalClassificationPathNode[] {
  return value.split(/\r?\n/).flatMap((line, index) => {
    const [type, ...nameParts] = line.split("|")
    const name = nameParts.join("|").trim()
    if (!type.trim() || !name) return []
    return [
      {
        kind: "new" as const,
        client_group_id: `new-${index}-${slug(name)}`,
        type: type.trim(),
        name,
      },
    ]
  })
}

export function cleanSupplementalDossierMetadata(
  value: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== "" && item != null)
  )
}

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function normalizedLevelType(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}
