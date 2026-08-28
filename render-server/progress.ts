export type ProgressEvent = {
  progress: number
  stage: string
  error?: string
  capcutSaved?: boolean
  capcutFileName?: string
}

export function nextProgress(current: number, incoming: number): number {
  const clamped = Math.min(1, Math.max(0, incoming))
  return Math.max(current, clamped)
}

export function createProgressHub() {
  const last = new Map<string, ProgressEvent>()
  const listeners = new Map<string, Set<(event: ProgressEvent) => void>>()

  function emit(jobId: string, incoming: ProgressEvent): ProgressEvent {
    const previous = last.get(jobId)
    const event: ProgressEvent = {
      progress: nextProgress(previous?.progress ?? 0, incoming.progress),
      stage: incoming.stage,
      ...(typeof incoming.error === "string" ? { error: incoming.error } : {}),
      ...(typeof incoming.capcutSaved === "boolean"
        ? { capcutSaved: incoming.capcutSaved }
        : {}),
      ...(incoming.capcutFileName ? { capcutFileName: incoming.capcutFileName } : {}),
    }
    last.set(jobId, event)
    for (const listener of listeners.get(jobId) ?? []) {
      listener(event)
    }
    return event
  }

  function subscribe(jobId: string, listener: (event: ProgressEvent) => void): () => void {
    const set = listeners.get(jobId) ?? new Set<(event: ProgressEvent) => void>()
    set.add(listener)
    listeners.set(jobId, set)
    const current = last.get(jobId)
    if (current) listener(current)
    return () => {
      set.delete(listener)
    }
  }

  function peek(jobId: string): ProgressEvent | undefined {
    return last.get(jobId)
  }

  function drop(jobId: string): void {
    last.delete(jobId)
    listeners.delete(jobId)
  }

  return { emit, subscribe, peek, drop }
}
