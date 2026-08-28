import assert from "node:assert/strict"
import { test } from "node:test"

import type { CompositionInsert } from "../composition.ts"
import {
  applyElementColors,
  applyElementScale,
  elementColorsOf,
  elementTextOf,
  nudgeElementMaxWidth,
  nudgeElementScale,
} from "./apply.ts"

function chip(patch: Partial<CompositionInsert> = {}): CompositionInsert {
  return {
    id: "e1",
    type: "selo-frete",
    start: 0,
    duration: 3,
    anchor: "top",
    animIn: "none",
    animOut: "none",
    ...patch,
  }
}

test("elementTextOf falls back to the recipe default when the insert has no text", () => {
  assert.equal(elementTextOf(chip()), "FRETE GRÁTIS")
  assert.equal(elementTextOf(chip({ text: "  CORRE  " })), "CORRE")
})

test("elementColorsOf uses recipe colors until the insert overrides them", () => {
  const base = elementColorsOf(chip())
  assert.equal(base.primary, "#0F766E")
  assert.equal(base.secondary, "#FFFFFF")
  const patched = { ...chip(), ...applyElementColors(chip(), { primary: "#111111", secondary: "#FFE500" }) }
  const next = elementColorsOf(patched)
  assert.equal(next.primary, "#111111")
  assert.equal(next.secondary, "#FFE500")
})

test("nudgeElementScale stays inside the overlay scale range", () => {
  const up = nudgeElementScale(chip({ scale: 1 }), 0.2)
  assert.equal(up.scale, 1.2)
  const clamped = applyElementScale(chip(), 99)
  assert.ok((clamped.scale ?? 0) <= 4)
})

test("elementTextOf keeps manual line breaks in a review", () => {
  const text = "@fuladsonee\nO produto é muito bom"
  assert.equal(elementTextOf(chip({ type: "bubble-comentario", text })), text)
})

test("nudgeElementMaxWidth stays inside the wrap range", () => {
  const next = nudgeElementMaxWidth(chip({ type: "bubble-comentario" }), 8)
  assert.equal(next.maxWidthPct, 80)
  const clamped = nudgeElementMaxWidth(chip({ type: "bubble-comentario", maxWidthPct: 88 }), 20)
  assert.ok((clamped.maxWidthPct ?? 0) <= 90)
})
