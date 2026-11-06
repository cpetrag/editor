import { test } from "node:test"
import assert from "node:assert/strict"

import {
  PANEL_UI_STORAGE_KEY,
  defaultPanelUi,
  loadPanelUi,
  parsePanelUi,
  savePanelBlocks,
  savePanelTab,
  togglePanelBlock,
} from "./panel-sections.ts"
import type { StorageLike } from "./project-store.ts"

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  }
}

test("parsePanelUi keeps a known tab and known block ids", () => {
  assert.deepEqual(
    parsePanelUi('{"tab":"captions","blocks":{"captions-style":["type","nope"],"extra":["x"]},"junk":1}'),
    { tab: "captions", blocks: { "captions-style": ["type", "nope"] } },
  )
  assert.deepEqual(parsePanelUi("{nope"), defaultPanelUi())
  assert.deepEqual(parsePanelUi(null), defaultPanelUi())
  assert.equal(parsePanelUi('{"tab":"biblioteca"}').tab, "video")
})

test("tab and blocks round-trip without dropping the other field", () => {
  const storage = memoryStorage()
  savePanelTab("inserts", storage)
  savePanelBlocks("video", ["watermark"], storage)
  savePanelBlocks("captions-style", ["fill"], storage)
  assert.ok(storage.data.has(PANEL_UI_STORAGE_KEY))
  assert.deepEqual(loadPanelUi(storage), {
    tab: "inserts",
    blocks: { video: ["watermark"], "captions-style": ["fill"] },
  })
})

test("togglePanelBlock is an accordion until more than one block is open", () => {
  assert.deepEqual(togglePanelBlock([], "type"), ["type"])
  assert.deepEqual(togglePanelBlock(["type"], "layout"), ["layout"])
  assert.deepEqual(togglePanelBlock(["type"], "type"), [])
  assert.deepEqual(togglePanelBlock(["type", "layout"], "fill"), ["type", "layout", "fill"])
  assert.deepEqual(togglePanelBlock(["type", "layout"], "type"), ["layout"])
})

test("storage failures fall back instead of throwing", () => {
  const broken: StorageLike = {
    getItem: () => {
      throw new Error("blocked")
    },
    setItem: () => {
      throw new Error("quota")
    },
    removeItem: () => {},
  }
  const originalWarn = console.warn
  console.warn = () => {}
  try {
    assert.deepEqual(loadPanelUi(broken), defaultPanelUi())
    assert.doesNotThrow(() => savePanelTab("video", broken))
    assert.doesNotThrow(() => savePanelBlocks("video", ["framing"], broken))
  } finally {
    console.warn = originalWarn
  }
})
