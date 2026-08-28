import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"

import { copyExportToCapcut } from "./capcut-copy.ts"

test("copyExportToCapcut copia o MP4 e cria a pasta se faltar", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "capcut-copy-"))
  const destDir = path.join(root, "CapCut")
  const sourcePath = path.join(root, "job.mp4")
  try {
    await writeFile(sourcePath, "fake-mp4")
    const copied = await copyExportToCapcut({
      destDir,
      fileName: "anuncio.mp4",
      sourcePath,
    })
    assert.equal(copied.fileName, "anuncio.mp4")
    assert.equal(await readFile(copied.destPath, "utf8"), "fake-mp4")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("copyExportToCapcut grava bytes e não sobrescreve arquivo existente", async () => {
  const destDir = await mkdtemp(path.join(tmpdir(), "capcut-bytes-"))
  try {
    await writeFile(path.join(destDir, "anuncio.mp4"), "antigo")
    const copied = await copyExportToCapcut({
      destDir,
      fileName: "anuncio.mp4",
      bytes: new Uint8Array(Buffer.from("novo")),
    })
    assert.equal(copied.fileName, "anuncio-2.mp4")
    assert.equal(await readFile(copied.destPath, "utf8"), "novo")
    assert.equal(
      await readFile(path.join(destDir, "anuncio.mp4"), "utf8"),
      "antigo",
    )
  } finally {
    await rm(destDir, { recursive: true, force: true })
  }
})
