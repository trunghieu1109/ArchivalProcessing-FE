export class UploadSemaphore {
  private active = 0
  private readonly waitersByJob = new Map<
    string,
    Array<{ resolve: () => void; reject: (error: unknown) => void }>
  >()
  private readonly jobOrder: string[] = []
  private readonly cancelledJobs = new Set<string>()
  private readonly capacity: number

  constructor(capacity: number) {
    this.capacity = capacity
  }

  async use<T>(jobId: string, operation: () => Promise<T>): Promise<T> {
    await this.acquire(jobId)
    try {
      return await operation()
    } finally {
      this.release()
    }
  }

  resume(jobId: string): void {
    this.cancelledJobs.delete(jobId)
  }

  cancel(jobId: string): void {
    this.cancelledJobs.add(jobId)
    const error = new DOMException("Upload was aborted.", "AbortError")
    for (const waiter of this.waitersByJob.get(jobId) ?? []) {
      waiter.reject(error)
    }
    this.waitersByJob.delete(jobId)
    for (let index = this.jobOrder.length - 1; index >= 0; index -= 1) {
      if (this.jobOrder[index] === jobId) this.jobOrder.splice(index, 1)
    }
    this.drain()
  }

  private acquire(jobId: string): Promise<void> {
    if (this.cancelledJobs.has(jobId)) {
      return Promise.reject(
        new DOMException("Upload was aborted.", "AbortError")
      )
    }
    if (this.active < this.capacity && this.jobOrder.length === 0) {
      this.active += 1
      return Promise.resolve()
    }
    return new Promise((resolve, reject) => {
      const waiters = this.waitersByJob.get(jobId) ?? []
      waiters.push({ resolve, reject })
      this.waitersByJob.set(jobId, waiters)
      if (!this.jobOrder.includes(jobId)) this.jobOrder.push(jobId)
      this.drain()
    })
  }

  private release(): void {
    this.active = Math.max(0, this.active - 1)
    this.drain()
  }

  private drain(): void {
    while (this.active < this.capacity && this.jobOrder.length > 0) {
      const jobId = this.jobOrder.shift()
      if (!jobId) return
      const waiters = this.waitersByJob.get(jobId)
      const waiter = waiters?.shift()
      if (!waiter) {
        this.waitersByJob.delete(jobId)
        continue
      }
      if (waiters && waiters.length > 0) this.jobOrder.push(jobId)
      else this.waitersByJob.delete(jobId)
      if (this.cancelledJobs.has(jobId)) {
        waiter.reject(new DOMException("Upload was aborted.", "AbortError"))
        continue
      }
      this.active += 1
      waiter.resolve()
    }
  }
}

export const globalUploadSemaphore = new UploadSemaphore(8)
