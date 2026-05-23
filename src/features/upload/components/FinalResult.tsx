import { useState } from "react"
import { Folder, FolderOpen, FileText, ChevronRight, ChevronDown, CheckCircle2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/shared/lib/utils"
import type { FolderNode } from "@/features/upload/types"

interface FolderResultNodeProps {
  node: FolderNode
  files: string[]
  allFiles: Record<string, string[]>
  depth: number
  draggedFile: string | null
  onDragStart: (file: string) => void
  onDrop: (folderId: string) => void
}

function FolderResultNode({ node, files, allFiles, depth, draggedFile, onDragStart, onDrop }: FolderResultNodeProps) {
  const [open, setOpen] = useState(true)
  const [dragOver, setDragOver] = useState(false)

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors",
          dragOver ? "bg-[#0052FF]/10 ring-1 ring-[#0052FF]/30" : "hover:bg-[#F1F5F9]",
        )}
        style={{ paddingLeft: `${8 + depth * 20}px` }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); onDrop(node.id) }}
      >
        <button onClick={() => setOpen((v) => !v)} className="shrink-0 text-[#64748B]">
          {(node.children.length > 0 || files.length > 0)
            ? open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />
            : <span className="size-3.5" />
          }
        </button>
        {open ? <FolderOpen className="size-4 shrink-0 text-[#0052FF]" /> : <Folder className="size-4 shrink-0 text-[#0052FF]" />}
        <span className="flex-1 text-sm font-medium text-[#0F172A]">{node.name}</span>
        {files.length > 0 && (
          <span className="rounded-full bg-[#0052FF]/10 px-2 py-0.5 font-mono text-[10px] text-[#0052FF]">
            {files.length}
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
            {/* Files in this folder */}
            {files.map((filePath) => (
              <div
                key={filePath}
                draggable
                onDragStart={() => onDragStart(filePath)}
                className="flex cursor-grab items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[#F1F5F9] active:cursor-grabbing"
                style={{ paddingLeft: `${8 + (depth + 1) * 20}px` }}
              >
                <span className="size-3.5 shrink-0" />
                <div
                  className="flex size-6 shrink-0 items-center justify-center rounded"
                  style={{ background: "linear-gradient(135deg, #0052FF, #4D7CFF)" }}
                >
                  <FileText className="size-3 text-white" />
                </div>
                <span className="flex-1 truncate font-mono text-xs text-[#64748B]">{filePath.split("/").pop()}</span>
              </div>
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
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface FinalResultProps {
  tree: FolderNode[]
  assignment: Record<string, string[]>
  onFinish: () => void
}

export function FinalResult({ tree, assignment, onFinish }: FinalResultProps) {
  const [files, setFiles] = useState<Record<string, string[]>>(assignment)
  const [draggedFile, setDraggedFile] = useState<string | null>(null)
  const [draggedFrom, setDraggedFrom] = useState<string | null>(null)

  const handleDragStart = (folderId: string, filePath: string) => {
    setDraggedFile(filePath)
    setDraggedFrom(folderId)
  }

  const handleDrop = (targetFolderId: string) => {
    if (!draggedFile || !draggedFrom || draggedFrom === targetFolderId) return
    setFiles((prev) => {
      const next = { ...prev }
      next[draggedFrom!] = (next[draggedFrom!] ?? []).filter((f) => f !== draggedFile)
      next[targetFolderId] = [...(next[targetFolderId] ?? []), draggedFile!]
      return next
    })
    setDraggedFile(null)
    setDraggedFrom(null)
  }

  const totalFiles = Object.values(files).flat().length

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-[#0052FF]/30 bg-[#0052FF]/5 px-3 py-1">
            <span className="size-1.5 rounded-full bg-[#0052FF]" />
            <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#0052FF]">Bước 5 / 5</span>
          </div>
          <h2 className="text-2xl text-[#0F172A]" style={{ fontFamily: "'Calistoga', Georgia, serif" }}>
            Kết quả phân cụm
          </h2>
          <p className="mt-1 text-sm text-[#64748B]">
            Kéo thả file giữa các thư mục để điều chỉnh trước khi hoàn tất.
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-[#64748B]">Tổng tài liệu</p>
          <p className="text-2xl font-bold text-[#0052FF]">{totalFiles}</p>
        </div>
      </div>

      {/* Tree with drag-drop */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
        {tree.map((node) => (
          <FolderResultNode
            key={node.id}
            node={node}
            files={files[node.id] ?? []}
            allFiles={files}
            depth={0}
            draggedFile={draggedFile}
            onDragStart={(filePath) => handleDragStart(node.id, filePath)}
            onDrop={handleDrop}
          />
        ))}
      </div>

      {/* Finish bar */}
      <div className="flex items-center justify-between rounded-2xl border border-[#0052FF]/20 bg-white px-6 py-4" style={{ boxShadow: "0 4px_24px rgba(0,82,255,0.08)" }}>
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl" style={{ background: "linear-gradient(135deg, #0052FF, #4D7CFF)" }}>
            <CheckCircle2 className="size-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#0F172A]">Phân cụm hoàn tất</p>
            <p className="text-xs text-[#64748B]">{totalFiles} tài liệu đã được sắp xếp vào phông lưu trữ.</p>
          </div>
        </div>
        <button
          onClick={onFinish}
          className={cn(
            "flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]",
          )}
          style={{ background: "linear-gradient(to right, #0052FF, #4D7CFF)", boxShadow: "0 4px 14px rgba(0,82,255,0.25)" }}
        >
          <CheckCircle2 className="size-4" /> Hoàn tất
        </button>
      </div>
    </motion.div>
  )
}
