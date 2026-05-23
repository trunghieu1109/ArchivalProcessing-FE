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
import { DocxSection } from "@/features/upload/components/DocxSection"
import { ZipSection } from "@/features/upload/components/ZipSection"
import { FolderTree } from "@/features/upload/components/FolderTree"
import { ProcessStep } from "@/features/upload/components/ProcessStep"
import { FinalResult } from "@/features/upload/components/FinalResult"
import { useOcrFolder } from "@/features/upload/hooks/useOcrFolder"
import type {
  ProcessState,
  SectionHandle,
  ArchiveEntry,
  FolderNode,
  AppStep,
} from "@/features/upload/types"

const easeOut = [0.16, 1, 0.3, 1] as const

const INITIAL_TREE: FolderNode[] = [
  {
    id: "1",
    name: "Phông UBND Quận Dương Kinh",
    children: [
      {
        id: "2",
        name: "Hồ sơ hành chính",
        children: [
          { id: "3", name: "Quyết định", children: [] },
          { id: "4", name: "Công văn", children: [] },
        ],
      },
      {
        id: "5",
        name: "Hồ sơ nhân sự",
        children: [{ id: "6", name: "Bổ nhiệm", children: [] }],
      },
    ],
  },
]

const STEP_LABELS = ["Tải lên", "Cấu trúc", "Xử lý", "Kết quả"]

// Shared state lives outside the component so it persists across navigation
let _doc1Has = false
let _doc2Has = false
let _zipHas = false
let _zipEntries: ArchiveEntry[] = []
let _folderTree: FolderNode[] = INITIAL_TREE
let _clusterAssignment: Record<string, string[]> = {}
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
  const [clusterAssignment, setClusterAssignment] =
    useState<Record<string, string[]>>(_clusterAssignment)

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
      toast.error("Vui lòng tải lên Tài liệu 2 (Phông lưu trữ)")
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
    goTo(2)
  }

  const pdfPaths = zipEntries
    .filter((e) => !e.isDir && e.name.toLowerCase().endsWith(".pdf"))
    .map((e) => e.name)

  return (
    <div className="min-h-svh bg-[#F0F4F8]">
      {/* Hero header */}
      <div className="relative overflow-hidden bg-[#0F172A] px-8 py-12">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            opacity: 0.03,
          }}
        />
        <div
          className="pointer-events-none absolute -top-32 -right-32 size-96 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(0,82,255,0.15) 0%, transparent 70%)",
          }}
        />

        <div className="relative mx-auto max-w-6xl">
          <div className="flex items-center justify-between gap-8">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: easeOut }}
            >
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#0052FF]/30 bg-[#0052FF]/10 px-4 py-1.5">
                <span className="size-1.5 rounded-full bg-[#0052FF]" />
                <span className="font-mono text-[11px] tracking-[0.15em] text-[#4D7CFF] uppercase">
                  Hệ thống chỉnh lý tài liệu
                </span>
              </div>
              <h1
                className="text-4xl font-normal text-white md:text-5xl"
                style={{
                  fontFamily: "'Calistoga', Georgia, serif",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.05,
                }}
              >
                Xử lý{" "}
                <span
                  style={{
                    background: "linear-gradient(to right, #0052FF, #4D7CFF)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                  }}
                >
                  Tài liệu
                </span>
              </h1>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-white/50">
                Tải lên tài liệu, xác nhận cấu trúc phông, xem metadata OCR và
                phân cụm tự động.
              </p>
            </motion.div>

            {/* Step progress — clickable to navigate back */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease: easeOut, delay: 0.15 }}
              className="hidden shrink-0 items-center md:flex"
            >
              {STEP_LABELS.map((label, i) => {
                const step = (i + 1) as AppStep
                const isActive = currentStep === step
                const isDone = currentStep > step
                const canNav = isDone
                return (
                  <div key={i} className="flex items-center">
                    <div className="flex flex-col items-center gap-2">
                      <button
                        onClick={() => canNav && goTo(step)}
                        className={cn(
                          "flex size-9 items-center justify-center rounded-xl text-xs font-bold transition-all duration-300",
                          isDone
                            ? "text-white hover:scale-105"
                            : isActive
                              ? "border border-[#0052FF]/50 bg-[#0052FF]/15 text-[#4D7CFF]"
                              : "border border-white/20 bg-white/10 text-white/60",
                          canNav ? "cursor-pointer" : "cursor-default"
                        )}
                        style={
                          isDone
                            ? {
                                background:
                                  "linear-gradient(135deg, #0052FF, #4D7CFF)",
                                boxShadow: "0 4px 14px rgba(0,82,255,0.4)",
                              }
                            : {}
                        }
                      >
                        {isDone ? "✓" : step}
                      </button>
                      <span
                        className={cn(
                          "max-w-20 text-center font-mono text-[10px] tracking-[0.1em] uppercase",
                          isActive
                            ? "text-white/90"
                            : isDone
                              ? "text-white/70"
                              : "text-white/50"
                        )}
                      >
                        {label}
                      </span>
                    </div>
                    {i < STEP_LABELS.length - 1 && (
                      <div className="mx-3 mb-5 h-px w-6 bg-white/10" />
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
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                <div className="md:col-span-3">
                  <ZipSection
                    ref={zipRef}
                    processState={zipState}
                    onProcessStateChange={syncZipState}
                    onHasFileChange={syncZipHas}
                    onEntriesChange={syncZipEntries}
                    ocr={ocr}
                  />
                </div>
                <div className="flex flex-col gap-4 md:col-span-2">
                  <DocxSection
                    ref={doc1Ref}
                    index={1}
                    label="Phông lưu trữ"
                    sublabel=".docx"
                    processState={doc1State}
                    onProcessStateChange={syncDoc1State}
                    onHasFileChange={syncDoc1Has}
                  />
                  <DocxSection
                    ref={doc2Ref}
                    index={2}
                    label="Thời hạn bảo quản"
                    sublabel=".docx"
                    processState={doc2State}
                    onProcessStateChange={syncDoc2State}
                    onHasFileChange={syncDoc2Has}
                  />
                </div>
              </div>

              {/* Action bar */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: easeOut, delay: 0.3 }}
                className="mt-4 flex items-center justify-between gap-4 rounded-2xl border bg-white px-6 py-4"
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
                          "flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[11px] font-semibold tracking-[0.1em] uppercase transition-all duration-200",
                          s.state === "done"
                            ? "text-white"
                            : s.has
                              ? "border border-[#94A3B8] bg-[#E8EDF5] text-[#0F172A]"
                              : "border border-[#CBD5E1] bg-transparent text-[#475569]"
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
                                ? "bg-[#0052FF]"
                                : "bg-[#94A3B8]"
                          )}
                        />
                        {s.label}
                      </div>
                    ))}
                  </div>
                  <div className="text-sm font-medium">
                    {allDone ? (
                      <span className="flex items-center gap-1.5 text-[#0052FF]">
                        <CheckCircle2 className="size-4" /> Tất cả đã xử lý
                      </span>
                    ) : allProcessing ? (
                      <span className="flex items-center gap-1.5 text-[#475569]">
                        <Loader2 className="size-3.5 animate-spin text-[#0052FF]" />{" "}
                        Đang xử lý…
                      </span>
                    ) : hasAnyFile ? (
                      <span className="text-[#475569]">
                        <span className="font-bold text-[#0F172A]">
                          {readyCount}
                        </span>{" "}
                        / 3 file sẵn sàng
                      </span>
                    ) : (
                      <span className="text-[#475569]">
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
                      ? "text-white hover:-translate-y-0.5 active:scale-[0.98]"
                      : "cursor-not-allowed bg-[#CBD5E1] text-[#475569]"
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
                onChange={syncFolderTree}
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
                onContinue={(_items, assignment) => {
                  _clusterAssignment = assignment
                  setClusterAssignment(assignment)
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
                onFinish={() => {
                  toast.success("Hoàn tất! Bắt đầu lại từ đầu.")
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
