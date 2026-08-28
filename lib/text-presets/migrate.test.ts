import assert from "node:assert/strict"
import { test } from "node:test"

import {
  isLegacyTextPresetId,
  migrateTextInsert,
  migrateTextPresetId,
} from "./migrate.ts"

test("legacy outline ids migrate to contorno-tiktok", () => {
  assert.equal(migrateTextPresetId("bold-outline"), "contorno-tiktok")
  assert.equal(migrateTextPresetId(undefined), "contorno-tiktok")
  assert.equal(migrateTextPresetId(""), "contorno-tiktok")
  assert.equal(migrateTextPresetId("legado"), "contorno-tiktok")
  assert.equal(isLegacyTextPresetId("bold-outline"), true)
  assert.equal(migrateTextPresetId("impacto"), "impacto")
})

test("migrateTextInsert only touches text inserts and keeps layout", () => {
  const text = migrateTextInsert({
    kind: "text",
    type: "texto-livre",
    preset: "bold-outline",
    x: 40,
    y: 60,
    fontSize: 72,
  })
  assert.equal(text.preset, "contorno-tiktok")
  assert.equal(text.x, 40)
  assert.equal(text.y, 60)
  assert.equal(text.fontSize, 72)
  const caption = migrateTextInsert({
    kind: "caption",
    type: "legenda",
    preset: "viral",
  })
  assert.equal(caption.preset, "viral")
})
