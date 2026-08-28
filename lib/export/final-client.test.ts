import assert from "node:assert/strict"
import { test } from "node:test"

import { defaultRenderProps } from "../../remotion/types.ts"
import { RenderExportError } from "./render-errors.ts"
import {
  cancelFinalRender,
  downloadFinalRender,
  exportViaRenderServer,
  readRenderHealth,
  startFinalRender,
  waitForFinalProgress,
} from "./final-client.ts"

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function hangingJsonResponse(): Response {
  return new Response(new ReadableStream({ start() {} }), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
}

/** Headers ok, corpo nunca chega E cancel() também trava — o bug real do túnel. */
function hangingJsonResponseWithStickyCancel(): Response {
  return new Response(
    new ReadableStream({
      start() {},
      cancel() {
        return new Promise(() => {})
      },
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  )
}

function stallingDownloadResponse(firstChunk: Uint8Array, total = 100): Response {
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(firstChunk)
      },
    }),
    {
      status: 200,
      headers: {
        "content-type": "video/mp4",
        "content-length": String(total),
      },
    },
  )
}

test("startFinalRender manda saveToCapcut e o nome do arquivo", async () => {
  const jobId = await startFinalRender({
    video: new Blob(["clip"]),
    props: defaultRenderProps,
    fileName: "anuncio.mp4",
    saveToCapcut: true,
    fetchImpl: async (_input, init) => {
      assert.ok(init?.body instanceof FormData)
      assert.equal(init.body.get("saveToCapcut"), "1")
      assert.equal(init.body.get("fileName"), "anuncio.mp4")
      return jsonResponse(202, { jobId: "job-capcut" })
    },
  })
  assert.equal(jobId, "job-capcut")
})

test("startFinalRender devolve jobId do 202", async () => {
  const jobId = await startFinalRender({
    video: new Blob(["clip"]),
    props: defaultRenderProps,
    fetchImpl: async (input, init) => {
      assert.equal(String(input), "/api/render")
      assert.equal(init?.method, "POST")
      assert.ok(init?.body instanceof FormData)
      return jsonResponse(202, { jobId: "job-1" })
    },
  })
  assert.equal(jobId, "job-1")
})

test("startFinalRender no 409 com jobId se acopla ao render em andamento", async () => {
  const jobId = await startFinalRender({
    video: new Blob(["clip"]),
    props: defaultRenderProps,
    fetchImpl: async () =>
      jsonResponse(409, { error: "render em andamento", jobId: "job-vivo" }),
  })
  assert.equal(jobId, "job-vivo")
})

test("waitForFinalProgress acompanha o render por consultas simples", async () => {
  const seen: number[] = []
  let replies = 0
  let calls = 0
  const result = await waitForFinalProgress({
    jobId: "job-9",
    onProgress: (ratio) => seen.push(ratio),
    onStatusResponse: () => {
      replies += 1
    },
    pollDelayMs: 0,
    fetchImpl: async (input) => {
      assert.match(String(input), /^\/api\/render\/status\/job-9\?request=\d+/)
      calls += 1
      if (calls === 1) return jsonResponse(200, { progress: 0.4, stage: "rendering" })
      return jsonResponse(200, {
        progress: 1,
        stage: "done",
        capcutSaved: true,
        capcutFileName: "Meu Anúncio.mp4",
      })
    },
  })
  assert.deepEqual(seen, [0.4, 1])
  assert.equal(replies, 2)
  assert.equal(result.capcutSaved, true)
  assert.equal(result.capcutFileName, "Meu Anúncio.mp4")
})

test("waitForFinalProgress insiste quando uma consulta falha na rede", async () => {
  let calls = 0
  await waitForFinalProgress({
    jobId: "job-9",
    onProgress: () => {},
    pollDelayMs: 0,
    fetchImpl: async () => {
      calls += 1
      if (calls === 1) throw new TypeError("Failed to fetch")
      return jsonResponse(200, { progress: 1, stage: "done" })
    },
  })
  assert.ok(calls >= 2)
})

test("waitForFinalProgress cancela consulta pendurada e tenta outra", async () => {
  let statusCalls = 0
  let healthCalls = 0
  await waitForFinalProgress({
    jobId: "job-9",
    onProgress: () => {},
    pollDelayMs: 0,
    requestTimeoutMs: 5,
    fetchImpl: async (input, init) => {
      const url = String(input)
      if (url.startsWith("/api/render/status/")) {
        statusCalls += 1
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("consulta cancelada", "AbortError")),
            { once: true },
          )
        })
      }
      healthCalls += 1
      if (healthCalls === 1) {
        return jsonResponse(200, { ok: true, busy: true, jobId: "job-9" })
      }
      return jsonResponse(200, { ok: true, busy: false, jobId: null })
    },
  })
  assert.ok(statusCalls >= 1)
  assert.ok(healthCalls >= 2)
})

test("waitForFinalProgress conclui pelo health se o /status nunca responder", async () => {
  let healthCalls = 0
  const started = Date.now()
  await waitForFinalProgress({
    jobId: "job-9",
    onProgress: () => {},
    pollDelayMs: 0,
    requestTimeoutMs: 20,
    fetchImpl: async (input) => {
      const url = String(input)
      if (url.startsWith("/api/render/status/")) {
        return new Promise<Response>(() => {})
      }
      assert.equal(url, "/api/render")
      healthCalls += 1
      if (healthCalls === 1) {
        return jsonResponse(200, { ok: true, busy: true, jobId: "job-9" })
      }
      return jsonResponse(200, { ok: true, busy: false, jobId: null })
    },
  })
  assert.ok(healthCalls >= 2)
  assert.ok(Date.now() - started < 2000)
})

test("waitForFinalProgress no fallback consulta o status mesmo sem ter visto busy", async () => {
  let statusCalls = 0
  const result = await waitForFinalProgress({
    jobId: "job-9",
    onProgress: () => {},
    pollDelayMs: 0,
    requestTimeoutMs: 5,
    fetchImpl: async (input, init) => {
      const url = String(input)
      if (url.startsWith("/api/render/status/")) {
        statusCalls += 1
        if (statusCalls === 1) {
          return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => reject(new DOMException("consulta cancelada", "AbortError")),
              { once: true },
            )
          })
        }
        return jsonResponse(200, {
          progress: 1,
          stage: "done",
          capcutSaved: true,
          capcutFileName: "pronto.mp4",
        })
      }
      return jsonResponse(200, { ok: true, busy: false, jobId: null })
    },
  })
  assert.equal(result.capcutSaved, true)
  assert.equal(result.capcutFileName, "pronto.mp4")
  assert.ok(statusCalls >= 2)
})

test("waitForFinalProgress no fallback falha claro se o job sumiu", async () => {
  await assert.rejects(
    () =>
      waitForFinalProgress({
        jobId: "job-9",
        onProgress: () => {},
        pollDelayMs: 0,
        requestTimeoutMs: 5,
        fetchImpl: async (input, init) => {
          const url = String(input)
          if (url.startsWith("/api/render/status/")) {
            if (!url.includes("request=1")) {
              return jsonResponse(404, { error: "job não encontrado" })
            }
            return new Promise<Response>((_resolve, reject) => {
              init?.signal?.addEventListener(
                "abort",
                () => reject(new DOMException("consulta cancelada", "AbortError")),
                { once: true },
              )
            })
          }
          return jsonResponse(200, { ok: true, busy: false, jobId: null })
        },
      }),
    (error: unknown) => {
      assert.ok(error instanceof RenderExportError)
      assert.match(error.message, /não encontrado|não existe/i)
      return true
    },
  )
})

test("waitForFinalProgress sai do fallback depois do primeiro health e volta ao status", async () => {
  const urls: string[] = []
  await waitForFinalProgress({
    jobId: "job-9",
    onProgress: () => {},
    pollDelayMs: 0,
    requestTimeoutMs: 5,
    fetchImpl: async (input, init) => {
      const url = String(input)
      urls.push(url.split("?")[0] ?? url)
      if (url.startsWith("/api/render/status/")) {
        if (urls.filter((entry) => entry.endsWith("/status/job-9")).length === 1) {
          return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => reject(new DOMException("consulta cancelada", "AbortError")),
              { once: true },
            )
          })
        }
        return jsonResponse(200, { progress: 1, stage: "done" })
      }
      return jsonResponse(200, { ok: true, busy: true, jobId: "job-9" })
    },
  })
  const healthIndex = urls.findIndex((url) => url === "/api/render")
  assert.ok(healthIndex >= 0)
  assert.equal(urls[healthIndex + 1], "/api/render/status/job-9")
})

test("waitForFinalProgress nunca deixa a barra andar para trás", async () => {
  const seen: number[] = []
  let calls = 0
  await waitForFinalProgress({
    jobId: "job-9",
    onProgress: (ratio) => seen.push(ratio),
    pollDelayMs: 0,
    fetchImpl: async () => {
      calls += 1
      if (calls === 1) return jsonResponse(200, { progress: 0.5, stage: "rendering" })
      if (calls === 2) return jsonResponse(200, { progress: 0.2, stage: "rendering" })
      return jsonResponse(200, { progress: 1, stage: "done" })
    },
  })
  assert.deepEqual(seen, [0.5, 0.5, 1])
})

test("waitForFinalProgress avisa a falha do render sem cair para rascunho", async () => {
  await assert.rejects(
    () =>
      waitForFinalProgress({
        jobId: "job-9",
        onProgress: () => {},
        pollDelayMs: 0,
        fetchImpl: async () =>
          jsonResponse(200, { progress: 0.3, stage: "error", error: "falha no Remotion" }),
      }),
    (error: unknown) => {
      assert.ok(error instanceof RenderExportError)
      assert.equal(error.fallbackToDraft, false)
      assert.match(error.message, /falha no remotion/i)
      return true
    },
  )
})

test("waitForFinalProgress expira se os headers chegam e o corpo nunca fecha", { timeout: 2500 }, async () => {
  let calls = 0
  const started = Date.now()
  await waitForFinalProgress({
    jobId: "job-9",
    onProgress: () => {},
    pollDelayMs: 0,
    requestTimeoutMs: 40,
    fetchImpl: async (input) => {
      const url = String(input)
      if (url.startsWith("/api/render/status/")) {
        calls += 1
        if (calls === 1) return hangingJsonResponse()
        return jsonResponse(200, { progress: 1, stage: "done" })
      }
      return jsonResponse(200, { ok: true, busy: true, jobId: "job-9" })
    },
  })
  assert.ok(calls >= 2)
  assert.ok(Date.now() - started < 1500)
})

test("waitForFinalProgress não trava se body.cancel() também pendura", { timeout: 2500 }, async () => {
  let calls = 0
  const started = Date.now()
  await waitForFinalProgress({
    jobId: "job-9",
    onProgress: () => {},
    pollDelayMs: 0,
    requestTimeoutMs: 40,
    fetchImpl: async (input) => {
      const url = String(input)
      if (url.startsWith("/api/render/status/")) {
        calls += 1
        if (calls === 1) return hangingJsonResponseWithStickyCancel()
        return jsonResponse(200, { progress: 1, stage: "done" })
      }
      return jsonResponse(200, { ok: true, busy: false, jobId: null })
    },
  })
  assert.ok(calls >= 2)
  assert.ok(Date.now() - started < 1500)
})

test("downloadFinalRender aborta stall no meio do corpo e tenta de novo", { timeout: 2500 }, async () => {
  let attempts = 0
  const downloaded = await downloadFinalRender("job-9", {
    headerTimeoutMs: 80,
    stallTimeoutMs: 40,
    maxAttempts: 3,
    fetchImpl: async () => {
      attempts += 1
      if (attempts === 1) return stallingDownloadResponse(new Uint8Array([1, 2]))
      return new Response(new Uint8Array([1, 2, 3, 4]), {
        status: 200,
        headers: { "content-type": "video/mp4", "content-length": "4" },
      })
    },
  })
  assert.equal(attempts, 2)
  assert.equal(downloaded.blob.size, 4)
})

test("startFinalRender vira RenderExportError no 409", async () => {
  await assert.rejects(
    () =>
      startFinalRender({
        video: new Blob(["clip"]),
        props: defaultRenderProps,
        fetchImpl: async () => jsonResponse(409, { error: "render em andamento" }),
      }),
    (error: unknown) => {
      assert.ok(error instanceof RenderExportError)
      assert.equal(error.status, 409)
      assert.equal(error.fallbackToDraft, false)
      assert.match(error.message, /já tem um render/i)
      return true
    },
  )
})

test("exportViaRenderServer acompanha o progresso e baixa o MP4", async () => {
  const seen: number[] = []
  const phases: string[] = []
  let polls = 0

  const result = await exportViaRenderServer({
    video: new Blob(["clip"]),
    props: defaultRenderProps,
    fileName: "anuncio.mp4",
    pollDelayMs: 0,
    onProgress: (ratio) => seen.push(ratio),
    onPhase: (phase) => phases.push(phase),
    fetchImpl: async (input) => {
      const url = String(input)
      if (url === "/api/render") return jsonResponse(202, { jobId: "job-9" })
      if (url.startsWith("/api/render/status/job-9")) {
        polls += 1
        return polls === 1
          ? jsonResponse(200, { progress: 0.4, stage: "rendering" })
          : jsonResponse(200, { progress: 1, stage: "done" })
      }
      if (url.startsWith("/api/render/download/job-9")) {
        return new Response("fake-mp4", {
          status: 200,
          headers: { "content-type": "video/mp4", "content-length": "8" },
        })
      }
      return jsonResponse(404, { error: "não encontrado" })
    },
  })

  assert.ok(seen.some((ratio) => ratio > 0.08 && ratio < 0.85))
  assert.ok(seen.every((ratio) => ratio <= 0.97))
  assert.equal(seen.at(-1), 0.97)
  assert.deepEqual(phases, ["uploading", "rendering", "downloading"])
  assert.equal(result.fileName, "anuncio.mp4")
  assert.equal(await result.blob.text(), "fake-mp4")
  assert.equal(result.capcutSaved, false)
})

test("downloadFinalRender reporta progresso e lê o header CapCut", async () => {
  const seen: number[] = []
  const downloaded = await downloadFinalRender("job-9", {
    onProgress: (ratio) => seen.push(ratio),
    fetchImpl: async () =>
      new Response(new Uint8Array([1, 2, 3, 4]), {
        status: 200,
        headers: {
          "content-type": "video/mp4",
          "content-length": "4",
          "x-capcut-saved": "1",
          "x-capcut-file": "anuncio_export.mp4",
        },
      }),
  })
  assert.ok(seen.length > 0)
  assert.equal(seen.at(-1), 1)
  assert.equal(downloaded.blob.size, 4)
  assert.equal(downloaded.capcutSaved, true)
  assert.equal(downloaded.capcutFileName, "anuncio_export.mp4")
})

test("readRenderHealth lê busy e jobId do GET /api/render", async () => {
  const health = await readRenderHealth(async (input, init) => {
    assert.equal(String(input), "/api/render")
    assert.equal(init?.cache, "no-store")
    return jsonResponse(200, { ok: true, busy: true, jobId: "job-vivo" })
  })
  assert.equal(health.ok, true)
  assert.equal(health.busy, true)
  assert.equal(health.jobId, "job-vivo")
})

test("cancelFinalRender posta /api/render/cancel", async () => {
  const cancelled = await cancelFinalRender(async (input, init) => {
    assert.equal(String(input), "/api/render/cancel")
    assert.equal(init?.method, "POST")
    return jsonResponse(200, { ok: true, cancelled: true, jobId: "job-vivo" })
  })
  assert.equal(cancelled, true)
})

test("downloadFinalRender falha com mensagem específica se o arquivo não veio", async () => {
  await assert.rejects(
    () =>
      downloadFinalRender("job-9", {
        fetchImpl: async () => jsonResponse(409, { error: "ainda renderizando" }),
      }),
    /ainda renderizando/i,
  )
})
