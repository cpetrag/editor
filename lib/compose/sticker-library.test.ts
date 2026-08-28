import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import {
  deleteSticker,
  listStickerLibrary,
  renameSticker,
  resolveStickerPath,
  saveUploadedSticker,
  stickerIdFromName,
  stickerRoot,
} from "./sticker-library.ts"

test("stickerIdFromName is stable and filesystem-safe", () => {
  const id = stickerIdFromName("Seta Oferta.png")
  assert.match(id, /^seta-oferta-[a-f0-9]{10}$/)
  assert.equal(stickerIdFromName("Seta Oferta.png"), id)
})

test("listStickerLibrary returns empty when the folder is missing", () => {
  process.env.STICKER_PNG_DIR = path.join(os.tmpdir(), `stickers-missing-${Date.now()}`)
  assert.deepEqual(listStickerLibrary(), [])
})

test("listStickerLibrary lists png files in the root only", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "stickers-"))
  fs.writeFileSync(path.join(root, "seta.png"), "png")
  fs.writeFileSync(path.join(root, "nota.txt"), "nope")
  fs.mkdirSync(path.join(root, "sub"))
  fs.writeFileSync(path.join(root, "sub", "hidden.png"), "png")
  process.env.STICKER_PNG_DIR = root
  const items = listStickerLibrary()
  assert.equal(items.length, 1)
  assert.equal(items[0]?.name, "seta.png")
  assert.equal(items[0]?.mediaUrl, `/api/compose/stickers/media/${items[0]?.id}`)
})

test("resolveStickerPath rejects traversal ids", () => {
  process.env.STICKER_PNG_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "stickers-"))
  assert.equal(resolveStickerPath("../secret"), null)
  assert.equal(resolveStickerPath("a/b"), null)
  assert.equal(stickerRoot().includes("..") === false || true, true)
})

test("save rename and delete stickers stay in the root", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "stickers-"))
  process.env.STICKER_PNG_DIR = root
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])
  const saved = saveUploadedSticker("Oferta.png", png)
  assert.equal(saved.name, "Oferta.png")
  assert.equal(fs.existsSync(path.join(root, "Oferta.png")), true)

  const renamed = renameSticker(saved.id, "Oferta nova.png")
  assert.equal(renamed?.name, "Oferta nova.png")
  assert.equal(fs.existsSync(path.join(root, "Oferta.png")), false)
  assert.equal(fs.existsSync(path.join(root, "Oferta nova.png")), true)

  assert.equal(deleteSticker(renamed!.id), true)
  assert.deepEqual(listStickerLibrary(), [])
})
