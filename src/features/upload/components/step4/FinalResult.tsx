import { useState } from "react"
import { CheckCircle2 } from "lucide-react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { FolderResultTree } from "./FolderResultTree"
import type { FolderNode } from "@/features/upload/types"
import type { ClusterGroup } from "../step3/ClusterPanel"

interface FinalResultProps {
  tree: FolderNode[]
  assignment: Record<string, string[]> // groupId -> file paths from ProcessStep
  groups?: ClusterGroup[] // optional: group metadata for labels
  onFinish: () => void
}

export function FinalResult({
  tree: initialTree,
  assignment,
  groups = [],
  onFinish,
}: FinalResultProps) {
  // Build augmented tree: inject Nhóm nodes as children of medium folders
  const [tree, setTree] = useState<FolderNode[]>(() => {
    const groupEntries = Object.entries(assignment) // [groupId, filePaths][]

    // Each group becomes a Nhóm child under a medium folder (round-robin across all medium folders)
    const mediumNodes: { largeIdx: number; medIdx: number }[] = []
    initialTree.forEach((large, li) => {
      large.children.forEach((_, mi) =>
        mediumNodes.push({ largeIdx: li, medIdx: mi })
      )
    })

    // Build a map: mediumNodeIndex -> Nhóm nodes to inject
    const nhomsByMedium: Record<number, FolderNode[]> = {}
    groupEntries.forEach(([groupId, _filePaths], i) => {
      const medIdx = i % mediumNodes.length
      if (!nhomsByMedium[medIdx]) nhomsByMedium[medIdx] = []
      const groupLabel = groups[i]?.label ?? `Nhóm ${i + 1}`
      nhomsByMedium[medIdx].push({
        id: groupId, // reuse groupId so files map correctly
        name: groupLabel,
        children: [],
        criteria: [],
      })
    })

    // Inject Nhóm nodes into medium folders
    let medCounter = 0
    return initialTree.map((large) => ({
      ...large,
      children: large.children.map((medium) => {
        const nhoms = nhomsByMedium[medCounter++] ?? []
        return { ...medium, children: nhoms }
      }),
    }))
  })

  // Files keyed by groupId (which is also the Nhóm node id)
  const [files, setFiles] = useState<Record<string, string[]>>(() => {
    const result: Record<string, string[]> = {}
    Object.entries(assignment).forEach(([groupId, filePaths]) => {
      result[groupId] = filePaths
    })
    return result
  })

  const handleFinish = () => {
    onFinish()
  }

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
            <span className="font-roboto text-[11px] tracking-[0.15em] text-[#0052FF] uppercase">
              Bước 4 / 4
            </span>
          </div>
          <h2
            className="text-2xl text-[#0F172A]"
            style={{ fontFamily: "'Calistoga', Georgia, serif" }}
          >
            Kết quả
          </h2>
          <p className="mt-1 text-sm text-[#475569]">
            Tài liệu đã được gán vào phông lưu trữ. Kéo thả để điều chỉnh, đổi
            tên nhóm, và đặt tên hồ sơ.
          </p>
        </div>
      </div>

      {/* Folder tree with group labels + drag-drop + naming */}
      <FolderResultTree
        tree={tree}
        files={files}
        groupLabels={{}}
        onTreeChange={setTree}
        onFilesChange={setFiles}
        onRenameGroup={() => {}}
      />

      {/* Action bar */}
      <div className="flex justify-end">
        <Button onClick={handleFinish}>
          <CheckCircle2 data-icon="inline-start" />
          Hoàn tất
        </Button>
      </div>
    </motion.div>
  )
}
