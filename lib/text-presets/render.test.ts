import assert from "node:assert/strict"
import { test } from "node:test"

import { getTextPreset } from "./catalog.ts"
import { renderTextPreset, wrapPresetLines } from "./render.ts"

test("renderTextPreset scales pixel measures with frame width", () => {
  const preset = getTextPreset("impacto")
  const full = renderTextPreset(preset, "OFERTA", 1080, 1)
  const half = renderTextPreset(preset, "OFERTA", 540, 1)
  assert.equal(half.fontSize, full.fontSize / 2)
  assert.equal(half.strokeWidth, full.strokeWidth / 2)
  assert.equal(half.maxWidth, full.maxWidth / 2)
})

test("wrapPresetLines and highlight-line layers", () => {
  const lines = wrapPresetLines("um dois tres quatro", 80, 40, (text, size) => text.length * size * 0.5)
  assert.ok(lines.length >= 2)
  const preset = getTextPreset("marcador")
  const rendered = renderTextPreset(
    preset,
    "frase longa para quebrar em duas linhas no marcador",
    1080,
    1,
    (text, size) => text.length * size * 0.45,
  )
  assert.ok(rendered.layers)
  assert.ok(rendered.layers.length >= 2)
})
