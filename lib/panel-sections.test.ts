import { test } from "node:test"
import assert from "node:assert/strict"

import {
  DEFAULT_COLLAPSED_SECTIONS,
  PANEL_SECTIONS_STORAGE_KEY,
  loadCollapsedSections,
  parseCollapsedSections,
  saveCollapsedSections,
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

test("parseCollapsedSections keeps known booleans and drops the rest", () => {
  assert.deepEqual(parseCollapsedSections('{"video":true,"inserts":"sim","extra":true}'), {
    ...DEFAULT_COLLAPSED_SECTIONS,
    video: true,
  })
  assert.deepEqual(parseCollapsedSections("{nope"), DEFAULT_COLLAPSED_SECTIONS)
  assert.deepEqual(parseCollapsedSections(null), DEFAULT_COLLAPSED_SECTIONS)
})

test("collapsed sections round-trip through storage", () => {
  const storage = memoryStorage()
  saveCollapsedSections({ video: true, captions: false, inserts: true }, storage)
  assert.ok(storage.data.has(PANEL_SECTIONS_STORAGE_KEY))
  assert.deepEqual(loadCollapsedSections(storage), { video: true, captions: false, inserts: true })
})

test("storage failures fall back to the defaults instead of throwing", () => {
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
    assert.deepEqual(loadCollapsedSections(broken), DEFAULT_COLLAPSED_SECTIONS)
    assert.doesNotThrow(() => saveCollapsedSections(DEFAULT_COLLAPSED_SECTIONS, broken))
  } finally {
    console.warn = originalWarn
  }
})
