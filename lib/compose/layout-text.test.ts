import { test } from "node:test"
import assert from "node:assert/strict"

import { TEXT_SHRINK_FLOOR, fallbackTextMeasure, layoutInsertText, layoutTextBlock } from "./layout-text.ts"
import type { CompositionInsert } from "../composition.ts"

test("layoutTextBlock wraps an oversized token instead of emitting one overflowing line", () => {
  const layout = layoutTextBlock({
    text: "SUPERPROMOCAOIMPERDIVELHOJE",
    maxWidth: 84,
    maxHeight: 1920,
    fontSize: 20,
    lineHeight: 1.2,
    measureWidth: (fontSize, value) => value.length * fontSize * 0.5,
  })
  assert.ok(layout.lines.length > 1)
  assert.equal(layout.lines.join(""), "SUPERPROMOCAOIMPERDIVELHOJE")
  assert.ok(layout.blockW <= 84 + 0.5 || layout.overflow)
})

test("layoutTextBlock shrinks fontSize until the block fits and does not mutate the configured size", () => {
  const configured = 208
  const layout = layoutTextBlock({
    text: "SUPERPROMOCAOIMPERDIVELHOJE",
    maxWidth: 200,
    maxHeight: 400,
    fontSize: configured,
    lineHeight: 1.2,
    measureWidth: fallbackTextMeasure,
  })
  assert.ok(layout.effectiveFontSize < configured)
  assert.ok(layout.effectiveFontSize >= configured * TEXT_SHRINK_FLOOR - 1e-6)
  assert.equal(configured, 208)
})

test("layoutTextBlock flags overflow when the floor still cannot fit", () => {
  const layout = layoutTextBlock({
    text: "SUPERPROMOCAOIMPERDIVELHOJE",
    maxWidth: 8,
    maxHeight: 20,
    fontSize: 100,
    lineHeight: 1.2,
    measureWidth: fallbackTextMeasure,
  })
  assert.equal(layout.overflow, true)
  assert.ok(Math.abs(layout.effectiveFontSize - 40) < 1e-6)
})

test("layoutInsertText keeps a short line tighter than maxWidthPct", () => {
  const insert: CompositionInsert = {
    id: "t1",
    type: "texto-livre",
    kind: "text",
    start: 0,
    duration: 3,
    text: "Oi",
    anchor: "center",
    animIn: "none",
    animOut: "none",
    x: 50,
    y: 35,
    fontSize: 56,
    maxWidthPct: 84,
  }
  const layout = layoutInsertText(insert, "geist")
  assert.ok(layout)
  assert.ok(layout.blockW < 1080 * 0.84 * 0.5)
  assert.ok(layout.lines.length === 1)
  assert.equal(layout.overflow, false)
})
