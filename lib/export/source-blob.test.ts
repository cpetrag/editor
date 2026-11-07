import assert from "node:assert/strict"
import { test } from "node:test"

import { resolveExportVideoBlob } from "./source-blob.ts"

test("resolveExportVideoBlob prefere o blob em memória e não busca a URL", async () => {
  const memory = new Blob(["mem"], { type: "video/mp4" })
  let fetched = false
  const blob = await resolveExportVideoBlob({
    memoryBlob: memory,
    storedBlob: new Blob(["idb"]),
    objectUrl: "blob:http://localhost/revoked",
    fetchImpl: async () => {
      fetched = true
      return new Response("nope")
    },
  })
  assert.equal(fetched, false)
  assert.equal(await blob.text(), "mem")
})

test("resolveExportVideoBlob usa o blob do IndexedDB se não houver memória", async () => {
  const stored = new Blob(["idb"], { type: "video/mp4" })
  const blob = await resolveExportVideoBlob({
    memoryBlob: null,
    storedBlob: stored,
    objectUrl: "",
    fetchImpl: async () => {
      throw new Error("não deveria buscar")
    },
  })
  assert.equal(await blob.text(), "idb")
})

test("resolveExportVideoBlob ignora blob vazio e cai no próximo", async () => {
  const blob = await resolveExportVideoBlob({
    memoryBlob: new Blob([]),
    storedBlob: new Blob(["ok"]),
    objectUrl: "",
  })
  assert.equal(await blob.text(), "ok")
})

test("resolveExportVideoBlob busca a object URL só como último recurso", async () => {
  const blob = await resolveExportVideoBlob({
    memoryBlob: null,
    storedBlob: null,
    objectUrl: "blob:http://localhost/ok",
    fetchImpl: async (input) => {
      assert.equal(String(input), "blob:http://localhost/ok")
      return new Response("from-url", { headers: { "content-type": "video/mp4" } })
    },
  })
  assert.equal(await blob.text(), "from-url")
})

test("resolveExportVideoBlob carrega do IndexedDB pelo fileId quando não há blob local", async () => {
  const fromDb = new Blob(["db"], { type: "video/mp4" })
  const blob = await resolveExportVideoBlob({
    memoryBlob: null,
    storedBlob: null,
    fileId: "file-1",
    loadByFileId: async (fileId) => {
      assert.equal(fileId, "file-1")
      return fromDb
    },
  })
  assert.equal(await blob.text(), "db")
})

test("resolveExportVideoBlob falha se não houver memória, armazenado nem IndexedDB", async () => {
  await assert.rejects(
    () =>
      resolveExportVideoBlob({
        memoryBlob: null,
        storedBlob: null,
        fileId: "missing",
        loadByFileId: async () => null,
      }),
    /Vídeo de origem não encontrado/i,
  )
})

test("resolveExportVideoBlob falha com mensagem clara se o blob: estiver morto", async () => {
  await assert.rejects(
    () =>
      resolveExportVideoBlob({
        memoryBlob: null,
        storedBlob: null,
        objectUrl: "blob:http://localhost/dead",
        fetchImpl: async () => {
          throw new TypeError("Failed to fetch")
        },
      }),
    /reabra o arquivo/i,
  )
})
