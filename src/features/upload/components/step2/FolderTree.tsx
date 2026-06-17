import { useEffect, useState } from "react"
import {
  Archive,
  Check,
  ChevronDown,
  ChevronRight,
  Edit2,
  Files,
  FileText,
  Folder,
  FolderKanban,
  FolderOpen,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/shared/lib/utils"
import type { DossierBuildStrategy } from "@/features/upload/api/sessionApi"
import type { DocumentNumberingMode } from "@/features/upload/api/sessionApi"
import type {
  FolderNode,
  FileRegisterConfig,
  FileRegisterTimeGranularity,
  ParsedPlan,
  PlanCriterionSet,
  PlanLeafCandidate,
} from "@/features/upload/types"

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

function PlanSummary({
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
  const isLeaf = node.children.length === 0
  const candidates = isLeaf
    ? (node.candidates ?? []).filter((candidate) => candidate.title.trim())
    : []
  const hasCandidates = candidates.length > 0

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

interface LeafCandidateListProps {
  candidates: PlanLeafCandidate[]
  marginLeft: number
}

function LeafCandidateList({ candidates, marginLeft }: LeafCandidateListProps) {
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
        {candidates.map((candidate, index) => (
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

function addNode(
  nodes: FolderNode[],
  parentId: string,
  newNode: FolderNode
): FolderNode[] {
  return nodes.map((node) => {
    if (node.id === parentId)
      return { ...node, children: [...node.children, newNode] }
    return { ...node, children: addNode(node.children, parentId, newNode) }
  })
}

function renameNode(
  nodes: FolderNode[],
  id: string,
  name: string
): FolderNode[] {
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
    return {
      ...node,
      children: updateDefinition(node.children, id, definition),
    }
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
  dossierBuildStrategy: DossierBuildStrategy
  onDossierBuildStrategyChange: (strategy: DossierBuildStrategy) => void
  documentNumberingMode: DocumentNumberingMode
  onDocumentNumberingModeChange: (
    mode: DocumentNumberingMode
  ) => void | Promise<void>
  onFileRegisterConfigChange: (
    config: FileRegisterConfig
  ) => void | Promise<void>
  onChange: (tree: FolderNode[]) => void
  onSaveTree?: (tree: FolderNode[]) => void | Promise<void>
  onCriteriaChange: (criterias: PlanCriterionSet[]) => void | Promise<void>
  onConfirm: () => void | Promise<void>
  confirming?: boolean
}

export function FolderTree({
  tree,
  parsedPlan,
  readOnly = false,
  dossierBuildStrategy,
  onDossierBuildStrategyChange,
  documentNumberingMode,
  onDocumentNumberingModeChange,
  onFileRegisterConfigChange,
  onChange,
  onSaveTree,
  onCriteriaChange,
  onConfirm,
  confirming = false,
}: FolderTreeProps) {
  const fileRegisterConfig = parsedPlan.file_register_config
  const groupByDocumentType =
    fileRegisterConfig.steps[0]?.criterion === "document_type"
  const timeGranularity =
    fileRegisterConfig.steps.find((step) => step.criterion === "issued_date")
      ?.granularity ?? "year"
  const analysisStatusLabel =
    fileRegisterConfig.analysis_status === "detected"
      ? "Đã nhận diện"
      : fileRegisterConfig.analysis_status === "ambiguous"
        ? "Cần rà soát"
        : "Mặc định"

  const updateFileRegisterConfig = (
    patch: Partial<{
      groupByDocumentType: boolean
      timeGranularity: FileRegisterTimeGranularity
      mergeSmallDossiers: boolean
    }>
  ) => {
    const nextGroupByDocumentType =
      patch.groupByDocumentType ?? groupByDocumentType
    const nextGranularity = patch.timeGranularity ?? timeGranularity
    void onFileRegisterConfigChange({
      ...fileRegisterConfig,
      steps: nextGroupByDocumentType
        ? [
            { criterion: "document_type" },
            { criterion: "issued_date", granularity: nextGranularity },
          ]
        : [{ criterion: "issued_date", granularity: nextGranularity }],
      merge_small_dossiers:
        patch.mergeSmallDossiers ?? fileRegisterConfig.merge_small_dossiers,
    })
  }

  const handleAdd = (parentId: string) => {
    const newNode: FolderNode = {
      id: newId(),
      name: "Thư mục mới",
      definition: "",
      candidates: [],
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
      candidates: [],
      children: [],
      criteria: [],
    }
    onChange([...tree, newNode])
  }

  const handleConfirm = () => {
    if (confirming) return
    if (tree.length === 0) {
      toast.error("Vui lòng thêm ít nhất một thư mục.")
      return
    }
    void onConfirm()
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
        <p className="mt-0.5 text-sm font-semibold text-[#0052FF] uppercase">
          {parsedPlan.fonds_name}
        </p>
        <p className="mt-1 text-sm text-[#475569]">
          Xem lại tiêu chí phân loại, chỉnh sửa nếu cần rồi áp dụng lại trước
          khi xác nhận.
        </p>
      </div>

      <PlanSummary
        plan={parsedPlan}
        readOnly={readOnly}
        onCriteriaChange={onCriteriaChange}
      />

      <section
        className="rounded-2xl border border-[#D8E1EC] bg-white px-5 py-5 shadow-sm"
        aria-labelledby="dossier-build-strategy-title"
      >
        <div>
          <p
            id="dossier-build-strategy-title"
            className="text-sm font-semibold text-[#0F172A]"
          >
            Cách thức lập hồ sơ
          </p>
          <p className="mt-1 text-sm text-[#64748B]">
            Lựa chọn này sẽ quyết định cách hệ thống gom nhóm tài liệu khi lập
            hồ sơ.
          </p>
        </div>
        <div
          className="mt-4 grid gap-3 md:grid-cols-2"
          role="radiogroup"
          aria-label="Cách thức lập hồ sơ"
        >
          <button
            type="button"
            role="radio"
            aria-checked={dossierBuildStrategy === "incremental"}
            disabled={readOnly}
            onClick={() => onDossierBuildStrategyChange("incremental")}
            className={cn(
              "flex min-h-32 items-start gap-4 rounded-2xl border p-4 text-left transition-all focus-visible:ring-2 focus-visible:ring-[#0052FF] focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60",
              dossierBuildStrategy === "incremental"
                ? "border-[#0052FF] bg-[#EEF4FF] shadow-[0_8px_24px_rgba(0,82,255,0.10)]"
                : "border-[#D8E1EC] bg-white hover:border-[#0052FF]/40 hover:bg-[#F8FAFC]"
            )}
          >
            <span
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-xl",
                dossierBuildStrategy === "incremental"
                  ? "bg-[#0052FF] text-white"
                  : "bg-[#EEF2F7] text-[#475569]"
              )}
            >
              <FolderKanban className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-[#0F172A]">
                  Lập hồ sơ theo vụ việc
                </span>
                <span className="rounded-full bg-[#DBEAFE] px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#1D4ED8] uppercase">
                  Mặc định
                </span>
              </span>
              <span className="mt-1.5 block text-sm leading-6 text-[#64748B]">
                Gom tài liệu theo chủ đề, nội dung và vụ việc bằng incremental
                clustering.
              </span>
            </span>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={dossierBuildStrategy === "file_register"}
            disabled={readOnly}
            onClick={() => onDossierBuildStrategyChange("file_register")}
            className={cn(
              "flex min-h-32 items-start gap-4 rounded-2xl border p-4 text-left transition-all focus-visible:ring-2 focus-visible:ring-[#0052FF] focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60",
              dossierBuildStrategy === "file_register"
                ? "border-[#0052FF] bg-[#EEF4FF] shadow-[0_8px_24px_rgba(0,82,255,0.10)]"
                : "border-[#D8E1EC] bg-white hover:border-[#0052FF]/40 hover:bg-[#F8FAFC]"
            )}
          >
            <span
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-xl",
                dossierBuildStrategy === "file_register"
                  ? "bg-[#0052FF] text-white"
                  : "bg-[#EEF2F7] text-[#475569]"
              )}
            >
              <Archive className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="font-semibold text-[#0F172A]">
                Lập hồ sơ theo dạng tập lưu
              </span>
              <span className="mt-1.5 block text-sm leading-6 text-[#64748B]">
                Gom theo loại văn bản, năm ban hành, sắp xếp theo thời gian và
                chia thành các tập hồ sơ.
              </span>
            </span>
          </button>
        </div>

        {dossierBuildStrategy === "file_register" && (
          <div className="mt-4 overflow-hidden rounded-2xl border border-[#BFD3FF] bg-[#F8FAFF]">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#DCE7FF] px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-[#0F172A]">
                    Cấu hình tập lưu
                  </p>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      fileRegisterConfig.analysis_status === "detected"
                        ? "bg-[#DCFCE7] text-[#15803D]"
                        : fileRegisterConfig.analysis_status === "ambiguous"
                          ? "bg-[#FEF3C7] text-[#A16207]"
                          : "bg-[#E2E8F0] text-[#475569]"
                    )}
                  >
                    {analysisStatusLabel}
                  </span>
                </div>
                <p className="mt-1 line-clamp-1 text-xs text-[#64748B]">
                  {fileRegisterConfig.summary ||
                    "Không tìm thấy quy tắc rõ ràng, đang áp dụng cấu hình mặc định."}
                </p>
              </div>
            </div>

            <div className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(260px,1.6fr)_minmax(140px,0.7fr)_auto] md:items-end">
              <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-[#475569]">
                Thứ tự phân chia
                <select
                  value={groupByDocumentType ? "document_type" : "issued_date"}
                  disabled={readOnly}
                  onChange={(event) =>
                    updateFileRegisterConfig({
                      groupByDocumentType:
                        event.target.value === "document_type",
                    })
                  }
                  className="h-9 min-w-0 rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm font-medium text-[#0F172A] transition-colors outline-none focus:border-[#0052FF]"
                >
                  <option value="document_type">
                    Loại văn bản → thời gian
                  </option>
                  <option value="issued_date">Chỉ theo thời gian</option>
                </select>
              </label>

              <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-[#475569]">
                Chu kỳ
                <select
                  value={timeGranularity}
                  disabled={readOnly}
                  onChange={(event) =>
                    updateFileRegisterConfig({
                      timeGranularity: event.target
                        .value as FileRegisterTimeGranularity,
                    })
                  }
                  className="h-9 min-w-0 rounded-lg border border-[#CBD5E1] bg-white px-3 text-sm font-medium text-[#0F172A] transition-colors outline-none focus:border-[#0052FF]"
                >
                  <option value="year">Năm</option>
                  <option value="quarter">Quý</option>
                  <option value="month">Tháng</option>
                </select>
              </label>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-[#475569]">
                  Gộp hồ sơ nhỏ
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={fileRegisterConfig.merge_small_dossiers}
                  aria-label="Gộp các hồ sơ nhỏ liên tiếp"
                  onClick={() =>
                    updateFileRegisterConfig({
                      mergeSmallDossiers:
                        !fileRegisterConfig.merge_small_dossiers,
                    })
                  }
                  className={cn(
                    "flex h-9 w-12 items-center justify-center rounded-lg border transition-colors",
                    fileRegisterConfig.merge_small_dossiers
                      ? "border-[#AFC7FF] bg-[#EEF4FF] text-[#0052FF]"
                      : "border-[#CBD5E1] bg-white text-[#64748B]"
                  )}
                  disabled={readOnly}
                >
                  <span
                    className={cn(
                      "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                      fileRegisterConfig.merge_small_dossiers
                        ? "bg-[#0052FF]"
                        : "bg-[#CBD5E1]"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-sm transition-transform",
                        fileRegisterConfig.merge_small_dossiers
                          ? "translate-x-4"
                          : "translate-x-0"
                      )}
                    />
                  </span>
                  <span className="sr-only">
                    {fileRegisterConfig.merge_small_dossiers ? "Bật" : "Tắt"}
                  </span>
                </button>
              </div>
            </div>

            {fileRegisterConfig.evidence.length > 0 && (
              <details className="group border-t border-[#DCE7FF] bg-white/50 px-4 py-2.5">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold text-[#475569]">
                  <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
                  Xem căn cứ phân tích ({fileRegisterConfig.evidence.length})
                </summary>
                <ul className="mt-2 space-y-1 pl-5 text-xs leading-5 text-[#64748B]">
                  {fileRegisterConfig.evidence.map((evidence, index) => (
                    <li key={`${evidence}-${index}`} className="list-disc">
                      {evidence}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </section>

      <section
        className="rounded-2xl border border-[#D8E1EC] bg-white px-5 py-5 shadow-sm"
        aria-labelledby="document-numbering-mode-title"
      >
        <div>
          <p
            id="document-numbering-mode-title"
            className="text-sm font-semibold text-[#0F172A]"
          >
            Cách xử lý trang PDF
          </p>
          <p className="mt-1 text-sm text-[#64748B]">
            Lựa chọn này quyết định bản PDF được dùng cho OCR và trích xuất
            metadata.
          </p>
        </div>
        <div
          className="mt-4 grid gap-3 md:grid-cols-2"
          role="radiogroup"
          aria-label="Cách xử lý trang PDF"
        >
          <button
            type="button"
            role="radio"
            aria-checked={documentNumberingMode === "page"}
            disabled={readOnly}
            onClick={() => void onDocumentNumberingModeChange("page")}
            className={cn(
              "flex min-h-28 items-start gap-4 rounded-2xl border p-4 text-left transition-all focus-visible:ring-2 focus-visible:ring-[#0052FF] focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60",
              documentNumberingMode === "page"
                ? "border-[#0052FF] bg-[#EEF4FF] shadow-[0_8px_24px_rgba(0,82,255,0.10)]"
                : "border-[#D8E1EC] bg-white hover:border-[#0052FF]/40 hover:bg-[#F8FAFC]"
            )}
          >
            <span
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-xl",
                documentNumberingMode === "page"
                  ? "bg-[#0052FF] text-white"
                  : "bg-[#EEF2F7] text-[#475569]"
              )}
            >
              <FileText className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-[#0F172A]">
                  Đánh số theo trang
                </span>
                <span className="rounded-full bg-[#DBEAFE] px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#1D4ED8] uppercase">
                  Mặc định
                </span>
              </span>
              <span className="mt-1.5 block text-sm leading-6 text-[#64748B]">
                OCR và metadata chạy trên PDF gốc sau khi extract từ ZIP.
              </span>
            </span>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={documentNumberingMode === "sheet"}
            disabled={readOnly}
            onClick={() => void onDocumentNumberingModeChange("sheet")}
            className={cn(
              "flex min-h-28 items-start gap-4 rounded-2xl border p-4 text-left transition-all focus-visible:ring-2 focus-visible:ring-[#0052FF] focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60",
              documentNumberingMode === "sheet"
                ? "border-[#0052FF] bg-[#EEF4FF] shadow-[0_8px_24px_rgba(0,82,255,0.10)]"
                : "border-[#D8E1EC] bg-white hover:border-[#0052FF]/40 hover:bg-[#F8FAFC]"
            )}
          >
            <span
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-xl",
                documentNumberingMode === "sheet"
                  ? "bg-[#0052FF] text-white"
                  : "bg-[#EEF2F7] text-[#475569]"
              )}
            >
              <Files className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="font-semibold text-[#0F172A]">
                Đánh số theo số tờ
              </span>
              <span className="mt-1.5 block text-sm leading-6 text-[#64748B]">
                Hệ thống scan trang trắng, tạo bản PDF đã bỏ trang trắng rồi
                dùng bản đó cho OCR và metadata.
              </span>
            </span>
          </button>
        </div>
      </section>

      <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-[#0F172A]">Cấu trúc thư mục</p>
        {!readOnly && (
          <button
            onClick={handleAddRoot}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A] shadow-sm transition-all hover:border-[#0052FF]/30 hover:text-[#0052FF]"
          >
            <Plus className="size-3.5" /> Thêm thư mục
          </button>
        )}
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
          disabled={confirming}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 sm:w-auto"
          style={{
            background: "linear-gradient(to right, #0052FF, #4D7CFF)",
            boxShadow: "0 4px 14px rgba(0,82,255,0.25)",
          }}
        >
          <Check className="size-4" />{" "}
          {readOnly ? "Tiếp tục" : "Xác nhận phương án"}
        </button>
      </div>
    </motion.div>
  )
}
