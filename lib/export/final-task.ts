import type { RenderProps } from "../../remotion/types.ts"
import { errorMessageOf, isAbortError } from "./editor-errors.ts"
import {
  cancelFinalRender,
  downloadFinalRender,
  peekFinalRenderStatus,
  startFinalRender,
  watchJobUntilDone,
  type ExportPhase,
  type FetchImpl,
} from "./final-client.ts"
import { loadLastExportJob, saveLastExportJob } from "./last-job.ts"
import type { StorageLike } from "../project-store.ts"

export type FinalTaskSnapshot = {
  running: boolean
  phase: ExportPhase | null
  progress: number
  replies: number
  jobId: string | null
  fileName: string | null
  error: string | null
  startedAt: number | null
  elapsedSeconds: number
  canRetry: boolean
}

export type FinalSavePayload = {
  blob: Blob
  fileName: string
  capcutSaved: boolean
  capcutFileName: string | null
}

export type FinalSaveHandler = (payload: FinalSavePayload) => Promise<void>

export type FinalTaskStartInput = {
  video: Blob
  props: RenderProps
  fileName: string
  saveToCapcut?: boolean
  audios?: { id: string; blob: Blob; fileName: string }[]
  fetchImpl?: FetchImpl
  pollDelayMs?: number
  requestTimeoutMs?: number
}

const IDLE_SNAPSHOT: FinalTaskSnapshot = {
  running: false,
  phase: null,
  progress: 0,
  replies: 0,
  jobId: null,
  fileName: null,
  error: null,
  startedAt: null,
  elapsedSeconds: 0,
  canRetry: false,
}

export type FinalExportTask = {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => FinalTaskSnapshot
  setSaveHandler: (handler: FinalSaveHandler | null) => void
  start: (input: FinalTaskStartInput) => void
  cancel: () => void
  retry: () => void
  recoverLast: () => void
  nudgeMacIdle: () => void
  reportExternalError: (error: unknown) => void
  dispose: () => void
}

export function createFinalExportTask(options: {
  persist?: StorageLike | null
  requestTimeoutMs?: number
  fetchImpl?: FetchImpl
} = {}): FinalExportTask {
  const defaultRequestTimeoutMs = options.requestTimeoutMs ?? 5000
  const persist = options.persist
  const listeners = new Set<() => void>()
  let snapshot: FinalTaskSnapshot = { ...IDLE_SNAPSHOT }
  let saveHandler: FinalSaveHandler | null = null
  let uploadAbort: AbortController | null = null
  let lastInput: FinalTaskStartInput | null = null
  let completing = false
  let closed = false
  let userCancelled = false
  let clockTimer: ReturnType<typeof setInterval> | null = null
  let visibilityHandler: (() => void) | null = null
  let fetchImpl: FetchImpl = options.fetchImpl ?? fetch

  const emit = () => {
    for (const listener of listeners) listener()
  }

  const canRetryFrom = (input: FinalTaskStartInput | null, snap: FinalTaskSnapshot) =>
    Boolean(input && input.video.size > 0) && !snap.running && Boolean(snap.error)

  const patch = (next: Partial<FinalTaskSnapshot>) => {
    const merged = { ...snapshot, ...next }
    snapshot = {
      ...merged,
      canRetry: canRetryFrom(lastInput, merged),
    }
    emit()
  }

  const shouldContinue = () => !userCancelled && !closed

  const stopClock = () => {
    if (clockTimer) clearInterval(clockTimer)
    clockTimer = null
  }

  const startClock = (startedAt: number) => {
    stopClock()
    clockTimer = setInterval(() => {
      if (!snapshot.running) return
      patch({ elapsedSeconds: Math.floor((Date.now() - startedAt) / 1000) })
    }, 1000)
  }

  const stopVisibilityWatch = () => {
    if (visibilityHandler && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", visibilityHandler)
    }
    visibilityHandler = null
  }

  const startVisibilityWatch = (jobId: string) => {
    stopVisibilityWatch()
    if (typeof document === "undefined") return
    visibilityHandler = () => {
      if (document.visibilityState !== "visible") return
      if (!snapshot.running || snapshot.phase !== "rendering" || snapshot.jobId !== jobId) return
      if (completing || closed || userCancelled) return
      void peekFinalRenderStatus({ jobId, fetchImpl })
        .then((status) => {
          if (completing || closed || userCancelled) return
          patch({
            replies: snapshot.replies + 1,
            progress: 0.08 + status.progress * 0.77,
          })
          if (status.stage === "done") {
            void completeFromJob(jobId, {
              capcutSaved: status.capcutSaved === true,
              capcutFileName: status.capcutFileName ?? null,
            }).catch((error) => {
              if (!closed && !userCancelled) fail(error)
            })
          }
        })
        .catch(() => {})
    }
    document.addEventListener("visibilitychange", visibilityHandler)
  }

  const settle = () => {
    closed = true
    uploadAbort = null
    stopClock()
    stopVisibilityWatch()
  }

  const fail = (error: unknown) => {
    if (closed && !snapshot.running) return
    const aborted = isAbortError(error)
    if (aborted && !userCancelled) return
    const message = aborted
      ? "Export cancelado. Se o Mac ainda estiver gerando, espere um pouco antes de exportar de novo."
      : errorMessageOf(error)
    if (!aborted) {
      console.error("[export]", error, {
        jobId: snapshot.jobId,
        phase: snapshot.phase,
        elapsed: snapshot.elapsedSeconds,
      })
    }
    uploadAbort?.abort()
    settle()
    completing = false
    patch({
      running: false,
      phase: null,
      error: message,
    })
  }

  const succeed = () => {
    settle()
    completing = false
    patch({
      running: false,
      phase: null,
      progress: 1,
      error: null,
    })
  }

  const completeFromJob = async (
    jobId: string,
    progress: { capcutSaved: boolean; capcutFileName: string | null } | null,
  ) => {
    if (completing || closed) return
    completing = true
    try {
      // CapCut já gravou no Mac: não baixa MP4 nem abre "Salvar como".
      if (progress?.capcutSaved) {
        patch({ phase: "saving", progress: 0.98 })
        await saveHandler?.({
          blob: new Blob(),
          fileName: snapshot.fileName || "video.mp4",
          capcutSaved: true,
          capcutFileName: progress.capcutFileName,
        })
        succeed()
        return
      }
      patch({ phase: "downloading" })
      const downloaded = await downloadFinalRender(jobId, {
        fetchImpl,
        shouldContinue,
        onProgress: (ratio) => patch({ progress: 0.85 + ratio * 0.12 }),
      })
      if (!shouldContinue()) return
      patch({ phase: "saving", progress: 0.98 })
      await saveHandler?.({
        blob: downloaded.blob,
        fileName: snapshot.fileName || "video.mp4",
        capcutSaved: Boolean(downloaded.capcutSaved),
        capcutFileName: progress?.capcutFileName || downloaded.capcutFileName,
      })
      succeed()
    } catch (error) {
      completing = false
      throw error
    }
  }

  const run = async (input: FinalTaskStartInput, existingJobId?: string) => {
    fetchImpl = input.fetchImpl ?? options.fetchImpl ?? fetch
    completing = false
    const startedAt = Date.now()
    startClock(startedAt)
    try {
      let jobId = existingJobId
      if (!jobId) {
        patch({ phase: "uploading", progress: 0.02 })
        uploadAbort = new AbortController()
        jobId = await startFinalRender({
          video: input.video,
          props: input.props,
          fileName: input.fileName,
          saveToCapcut: input.saveToCapcut,
          audios: input.audios,
          fetchImpl,
          signal: uploadAbort.signal,
        })
        uploadAbort = null
        if (!shouldContinue()) return
        saveLastExportJob({ jobId, fileName: input.fileName }, persist ?? undefined)
        patch({ jobId, phase: "rendering", progress: 0.08 })
        startVisibilityWatch(jobId)
      }

      const pollProgress = await watchJobUntilDone({
        jobId,
        shouldContinue,
        fetchImpl,
        pollEveryMs: input.pollDelayMs,
        requestTimeoutMs: input.requestTimeoutMs ?? defaultRequestTimeoutMs,
        onProgress: (ratio) => patch({ progress: 0.08 + ratio * 0.77 }),
        onStatusResponse: () => patch({ replies: snapshot.replies + 1 }),
      })
      if (!shouldContinue()) return
      await completeFromJob(jobId, pollProgress)
    } catch (error) {
      if (closed || completing) return
      if (isAbortError(error) && !userCancelled) return
      fail(error)
    }
  }

  const startTask = (input: FinalTaskStartInput) => {
    if (snapshot.running) return
    lastInput = input
    closed = false
    completing = false
    userCancelled = false
    patch({
      running: true,
      phase: "uploading",
      progress: 0.02,
      replies: 0,
      jobId: null,
      fileName: input.fileName,
      error: null,
      startedAt: Date.now(),
      elapsedSeconds: 0,
    })
    void run(input)
  }

  const nudgeMacIdle = () => {
    const jobId = snapshot.jobId
    if (!snapshot.running || snapshot.phase !== "rendering" || !jobId) return
    if (completing || closed || userCancelled) return
    void peekFinalRenderStatus({ jobId, fetchImpl })
      .then((status) => {
        if (completing || closed || userCancelled) return
        patch({
          replies: snapshot.replies + 1,
          progress: 0.08 + status.progress * 0.77,
        })
        if (status.stage === "error") {
          fail(new Error(status.error || "Falha no render final"))
          return
        }
        if (status.stage !== "done") return
        void completeFromJob(jobId, {
          capcutSaved: status.capcutSaved === true,
          capcutFileName: status.capcutFileName ?? null,
        }).catch((error) => {
          if (!closed && !userCancelled) fail(error)
        })
      })
      .catch(() => {
        void downloadFinalRender(jobId, {
          fetchImpl,
          shouldContinue,
          headerTimeoutMs: 8000,
        })
          .then((downloaded) => {
            if (completing || closed || userCancelled) return
            completing = true
            patch({ phase: "downloading", progress: 0.9 })
            return saveHandler?.({
              blob: downloaded.blob,
              fileName: snapshot.fileName || "video.mp4",
              capcutSaved: downloaded.capcutSaved,
              capcutFileName: downloaded.capcutFileName,
            }).then(() => succeed())
          })
          .catch(() => {})
      })
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot() {
      return snapshot
    },
    setSaveHandler(handler) {
      saveHandler = handler
    },
    start: startTask,
    cancel() {
      if (!snapshot.running) return
      userCancelled = true
      uploadAbort?.abort()
      void cancelFinalRender(fetchImpl).catch((error) => {
        console.error("[export]", error, {
          jobId: snapshot.jobId,
          phase: snapshot.phase,
          elapsed: snapshot.elapsedSeconds,
        })
      })
      fail(new DOMException("Export cancelado", "AbortError"))
    },
    retry() {
      if (snapshot.running || !lastInput || lastInput.video.size === 0) return
      startTask(lastInput)
    },
    recoverLast() {
      if (snapshot.running) return
      const last = loadLastExportJob(persist ?? undefined)
      if (!last) {
        patch({ error: "Não achei um export recente para recuperar." })
        return
      }
      lastInput = lastInput ?? {
        video: new Blob(),
        props: {} as RenderProps,
        fileName: last.fileName,
      }
      closed = false
      completing = false
      userCancelled = false
      fetchImpl = lastInput.fetchImpl ?? options.fetchImpl ?? fetch
      patch({
        running: true,
        phase: "rendering",
        progress: 0.08,
        replies: 0,
        jobId: last.jobId,
        fileName: last.fileName,
        error: null,
        startedAt: Date.now(),
        elapsedSeconds: 0,
      })
      startVisibilityWatch(last.jobId)
      void run(lastInput, last.jobId)
    },
    nudgeMacIdle,
    reportExternalError(error) {
      if (!snapshot.running || isAbortError(error) || userCancelled) return
      fail(error)
    },
    dispose() {
      stopClock()
      stopVisibilityWatch()
      listeners.clear()
    },
  }
}

export const finalExportTask = createFinalExportTask()
