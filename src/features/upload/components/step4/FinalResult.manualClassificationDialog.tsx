import { memo, useMemo, useState } from "react"
import {
  Check,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  FolderTree,
  Info,
  Loader2,
  Search,
  X,
} from "lucide-react"
import { Dialog } from "radix-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { FolderNode } from "@/features/upload/types"
import type { ClusterGroup } from "@/features/upload/lib/clusterGroups"
import { cn } from "@/shared/lib/utils"

function ManualClassificationDialogComponent({
  dossier,
  tree,
  saving,
  onClose,
  onSubmit,
}: {
  dossier: ClusterGroup
  tree: FolderNode[]
  saving: boolean
  onClose: () => void
  onSubmit: (groupIds: string[]) => Promise<boolean>
}) {
  const currentPath = useMemo(
    () => findPathByIds(tree, dossier.classificationGroupIds ?? []),
    [dossier.classificationGroupIds, tree]
  )
  const [query, setQuery] = useState("")
  const [selectedPath, setSelectedPath] = useState<FolderNode[]>(currentPath)
  const [expandedPathKeys, setExpandedPathKeys] = useState<Set<string>>(() =>
    ancestorPathKeys(currentPath)
  )

  const visibleTree = useMemo(
    () => filterClassificationTree(tree, query),
    [tree, query]
  )
  const selectedIds = selectedPath.map((node) => node.id)
  const currentIds = currentPath.map((node) => node.id)
  const selectionUnchanged = sameStringArray(selectedIds, currentIds)

  const toggleExpanded = (path: FolderNode[]) => {
    const key = classificationPathKey(path)
    setExpandedPathKeys((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleSubmit = async () => {
    if (selectedIds.length === 0 || selectionUnchanged) return
    const updated = await onSubmit(selectedIds)
    if (updated) onClose()
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && !saving && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#0F172A]/50 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-[51] flex h-[min(88svh,760px)] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-[#CBD5E1] bg-white shadow-2xl outline-none">
          <div className="flex shrink-0 items-start gap-3 border-b border-[#E2E8F0] px-5 py-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#EAF1FF] text-[#0052FF]">
              <FolderTree className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base font-semibold text-[#0F172A]">
                Phân loại thủ công
              </Dialog.Title>
              <Dialog.Description className="mt-1 line-clamp-2 text-sm text-[#64748B]">
                Chọn một nhóm cấp thấp nhất cho hồ sơ “{dossier.label}”.
              </Dialog.Description>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              title="Đóng"
              aria-label="Đóng"
              disabled={saving}
              onClick={onClose}
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 px-5 py-4">
            <div className="relative shrink-0">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#94A3B8]" />
              <Input
                name="manual-classification-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm nhóm phân loại..."
                className="pl-9"
                autoComplete="off"
                spellCheck={false}
                autoFocus
              />
            </div>

            <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-[minmax(0,1fr)_280px]">
              <div className="min-h-0 overflow-y-auto rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-2">
                {visibleTree.length > 0 ? (
                  <div className="space-y-1 pr-2">
                    {visibleTree.map((node) => (
                      <ClassificationTreeNode
                        key={node.id}
                        node={node}
                        path={[]}
                        selectedIds={selectedIds}
                        expandedPathKeys={expandedPathKeys}
                        forceExpanded={Boolean(query.trim())}
                        onToggle={toggleExpanded}
                        onSelect={setSelectedPath}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-40 items-center justify-center px-4 text-center text-sm text-[#64748B]">
                    {tree.length === 0
                      ? "Phương án đang active chưa có cây phân loại."
                      : "Không tìm thấy nhóm phân loại phù hợp."}
                  </div>
                )}
              </div>

              <div className="flex min-h-0 flex-col gap-3">
                <ClassificationPathSummary
                  label="Phân loại hiện tại"
                  path={
                    currentPath.length > 0
                      ? currentPath.map((node) => node.name)
                      : (dossier.classificationPath ?? [])
                  }
                  muted
                />
                <ClassificationPathSummary
                  label="Nhóm sẽ cập nhật"
                  path={selectedPath.map((node) => node.name)}
                />
                <div className="mt-auto flex gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs leading-5 text-blue-800">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    Thao tác này chỉ đổi kết quả phân loại. Thời hạn bảo quản
                    hiện tại được giữ nguyên.
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={onClose}
            >
              Hủy
            </Button>
            <Button
              type="button"
              disabled={
                saving || selectedIds.length === 0 || selectionUnchanged
              }
              onClick={() => void handleSubmit()}
            >
              {saving ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : (
                <Check data-icon="inline-start" />
              )}
              {saving ? "Đang cập nhật..." : "Cập nhật phân loại"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export const ManualClassificationDialog = memo(
  ManualClassificationDialogComponent
)

function ClassificationTreeNode({
  node,
  path,
  selectedIds,
  expandedPathKeys,
  forceExpanded,
  onToggle,
  onSelect,
}: {
  node: FolderNode
  path: FolderNode[]
  selectedIds: string[]
  expandedPathKeys: Set<string>
  forceExpanded: boolean
  onToggle: (path: FolderNode[]) => void
  onSelect: (path: FolderNode[]) => void
}) {
  const currentPath = [...path, node]
  const hasChildren = node.children.length > 0
  const pathKey = classificationPathKey(currentPath)
  const expanded = forceExpanded || expandedPathKeys.has(pathKey)
  const selected =
    !hasChildren &&
    sameStringArray(
      currentPath.map((item) => item.id),
      selectedIds
    )

  return (
    <div>
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
          selected
            ? "bg-[#DBEAFE] font-semibold text-[#0052FF]"
            : "text-[#334155] hover:bg-white"
        )}
        style={{ paddingLeft: `${10 + path.length * 18}px` }}
        aria-expanded={hasChildren ? expanded : undefined}
        onClick={() =>
          hasChildren ? onToggle(currentPath) : onSelect(currentPath)
        }
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="size-3.5 shrink-0 text-[#64748B]" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0 text-[#64748B]" />
          )
        ) : (
          <span className="size-3.5 shrink-0" />
        )}
        {hasChildren && expanded ? (
          <FolderOpen className="size-4 shrink-0 text-[#0052FF]" />
        ) : (
          <Folder className="size-4 shrink-0 text-[#0052FF]" />
        )}
        <span className="min-w-0 flex-1 break-words">{node.name}</span>
        {!hasChildren && (
          <span
            className={cn(
              "flex size-4 shrink-0 items-center justify-center rounded-full border",
              selected
                ? "border-[#0052FF] bg-[#0052FF] text-white"
                : "border-[#94A3B8]"
            )}
          >
            {selected && <Check className="size-2.5" />}
          </span>
        )}
      </button>
      {hasChildren && expanded && (
        <div className="space-y-1">
          {node.children.map((child) => (
            <ClassificationTreeNode
              key={`${pathKey}/${child.id}`}
              node={child}
              path={currentPath}
              selectedIds={selectedIds}
              expandedPathKeys={expandedPathKeys}
              forceExpanded={forceExpanded}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ClassificationPathSummary({
  label,
  path,
  muted = false,
}: {
  label: string
  path: string[]
  muted?: boolean
}) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-3">
      <p className="text-xs font-semibold tracking-wide text-[#64748B] uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 text-sm leading-5",
          muted ? "text-[#64748B]" : "font-medium text-[#0F172A]"
        )}
      >
        {path.length > 0 ? path.join(" → ") : "Chưa chọn nhóm cấp thấp nhất"}
      </p>
    </div>
  )
}

function findPathByIds(tree: FolderNode[], ids: string[]): FolderNode[] {
  if (ids.length === 0) return []
  let siblings = tree
  const path: FolderNode[] = []
  for (const id of ids) {
    const node = siblings.find((candidate) => candidate.id === id)
    if (!node) return []
    path.push(node)
    siblings = node.children
  }
  return path
}

function ancestorPathKeys(path: FolderNode[]): Set<string> {
  const result = new Set<string>()
  for (let index = 1; index < path.length; index += 1) {
    result.add(classificationPathKey(path.slice(0, index)))
  }
  return result
}

function classificationPathKey(path: FolderNode[]): string {
  return path.map((node) => node.id).join("\u001f")
}

function filterClassificationTree(
  tree: FolderNode[],
  query: string
): FolderNode[] {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return tree
  return tree.flatMap((node) => {
    const nameMatches = normalizeSearchText(node.name).includes(normalizedQuery)
    const children = nameMatches
      ? node.children
      : filterClassificationTree(node.children, query)
    return nameMatches || children.length > 0 ? [{ ...node, children }] : []
  })
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function sameStringArray(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
}
