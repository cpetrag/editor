import assert from "node:assert/strict"
import { test } from "node:test"

import type { CompositionInsert } from "../composition.ts"
import { resolveLayerStyle } from "../compose/resolve-style.ts"
import { applyFontFamily, applyTextPreset } from "./apply.ts"
import { paintTextPresetInsert } from "./to-insert-style.ts"

function textInsert(patch: Partial<CompositionInsert> = {}): CompositionInsert {
  return {
    id: "t1",
    type: "texto-livre",
    kind: "text",
    start: 1.5,
    duration: 2.5,
    text: "OFERTA",
    anchor: "center",
    animIn: "pop",
    animOut: "none",
    x: 41,
    y: 62,
    fontSize: 72,
    preset: "contorno-tiktok",
    ...patch,
  }
}

test("applyTextPreset does not move, resize or retime the insert", () => {
  const next = applyTextPreset(textInsert(), "impacto")
  assert.equal(next.preset, "impacto")
  assert.equal(next.x, 41)
  assert.equal(next.y, 62)
  assert.equal(next.fontSize, 72)
  assert.equal(next.start, 1.5)
  assert.equal(next.duration, 2.5)
  assert.equal(next.fontFamily, "anton")
  assert.equal(next.styleRef?.presetId, "legado")
  assert.deepEqual(next.styleRef?.overrides, {})
})

test("applyTextPreset ignores captions and unknown ids", () => {
  const caption: CompositionInsert = {
    id: "c1",
    type: "legenda",
    kind: "caption",
    start: 0,
    duration: 2,
    text: "oi",
    anchor: "bottom",
    animIn: "none",
    animOut: "none",
    preset: "viral",
  }
  assert.equal(applyTextPreset(caption, "impacto"), caption)
  const text = textInsert()
  assert.equal(applyTextPreset(text, "bold-outline"), text)
})

test("applyFontFamily overrides the preset family on the compose style the canvas paints", () => {
  const insert = applyTextPreset(textInsert(), "impacto")
  assert.equal(insert.fontFamily, "anton")
  assert.equal(insert.style?.fontFamily, "anton")

  const patch = applyFontFamily(insert, "Inter")
  assert.equal(patch.fontFamily, "inter")
  assert.equal(patch.style?.fontFamily, "inter")
  assert.equal(patch.styleRef?.overrides.text?.fontFamily, "inter")

  const next = { ...insert, ...patch }
  const painted = paintTextPresetInsert(next, 1080)
  assert.ok(painted)
  assert.equal(painted.text.fontFamily, "inter")
  assert.equal(resolveLayerStyle(next, "geist").fontFamily.includes("Inter"), true)
})
