import assert from "node:assert/strict"
import { test } from "node:test"

import { assertElementPreset, isElementPreset, ELEMENT_PRESET_SCHEMA } from "./schema.ts"

const valid = {
  schema: ELEMENT_PRESET_SCHEMA,
  id: "selo-frete",
  name: "Selo Frete Grátis",
  shape: "badge",
  defaultText: "FRETE GRÁTIS",
  hasText: true,
  primary: "#0F766E",
  secondary: "#FFFFFF",
  fontFamily: "archivo",
  fontWeight: 400,
  uppercase: true,
  radiusRatio: 0.5,
  padXRatio: 0.028,
  padYRatio: 0.012,
  heightRatio: 0.0648,
  minWidthRatio: 0.2,
  shadow: "hard",
  defaultX: 50,
  defaultY: 18,
  defaultScale: 1,
}

test("assertElementPreset accepts a valid element recipe", () => {
  const preset = assertElementPreset(valid)
  assert.equal(preset.id, "selo-frete")
  assert.equal(preset.primary, "#0F766E")
})

test("isElementPreset rejects invalid payloads", () => {
  assert.equal(isElementPreset(null), false)
  assert.equal(isElementPreset({ ...valid, schema: "nope" }), false)
  assert.equal(isElementPreset({ ...valid, fontFamily: "comic-sans" }), false)
  assert.equal(isElementPreset({ ...valid, primary: "teal" }), false)
  assert.throws(() => assertElementPreset({ ...valid, shape: "sticker" }), /forma inválida/)
})
