import assert from "node:assert/strict"
import { test } from "node:test"

import type { CompositionInsert } from "../composition.ts"
import { measureElementSize } from "./layout.ts"

function chip(type: CompositionInsert["type"], patch: Partial<CompositionInsert> = {}): CompositionInsert {
  return {
    id: "e1",
    type,
    start: 0,
    duration: 3,
    anchor: "top",
    animIn: "none",
    animOut: "none",
    ...patch,
  }
}

test("measureElementSize uses overlay-sized ratios instead of 28px product seals", () => {
  const size = measureElementSize(chip("selo-frete"), 1080)
  assert.ok(size.height >= 60)
  assert.ok(size.width >= 200)
})

test("measureElementSize scales from the recipe, not a tiny pill", () => {
  const base = measureElementSize(chip("alerta-desconto", { text: "50% OFF" }), 1080)
  const scaled = measureElementSize(chip("alerta-desconto", { text: "50% OFF", scale: 2 }), 1080)
  assert.ok(Math.abs(scaled.width - base.width * 2) < 1)
  assert.ok(Math.abs(scaled.height - base.height * 2) < 1)
})

test("divider is tall and narrow so it can split the frame", () => {
  const size = measureElementSize(chip("divisor-antes-depois"), 1080)
  assert.ok(size.height > size.width * 3)
})

const LONG_REVIEW =
  "@fuladsonee\nO produto é muito bom, gostei demais dele, indico a todos que queiram comprar"

test("bubble and stars cap width so a long review stays inside the frame", () => {
  const bubble = measureElementSize(chip("bubble-comentario", { text: LONG_REVIEW }), 1080)
  const stars = measureElementSize(chip("estrelas", { text: LONG_REVIEW }), 1080)
  assert.ok(bubble.width <= 1080 * 0.72 + 1)
  assert.ok(stars.width <= 1080 * 0.72 + 1)
  assert.ok(bubble.width < 1080 * 0.9)
})

test("bubble grows taller when the comment wraps onto extra lines", () => {
  const short = measureElementSize(chip("bubble-comentario", { text: "@loja ok" }), 1080)
  const long = measureElementSize(chip("bubble-comentario", { text: LONG_REVIEW }), 1080)
  assert.ok(long.height > short.height + 20)
})

test("maxWidthPct narrows a wrapping chip and adds more lines", () => {
  const wide = measureElementSize(
    chip("bubble-comentario", { text: LONG_REVIEW, maxWidthPct: 72 }),
    1080,
  )
  const slim = measureElementSize(
    chip("bubble-comentario", { text: LONG_REVIEW, maxWidthPct: 40 }),
    1080,
  )
  assert.ok(slim.width < wide.width - 40)
  assert.ok(slim.height >= wide.height)
})

test("animated arrow box stacks label above the glyph", () => {
  const size = measureElementSize(chip("seta", { text: "AQUI" }), 1080)
  assert.ok(size.height > size.width * 0.85)
})
