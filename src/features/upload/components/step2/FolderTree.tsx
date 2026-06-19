import { Check, Files, FileText, Plus } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/shared/lib/utils"
import type { FolderNode } from "@/features/upload/types"

import {
  FolderNodeItem,
  PlanSummary,
  RetentionAppendicesPanel,
} from "./FolderTree.nodes"
import { DossierBuildStrategySection } from "./FolderTree.strategy"
import {
  addNode,
  deleteNode,
  newId,
  renameNode,
  updateDefinition,
} from "./FolderTree.helpers"

import type { FolderTreeProps } from "./FolderTree.types"
export function FolderTree({
  tree,
  parsedPlan,
  readOnly = false,
  hasRetentionSchedule = true,
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

      <DossierBuildStrategySection
        readOnly={readOnly}
        dossierBuildStrategy={dossierBuildStrategy}
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

      <RetentionAppendicesPanel
        appendices={parsedPlan.retention_appendices}
        hasRetentionSchedule={hasRetentionSchedule}
      />

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
