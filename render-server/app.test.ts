import assert from "node:assert/strict"
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"

import { defaultRenderProps } from "../remotion/types.ts"
import { createRenderApp, type RenderAppOptions, type RenderEngine } from "./app.ts"
import { GB } from "./disk.ts"

type HeldRender = {
  engine: RenderEngine
  release: () => void
}

function instantEngine(): RenderEngine {
  return {
    async bundle() {
      return { serveUrl: "http://bundle.local", version: "bundle-v1" }
    },
    async render({ outputLocation, onProgress }) {
      onProgress({ progress: 0.4 })
      await writeFile(outputLocation, "fake-mp4")
      onProgress({ progress: 1 })
    },
  }
}

function heldEngine(): HeldRender {
  let release = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  return {
    release,
    engine: {
      async bundle() {
        return { serveUrl: "http://bundle.local", version: "bundle-v1" }
      },
      async render({ outputLocation, onProgress, signal }) {
        onProgress({ progress: 0.1 })
        await new Promise<void>((resolve, reject) => {
          const onAbort = () => reject(new Error("cancelled"))
          if (signal.aborted) {
            onAbort()
            return
          }
          signal.addEventListener("abort", onAbort, { once: true })
          gate.then(() => {
            signal.removeEventListener("abort", onAbort)
            resolve()
          })
        })
        await writeFile(outputLocation, "fake-mp4")
        onProgress({ progress: 1 })
      },
    },
  }
}

async function startServer(overrides: Partial<RenderAppOptions> = {}) {
  const tmpDir = await mkdtemp(path.join(tmpdir(), "render-app-"))
  const app = await createRenderApp({
    engine: instantEngine(),
    tmpDir,
    getFreeDiskBytes: async () => 20 * GB,
    isDockerRunning: async () => false,
    now: () => Date.now(),
    minFreeDiskBytes: 5 * GB,
    renderTimeoutMs: 10_000,
    ttlMs: 60 * 60 * 1000,
    host: "127.0.0.1",
    port: 0,
    ...overrides,
  })
  return {
    ...app,
    tmpDir,
    async closeAll() {
      await app.close()
      await rm(tmpDir, { recursive: true, force: true })
    },
  }
}

function sseEvents(body: string): Array<{ progress: number; stage: string }> {
  const events: Array<{ progress: number; stage: string }> = []
  for (const block of body.split("\n\n")) {
    const line = block.split("\n").find((entry) => entry.startsWith("data:"))
    if (!line) continue
    events.push(JSON.parse(line.slice("data:".length).trim()) as { progress: number; stage: string })
  }
  return events
}

async function waitUntil<T>(
  read: () => Promise<T>,
  ok: (value: T) => boolean,
  timeoutMs = 1000,
): Promise<T> {
  const started = Date.now()
  let value = await read()
  while (!ok(value)) {
    if (Date.now() - started > timeoutMs) return value
    await new Promise((resolve) => setTimeout(resolve, 20))
    value = await read()
  }
  return value
}

async function readSseUntilDone(url: string): Promise<Array<{ progress: number; stage: string }>> {
  const response = await fetch(url)
  assert.equal(response.status, 200)
  assert.match(response.headers.get("content-type") ?? "", /text\/event-stream/)
  const reader = response.body?.getReader()
  assert.ok(reader)
  const decoder = new TextDecoder()
  let raw = ""
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    raw += decoder.decode(chunk.value, { stream: true })
    const events = sseEvents(raw)
    if (events.some((event) => event.stage === "done" || event.stage === "error")) {
      await reader.cancel()
      return events
    }
  }
  return sseEvents(raw)
}

test("GET /health responde busy, disco e versão do bundle", async () => {
  const server = await startServer({
    getFreeDiskBytes: async () => 12 * GB,
    isDockerRunning: async () => true,
  })
  try {
    const response = await fetch(`${server.url}/health`)
    assert.equal(response.status, 200)
    const body = await response.json() as {
      ok: boolean
      busy: boolean
      freeDiskBytes: number
      bundleVersion: string
      dockerRunning: boolean
      dockerWarning: string | null
    }
    assert.equal(body.ok, true)
    assert.equal(body.busy, false)
    assert.equal(body.jobId, null)
    assert.equal(body.freeDiskBytes, 12 * GB)
    assert.equal(body.bundleVersion, "bundle-v1")
    assert.equal(body.dockerRunning, true)
    assert.ok(body.dockerWarning)
    assert.match(response.headers.get("cache-control") ?? "", /no-store/i)
  } finally {
    await server.closeAll()
  }
})

test("POST /render devolve 409 se já houver render e não derruba o primeiro", async () => {
  const held = heldEngine()
  const server = await startServer({ engine: held.engine })
  try {
    const first = await fetch(`${server.url}/render`, { method: "POST" })
    assert.equal(first.status, 202)
    const { jobId } = await first.json() as { jobId: string }
    assert.ok(jobId)

    const second = await fetch(`${server.url}/render`, { method: "POST" })
    assert.equal(second.status, 409)
    const error = await second.json() as { error: string; jobId?: string }
    assert.match(error.error, /andamento/i)
    assert.equal(error.jobId, jobId)

    const health = await fetch(`${server.url}/health`).then((res) => res.json()) as {
      busy: boolean
      jobId: string | null
    }
    assert.equal(health.busy, true)
    assert.equal(health.jobId, jobId)

    held.release()
    const events = await readSseUntilDone(`${server.url}/progress/${jobId}`)
    assert.equal(events.at(-1)?.progress, 1)
  } finally {
    held.release()
    await server.closeAll()
  }
})

test("POST /cancel interrompe o render e libera o mutex", async () => {
  const held = heldEngine()
  const server = await startServer({ engine: held.engine })
  try {
    const first = await fetch(`${server.url}/render`, { method: "POST" })
    const { jobId } = await first.json() as { jobId: string }

    const cancelled = await fetch(`${server.url}/cancel`, { method: "POST" })
    assert.equal(cancelled.status, 200)
    const body = await cancelled.json() as { ok: boolean; cancelled: boolean; jobId?: string }
    assert.equal(body.ok, true)
    assert.equal(body.cancelled, true)
    assert.equal(body.jobId, jobId)

    const idle = await waitUntil(
      () =>
        fetch(`${server.url}/health`).then((res) => res.json()) as Promise<{
          busy: boolean
          jobId: string | null
        }>,
      (health) => health.busy === false,
    )
    assert.equal(idle.busy, false)
    assert.equal(idle.jobId, null)
  } finally {
    held.release()
    await server.closeAll()
  }
})

test("POST /cancel sem render em andamento não falha", async () => {
  const server = await startServer()
  try {
    const response = await fetch(`${server.url}/cancel`, { method: "POST" })
    assert.equal(response.status, 200)
    const body = await response.json() as { cancelled: boolean }
    assert.equal(body.cancelled, false)
  } finally {
    await server.closeAll()
  }
})

test("POST /render devolve 507 se o disco livre for menor que 5 GB e libera o mutex", async () => {
  const server = await startServer({
    getFreeDiskBytes: async () => 4 * GB,
  })
  try {
    const blocked = await fetch(`${server.url}/render`, { method: "POST" })
    assert.equal(blocked.status, 507)
    const health = await fetch(`${server.url}/health`).then((res) => res.json()) as { busy: boolean }
    assert.equal(health.busy, false)
  } finally {
    await server.closeAll()
  }
})

test("SSE emite progresso monotônico até 1", async () => {
  const server = await startServer({
    engine: {
      async bundle() {
        return { serveUrl: "http://bundle.local", version: "bundle-v1" }
      },
      async render({ outputLocation, onProgress }) {
        onProgress({ progress: 0.2 })
        onProgress({ progress: 0.1 })
        await writeFile(outputLocation, "fake-mp4")
        onProgress({ progress: 1 })
      },
    },
  })
  try {
    const started = await fetch(`${server.url}/render`, { method: "POST" })
    const { jobId } = await started.json() as { jobId: string }
    const events = await readSseUntilDone(`${server.url}/progress/${jobId}`)
    const progresses = events.map((event) => event.progress)
    for (let index = 1; index < progresses.length; index += 1) {
      assert.ok(progresses[index]! >= progresses[index - 1]!)
    }
    assert.equal(progresses.at(-1), 1)
  } finally {
    await server.closeAll()
  }
})

test("GET /status devolve o progresso sem stream e sobrevive ao fim do job", async () => {
  const held = heldEngine()
  const server = await startServer({ engine: held.engine })
  try {
    const started = await fetch(`${server.url}/render`, { method: "POST" })
    const { jobId } = (await started.json()) as { jobId: string }

    const rendering = (await fetch(`${server.url}/status/${jobId}`).then((res) =>
      res.json(),
    )) as { progress: number; stage: string }
    assert.equal(rendering.stage, "rendering")
    assert.ok(rendering.progress >= 0)

    held.release()
    const finished = await waitUntil(
      () =>
        fetch(`${server.url}/status/${jobId}`).then((res) => res.json()) as Promise<{
          progress: number
          stage: string
        }>,
      (status) => status.stage === "done",
    )
    assert.equal(finished.stage, "done")
    assert.equal(finished.progress, 1)

    const unknown = await fetch(`${server.url}/status/nao-existe`)
    assert.equal(unknown.status, 404)
  } finally {
    held.release()
    await server.closeAll()
  }
})

test("GET /status conta a cópia CapCut para o cliente", async () => {
  const capcutDir = await mkdtemp(path.join(tmpdir(), "capcut-status-"))
  const server = await startServer({ capcutDir })
  try {
    const started = await fetch(`${server.url}/render`, {
      method: "POST",
      body: (() => {
        const form = new FormData()
        form.set(
          "props",
          new Blob([JSON.stringify(defaultRenderProps)], { type: "application/json" }),
          "props.json",
        )
        form.set("saveToCapcut", "1")
        form.set("fileName", "Meu Anúncio.mp4")
        return form
      })(),
    })
    const { jobId } = (await started.json()) as { jobId: string }
    const done = await waitUntil(
      () =>
        fetch(`${server.url}/status/${jobId}`).then((res) => res.json()) as Promise<{
          stage: string
          capcutSaved?: boolean
          capcutFileName?: string
        }>,
      (status) => status.stage === "done",
    )
    assert.equal(done.capcutSaved, true)
    assert.equal(done.capcutFileName, "Meu Anúncio.mp4")
  } finally {
    await rm(capcutDir, { recursive: true, force: true })
    await server.closeAll()
  }
})

test("POST /render aponta o vídeo para GET /media via http", async () => {
  const server = await startServer({
    engine: {
      async bundle() {
        return { serveUrl: "http://bundle.local", version: "bundle-v1" }
      },
      async render({ inputProps, outputLocation, onProgress }) {
        assert.match(inputProps.video.src, /^http:\/\/127\.0\.0\.1:\d+\/media\//)
        const media = await fetch(inputProps.video.src)
        assert.equal(media.status, 200)
        assert.equal(await media.text(), "clip")
        await writeFile(outputLocation, "fake-mp4")
        onProgress({ progress: 1 })
      },
    },
  })
  try {
    const started = await fetch(`${server.url}/render`, {
      method: "POST",
      body: (() => {
        const form = new FormData()
        form.set(
          "props",
          new Blob([JSON.stringify(defaultRenderProps)], { type: "application/json" }),
          "props.json",
        )
        form.set("video", new Blob(["clip"], { type: "video/mp4" }), "clip.mp4")
        return form
      })(),
    })
    assert.equal(started.status, 202)
    const { jobId } = await started.json() as { jobId: string }
    const events = await readSseUntilDone(`${server.url}/progress/${jobId}`)
    assert.equal(events.at(-1)?.stage, "done")
    assert.equal(await fetch(`${server.url}/media/missing`).then((res) => res.status), 404)
  } finally {
    await server.closeAll()
  }
})

test("GET /download devolve o MP4 e limpa tmp/", async () => {
  const server = await startServer()
  try {
    const started = await fetch(`${server.url}/render`, {
      method: "POST",
      body: (() => {
        const form = new FormData()
        form.set(
          "props",
          new Blob([JSON.stringify(defaultRenderProps)], { type: "application/json" }),
          "props.json",
        )
        form.set("video", new Blob(["clip"], { type: "video/mp4" }), "clip.mp4")
        return form
      })(),
    })
    assert.equal(started.status, 202)
    const { jobId } = await started.json() as { jobId: string }
    await readSseUntilDone(`${server.url}/progress/${jobId}`)

    const download = await fetch(`${server.url}/download/${jobId}`)
    assert.equal(download.status, 200)
    assert.match(download.headers.get("content-type") ?? "", /video\/mp4/)
    assert.equal(await download.text(), "fake-mp4")

    const leftover = await waitUntil(
      async () => readdir(server.tmpDir),
      (files) => files.length === 0,
    )
    assert.deepEqual(leftover, [])
  } finally {
    await server.closeAll()
  }
})

test("POST /render com saveToCapcut copia o MP4 para a pasta CapCut", async () => {
  const capcutDir = await mkdtemp(path.join(tmpdir(), "capcut-dest-"))
  const server = await startServer({ capcutDir })
  try {
    const started = await fetch(`${server.url}/render`, {
      method: "POST",
      body: (() => {
        const form = new FormData()
        form.set(
          "props",
          new Blob([JSON.stringify(defaultRenderProps)], { type: "application/json" }),
          "props.json",
        )
        form.set("video", new Blob(["clip"], { type: "video/mp4" }), "clip.mp4")
        form.set("saveToCapcut", "1")
        form.set("fileName", "anuncio.mp4")
        return form
      })(),
    })
    assert.equal(started.status, 202)
    const { jobId } = await started.json() as { jobId: string }
    const events = await readSseUntilDone(`${server.url}/progress/${jobId}`)
    assert.equal(events.at(-1)?.stage, "done")
    assert.equal(
      await readFile(path.join(capcutDir, "anuncio.mp4"), "utf8"),
      "fake-mp4",
    )

    const download = await fetch(`${server.url}/download/${jobId}`)
    assert.equal(download.headers.get("x-capcut-saved"), "1")
    assert.equal(
      decodeURIComponent(download.headers.get("x-capcut-file") ?? ""),
      "anuncio.mp4",
    )
    assert.equal(await download.text(), "fake-mp4")
  } finally {
    await server.closeAll()
    await rm(capcutDir, { recursive: true, force: true })
  }
})

test("POST /render sem saveToCapcut não grava na pasta CapCut", async () => {
  const capcutDir = await mkdtemp(path.join(tmpdir(), "capcut-skip-"))
  const server = await startServer({ capcutDir })
  try {
    const started = await fetch(`${server.url}/render`, { method: "POST" })
    const { jobId } = await started.json() as { jobId: string }
    await readSseUntilDone(`${server.url}/progress/${jobId}`)
    assert.deepEqual(await readdir(capcutDir), [])
    const download = await fetch(`${server.url}/download/${jobId}`)
    assert.equal(download.headers.get("x-capcut-saved"), null)
  } finally {
    await server.closeAll()
    await rm(capcutDir, { recursive: true, force: true })
  }
})

test("boot apaga arquivo órfão deixado no tmp", async () => {
  const tmpDir = await mkdtemp(path.join(tmpdir(), "render-orphan-"))
  await writeFile(path.join(tmpDir, "ghost.mp4"), "old")
  const app = await createRenderApp({
    engine: instantEngine(),
    tmpDir,
    getFreeDiskBytes: async () => 20 * GB,
    isDockerRunning: async () => false,
    now: () => Date.now(),
    minFreeDiskBytes: 5 * GB,
    renderTimeoutMs: 10_000,
    ttlMs: 60 * 60 * 1000,
    host: "127.0.0.1",
    port: 0,
  })
  try {
    assert.deepEqual(await readdir(tmpDir), [])
  } finally {
    await app.close()
    await rm(tmpDir, { recursive: true, force: true })
  }
})
