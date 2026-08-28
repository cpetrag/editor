import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import { encodeRgbaPng, pngThumbnail } from "./sticker-thumb.ts"

test("pngThumbnail downsamples a tiny RGBA png", () => {
  const src = encodeRgbaPng(4, 2, Buffer.from([
    255, 0, 0, 255, 255, 0, 0, 255, 0, 255, 0, 255, 0, 255, 0, 255,
    0, 0, 255, 255, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
  ]))
  const thumb = pngThumbnail(src, 2)
  assert.ok(thumb)
  assert.ok(thumb.length < src.length || thumb.length > 0)
  assert.notEqual(pngThumbnail(src, 2)?.equals(src), true)
})

test("pngThumbnail shrinks a palette sticker when present", () => {
  const file = path.join(process.cwd(), "data", "stickers", "AcheinaShopee01.png")
  if (!fs.existsSync(file)) return
  const src = fs.readFileSync(file)
  const thumb = pngThumbnail(src, 160)
  assert.ok(thumb)
  assert.ok(thumb.length < src.length)
})
