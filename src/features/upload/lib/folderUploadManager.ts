import {
  cancelFolderUpload,
  cancelFolderUploadKeepalive,
  completeFolderUploadFiles,
  createFolderUpload,
  getFolderUpload,
  heartbeatFolderUpload,
  listFolderUploadFiles,
  presignFolderUploadFiles,
  putFolderPresignedFile,
  registerFolderUploadFiles,
  sealFolderUpload,
  type FolderManifestItem,
  type FolderUploadFile,
  type FolderUploadMode,
  type FolderUploadPresignFile,
  type FolderUploadSummary,
} from "@/features/upload/api/sessionApi"
import {
  globalUploadCompleteSemaphore,
  globalUploadPutSemaphore,
} from "@/shared/lib/uploadSemaphore"

const REGISTER_WINDOW_SIZE = 200
const MAX_PUT_ATTEMPTS = 3
const RETRY_DELAYS_MS = [1_000, 2_000]
const FILE_PROGRESS_UI_STEP_PERCENT = 5
const HEARTBEAT_MS = 30_000
const SYNC_POLL_MS = 5_000
const MAX_SYNC_POLLS = 360

export type FolderUploadJobStatus =
  | "creating"
  | "uploading"
  | "attention_required"
  | "sealing"
  | "syncing"
  | "completed"
  | "cancelling"
  | "cancelled"
  | "failed"

export interface FolderUploadSource {
  file: File
  relativePath: string
}

export type FolderUploadFileProgressStatus =
  | "queued"
  | "registering"
  | "registered"
  | "presigned"
  | "uploading"
  | "uploaded"
  | "confirming"
  | "confirmed"
  | "skipped"
  | "failed"
  | "cancelled"

export interface FolderUploadFileProgress {
  sourceIndex: number
  relativePath: string
  sizeBytes: number
  localFileId: number | null
  status: FolderUploadFileProgressStatus
  uploadedBytes: number
  retryCount: number
  action: string | null
  remoteDocumentId: string | null
  error: string | null
  updatedAt: number
}

export interface FolderUploadJob {
  id: string
  kind: "folder"
  sessionId: string
  clientUploadId: string
  folderUploadId: string | null
  rootName: string
  mode: FolderUploadMode
  status: FolderUploadJobStatus
  expectedFileCount: number
  completedFileCount: number
  confirmedFileCount: number
  skippedFileCount: number
  failedFileCount: number
  percent: number
  currentPath: string | null
  nextSourceIndex: number
  records: FolderUploadFileProgress[]
  summary: FolderUploadSummary | null
  error: string | null
  createdAt: number
}

type Listener = () => void
type SummaryListener = (summary: FolderUploadSummary) => void

class FolderUploadManager {
  private readonly jobs = new Map<string, FolderUploadJob>()
  private readonly sources = new Map<string, FolderUploadSource[]>()
  private readonly controllers = new Map<string, AbortController>()
  private readonly summaryListeners = new Map<string, SummaryListener>()
  private readonly cancellationTasks = new Map<
    string,
    Promise<FolderUploadSummary | null>
  >()
  private readonly removalTimers = new Map<string, number>()
  private readonly listeners = new Set<Listener>()
  private readonly sessionLocks = new Map<
    string,
    Promise<FolderUploadSummary>
  >()
  private snapshot: FolderUploadJob[] = []
  private lifecycleUsers = 0

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): FolderUploadJob[] => this.snapshot

  restoreFromSummary(summary: FolderUploadSummary): void {
    const existing = this.snapshot.find(
      (job) =>
        job.folderUploadId === summary.folder_upload_id ||
        (job.sessionId === summary.session_id &&
          job.clientUploadId === summary.client_upload_id)
    )
    if (existing) {
      this.patchSummary(existing.id, summary)
      return
    }
    if (
      !["sealed", "cancelled"].includes(summary.status) ||
      summary.document_sync_status === "ready"
    ) {
      return
    }
    const id = `restored-folder-${summary.folder_upload_id}`
    const status: FolderUploadJobStatus =
      summary.document_sync_status === "failed"
        ? "attention_required"
        : "syncing"
    const completed = summary.counts.confirmed + summary.counts.skipped
    const job: FolderUploadJob = {
      id,
      kind: "folder",
      sessionId: summary.session_id,
      clientUploadId: summary.client_upload_id,
      folderUploadId: summary.folder_upload_id,
      rootName: summary.root_name,
      mode: summary.mode,
      status,
      expectedFileCount: summary.expected_file_count,
      completedFileCount: completed,
      confirmedFileCount: summary.counts.confirmed,
      skippedFileCount: summary.counts.skipped,
      failedFileCount: summary.counts.failed,
      percent: progressPercent(completed, summary.expected_file_count),
      currentPath: null,
      nextSourceIndex: summary.expected_file_count,
      records: [],
      summary,
      error: summary.error ?? null,
      createdAt: Date.parse(summary.created_at) || Date.now(),
    }
    this.jobs.set(id, job)
    this.emit()
    if (status === "syncing") {
      const controller = new AbortController()
      this.controllers.set(id, controller)
      const terminalStatus =
        summary.status === "cancelled" ? "cancelled" : "completed"
      const running = this.waitForDocumentSync(
        job,
        summary,
        terminalStatus,
        controller.signal
      ).finally(() => {
        this.sessionLocks.delete(job.sessionId)
        this.controllers.delete(id)
      })
      this.sessionLocks.set(job.sessionId, running)
      void running.catch(() => undefined)
    }
  }

  start(
    sessionId: string,
    sources: FolderUploadSource[],
    rootName: string,
    mode: FolderUploadMode,
    onSummary?: SummaryListener
  ): Promise<FolderUploadSummary> {
    const existing = this.sessionLocks.get(sessionId)
    if (existing) return existing
    const normalized = validateFolderSources(sources)
    const id = randomId("folder-job")
    const clientUploadId = randomId("folder-upload")
    const job: FolderUploadJob = {
      id,
      kind: "folder",
      sessionId,
      clientUploadId,
      folderUploadId: null,
      rootName,
      mode,
      status: "creating",
      expectedFileCount: normalized.length,
      completedFileCount: 0,
      confirmedFileCount: 0,
      skippedFileCount: 0,
      failedFileCount: 0,
      percent: 0,
      currentPath: null,
      nextSourceIndex: 0,
      records: normalized.map((source, sourceIndex) => ({
        sourceIndex,
        relativePath: source.relativePath,
        sizeBytes: source.file.size,
        localFileId: null,
        status: "queued",
        uploadedBytes: 0,
        retryCount: 0,
        action: null,
        remoteDocumentId: null,
        error: null,
        updatedAt: Date.now(),
      })),
      summary: null,
      error: null,
      createdAt: Date.now(),
    }
    this.jobs.set(id, job)
    this.sources.set(id, normalized)
    this.controllers.set(id, new AbortController())
    if (onSummary) this.summaryListeners.set(id, onSummary)
    this.emit()

    const running = this.run(job).finally(() => {
      this.sessionLocks.delete(sessionId)
      this.controllers.delete(id)
      if (isTerminal(this.jobs.get(id)?.status)) {
        this.releaseTerminalJob(id)
      }
    })
    this.sessionLocks.set(sessionId, running)
    return running
  }

  async cancel(jobId: string, reason = "user_cancelled"): Promise<void> {
    const job = this.jobs.get(jobId)
    if (
      !job ||
      isTerminal(job.status) ||
      job.status === "sealing" ||
      job.status === "syncing"
    ) {
      return
    }
    this.patch(jobId, { status: "cancelling" })
    this.patchUnfinishedFilesAsCancelled(jobId)
    this.controllers.get(jobId)?.abort()
    globalUploadPutSemaphore.cancelQueued(jobId)
    globalUploadCompleteSemaphore.cancelQueued(jobId)
    if (!job.folderUploadId) {
      // The create request is deliberately allowed to finish. Once the
      // server-side id is known, run() observes the aborted controller and
      // cancels that exact attempt instead of leaving an orphan upload.
      return
    }
    await this.finishCancellation(job, reason)
  }

  retry(jobId: string): Promise<FolderUploadSummary> {
    const job = this.jobs.get(jobId)
    if (!job || job.status !== "attention_required" || !job.folderUploadId) {
      return Promise.reject(
        new Error("Folder upload này không có file lỗi có thể thử lại.")
      )
    }
    const existing = this.sessionLocks.get(job.sessionId)
    if (existing) return existing
    if (!this.sources.has(jobId)) {
      return Promise.reject(
        new Error(
          "Nguồn PDF không còn trong bộ nhớ. Hãy hủy attempt cũ rồi chọn lại folder."
        )
      )
    }
    const controller = new AbortController()
    this.controllers.set(jobId, controller)
    this.patch(jobId, {
      status: "uploading",
      error: null,
      currentPath: null,
    })
    const running = this.retryFailed(job, controller.signal).finally(() => {
      this.sessionLocks.delete(job.sessionId)
      this.controllers.delete(jobId)
      if (isTerminal(this.jobs.get(jobId)?.status)) {
        this.releaseTerminalJob(jobId)
      }
    })
    this.sessionLocks.set(job.sessionId, running)
    return running
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

  private async run(job: FolderUploadJob): Promise<FolderUploadSummary> {
    const sources = this.sources.get(job.id) ?? []
    const controller = this.controllers.get(job.id)!
    let heartbeatId: number | undefined
    try {
      let summary = await createFolderUpload(job.sessionId, {
        client_upload_id: job.clientUploadId,
        mode: job.mode,
        root_name: job.rootName,
        expected_file_count: sources.length,
        expected_total_bytes: sources.reduce(
          (total, source) => total + source.file.size,
          0
        ),
      })
      job.folderUploadId = summary.folder_upload_id
      this.patchFromSummary(job.id, summary, "uploading")
      throwIfAborted(controller.signal)
      heartbeatId = window.setInterval(() => {
        if (!job.folderUploadId) return
        void heartbeatFolderUpload(job.sessionId, job.folderUploadId).catch(
          () => undefined
        )
      }, HEARTBEAT_MS)

      await this.uploadRemainingWindows(job, sources, controller.signal)
      summary = await this.sealAndSync(job, controller.signal)
      return summary
    } catch (error) {
      const current = this.jobs.get(job.id)
      if (
        current?.status === "cancelling" ||
        current?.status === "cancelled" ||
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
    } finally {
      if (heartbeatId !== undefined) window.clearInterval(heartbeatId)
    }
  }

  private async uploadRemainingWindows(
    job: FolderUploadJob,
    sources: FolderUploadSource[],
    signal: AbortSignal
  ): Promise<void> {
    for (
      let start = job.nextSourceIndex;
      start < sources.length;
      start += REGISTER_WINDOW_SIZE
    ) {
      throwIfAborted(signal)
      const windowSources = sources.slice(start, start + REGISTER_WINDOW_SIZE)
      this.patchFileRange(job.id, start, windowSources.length, {
        status: "registering",
        error: null,
      })
      let registered
      try {
        registered = await registerFolderUploadFiles(
          job.sessionId,
          job.folderUploadId!,
          windowSources.map(folderManifestItem),
          signal
        )
      } catch (error) {
        this.patchFileRange(job.id, start, windowSources.length, {
          status: "failed",
          error: errorMessage(error),
        })
        throw error
      }
      this.patch(job.id, {
        nextSourceIndex: start + windowSources.length,
      })
      this.applyServerFiles(job.id, registered.files)
      this.patchCounts(job.id, registered.counts)
      const localByPath = new Map(
        windowSources.map((source) => [source.relativePath, source])
      )
      const results = await this.uploadRegisteredFiles(
        job,
        registered.files,
        localByPath,
        signal
      )
      const failures = results.filter((result) => result.status === "rejected")
      const summary = await getFolderUpload(
        job.sessionId,
        job.folderUploadId!,
        signal
      )
      this.patchFromSummary(
        job.id,
        summary,
        failures.length > 0 ? "attention_required" : "uploading"
      )
      if (failures.length > 0) {
        throw new Error(
          `${failures.length} PDF chưa upload được. Các file đã hoàn tất vẫn được giữ lại.`
        )
      }
    }
  }

  private async uploadRegisteredFiles(
    job: FolderUploadJob,
    registeredFiles: FolderUploadFile[],
    sourceByPath: Map<string, FolderUploadSource>,
    signal: AbortSignal
  ): Promise<PromiseSettledResult<void>[]> {
    const candidates = registeredFiles.filter(
      (file) => !["confirmed", "skipped"].includes(file.status)
    )
    if (candidates.length === 0) return []

    let presignedByFileId: Map<number, FolderUploadPresignFile>
    try {
      // Presign the register window once. Per-file presign is reserved for a
      // retry so control-plane requests cannot starve unrelated API traffic.
      const presigned = await presignFolderUploadFiles(
        job.sessionId,
        job.folderUploadId!,
        candidates.map((file) => file.file_id),
        signal
      )
      presignedByFileId = new Map(
        presigned.files.map((contract) => [contract.file_id, contract])
      )
    } catch (error) {
      if (!signal.aborted) {
        for (const file of candidates) {
          this.patchFile(job.id, file.normalized_relative_path, {
            status: "failed",
            error: errorMessage(error),
          })
        }
      }
      throw error
    }

    return Promise.allSettled(
      candidates.map((file) => {
        const source = sourceByPath.get(file.normalized_relative_path)
        if (!source) {
          return Promise.reject(
            new Error(`Không tìm thấy source cho ${file.relative_path}.`)
          )
        }
        const initialContract = presignedByFileId.get(file.file_id)
        if (!initialContract) {
          const error = new Error(
            `Backend không trả về presigned URL cho ${file.relative_path}.`
          )
          this.patchFile(job.id, file.normalized_relative_path, {
            status: "failed",
            error: error.message,
          })
          return Promise.reject(error)
        }
        return this.uploadOne(job, file, source, signal, initialContract)
      })
    )
  }

  private async retryFailed(
    job: FolderUploadJob,
    signal: AbortSignal
  ): Promise<FolderUploadSummary> {
    let heartbeatId: number | undefined
    try {
      heartbeatId = window.setInterval(() => {
        if (!job.folderUploadId) return
        void heartbeatFolderUpload(job.sessionId, job.folderUploadId).catch(
          () => undefined
        )
      }, HEARTBEAT_MS)
      const serverFailedFiles = await this.listFailedFiles(job, signal)
      this.applyServerFiles(job.id, serverFailedFiles)
      const serverById = new Map(
        serverFailedFiles.map((file) => [file.file_id, file])
      )
      const failedFiles = (this.jobs.get(job.id)?.records ?? [])
        .filter(
          (record) => record.status === "failed" && record.localFileId !== null
        )
        .map(
          (record) =>
            serverById.get(record.localFileId!) ?? progressRecordAsFile(record)
        )
      const sourceByPath = new Map(
        (this.sources.get(job.id) ?? []).map((source) => [
          source.relativePath,
          source,
        ])
      )
      const results = await this.uploadRegisteredFiles(
        job,
        failedFiles,
        sourceByPath,
        signal
      )
      const failures = results.filter((result) => result.status === "rejected")
      let summary = await getFolderUpload(
        job.sessionId,
        job.folderUploadId!,
        signal
      )
      if (failures.length > 0 || summary.counts.failed > 0) {
        this.patchFromSummary(job.id, summary, "attention_required")
        throw new Error(
          `${Math.max(failures.length, summary.counts.failed)} PDF vẫn chưa upload được.`
        )
      }
      await this.uploadRemainingWindows(
        job,
        this.sources.get(job.id) ?? [],
        signal
      )
      summary = await this.sealAndSync(job, signal)
      return summary
    } catch (error) {
      const current = this.jobs.get(job.id)
      if (
        current?.status === "cancelling" ||
        current?.status === "cancelled" ||
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
    } finally {
      if (heartbeatId !== undefined) window.clearInterval(heartbeatId)
    }
  }

  private async listFailedFiles(
    job: FolderUploadJob,
    signal: AbortSignal
  ): Promise<FolderUploadFile[]> {
    const files: FolderUploadFile[] = []
    let afterId: number | undefined
    while (true) {
      const page = await listFolderUploadFiles(
        job.sessionId,
        job.folderUploadId!,
        {
          status: "failed",
          afterId,
          limit: 500,
          signal,
        }
      )
      files.push(...page.items)
      if (!page.has_more || page.next_after_id == null) return files
      afterId = page.next_after_id
    }
  }

  private async sealAndSync(
    job: FolderUploadJob,
    signal: AbortSignal
  ): Promise<FolderUploadSummary> {
    this.patch(job.id, { status: "sealing", currentPath: null })
    const summary = await sealFolderUpload(
      job.sessionId,
      job.folderUploadId!,
      signal
    )
    this.patchFromSummary(job.id, summary, "syncing")
    return this.waitForDocumentSync(job, summary, "completed", signal)
  }

  private async waitForDocumentSync(
    job: FolderUploadJob,
    initial: FolderUploadSummary,
    terminalStatus: "completed" | "cancelled",
    signal: AbortSignal
  ): Promise<FolderUploadSummary> {
    let summary = initial
    for (let attempt = 0; attempt < MAX_SYNC_POLLS; attempt += 1) {
      throwIfAborted(signal)
      if (summary.document_sync_status === "ready") {
        this.patchFromSummary(job.id, summary, terminalStatus)
        this.releaseTerminalJob(job.id)
        return summary
      }
      if (summary.document_sync_status === "failed") {
        throw new Error(
          summary.error || "Không thể đối soát document của folder upload."
        )
      }
      await abortableDelay(SYNC_POLL_MS, signal)
      summary = await getFolderUpload(
        job.sessionId,
        job.folderUploadId!,
        signal
      )
      this.patchFromSummary(job.id, summary, "syncing")
    }
    throw new Error("Quá thời gian chờ đối soát document folder upload.")
  }

  private finishCancellation(
    job: FolderUploadJob,
    reason: string
  ): Promise<FolderUploadSummary | null> {
    const existing = this.cancellationTasks.get(job.id)
    if (existing) return existing
    const task = (async () => {
      if (!job.folderUploadId) {
        this.patch(job.id, { status: "cancelled", error: null })
        this.releaseTerminalJob(job.id)
        return null
      }
      try {
        let summary = await cancelFolderUpload(
          job.sessionId,
          job.folderUploadId,
          reason
        )
        if (
          summary.counts.effective > 0 &&
          summary.document_sync_status !== "ready"
        ) {
          this.patchFromSummary(job.id, summary, "syncing")
          summary = await this.waitForDocumentSync(
            job,
            summary,
            "cancelled",
            new AbortController().signal
          )
        } else {
          this.patchFromSummary(job.id, summary, "cancelled")
          this.releaseTerminalJob(job.id)
        }
        return summary
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

  private async uploadOne(
    job: FolderUploadJob,
    registered: FolderUploadFile,
    source: FolderUploadSource,
    signal: AbortSignal,
    initialContract?: FolderUploadPresignFile
  ): Promise<void> {
    let etag: string | null = null
    let putSucceeded = false
    let lastPutError: unknown
    for (let attempt = 0; attempt < MAX_PUT_ATTEMPTS; attempt += 1) {
      throwIfAborted(signal)
      this.patchFile(job.id, source.relativePath, {
        status: "registered",
        localFileId: registered.file_id,
        uploadedBytes: 0,
        retryCount: attempt,
        error: null,
      })
      this.patch(job.id, { currentPath: source.relativePath })
      let contract = initialContract
      // A failed PUT must receive a fresh signed URL on its next attempt.
      initialContract = undefined
      try {
        if (!contract) {
          const presigned = await presignFolderUploadFiles(
            job.sessionId,
            job.folderUploadId!,
            [registered.file_id],
            signal
          )
          contract = presigned.files[0]
        }
        if (!contract) throw new Error("Backend không trả về presigned URL.")
      } catch (error) {
        if (!signal.aborted) {
          this.patchFile(job.id, source.relativePath, {
            status: "failed",
            error: errorMessage(error),
          })
        }
        throw error
      }
      this.patchFile(job.id, source.relativePath, {
        status: "presigned",
      })
      try {
        etag = await globalUploadPutSemaphore.run(
          job.id,
          () =>
            putFolderPresignedFile(
              contract,
              source.file,
              signal,
              (loadedBytes) => {
                const current = this.fileRecord(job.id, source.relativePath)
                const currentPercent = fileProgressPercent(
                  current?.uploadedBytes ?? 0,
                  source.file.size
                )
                const nextPercent = fileProgressPercent(
                  loadedBytes,
                  source.file.size
                )
                const currentProgressStep = Math.floor(
                  currentPercent / FILE_PROGRESS_UI_STEP_PERCENT
                )
                const nextProgressStep = Math.floor(
                  nextPercent / FILE_PROGRESS_UI_STEP_PERCENT
                )
                if (
                  current?.status !== "uploading" ||
                  currentProgressStep !== nextProgressStep ||
                  nextPercent === 100
                ) {
                  this.patchFile(job.id, source.relativePath, {
                    status: "uploading",
                    uploadedBytes: loadedBytes,
                  })
                }
              }
            ),
          signal
        )
        this.patchFile(job.id, source.relativePath, {
          status: "uploaded",
          uploadedBytes: source.file.size,
        })
        putSucceeded = true
        break
      } catch (error) {
        lastPutError = error
        if (signal.aborted) throw error
        if (attempt < RETRY_DELAYS_MS.length) {
          this.patchFile(job.id, source.relativePath, {
            status: "failed",
            retryCount: attempt + 1,
            error: errorMessage(error),
          })
          await abortableDelay(RETRY_DELAYS_MS[attempt], signal)
          continue
        }
        this.patchFile(job.id, source.relativePath, {
          status: "failed",
          retryCount: attempt + 1,
          error: errorMessage(error),
        })
        throw error
      }
    }
    if (!putSucceeded) throw lastPutError

    this.patchFile(job.id, source.relativePath, { status: "confirming" })
    try {
      const completed = await globalUploadCompleteSemaphore.run(
        job.id,
        () =>
          completeFolderUploadFiles(
            job.sessionId,
            job.folderUploadId!,
            [
              {
                file_id: registered.file_id,
                size_bytes: source.file.size,
                ...(etag ? { etag } : {}),
              },
            ],
            signal
          ),
        signal
      )
      const result = completed.files[0]
      if (result) this.applyServerFiles(job.id, [result])
      this.patchCounts(job.id, completed.counts)
      if (!result || !["confirmed", "skipped"].includes(result.status)) {
        throw new Error(
          folderFileError(result?.error) ||
            `Complete thất bại cho ${source.relativePath}.`
        )
      }
    } catch (error) {
      if (!signal.aborted) {
        this.patchFile(job.id, source.relativePath, {
          status: "failed",
          error: errorMessage(error),
        })
      }
      throw error
    }
  }

  private fileRecord(
    jobId: string,
    relativePath: string
  ): FolderUploadFileProgress | undefined {
    return this.jobs
      .get(jobId)
      ?.records.find((record) => record.relativePath === relativePath)
  }

  private patchFile(
    jobId: string,
    relativePath: string,
    patch: Partial<FolderUploadFileProgress>
  ): void {
    const job = this.jobs.get(jobId)
    if (!job) return
    let changed = false
    const records = job.records.map((record) => {
      if (record.relativePath !== relativePath) return record
      changed = true
      return { ...record, ...patch, updatedAt: Date.now() }
    })
    if (changed) {
      this.patch(jobId, {
        records,
        failedFileCount: records.filter((record) => record.status === "failed")
          .length,
      })
    }
  }

  private patchFileRange(
    jobId: string,
    start: number,
    count: number,
    patch: Partial<FolderUploadFileProgress>
  ): void {
    const job = this.jobs.get(jobId)
    if (!job) return
    const end = start + count
    const updatedAt = Date.now()
    const records = job.records.map((record) =>
      record.sourceIndex >= start && record.sourceIndex < end
        ? { ...record, ...patch, updatedAt }
        : record
    )
    this.patch(jobId, {
      records,
      failedFileCount: records.filter((record) => record.status === "failed")
        .length,
    })
  }

  private patchUnfinishedFilesAsCancelled(jobId: string): void {
    const job = this.jobs.get(jobId)
    if (!job) return
    const updatedAt = Date.now()
    this.patch(jobId, {
      records: job.records.map((record) =>
        ["confirmed", "skipped"].includes(record.status)
          ? record
          : {
              ...record,
              status: "cancelled" as const,
              error: null,
              updatedAt,
            }
      ),
      failedFileCount: 0,
      currentPath: null,
    })
  }

  private applyServerFiles(jobId: string, files: FolderUploadFile[]): void {
    if (files.length === 0) return
    const job = this.jobs.get(jobId)
    if (!job) return
    const byClientId = new Map(files.map((file) => [file.client_file_id, file]))
    const byPath = new Map(
      files.map((file) => [file.normalized_relative_path, file])
    )
    const updatedAt = Date.now()
    const records = job.records.map((record) => {
      const file =
        byClientId.get(record.relativePath) ?? byPath.get(record.relativePath)
      if (!file) return record
      return {
        ...record,
        localFileId: file.file_id,
        status: serverFileProgressStatus(file.status),
        uploadedBytes: ["confirmed", "skipped"].includes(file.status)
          ? record.sizeBytes
          : record.uploadedBytes,
        retryCount: Math.max(record.retryCount, file.attempt_count ?? 0),
        action: file.action ?? null,
        remoteDocumentId: file.remote_document_id ?? null,
        error: folderFileError(file.error),
        updatedAt,
      }
    })
    this.patch(jobId, {
      records,
      failedFileCount: records.filter((record) => record.status === "failed")
        .length,
    })
  }

  private patchSummary(jobId: string, summary: FolderUploadSummary): void {
    const completed = summary.counts.confirmed + summary.counts.skipped
    this.patch(jobId, {
      folderUploadId: summary.folder_upload_id,
      summary,
      error: summary.error ?? null,
      expectedFileCount: summary.expected_file_count,
      completedFileCount: completed,
      confirmedFileCount: summary.counts.confirmed,
      skippedFileCount: summary.counts.skipped,
      failedFileCount: summary.counts.failed,
      percent: progressPercent(completed, summary.expected_file_count),
    })
    this.summaryListeners.get(jobId)?.(summary)
  }

  private patchFromSummary(
    jobId: string,
    summary: FolderUploadSummary,
    status: FolderUploadJobStatus
  ): void {
    this.patch(jobId, {
      folderUploadId: summary.folder_upload_id,
      summary,
      status,
      error: summary.error ?? null,
      completedFileCount: summary.counts.confirmed + summary.counts.skipped,
      confirmedFileCount: summary.counts.confirmed,
      skippedFileCount: summary.counts.skipped,
      failedFileCount: summary.counts.failed,
      percent: progressPercent(
        summary.counts.confirmed + summary.counts.skipped,
        summary.expected_file_count
      ),
    })
    this.summaryListeners.get(jobId)?.(summary)
  }

  private patchCounts(
    jobId: string,
    counts: FolderUploadSummary["counts"]
  ): void {
    const job = this.jobs.get(jobId)
    if (!job) return
    const completed = counts.confirmed + counts.skipped
    this.patch(jobId, {
      completedFileCount: completed,
      confirmedFileCount: counts.confirmed,
      skippedFileCount: counts.skipped,
      failedFileCount: counts.failed,
      percent: progressPercent(completed, job.expectedFileCount),
    })
  }

  private patch(jobId: string, patch: Partial<FolderUploadJob>): void {
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
    this.sources.delete(jobId)
    this.controllers.delete(jobId)
    this.summaryListeners.delete(jobId)
    globalUploadPutSemaphore.cancelQueued(jobId)
    globalUploadCompleteSemaphore.cancelQueued(jobId)
    if (this.removalTimers.has(jobId)) return
    const timerId = window.setTimeout(() => {
      this.removalTimers.delete(jobId)
      this.jobs.delete(jobId)
      this.emit()
    }, 8_000)
    this.removalTimers.set(jobId, timerId)
  }

  private beforeUnload = (event: BeforeUnloadEvent): void => {
    if (!this.snapshot.some((job) => !isTerminal(job.status))) return
    event.preventDefault()
    event.returnValue = ""
  }

  private pageHide = (): void => {
    for (const job of this.snapshot) {
      if (
        !job.folderUploadId ||
        isTerminal(job.status) ||
        job.status === "sealing" ||
        job.status === "syncing"
      ) {
        continue
      }
      this.controllers.get(job.id)?.abort()
      globalUploadPutSemaphore.cancelQueued(job.id)
      globalUploadCompleteSemaphore.cancelQueued(job.id)
      cancelFolderUploadKeepalive(
        job.sessionId,
        job.folderUploadId,
        "page_closed"
      )
    }
  }
}

function folderManifestItem(source: FolderUploadSource): FolderManifestItem {
  return {
    client_file_id: source.relativePath,
    relative_path: source.relativePath,
    size_bytes: source.file.size,
    content_type: "application/pdf",
  }
}

function progressRecordAsFile(
  record: FolderUploadFileProgress
): FolderUploadFile {
  const now = new Date(record.updatedAt).toISOString()
  return {
    file_id: record.localFileId!,
    client_file_id: record.relativePath,
    relative_path: record.relativePath,
    normalized_relative_path: record.relativePath,
    size_bytes: record.sizeBytes,
    content_type: "application/pdf",
    status: "failed",
    action: record.action,
    remote_document_id: record.remoteDocumentId,
    attempt_count: record.retryCount,
    error: record.error,
    created_at: now,
    updated_at: now,
  }
}

function serverFileProgressStatus(
  status: FolderUploadFile["status"]
): FolderUploadFileProgressStatus {
  return status
}

function folderFileError(error: unknown): string | null {
  if (typeof error === "string") return error || null
  if (!error || typeof error !== "object") return null
  const record = error as Record<string, unknown>
  const message = record.message ?? record.detail ?? record.code
  return typeof message === "string" && message.trim() ? message.trim() : null
}

function fileProgressPercent(loadedBytes: number, totalBytes: number): number {
  if (totalBytes <= 0) return 0
  return Math.min(
    100,
    Math.floor((Math.max(0, loadedBytes) / totalBytes) * 100)
  )
}

export function validateFolderSources(
  sources: FolderUploadSource[]
): FolderUploadSource[] {
  const seen = new Set<string>()
  const result: FolderUploadSource[] = []
  for (const source of sources) {
    const relativePath = normalizeRelativePath(source.relativePath)
    if (source.file.size <= 0 || !relativePath.toLowerCase().endsWith(".pdf")) {
      continue
    }
    if (seen.has(relativePath)) {
      throw new Error(`Đường dẫn PDF bị trùng: ${relativePath}`)
    }
    seen.add(relativePath)
    result.push({ file: source.file, relativePath })
  }
  if (result.length === 0) {
    throw new Error("Folder không có file PDF hợp lệ và khác rỗng.")
  }
  return result
}

function normalizeRelativePath(value: string): string {
  const normalized = value.replaceAll("\\", "/").replace(/^\.\/+/, "")
  const parts = normalized.split("/")
  if (
    normalized.startsWith("/") ||
    /^[A-Za-z]:\//.test(normalized) ||
    parts.some((part) => !part || part === "." || part === "..")
  ) {
    throw new Error(`Đường dẫn folder không hợp lệ: ${value}`)
  }
  return parts.join("/")
}

function progressPercent(done: number, expected: number): number {
  return expected > 0
    ? Math.min(100, Math.round((done / expected) * 1000) / 10)
    : 0
}

function randomId(prefix: string): string {
  const id =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `${prefix}-${id}`
}

function isTerminal(status: FolderUploadJobStatus | undefined): boolean {
  return Boolean(
    status && ["completed", "cancelled", "failed"].includes(status)
  )
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new DOMException("Upload đã bị hủy.", "AbortError")
  }
}

function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      window.clearTimeout(timeoutId)
      reject(new DOMException("Upload đã bị hủy.", "AbortError"))
    }
    const timeoutId = window.setTimeout(() => {
      signal.removeEventListener("abort", abort)
      resolve()
    }, ms)
    signal.addEventListener("abort", abort, { once: true })
  })
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Folder upload thất bại."
}

export const folderUploadManager = new FolderUploadManager()
