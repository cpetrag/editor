import { test } from "node:test"
import assert from "node:assert/strict"

import { animatedPoseAt } from "./anim-engine.ts"
import {
  DEFAULT_CTA_PRESET_ID,
  FACTORY_PRESET_IDS,
  LEGADO_PRESET_ID,
  PRESETS,
  factoryPresetsInGroup,
  getPresetStyle,
} from "./presets.ts"

test("existem 16 presets de fábrica além do legado", () => {
  assert.equal(FACTORY_PRESET_IDS.length, 16)
  assert.ok(PRESETS[LEGADO_PRESET_ID])
  for (const id of FACTORY_PRESET_IDS) {
    assert.ok(PRESETS[id], id)
    assert.notEqual(id, LEGADO_PRESET_ID)
  }
})

test("os 16 se agrupam em 8 legendas, 3 gancho, 2 prova e 3 cta", () => {
  assert.equal(factoryPresetsInGroup("legenda").length, 8)
  assert.equal(factoryPresetsInGroup("gancho").length, 3)
  assert.equal(factoryPresetsInGroup("prova").length, 2)
  assert.equal(factoryPresetsInGroup("cta").length, 3)
})

test("hormozi: montserrat 900, stroke 8, palavra-ativa amarela, pop por palavra", () => {
  const style = getPresetStyle("hormozi")
  assert.equal(PRESETS.hormozi?.label, "Hormozi")
  assert.equal(PRESETS.hormozi?.group, "legenda")
  assert.equal(style.text.fontFamily, "montserrat")
  assert.equal(style.text.fontWeight, 900)
  assert.equal(style.text.textTransform, "uppercase")
  assert.equal(style.text.stroke.enabled, true)
  assert.equal(style.text.stroke.width, 8)
  assert.equal(style.text.highlight.mode, "palavra-ativa")
  assert.equal(style.text.highlight.color, "#FFE600")
  assert.equal(style.text.highlight.scale, 1.08)
  assert.equal(style.animation.unit, "palavra")
  assert.equal(style.animation.enter.easing, "spring")
  assert.equal(style.animation.enter.overshoot, 0.15)
})

test("karaoke: bebas, karaoke-fill, sem animação de entrada", () => {
  const style = getPresetStyle("karaoke")
  assert.equal(style.text.fontFamily, "bebas")
  assert.equal(style.text.highlight.mode, "karaoke-fill")
  assert.equal(style.text.highlight.color, "#00E676")
  assert.equal(style.animation.enter.durationInFrames, 0)
})

test("umaPalavra reagrupa em 1 palavra e usa anton 140", () => {
  assert.equal(PRESETS.umaPalavra?.maxWords, 1)
  const style = getPresetStyle("umaPalavra")
  assert.equal(style.text.fontFamily, "anton")
  assert.equal(style.text.fontSize, 140)
  assert.equal(style.animation.unit, "bloco")
  assert.equal(style.animation.enter.from.scale, 1.35)
})

test("carrinhoLaranja é o default da faixa CTA e pulsa de forma determinística", () => {
  assert.equal(DEFAULT_CTA_PRESET_ID, "carrinhoLaranja")
  assert.equal(PRESETS.carrinhoLaranja?.group, "cta")
  const style = getPresetStyle("carrinhoLaranja")
  assert.equal(style.text.background.enabled, true)
  assert.equal(style.text.background.color, "#FF6B00")
  assert.equal(style.text.background.radius, 999)
  assert.equal(style.animation.loop.type, "pulse")
  assert.equal(style.animation.loop.amplitude, 0.04)
  const a = animatedPoseAt({
    anim: style.animation,
    indexInCard: 0,
    cardStartFrame: 0,
    cardDurationFrames: 90,
    frame: 40,
    fps: 30,
  })
  const b = animatedPoseAt({
    anim: style.animation,
    indexInCard: 0,
    cardStartFrame: 0,
    cardDurationFrames: 90,
    frame: 40,
    fps: 30,
  })
  assert.deepEqual(a, b)
  const later = animatedPoseAt({
    anim: style.animation,
    indexInCard: 0,
    cardStartFrame: 0,
    cardDurationFrames: 90,
    frame: 48,
    fps: 30,
  })
  assert.notEqual(a.scale, later.scale)
})

test("preset desconhecido cai no legado", () => {
  assert.equal(getPresetStyle("nao-existe").text.fontFamily, "geist")
  assert.equal(getPresetStyle(undefined).text.fontSize, 56)
})
