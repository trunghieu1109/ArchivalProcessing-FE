import { useState } from "react"
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { cn } from "@/shared/lib/utils"
import type { FolderNode } from "@/features/upload/types"

let _idCounter = 100
function newId() {
  return String(++_idCounter)
}

interface FolderNodeItemProps {
  node: FolderNode
  depth: number
  onAdd: (parentId: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}

function FolderNodeItem({
  node,
  depth,
  onAdd,
  onRename,
  onDelete,
}: FolderNodeItemProps) {
  const [open, setOpen] = useState(true)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(node.name)

  const commitRename = () => {
    if (draft.trim()) onRename(node.id, draft.trim())
    setEditing(false)
  }

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-[#F1F5F9]"
        )}
        style={{ paddingLeft: `${8 + depth * 20}px` }}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 text-[#64748B] transition-transform duration-200"
        >
          {node.children.length > 0 ? (
            open ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )
          ) : (
            <span className="size-3.5" />
          )}
        </button>

        {open && node.children.length > 0 ? (
          <FolderOpen className="size-4 shrink-0 text-[#0052FF]" />
        ) : (
          <Folder className="size-4 shrink-0 text-[#0052FF]" />
        )}

        {editing ? (
          <div className="flex flex-1 items-center gap-1">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename()
                if (e.key === "Escape") setEditing(false)
              }}
              className="flex-1 rounded border border-[#0052FF]/40 bg-white px-2 py-0.5 text-xs text-[#0F172A] outline-none focus:ring-1 focus:ring-[#0052FF]/30"
            />
            <button
              onClick={commitRename}
              className="text-[#0052FF] hover:text-[#0052FF]/70"
            >
              <Check className="size-3.5" />
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-[#64748B] hover:text-[#0F172A]"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <span className="flex-1 truncate text-sm text-[#0F172A]">
            {node.name}
          </span>
        )}

        {!editing && (
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={() => onAdd(node.id)}
              title="Thêm thư mục con"
              className="rounded p-1 text-[#64748B] hover:bg-[#E2E8F0] hover:text-[#0052FF]"
            >
              <Plus className="size-3" />
            </button>
            <button
              onClick={() => {
                setDraft(node.name)
                setEditing(true)
              }}
              title="Đổi tên"
              className="rounded p-1 text-[#64748B] hover:bg-[#E2E8F0] hover:text-[#0052FF]"
            >
              <Edit2 className="size-3" />
            </button>
            {depth > 0 && (
              <button
                onClick={() => onDelete(node.id)}
                title="Xóa"
                className="rounded p-1 text-[#64748B] hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 className="size-3" />
              </button>
            )}
          </div>
        )}
      </div>

      <AnimatePresence initial={false}>
        {open && node.children.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {node.children.map((child) => (
              <FolderNodeItem
                key={child.id}
                node={child}
                depth={depth + 1}
                onAdd={onAdd}
                onRename={onRename}
                onDelete={onDelete}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function addNode(
  nodes: FolderNode[],
  parentId: string,
  newNode: FolderNode
): FolderNode[] {
  return nodes.map((n) => {
    if (n.id === parentId) return { ...n, children: [...n.children, newNode] }
    return { ...n, children: addNode(n.children, parentId, newNode) }
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

function deleteNode(nodes: FolderNode[], id: string): FolderNode[] {
  return nodes
    .filter((n) => n.id !== id)
    .map((n) => ({ ...n, children: deleteNode(n.children, id) }))
}

interface FolderTreeProps {
  tree: FolderNode[]
  onChange: (tree: FolderNode[]) => void
  onConfirm: () => void
}

export function FolderTree({ tree, onChange, onConfirm }: FolderTreeProps) {
  const handleAdd = (parentId: string) => {
    const newNode: FolderNode = {
      id: newId(),
      name: "Thư mục mới",
      children: [],
    }
    onChange(addNode(tree, parentId, newNode))
  }

  const handleRename = (id: string, name: string) => {
    onChange(renameNode(tree, id, name))
  }

  const handleDelete = (id: string) => {
    onChange(deleteNode(tree, id))
  }

  const handleAddRoot = () => {
    const newNode: FolderNode = {
      id: newId(),
      name: "Thư mục mới",
      children: [],
    }
    onChange([...tree, newNode])
  }

  const handleConfirm = () => {
    if (tree.length === 0) {
      toast.error("Vui lòng thêm ít nhất một thư mục trước khi xác nhận.")
      return
    }
    toast.success("Cấu trúc phông đã được xác nhận!")
    onConfirm()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-[#0052FF]/30 bg-[#0052FF]/5 px-3 py-1">
            <span className="size-1.5 rounded-full bg-[#0052FF]" />
            <span className="font-mono text-[11px] tracking-[0.15em] text-[#0052FF] uppercase">
              Bước 2 / 4
            </span>
          </div>
          <h2
            className="text-2xl text-[#0F172A]"
            style={{ fontFamily: "'Calistoga', Georgia, serif" }}
          >
            Cấu trúc phông lưu trữ
          </h2>
          <p className="mt-1 text-sm text-[#64748B]">
            Xem lại và chỉnh sửa cấu trúc thư mục được trích xuất từ tài liệu
            phông.
          </p>
        </div>
        <button
          onClick={handleAddRoot}
          className="flex items-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-medium text-[#0F172A] transition-all hover:border-[#0052FF]/30 hover:bg-[#0052FF]/5 hover:text-[#0052FF]"
        >
          <Plus className="size-4" /> Thêm thư mục gốc
        </button>
      </div>

      {/* Tree */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
        {tree.map((node) => (
          <FolderNodeItem
            key={node.id}
            node={node}
            depth={0}
            onAdd={handleAdd}
            onRename={handleRename}
            onDelete={handleDelete}
          />
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleConfirm}
          className="flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
          style={{
            background: "linear-gradient(to right, #0052FF, #4D7CFF)",
            boxShadow: "0 4px 14px rgba(0,82,255,0.25)",
          }}
        >
          <Check className="size-4" /> Xác nhận cấu trúc
        </button>
      </div>
    </motion.div>
  )
}
