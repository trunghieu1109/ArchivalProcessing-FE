import { useEffect, useState } from "react"
import {
  Check,
  ChevronDown,
  ChevronRight,
  Edit2,
  FileText,
  Folder,
  FolderOpen,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { FolderNode, ParsedPlan, PlanCriterionSet } from "@/features/upload/types"

let _idCounter = 100
function newId() {
  return String(++_idCounter)
}

const MAX_DEPTH = 2
const DEPTH_LABELS = ["lớn", "vừa", "nhỏ"]

interface CriteriaDraft {
  id: string
  groupLevel: string
  criteriaText: string
}

interface PlanSummaryProps {
  plan: ParsedPlan
  readOnly?: boolean
  onCriteriaChange: (criterias: PlanCriterionSet[]) => void | Promise<void>
}

function PlanSummary({ plan, readOnly = false, onCriteriaChange }: PlanSummaryProps) {
  const [criteriaDrafts, setCriteriaDrafts] = useState<CriteriaDraft[]>(() =>
    planCriteriasToDrafts(plan.criterias)
  )

  useEffect(() => {
    setCriteriaDrafts(planCriteriasToDrafts(plan.criterias))
  }, [plan.criterias])

  const handleSaveCriteria = async () => {
    const next = criteriaDrafts
      .map((draft) => ({
        group_level: draft.groupLevel.trim(),
        criteria: splitCriteria(draft.criteriaText),
      }))
      .filter((item) => item.group_level || item.criteria.length > 0)
    await onCriteriaChange(next)
    toast.success("Tiêu chí phân loại đã được cập nhật.")
  }

  const handleAddCriteriaLevel = () => {
    setCriteriaDrafts((current) => [
      ...current,
      { id: newId(), groupLevel: "Nhóm mới", criteriaText: "" },
    ])
  }

  const handleResetCriteria = () => {
    setCriteriaDrafts(planCriteriasToDrafts(plan.criterias))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-4 py-3">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
          Tóm tắt phương án
        </p>
        <p className="text-sm leading-6 text-[#0F172A]">
          {plan.summary || "Chưa có tóm tắt phương án."}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
            Tiêu chí phân nhóm
          </p>
          {!readOnly && <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-3">
            <button
              onClick={handleResetCriteria}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A] shadow-sm transition-colors hover:border-[#0052FF]/40 hover:text-[#0052FF]"
            >
              <RotateCcw className="size-3.5" /> Áp dụng lại
            </button>
            <button
              onClick={handleAddCriteriaLevel}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A] shadow-sm transition-colors hover:border-[#0052FF]/40 hover:text-[#0052FF]"
            >
              <Plus className="size-3.5" /> Thêm cấp
            </button>
            <button
              onClick={handleSaveCriteria}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-[#0052FF] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#0047D6]"
            >
              <Check className="size-3.5" /> Lưu tiêu chí
            </button>
          </div>}
        </div>

        {criteriaDrafts.map((criterion, index) => (
          <div
            key={criterion.id}
            className="rounded-2xl border border-[#CBD5E1] bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex items-center gap-2">
              <span
                className="flex size-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                style={{ backgroundColor: index === 0 ? "#2563EB" : "#00B87A" }}
              >
                {criterion.groupLevel.trim().charAt(0).toUpperCase() || "N"}
              </span>
                <input
                  value={criterion.groupLevel}
                  readOnly={readOnly}
                  onChange={(event) =>
                  setCriteriaDrafts((current) =>
                    current.map((item) =>
                      item.id === criterion.id
                        ? { ...item, groupLevel: event.target.value }
                        : item
                    )
                  )
                }
                className="h-8 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1 text-sm font-bold text-[#0F172A] outline-none transition-colors focus:border-[#CBD5E1] focus:bg-[#F8FAFC]"
              />
                {!readOnly && criteriaDrafts.length > 1 && (
                <button
                  onClick={() =>
                    setCriteriaDrafts((current) =>
                      current.filter((item) => item.id !== criterion.id)
                    )
                  }
                  title="Xóa cấp tiêu chí"
                  className="rounded-lg p-1.5 text-[#64748B] hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
              <textarea
                value={criterion.criteriaText}
                readOnly={readOnly}
                onChange={(event) =>
                setCriteriaDrafts((current) =>
                  current.map((item) =>
                    item.id === criterion.id
                      ? { ...item, criteriaText: event.target.value }
                      : item
                  )
                )
              }
              rows={3}
              placeholder="Mô tả tiêu chí phân nhóm..."
                className="min-h-14 w-full resize-y rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-sm leading-6 text-[#0F172A] outline-none transition-colors focus:border-[#0052FF]/60 focus:bg-white read-only:resize-none"
              />
          </div>
        ))}
      </div>
    </div>
  )
}

interface FolderNodeItemProps {
  node: FolderNode
  depth: number
  readOnly?: boolean
  onAdd: (parentId: string) => void
  onRename: (id: string, name: string) => void
  onDefinitionChange: (id: string, definition: string) => void | Promise<void>
  onDelete: (id: string) => void
}

function FolderNodeItem({
  node,
  depth,
  readOnly = false,
  onAdd,
  onRename,
  onDefinitionChange,
  onDelete,
}: FolderNodeItemProps) {
  const [open, setOpen] = useState(depth === 0)
  const [editingName, setEditingName] = useState(false)
  const [editingDefinition, setEditingDefinition] = useState(false)
  const [nameDraft, setNameDraft] = useState(node.name)
  const [definitionDraft, setDefinitionDraft] = useState(node.definition ?? "")
  const canAddChild = depth < MAX_DEPTH
  const hasDefinition = Boolean((node.definition ?? "").trim())

  const commitRename = () => {
    if (nameDraft.trim()) onRename(node.id, nameDraft.trim())
    setEditingName(false)
  }

  const startDefinitionEdit = () => {
    if (readOnly) return
    setDefinitionDraft(node.definition ?? "")
    setEditingDefinition(true)
    setOpen(true)
  }

  const commitDefinition = async () => {
    await onDefinitionChange(node.id, definitionDraft.trim())
    setEditingDefinition(false)
    setOpen(true)
    toast.success("Định nghĩa nhóm đã được cập nhật.")
  }

  return (
    <div>
      <div
        className="group flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-[#F1F5F9]"
        style={{ paddingLeft: `${8 + depth * 20}px` }}
      >
        <button
          onClick={() => setOpen((value) => !value)}
          className="shrink-0 text-[#64748B]"
        >
          {node.children.length > 0 || hasDefinition || editingDefinition ? (
            open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />
          ) : (
            <span className="block size-3.5" />
          )}
        </button>

        {open && node.children.length > 0 ? (
          <FolderOpen className="size-4 shrink-0 text-[#0052FF]" />
        ) : (
          <Folder className="size-4 shrink-0 text-[#0052FF]" />
        )}

        {editingName ? (
          <div className="flex flex-1 items-center gap-1">
            <input
              autoFocus
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitRename()
                if (event.key === "Escape") setEditingName(false)
              }}
              className="flex-1 rounded border border-[#0052FF]/40 bg-white px-2 py-0.5 text-xs text-[#0F172A] outline-none"
            />
            <button onClick={commitRename} className="text-[#0052FF]">
              <Check className="size-3.5" />
            </button>
            <button onClick={() => setEditingName(false)} className="text-[#64748B]">
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={startDefinitionEdit}
            className="flex-1 truncate text-left text-sm text-[#0F172A]"
            title={readOnly ? "Xem định nghĩa nhóm" : "Sửa định nghĩa nhóm"}
          >
            {node.name}
          </button>
        )}

        {!readOnly && !editingName && (
          <div className="flex items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
            <button
              onClick={startDefinitionEdit}
              title="Sửa định nghĩa"
              className="rounded p-1 text-[#64748B] hover:bg-[#E2E8F0] hover:text-[#0052FF]"
            >
              <FileText className="size-3" />
            </button>
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
                setNameDraft(node.name)
                setEditingName(true)
              }}
              title="Sửa tên nhóm"
              className="rounded p-1 text-[#64748B] hover:bg-[#E2E8F0] hover:text-[#0052FF]"
            >
              <Edit2 className="size-3" />
            </button>
            {depth > 0 && (
              <button
                onClick={() => onDelete(node.id)}
                title="Xóa nhóm"
                className="rounded p-1 text-[#64748B] hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 className="size-3" />
              </button>
            )}
          </div>
        )}
      </div>

      <AnimatePresence initial={false}>
        {open && (editingDefinition || hasDefinition || node.children.length > 0) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {(editingDefinition || hasDefinition) && (
              <div
                className="mb-2 mr-2 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-3"
                style={{ marginLeft: `${28 + depth * 20}px` }}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                    Định nghĩa nhóm
                  </p>
                  {!readOnly && !editingDefinition && (
                    <button
                      onClick={startDefinitionEdit}
                      className="rounded p-1 text-[#64748B] hover:bg-[#E2E8F0] hover:text-[#0052FF]"
                    >
                      <Edit2 className="size-3" />
                    </button>
                  )}
                </div>
                {editingDefinition ? (
                  <div className="flex flex-col gap-3">
                    <textarea
                      autoFocus
                      value={definitionDraft}
                      onChange={(event) => setDefinitionDraft(event.target.value)}
                      rows={8}
                      className="min-h-44 w-full resize-y rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-sm leading-6 text-[#0F172A] outline-none focus:border-[#0052FF]/60"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingDefinition(false)}
                        className="rounded-xl border border-[#CBD5E1] bg-white px-4 py-2 text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC]"
                      >
                        Hủy
                      </button>
                      <button
                        onClick={commitDefinition}
                        className="rounded-xl bg-[#0052FF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0047D6]"
                      >
                        Lưu định nghĩa
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-6 text-[#475569]">
                    {node.definition}
                  </p>
                )}
              </div>
            )}

            {node.children.map((child) => (
              <FolderNodeItem
                key={child.id}
                node={child}
                depth={depth + 1}
                readOnly={readOnly}
                onAdd={onAdd}
                onRename={onRename}
                onDefinitionChange={onDefinitionChange}
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
  return nodes.map((node) => {
    if (node.id === parentId) return { ...node, children: [...node.children, newNode] }
    return { ...node, children: addNode(node.children, parentId, newNode) }
  })
}

function renameNode(nodes: FolderNode[], id: string, name: string): FolderNode[] {
  return nodes.map((node) => {
    if (node.id === id) return { ...node, name }
    return { ...node, children: renameNode(node.children, id, name) }
  })
}

function updateDefinition(
  nodes: FolderNode[],
  id: string,
  definition: string
): FolderNode[] {
  return nodes.map((node) => {
    if (node.id === id) return { ...node, definition }
    return { ...node, children: updateDefinition(node.children, id, definition) }
  })
}

function deleteNode(nodes: FolderNode[], id: string): FolderNode[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) => ({ ...node, children: deleteNode(node.children, id) }))
}

function planCriteriasToDrafts(criterias: PlanCriterionSet[]): CriteriaDraft[] {
  if (criterias.length === 0) {
    return [
      { id: newId(), groupLevel: "Nhóm lớn", criteriaText: "" },
      { id: newId(), groupLevel: "Nhóm vừa", criteriaText: "" },
    ]
  }
  return criterias.map((criterion) => ({
    id: newId(),
    groupLevel: criterion.group_level,
    criteriaText: criterion.criteria.join("\n"),
  }))
}

function splitCriteria(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

interface FolderTreeProps {
  tree: FolderNode[]
  parsedPlan: ParsedPlan
  readOnly?: boolean
  onChange: (tree: FolderNode[]) => void
  onSaveTree?: (tree: FolderNode[]) => void | Promise<void>
  onCriteriaChange: (criterias: PlanCriterionSet[]) => void | Promise<void>
  onConfirm: () => void
}

export function FolderTree({
  tree,
  parsedPlan,
  readOnly = false,
  onChange,
  onSaveTree,
  onCriteriaChange,
  onConfirm,
}: FolderTreeProps) {
  const handleAdd = (parentId: string) => {
    const newNode: FolderNode = {
      id: newId(),
      name: "Thư mục mới",
      definition: "",
      children: [],
      criteria: [],
    }
    onChange(addNode(tree, parentId, newNode))
  }

  const handleAddRoot = () => {
    const newNode: FolderNode = {
      id: newId(),
      name: "Thư mục mới",
      definition: "",
      children: [],
      criteria: [],
    }
    onChange([...tree, newNode])
  }


  const handleConfirm = () => {
    if (tree.length === 0) {
      toast.error("Vui lòng thêm ít nhất một thư mục.")
      return
    }
    toast.success("Phương án chỉnh lý đã được xác nhận.")
    onConfirm()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-4"
    >
      <div>
        <h2
          className="text-2xl text-[#0F172A]"
          style={{ fontFamily: "'Calistoga', Georgia, serif" }}
        >
          Phương án chỉnh lý
        </h2>
        <p className="mt-0.5 text-sm font-semibold uppercase text-[#0052FF]">
          {parsedPlan.fonds_name}
        </p>
        <p className="mt-1 text-sm text-[#475569]">
          Xem lại tiêu chí phân loại, chỉnh sửa nếu cần rồi áp dụng lại trước khi xác nhận.
        </p>
      </div>

      <PlanSummary plan={parsedPlan} readOnly={readOnly} onCriteriaChange={onCriteriaChange} />

      <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-[#0F172A]">Cấu trúc thư mục</p>
        {!readOnly && <button
          onClick={handleAddRoot}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A] shadow-sm transition-all hover:border-[#0052FF]/30 hover:text-[#0052FF]"
        >
          <Plus className="size-3.5" /> Thêm thư mục
        </button>}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key="tree"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="rounded-2xl border border-[#CBD5E1] bg-white shadow-sm"
        >
          <ScrollArea className="h-[min(68svh,520px)] min-h-[360px] p-3">
            {tree.map((node) => (
              <FolderNodeItem
                key={node.id}
                node={node}
                depth={0}
                readOnly={readOnly}
                onAdd={handleAdd}
                onRename={(id, name) => onChange(renameNode(tree, id, name))}
                onDefinitionChange={async (id, definition) => {
                  const nextTree = updateDefinition(tree, id, definition)
                  onChange(nextTree)
                  await onSaveTree?.(nextTree)
                }}
                onDelete={(id) => onChange(deleteNode(tree, id))}
              />
            ))}
          </ScrollArea>
        </motion.div>
      </AnimatePresence>


      <div className="flex justify-stretch sm:justify-end">
        <button
          onClick={handleConfirm}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] sm:w-auto"
          style={{
            background: "linear-gradient(to right, #0052FF, #4D7CFF)",
            boxShadow: "0 4px 14px rgba(0,82,255,0.25)",
          }}
        >
          <Check className="size-4" /> {readOnly ? "Tiếp tục" : "Xác nhận phương án"}
        </button>
      </div>
    </motion.div>
  )
}
