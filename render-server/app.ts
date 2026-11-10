import { randomUUID } from "node:crypto"
import { createReadStream } from "node:fs"
import { mkdir, readFile, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http"
import { pipeline } from "node:stream/promises"

import type { RenderProps } from "../remotion/types.ts"
import { copyExportToCapcut } from "../lib/export/capcut-copy.ts"
import { userMessageFromRenderError } from "./bundle-cache.ts"
import { hasEnoughDisk } from "./disk.ts"
import { dockerWarning } from "./docker.ts"
import {
  cleanupJobFiles,
  isExpired,
  jobPaths,
  resetTmpDir,
  type JobStatus,
} from "./jobs.ts"
import { createMutex } from "./mutex.ts"
import { createProgressHub, type ProgressEvent } from "./progress.ts"
import { MAX_AUDIO_FILE_BYTES, MAX_RENDER_UPLOAD_BYTES } from "../lib/audio/types.ts"
import { audioFormField } from "../lib/audio/upload.ts"
import { capcutAudioPlan } from "../lib/export/capcut-audio.ts"
import { applyUploadedAudio, applyUploadedVideo, mediaUrlForAudio, mediaUrlForJob, parseRenderProps } from "./props.ts"

export type RenderEngine = {
  bundle: () => Promise<{ serveUrl: string; version: string }>
  render: (opts: {
    jobId: string
    inputProps: RenderProps
    outputLocation: string
    onProgress: (event: { progress: number }) => void
    signal: AbortSignal
  }) => Promise<void>
}

export type RenderAppOptions = {
  engine: RenderEngine
  tmpDir: string
  getFreeDiskBytes: (dir: string) => Promise<number>
  isDockerRunning: () => Promise<boolean>
  now: () => number
  minFreeDiskBytes: number
  renderTimeoutMs: number
  ttlMs: number
  host: string
  port: number
  capcutDir?: string
}

type Job = {
  id: string
  status: JobStatus
  createdAt: number
  inputPath: string | null
  outputPath: string
  saveToCapcut: boolean
  exportFileName: string
  capcutFileName?: string
  error?: string
}

export async function createRenderApp(options: RenderAppOptions): Promise<{
  server: Server
  url: string
  close: () => Promise<void>
}> {
  await resetTmpDir(options.tmpDir)

  const mutex = createMutex()
  const hub = createProgressHub()
  const jobs = new Map<string, Job>()
  let activeAbort: AbortController | null = null
  let bundle = await options.engine.bundle()

  const ttlTimer = setInterval(() => {
    void sweepExpired()
  }, 30_000)
  ttlTimer.unref()

  async function sweepExpired(): Promise<void> {
    const now = options.now()
    for (const job of [...jobs.values()]) {
      if (!isExpired(job, now, options.ttlMs)) continue
      await cleanupJobFiles(filesForJob(options.tmpDir, job))
      jobs.delete(job.id)
      hub.drop(job.id)
    }
  }

  const server = createServer((req, res) => {
    void handle(req, res).catch((error: unknown) => {
      if (!res.headersSent) {
        sendJson(res, 500, {
          error: error instanceof Error ? error.message : "erro interno",
        })
      }
    })
  })

  await listen(server, options.host, options.port)
  const address = server.address()
  if (!address || typeof address === "string") {
    throw new Error("falha ao abrir a porta do servidor de render")
  }

  const url = `http://${options.host}:${address.port}`

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = req.method ?? "GET"
    const requestUrl = new URL(req.url ?? "/", url)

    if (method === "GET" && requestUrl.pathname === "/health") {
      const freeDiskBytes = await options.getFreeDiskBytes(options.tmpDir)
      const dockerRunning = await options.isDockerRunning()
      sendJson(res, 200, {
        ok: true,
        busy: mutex.snapshot().busy,
        jobId: mutex.snapshot().currentJobId,
        freeDiskBytes,
        freeDiskGb: Math.round((freeDiskBytes / 1024 ** 3) * 10) / 10,
        bundleVersion: bundle.version,
        dockerRunning,
        dockerWarning: dockerWarning(dockerRunning),
      })
      return
    }

    if (method === "POST" && requestUrl.pathname === "/cancel") {
      handleCancel(res)
      return
    }

    if (method === "POST" && requestUrl.pathname === "/rebundle") {
      if (mutex.snapshot().busy) {
        sendJson(res, 409, { error: "render em andamento" })
        return
      }
      bundle = await options.engine.bundle()
      sendJson(res, 200, { bundleVersion: bundle.version })
      return
    }

    if (method === "POST" && requestUrl.pathname === "/render") {
      await handleRender(req, res)
      return
    }

    const progressMatch = /^\/progress\/([^/]+)$/.exec(requestUrl.pathname)
    if (method === "GET" && progressMatch) {
      handleProgress(res, decodeURIComponent(progressMatch[1] ?? ""))
      return
    }

    const statusMatch = /^\/status\/([^/]+)$/.exec(requestUrl.pathname)
    if (method === "GET" && statusMatch) {
      handleStatus(res, decodeURIComponent(statusMatch[1] ?? ""))
      return
    }

    const downloadMatch = /^\/download\/([^/]+)$/.exec(requestUrl.pathname)
    if (method === "GET" && downloadMatch) {
      await handleDownload(res, decodeURIComponent(downloadMatch[1] ?? ""))
      return
    }

    const mediaMatch = /^\/media\/([^/]+)(?:\/([^/]+))?$/.exec(requestUrl.pathname)
    if ((method === "GET" || method === "HEAD") && mediaMatch) {
      await handleMedia(
        res,
        decodeURIComponent(mediaMatch[1] ?? ""),
        mediaMatch[2] ? decodeURIComponent(mediaMatch[2]) : null,
        method === "HEAD",
      )
      return
    }

    sendJson(res, 404, { error: "não encontrado" })
  }

  async function handleRender(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const jobId = randomUUID()
    if (!mutex.tryAcquire(jobId).ok) {
      sendJson(res, 409, {
        error: "render em andamento",
        jobId: mutex.snapshot().currentJobId,
      })
      return
    }

    try {
      const freeDiskBytes = await options.getFreeDiskBytes(options.tmpDir)
      if (!hasEnoughDisk(freeDiskBytes, options.minFreeDiskBytes)) {
        mutex.release()
        sendJson(res, 507, {
          error: "disco insuficiente",
          freeDiskBytes,
          minFreeDiskBytes: options.minFreeDiskBytes,
        })
        return
      }

      const form = await readFormData(req)
      let props: RenderProps
      try {
        props = parseRenderProps(await readPropsField(form))
      } catch (error) {
        mutex.release()
        sendJson(res, 400, {
          error: error instanceof Error ? error.message : "props.json inválido",
        })
        return
      }

      const paths = jobPaths(options.tmpDir, jobId)
      let inputPath: string | null = null
      const video = form.get("video")
      const videoBytes = isUploadedFile(video) ? video.size : 0
      const audioUploads = await readAudioUploads(form, props)
      const audioBytes = audioUploads.reduce((sum, item) => sum + item.file.size, 0)
      if (audioUploads.some((item) => item.file.size > MAX_AUDIO_FILE_BYTES)) {
        mutex.release()
        sendJson(res, 413, { error: "Cada áudio pode ter no máximo 50 MB." })
        return
      }
      if (videoBytes + audioBytes > MAX_RENDER_UPLOAD_BYTES) {
        mutex.release()
        sendJson(res, 413, {
          error: "O envio passa de 200 MB (vídeo + áudios). Remova uma faixa ou use um arquivo menor.",
        })
        return
      }
      if (isUploadedFile(video) && video.size > 0) {
        await writeFile(paths.inputPath, Buffer.from(await video.arrayBuffer()))
        inputPath = paths.inputPath
      }
      const audioSrcById: Record<string, string> = {}
      if (audioUploads.length > 0) {
        await mkdir(paths.audioDir, { recursive: true })
        for (const item of audioUploads) {
          const dest = pathJoinAudio(paths.audioDir, item.id)
          await writeFile(dest, Buffer.from(await item.file.arrayBuffer()))
          audioSrcById[item.id] = mediaUrlForAudio(url, jobId, item.id)
        }
      }

      const job: Job = {
        id: jobId,
        status: "rendering",
        createdAt: options.now(),
        inputPath,
        outputPath: paths.outputPath,
        saveToCapcut: wantsCapcutCopy(form),
        exportFileName: readFileNameField(form),
      }
      jobs.set(jobId, job)
      hub.emit(jobId, { progress: 0, stage: "rendering" })
      const controller = new AbortController()
      activeAbort = controller
      sendJson(res, 202, { jobId })
      void runJob(
        job,
        applyUploadedAudio(
          applyUploadedVideo(props, inputPath ? mediaUrlForJob(url, jobId) : null),
          audioSrcById,
        ),
        controller,
      )
    } catch (error) {
      mutex.release()
      if (!res.headersSent) {
        sendJson(res, 400, {
          error: error instanceof Error ? error.message : "pedido inválido",
        })
      }
    }
  }

  function handleCancel(res: ServerResponse): void {
    const jobId = mutex.snapshot().currentJobId
    if (!activeAbort || !jobId) {
      sendJson(res, 200, { ok: true, cancelled: false })
      return
    }
    activeAbort.abort()
    sendJson(res, 200, { ok: true, cancelled: true, jobId })
  }

  async function runJob(
    job: Job,
    inputProps: RenderProps,
    controller: AbortController,
  ): Promise<void> {
    const timer = setTimeout(() => controller.abort(), options.renderTimeoutMs)
    try {
      if (controller.signal.aborted) {
        throw new Error("render cancelado")
      }
      await options.engine.render({
        jobId: job.id,
        inputProps,
        outputLocation: job.outputPath,
        signal: controller.signal,
        onProgress: ({ progress }) => {
          hub.emit(job.id, { progress, stage: "rendering" })
        },
      })
      if (job.saveToCapcut && options.capcutDir) {
        try {
          const extraFiles = await readCapcutAudioFiles(options.tmpDir, job.id, inputProps)
          const copied = await copyExportToCapcut({
            destDir: options.capcutDir,
            fileName: job.exportFileName,
            sourcePath: job.outputPath,
            extraFiles,
            audioPlan: capcutAudioPlan(inputProps.audio),
          })
          job.capcutFileName = copied.fileName
        } catch (error) {
          console.error(`render ${job.id} capcut:`, error)
        }
      }
      job.status = "done"
      hub.emit(job.id, {
        progress: 1,
        stage: "done",
        ...(job.saveToCapcut
          ? {
              capcutSaved: Boolean(job.capcutFileName),
              ...(job.capcutFileName ? { capcutFileName: job.capcutFileName } : {}),
            }
          : {}),
      })
    } catch (error) {
      job.status = "error"
      job.error = controller.signal.aborted
        ? "render cancelado"
        : userMessageFromRenderError(error)
      if (!controller.signal.aborted) {
        console.error(`render ${job.id} falhou:`, error)
      }
      hub.emit(job.id, {
        progress: hub.peek(job.id)?.progress ?? 0,
        stage: "error",
        error: job.error,
      })
    } finally {
      clearTimeout(timer)
      if (activeAbort === controller) activeAbort = null
      mutex.release()
    }
  }

  function handleProgress(res: ServerResponse, jobId: string): void {
    if (!jobs.has(jobId)) {
      sendJson(res, 404, { error: "job não encontrado" })
      return
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    })

    let closed = false
    let unsubscribe = () => {}

    const finish = () => {
      if (closed) return
      closed = true
      clearInterval(keepalive)
      unsubscribe()
      res.end()
    }

    const send = (event: ProgressEvent) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`)
      if (event.stage === "done" || event.stage === "error") {
        finish()
      }
    }

    const keepalive = setInterval(() => {
      if (closed) return
      res.write(`: keepalive\n\n`)
    }, 2000)

    unsubscribe = hub.subscribe(jobId, send)
    res.on("close", finish)
  }

  /** Progresso em requisição curta: o navegador remoto não depende de stream. */
  function handleStatus(res: ServerResponse, jobId: string): void {
    const job = jobs.get(jobId)
    if (!job) {
      sendJson(res, 404, { error: "job não encontrado" })
      return
    }
    const last = hub.peek(jobId)
    sendJson(res, 200, {
      progress: job.status === "done" ? 1 : last?.progress ?? 0,
      stage: job.status,
      ...(job.error ? { error: job.error } : {}),
      ...(job.saveToCapcut
        ? {
            capcutSaved: Boolean(job.capcutFileName),
            ...(job.capcutFileName ? { capcutFileName: job.capcutFileName } : {}),
          }
        : {}),
    })
  }

  async function handleMedia(
    res: ServerResponse,
    jobId: string,
    audioId: string | null,
    headOnly: boolean,
  ): Promise<void> {
    const job = jobs.get(jobId)
    if (!job) {
      sendJson(res, 404, { error: "vídeo de entrada não encontrado" })
      return
    }
    const filePath = audioId
      ? audioFilePath(jobPaths(options.tmpDir, jobId).audioDir, audioId)
      : job.inputPath
    if (!filePath) {
      sendJson(res, 404, { error: "vídeo de entrada não encontrado" })
      return
    }

    let size = 0
    try {
      size = (await stat(filePath)).size
    } catch {
      sendJson(res, 404, { error: audioId ? "áudio não encontrado" : "vídeo de entrada não encontrado" })
      return
    }

    res.writeHead(200, {
      "Content-Type": audioId ? "audio/mpeg" : "video/mp4",
      "Content-Length": size,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
      "Accept-Ranges": "bytes",
    })
    if (headOnly) {
      res.end()
      return
    }
    await pipeline(createReadStream(filePath), res)
  }

  async function handleDownload(res: ServerResponse, jobId: string): Promise<void> {
    const job = jobs.get(jobId)
    if (!job) {
      sendJson(res, 404, { error: "job não encontrado" })
      return
    }
    if (job.status !== "done") {
      sendJson(res, 409, {
        error: job.status === "error" ? job.error ?? "falha no render" : "ainda renderizando",
      })
      return
    }

    let size = 0
    try {
      size = (await stat(job.outputPath)).size
    } catch {
      sendJson(res, 404, { error: "arquivo não encontrado" })
      return
    }

    const headers: Record<string, string | number> = {
      "Content-Type": "video/mp4",
      "Content-Length": size,
      "Content-Disposition": `attachment; filename="${jobId}.mp4"`,
      Connection: "close",
    }
    if (job.capcutFileName) {
      headers["X-Capcut-Saved"] = "1"
      headers["X-Capcut-File"] = encodeURIComponent(job.capcutFileName)
    } else if (job.saveToCapcut) {
      headers["X-Capcut-Saved"] = "0"
    }
    res.writeHead(200, headers)
    try {
      await pipeline(createReadStream(job.outputPath), res)
    } finally {
      await cleanupJobFiles(filesForJob(options.tmpDir, job))
      jobs.delete(jobId)
      hub.drop(jobId)
    }
  }

  async function close(): Promise<void> {
    clearInterval(ttlTimer)
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error)
        else resolve()
      })
    })
  }

  return { server, url, close }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
    Connection: "close",
  })
  res.end(payload)
}

function listen(server: Server, host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(port, host, () => {
      server.off("error", reject)
      resolve()
    })
  })
}

async function readFormData(req: IncomingMessage): Promise<FormData> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const body = Buffer.concat(chunks)
  const contentType = req.headers["content-type"] ?? ""
  if (body.length === 0) return new FormData()

  if (contentType.includes("application/json")) {
    const form = new FormData()
    form.set("props", new Blob([body], { type: "application/json" }), "props.json")
    return form
  }

  if (contentType.includes("multipart/form-data")) {
    const request = new Request("http://render.local/render", {
      method: "POST",
      headers: { "content-type": contentType },
      body: new Uint8Array(body),
      duplex: "half",
    } as RequestInit)
    return request.formData()
  }

  return new FormData()
}

async function readPropsField(form: FormData): Promise<string | null> {
  const value = form.get("props")
  if (value == null) return null
  if (typeof value === "string") return value
  if (isUploadedFile(value)) return value.text()
  return null
}

function filesForJob(
  tmpDir: string,
  job: { id: string; inputPath: string | null; outputPath: string },
) {
  const paths = jobPaths(tmpDir, job.id)
  return {
    ...paths,
    inputPath: job.inputPath ?? paths.inputPath,
    outputPath: job.outputPath,
  }
}

function safeAudioId(id: string): string | null {
  return /^[a-zA-Z0-9_-]{1,80}$/.test(id) ? id : null
}

function audioFilePath(audioDir: string, id: string): string | null {
  const safe = safeAudioId(id)
  if (!safe) return null
  const dest = path.join(audioDir, `${safe}.audio`)
  if (!dest.startsWith(audioDir)) return null
  return dest
}

function pathJoinAudio(audioDir: string, id: string): string {
  const dest = audioFilePath(audioDir, id)
  if (!dest) throw new Error("id de áudio inválido")
  return dest
}

function readAudioUploads(
  form: FormData,
  props: RenderProps,
): { id: string; file: File }[] {
  const uploads: { id: string; file: File }[] = []
  for (const track of props.audio?.tracks ?? []) {
    if (track.muted || !(track.volume > 0)) continue
    if (!safeAudioId(track.id)) continue
    const value = form.get(audioFormField(track.id))
    if (!isUploadedFile(value) || value.size <= 0) continue
    uploads.push({ id: track.id, file: value })
  }
  return uploads
}

async function readCapcutAudioFiles(
  tmpDir: string,
  jobId: string,
  props: RenderProps,
): Promise<{ fileName: string; bytes: Uint8Array }[]> {
  const audioDir = jobPaths(tmpDir, jobId).audioDir
  const files: { fileName: string; bytes: Uint8Array }[] = []
  for (const track of props.audio?.tracks ?? []) {
    const filePath = audioFilePath(audioDir, track.id)
    if (!filePath) continue
    try {
      const bytes = await readFile(filePath)
      files.push({
        fileName: track.fileName || `${track.id}.mp3`,
        bytes: new Uint8Array(bytes),
      })
    } catch {
      /* faixa sem arquivo no disco */
    }
  }
  return files
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return typeof File !== "undefined" && value instanceof File
}

function readStringField(form: FormData, name: string): string | null {
  const value = form.get(name)
  return typeof value === "string" ? value : null
}

function wantsCapcutCopy(form: FormData): boolean {
  const flag = readStringField(form, "saveToCapcut")
  return flag === "1" || flag === "true"
}

function readFileNameField(form: FormData): string {
  const name = readStringField(form, "fileName")?.trim()
  return name || "video.mp4"
}
