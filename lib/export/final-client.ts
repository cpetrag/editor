import type { RenderProps } from "../../remotion/types.ts"
import { capcutFromDownloadHeaders } from "./capcut-client.ts"
import { sanitizeCapcutFileName } from "./capcut-path.ts"
import {
  finalDownloadProgress,
  finalRenderProgress,
  type ExportPhase,
} from "./export-status.ts"
import {
  errorFromRenderNetwork,
  errorFromRenderResponse,
  RenderExportError,
} from "./render-errors.ts"
import { parseRenderStatus, type RenderStatus } from "./render-status.ts"

export type { ExportPhase }
export type ExportMode = "draft" | "final"
export type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>

async function readJsonBody(response: Response): Promise<{
  error?: unknown
  jobId?: unknown
  ok?: unknown
  busy?: unknown
  cancelled?: unknown
}> {
  try {
    return (await response.json()) as {
      error?: unknown
      jobId?: unknown
      ok?: unknown
      busy?: unknown
      cancelled?: unknown
    }
  } catch {
    return {}
  }
}

export type RenderHealth = {
  ok: boolean
  busy: boolean
  jobId: string | null
}

export async function readRenderHealth(
  fetchImpl: FetchImpl = fetch,
  signal?: AbortSignal,
): Promise<RenderHealth> {
  const { ok, status, body } = await fetchJsonWithBudget({
    url: "/api/render",
    fetchImpl,
    signal,
    requestTimeoutMs: 5000,
  })
  if (!ok) throw errorFromRenderResponse(status, body)
  return {
    ok: true,
    busy: body.busy === true,
    jobId: typeof body.jobId === "string" ? body.jobId : null,
  }
}

export async function cancelFinalRender(fetchImpl: FetchImpl = fetch): Promise<boolean> {
  const { ok, status, body } = await fetchJsonWithBudget({
    url: "/api/render/cancel",
    fetchImpl,
    requestTimeoutMs: 5000,
    method: "POST",
  })
  if (!ok) throw errorFromRenderResponse(status, body)
  return body.cancelled === true
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException("Export cancelado", "AbortError")
  }
}

export async function startFinalRender(input: {
  video: Blob
  props: RenderProps
  fileName?: string
  saveToCapcut?: boolean
  fetchImpl?: FetchImpl
  signal?: AbortSignal
}): Promise<string> {
  const fetchImpl = input.fetchImpl ?? fetch
  const form = new FormData()
  form.set(
    "props",
    new Blob([JSON.stringify(input.props)], { type: "application/json" }),
    "props.json",
  )
  form.set("video", input.video, "video.mp4")
  if (input.saveToCapcut) {
    form.set("saveToCapcut", "1")
    form.set("fileName", input.fileName || "video.mp4")
  }

  let response: Response
  try {
    response = await fetchImpl("/api/render", {
      method: "POST",
      body: form,
      signal: input.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error
    throw errorFromRenderNetwork()
  }

  const body = await readJsonBody(response)
  if (
    response.status === 409 &&
    typeof body.jobId === "string" &&
    body.jobId.trim()
  ) {
    return body.jobId.trim()
  }
  if (!response.ok) {
    throw errorFromRenderResponse(response.status, body)
  }
  if (typeof body.jobId !== "string" || !body.jobId) {
    throw new RenderExportError("O servidor não devolveu o jobId", response.status, false)
  }
  return body.jobId
}

async function sleepMs(ms: number): Promise<void> {
  if (ms <= 0) return
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function sleepUntil(input: {
  ms: number
  shouldContinue: () => boolean
}): Promise<void> {
  const deadline = Date.now() + input.ms
  while (Date.now() < deadline) {
    if (!input.shouldContinue()) {
      throw new DOMException("Export cancelado", "AbortError")
    }
    await sleepMs(Math.min(200, deadline - Date.now()))
  }
}

function throwIfCancelled(shouldContinue: () => boolean): void {
  if (!shouldContinue()) {
    throw new DOMException("Export cancelado", "AbortError")
  }
}

/**
 * Consulta pontual: o navegador atrás do túnel não recebe stream de forma
 * confiável, então o progresso é lido por requisições curtas.
 * O deadline cobre headers E corpo — um stream morto depois dos headers
 * não pode prender o await para sempre.
 */
class RequestTimeoutError extends Error {
  readonly url: string
  constructor(url = "") {
    super("consulta de render estourou o tempo")
    this.name = "RequestTimeoutError"
    this.url = url
  }
}

class DownloadStallError extends Error {
  readonly url: string
  constructor(url = "") {
    super("download do MP4 parou no meio")
    this.name = "DownloadStallError"
    this.url = url
  }
}

const STATUS_TELEMETRY_EVERY = 5

function logStall(url: string, attempt?: number) {
  console.warn("[export] request timeout/stall", url, attempt ?? "")
}

/** Não esperar cancel: no túnel o stream morto também trava o cancel(). */
function abandonResponseBody(response: Response | undefined): void {
  const body = response?.body
  if (!body) return
  void Promise.race([
    body.cancel().catch(() => {}),
    new Promise<void>((resolve) => {
      setTimeout(resolve, 100)
    }),
  ])
}

function abandonReader(reader: ReadableStreamDefaultReader<Uint8Array>): void {
  void Promise.race([
    reader.cancel().catch(() => {}),
    new Promise<void>((resolve) => {
      setTimeout(resolve, 100)
    }),
  ])
}

function isUserAbort(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true
  return error instanceof DOMException && error.name === "AbortError" && Boolean(signal?.aborted)
}

function isRetryablePollError(error: unknown): boolean {
  if (error instanceof RequestTimeoutError) return true
  if (!(error instanceof RenderExportError)) return true
  return error.status === null || error.status === 503
}

async function fetchJsonViaXhr(input: {
  url: string
  requestTimeoutMs: number
  method?: string
}): Promise<{
  ok: boolean
  status: number
  body: {
    error?: unknown
    jobId?: unknown
    ok?: unknown
    busy?: unknown
    cancelled?: unknown
  }
}> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(input.method ?? "GET", input.url, true)
    xhr.timeout = input.requestTimeoutMs
    xhr.onload = () => {
      let body: {
        error?: unknown
        jobId?: unknown
        ok?: unknown
        busy?: unknown
        cancelled?: unknown
      } = {}
      try {
        body = xhr.responseText
          ? (JSON.parse(xhr.responseText) as typeof body)
          : {}
      } catch {
        body = {}
      }
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        body,
      })
    }
    xhr.onerror = () => reject(errorFromRenderNetwork())
    xhr.ontimeout = () => {
      logStall(input.url)
      reject(new RequestTimeoutError(input.url))
    }
    xhr.onabort = () => {
      logStall(input.url)
      reject(new RequestTimeoutError(input.url))
    }
    xhr.send()
  })
}

async function fetchJsonForPoll(input: {
  url: string
  fetchImpl: FetchImpl
  requestTimeoutMs: number
  method?: string
}): Promise<{
  ok: boolean
  status: number
  body: {
    error?: unknown
    jobId?: unknown
    ok?: unknown
    busy?: unknown
    cancelled?: unknown
  }
}> {
  if (typeof XMLHttpRequest !== "undefined") {
    try {
      return await fetchJsonViaXhr(input)
    } catch (error) {
      if (error instanceof RequestTimeoutError) throw error
      if (error instanceof RenderExportError) throw error
    }
  }
  return fetchJsonWithBudget(input)
}

async function probeDownloadReady(
  jobId: string,
  fetchImpl: FetchImpl,
  requestTimeoutMs: number,
): Promise<boolean> {
  const url = `/api/render/download/${jobId}?probe=1`
  try {
    const response = await fetchResponseWithBudget({
      url,
      fetchImpl,
      requestTimeoutMs: Math.min(requestTimeoutMs, 8000),
    })
    if (response.ok) {
      abandonResponseBody(response)
      return true
    }
    abandonResponseBody(response)
    return false
  } catch {
    return false
  }
}

async function fetchJsonWithBudget(input: {
  url: string
  fetchImpl: FetchImpl
  signal?: AbortSignal
  requestTimeoutMs: number
  method?: string
}): Promise<{
  ok: boolean
  status: number
  body: {
    error?: unknown
    jobId?: unknown
    ok?: unknown
    busy?: unknown
    cancelled?: unknown
  }
}> {
  throwIfAborted(input.signal)
  const requestController = new AbortController()
  const abortRequest = () => requestController.abort()
  input.signal?.addEventListener("abort", abortRequest, { once: true })
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined
  let response: Response | undefined
  const timedOut = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      abortRequest()
      logStall(input.url)
      reject(new RequestTimeoutError(input.url))
    }, input.requestTimeoutMs)
  })
  const abortedByCaller = input.signal
    ? new Promise<never>((_, reject) => {
        const fail = () => reject(new DOMException("Export cancelado", "AbortError"))
        if (input.signal?.aborted) {
          fail()
          return
        }
        input.signal?.addEventListener("abort", fail, { once: true })
      })
    : null
  const work = async () => {
    const next = await input.fetchImpl(input.url, {
      method: input.method ?? "GET",
      cache: "no-store",
      signal: requestController.signal,
    })
    response = next
    const body = await readJsonBody(next)
    return { ok: next.ok, status: next.status, body }
  }
  const workPromise = work()
  try {
    return await Promise.race(
      abortedByCaller ? [workPromise, timedOut, abortedByCaller] : [workPromise, timedOut],
    )
  } catch (error) {
    void workPromise.catch(() => {})
    abandonResponseBody(response)
    if (isUserAbort(error, input.signal)) {
      throw new DOMException("Export cancelado", "AbortError")
    }
    if (error instanceof RequestTimeoutError) throw error
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new RequestTimeoutError(input.url)
    }
    throw errorFromRenderNetwork()
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle)
    input.signal?.removeEventListener("abort", abortRequest)
  }
}

async function fetchResponseWithBudget(input: {
  url: string
  fetchImpl: FetchImpl
  signal?: AbortSignal
  requestTimeoutMs: number
  requestController?: AbortController
}): Promise<Response> {
  throwIfAborted(input.signal)
  const requestController = input.requestController ?? new AbortController()
  const abortRequest = () => requestController.abort()
  input.signal?.addEventListener("abort", abortRequest, { once: true })
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined
  const timedOut = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      abortRequest()
      logStall(input.url)
      reject(new RequestTimeoutError(input.url))
    }, input.requestTimeoutMs)
  })
  try {
    return await Promise.race([
      input.fetchImpl(input.url, {
        cache: "no-store",
        signal: requestController.signal,
      }),
      timedOut,
    ])
  } catch (error) {
    if (isUserAbort(error, input.signal)) {
      throw new DOMException("Export cancelado", "AbortError")
    }
    if (error instanceof RequestTimeoutError) throw error
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new RequestTimeoutError(input.url)
    }
    throw errorFromRenderNetwork()
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle)
    input.signal?.removeEventListener("abort", abortRequest)
  }
}

async function readJobStatus(input: {
  jobId: string
  fetchImpl: FetchImpl
  requestTimeoutMs: number
  requestNumber: number
}): Promise<RenderStatus> {
  const url = `/api/render/status/${input.jobId}?request=${input.requestNumber}&t=${Date.now()}`
  const { ok, status, body } = await fetchJsonForPoll({
    url,
    fetchImpl: input.fetchImpl,
    requestTimeoutMs: input.requestTimeoutMs,
  })
  if (!ok) throw errorFromRenderResponse(status, body)
  const parsed = parseRenderStatus(body)
  if (input.requestNumber % STATUS_TELEMETRY_EVERY === 0 || parsed.stage === "done") {
    console.info("[export] status ok", input.requestNumber)
  }
  return parsed
}

/** Consulta única de status (watchdog / recuperação). */
export async function peekFinalRenderStatus(input: {
  jobId: string
  fetchImpl?: FetchImpl
  requestTimeoutMs?: number
}): Promise<RenderStatus> {
  return readJobStatus({
    jobId: input.jobId,
    fetchImpl: input.fetchImpl ?? fetch,
    requestTimeoutMs: input.requestTimeoutMs ?? 5000,
    requestNumber: 1,
  })
}

async function readHealthSnapshot(input: {
  fetchImpl: FetchImpl
  requestTimeoutMs: number
}): Promise<RenderHealth> {
  const { ok, status, body } = await fetchJsonWithBudget({
    url: "/api/render",
    fetchImpl: input.fetchImpl,
    requestTimeoutMs: input.requestTimeoutMs,
  })
  if (!ok) throw errorFromRenderResponse(status, body)
  return {
    ok: true,
    busy: body.busy === true,
    jobId: typeof body.jobId === "string" ? body.jobId : null,
  }
}

export async function watchJobUntilDone(input: {
  jobId: string
  shouldContinue: () => boolean
  onProgress: (ratio: number) => void
  onStatusResponse?: () => void
  fetchImpl?: FetchImpl
  pollEveryMs?: number
  requestTimeoutMs?: number
}): Promise<{ capcutSaved: boolean; capcutFileName: string | null }> {
  const fetchImpl = input.fetchImpl ?? fetch
  const pollEveryMs =
    input.pollEveryMs === undefined ? 1200 : Math.max(input.pollEveryMs, 10)
  const requestTimeoutMs = input.requestTimeoutMs ?? 5000
  const deadline = Date.now() + 12 * 60 * 1000
  let requestNumber = 0
  let current = 0
  let capcutSaved = false
  let capcutFileName: string | null = null
  let settled = false
  let sawMacBusy = false
  let inFlight = false

  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setInterval> | null = null

    const finish = (result: { capcutSaved: boolean; capcutFileName: string | null }) => {
      if (settled) return
      settled = true
      if (timer) clearInterval(timer)
      resolve(result)
    }

    const fail = (error: unknown) => {
      if (settled) return
      settled = true
      if (timer) clearInterval(timer)
      reject(error)
    }

    const applyStatus = (status: RenderStatus): boolean => {
      input.onStatusResponse?.()
      current = Math.max(current, status.progress)
      input.onProgress(current)
      if (status.capcutSaved === true) capcutSaved = true
      if (status.capcutFileName) capcutFileName = status.capcutFileName
      if (status.stage === "error") {
        throw new RenderExportError(status.error || "Falha no render final", 500, false)
      }
      return status.stage === "done"
    }

    const tick = () => {
      if (settled) return
      if (!input.shouldContinue()) {
        fail(new DOMException("Export cancelado", "AbortError"))
        return
      }
      if (Date.now() >= deadline) {
        fail(new RenderExportError("O render não terminou a tempo", 408, false))
        return
      }

      if (inFlight) return
      inFlight = true
      requestNumber += 1
      const url = `/api/render/status/${input.jobId}?request=${requestNumber}&t=${Date.now()}`

      void (async () => {
        try {
          const { ok, status, body } = await fetchJsonForPoll({
            url,
            fetchImpl,
            requestTimeoutMs,
          })
          if (settled || !input.shouldContinue()) return
          if (!ok) throw errorFromRenderResponse(status, body)
          const parsed = parseRenderStatus(body)
          if (requestNumber % STATUS_TELEMETRY_EVERY === 0 || parsed.stage === "done") {
            console.info("[export] status ok", requestNumber)
          }
          if (applyStatus(parsed)) {
            finish({ capcutSaved, capcutFileName })
          }
        } catch (error) {
          if (settled || !input.shouldContinue()) return
          if (error instanceof DOMException && error.name === "AbortError") {
            fail(error)
            return
          }
          if (error instanceof RenderExportError && error.status === 404) {
            fail(error)
            return
          }
          if (error instanceof RenderExportError && !isRetryablePollError(error)) {
            fail(error)
            return
          }
          try {
            const health = await readHealthSnapshot({ fetchImpl, requestTimeoutMs })
            if (settled || !input.shouldContinue()) return
            const oursRunning =
              health.busy && (health.jobId === input.jobId || health.jobId === null)
            if (oursRunning) {
              sawMacBusy = true
              return
            }
            const macFree =
              !health.busy || (health.jobId !== null && health.jobId !== input.jobId)
            if (!macFree) return
            try {
              const probe = await fetchJsonForPoll({
                url: `/api/render/status/${input.jobId}?request=probe&t=${Date.now()}`,
                fetchImpl,
                requestTimeoutMs,
              })
              if (settled || !input.shouldContinue()) return
              if (probe.status === 404) {
                fail(
                  new RenderExportError(
                    "O job de render não existe mais. Recupere o último export ou exporte de novo.",
                    404,
                    false,
                  ),
                )
                return
              }
              if (probe.ok && applyStatus(parseRenderStatus(probe.body))) {
                finish({ capcutSaved, capcutFileName })
                return
              }
            } catch (probeError) {
              if (probeError instanceof RenderExportError && probeError.status === 404) {
                fail(probeError)
                return
              }
            }
            const ready = await probeDownloadReady(input.jobId, fetchImpl, requestTimeoutMs)
            if (settled || !input.shouldContinue()) return
            if (ready) {
              input.onProgress(1)
              finish({ capcutSaved, capcutFileName })
              return
            }
            if (sawMacBusy) {
              input.onProgress(1)
              finish({ capcutSaved, capcutFileName })
            }
          } catch {
            // próximo tick
          }
        } finally {
          inFlight = false
        }
      })()
    }

    tick()
    timer = setInterval(tick, pollEveryMs)
  })
}

export async function pollFinalUntilDone(input: {
  jobId: string
  shouldContinue: () => boolean
  onProgress: (ratio: number) => void
  onStatusResponse?: () => void
  fetchImpl?: FetchImpl
  pollDelayMs?: number
  requestTimeoutMs?: number
}): Promise<{ capcutSaved: boolean; capcutFileName: string | null }> {
  return watchJobUntilDone({
    jobId: input.jobId,
    shouldContinue: input.shouldContinue,
    onProgress: input.onProgress,
    onStatusResponse: input.onStatusResponse,
    fetchImpl: input.fetchImpl,
    pollEveryMs: input.pollDelayMs,
    requestTimeoutMs: input.requestTimeoutMs,
  })
}

/** @deprecated Prefer pollFinalUntilDone com shouldContinue — mantido para testes legados. */
export async function waitForFinalProgress(input: {
  jobId: string
  onProgress: (ratio: number) => void
  onStatusResponse?: () => void
  fetchImpl?: FetchImpl
  signal?: AbortSignal
  pollDelayMs?: number
  requestTimeoutMs?: number
}): Promise<{ capcutSaved: boolean; capcutFileName: string | null }> {
  return pollFinalUntilDone({
    jobId: input.jobId,
    shouldContinue: () => !input.signal?.aborted,
    onProgress: input.onProgress,
    onStatusResponse: input.onStatusResponse,
    fetchImpl: input.fetchImpl,
    pollDelayMs: input.pollDelayMs,
    requestTimeoutMs: input.requestTimeoutMs,
  })
}

export type FinalDownload = {
  blob: Blob
  capcutSaved: boolean
  capcutFileName: string | null
}

function assertExportContinuing(input: {
  shouldContinue?: () => boolean
  signal?: AbortSignal
}): void {
  if (input.shouldContinue && !input.shouldContinue()) {
    throw new DOMException("Export cancelado", "AbortError")
  }
  throwIfAborted(input.signal)
}

function isExportCancelled(
  error: unknown,
  input: { shouldContinue?: () => boolean; signal?: AbortSignal },
): boolean {
  if (input.shouldContinue && !input.shouldContinue()) return true
  return isUserAbort(error, input.signal)
}

export async function downloadFinalRender(
  jobId: string,
  input: {
    fetchImpl?: FetchImpl
    signal?: AbortSignal
    shouldContinue?: () => boolean
    onProgress?: (ratio: number) => void
    headerTimeoutMs?: number
    stallTimeoutMs?: number
    maxAttempts?: number
  } = {},
): Promise<FinalDownload> {
  const fetchImpl = input.fetchImpl ?? fetch
  const url = `/api/render/download/${jobId}`
  const headerTimeoutMs = input.headerTimeoutMs ?? 15_000
  const stallTimeoutMs = input.stallTimeoutMs ?? 20_000
  const maxAttempts = input.maxAttempts ?? 3
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    assertExportContinuing(input)
    const requestController = new AbortController()
    const abortDownload = () => requestController.abort()
    input.signal?.addEventListener("abort", abortDownload, { once: true })
    try {
      const response = await fetchResponseWithBudget({
        url,
        fetchImpl,
        requestTimeoutMs: headerTimeoutMs,
        requestController,
      })
      if (!response.ok) {
        throw errorFromRenderResponse(response.status, await readJsonBody(response))
      }
      const capcut = capcutFromDownloadHeaders(response.headers)
      const blob = await readBlobWithProgress(
        response,
        input.onProgress,
        input.shouldContinue,
        input.signal,
        stallTimeoutMs,
        abortDownload,
      )
      return {
        blob,
        capcutSaved: capcut.saved,
        capcutFileName: capcut.fileName,
      }
    } catch (error) {
      lastError = error
      try {
        abortDownload()
      } catch {
        // já abortado
      }
      if (isExportCancelled(error, input)) {
        throw new DOMException("Export cancelado", "AbortError")
      }
      if (error instanceof RenderExportError && !isRetryablePollError(error)) {
        throw error
      }
      logStall(url, attempt)
      if (attempt >= maxAttempts) break
    } finally {
      input.signal?.removeEventListener("abort", abortDownload)
    }
  }
  if (lastError instanceof RenderExportError) throw lastError
  throw new RenderExportError(
    "Não deu para baixar o MP4. Use Recuperar último export.",
    null,
    false,
  )
}

async function readBlobWithProgress(
  response: Response,
  onProgress: ((ratio: number) => void) | undefined,
  shouldContinue: (() => boolean) | undefined,
  signal: AbortSignal | undefined,
  stallTimeoutMs: number,
  onStall: () => void,
): Promise<Blob> {
  const total = Number(response.headers.get("content-length") || 0)
  const mime = response.headers.get("content-type") || "video/mp4"
  if (!response.body) {
    const blob = await response.blob()
    onProgress?.(1)
    return blob
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  const aborted = new Promise<never>((_, reject) => {
    const fail = () => reject(new DOMException("Export cancelado", "AbortError"))
    if (shouldContinue && !shouldContinue()) {
      fail()
      return
    }
    if (signal?.aborted) {
      fail()
      return
    }
    signal?.addEventListener("abort", fail, { once: true })
  })
  try {
    while (true) {
      if (shouldContinue && !shouldContinue()) {
        throw new DOMException("Export cancelado", "AbortError")
      }
      throwIfAborted(signal)
      let stallHandle: ReturnType<typeof setTimeout> | undefined
      const stalled = new Promise<never>((_, reject) => {
        stallHandle = setTimeout(() => {
          onStall()
          reject(new DownloadStallError())
        }, stallTimeoutMs)
      })
      try {
        const { done, value } = await Promise.race([reader.read(), stalled, aborted])
        if (done) break
        if (!value) continue
        chunks.push(value)
        received += value.byteLength
        if (total > 0) onProgress?.(Math.min(1, received / total))
      } finally {
        if (stallHandle) clearTimeout(stallHandle)
      }
    }
  } catch (error) {
    abandonReader(reader)
    throw error
  }
  onProgress?.(1)
  return new Blob(chunks, { type: mime })
}

export function finalExportFileName(fileName: string): string {
  return sanitizeCapcutFileName(fileName)
}

export async function exportViaRenderServer(input: {
  video: Blob
  props: RenderProps
  fileName: string
  saveToCapcut?: boolean
  onProgress: (ratio: number) => void
  onStatusResponse?: () => void
  onPhase?: (phase: ExportPhase) => void
  onJobId?: (jobId: string) => void
  fetchImpl?: FetchImpl
  signal?: AbortSignal
  pollDelayMs?: number
  requestTimeoutMs?: number
}): Promise<{
  blob: Blob
  fileName: string
  capcutSaved: boolean
  capcutFileName: string | null
}> {
  try {
    input.onPhase?.("uploading")
    input.onProgress(0.02)
    const jobId = await startFinalRender({
      video: input.video,
      props: input.props,
      fileName: input.fileName,
      saveToCapcut: input.saveToCapcut,
      fetchImpl: input.fetchImpl,
      signal: input.signal,
    })
    input.onJobId?.(jobId)
    input.onPhase?.("rendering")
    input.onProgress(finalRenderProgress(0))
    const progress = await waitForFinalProgress({
      jobId,
      onProgress: (ratio) => input.onProgress(finalRenderProgress(ratio)),
      onStatusResponse: input.onStatusResponse,
      fetchImpl: input.fetchImpl,
      signal: input.signal,
      ...(input.pollDelayMs === undefined ? {} : { pollDelayMs: input.pollDelayMs }),
      ...(input.requestTimeoutMs === undefined ? {} : { requestTimeoutMs: input.requestTimeoutMs }),
    })
    input.onPhase?.("downloading")
    input.onProgress(finalDownloadProgress(0))
    const downloaded = await downloadFinalRender(jobId, {
      fetchImpl: input.fetchImpl,
      signal: input.signal,
      onProgress: (ratio) => input.onProgress(finalDownloadProgress(ratio)),
    })
    return {
      blob: downloaded.blob,
      fileName: sanitizeCapcutFileName(input.fileName),
      capcutSaved: progress.capcutSaved || downloaded.capcutSaved,
      capcutFileName: progress.capcutFileName || downloaded.capcutFileName,
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      await cancelFinalRender(input.fetchImpl)
    }
    throw error
  }
}
