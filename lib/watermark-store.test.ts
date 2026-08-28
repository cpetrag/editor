import { test } from "node:test"
import assert from "node:assert/strict"

import { newProjectComposition } from "./project-reset.ts"
import {
  WATERMARK_STORAGE_KEY,
  loadWatermarkPrefs,
  saveWatermarkPrefs,
} from "./watermark-store.ts"
import { type WatermarkPrefs } from "./watermark.ts"

const VISUAL = { opacityPct: 22, fontPx: 42, speed: 1 }

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null
    },
    setItem(key: string, value: string) {
      map.set(key, value)
    },
    removeItem(key: string) {
      map.delete(key)
    },
  }
}

test("save then load round-trips normalized prefs", () => {
  const storage = memoryStorage()
  saveWatermarkPrefs({ text: "  @loja  ", loop: false } as WatermarkPrefs, storage)
  assert.deepEqual(loadWatermarkPrefs(storage), { text: "@loja", loop: false, ...VISUAL })
})

test("junk JSON yields the default prefs", () => {
  const storage = memoryStorage({ [WATERMARK_STORAGE_KEY]: "{not json" })
  assert.deepEqual(loadWatermarkPrefs(storage), { text: "", loop: true, ...VISUAL })
})

test("newProjectComposition does not clear watermark prefs", () => {
  const storage = memoryStorage()
  storage.setItem(WATERMARK_STORAGE_KEY, JSON.stringify({ text: "@loja", loop: true }))
  newProjectComposition()
  assert.deepEqual(loadWatermarkPrefs(storage), { text: "@loja", loop: true, ...VISUAL })
})

test("save then load round-trips opacity font and speed", () => {
  const storage = memoryStorage()
  saveWatermarkPrefs(
    { text: "@a", loop: true, opacityPct: 30, fontPx: 50, speed: 2 },
    storage,
  )
  assert.deepEqual(loadWatermarkPrefs(storage), {
    text: "@a",
    loop: true,
    opacityPct: 30,
    fontPx: 50,
    speed: 2,
  })
})
