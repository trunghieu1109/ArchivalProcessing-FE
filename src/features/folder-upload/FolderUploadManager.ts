import {
  cancelFolderUpload,
  completeFolderFiles,
  createFolderUpload,
  getFolderUpload,
  heartbeatFolderUpload,
  presignFolderFiles,
  registerFolderFiles,
  sealFolderUpload,
} from "./folderUploadApi"
import type {
  FolderUploadFileState,
  FolderUploadJob,
  FolderUploadStartInput,
  FolderUploadSummary,
  PresignedFolderFile,
  RegisteredFolderFilesResponse,
} from "./types"
import {
  globalUploadSemaphore,
  UploadSemaphore,
} from "@/shared/lib/uploadSemaphore"

const REGISTER_WINDOW_SIZE = 200
const MAX_UPLOAD_ATTEMPTS = 3
const FILE_PROGRESS_UI_STEP_PERCENT = 5
const HEARTBEAT_INTERVAL_MS = 30_000
const RECONCILE_POLL_INTERVAL_MS = 5_000

type Listener = () => void
type SourceFiles = FileList | File[]

interface PutResult {
  fileId: number
  sizeBytes: number
  etag?: string
}

export class FolderUploadManager {
  private jobs: FolderUploadJob[] = []
  private snapshot: readonly FolderUploadJob[] = []
  private readonly listeners = new Set<Listener>()
  private readonly sources = new Map<string, SourceFiles>()
  private readonly cursors = new Map<string, number>()
  private readonly pendingWindows = new Map<string, FolderUploadFileState[]>()
  private readonly pendingWindowEnds = new Map<string, number>()
  private readonly aborters = new Map<string, Set<XMLHttpRequest>>()
  private readonly controllers = new Map<string, AbortController>()
  private readonly completeSemaphore = new UploadSemaphore(4)
  private heartbeatTimer: number | null = null

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): readonly FolderUploadJob[] => this.snapshot

  start(input: FolderUploadStartInput): string {
    const manifest = buildManifest(input.files)
    if (!manifest.files.length) {
      throw new Error("Thư mục không có file PDF hợp lệ để tải lên.")
    }
    const id = crypto.randomUUID()
    const now = Date.now()
    const job: FolderUploadJob = {
      id,
      sessionId: input.sessionId,
      folderUploadId: null,
      rootName: manifest.rootName,
      mode: input.mode,
      status: "preparing",
      files: manifest.files,
      totalBytes: manifest.files.reduce(
        (total, file) => total + file.sizeBytes,
        0
      ),
      uploadedBytes: 0,
      startedAt: now,
      updatedAt: now,
      error: null,
      summary: null,
      dockHidden: false,
      metadataNavigationHandled: false,
    }
    this.jobs.push(job)
    this.sources.set(id, input.files)
    this.cursors.set(id, 0)
    this.controllers.set(id, new AbortController())
    globalUploadSemaphore.resume(id)
    this.completeSemaphore.resume(id)
    this.publish()
    this.ensureHeartbeat()
    void this.createAndRun(job)
    return id
  }

  async retry(jobId: string): Promise<void> {
    const job = this.findJob(jobId)
    if (!job || job.status !== "attention_required") return
    this.ensureController(job.id)
    globalUploadSemaphore.resume(job.id)
    this.completeSemaphore.resume(job.id)
    if (!this.sources.has(job.id) && job.folderUploadId) {
      job.error = null
      job.status = "reconciling"
      this.touch(job)
      try {
        await this.pollReconciliation(job)
      } catch (error) {
        this.failJob(job, error)
      }
      return
    }
    job.error = null
    job.status = "uploading"
    for (const file of job.files) {
      if (file.status === "failed") {
        file.status = file.remoteFileId ? "registered" : "queued"
        file.error = null
        file.attempts = 0
        this.setFileProgress(job, file, 0)
      }
    }
    this.touch(job)
    const pending = this.pendingWindows.get(job.id)
    if (pending?.length) {
      const succeeded = await this.uploadRemoteWindow(job, pending)
      if (!succeeded) return
      this.pendingWindows.delete(job.id)
      this.cursors.set(
        job.id,
        this.pendingWindowEnds.get(job.id) ??
          (this.cursors.get(job.id) ?? 0) + pending.length
      )
      this.pendingWindowEnds.delete(job.id)
    }
    await this.processRemainingWindows(job)
  }

  async cancel(
    jobId: string,
    reason = "user_cancelled"
  ): Promise<FolderUploadSummary | null> {
    const job = this.findJob(jobId)
    if (
      !job ||
      isTerminal(job.status) ||
      job.summary?.status === "sealed" ||
      ["sealing", "reconciling"].includes(job.status)
    ) {
      return job?.summary ?? null
    }
    job.status = "cancelling"
    job.error = null
    this.controllers.get(job.id)?.abort()
    globalUploadSemaphore.cancel(job.id)
    this.completeSemaphore.cancel(job.id)
    this.abortJobRequests(job.id)
    this.touch(job)
    try {
      if (job.folderUploadId) {
        job.summary = await cancelFolderUpload(
          job.sessionId,
          job.folderUploadId,
          reason
        )
      }
      this.markUnfinishedCancelled(job)
      job.status = "cancelled"
      job.dockHidden = false
      job.metadataNavigationHandled = true
      job.files = []
      this.ensureController(job.id)
      if (
        job.folderUploadId &&
        job.summary &&
        !["ready", "failed"].includes(job.summary.document_sync_status)
      ) {
        void this.pollReconciliation(job).catch((error) =>
          this.failJob(job, error)
        )
      }
    } catch (error) {
      job.status = "attention_required"
      job.error = errorMessage(error)
    }
    this.touch(job)
    return job.summary
  }

  cancelAllBestEffort(reason: string): void {
    for (const job of this.jobs) {
      if (
        isTerminal(job.status) ||
        ["sealing", "reconciling"].includes(job.status)
      ) {
        continue
      }
      this.controllers.get(job.id)?.abort()
      globalUploadSemaphore.cancel(job.id)
      this.completeSemaphore.cancel(job.id)
      this.abortJobRequests(job.id)
      this.markUnfinishedCancelled(job)
      job.status = "cancelled"
      job.dockHidden = false
      job.metadataNavigationHandled = true
      job.files = []
      job.updatedAt = Date.now()
      if (job.folderUploadId) {
        void cancelFolderUpload(job.sessionId, job.folderUploadId, reason, {
          keepalive: true,
        }).catch(() => undefined)
      }
    }
    this.publish()
  }

  dismiss(jobId: string): void {
    const job = this.findJob(jobId)
    if (!job || !isTerminal(job.status)) return
    job.dockHidden = true
    this.touch(job)
  }

  markMetadataNavigationHandled(jobId: string): void {
    const job = this.findJob(jobId)
    if (!job || job.metadataNavigationHandled) return
    job.metadataNavigationHandled = true
    this.touch(job)
  }

  restoreFromSummary(summary: FolderUploadSummary): void {
    const existing = this.jobs.find(
      (job) =>
        job.folderUploadId === summary.folder_upload_id ||
        (job.sessionId === summary.session_id &&
          job.id === summary.client_upload_id)
    )
    const ready = summary.document_sync_status === "ready"
    if (existing) {
      existing.summary = summary
      if (ready) {
        this.completeJob(existing, summary)
      } else {
        this.touch(existing)
      }
      return
    }
    if (
      ![
        "open",
        "uploading",
        "attention_required",
        "sealed",
        "cancelled",
        "failed",
      ].includes(summary.status)
    ) {
      return
    }

    const now = Date.now()
    const interrupted = summary.status !== "sealed"
    const restored: FolderUploadJob = {
      id: summary.client_upload_id || `restored:${summary.folder_upload_id}`,
      sessionId: summary.session_id,
      folderUploadId: summary.folder_upload_id,
      rootName: summary.root_name,
      mode: summary.mode,
      status:
        summary.document_sync_status === "failed"
          ? "attention_required"
          : ready
            ? "completed"
            : "reconciling",
      files: [],
      totalBytes: summary.expected_total_bytes,
      uploadedBytes: summary.expected_total_bytes,
      startedAt: Date.parse(summary.created_at) || now,
      updatedAt: Date.parse(summary.updated_at) || now,
      error: summary.error,
      summary,
      dockHidden: interrupted || ready,
      metadataNavigationHandled: interrupted || ready,
    }
    this.jobs.push(restored)
    this.publish()
    if (
      !ready &&
      summary.status !== "failed" &&
      summary.document_sync_status !== "failed"
    ) {
      void this.pollReconciliation(restored).catch((error) =>
        this.failJob(restored, error)
      )
    }
  }

  private async createAndRun(job: FolderUploadJob): Promise<void> {
    try {
      const summary = await createFolderUpload(
        job.sessionId,
        {
          client_upload_id: job.id,
          mode: job.mode,
          root_name: job.rootName,
          expected_file_count: job.files.length,
          expected_total_bytes: job.totalBytes,
        },
        this.signalFor(job.id)
      )
      job.folderUploadId = summary.folder_upload_id
      job.summary = summary
      job.status = "uploading"
      this.touch(job)
      await this.processRemainingWindows(job)
    } catch (error) {
      this.failJob(job, error)
    }
  }

  private async processRemainingWindows(job: FolderUploadJob): Promise<void> {
    if (!job.folderUploadId || isTerminal(job.status)) return
    let cursor = this.cursors.get(job.id) ?? 0
    while (cursor < job.files.length) {
      if (job.status === "cancelling" || job.status === "cancelled") return
      const windowFiles = job.files.slice(cursor, cursor + REGISTER_WINDOW_SIZE)
      let registered: RegisteredFolderFilesResponse
      try {
        for (const file of windowFiles) file.status = "registering"
        this.touch(job)
        registered = await registerFolderFiles(
          job.sessionId,
          job.folderUploadId,
          windowFiles.map((file) => ({
            client_file_id: file.clientFileId,
            relative_path: file.relativePath,
            size_bytes: file.sizeBytes,
            content_type: "application/pdf" as const,
          })),
          this.signalFor(job.id)
        )
        this.applyRegisteredFiles(job, windowFiles, registered)
      } catch (error) {
        for (const file of windowFiles) {
          if (file.status === "registering") {
            file.status = "failed"
            file.error = errorMessage(error)
          }
        }
        this.failJob(job, error)
        return
      }

      const uploadable = windowFiles.filter(
        (file) =>
          file.remoteFileId !== null &&
          file.status !== "skipped" &&
          file.status !== "confirmed"
      )
      this.pendingWindows.set(job.id, uploadable)
      this.pendingWindowEnds.set(job.id, cursor + windowFiles.length)
      if (uploadable.length) {
        const succeeded = await this.uploadRemoteWindow(job, uploadable)
        if (!succeeded) return
      }
      this.pendingWindows.delete(job.id)
      this.pendingWindowEnds.delete(job.id)
      cursor += windowFiles.length
      this.cursors.set(job.id, cursor)
    }
    await this.sealAndReconcile(job)
  }

  private async uploadRemoteWindow(
    job: FolderUploadJob,
    files: FolderUploadFileState[]
  ): Promise<boolean> {
    if (!job.folderUploadId) return false
    const candidates = files.filter(
      (file) => !["confirmed", "skipped"].includes(file.status)
    )
    if (!candidates.length) return true
    let presignedById: Map<number, PresignedFolderFile>
    try {
      const presigned = await presignFolderFiles(
        job.sessionId,
        job.folderUploadId,
        candidates
          .map((file) => file.remoteFileId)
          .filter((fileId): fileId is number => fileId !== null),
        this.signalFor(job.id)
      )
      presignedById = new Map(
        presigned.files.map((file) => [file.file_id, file])
      )
      for (const file of candidates) {
        if (
          file.remoteFileId !== null &&
          presignedById.has(file.remoteFileId)
        ) {
          file.status = "presigned"
        }
      }
      this.touch(job)
    } catch (error) {
      for (const file of candidates) {
        file.status = "failed"
        file.error = errorMessage(error)
      }
      this.failJob(job, error)
      return false
    }
    await Promise.allSettled(
      candidates.map((file) =>
        this.uploadAndCompleteFile(
          job,
          file,
          file.remoteFileId === null
            ? undefined
            : presignedById.get(file.remoteFileId)
        )
      )
    )
    if (job.status === "cancelling" || job.status === "cancelled") return false
    const failed = candidates.filter((file) => file.status === "failed")
    if (failed.length) {
      job.status = "attention_required"
      job.error = `${failed.length} file tải lên chưa thành công.`
      this.touch(job)
      return false
    }
    return true
  }

  private async uploadAndCompleteFile(
    job: FolderUploadJob,
    file: FolderUploadFileState,
    initialPresigned?: PresignedFolderFile
  ): Promise<void> {
    if (!job.folderUploadId || file.remoteFileId === null) return
    const result = await this.uploadFileWithRetry(job, file, initialPresigned)
    if (!result) return
    if (job.status === "cancelling" || job.status === "cancelled") return

    file.status = "uploaded"
    this.touch(job)
    try {
      const response = await this.completeSemaphore.use(job.id, async () => {
        if (job.status === "cancelling" || job.status === "cancelled") {
          throw new DOMException("Upload was aborted.", "AbortError")
        }
        file.status = "confirming"
        this.touch(job)
        return completeFolderFiles(
          job.sessionId,
          job.folderUploadId as string,
          [
            {
              file_id: result.fileId,
              size_bytes: result.sizeBytes,
              ...(result.etag ? { etag: result.etag } : {}),
            },
          ],
          this.signalFor(job.id)
        )
      })
      this.applyCompletedFiles(job, [file], response)
    } catch (error) {
      if (this.isCancellationRequested(job)) return
      file.status = "failed"
      file.error = errorMessage(error)
      this.touch(job)
    }
  }

  private async uploadFileWithRetry(
    job: FolderUploadJob,
    file: FolderUploadFileState,
    initialPresigned?: PresignedFolderFile
  ): Promise<PutResult | null> {
    if (!job.folderUploadId || file.remoteFileId === null) return null
    while (file.attempts < MAX_UPLOAD_ATTEMPTS) {
      if (job.status === "cancelling" || job.status === "cancelled") return null
      file.attempts += 1
      file.error = null
      try {
        const presigned =
          initialPresigned ??
          (
            await presignFolderFiles(
              job.sessionId,
              job.folderUploadId,
              [file.remoteFileId],
              this.signalFor(job.id)
            )
          ).files[0]
        initialPresigned = undefined
        if (!presigned) throw new Error("Backend không trả về presigned URL.")
        file.status = "uploading"
        this.touch(job)
        return await globalUploadSemaphore.use(job.id, () =>
          this.putFile(job, file, presigned)
        )
      } catch (error) {
        this.setFileProgress(job, file, 0)
        file.error = errorMessage(error)
        if (file.attempts < MAX_UPLOAD_ATTEMPTS) {
          await delay(1000 * 2 ** (file.attempts - 1))
        }
      }
    }
    file.status = "failed"
    this.touch(job)
    return null
  }

  private putFile(
    job: FolderUploadJob,
    fileState: FolderUploadFileState,
    presigned: PresignedFolderFile
  ): Promise<PutResult> {
    const source = this.sources.get(job.id)
    const file = source?.[fileState.sourceIndex]
    if (!file)
      return Promise.reject(new Error("File nguồn không còn trong bộ nhớ."))
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      this.addAborter(job.id, xhr)
      xhr.open("PUT", presigned.upload_url)
      for (const [name, value] of Object.entries(
        presigned.upload_headers ?? {}
      )) {
        try {
          xhr.setRequestHeader(name, value)
        } catch {
          // Một số header ký sẵn (Host/Content-Length) do trình duyệt tự quản lý.
        }
      }
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return
        const currentPercent = fileProgressPercent(
          fileState.uploadedBytes,
          file.size
        )
        const nextPercent = fileProgressPercent(event.loaded, file.size)
        if (
          event.loaded < event.total &&
          Math.floor(currentPercent / FILE_PROGRESS_UI_STEP_PERCENT) ===
            Math.floor(nextPercent / FILE_PROGRESS_UI_STEP_PERCENT)
        ) {
          return
        }
        this.setFileProgress(job, fileState, event.loaded)
      }
      xhr.onerror = () => {
        this.removeAborter(job.id, xhr)
        reject(new Error("Kết nối PUT tới Chỉnh Lý bị lỗi."))
      }
      xhr.onabort = () => {
        this.removeAborter(job.id, xhr)
        reject(new Error("Upload đã bị hủy."))
      }
      xhr.onload = () => {
        this.removeAborter(job.id, xhr)
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(`Chỉnh Lý từ chối PUT (HTTP ${xhr.status}).`))
          return
        }
        this.setFileProgress(job, fileState, file.size)
        resolve({
          fileId: fileState.remoteFileId as number,
          sizeBytes: file.size,
          etag: xhr.getResponseHeader("ETag") ?? undefined,
        })
      }
      xhr.send(file)
    })
  }

  private async sealAndReconcile(job: FolderUploadJob): Promise<void> {
    if (!job.folderUploadId) return
    job.status = "sealing"
    this.touch(job)
    try {
      job.summary = await sealFolderUpload(
        job.sessionId,
        job.folderUploadId,
        this.signalFor(job.id)
      )
      job.status = "reconciling"
      this.releaseSource(job.id)
      this.touch(job)
      await this.pollReconciliation(job)
    } catch (error) {
      this.failJob(job, error)
    }
  }

  private async pollReconciliation(job: FolderUploadJob): Promise<void> {
    if (!job.folderUploadId) return
    for (let attempt = 0; attempt < 360; attempt += 1) {
      const summary = await getFolderUpload(
        job.sessionId,
        job.folderUploadId,
        this.signalFor(job.id)
      )
      job.summary = summary
      if (summary.document_sync_status === "ready") {
        this.completeJob(job, summary)
        this.touch(job)
        return
      }
      if (summary.document_sync_status === "failed") {
        throw new Error(
          summary.error || "Không đồng bộ được document từ Chỉnh Lý."
        )
      }
      this.touch(job, attempt % 3 === 0)
      await delay(RECONCILE_POLL_INTERVAL_MS)
    }
    job.status = "attention_required"
    job.error = "Upload đã seal; backend vẫn đang đồng bộ document trong nền."
    this.touch(job)
  }

  private applyRegisteredFiles(
    job: FolderUploadJob,
    localFiles: FolderUploadFileState[],
    response: RegisteredFolderFilesResponse
  ): void {
    const byClient = new Map(
      response.files.map((file) => [file.client_file_id, file])
    )
    for (const local of localFiles) {
      const remote = byClient.get(local.clientFileId)
      if (!remote) {
        local.status = "failed"
        local.error = "Thiếu kết quả register từ backend."
        continue
      }
      local.remoteFileId = remote.file_id
      local.action = remote.action
      local.error = remote.error?.message ?? null
      local.status =
        remote.status === "skipped"
          ? "skipped"
          : remote.status === "confirmed"
            ? "confirmed"
            : "registered"
    }
    this.touch(job)
  }

  private applyCompletedFiles(
    job: FolderUploadJob,
    localFiles: FolderUploadFileState[],
    response: RegisteredFolderFilesResponse
  ): void {
    const byId = new Map(response.files.map((file) => [file.file_id, file]))
    for (const local of localFiles) {
      if (local.remoteFileId === null) continue
      const remote = byId.get(local.remoteFileId)
      if (!remote) continue
      local.action = remote.action
      local.error = remote.error?.message ?? null
      local.status =
        remote.status === "confirmed"
          ? "confirmed"
          : remote.status === "skipped"
            ? "skipped"
            : "failed"
    }
    if (job.summary) {
      const currentTerminal =
        job.summary.counts.confirmed + job.summary.counts.skipped
      const responseTerminal =
        response.counts.confirmed + response.counts.skipped
      if (responseTerminal >= currentTerminal) {
        job.summary = { ...job.summary, counts: response.counts }
      }
    }
    this.touch(job)
  }

  private setFileProgress(
    job: FolderUploadJob,
    file: FolderUploadFileState,
    loadedBytes: number
  ): void {
    const next = Math.max(0, Math.min(file.sizeBytes, loadedBytes))
    job.uploadedBytes = Math.max(
      0,
      Math.min(job.totalBytes, job.uploadedBytes + next - file.uploadedBytes)
    )
    file.uploadedBytes = next
    job.updatedAt = Date.now()
    this.publish()
  }

  private failJob(job: FolderUploadJob, error: unknown): void {
    if (job.status === "cancelled" || job.status === "cancelling") return
    job.status = "attention_required"
    job.error = errorMessage(error)
    this.touch(job)
  }

  private completeJob(
    job: FolderUploadJob,
    summary: FolderUploadSummary
  ): void {
    job.summary = summary
    job.status = "completed"
    job.error = null
    // Từ đây màn extract chỉ cần summary/ingestion run. Giải phóng
    // manifest chi tiết để không giữ hàng chục nghìn record trong tab.
    job.files = []
    job.uploadedBytes = job.totalBytes
    this.releaseSource(job.id)
    this.controllers.delete(job.id)
  }

  private markUnfinishedCancelled(job: FolderUploadJob): void {
    for (const file of job.files) {
      if (!["confirmed", "skipped", "failed"].includes(file.status)) {
        file.status = "cancelled"
        file.error = null
      }
    }
    this.releaseSource(job.id)
  }

  private releaseSource(jobId: string): void {
    this.sources.delete(jobId)
    this.pendingWindows.delete(jobId)
    this.pendingWindowEnds.delete(jobId)
    this.cursors.delete(jobId)
  }

  private ensureController(jobId: string): AbortController {
    const current = this.controllers.get(jobId)
    if (current && !current.signal.aborted) return current
    const controller = new AbortController()
    this.controllers.set(jobId, controller)
    return controller
  }

  private signalFor(jobId: string): AbortSignal {
    return (this.controllers.get(jobId) ?? this.ensureController(jobId)).signal
  }

  private ensureHeartbeat(): void {
    if (this.heartbeatTimer !== null) return
    this.heartbeatTimer = window.setInterval(() => {
      for (const job of this.jobs) {
        if (
          !job.folderUploadId ||
          !["preparing", "uploading", "attention_required"].includes(job.status)
        ) {
          continue
        }
        void heartbeatFolderUpload(job.sessionId, job.folderUploadId).catch(
          () => undefined
        )
      }
    }, HEARTBEAT_INTERVAL_MS)
  }

  private abortJobRequests(jobId: string): void {
    for (const xhr of this.aborters.get(jobId) ?? []) xhr.abort()
    this.aborters.delete(jobId)
  }

  private addAborter(jobId: string, xhr: XMLHttpRequest): void {
    const values = this.aborters.get(jobId) ?? new Set<XMLHttpRequest>()
    values.add(xhr)
    this.aborters.set(jobId, values)
  }

  private removeAborter(jobId: string, xhr: XMLHttpRequest): void {
    const values = this.aborters.get(jobId)
    values?.delete(xhr)
    if (!values?.size) this.aborters.delete(jobId)
  }

  private findJob(jobId: string): FolderUploadJob | undefined {
    return this.jobs.find((job) => job.id === jobId)
  }

  private isCancellationRequested(job: FolderUploadJob): boolean {
    return job.status === "cancelling" || job.status === "cancelled"
  }

  private touch(job: FolderUploadJob, publish = true): void {
    job.updatedAt = Date.now()
    if (publish) this.publish()
  }

  private publish(): void {
    this.snapshot = [...this.jobs]
    for (const listener of this.listeners) listener()
  }
}

function buildManifest(source: SourceFiles): {
  rootName: string
  files: FolderUploadFileState[]
} {
  const candidates: Array<{
    sourceIndex: number
    file: File
    webkitPath: string
  }> = []
  for (let index = 0; index < source.length; index += 1) {
    const file = source[index]
    if (!file || !file.name.toLowerCase().endsWith(".pdf") || file.size <= 0) {
      continue
    }
    candidates.push({
      sourceIndex: index,
      file,
      webkitPath: normalizePath(file.webkitRelativePath || file.name),
    })
  }
  const rootName =
    candidates[0]?.webkitPath.split("/")[0] || `folder-${Date.now()}`
  const seen = new Set<string>()
  const files = candidates.map(({ sourceIndex, file, webkitPath }) => {
    const relativePath = normalizePath(webkitPath)
    if (seen.has(relativePath)) {
      throw new Error(`Đường dẫn file bị trùng: ${relativePath}`)
    }
    seen.add(relativePath)
    return {
      sourceIndex,
      clientFileId: relativePath,
      relativePath,
      sizeBytes: file.size,
      status: "queued" as const,
      remoteFileId: null,
      uploadedBytes: 0,
      attempts: 0,
      action: null,
      error: null,
    }
  })
  return { rootName, files }
}

function normalizePath(path: string): string {
  const normalized = path.replaceAll("\\", "/").replace(/^\.\/+/, "")
  const parts = normalized.split("/")
  if (
    normalized.startsWith("/") ||
    /^[A-Za-z]:\//.test(normalized) ||
    parts.some((part) => !part || part === "." || part === "..")
  ) {
    throw new Error(`Đường dẫn folder không hợp lệ: ${path}`)
  }
  return parts.join("/")
}

function fileProgressPercent(loadedBytes: number, totalBytes: number): number {
  if (totalBytes <= 0) return 0
  return Math.min(
    100,
    Math.floor((Math.max(0, loadedBytes) / totalBytes) * 100)
  )
}

function isTerminal(status: FolderUploadJob["status"]): boolean {
  return status === "completed" || status === "cancelled"
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export const folderUploadManager = new FolderUploadManager()
