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

test("copyExportToCapcut grava a faixa e o mapa de início e volume", async () => {
  const destDir = await mkdtemp(path.join(tmpdir(), "capcut-audio-"))
  try {
    await copyExportToCapcut({
      destDir,
      fileName: "anuncio.mp4",
      bytes: new Uint8Array(Buffer.from("mp4")),
      extraFiles: [{ fileName: "trilha.mp3", bytes: new Uint8Array(Buffer.from("mp3")) }],
      audioPlan: {
        omissions: ["Fade e ducking ficam só no MP4"],
        tracks: [
          {
            id: "music",
            fileName: "trilha.mp3",
            kind: "music",
            start: 0,
            trimIn: 1,
            trimOut: 12,
            volume: 0.35,
            loop: true,
          },
        ],
      },
    })
    const note = JSON.parse(await readFile(path.join(destDir, "anuncio__audio.json"), "utf8")) as {
      omissions: string[]
      tracks: { file: string; start: number; volume: number }[]
    }
    assert.deepEqual(note.omissions, ["Fade e ducking ficam só no MP4"])
    assert.equal(note.tracks[0]?.file, "anuncio__trilha.mp3")
    assert.equal(note.tracks[0]?.start, 0)
    assert.equal(note.tracks[0]?.volume, 0.35)
    assert.equal(await readFile(path.join(destDir, "anuncio__trilha.mp3"), "utf8"), "mp3")
  } finally {
    await rm(destDir, { recursive: true, force: true })
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
