import { useState } from "react"
import {
  ChevronRight, ChevronDown, Folder, FolderOpen,
  Plus, Trash2, Edit2, Check, X, RefreshCw, Loader2,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import type { FolderNode, ParsedPlan } from "@/features/upload/types"

let _idCounter = 100
function newId() {
  return String(++_idCounter)
}

const MAX_DEPTH = 2
const DEPTH_LABELS = ["Lớn", "Vừa", "Nhỏ"]

// ─── Criteria editor (level-2 definitions from parsed plan) ──────────────────

interface CriteriaEditorProps {
  plan: ParsedPlan
  onChange: (plan: ParsedPlan) => void
  onReapply: (plan: ParsedPlan) => void
  onLoadingChange: (loading: boolean) => void
}

function CriteriaEditor({ plan, onReapply, onLoadingChange }: CriteriaEditorProps) {
  const [largeRule, setLargeRule] = useState(
    "Chia tài liệu theo năm, mỗi năm là một nhóm lớn."
  )
  const [mediumRule, setMediumRule] = useState(
    "Chia tài liệu trong mỗi năm theo các mặt hoạt động (hoặc lĩnh vực) của phòng."
  )
  const [loading, setLoading] = useState(false)

  const setLoadingState = (v: boolean) => { setLoading(v); onLoadingChange(v) }

  const handleReapply = async () => {
    setLoadingState(true)
    await new Promise((r) => setTimeout(r, 3000))
    setLoadingState(false)
    toast.success("Đã áp dụng lại tiêu chí phân loại!")
    onReapply(plan)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Plan summary */}
      <div className="rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-4 py-3">
        <p className="mb-1 text-[11px] font-semibold tracking-wider text-[#64748B] uppercase">
          Tóm tắt phương án
        </p>
        <p className="text-sm text-[#0F172A]">{plan.summary}</p>
      </div>

      {/* Two grouping rules */}
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold tracking-wider text-[#64748B] uppercase">
          Tiêu chí phân nhóm
        </p>

        {/* Nhóm lớn */}
        <div className="rounded-xl border border-[#CBD5E1] bg-white p-4">
          <div className="mb-2 flex items-center gap-2">
            <div
              className="flex size-6 shrink-0 items-center justify-center rounded-md"
              style={{
                background: "linear-gradient(135deg, #0052FF, #4D7CFF)",
              }}
            >
              <span className="text-[10px] font-bold text-white">L</span>
            </div>
            <span className="text-sm font-semibold text-[#0F172A]">
              Nhóm lớn
            </span>
          </div>
          <textarea
            value={largeRule}
            onChange={(e) => setLargeRule(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#0052FF]/50 focus:ring-1 focus:ring-[#0052FF]/20"
          />
        </div>

        {/* Nhóm vừa */}
        <div className="rounded-xl border border-[#CBD5E1] bg-white p-4">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-emerald-500">
              <span className="text-[10px] font-bold text-white">V</span>
            </div>
            <span className="text-sm font-semibold text-[#0F172A]">
              Nhóm vừa
            </span>
          </div>
          <textarea
            value={mediumRule}
            onChange={(e) => setMediumRule(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0F172A] outline-none focus:border-[#0052FF]/50 focus:ring-1 focus:ring-[#0052FF]/20"
          />
        </div>
      </div>

      <Button
        variant="outline"
        onClick={handleReapply}
        disabled={loading}
        className="self-end"
      >
        {loading
          ? <Loader2 data-icon="inline-start" className="animate-spin" />
          : <RefreshCw data-icon="inline-start" />}
        {loading ? "Đang áp dụng…" : "Áp dụng lại"}
      </Button>
    </div>
  )
}

// ─── Folder node item ─────────────────────────────────────────────────────────

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
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(node.name)
  const canAddChild = depth < MAX_DEPTH

  const commitRename = () => {
    if (draft.trim()) onRename(node.id, draft.trim())
    setEditing(false)
  }

  return (
    <div>
      <div
        className="group flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-[#F1F5F9]"
        style={{ paddingLeft: `${8 + depth * 20}px` }}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 text-[#64748B]"
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
              className="flex-1 rounded border border-[#0052FF]/40 bg-white px-2 py-0.5 text-xs text-[#0F172A] outline-none"
            />
            <button onClick={commitRename} className="text-[#0052FF]">
              <Check className="size-3.5" />
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-[#64748B]"
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
            {canAddChild && (
              <button
                onClick={() => onAdd(node.id)}
                title={`Thêm thư mục ${DEPTH_LABELS[depth + 1]}`}
                className="rounded p-1 text-[#64748B] hover:bg-[#E2E8F0] hover:text-[#0052FF]"
              >
                <Plus className="size-3" />
              </button>
            )}
            <button
              onClick={() => {
                setDraft(node.name)
                setEditing(true)
              }}
              className="rounded p-1 text-[#64748B] hover:bg-[#E2E8F0] hover:text-[#0052FF]"
            >
              <Edit2 className="size-3" />
            </button>
            {depth > 0 && (
              <button
                onClick={() => onDelete(node.id)}
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

// ─── Tree helpers ─────────────────────────────────────────────────────────────

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

// ─── Main component ───────────────────────────────────────────────────────────

interface FolderTreeProps {
  tree: FolderNode[]
  parsedPlan: ParsedPlan
  onChange: (tree: FolderNode[]) => void
  onReapply: (plan: ParsedPlan) => void
  onConfirm: () => void
}

export function FolderTree({
  tree,
  parsedPlan,
  onChange,
  onReapply,
  onConfirm,
}: FolderTreeProps) {
  const [plan, setPlan] = useState<ParsedPlan>(parsedPlan)
  const [treeLoading, setTreeLoading] = useState(false)

  const handleAdd = (parentId: string) => {
    const newNode: FolderNode = {
      id: newId(),
      name: "Thư mục mới",
      children: [],
      criteria: [],
    }
    onChange(addNode(tree, parentId, newNode))
  }

  const handleAddRoot = () => {
    const newNode: FolderNode = {
      id: newId(),
      name: "Thư mục mới",
      children: [],
      criteria: [],
    }
    onChange([...tree, newNode])
  }

  const handleRename = (id: string, name: string) =>
    onChange(renameNode(tree, id, name))
  const handleDelete = (id: string) => onChange(deleteNode(tree, id))

  const handleConfirm = () => {
    if (tree.length === 0) {
      toast.error("Vui lòng thêm ít nhất một thư mục.")
      return
    }
    toast.success("Phương án chỉnh lý đã được xác nhận!")
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
      <div>
        <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-[#0052FF]/30 bg-[#0052FF]/5 px-3 py-1">
          <span className="size-1.5 rounded-full bg-[#0052FF]" />
          <span className="font-roboto text-[11px] tracking-[0.15em] text-[#0052FF] uppercase">
            Bước 2 / 4
          </span>
        </div>
        <h2
          className="text-2xl text-[#0F172A]"
          style={{ fontFamily: "'Calistoga', Georgia, serif" }}
        >
          Phương án chỉnh lý
        </h2>
        <p className="mt-0.5 text-sm font-semibold text-[#0052FF]">
          {plan.fonds_name}
        </p>
        <p className="mt-1 text-sm text-[#475569]">
          Xem lại tiêu chí phân loại, chỉnh sửa nếu cần rồi áp dụng lại trước
          khi xác nhận.
        </p>
      </div>

      {/* Criteria editor */}
      <CriteriaEditor
        plan={plan}
        onChange={setPlan}
        onLoadingChange={setTreeLoading}
        onReapply={(updated) => {
          setPlan(updated)
          onReapply(updated)
        }}
      />

      {/* Folder tree */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[#0F172A]">Cấu trúc thư mục</p>
        <button
          onClick={handleAddRoot}
          className="flex items-center gap-1.5 rounded-xl border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-medium text-[#0F172A] shadow-sm transition-all hover:border-[#0052FF]/30 hover:text-[#0052FF]"
        >
          <Plus className="size-3.5" /> Thêm thư mục
        </button>
      </div>

      <AnimatePresence mode="wait">
        {treeLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex h-32 items-center justify-center rounded-2xl border border-[#CBD5E1] bg-white shadow-sm"
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary" />
              Đang tạo lại cấu trúc thư mục…
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="tree"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="rounded-2xl border border-[#CBD5E1] bg-white shadow-sm"
          >
            <ScrollArea className="h-[480px] p-3">
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
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-end">
        <button
          onClick={handleConfirm}
          className="flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
          style={{
            background: "linear-gradient(to right, #0052FF, #4D7CFF)",
            boxShadow: "0 4px 14px rgba(0,82,255,0.25)",
          }}
        >
          <Check className="size-4" /> Xác nhận phương án
        </button>
      </div>
    </motion.div>
  )
}
