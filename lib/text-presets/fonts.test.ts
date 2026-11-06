import assert from "node:assert/strict"
import { test } from "node:test"

import {
  ensureTextPresetFontsReady,
  resetTextPresetFontsCache,
} from "./fonts.ts"

test("ensureTextPresetFontsReady não dispara de novo no segundo call", async () => {
  resetTextPresetFontsCache()
  let loads = 0
  class FakeFontFace {
    family: string
    constructor(family: string) {
      this.family = family
    }
    load() {
      loads += 1
      return Promise.resolve(this)
    }
  }

  const previous = {
    FontFace: globalThis.FontFace,
    document: globalThis.document,
  }
  ;(globalThis as { FontFace?: unknown }).FontFace = FakeFontFace
  ;(globalThis as { document?: unknown }).document = {
    fonts: {
      add() {},
      load: async () => [],
      ready: Promise.resolve(),
    },
  }

  try {
    await ensureTextPresetFontsReady()
    const first = loads
    assert.ok(first > 0)
    await ensureTextPresetFontsReady()
    assert.equal(loads, first)
  } finally {
    resetTextPresetFontsCache()
    if (previous.FontFace) {
      ;(globalThis as { FontFace?: unknown }).FontFace = previous.FontFace
    } else {
      delete (globalThis as { FontFace?: unknown }).FontFace
    }
    if (previous.document) {
      ;(globalThis as { document?: unknown }).document = previous.document
    } else {
      delete (globalThis as { document?: unknown }).document
    }
  }
})
