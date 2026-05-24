import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Loader2, CheckCircle2 } from "lucide-react"
import type { FolderNode, PdfMetadata } from "@/features/upload/types"

const STEPS = [
  "Đang phân tích metadata tài liệu…",
  "Đang so khớp với cấu trúc phông…",
  "Đang phân cụm tài liệu vào thư mục…",
  "Hoàn tất phân cụm.",
]

function assignFilesToFolders(
  tree: FolderNode[],
  items: PdfMetadata[]
): Record<string, string[]> {
  const result: Record<string, string[]> = {}

  const collectIds = (nodes: FolderNode[]) => {
    nodes.forEach((n) => {
      result[n.id] = []
      collectIds(n.children)
    })
  }
  collectIds(tree)

  const allIds = Object.keys(result)

  items.forEach((item, idx) => {
    const targetId = allIds[idx % allIds.length]
    result[targetId].push(item.data_path)
  })

  return result
}

interface ClusteringStepProps {
  tree: FolderNode[]
  items: PdfMetadata[]
  onDone: (assignment: Record<string, string[]>) => void
}

export function ClusteringStep({ tree, items, onDone }: ClusteringStepProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let i = 0
    const advance = () => {
      i++
      if (i < STEPS.length - 1) {
        setStepIndex(i)
        setTimeout(advance, 700)
      } else {
        setStepIndex(STEPS.length - 1)
        setDone(true)
        setTimeout(() => {
          onDone(assignFilesToFolders(tree, items))
        }, 600)
      }
    }
    setTimeout(advance, 700)
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center justify-center gap-8 py-20"
    >
      {/* Animated ring */}
      <div className="relative flex size-24 items-center justify-center">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, #0052FF, #4D7CFF, transparent)",
            animation: done ? "none" : "spin 1.2s linear infinite",
          }}
        />
        <div className="absolute inset-1 rounded-full bg-[#FAFAFA]" />
        <div
          className="relative flex size-16 items-center justify-center rounded-full"
          style={{
            background: "linear-gradient(135deg, #0052FF, #4D7CFF)",
            boxShadow: "0 8px 24px rgba(0,82,255,0.35)",
          }}
        >
          {done ? (
            <CheckCircle2 className="size-8 text-white" />
          ) : (
            <Loader2 className="size-8 animate-spin text-white" />
          )}
        </div>
      </div>

      <div className="text-center">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#0052FF]/30 bg-[#0052FF]/5 px-3 py-1">
          <span className="size-1.5 animate-pulse rounded-full bg-[#0052FF]" />
          <span className="font-roboto text-[11px] tracking-[0.15em] text-[#0052FF] uppercase">
            Bước 4 / 5
          </span>
        </div>
        <h2
          className="mt-2 text-2xl text-[#0F172A]"
          style={{ fontFamily: "'Calistoga', Georgia, serif" }}
        >
          Đang phân cụm tài liệu
        </h2>

        <div className="mt-4 flex flex-col gap-2">
          {STEPS.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: i <= stepIndex ? 1 : 0.25, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.1 }}
              className="flex items-center justify-center gap-2 text-sm"
            >
              {i < stepIndex || (done && i === STEPS.length - 1) ? (
                <CheckCircle2 className="size-4 text-[#0052FF]" />
              ) : i === stepIndex ? (
                <Loader2 className="size-4 animate-spin text-[#0052FF]" />
              ) : (
                <span className="size-4 rounded-full border border-[#E2E8F0]" />
              )}
              <span
                className={i <= stepIndex ? "text-[#0F172A]" : "text-[#64748B]"}
              >
                {s}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </motion.div>
  )
}
