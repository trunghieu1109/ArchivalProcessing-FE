import {
  cancelRawZipUpload,
  cancelRawZipUploadKeepalive,
  uploadSessionInput,
  type SessionInputUploadResponse,
  type UploadMode,
  type UploadProgressSnapshot,
} from "@/features/upload/api/sessionApi"
import { globalUploadPutSemaphore } from "@/shared/lib/uploadSemaphore"

const TERMINAL_VISIBLE_MS = 8_000

export type ZipUploadJobStatus =
  | "creating"
  | "uploading"
  | "attention_required"
  | "completing"
  | "completed"
  | "cancelling"
  | "cancelled"

export interface ZipUploadJob {
  id: string
  kind: "zip"
  sessionId: string
  clientUploadId: string
  fileName: string
  mode: UploadMode
  status: ZipUploadJobStatus
  loadedBytes: number
  totalBytes: number
  percent: number
  response: SessionInputUploadResponse | null
  error: string | null
  createdAt: number
  completedAt: number | null
}

interface ZipStartOptions {
  uploadMode: UploadMode
  maxFiles?: number
  onProgress?: (progress: UploadProgressSnapshot) => void
  onCompleted?: (response: SessionInputUploadResponse) => void
  onCancelled?: () => void
}

type StoredOptions = ZipStartOptions
type Listener = () => void

class ZipUploadManager {
  private readonly jobs = new Map<string, ZipUploadJob>()
  private readonly files = new Map<string, File>()
  private readonly options = new Map<string, StoredOptions>()
  private readonly controllers = new Map<string, AbortController>()
  private readonly listeners = new Set<Listener>()
  private readonly sessionLocks = new Map<
    string,
    Promise<SessionInputUploadResponse>
  >()
  private readonly cancellationTasks = new Map<string, Promise<void>>()
  private readonly removalTimers = new Map<string, number>()
  private snapshot: ZipUploadJob[] = []
  private lifecycleUsers = 0

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): ZipUploadJob[] => this.snapshot

  start(
    sessionId: string,
    file: File,
    options: ZipStartOptions
  ): Promise<SessionInputUploadResponse> {
    const existing = this.sessionLocks.get(sessionId)
    if (existing) return existing
    const id = randomId("zip-job")
    const job: ZipUploadJob = {
      id,
      kind: "zip",
      sessionId,
      clientUploadId: randomId("zip-upload"),
      fileName: file.name,
      mode: options.uploadMode,
      status: "creating",
      loadedBytes: 0,
      totalBytes: file.size,
      percent: 0,
      response: null,
      error: null,
      createdAt: Date.now(),
      completedAt: null,
    }
    this.jobs.set(id, job)
    this.files.set(id, file)
    this.options.set(id, options)
    this.controllers.set(id, new AbortController())
    this.emit()
    return this.startRun(job)
  }

  retry(jobId: string): Promise<SessionInputUploadResponse> {
    const job = this.jobs.get(jobId)
    if (!job || job.status !== "attention_required") {
      return Promise.reject(
        new Error("ZIP upload này không ở trạng thái có thể thử lại.")
      )
    }
    const existing = this.sessionLocks.get(job.sessionId)
    if (existing) return existing
    if (!this.files.has(jobId)) {
      return Promise.reject(
        new Error("File ZIP không còn trong bộ nhớ. Hãy chọn lại file ZIP.")
      )
    }
    this.controllers.set(jobId, new AbortController())
    this.patch(jobId, {
      status: "creating",
      error: null,
      loadedBytes: 0,
      percent: 0,
      completedAt: null,
    })
    return this.startRun(job)
  }

  async cancel(jobId: string, reason = "user_cancelled"): Promise<void> {
    const job = this.jobs.get(jobId)
    if (!job || isTerminal(job.status) || job.status === "completing") {
      return
    }
    this.patch(jobId, { status: "cancelling", error: null })
    this.controllers.get(jobId)?.abort()
    globalUploadPutSemaphore.cancelQueued(jobId)
    if (job.status === "creating") {
      // Presign/chunk-create is allowed to finish so run() can cancel the
      // server-side attempt by its stable client_upload_id.
      return
    }
    await this.finishCancellation(job, reason)
  }

  attachPageLifecycle(): () => void {
    this.lifecycleUsers += 1
    if (this.lifecycleUsers === 1) {
      window.addEventListener("beforeunload", this.beforeUnload)
      window.addEventListener("pagehide", this.pageHide)
    }
    return () => {
      this.lifecycleUsers = Math.max(0, this.lifecycleUsers - 1)
      if (this.lifecycleUsers === 0) {
        window.removeEventListener("beforeunload", this.beforeUnload)
        window.removeEventListener("pagehide", this.pageHide)
      }
    }
  }

  private startRun(job: ZipUploadJob): Promise<SessionInputUploadResponse> {
    const running = this.run(job).finally(() => {
      this.sessionLocks.delete(job.sessionId)
      this.controllers.delete(job.id)
      if (isTerminal(this.jobs.get(job.id)?.status)) {
        this.releaseTerminalJob(job.id)
      }
    })
    this.sessionLocks.set(job.sessionId, running)
    return running
  }

  private async run(job: ZipUploadJob): Promise<SessionInputUploadResponse> {
    const file = this.files.get(job.id)
    const options = this.options.get(job.id)
    const controller = this.controllers.get(job.id)
    if (!file || !options || !controller) {
      throw new Error("Không còn dữ liệu ZIP để tiếp tục upload.")
    }
    try {
      const response = await uploadSessionInput(
        job.sessionId,
        "raw_zip",
        file,
        {
          uploadMode: options.uploadMode,
          maxFiles: options.maxFiles,
          clientUploadId: job.clientUploadId,
          jobId: job.id,
          signal: controller.signal,
          onProgress: (progress) => {
            options.onProgress?.(progress)
            this.applyProgress(job.id, progress)
          },
        }
      )
      this.patch(job.id, {
        status: "completed",
        loadedBytes: file.size,
        totalBytes: file.size,
        percent: 100,
        response,
        error: null,
        completedAt: Date.now(),
      })
      options.onCompleted?.(response)
      this.releaseTerminalJob(job.id)
      return response
    } catch (error) {
      const current = this.jobs.get(job.id)
      if (
        current?.status === "cancelling" ||
        this.cancellationTasks.has(job.id)
      ) {
        await this.finishCancellation(job, "user_cancelled")
        throw error
      }
      this.patch(job.id, {
        status: "attention_required",
        error: errorMessage(error),
      })
      throw error
    }
  }

  private finishCancellation(job: ZipUploadJob, reason: string): Promise<void> {
    const existing = this.cancellationTasks.get(job.id)
    if (existing) return existing
    const task = (async () => {
      try {
        const response = await cancelRawZipUpload(
          job.sessionId,
          job.clientUploadId,
          reason
        )
        this.patch(job.id, {
          status: "cancelled",
          error: null,
          response,
        })
        this.options.get(job.id)?.onCancelled?.()
        this.releaseTerminalJob(job.id)
      } catch (error) {
        this.patch(job.id, {
          status: "attention_required",
          error: errorMessage(error),
        })
        throw error
      } finally {
        this.cancellationTasks.delete(job.id)
      }
    })()
    this.cancellationTasks.set(job.id, task)
    return task
  }

  private applyProgress(jobId: string, progress: UploadProgressSnapshot): void {
    const current = this.jobs.get(jobId)
    if (!current || current.status === "cancelling") return
    const status: ZipUploadJobStatus =
      progress.phase === "processing"
        ? "completing"
        : progress.phase === "done"
          ? "completed"
          : progress.phase === "error"
            ? "attention_required"
            : "uploading"
    this.patch(jobId, {
      status,
      loadedBytes: progress.loadedBytes,
      totalBytes: progress.totalBytes || current.totalBytes,
      percent:
        progress.percent ??
        percent(
          progress.loadedBytes,
          progress.totalBytes || current.totalBytes
        ),
    })
  }

  private patch(jobId: string, patch: Partial<ZipUploadJob>): void {
    const current = this.jobs.get(jobId)
    if (!current) return
    this.jobs.set(jobId, { ...current, ...patch })
    this.emit()
  }

  private emit(): void {
    this.snapshot = [...this.jobs.values()].sort(
      (left, right) => right.createdAt - left.createdAt
    )
    for (const listener of this.listeners) listener()
  }

  private releaseTerminalJob(jobId: string): void {
    this.files.delete(jobId)
    this.options.delete(jobId)
    this.controllers.delete(jobId)
    globalUploadPutSemaphore.cancelQueued(jobId)
    if (this.removalTimers.has(jobId)) return
    const timerId = window.setTimeout(() => {
      this.removalTimers.delete(jobId)
      this.jobs.delete(jobId)
      this.emit()
    }, TERMINAL_VISIBLE_MS)
    this.removalTimers.set(jobId, timerId)
  }

  private beforeUnload = (event: BeforeUnloadEvent): void => {
    if (!this.snapshot.some((job) => !isTerminal(job.status))) return
    event.preventDefault()
    event.returnValue = ""
  }

  private pageHide = (): void => {
    for (const job of this.snapshot) {
      if (isTerminal(job.status) || job.status === "completing") continue
      this.controllers.get(job.id)?.abort()
      globalUploadPutSemaphore.cancelQueued(job.id)
      cancelRawZipUploadKeepalive(
        job.sessionId,
        job.clientUploadId,
        "page_closed"
      )
    }
  }
}

function percent(loaded: number, total: number): number {
  return total > 0
    ? Math.min(100, Math.round((loaded / total) * 1_000) / 10)
    : 0
}

function randomId(prefix: string): string {
  const value =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `${prefix}-${value}`
}

function isTerminal(status: ZipUploadJobStatus | undefined): boolean {
  return Boolean(status && ["completed", "cancelled"].includes(status))
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "ZIP upload thất bại."
}

export function zipUploadProgressFromJob(
  job: Pick<ZipUploadJob, "status" | "loadedBytes" | "totalBytes" | "percent">
): UploadProgressSnapshot {
  const divisor = 1024 * 1024
  return {
    phase:
      job.status === "completed"
        ? "done"
        : job.status === "attention_required"
          ? "error"
          : job.status === "completing"
            ? "processing"
            : "uploading",
    loadedBytes: job.loadedBytes,
    totalBytes: job.totalBytes,
    loadedMb: job.loadedBytes / divisor,
    totalMb: job.totalBytes / divisor,
    percent: job.percent,
  }
}

export const zipUploadManager = new ZipUploadManager()
