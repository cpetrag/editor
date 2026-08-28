import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { test } from "node:test"

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "import-dl-"))
process.env.IMPORT_DOWNLOAD_DIR = tmp

const paths = await import("./paths.ts")
const store = await import("./store.ts")

test.after(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

test("downloadDir usa IMPORT_DOWNLOAD_DIR", () => {
  assert.equal(paths.downloadDir(), path.resolve(tmp))
})

test("não exporta cleanupExpired ou similar", () => {
  assert.equal(typeof (store as { cleanupExpired?: unknown }).cleanupExpired, "undefined")
  assert.equal(typeof (store as { purgeImports?: unknown }).purgeImports, "undefined")
  assert.equal(typeof (paths as { cleanupExpired?: unknown }).cleanupExpired, "undefined")
})

test("createJob / updateJob / getJob roundtrip", () => {
  store.ensureImportDirs()
  const job = store.createJob({
    status: "queued",
    sourceUrl: "https://youtu.be/abc",
    platform: "youtube",
    title: "Test video",
  })
  assert.match(job.id, /^[a-f0-9]{24}$/i)
  assert.equal(job.status, "queued")
  assert.equal(job.error, null)
  assert.equal(job.sourceUrl, "https://youtu.be/abc")
  assert.equal(job.platform, "youtube")
  assert.equal(job.title, "Test video")
  assert.ok(typeof job.createdAt === "number")
  assert.ok(typeof job.updatedAt === "number")

  const updated = store.updateJob(job.id, { status: "done" })
  assert.ok(updated)
  assert.equal(updated.status, "done")
  assert.ok(updated.updatedAt >= job.updatedAt)

  const fetched = store.getJob(job.id)
  assert.deepEqual(fetched, updated)
})

test("mp4Path recusa id inválido e aceita hex 24", () => {
  assert.equal(store.mp4Path("../etc/passwd"), null)
  assert.equal(store.mp4Path("not-hex"), null)
  const id = "aabbccddeeff001122334455"
  const mp4 = store.mp4Path(id)
  assert.ok(mp4)
  assert.ok(mp4.endsWith(`${id}.mp4`))
})

test("writeMeta + getMeta roundtrip", () => {
  const id = "00112233445566778899aabb"
  store.ensureImportDirs()
  store.writeMeta(id, {
    title: "t",
    platform: "youtube",
    sourceUrl: "https://youtu.be/x",
    createdAt: Date.now(),
    bytes: 12,
  })
  const meta = store.getMeta(id)
  assert.ok(meta)
  assert.equal(meta.title, "t")
  assert.equal(meta.platform, "youtube")
})
