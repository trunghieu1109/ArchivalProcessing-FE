import { useState } from "react"
import {
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  GripVertical,
  Edit2,
  Check,
  X,
  Plus,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/shared/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { FolderNode } from "@/features/upload/types"

// ─── Inline name editor for depth-2 (Nhóm) nodes ────────────────────────────

interface InlineNameEditorProps {
  name: string
  onSave: (name: string) => void
}

function InlineNameEditor({ name, onSave }: InlineNameEditorProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)

  const commit = () => {
    if (draft.trim()) onSave(draft.trim())
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex flex-1 items-center gap-1">
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit()
            if (e.key === "Escape") setEditing(false)
          }}
          className="h-7 flex-1 text-sm"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={commit}
          className="size-6 p-0 text-primary"
        >
          <Check className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setEditing(false)}
          className="size-6 p-0 text-muted-foreground"
        >
          <X className="size-3.5" />
        </Button>
      </div>
    )
  }

  return (
    <div className="group/name flex min-w-0 flex-1 items-center gap-1.5">
      <span className="truncate text-sm font-medium text-foreground">
        {name}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setDraft(name)
          setEditing(true)
        }}
        className="size-5 shrink-0 p-0 opacity-0 transition-opacity group-hover/name:opacity-100"
      >
        <Edit2 className="size-3 text-muted-foreground" />
      </Button>
    </div>
  )
}

// ─── Tree helpers ─────────────────────────────────────────────────────────────

let _nodeCounter = 2000
function newNodeId() {
  return `result-${++_nodeCounter}`
}

function addChildToNode(
  nodes: FolderNode[],
  parentId: string,
  child: FolderNode
): FolderNode[] {
  return nodes.map((n) => {
    if (n.id === parentId) return { ...n, children: [...n.children, child] }
    return { ...n, children: addChildToNode(n.children, parentId, child) }
  })
}

function renameNode(
  nodes: FolderNode[],
  id: string,
  name: string
): FolderNode[] {
  return nodes.map((n) => {
    if (n.id === id) return { ...n, name }
    return { ...n, children: renameNode(n.children, id, name) }
  })
}

function updateNodeInTree(
  nodes: FolderNode[],
  id: string,
  patch: Partial<FolderNode>
): FolderNode[] {
  return nodes.map((n) => {
    if (n.id === id) return { ...n, ...patch }
    return { ...n, children: updateNodeInTree(n.children, id, patch) }
  })
}

export function countNamed(nodes: FolderNode[]): number {
  return nodes.reduce((sum, n) => {
    const self = n.hoSoName && n.soHoSo && n.thoiHanBaoQuan ? 1 : 0
    return sum + self + countNamed(n.children)
  }, 0)
}

export function countAll(nodes: FolderNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countAll(n.children), 0)
}

// ─── Folder result node ───────────────────────────────────────────────────────

interface FolderResultNodeProps {
  node: FolderNode
  files: string[]
  allFiles: Record<string, string[]>
  depth: number
  draggedFile: { path: string; fromId: string } | null
  onDragStart: (path: string, fromId: string) => void
  onDrop: (toId: string) => void
  onSaveFolder: (id: string, patch: Partial<FolderNode>) => void
  onRenameNode: (id: string, name: string) => void
  onAddChild: (parentId: string) => void
}

function FolderResultNode({
  node,
  files,
  allFiles,
  depth,
  draggedFile,
  onDragStart,
  onDrop,
  onSaveFolder,
  onRenameNode,
  onAddChild,
}: FolderResultNodeProps) {
  const [open, setOpen] = useState(depth === 0 ? false : true)
  const [dragOver, setDragOver] = useState(false)

  const isNhom = depth === 2
  const isMedium = depth === 1
  const totalFiles =
    files.length +
    node.children.reduce((s, c) => s + (allFiles[c.id] ?? []).length, 0)

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg px-2 py-1.5 transition-all",
          dragOver ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted"
        )}
        style={{ paddingLeft: `${8 + depth * 20}px` }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          onDrop(node.id)
        }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          className="size-5 shrink-0 p-0 text-muted-foreground"
        >
          {node.children.length > 0 || files.length > 0 ? (
            open ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )
          ) : (
            <span className="size-3.5" />
          )}
        </Button>

        {open ? (
          <FolderOpen className="size-4 shrink-0 text-primary" />
        ) : (
          <Folder className="size-4 shrink-0 text-primary" />
        )}

        {isNhom ? (
          <InlineNameEditor
            name={node.name}
            onSave={(name) => onRenameNode(node.id, name)}
          />
        ) : (
          <span className="flex-1 truncate text-sm font-medium text-foreground">
            {node.name}
          </span>
        )}

        {isMedium && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAddChild(node.id)}
            title="Thêm nhóm"
            className="size-6 shrink-0 p-0 opacity-0 transition-opacity group-hover:opacity-100 hover:text-primary"
          >
            <Plus className="size-3" />
          </Button>
        )}

        {totalFiles > 0 && (
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 font-roboto text-[10px] font-bold text-primary">
            {totalFiles}
          </span>
        )}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Files */}
            {files.map((filePath) => (
              <motion.div
                key={filePath}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                draggable
                onDragStart={() => onDragStart(filePath, node.id)}
                className="flex cursor-grab items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted active:cursor-grabbing"
                style={{ paddingLeft: `${8 + (depth + 1) * 20}px` }}
              >
                <GripVertical className="size-3 shrink-0 text-muted-foreground/50" />
                <div className="flex size-6 shrink-0 items-center justify-center rounded bg-primary">
                  <FileText className="size-3 text-primary-foreground" />
                </div>
                <span className="flex-1 truncate font-roboto text-xs text-muted-foreground">
                  {filePath.split("/").pop()}
                </span>
              </motion.div>
            ))}

            {/* Child folders */}
            {node.children.map((child) => (
              <FolderResultNode
                key={child.id}
                node={child}
                files={allFiles[child.id] ?? []}
                allFiles={allFiles}
                depth={depth + 1}
                draggedFile={draggedFile}
                onDragStart={onDragStart}
                onDrop={onDrop}
                onSaveFolder={onSaveFolder}
                onRenameNode={onRenameNode}
                onAddChild={onAddChild}
              />
            ))}

            {/* Add Nhóm at bottom of medium folder */}
            {isMedium && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAddChild(node.id)}
                className="flex w-full items-center justify-start gap-1.5 text-xs text-muted-foreground hover:text-primary"
                style={{ paddingLeft: `${8 + (depth + 1) * 20}px` }}
              >
                <Plus className="size-3" /> Thêm nhóm
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface FolderResultTreeProps {
  tree: FolderNode[]
  files: Record<string, string[]>
  groupLabels: Record<string, string>
  onTreeChange: (tree: FolderNode[]) => void
  onFilesChange: (files: Record<string, string[]>) => void
  onRenameGroup: (groupId: string, label: string) => void
}

export function FolderResultTree({
  tree,
  files,
  onTreeChange,
  onFilesChange,
}: FolderResultTreeProps) {
  const [draggedFile, setDraggedFile] = useState<{
    path: string
    fromId: string
  } | null>(null)

  const handleDragStart = (path: string, fromId: string) =>
    setDraggedFile({ path, fromId })

  const handleDrop = (toId: string) => {
    if (!draggedFile || draggedFile.fromId === toId) return
    onFilesChange({
      ...files,
      [draggedFile.fromId]: (files[draggedFile.fromId] ?? []).filter(
        (f) => f !== draggedFile.path
      ),
      [toId]: [...(files[toId] ?? []), draggedFile.path],
    })
    setDraggedFile(null)
  }

  const handleSaveFolder = (id: string, patch: Partial<FolderNode>) => {
    onTreeChange(updateNodeInTree(tree, id, patch))
  }

  const handleRenameNode = (id: string, name: string) => {
    onTreeChange(renameNode(tree, id, name))
  }

  const handleAddChild = (parentId: string) => {
    const newNode: FolderNode = {
      id: newNodeId(),
      name: "Nhóm mới",
      children: [],
      criteria: [],
    }
    onTreeChange(addChildToNode(tree, parentId, newNode))
  }

  return (
    <div className="rounded-2xl border bg-card shadow-sm">
      <ScrollArea className="h-[560px] p-3">
        {tree.map((node) => (
          <FolderResultNode
            key={node.id}
            node={node}
            files={files[node.id] ?? []}
            allFiles={files}
            depth={0}
            draggedFile={draggedFile}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            onSaveFolder={handleSaveFolder}
            onRenameNode={handleRenameNode}
            onAddChild={handleAddChild}
          />
        ))}
      </ScrollArea>
    </div>
  )
}
