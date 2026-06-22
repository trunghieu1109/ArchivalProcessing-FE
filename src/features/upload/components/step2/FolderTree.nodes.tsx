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
import { PaginationControls } from "@/features/upload/components/PaginationControls"
import { usePagedItems } from "@/features/upload/hooks/usePagedItems"
import type {
  FolderNode,
  ParsedPlan,
  PlanCriterionSet,
  PlanLeafCandidate,
  RetentionAppendixNode,
} from "@/features/upload/types"
import {
  DEPTH_LABELS,
  MAX_DEPTH,
  newId,
  planCriteriasToDrafts,
  splitCriteria,
  type CriteriaDraft,
} from "./FolderTree.helpers"

interface PlanSummaryProps {
  plan: ParsedPlan
  readOnly?: boolean
  onCriteriaChange: (criterias: PlanCriterionSet[]) => void | Promise<void>
}

export function PlanSummary({
  plan,
  readOnly = false,
  onCriteriaChange,
}: PlanSummaryProps) {
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
        <p className="mb-1 text-[11px] font-semibold tracking-wider text-[#64748B] uppercase">
          Tóm tắt phương án
        </p>
        <p className="text-sm leading-6 text-[#0F172A]">
          {plan.summary || "Chưa có tóm tắt phương án."}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] font-semibold tracking-wider text-[#64748B] uppercase">
            Tiêu chí phân nhóm
          </p>
          {!readOnly && (
            <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-3">
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
            </div>
          )}
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
                className="h-8 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1 text-sm font-bold text-[#0F172A] transition-colors outline-none focus:border-[#CBD5E1] focus:bg-[#F8FAFC]"
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
              className="min-h-14 w-full resize-y rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2 text-sm leading-6 text-[#0F172A] transition-colors outline-none read-only:resize-none focus:border-[#0052FF]/60 focus:bg-white"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

interface RetentionAppendicesPanelProps {
  appendices: RetentionAppendixNode[]
  hasRetentionSchedule?: boolean
}

export function RetentionAppendicesPanel({
  appendices,
  hasRetentionSchedule = true,
}: RetentionAppendicesPanelProps) {
  if (appendices.length === 0) {
    if (!hasRetentionSchedule) {
      return (
        <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-white px-4 py-4 text-sm text-[#64748B] shadow-sm">
          Chưa có thông tư về thời hạn bảo quản.
        </div>
      )
    }
    return null
  }
  const unitCount = countRetentionUnits(appendices)

  return (
    <details className="group rounded-xl border border-[#CBD5E1] bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 transition-colors outline-none hover:bg-[#F8FAFC] focus-visible:ring-2 focus-visible:ring-[#0052FF] focus-visible:ring-offset-2">
        <span className="flex min-w-0 items-center gap-2">
          <FileText className="size-4 shrink-0 text-[#0052FF]" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[#0F172A]">
              Thông tư thời hạn bảo quản
            </span>
            <span className="mt-0.5 block text-xs text-[#64748B]">
              {appendices.length} phụ lục, {unitCount} điều khoản
            </span>
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-[#64748B] transition-transform group-open:rotate-90" />
      </summary>
      <div className="max-h-[420px] overflow-auto border-t border-[#E2E8F0] px-3 py-3">
        <div className="flex flex-col gap-2">
          {appendices.map((appendix, index) => (
            <RetentionTreeNode
              key={`${appendix.type}-${appendix.name}-${index}`}
              node={appendix}
              depth={0}
            />
          ))}
        </div>
      </div>
    </details>
  )
}

interface RetentionTreeNodeProps {
  node: RetentionAppendixNode
  depth: number
}

function RetentionTreeNode({ node, depth }: RetentionTreeNodeProps) {
  const hasChildren = node.children.length > 0
  const isAppendix = depth === 0 || node.type === "appendix"
  const isUnit = !hasChildren
  const paddingLeft = 8 + depth * 18

  if (hasChildren) {
    return (
      <details className="group rounded-lg border border-[#E2E8F0] bg-[#F8FAFC]">
        <summary
          className="flex cursor-pointer list-none items-start gap-2 px-3 py-2 outline-none hover:bg-[#F1F5F9]"
          style={{ paddingLeft }}
        >
          <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-[#64748B] transition-transform group-open:rotate-90" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm leading-5 font-semibold text-[#0F172A]">
              {node.name || retentionNodeFallbackLabel(node)}
            </span>
            <span className="mt-0.5 block text-[11px] font-semibold tracking-wide text-[#64748B] uppercase">
              {isAppendix ? "Phụ lục" : "Nhóm"} · {countRetentionUnits([node])}{" "}
              điều khoản
            </span>
          </span>
        </summary>
        <div className="flex flex-col gap-1 border-t border-[#E2E8F0] py-2">
          {node.children.map((child, index) => (
            <RetentionTreeNode
              key={`${child.type}-${child.name}-${index}`}
              node={child}
              depth={depth + 1}
            />
          ))}
        </div>
      </details>
    )
  }

  return (
    <div
      className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2"
      style={{ marginLeft: paddingLeft }}
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <p className="min-w-0 text-sm leading-5 text-[#0F172A]">
          {node.name || retentionNodeFallbackLabel(node)}
        </p>
        {node.retention_period && (
          <span className="shrink-0 rounded-full bg-[#E0F2FE] px-2 py-0.5 text-xs font-semibold text-[#0369A1]">
            {node.retention_period}
          </span>
        )}
      </div>
      {node.note && (
        <p className="mt-1 text-xs leading-5 text-[#64748B]">{node.note}</p>
      )}
      {!node.retention_period && isUnit && (
        <p className="mt-1 text-xs leading-5 text-[#94A3B8]">
          Chưa có thời hạn bảo quản
        </p>
      )}
    </div>
  )
}

function countRetentionUnits(nodes: RetentionAppendixNode[]): number {
  return nodes.reduce((count, node) => {
    const ownCount = retentionNodeIsUnit(node) ? 1 : 0
    return count + ownCount + countRetentionUnits(node.children)
  }, 0)
}

function retentionNodeFallbackLabel(node: RetentionAppendixNode): string {
  if (node.type === "appendix") return "Phụ lục"
  if (node.type === "merged") return "Nhóm thời hạn bảo quản"
  return "Điều khoản"
}

function retentionNodeIsUnit(node: RetentionAppendixNode): boolean {
  const normalizedType = node.type.trim().toLowerCase()
  if (normalizedType === "unit") return true
  if (node.retention_period) return true
  if (node.children.length > 0) return false
  return !["appendix", "merged", "merge", "group"].includes(normalizedType)
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

export function FolderNodeItem({
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
  const isLeaf = node.children.length === 0
  const candidates = isLeaf
    ? (node.candidates ?? []).filter((candidate) => candidate.title.trim())
    : []
  const hasCandidates = candidates.length > 0
  const childPagination = usePagedItems(node.children, {
    defaultPageSize: 50,
    resetKey: node.id,
  })

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
          {node.children.length > 0 ||
          hasDefinition ||
          editingDefinition ||
          hasCandidates ? (
            open ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )
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
            <button
              onClick={() => setEditingName(false)}
              className="text-[#64748B]"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={startDefinitionEdit}
            className="min-w-0 flex-1 text-left text-sm leading-5 [overflow-wrap:anywhere] break-words whitespace-normal text-[#0F172A]"
            title={readOnly ? "Xem định nghĩa nhóm" : "Sửa định nghĩa nhóm"}
          >
            {node.name}
          </button>
        )}

        {hasCandidates && (
          <span className="hidden shrink-0 rounded-full border border-[#BFDBFE] bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-semibold text-[#1D4ED8] sm:inline-flex">
            {candidates.length} giá trị
          </span>
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
        {open &&
          (editingDefinition ||
            hasDefinition ||
            hasCandidates ||
            node.children.length > 0) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              {(editingDefinition || hasDefinition) && (
                <div
                  className="mr-2 mb-1.5 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2"
                  style={{ marginLeft: `${28 + depth * 20}px` }}
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold tracking-[0.12em] text-[#64748B] uppercase">
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
                    <div className="flex flex-col gap-2">
                      <textarea
                        autoFocus
                        value={definitionDraft}
                        onChange={(event) =>
                          setDefinitionDraft(event.target.value)
                        }
                        rows={4}
                        className="min-h-24 w-full resize-y rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-sm leading-5 text-[#0F172A] outline-none focus:border-[#0052FF]/60"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingDefinition(false)}
                          className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC]"
                        >
                          Hủy
                        </button>
                        <button
                          onClick={commitDefinition}
                          className="rounded-lg bg-[#0052FF] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0047D6]"
                        >
                          Lưu định nghĩa
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm leading-5 whitespace-pre-wrap text-[#475569]">
                      {node.definition}
                    </p>
                  )}
                </div>
              )}

              {hasCandidates && (
                <LeafCandidateList
                  candidates={candidates}
                  marginLeft={28 + depth * 20}
                />
              )}

              {childPagination.items.map((child) => (
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
              {node.children.length > childPagination.pageSize && (
                <div
                  className="mt-2 mr-2 mb-2"
                  style={{ marginLeft: `${28 + depth * 20}px` }}
                >
                  <PaginationControls
                    total={childPagination.total}
                    pageIndex={childPagination.pageIndex}
                    pageSize={childPagination.pageSize}
                    pageCount={childPagination.pageCount}
                    startNumber={childPagination.startNumber}
                    endNumber={childPagination.endNumber}
                    pageSizeOptions={childPagination.pageSizeOptions}
                    itemLabel="thư mục"
                    onPageChange={childPagination.setPageIndex}
                    onPageSizeChange={childPagination.setPageSize}
                  />
                </div>
              )}
            </motion.div>
          )}
      </AnimatePresence>
    </div>
  )
}

interface LeafCandidateListProps {
  candidates: PlanLeafCandidate[]
  marginLeft: number
}

function LeafCandidateList({ candidates, marginLeft }: LeafCandidateListProps) {
  const candidatePagination = usePagedItems(candidates, {
    defaultPageSize: 50,
    resetKey: candidates.map((candidate) => candidate.title).join("\u001f"),
  })

  return (
    <div
      className="mr-2 mb-2 border-l border-[#CBD5E1] py-1 pl-3"
      style={{ marginLeft: `${marginLeft}px` }}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <p className="text-[10px] font-semibold tracking-[0.12em] text-[#64748B] uppercase">
          Giá trị tiềm năng
        </p>
        <span className="rounded-full bg-[#E0F2FE] px-1.5 py-0.5 text-[10px] font-semibold text-[#0369A1]">
          {candidates.length}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {candidatePagination.items.map((candidate, index) => (
          <div
            key={`${candidate.title}-${index}`}
            className="flex items-start gap-2 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5"
            title={
              candidate.evidence ? `Nguồn: ${candidate.evidence}` : undefined
            }
          >
            <span
              className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${candidateKindClass(
                candidate.kind
              )}`}
            >
              {candidateKindLabel(candidate.kind)}
            </span>
            <p className="min-w-0 flex-1 text-xs leading-5 text-[#0F172A]">
              {candidate.title}
            </p>
          </div>
        ))}
      </div>
      {candidates.length > candidatePagination.pageSize && (
        <PaginationControls
          total={candidatePagination.total}
          pageIndex={candidatePagination.pageIndex}
          pageSize={candidatePagination.pageSize}
          pageCount={candidatePagination.pageCount}
          startNumber={candidatePagination.startNumber}
          endNumber={candidatePagination.endNumber}
          pageSizeOptions={candidatePagination.pageSizeOptions}
          itemLabel="giá trị"
          onPageChange={candidatePagination.setPageIndex}
          onPageSizeChange={candidatePagination.setPageSize}
          className="mt-2"
        />
      )}
    </div>
  )
}

function candidateKindLabel(kind?: string): string {
  const normalized = (kind ?? "").toLowerCase()
  if (
    normalized.includes("document") ||
    normalized.includes("file") ||
    normalized.includes("tài liệu") ||
    normalized.includes("van ban")
  ) {
    return "Tài liệu"
  }
  if (normalized.includes("dossier") || normalized.includes("hồ sơ")) {
    return "Hồ sơ"
  }
  return "Giá trị"
}

function candidateKindClass(kind?: string): string {
  return candidateKindLabel(kind) === "Tài liệu"
    ? "bg-[#FEF3C7] text-[#92400E]"
    : "bg-[#DCFCE7] text-[#166534]"
}
