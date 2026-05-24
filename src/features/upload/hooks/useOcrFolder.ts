import { useState, useRef, useCallback } from "react"
import type { FolderStatusResponse } from "@/features/upload/api/ocrApi"

export type OcrFolderState = "idle" | "starting" | "polling" | "done" | "error"

export interface UseOcrFolderResult {
  state: OcrFolderState
  status: FolderStatusResponse | null
  error: string
  start: (folderPath: string) => Promise<void>
  reset: () => void
}

function mockFolderStatus(folderPath: string, tick: number): FolderStatusResponse {
  const total = 3
  const done = Math.min(tick, total)
  const jobs = Array.from({ length: total }, (_, i) => ({
    id: i + 1,
    data_path: `${folderPath}/0${i + 1}/van-ban-${i + 1}.pdf`,
    status: i < done ? "done" : i === done ? "running" : "pending",
    light_metadata: i < done ? {
      loai_van_ban: "Quyết định",
      so_hieu_tai_lieu: `${29 + i}/QĐ-UBND`,
      co_quan_ban_hanh: "ỦY BAN NHÂN DÂN QUẬN DƯƠNG KINH",
      ngay_ban_hanh: "04/01/2021",
      trich_yeu_tai_lieu: "Về việc bổ nhiệm chức danh nghề nghiệp",
      mentioned_subjects: ["Bà Ngô Thị Điểm", "Trường THCS Anh Dũng"],
      direct_target_subject: "Bà Ngô Thị Điểm",
      "nguoi ky": "Nguyễn Văn A",
      _warnings: i % 2 === 0 ? { mentioned_subjects: "low confidence" } : {},
    } : {},
  }))

  const statusCounts: Record<string, number> = {}
  jobs.forEach((j) => { statusCounts[j.status] = (statusCounts[j.status] ?? 0) + 1 })

  return {
    folder_path: folderPath,
    recursive: true,
    total_files: total,
    total_jobs: total,
    missing_files: [],
    status_counts: statusCounts,
    jobs,
  }
}

export function useOcrFolder(): UseOcrFolderResult {
  const [state, setState] = useState<OcrFolderState>("idle")
  const [status, setStatus] = useState<FolderStatusResponse | null>(null)
  const [error] = useState("")
  const tickRef = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stop = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
  }

  const reset = useCallback(() => {
    stop()
    tickRef.current = 0
    setState("idle")
    setStatus(null)
  }, [])

  const start = useCallback(async (folderPath: string) => {
    stop()
    tickRef.current = 0
    setState("starting")
    setStatus(null)

    await new Promise((r) => setTimeout(r, 400))
    setState("polling")

    const tick = () => {
      tickRef.current += 1
      const result = mockFolderStatus(folderPath, tickRef.current)
      setStatus(result)
      if (tickRef.current >= result.total_files) {
        stop()
        setState("done")
      }
    }

    tick()
    intervalRef.current = setInterval(tick, 1200)
  }, [])

  return { state, status, error, start, reset }
}
