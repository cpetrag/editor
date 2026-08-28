import assert from "node:assert/strict"
import { test } from "node:test"

import { importFileName } from "./filename.ts"

test("usa o título sanitizado com extensão mp4", () => {
  assert.equal(importFileName("Legenda Top", "youtube"), "Legenda Top.mp4")
})

test("remove caracteres ilegais e corta em 80", () => {
  const name = importFileName('a<>:"/\\|?*\u0001'.repeat(20), "tiktok")
  assert.ok(name.endsWith(".mp4"))
  assert.ok(!/[<>:"/\\|?*]/.test(name.slice(0, -4)))
  assert.ok(name.length <= 84)
})

test("cai no platform se o título estiver vazio", () => {
  assert.equal(importFileName("   ", "shopee-video"), "shopee-video.mp4")
})
