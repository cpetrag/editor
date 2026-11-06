import assert from "node:assert/strict"
import { test } from "node:test"

import {
  capcutFromDownloadHeaders,
  saveBlobToCapcut,
  applyCapcutCopy,
  shouldCopyBrowserExportToCapcut,
} from "./capcut-client.ts"

test("rascunho do navegador nunca vai para a pasta CapCut", () => {
  assert.equal(
    shouldCopyBrowserExportToCapcut({ wanted: true, source: "draft" }),
    false,
  )
  assert.equal(
    shouldCopyBrowserExportToCapcut({ wanted: true, source: "final" }),
    false,
  )
  assert.equal(
    shouldCopyBrowserExportToCapcut({ wanted: false, source: "draft" }),
    false,
  )
})

test("saveBlobToCapcut recusa WebM sem chamar a API", async () => {
  let called = false
  const result = await saveBlobToCapcut(
    new Blob(["webm"], { type: "video/webm" }),
    "rascunho.webm",
    async () => {
      called = true
      return new Response("não")
    },
  )
  assert.equal(called, false)
  assert.equal(result.saved, false)
  assert.match(result.error ?? "", /mp4/i)
})

test("saveBlobToCapcut envia o MP4 e lê o nome gravado", async () => {
  const result = await saveBlobToCapcut(
    new Blob(["mp4"], { type: "video/mp4" }),
    "anuncio.mp4",
    async (input, init) => {
      assert.equal(String(input), "/api/export/capcut")
      assert.equal(init?.method, "POST")
      assert.ok(init?.body instanceof FormData)
      const form = init.body
      assert.equal(form.get("fileName"), "anuncio.mp4")
      return new Response(JSON.stringify({ saved: true, fileName: "anuncio_export.mp4" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    },
  )
  assert.equal(result.saved, true)
  assert.equal(result.fileName, "anuncio_export.mp4")
})

test("saveBlobToCapcut trata falha da API sem explodir", async () => {
  const result = await saveBlobToCapcut(
    new Blob(["mp4"], { type: "video/mp4" }),
    "anuncio.mp4",
    async () =>
      new Response(JSON.stringify({ error: "pasta CapCut indisponível" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
  )
  assert.equal(result.saved, false)
  assert.match(result.error ?? "", /capcut|indisponível/i)
})

test("capcutFromDownloadHeaders lê os headers do download Final", () => {
  const saved = capcutFromDownloadHeaders(
    new Headers({
      "x-capcut-saved": "1",
      "x-capcut-file": encodeURIComponent("anuncio_export.mp4"),
    }),
  )
  assert.deepEqual(saved, { saved: true, fileName: "anuncio_export.mp4" })
  assert.deepEqual(
    capcutFromDownloadHeaders(new Headers({ "x-capcut-saved": "0" })),
    { saved: false, fileName: null },
  )
  assert.deepEqual(capcutFromDownloadHeaders(new Headers()), {
    saved: false,
    fileName: null,
  })
})

test("applyCapcutCopy no Final não reenvia o MP4 se o Mac já copiou ou se pediu para não subir de novo", async () => {
  assert.equal(
    await applyCapcutCopy({
      wanted: false,
      blob: new Blob(["mp4"], { type: "video/mp4" }),
      fileName: "a.mp4",
      fetchImpl: async () => {
        throw new Error("não deveria chamar")
      },
    }),
    "skipped",
  )
  assert.equal(
    await applyCapcutCopy({
      wanted: true,
      alreadySaved: true,
      blob: new Blob(["mp4"], { type: "video/mp4" }),
      fileName: "a.mp4",
      fetchImpl: async () => {
        throw new Error("não deveria chamar")
      },
    }),
    "saved",
  )
  let called = false
  assert.equal(
    await applyCapcutCopy({
      wanted: true,
      skipClientUpload: true,
      blob: new Blob(["mp4"], { type: "video/mp4" }),
      fileName: "a.mp4",
      fetchImpl: async () => {
        called = true
        return new Response("não")
      },
    }),
    "failed",
  )
  assert.equal(called, false)
})
