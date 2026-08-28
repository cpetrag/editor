import assert from "node:assert/strict"
import { test } from "node:test"

import { getTextPreset } from "./catalog.ts"
import { createInsert } from "../inserts.ts"
import { applyTextBackground, applyTextShadow } from "./bar.ts"
import { applyTextPreset } from "./apply.ts"
import {
  fontIdFromFamily,
  paintTextPresetInsert,
  overlayComposeInsertStyle,
  textPresetToInsertStyle,
} from "./to-insert-style.ts"

test("fontIdFromFamily maps OFL families", () => {
  assert.equal(fontIdFromFamily("Anton"), "anton")
  assert.equal(fontIdFromFamily("Archivo Black"), "archivo")
  assert.equal(fontIdFromFamily("Caveat"), "caveat")
  assert.equal(fontIdFromFamily("Courier Prime"), "courier")
})

test("textPresetToInsertStyle keeps layout from the insert", () => {
  const painted = textPresetToInsertStyle(getTextPreset("impacto"), 1080, {
    x: 41,
    y: 62,
    fontSize: 80,
    rotation: 3,
  })
  assert.equal(painted.text.fontFamily, "anton")
  assert.equal(painted.text.fontSize, 80)
  assert.equal(painted.text.x, 41)
  assert.equal(painted.text.y, 62)
  assert.equal(painted.text.rotation, 3)
  assert.equal(painted.text.background.enabled, false)
})

test("pill and highlight-line boxes map to factory background modes", () => {
  const pill = textPresetToInsertStyle(getTextPreset("pilula-preta"), 1080)
  assert.equal(pill.text.background.enabled, true)
  assert.equal(pill.text.background.mode, "bloco")
  assert.equal(pill.text.background.radius, 999)
  const marker = textPresetToInsertStyle(getTextPreset("marcador"), 1080)
  assert.equal(marker.text.background.mode, "por-linha")
})

test("createInsert texto-livre paints impacto font, uppercase, stroke and shadow", () => {
  const insert = createInsert("texto-livre")
  const painted = paintTextPresetInsert(insert, 1080)
  assert.ok(painted)
  assert.equal(insert.preset, "impacto")
  assert.equal(painted.text.fontFamily, "anton")
  assert.equal(painted.text.textTransform, "uppercase")
  assert.equal(painted.text.stroke.enabled, true)
  assert.ok((painted.text.stroke.width ?? 0) > 0)
  assert.ok(painted.text.shadows.length > 0)
})

test("applying a look replaces font, box and shadow instead of keeping bar patches", () => {
  const created = createInsert("texto-livre")
  const withBar = {
    ...created,
    ...applyTextBackground(created, true),
    ...applyTextShadow(created, false),
  }
  const next = applyTextPreset(withBar, "neon")
  const painted = paintTextPresetInsert(next, 1080)
  assert.ok(painted)
  assert.equal(next.fontFamily, "poppins")
  assert.equal(painted.text.fontFamily, "poppins")
  assert.equal(painted.text.background.enabled, false)
  assert.ok(painted.text.shadows.length > 0)
  assert.equal(painted.text.stroke.enabled, false)
})

test("overlayComposeInsertStyle disables box when compose bgColor is null", () => {
  const painted = textPresetToInsertStyle(getTextPreset("pilula-preta"), 1080)
  const next = overlayComposeInsertStyle(painted, { bgColor: null })
  assert.equal(next.text.background.enabled, false)
})

test("styleRef.overrides.fontFamily wins over a diverging insert.style", () => {
  const insert = createInsert("texto-livre")
  const diverged = {
    ...insert,
    style: { ...insert.style, fontFamily: "inter" as const, fontWeight: 800 as const },
    styleRef: {
      presetId: "legado",
      overrides: { text: { fontFamily: "anton" } },
    },
  }
  const painted = paintTextPresetInsert(diverged, 1080)
  assert.ok(painted)
  assert.equal(painted.text.fontFamily, "anton")
})

test("partial styleRef override of stroke.enabled does not restore the look stroke", () => {
  const insert = applyTextPreset(createInsert("texto-livre"), "impacto")
  const painted = paintTextPresetInsert(
    {
      ...insert,
      style: { ...insert.style, strokeWidth: 12, strokeColor: "#000000" },
      styleRef: {
        presetId: "legado",
        overrides: { text: { stroke: { enabled: false } } },
      },
    },
    1080,
  )
  assert.ok(painted)
  assert.equal(painted.text.stroke.enabled, false)
})
