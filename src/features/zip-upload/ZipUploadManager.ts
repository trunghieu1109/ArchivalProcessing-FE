import {
  cancelRawZipUpload,
  getSession,
  uploadSessionInput,
  type SessionInputUploadResponse,
  type UploadProgressSnapshot,
} from "@/features/upload/api/sessionApi"
import { uploadProgressSnapshot } from "@/features/upload/api/sessionApi.http"
import type {
  ZipUploadJob,
  ZipUploadStartInput,
  ZipUploadStartResult,
} from "./types"
import { globalUploadSemaphore } from "@/shared/lib/uploadSemaphore"

type Listener = () => void

export class ZipUploadManager {
  private jobs: ZipUploadJob[] = []
  private snapshot: readonly ZipUploadJob[] = []
  private readonly listeners = new Set<Listener>()
  private readonly sources = new Map<string, File>()
  private readonly controllers = new Map<string, AbortController>()

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): readonly ZipUploadJob[] => this.snapshot

  start(input: ZipUploadStartInput): ZipUploadStartResult {
    const existing = this.jobs.find(
      (job) => job.sessionId === input.sessionId && !isTerminal(job.status)
    )
    if (existing) {
      throw new Error(
        "Session này đang có một file ZIP được upload. Hãy hoàn tất hoặc hủy tiến trình hiện tại trước."
      )
    }
    if (!input.file.name.toLowerCase().endsWith(".zip")) {
      throw new Error("Chỉ hỗ trợ upload file ZIP.")
    }
    if (input.file.size <= 0) {
      throw new Error("File ZIP rỗng, không thể upload.")
    }

    const now = Date.now()
    const job: ZipUploadJob = {
      id: crypto.randomUUID(),
      sessionId: input.sessionId,
      fileName: input.file.name,
      fileSize: input.file.size,
      mode: input.mode,
      maxFiles: input.maxFiles,
      status: "preparing",
      progress: uploadProgressSnapshot("uploading", 0, input.file.size),
      result: null,
      error: null,
      startedAt: now,
      updatedAt: now,
      dockHidden: false,
      metadataNavigationHandled: false,
    }
    this.jobs.push(job)
    this.sources.set(job.id, input.file)
    globalUploadSemaphore.resume(job.id)
    this.publish()

    const completion = this.run(job, input.createdBy)
    void completion.catch(() => undefined)
    return { jobId: job.id, completion }
  }

  async retry(jobId: string): Promise<void> {
    const job = this.findJob(jobId)
    const file = this.sources.get(jobId)
    if (!job || job.status !== "attention_required" || !file) return
    job.status = "preparing"
    job.error = null
    job.progress = uploadProgressSnapshot("uploading", 0, file.size)
    globalUploadSemaphore.resume(job.id)
    job.updatedAt = Date.now()
    this.publish()
    await this.run(job).catch(() => undefined)
  }

  async cancel(jobId: string): Promise<ZipUploadJob | null> {
    const job = this.findJob(jobId)
    if (!job || isTerminal(job.status) || job.status === "completing") {
      return job ?? null
    }
    job.status = "cancelling"
    job.error = null
    job.updatedAt = Date.now()
    this.publish()

    this.controllers.get(jobId)?.abort()
    globalUploadSemaphore.cancel(job.id)
    try {
      const result = await cancelRawZipUpload(
        job.sessionId,
        job.id,
        "user_cancelled"
      )
      if (result.status === "cancelled") {
        this.finishCancelled(job)
        return job
      }
      job.status =
        result.status === "completing" || result.status === "completed"
          ? "completing"
          : "attention_required"
      job.error =
        job.status === "completing"
          ? null
          : `Backend không hủy ZIP ở trạng thái ${result.status}.`
      job.updatedAt = Date.now()
      this.publish()
      if (job.status === "completing") {
        void this.pollCompleting(job)
      }
    } catch (error) {
      job.status = "attention_required"
      job.error = errorMessage(error)
      job.updatedAt = Date.now()
      this.publish()
    }
    return job
  }

  cancelAllBestEffort(reason: string): void {
    for (const job of this.jobs) {
      if (isTerminal(job.status) || job.status === "completing") continue
      job.status = "cancelling"
      job.error = null
      job.updatedAt = Date.now()
      this.controllers.get(job.id)?.abort()
      globalUploadSemaphore.cancel(job.id)
      void cancelRawZipUpload(job.sessionId, job.id, reason, {
        keepalive: true,
      }).catch(() => undefined)
      this.finishCancelled(job, false)
    }
    this.publish()
  }

  dismiss(jobId: string): void {
    const job = this.findJob(jobId)
    if (!job || !isTerminal(job.status)) return
    this.jobs = this.jobs.filter((item) => item.id !== jobId)
    this.sources.delete(jobId)
    this.controllers.delete(jobId)
    this.publish()
  }

  markMetadataNavigationHandled(jobId: string): void {
    const job = this.findJob(jobId)
    if (!job || job.metadataNavigationHandled) return
    job.metadataNavigationHandled = true
    job.updatedAt = Date.now()
    this.publish()
  }

  private async run(
    job: ZipUploadJob,
    createdBy = "ui"
  ): Promise<SessionInputUploadResponse> {
    const file = this.sources.get(job.id)
    if (!file) throw new Error("File ZIP nguồn không còn trong bộ nhớ của tab.")

    const controller = new AbortController()
    this.controllers.set(job.id, controller)
    try {
      const result = await uploadSessionInput(job.sessionId, "raw_zip", file, {
        createdBy,
        uploadMode: job.mode,
        maxFiles: job.maxFiles,
        signal: controller.signal,
        uploadJobId: job.id,
        onProgress: (progress) => this.updateProgress(job, progress),
      })
      job.result = result
      job.status = "completed"
      job.progress = uploadProgressSnapshot("done", file.size, file.size)
      job.error = null
      job.dockHidden = true
      job.updatedAt = Date.now()
      this.sources.delete(job.id)
      this.publish()
      return result
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) {
        if (job.status !== "cancelling") this.finishCancelled(job)
      } else {
        job.status = "attention_required"
        job.error = errorMessage(error)
        job.progress = uploadProgressSnapshot(
          "error",
          job.progress?.loadedBytes ?? 0,
          job.fileSize
        )
        job.updatedAt = Date.now()
        this.publish()
      }
      throw error
    } finally {
      if (this.controllers.get(job.id) === controller) {
        this.controllers.delete(job.id)
      }
    }
  }

  private updateProgress(
    job: ZipUploadJob,
    progress: UploadProgressSnapshot
  ): void {
    if (isTerminal(job.status) || job.status === "cancelling") return
    job.progress = progress
    job.status =
      progress.phase === "processing" || progress.phase === "done"
        ? "completing"
        : progress.phase === "error"
          ? "attention_required"
          : "uploading"
    job.updatedAt = Date.now()
    this.publish()
  }

  private async pollCompleting(job: ZipUploadJob): Promise<void> {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (job.status !== "completing") return
      try {
        const session = await getSession(job.sessionId)
        const file = session.files.find(
          (item) => item.client_upload_id === job.id
        )
        if (file?.upload_status === "completed" && file.ingestion_run) {
          job.result = file
          job.status = "completed"
          job.progress = uploadProgressSnapshot(
            "done",
            job.fileSize,
            job.fileSize
          )
          job.error = null
          job.dockHidden = true
          job.updatedAt = Date.now()
          this.sources.delete(job.id)
          this.publish()
          return
        }
      } catch {
        // Backend có thể đang hoàn tất request cũ; tiếp tục poll hữu hạn.
      }
      await new Promise((resolve) => window.setTimeout(resolve, 2_000))
    }
    if (job.status === "completing") {
      job.status = "attention_required"
      job.error =
        "Backend vẫn đang hoàn thiện file ZIP. Hãy tải lại session để kiểm tra."
      job.updatedAt = Date.now()
      this.publish()
    }
  }

  private finishCancelled(job: ZipUploadJob, publish = true): void {
    job.status = "cancelled"
    job.error = null
    job.dockHidden = true
    job.updatedAt = Date.now()
    this.sources.delete(job.id)
    if (publish) this.publish()
  }

  private findJob(jobId: string): ZipUploadJob | undefined {
    return this.jobs.find((job) => job.id === jobId)
  }

  private publish(): void {
    this.snapshot = [...this.jobs]
    for (const listener of this.listeners) listener()
  }
}

function isTerminal(status: ZipUploadJob["status"]): boolean {
  return status === "completed" || status === "cancelled"
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  )
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export const zipUploadManager = new ZipUploadManager()
