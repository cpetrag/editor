import { test } from "node:test"
import assert from "node:assert/strict"

import { mapLegacyShadow, migrateInsertStyle } from "./migrate.ts"
import { PRESETS } from "./presets.ts"
import { resolveStyle } from "./resolve-style.ts"

test("mapLegacyShadow converte os quatro presets fixos para o array de sombras", () => {
  assert.deepEqual(mapLegacyShadow("nenhuma"), [])
  assert.deepEqual(mapLegacyShadow("none"), [])
  assert.deepEqual(mapLegacyShadow("suave"), [
    { x: 0, y: 6, blur: 14, color: "rgba(0,0,0,0.55)" },
  ])
  assert.deepEqual(mapLegacyShadow("soft"), [
    { x: 0, y: 6, blur: 14, color: "rgba(0,0,0,0.55)" },
  ])
  assert.deepEqual(mapLegacyShadow("dura"), [
    { x: 4, y: 4, blur: 0, color: "#000000" },
  ])
  assert.deepEqual(mapLegacyShadow("hard"), [
    { x: 4, y: 4, blur: 0, color: "#000000" },
  ])
  assert.deepEqual(mapLegacyShadow("glow", "#EE4D2D"), [
    { x: 0, y: 0, blur: 18, color: "#EE4D2D" },
  ])
})

test("migrateInsertStyle grava só o diff no preset legado, sem perder campos", () => {
  const ref = migrateInsertStyle({
    fontFamily: "montserrat",
    fontSize: 72,
    fontWeight: 900,
    shadow: "dura",
    opacity: 0.8,
    rotation: -4,
    x: 48,
    y: 62,
  })

  assert.equal(ref.presetId, "legado")
  assert.deepEqual(ref.overrides, {
    text: {
      fontFamily: "montserrat",
      fontSize: 72,
      fontWeight: 900,
      shadows: [{ x: 4, y: 4, blur: 0, color: "#000000" }],
      opacity: 80,
      rotation: -4,
      x: 48,
      y: 62,
    },
  })

  const resolved = resolveStyle({ styleRef: ref }, null, {})
  assert.equal(resolved.text.fontFamily, "montserrat")
  assert.equal(resolved.text.fontSize, 72)
  assert.equal(resolved.text.fontWeight, 900)
  assert.equal(resolved.text.opacity, 80)
  assert.equal(resolved.text.rotation, -4)
  assert.equal(resolved.text.x, 48)
  assert.equal(resolved.text.y, 62)
  assert.deepEqual(resolved.text.shadows, [{ x: 4, y: 4, blur: 0, color: "#000000" }])
  assert.equal(resolved.text.letterSpacing, PRESETS.legado.style.text.letterSpacing)
  assert.equal(resolved.animation.unit, PRESETS.legado.style.animation.unit)
})

test("migrateInsertStyle lê o estilo achatado aninhado (style) e o top-level", () => {
  const ref = migrateInsertStyle({
    fontSize: 56,
    x: 50,
    y: 35,
    fontFamily: "geist",
    style: {
      fontFamily: "bebas",
      fontWeight: 400,
      shadow: "glow",
      opacity: 1,
      rotation: 8,
      color: "#EE4D2D",
    },
  })

  assert.equal(ref.overrides.text?.fontFamily, "bebas")
  assert.equal(ref.overrides.text?.fontWeight, 400)
  assert.equal(ref.overrides.text?.fontSize, 56)
  assert.equal(ref.overrides.text?.opacity, 100)
  assert.equal(ref.overrides.text?.rotation, 8)
  assert.equal(ref.overrides.text?.color, "#EE4D2D")
  assert.deepEqual(ref.overrides.text?.shadows, [
    { x: 0, y: 0, blur: 18, color: "#EE4D2D" },
  ])
})

test("migrateInsertStyle com insert vazio aponta para o legado sem overrides", () => {
  const ref = migrateInsertStyle({})
  assert.deepEqual(ref, { presetId: "legado", overrides: {} })
})
