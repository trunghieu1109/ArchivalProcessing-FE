type QueuedWork<T> = {
  jobId: string
  task: () => Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
  signal?: AbortSignal
  onAbort?: () => void
}

export class UploadSemaphore {
  private active = 0
  private readonly queue: QueuedWork<unknown>[] = []
  private readonly limit: number
  private lastDispatchedJobId: string | null = null

  constructor(limit: number) {
    this.limit = limit
  }

  run<T>(
    jobId: string,
    task: () => Promise<T>,
    signal?: AbortSignal
  ): Promise<T> {
    if (signal?.aborted) {
      return Promise.reject(new DOMException("Upload đã bị hủy.", "AbortError"))
    }
    return new Promise<T>((resolve, reject) => {
      const work: QueuedWork<T> = { jobId, task, resolve, reject, signal }
      work.onAbort = () => {
        const index = this.queue.indexOf(work as QueuedWork<unknown>)
        if (index < 0) return
        this.queue.splice(index, 1)
        reject(new DOMException("Upload đã bị hủy.", "AbortError"))
      }
      signal?.addEventListener("abort", work.onAbort, { once: true })
      this.queue.push(work as QueuedWork<unknown>)
      this.drain()
    })
  }

  cancelQueued(jobId: string): void {
    for (let index = this.queue.length - 1; index >= 0; index -= 1) {
      const work = this.queue[index]
      if (work.jobId !== jobId) continue
      this.queue.splice(index, 1)
      work.signal?.removeEventListener("abort", work.onAbort!)
      work.reject(new DOMException("Upload đã bị hủy.", "AbortError"))
    }
  }

  private drain(): void {
    while (this.active < this.limit && this.queue.length > 0) {
      const nextDifferentJob = this.queue.findIndex(
        (candidate) => candidate.jobId !== this.lastDispatchedJobId
      )
      const work = this.queue.splice(
        nextDifferentJob >= 0 ? nextDifferentJob : 0,
        1
      )[0]
      this.lastDispatchedJobId = work.jobId
      work.signal?.removeEventListener("abort", work.onAbort!)
      if (work.signal?.aborted) {
        work.reject(new DOMException("Upload đã bị hủy.", "AbortError"))
        continue
      }
      this.active += 1
      void work
        .task()
        .then(work.resolve, work.reject)
        .finally(() => {
          this.active -= 1
          this.drain()
        })
    }
  }
}

export const globalUploadPutSemaphore = new UploadSemaphore(8)
export const globalUploadCompleteSemaphore = new UploadSemaphore(4)
