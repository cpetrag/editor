import assert from "node:assert/strict"
import { test } from "node:test"

import { ELEMENT_FONT_IDS } from "./schema.ts"
import { ELEMENT_PRESETS, ELEMENT_PRESET_IDS, getElementPreset } from "./catalog.ts"

const EXISTING = [
  "logo-shopee",
  "selo-frete",
  "alerta-desconto",
  "preco-riscado",
  "cupom",
  "contador",
  "barra-estoque",
  "estrelas",
  "seta",
  "tarja-frete",
] as const

const ADDED = [
  "seta-mao",
  "circulo-destaque",
  "bubble-comentario",
  "divisor-antes-depois",
  "passo",
  "tarja-espera",
] as const

test("catalog has the 10 existing elements plus the 6 UGC ones", () => {
  assert.equal(ELEMENT_PRESETS.length, 16)
  for (const id of EXISTING) assert.ok(getElementPreset(id), id)
  for (const id of ADDED) assert.ok(getElementPreset(id), id)
  assert.equal(new Set(ELEMENT_PRESET_IDS).size, 16)
})

test("every element recipe uses text-preset tokens", () => {
  for (const preset of ELEMENT_PRESETS) {
    assert.ok(ELEMENT_FONT_IDS.includes(preset.fontFamily), preset.id)
    assert.ok(preset.heightRatio > 0.04, preset.id)
    assert.equal(preset.hasText || preset.defaultText === "", true, preset.id)
  }
})
