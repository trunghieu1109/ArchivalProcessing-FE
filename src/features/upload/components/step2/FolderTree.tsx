import {
  ChevronDown,
  Files,
  FileText,
  Folder,
  FolderOpen,
  Plus,
} from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PaginationControls } from "@/features/upload/components/PaginationControls"
import { usePagedItems } from "@/features/upload/hooks/usePagedItems"
import { cn } from "@/shared/lib/utils"
import type { FolderNode } from "@/features/upload/types"
import type { DocumentNumberingStylePreset } from "@/features/upload/api/sessionApi"

import {
  FolderNodeItem,
  PlanSummary,
  RetentionAppendicesPanel,
} from "./FolderTree.nodes"
import { DossierBuildStrategySection } from "./FolderTree.strategy"
import { PlanReviewActions } from "./PlanReviewActions"
import {
  addNode,
  deleteNode,
  newId,
  renameNode,
  updateDefinition,
} from "./FolderTree.helpers"

import type { FolderTreeProps } from "./FolderTree.types"

const NUMBERING_STYLE_OPTIONS: Array<{
  value: DocumentNumberingStylePreset
  label: string
  description: string
  fontFamily: string
  fontStyle?: string
  fontWeight?: string
  fontSize: number
  color: string
  opacity?: number
}> = [
  {
    value: "pencil_miama",
    fontFamily: "Miama Nueva",
    fontStyle: "italic",
    fontWeight: "normal",
    fontSize: 14,
    color: "#757573",
    opacity: 0.75,
    label: "Bút chì Miama",
    description: "Đánh số bằng bút chì, nét viết tay mềm.",
  },
  {
    value: "pencil_bradley",
    fontFamily: "Bradley Hand ITC",
    fontStyle: "normal",
    fontWeight: "normal",
    fontSize: 14,
    color: "#767570",
    opacity: 0.75,
    label: "Bút chì Bradley",
    description: "Đánh số bằng bút chì, nét rõ và dễ nhìn hơn.",
  },
  {
    value: "stamp_times_bold",
    fontFamily: "Times New Roman",
    fontStyle: "normal",
    fontWeight: "bold",
    fontSize: 16,
    color: "#3D3D3B",
    opacity: 1,
    label: "Dập in",
    description: "Đánh số bằng kiểu dập in, chữ đậm và sắc nét.",
  },
]

export function FolderTree({
  sessionId = null,
  tree,
  parsedPlan,
  fondsName,
  readOnly = false,
  hasRetentionSchedule = true,
  showRetentionSection = true,
  showActions = true,
  dossierBuildStrategy,
  dossierTitleCatalogMappingCount = 0,
  onDossierBuildStrategyChange,
  documentNumberingMode,
  onDocumentNumberingModeChange,
  documentNumberingStylePreset,
  documentNumberingStyleOverrides = {},
  onDocumentNumberingStylePresetChange,
  onDocumentNumberingStyleOverridesChange,
  onFileRegisterConfigChange,
  onChange,
  onSaveTree,
  onCriteriaChange,
  onSaveDraft,
  onConfirm,
  onContinueToMetadata,
  savingDraft = false,
  confirming = false,
  planDraftDirty = false,
  draftDiffersActive,
}: FolderTreeProps) {
  const rootPagination = usePagedItems(tree, {
    defaultPageSize: 50,
    resetKey: fondsName || parsedPlan.fonds_name,
    storageKey: "archival-processing.folder-tree-root-page-size",
  })
  const pagedTree = rootPagination.items
  const displayFondsName = fondsName?.trim() || parsedPlan.fonds_name

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-4"
    >
      <div>
        <h2 className="font-sans text-2xl font-semibold tracking-normal text-[#0F172A]">
          Phương án chỉnh lý
        </h2>
        <p className="mt-0.5 text-sm font-semibold text-[#0052FF] uppercase">
          {displayFondsName}
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

      <DossierBuildStrategySection
        sessionId={sessionId}
        readOnly={readOnly}
        dossierBuildStrategy={dossierBuildStrategy}
        dossierTitleCatalogMappingCount={dossierTitleCatalogMappingCount}
        fileRegisterConfig={parsedPlan.file_register_config}
        onDossierBuildStrategyChange={onDossierBuildStrategyChange}
        onFileRegisterConfigChange={onFileRegisterConfigChange}
      />

      <section
        className="rounded-2xl border border-[#D8E1EC] bg-white px-5 py-5 shadow-sm"
        aria-labelledby="document-numbering-mode-title"
      >
        <div>
          <p
            id="document-numbering-mode-title"
            className="text-sm font-semibold text-[#0F172A]"
          >
            Cách đánh số tài liệu
          </p>
          <p className="mt-1 text-sm text-[#64748B]">
            OCR và metadata luôn chạy trên bản đã loại trang trắng. Bản PDF gốc
            vẫn được giữ nguyên để đánh số và xuất kết quả.
          </p>
        </div>
        <div
          className="mt-4 grid gap-3 md:grid-cols-2"
          role="radiogroup"
          aria-label="Cách đánh số tài liệu"
        >
          <button
            type="button"
            role="radio"
            aria-checked={documentNumberingMode === "page"}
            disabled={readOnly}
            onClick={() => void onDocumentNumberingModeChange("page")}
            className={cn(
              "group relative flex min-h-28 items-start gap-4 rounded-2xl border p-4 text-left transition-all focus-visible:ring-2 focus-visible:ring-[#0052FF] focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-100",
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
                Đánh số tất cả trang theo số trang của PDF gốc.
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
              "group relative flex min-h-28 items-start gap-4 rounded-2xl border p-4 text-left transition-all focus-visible:ring-2 focus-visible:ring-[#0052FF] focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-100",
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
                Đánh số trên các trang lẻ của PDF gốc và bỏ qua trang trắng.
              </span>
            </span>
          </button>
        </div>
        <div className="mt-5 border-t border-[#E2E8F0] pt-4">
          <p className="text-sm font-semibold text-[#0F172A]">
            Kiểu hiển thị số
          </p>
          <div
            className="mt-3 grid gap-3 md:grid-cols-3"
            role="radiogroup"
            aria-label="Kiểu hiển thị số trang"
          >
            {NUMBERING_STYLE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={documentNumberingStylePreset === option.value}
                disabled={readOnly}
                onClick={() =>
                  void onDocumentNumberingStylePresetChange(option.value)
                }
                className={cn(
                  "group relative flex h-full min-h-[9.25rem] flex-col justify-between rounded-2xl border p-4 text-left transition-all focus-visible:ring-2 focus-visible:ring-[#0052FF] focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-100",
                  documentNumberingStylePreset === option.value
                    ? "border-[#0052FF] bg-[#EEF4FF] shadow-[0_8px_24px_rgba(0,82,255,0.10)]"
                    : "border-[#D8E1EC] bg-white hover:border-[#0052FF]/40 hover:bg-[#F8FAFC]"
                )}
              >
                <span className="block font-semibold text-[#0F172A]">
                  {option.label}
                </span>
                <span className="mt-1.5 block text-sm leading-5 text-[#64748B]">
                  {option.description}
                </span>
                <span className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-[#64748B]">
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#D8E1EC] bg-[#F8FAFC] px-2 py-1">
                    <span
                      className="inline-block size-2.5 rounded-full border border-[#CBD5E1]"
                      style={{ backgroundColor: option.color }}
                    />
                    <span>{option.fontFamily}</span>
                  </span>
                  <span className="rounded-full border border-[#D8E1EC] bg-[#F8FAFC] px-2 py-1">
                    {option.fontSize}pt
                  </span>
                  <span className="rounded-full border border-[#D8E1EC] bg-[#F8FAFC] px-2 py-1">
                    {option.opacity !== undefined && option.opacity < 1
                      ? `${Math.round(option.opacity * 100)}%`
                      : "100%"}
                  </span>
                </span>
              </button>
            ))}
          </div>
          {/* Customization for selected style: size, color, opacity with preview */}
          {onDocumentNumberingStyleOverridesChange && (
            <div className="mt-4 border-t border-[#E2E8F0] pt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[#0F172A]">
                  Tùy chỉnh chi tiết –{" "}
                  {NUMBERING_STYLE_OPTIONS.find(
                    (o) => o.value === documentNumberingStylePreset
                  )?.label || documentNumberingStylePreset}
                </p>
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() =>
                    void onDocumentNumberingStyleOverridesChange?.({})
                  }
                  className="text-xs text-[#64748B] underline-offset-2 hover:text-[#0052FF] hover:underline disabled:cursor-not-allowed"
                >
                  Đặt lại mặc định
                </button>
              </div>

              {(() => {
                const base =
                  NUMBERING_STYLE_OPTIONS.find(
                    (o) => o.value === documentNumberingStylePreset
                  ) || NUMBERING_STYLE_OPTIONS[0]
                const effSize =
                  documentNumberingStyleOverrides?.font_size ?? base.fontSize
                const effColor =
                  documentNumberingStyleOverrides?.color ?? base.color
                const effOpacity =
                  documentNumberingStyleOverrides?.opacity ??
                  base.opacity ??
                  0.75
                const currentColor = effColor

                return (
                  <div className="mt-3 grid gap-4 md:grid-cols-3">
                    {/* Font size */}
                    <div>
                      <label className="block text-xs font-medium text-[#475569]">
                        Cỡ chữ (pt)
                      </label>
                      <input
                        type="number"
                        min={6}
                        max={48}
                        step={0.5}
                        disabled={readOnly}
                        value={effSize}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value)
                          const next = {
                            ...(documentNumberingStyleOverrides || {}),
                            font_size: isNaN(val) ? undefined : val,
                          }
                          void onDocumentNumberingStyleOverridesChange?.(next)
                        }}
                        className="mt-1 w-full rounded-lg border border-[#CBD5E1] px-3 py-1.5 text-sm focus:border-[#0052FF] disabled:cursor-not-allowed disabled:opacity-100"
                      />
                      <div className="mt-0.5 text-[10px] text-[#94A3B8]">
                        Mặc định: {base.fontSize}pt
                      </div>
                    </div>

                    {/* Color with table + picker */}
                    <div>
                      <label className="block text-xs font-medium text-[#475569]">
                        Màu sắc
                      </label>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {[
                          base.color,
                          "#757573",
                          "#767570",
                          "#3D3D3B",
                          "#000000",
                          "#333333",
                          "#1E3A5F",
                          "#4B2E2E",
                        ]
                          .filter((v, i, a) => a.indexOf(v) === i)
                          .map((c) => {
                            const isActive =
                              currentColor?.toLowerCase() === c.toLowerCase()
                            return (
                              <button
                                key={c}
                                type="button"
                                disabled={readOnly}
                                className={cn(
                                  "size-6 rounded border transition-all disabled:cursor-not-allowed disabled:opacity-100",
                                  isActive
                                    ? "border-[#0052FF] ring-2 ring-[#0052FF]/30"
                                    : "border-[#CBD5E1] hover:border-[#0052FF]/50"
                                )}
                                style={{ backgroundColor: c }}
                                title={c}
                                onClick={() => {
                                  const next = {
                                    ...(documentNumberingStyleOverrides || {}),
                                    color: c,
                                  }
                                  void onDocumentNumberingStyleOverridesChange?.(
                                    next
                                  )
                                }}
                              />
                            )
                          })}
                        <input
                          type="color"
                          disabled={readOnly}
                          value={currentColor}
                          onChange={(e) => {
                            const next = {
                              ...(documentNumberingStyleOverrides || {}),
                              color: e.target.value,
                            }
                            void onDocumentNumberingStyleOverridesChange?.(next)
                          }}
                          className="size-6 cursor-pointer rounded border border-[#CBD5E1] p-0.5 disabled:cursor-not-allowed disabled:opacity-100"
                          title="Chọn màu khác"
                        />
                      </div>
                      <div className="mt-1 font-mono text-[11px] text-[#64748B]">
                        {currentColor}{" "}
                        {documentNumberingStyleOverrides?.color
                          ? ""
                          : "(mặc định)"}
                      </div>
                    </div>

                    {/* Opacity */}
                    <div>
                      <label className="block text-xs font-medium text-[#475569]">
                        Độ trong suốt: {Math.round(effOpacity * 100)}%
                      </label>
                      <input
                        type="range"
                        min={0.1}
                        max={1}
                        step={0.05}
                        disabled={readOnly}
                        value={effOpacity}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value)
                          const next = {
                            ...(documentNumberingStyleOverrides || {}),
                            opacity: isNaN(val) ? undefined : val,
                          }
                          void onDocumentNumberingStyleOverridesChange?.(next)
                        }}
                        className="mt-2 w-full accent-[#0052FF] disabled:cursor-not-allowed disabled:opacity-100"
                      />
                      <div className="mt-0.5 text-[10px] text-[#94A3B8]">
                        Mặc định: {Math.round((base.opacity ?? 0.75) * 100)}%
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Preview */}
              <div className="mt-3">
                <div className="mb-1 text-xs font-medium text-[#475569]">
                  Xem trước
                </div>
                {(() => {
                  const base =
                    NUMBERING_STYLE_OPTIONS.find(
                      (o) => o.value === documentNumberingStylePreset
                    ) || NUMBERING_STYLE_OPTIONS[0]
                  const effSize =
                    documentNumberingStyleOverrides?.font_size ?? base.fontSize
                  const effColor =
                    documentNumberingStyleOverrides?.color ?? base.color
                  const effOpacity =
                    documentNumberingStyleOverrides?.opacity ??
                    base.opacity ??
                    0.75
                  return (
                    <div
                      className="inline-flex items-center justify-center rounded border border-[#E2E8F0] bg-white px-4 py-2 text-2xl font-semibold select-none"
                      style={{
                        fontFamily: base.fontFamily || "monospace",
                        fontStyle: base.fontStyle,
                        fontWeight: base.fontWeight,
                        fontSize: `${effSize}pt`,
                        color: effColor,
                        opacity: effOpacity,
                      }}
                    >
                      001
                    </div>
                  )
                })()}
              </div>
            </div>
          )}
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
            <ArchivePlanTree
              fondsName={displayFondsName}
              tree={pagedTree}
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
          </ScrollArea>
          {tree.length > rootPagination.pageSize && (
            <div className="border-t border-[#E2E8F0] px-3 py-3">
              <PaginationControls
                total={rootPagination.total}
                pageIndex={rootPagination.pageIndex}
                pageSize={rootPagination.pageSize}
                pageCount={rootPagination.pageCount}
                startNumber={rootPagination.startNumber}
                endNumber={rootPagination.endNumber}
                pageSizeOptions={rootPagination.pageSizeOptions}
                itemLabel="thư mục"
                onPageChange={rootPagination.setPageIndex}
                onPageSizeChange={rootPagination.setPageSize}
              />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {showRetentionSection && (
        <RetentionAppendicesPanel
          appendices={parsedPlan.retention_appendices}
          sources={parsedPlan.retention_sources}
          hasRetentionSchedule={hasRetentionSchedule}
        />
      )}

      {showActions && (
        <PlanReviewActions
          readOnly={readOnly}
          treeLength={tree.length}
          onSaveDraft={onSaveDraft}
          onConfirm={onConfirm}
          onContinueToMetadata={onContinueToMetadata}
          savingDraft={savingDraft}
          confirming={confirming}
          planDraftDirty={planDraftDirty}
          draftDiffersActive={draftDiffersActive}
          hasRetentionSchedule={hasRetentionSchedule}
        />
      )}
    </motion.div>
  )
}

interface ArchivePlanTreeProps {
  fondsName: string
  tree: FolderNode[]
  readOnly: boolean
  onAdd: (parentId: string) => void
  onRename: (id: string, name: string) => void
  onDefinitionChange: (id: string, definition: string) => void | Promise<void>
  onDelete: (id: string) => void
}

function ArchivePlanTree({
  fondsName,
  tree,
  readOnly,
  onAdd,
  onRename,
  onDefinitionChange,
  onDelete,
}: ArchivePlanTreeProps) {
  const rootLabel = fondsName.trim() || "Chưa đặt tên phông"

  return (
    <details className="group/fonds" open>
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-[#0F172A] transition-colors hover:bg-[#F1F5F9]">
        <ChevronDown className="size-3.5 shrink-0 text-[#64748B] transition-transform group-open/fonds:rotate-0" />
        <FolderOpen className="size-4 shrink-0 text-[#0052FF]" />
        <span className="min-w-0 flex-1 [overflow-wrap:anywhere] break-words">
          {rootLabel}
        </span>
      </summary>

      <ArchiveRetentionBranch
        label="Vĩnh viễn"
        tree={tree}
        readOnly={readOnly}
        onAdd={onAdd}
        onRename={onRename}
        onDefinitionChange={onDefinitionChange}
        onDelete={onDelete}
      />
      <ArchiveRetentionBranch
        label="Có thời hạn"
        tree={tree}
        readOnly={readOnly}
        onAdd={onAdd}
        onRename={onRename}
        onDefinitionChange={onDefinitionChange}
        onDelete={onDelete}
      />
      <ArchiveRetentionBranch
        label="Tài liệu loại"
        tree={[]}
        readOnly={readOnly}
        onAdd={onAdd}
        onRename={onRename}
        onDefinitionChange={onDefinitionChange}
        onDelete={onDelete}
      />
    </details>
  )
}

interface ArchiveRetentionBranchProps extends Omit<
  ArchivePlanTreeProps,
  "fondsName"
> {
  label: string
}

function ArchiveRetentionBranch({
  label,
  tree,
  readOnly,
  onAdd,
  onRename,
  onDefinitionChange,
  onDelete,
}: ArchiveRetentionBranchProps) {
  return (
    <details className="group/branch" open>
      <summary className="ml-5 flex cursor-pointer list-none items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-[#0F172A] transition-colors hover:bg-[#F1F5F9]">
        <ChevronDown className="size-3.5 shrink-0 text-[#64748B] transition-transform group-open/branch:rotate-0" />
        <Folder className="size-4 shrink-0 text-[#0052FF]" />
        <span>{label}</span>
      </summary>
      <div className="pl-10">
        {tree.length > 0 ? (
          tree.map((node) => (
            <FolderNodeItem
              key={`${label}:${node.id}`}
              node={node}
              depth={0}
              readOnly={readOnly}
              onAdd={onAdd}
              onRename={onRename}
              onDefinitionChange={onDefinitionChange}
              onDelete={onDelete}
            />
          ))
        ) : (
          <div className="ml-2 rounded-lg px-2 py-1.5 text-xs text-[#64748B]">
            Chưa có thư mục.
          </div>
        )}
      </div>
    </details>
  )
}
