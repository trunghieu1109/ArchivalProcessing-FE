import { useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  CheckCircle2,
  Loader2,
  Play,
  ArrowRight,
  ArrowLeft,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { cn } from "@/shared/lib/utils"
import { DocxSection } from "@/features/upload/components/step1/DocxSection"
import { ZipSection } from "@/features/upload/components/step1/ZipSection"
import { FolderTree } from "@/features/upload/components/step2/FolderTree"
import { ProcessStep } from "@/features/upload/components/step3/ProcessStep"
import { FinalResult } from "@/features/upload/components/step4/FinalResult"
import { useOcrFolder } from "@/features/upload/hooks/useOcrFolder"
import type {
  ProcessState,
  SectionHandle,
  ArchiveEntry,
  FolderNode,
  ParsedPlan,
  AppStep,
} from "@/features/upload/types"
import type { ClusterGroup } from "@/features/upload/components/step3/ClusterPanel"

const easeOut = [0.16, 1, 0.3, 1] as const

// Mock parsed plan — mirrors the real API response shape from parsed_plan.json
const MOCK_PARSED_PLAN: ParsedPlan = {
  summary:
    "Phân loại tài liệu theo năm, sau đó theo mặt hoạt động (lĩnh vực) của phòng.",
  fonds_name: "PHÔNG PHÒNG KINH TẾ HẠ TẦNG",
  groups: Array.from({ length: 27 }, (_, i) => ({
    id: String(i + 1),
    name: `Năm ${2000 + i}`,
    type: "level-1" as const,
    definition: "",
    children: [
      {
        id: "c1",
        name: "Hành chính, Tổng hợp, Tổ chức",
        type: "level-2" as const,
        definition:
          "Hồ sơ, văn bản về tổ chức hành chính, tổng hợp các quy trình, quyết định, báo cáo, kế hoạch và tài liệu liên quan đến quản lý, điều hành và cấu trúc của các cơ quan, tổ chức công.",
        children: [],
      },
      {
        id: "c2",
        name: "Lĩnh vực Công thương",
        type: "level-2" as const,
        definition:
          "Hồ sơ, văn bản về ngành Công Thương là tài liệu liên quan đến chính sách, chương trình, kế hoạch, đề án, quy định, phê duyệt danh mục quản lý hoạt động.",
        children: [],
      },
      {
        id: "c3",
        name: "Lĩnh vực Giao thông",
        type: "level-2" as const,
        definition:
          "Hồ sơ, văn bản về lĩnh vực giao thông là tài liệu liên quan đến quản lý, điều tiết, thực thi và phát triển các hoạt động giao thông trên mọi phương tiện và tuyến đường.",
        children: [],
      },
      {
        id: "c4",
        name: "Lĩnh vực Khoa học Công nghệ",
        type: "level-2" as const,
        definition:
          "Hồ sơ, văn bản về lĩnh vực khoa học công nghệ là tài liệu liên quan đến nghiên cứu, phát triển, ứng dụng và quản lý khoa học tự nhiên, công nghệ thông tin.",
        children: [],
      },
      {
        id: "c5",
        name: "Lĩnh vực Xây dựng",
        type: "level-2" as const,
        definition:
          "Hồ sơ, văn bản về lĩnh vực xây dựng là tài liệu liên quan đến mọi giai đoạn của hoạt động xây dựng, bao gồm lập kế hoạch, thiết kế, khảo sát, giám sát thi công.",
        children: [],
      },
      {
        id: "c6",
        name: "Tổ chức Đảng, Đoàn thể",
        type: "level-2" as const,
        definition:
          "Hồ sơ, văn bản về tổ chức Đảng, Đoàn thể là các tài liệu liên quan đến cơ cấu, hoạt động, quyết định, quy định, báo cáo, nghị quyết của các tổ chức chính trị, xã hội.",
        children: [],
      },
    ],
  })),
}

let _nodeId = 1000
function nid() {
  return String(++_nodeId)
}

function planToTree(plan: ParsedPlan): FolderNode[] {
  return plan.groups.map((g) => ({
    id: nid(),
    name: g.name,
    children: g.children.map((c) => ({
      id: nid(),
      name: c.name,
      children: [],
      criteria: [],
    })),
    criteria: [],
  }))
}

const STEP_LABELS = ["Tải lên", "Cấu trúc", "Xử lý", "Kết quả"]

let _doc1Has = false
let _doc2Has = false
let _zipHas = false
let _zipEntries: ArchiveEntry[] = []
let _folderTree: FolderNode[] = planToTree(MOCK_PARSED_PLAN)
let _parsedPlan: ParsedPlan = MOCK_PARSED_PLAN
let _clusterAssignment: Record<string, string[]> = {}
let _clusterGroups: ClusterGroup[] = []
let _doc1State: ProcessState = "idle"
let _doc2State: ProcessState = "idle"
let _zipState: ProcessState = "idle"

export function UploadPage() {
  const navigate = useNavigate()
  const { step } = useParams<{ step: string }>()
  const currentStep = Math.min(
    Math.max(parseInt(step ?? "1", 10), 1),
    4
  ) as AppStep

  const goTo = (s: AppStep) => navigate(`/step/${s}`)

  const doc1Ref = useRef<SectionHandle>(null)
  const doc2Ref = useRef<SectionHandle>(null)
  const zipRef = useRef<SectionHandle>(null)

  const [doc1State, setDoc1State] = useState<ProcessState>(_doc1State)
  const [doc2State, setDoc2State] = useState<ProcessState>(_doc2State)
  const [zipState, setZipState] = useState<ProcessState>(_zipState)

  const [doc1Has, setDoc1Has] = useState(_doc1Has)
  const [doc2Has, setDoc2Has] = useState(_doc2Has)
  const [zipHas, setZipHas] = useState(_zipHas)

  const [zipEntries, setZipEntries] = useState<ArchiveEntry[]>(_zipEntries)
  const [folderTree, setFolderTree] = useState<FolderNode[]>(_folderTree)
  const [parsedPlan, setParsedPlan] = useState<ParsedPlan>(_parsedPlan)
  const [clusterAssignment, setClusterAssignment] =
    useState<Record<string, string[]>>(_clusterAssignment)
  const [clusterGroups, setClusterGroups] =
    useState<ClusterGroup[]>(_clusterGroups)

  const ocr = useOcrFolder()

  // Sync module-level state so it survives navigation
  const syncDoc1Has = (v: boolean) => {
    _doc1Has = v
    setDoc1Has(v)
  }
  const syncDoc2Has = (v: boolean) => {
    _doc2Has = v
    setDoc2Has(v)
  }
  const syncZipHas = (v: boolean) => {
    _zipHas = v
    setZipHas(v)
  }
  const syncZipEntries = (e: ArchiveEntry[]) => {
    _zipEntries = e
    setZipEntries(e)
  }
  const syncFolderTree = (t: FolderNode[]) => {
    _folderTree = t
    setFolderTree(t)
  }
  const syncDoc1State = (s: ProcessState) => {
    _doc1State = s
    setDoc1State(s)
  }
  const syncDoc2State = (s: ProcessState) => {
    _doc2State = s
    setDoc2State(s)
  }
  const syncZipState = (s: ProcessState) => {
    _zipState = s
    setZipState(s)
  }

  const hasAnyFile = doc1Has || doc2Has || zipHas
  const readyCount = [doc1Has, doc2Has, zipHas].filter(Boolean).length
  const allProcessing =
    doc1State === "processing" ||
    doc2State === "processing" ||
    zipState === "processing"
  const allDone =
    [doc1State, doc2State, zipState].every(
      (s) => s === "done" || s === "idle"
    ) && [doc1State, doc2State, zipState].some((s) => s === "done")

  const handleStartAll = async () => {
    if (!doc1Has) {
      toast.error("Vui lòng tải lên Tài liệu 1 (Thời hạn bảo quản)")
      return
    }
    if (!doc2Has) {
      toast.error("Vui lòng tải lên Tài liệu 2 (Phương án phân loại)")
      return
    }
    if (!zipHas) {
      toast.error("Vui lòng tải lên Kho lưu trữ (.zip/.rar)")
      return
    }
    const tasks = [
      doc1Ref.current?.hasFile() ? doc1Ref.current.process() : null,
      doc2Ref.current?.hasFile() ? doc2Ref.current.process() : null,
      zipRef.current?.hasFile() ? zipRef.current.process() : null,
    ].filter(Boolean) as Promise<void>[]
    await Promise.all(tasks)
    toast.success("Xử lý hoàn tất! Chuyển sang bước tiếp theo.")
    // Mock: API returns parsed plan from doc2
    const plan = MOCK_PARSED_PLAN
    _parsedPlan = plan
    _folderTree = planToTree(plan)
    setParsedPlan(plan)
    setFolderTree(_folderTree)
    goTo(2)
  }

  const pdfPaths = zipEntries
    .filter((e) => !e.isDir && e.name.toLowerCase().endsWith(".pdf"))
    .map((e) => e.name)

  return (
    <div className="min-h-svh bg-[#F0F4F8]">
      {/* Hero header — light */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#EEF2FF] via-[#F0F4FF] to-[#E8EEFF] px-4 py-5 shadow-sm">
        <div
          className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(0,82,255,0.08) 0%, transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl">
          <div className="flex items-start justify-between gap-8">
            {/* Left: badge + title + description */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: easeOut }}
            >
              <img
                src="/assets/mbfs.png"
                alt="MBFS Logo"
                className="h-20 w-auto object-contain"
              />
            </motion.div>

            {/* Right: step indicators */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: easeOut, delay: 0.15 }}
              className="hidden shrink-0 items-center pt-2 md:flex"
            >
              {STEP_LABELS.map((label, i) => {
                const s = (i + 1) as AppStep
                const isActive = currentStep === s
                const isDone = currentStep > s
                const canNav = isDone
                return (
                  <div key={i} className="flex items-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <button
                        onClick={() => canNav && goTo(s)}
                        className={cn(
                          "flex size-10 items-center justify-center rounded-full text-sm font-bold transition-all duration-300",
                          isDone
                            ? "text-white hover:scale-105"
                            : isActive
                              ? "text-white"
                              : "border-2 border-[#CBD5E1] bg-white text-[#94A3B8]",
                          canNav ? "cursor-pointer" : "cursor-default"
                        )}
                        style={
                          isDone
                            ? {
                                background:
                                  "linear-gradient(135deg, #0052FF, #4D7CFF)",
                                boxShadow: "0 4px 12px rgba(0,82,255,0.3)",
                              }
                            : isActive
                              ? {
                                  background:
                                    "linear-gradient(135deg, #0052FF, #4D7CFF)",
                                  boxShadow: "0 4px 12px rgba(0,82,255,0.3)",
                                }
                              : {}
                        }
                      >
                        {isDone ? "✓" : s}
                      </button>
                      <span
                        className={cn(
                          "text-[11px] font-medium",
                          isActive
                            ? "font-semibold text-[#0052FF]"
                            : isDone
                              ? "text-[#64748B]"
                              : "text-[#94A3B8]"
                        )}
                      >
                        {label}
                      </span>
                    </div>
                    {i < STEP_LABELS.length - 1 && (
                      <div className="mx-2 mb-5 h-px w-8 bg-[#CBD5E1]" />
                    )}
                  </div>
                )
              })}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-6xl px-8 py-8">
        {/* Back button for steps 2+ */}
        {currentStep > 1 && (
          <motion.button
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            onClick={() => goTo((currentStep - 1) as AppStep)}
            className="mb-5 flex items-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-4 py-2 text-sm font-medium text-[#475569] shadow-sm transition-all hover:border-[#0052FF]/30 hover:text-[#0052FF]"
          >
            <ArrowLeft className="size-4" /> Quay lại
          </motion.button>
        )}

        <AnimatePresence mode="wait">
          {/* BƯỚC 1 — Upload */}
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: easeOut }}
              className="flex flex-col gap-4"
            >
              {/* Zip — full width */}
              <ZipSection
                ref={zipRef}
                processState={zipState}
                onProcessStateChange={syncZipState}
                onHasFileChange={syncZipHas}
                onEntriesChange={syncZipEntries}
                ocr={ocr}
              />

              {/* Docx — side by side */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <DocxSection
                  ref={doc1Ref}
                  index={1}
                  label="Phương án phân loại"
                  sublabel="Tải lên file Word chứa phương án phân loại tài liệu."
                  processState={doc1State}
                  onProcessStateChange={syncDoc1State}
                  onHasFileChange={syncDoc1Has}
                />
                <DocxSection
                  ref={doc2Ref}
                  index={2}
                  label="Thời hạn bảo quản"
                  sublabel="Tải lên file Word chứa thời hạn bảo quản."
                  processState={doc2State}
                  onProcessStateChange={syncDoc2State}
                  onHasFileChange={syncDoc2Has}
                />
              </div>

              {/* Action bar */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: easeOut, delay: 0.3 }}
                className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card px-6 py-4 shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className="flex gap-2">
                    {[
                      { label: "Tài liệu 1", has: doc1Has, state: doc1State },
                      { label: "Tài liệu 2", has: doc2Has, state: doc2State },
                      { label: "Kho lưu trữ", has: zipHas, state: zipState },
                    ].map((s, i) => (
                      <div
                        key={i}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full px-3 py-1 font-roboto text-[11px] font-semibold tracking-[0.1em] uppercase transition-all duration-200",
                          s.state === "done"
                            ? "text-primary-foreground"
                            : s.has
                              ? "border border-border bg-muted text-foreground"
                              : "border border-border bg-transparent text-muted-foreground"
                        )}
                        style={
                          s.state === "done"
                            ? {
                                background:
                                  "linear-gradient(to right, #0052FF, #4D7CFF)",
                              }
                            : {}
                        }
                      >
                        <div
                          className={cn(
                            "size-1.5 rounded-full",
                            s.state === "done"
                              ? "bg-white"
                              : s.has
                                ? "bg-primary"
                                : "bg-muted-foreground/40"
                          )}
                        />
                        {s.label}
                      </div>
                    ))}
                  </div>
                  <div className="text-sm font-medium">
                    {allDone ? (
                      <span className="flex items-center gap-1.5 text-primary">
                        <CheckCircle2 className="size-4" /> Tất cả đã xử lý
                      </span>
                    ) : allProcessing ? (
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin text-primary" />{" "}
                        Đang xử lý…
                      </span>
                    ) : hasAnyFile ? (
                      <span className="text-muted-foreground">
                        <span className="font-bold text-foreground">
                          {readyCount}
                        </span>{" "}
                        / 3 file sẵn sàng
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        Tải lên đủ 3 file để bắt đầu
                      </span>
                    )}
                  </div>
                </div>

                <button
                  disabled={allProcessing}
                  onClick={handleStartAll}
                  className={cn(
                    "group flex min-w-44 items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all duration-200",
                    !allProcessing
                      ? "text-primary-foreground hover:-translate-y-0.5 active:scale-[0.98]"
                      : "cursor-not-allowed bg-muted text-muted-foreground"
                  )}
                  style={
                    !allProcessing
                      ? {
                          background:
                            "linear-gradient(to right, #0052FF, #4D7CFF)",
                          boxShadow: "0 4px 14px rgba(0,82,255,0.25)",
                        }
                      : {}
                  }
                >
                  {allProcessing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : allDone ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <Play className="size-4" />
                  )}
                  <span>
                    {allProcessing
                      ? "Đang xử lý…"
                      : allDone
                        ? "Tiếp tục"
                        : "Bắt đầu xử lý"}
                  </span>
                  {!allProcessing && (
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  )}
                </button>
              </motion.div>

              {/* Footer security note */}
              <p className="flex items-center justify-center gap-1.5 text-xs text-[#94A3B8]">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Dữ liệu của bạn được bảo mật và chỉ sử dụng cho mục đích xử lý
                tài liệu.
              </p>
            </motion.div>
          )}

          {/* BƯỚC 2 — Cây thư mục */}
          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: easeOut }}
            >
              <FolderTree
                tree={folderTree}
                parsedPlan={parsedPlan}
                onChange={syncFolderTree}
                onReapply={(plan) => {
                  _parsedPlan = plan
                  _folderTree = planToTree(plan)
                  setParsedPlan(plan)
                  setFolderTree(_folderTree)
                }}
                onConfirm={() => goTo(3)}
              />
            </motion.div>
          )}

          {/* BƯỚC 3 — Xử lý */}
          {currentStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: easeOut }}
            >
              <ProcessStep
                pdfPaths={pdfPaths}
                tree={folderTree}
                onContinue={(_items, assignment, grps) => {
                  _clusterAssignment = assignment
                  _clusterGroups = grps
                  setClusterAssignment(assignment)
                  setClusterGroups(grps)
                  goTo(4)
                }}
              />
            </motion.div>
          )}

          {/* BƯỚC 4 — Kết quả */}
          {currentStep === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: easeOut }}
            >
              <FinalResult
                tree={folderTree}
                assignment={clusterAssignment}
                groups={clusterGroups}
                onFinish={() => {
                  toast.success("Hoàn tất!")
                  goTo(1)
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
