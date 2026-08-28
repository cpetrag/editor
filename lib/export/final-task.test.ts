import assert from "node:assert/strict"
import { test } from "node:test"

import { defaultRenderProps } from "../../remotion/types.ts"
import type { StorageLike } from "../project-store.ts"
import { LAST_EXPORT_JOB_KEY, loadLastExportJob } from "./last-job.ts"
import { createFinalExportTask } from "./final-task.ts"

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function memoryStorage(): StorageLike {
  const data = new Map<string, string>()
  return {
    getItem(key) {
      return data.get(key) ?? null
    },
    setItem(key, value) {
      data.set(key, value)
    },
    removeItem(key) {
      data.delete(key)
    },
  }
}

function waitUntil(task: ReturnType<typeof createFinalExportTask>, done: () => boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout da tarefa de export")), 4000)
    const unsub = task.subscribe(() => {
      if (!done()) return
      clearTimeout(timer)
      unsub()
      resolve()
    })
    if (done()) {
      clearTimeout(timer)
      unsub()
      resolve()
    }
  })
}

test("getSnapshot devolve a mesma referência se nada mudou", () => {
  const task = createFinalExportTask({ persist: memoryStorage() })
  const first = task.getSnapshot()
  const second = task.getSnapshot()
  assert.equal(first, second)
  task.dispose()
})

test("createFinalExportTask conclui o Final e chama o save fora do React", async () => {
  const storage = memoryStorage()
  const task = createFinalExportTask({ persist: storage })
  const saved: string[] = []
  task.setSaveHandler(async (result) => {
    saved.push(await result.blob.text())
  })
  let polls = 0
  task.start({
    video: new Blob(["clip"]),
    props: defaultRenderProps,
    fileName: "anuncio.mp4",
    saveToCapcut: true,
    pollDelayMs: 0,
    fetchImpl: async (input, init) => {
      const url = String(input)
      if (url === "/api/render" && init?.method === "POST") {
        return jsonResponse(202, { jobId: "job-9" })
      }
      if (url === "/api/render") return jsonResponse(200, { ok: true, busy: true, jobId: "job-9" })
      if (url.startsWith("/api/render/status/job-9")) {
        polls += 1
        return polls === 1
          ? jsonResponse(200, { progress: 0.4, stage: "rendering" })
          : jsonResponse(200, { progress: 1, stage: "done" })
      }
      if (url === "/api/render/download/job-9") {
        return new Response("fake-mp4", {
          status: 200,
          headers: { "content-type": "video/mp4", "content-length": "8" },
        })
      }
      return jsonResponse(404, { error: "não encontrado" })
    },
  })
  await waitUntil(task, () => !task.getSnapshot().running && saved.length > 0)
  assert.equal(saved[0], "fake-mp4")
  assert.equal(loadLastExportJob(storage)?.jobId, "job-9")
  assert.equal(storage.getItem(LAST_EXPORT_JOB_KEY)?.includes("job-9"), true)
  task.dispose()
})

test("desinscrever o React não aborta a tarefa", async () => {
  const task = createFinalExportTask({ persist: memoryStorage() })
  const signals: AbortSignal[] = []
  const unsub = task.subscribe(() => {})
  const saved: string[] = []
  task.setSaveHandler(async (result) => {
    saved.push(await result.blob.text())
  })
  task.start({
    video: new Blob(["clip"]),
    props: defaultRenderProps,
    fileName: "anuncio.mp4",
    pollDelayMs: 0,
    fetchImpl: async (input, init) => {
      if (init?.signal) signals.push(init.signal)
      const url = String(input)
      if (url === "/api/render" && init?.method === "POST") {
        return jsonResponse(202, { jobId: "job-9" })
      }
      if (url.startsWith("/api/render/status/")) {
        return jsonResponse(200, { progress: 1, stage: "done" })
      }
      if (url === "/api/render/download/job-9") {
        return new Response("ok", { status: 200, headers: { "content-type": "video/mp4" } })
      }
      return jsonResponse(200, { ok: true, busy: false, jobId: null })
    },
  })
  unsub()
  assert.equal(
    signals.some((signal) => signal.aborted),
    false,
    "desinscrever não pode abortar o export em andamento",
  )
  await waitUntil(task, () => saved.length > 0)
  assert.ok(signals.length > 0)
  task.dispose()
})

test("cancel só aborta por ação explícita e chama /cancel", async () => {
  const task = createFinalExportTask({ persist: memoryStorage() })
  let cancelled = false
  const hang = () =>
    new Promise<Response>(() => {})
  task.start({
    video: new Blob(["clip"]),
    props: defaultRenderProps,
    fileName: "anuncio.mp4",
    fetchImpl: async (input, init) => {
      const url = String(input)
      if (url === "/api/render/cancel") {
        cancelled = true
        return jsonResponse(200, { ok: true, cancelled: true })
      }
      if (url === "/api/render" && init?.method === "POST") {
        return jsonResponse(202, { jobId: "job-9" })
      }
      return hang()
    },
  })
  await waitUntil(task, () => task.getSnapshot().jobId === "job-9")
  task.cancel()
  assert.equal(task.getSnapshot().running, false)
  assert.match(task.getSnapshot().error ?? "", /cancelado/i)
  assert.equal(task.getSnapshot().canRetry, true)
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.equal(cancelled, true)
  task.dispose()
})

test("poll retoma depois de request pendurada no túnel", async () => {
  const task = createFinalExportTask({ persist: memoryStorage() })
  const saved: string[] = []
  task.setSaveHandler(async (result) => {
    saved.push(await result.blob.text())
  })
  let statusCalls = 0
  task.start({
    video: new Blob(["clip"]),
    props: defaultRenderProps,
    fileName: "anuncio.mp4",
    pollDelayMs: 0,
    requestTimeoutMs: 300,
    fetchImpl: async (input, init) => {
      const url = String(input)
      if (url === "/api/render" && init?.method === "POST") {
        return jsonResponse(202, { jobId: "job-9" })
      }
      if (url === "/api/render") {
        return jsonResponse(200, { ok: true, busy: true, jobId: "job-9" })
      }
      if (url.startsWith("/api/render/status/")) {
        statusCalls += 1
        if (statusCalls === 1) return new Promise<Response>(() => {})
        return jsonResponse(200, { progress: 1, stage: "done" })
      }
      if (url === "/api/render/download/job-9") {
        return new Response("ok", { status: 200, headers: { "content-type": "video/mp4" } })
      }
      return jsonResponse(404, { error: "não encontrado" })
    },
  })
  await waitUntil(task, () => saved.length > 0)
  assert.ok(statusCalls >= 2)
  task.dispose()
})

test("recoverLast baixa o job gravado se já estiver done", async () => {
  const storage = memoryStorage()
  storage.setItem(
    LAST_EXPORT_JOB_KEY,
    JSON.stringify({ jobId: "job-9", fileName: "anuncio.mp4", savedAt: 1 }),
  )
  const saved: string[] = []
  const task = createFinalExportTask({
    persist: storage,
    fetchImpl: async (input) => {
      const url = String(input)
      if (url.startsWith("/api/render/status/job-9")) {
        return jsonResponse(200, { progress: 1, stage: "done" })
      }
      if (url === "/api/render/download/job-9") {
        return new Response("ok", { status: 200, headers: { "content-type": "video/mp4" } })
      }
      if (url === "/api/render") {
        return jsonResponse(200, { ok: true, busy: false, jobId: null })
      }
      return jsonResponse(404, { error: "não encontrado" })
    },
  })
  task.setSaveHandler(async (result) => {
    saved.push(result.fileName)
  })
  task.recoverLast()
  await waitUntil(task, () => saved.includes("anuncio.mp4"))
  task.dispose()
})

test("retry relança o mesmo vídeo depois de um erro", async () => {
  const task = createFinalExportTask({ persist: memoryStorage() })
  const saved: string[] = []
  task.setSaveHandler(async (result) => {
    saved.push(await result.blob.text())
  })
  let posts = 0
  const fetchImpl = async (input: string, init?: RequestInit) => {
    const url = String(input)
    if (url === "/api/render" && init?.method === "POST") {
      posts += 1
      if (posts === 1) return jsonResponse(500, { error: "falhou na primeira" })
      return jsonResponse(202, { jobId: "job-9" })
    }
    if (url.startsWith("/api/render/status/")) {
      return jsonResponse(200, { progress: 1, stage: "done" })
    }
    if (url === "/api/render/download/job-9") {
      return new Response("ok", { status: 200, headers: { "content-type": "video/mp4" } })
    }
    return jsonResponse(200, { ok: true, busy: false, jobId: null })
  }
  task.start({
    video: new Blob(["clip"]),
    props: defaultRenderProps,
    fileName: "anuncio.mp4",
    pollDelayMs: 0,
    fetchImpl,
  })
  await waitUntil(task, () => Boolean(task.getSnapshot().error))
  assert.equal(task.getSnapshot().canRetry, true)
  task.retry()
  await waitUntil(task, () => saved.length > 0)
  assert.equal(posts, 2)
  task.dispose()
})

test("poll concluído grava o MP4 uma única vez", async () => {
  const task = createFinalExportTask({ persist: memoryStorage() })
  const saved: string[] = []
  task.setSaveHandler(async (result) => {
    saved.push(await result.blob.text())
  })
  let downloads = 0
  task.start({
    video: new Blob(["clip"]),
    props: defaultRenderProps,
    fileName: "anuncio.mp4",
    pollDelayMs: 0,
    requestTimeoutMs: 80,
    fetchImpl: async (input, init) => {
      const url = String(input)
      if (url === "/api/render" && init?.method === "POST") {
        return jsonResponse(202, { jobId: "job-9" })
      }
      if (url === "/api/render") {
        return jsonResponse(200, { ok: true, busy: false, jobId: null })
      }
      if (url.startsWith("/api/render/status/")) {
        return jsonResponse(200, { progress: 1, stage: "done" })
      }
      if (url === "/api/render/download/job-9") {
        downloads += 1
        return new Response("ok", { status: 200, headers: { "content-type": "video/mp4" } })
      }
      return jsonResponse(404, { error: "não encontrado" })
    },
  })
  await waitUntil(task, () => saved.length > 0)
  await new Promise((resolve) => setTimeout(resolve, 80))
  assert.equal(saved.length, 1)
  assert.equal(downloads, 1)
  task.dispose()
})

test("recoverLast retoma depois de corpo pendurado", { timeout: 4000 }, async () => {
  const storage = memoryStorage()
  storage.setItem(
    LAST_EXPORT_JOB_KEY,
    JSON.stringify({ jobId: "job-9", fileName: "anuncio.mp4", savedAt: 1 }),
  )
  const saved: string[] = []
  let statusCalls = 0
  const task = createFinalExportTask({
    persist: storage,
    requestTimeoutMs: 70,
    fetchImpl: async (input) => {
      const url = String(input)
      if (url.startsWith("/api/render/status/job-9")) {
        statusCalls += 1
        if (statusCalls === 1) {
          return new Response(new ReadableStream({ start() {} }), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        }
        return jsonResponse(200, { progress: 1, stage: "done" })
      }
      if (url === "/api/render/download/job-9") {
        return new Response("ok", { status: 200, headers: { "content-type": "video/mp4" } })
      }
      if (url === "/api/render") {
        return jsonResponse(200, { ok: true, busy: false, jobId: null })
      }
      return jsonResponse(404, { error: "não encontrado" })
    },
  })
  task.setSaveHandler(async (result) => {
    saved.push(result.fileName)
  })
  task.recoverLast()
  await waitUntil(task, () => saved.includes("anuncio.mp4"))
  assert.ok(statusCalls >= 2)
  assert.equal(task.getSnapshot().running, false)
  task.dispose()
})

test("stream morto no status não vira Export cancelado", async () => {
  const task = createFinalExportTask({ persist: memoryStorage() })
  const saved: Array<{ fileName: string; capcutSaved: boolean }> = []
  task.setSaveHandler(async (result) => {
    saved.push({ fileName: result.fileName, capcutSaved: result.capcutSaved })
  })
  let statusCalls = 0
  task.start({
    video: new Blob(["clip"]),
    props: defaultRenderProps,
    fileName: "anuncio.mp4",
    pollDelayMs: 0,
    requestTimeoutMs: 80,
    fetchImpl: async (input, init) => {
      const url = String(input)
      if (url === "/api/render" && init?.method === "POST") {
        return jsonResponse(202, { jobId: "job-9" })
      }
      if (url === "/api/render") {
        return jsonResponse(200, { ok: true, busy: false, jobId: null })
      }
      if (url.startsWith("/api/render/status/")) {
        statusCalls += 1
        if (statusCalls <= 2) {
          return new Response(
            new ReadableStream({
              start() {},
              cancel() {
                return new Promise(() => {})
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          )
        }
        return jsonResponse(200, { progress: 1, stage: "done", capcutSaved: true })
      }
      if (url === "/api/render/download/job-9") {
        return new Response("ok", { status: 200, headers: { "content-type": "video/mp4" } })
      }
      return jsonResponse(404, { error: "não encontrado" })
    },
  })
  await waitUntil(task, () => saved.length > 0 || Boolean(task.getSnapshot().error))
  assert.equal(task.getSnapshot().error, null)
  assert.equal(saved[0]?.capcutSaved, true)
  assert.equal(saved[0]?.fileName, "anuncio.mp4")
  assert.doesNotMatch(task.getSnapshot().error ?? "", /cancelado/i)
  task.dispose()
})

test("CapCut já salvo não baixa o MP4 de novo", async () => {
  const task = createFinalExportTask({ persist: memoryStorage() })
  let downloads = 0
  const saved: boolean[] = []
  task.setSaveHandler(async (result) => {
    saved.push(result.capcutSaved)
  })
  task.start({
    video: new Blob(["clip"]),
    props: defaultRenderProps,
    fileName: "anuncio.mp4",
    pollDelayMs: 0,
    fetchImpl: async (input, init) => {
      const url = String(input)
      if (url === "/api/render" && init?.method === "POST") {
        return jsonResponse(202, { jobId: "job-9" })
      }
      if (url.startsWith("/api/render/status/")) {
        return jsonResponse(200, {
          progress: 1,
          stage: "done",
          capcutSaved: true,
          capcutFileName: "anuncio.mp4",
        })
      }
      if (url.startsWith("/api/render/download/")) {
        downloads += 1
        return new Response("ok", { status: 200, headers: { "content-type": "video/mp4" } })
      }
      return jsonResponse(200, { ok: true, busy: false, jobId: null })
    },
  })
  await waitUntil(task, () => saved.length > 0)
  assert.equal(downloads, 0)
  assert.equal(saved[0], true)
  task.dispose()
})
