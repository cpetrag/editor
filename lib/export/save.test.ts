import assert from "node:assert/strict"
import { test } from "node:test"

import { saveExportBlob } from "./save.ts"

test("saveExportBlob usa o local escolhido quando o picker devolve um arquivo", async () => {
  const written: Blob[] = []
  const result = await saveExportBlob(new Blob(["mp4"]), "anuncio_export.mp4", {
    pick: async () => ({
      write: async (data) => {
        written.push(data)
      },
    }),
    download: () => {
      throw new Error("não deveria baixar")
    },
  })
  assert.equal(result, "picked")
  assert.equal(written.length, 1)
  assert.equal(await written[0]?.text(), "mp4")
})

test("saveExportBlob trata cancelar o diálogo sem baixar", async () => {
  let downloaded = false
  const result = await saveExportBlob(new Blob(["mp4"]), "anuncio_export.mp4", {
    pick: async () => null,
    download: () => {
      downloaded = true
    },
  })
  assert.equal(result, "cancelled")
  assert.equal(downloaded, false)
})

test("saveExportBlob trata AbortError do picker como cancelar", async () => {
  let downloaded = false
  const result = await saveExportBlob(new Blob(["mp4"]), "anuncio_export.mp4", {
    pick: async () => {
      throw new DOMException("The user aborted a request.", "AbortError")
    },
    download: () => {
      downloaded = true
    },
  })
  assert.equal(result, "cancelled")
  assert.equal(downloaded, false)
})

test("saveExportBlob cai para download automático se não houver picker", async () => {
  let downloaded = ""
  const result = await saveExportBlob(new Blob(["mp4"]), "anuncio_export.mp4", {
    pick: undefined,
    download: (_blob, fileName) => {
      downloaded = fileName
    },
  })
  assert.equal(result, "download")
  assert.equal(downloaded, "anuncio_export.mp4")
})

test("saveExportBlob não abre o picker sem gesto do usuário", async () => {
  let downloaded = ""
  let picked = false
  const result = await saveExportBlob(new Blob(["mp4"]), "anuncio_export.mp4", {
    userActivation: { isActive: false },
    pick: async () => {
      picked = true
      throw new Error("picker não deveria abrir")
    },
    download: (_blob, fileName) => {
      downloaded = fileName
    },
  })
  assert.equal(picked, false)
  assert.equal(result, "download")
  assert.equal(downloaded, "anuncio_export.mp4")
})
