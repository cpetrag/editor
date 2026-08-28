import assert from "node:assert/strict"
import { test } from "node:test"

import type { StorageLike } from "../project-store.ts"
import {
  LAST_EXPORT_JOB_KEY,
  clearLastExportJob,
  loadLastExportJob,
  parseLastExportJob,
  saveLastExportJob,
} from "./last-job.ts"

function memoryStorage(initial: Record<string, string> = {}): StorageLike {
  const data = new Map(Object.entries(initial))
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

test("parseLastExportJob aceita jobId e nome e recusa lixo", () => {
  assert.deepEqual(
    parseLastExportJob({
      jobId: " job-9 ",
      fileName: " anuncio.mp4 ",
      savedAt: 10,
    }),
    { jobId: "job-9", fileName: "anuncio.mp4", savedAt: 10 },
  )
  assert.equal(parseLastExportJob(null), null)
  assert.equal(parseLastExportJob({ jobId: "", fileName: "a.mp4" }), null)
  assert.equal(parseLastExportJob({ jobId: "job-9", fileName: "  " }), null)
})

test("saveLastExportJob grava no sessionStorage e loadLastExportJob lê de volta", () => {
  const storage = memoryStorage()
  const saved = saveLastExportJob(
    { jobId: "job-9", fileName: "anuncio.mp4" },
    storage,
    99,
  )
  assert.deepEqual(saved, { jobId: "job-9", fileName: "anuncio.mp4", savedAt: 99 })
  assert.ok(storage.getItem(LAST_EXPORT_JOB_KEY))
  assert.deepEqual(loadLastExportJob(storage), saved)
})

test("clearLastExportJob apaga a chave", () => {
  const storage = memoryStorage()
  saveLastExportJob({ jobId: "job-9", fileName: "anuncio.mp4" }, storage, 1)
  clearLastExportJob(storage)
  assert.equal(loadLastExportJob(storage), null)
})

test("loadLastExportJob ignora JSON quebrado", () => {
  const storage = memoryStorage({ [LAST_EXPORT_JOB_KEY]: "{não-json" })
  assert.equal(loadLastExportJob(storage), null)
})
