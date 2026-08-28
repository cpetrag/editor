export type MutexSnapshot = {
  busy: boolean
  currentJobId: string | null
}

export type Mutex = {
  tryAcquire: (jobId: string) => { ok: true } | { ok: false }
  release: () => void
  snapshot: () => MutexSnapshot
}

export function createMutex(): Mutex {
  let busy = false
  let currentJobId: string | null = null

  return {
    tryAcquire(jobId: string) {
      if (busy) return { ok: false }
      busy = true
      currentJobId = jobId
      return { ok: true }
    },
    release() {
      busy = false
      currentJobId = null
    },
    snapshot() {
      return { busy, currentJobId }
    },
  }
}
