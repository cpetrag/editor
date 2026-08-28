import { test } from "node:test"
import assert from "node:assert/strict"

import { LEGADO_STYLE } from "./presets.ts"
import type { StyleRef } from "./types.ts"
import {
  backgroundCss,
  backgroundRects,
  layoutTextTokens,
  strokeCss,
} from "./text-paint.ts"
import { captionStyleToInsertStyle, resolveCaptionInsertStyle } from "./caption-map.ts"

const caption = {
  x: 50,
  y: 78,
  fontSize: 56,
  maxWidthPct: 84,
  fontFamily: "geist",
  fontWeight: 800,
  color: "#FFFFFF",
  highlightColor: "#FFE500",
  bgColor: "#000000",
  strokeColor: "#000000",
  strokeWidth: 6,
}

test("contorno 8px usa paint-order stroke fill e nao cria text-shadow", () => {
  const css = strokeCss({ enabled: true, width: 8, color: "#000000" })
  assert.equal(css.paintOrder, "stroke fill")
  assert.equal(css.WebkitTextStroke, "8px #000000")
  assert.equal(css.textShadow, undefined)
})

test("contorno acima de 12px ganha 8 text-shadows em circulo", () => {
  const css = strokeCss({ enabled: true, width: 14, color: "#111" })
  assert.equal(css.paintOrder, "stroke fill")
  assert.ok(css.textShadow)
  assert.equal(css.textShadow.split(",").length, 8)
})

test("por-linha com 2 linhas gera dois fundos da largura de cada linha", () => {
  const rects = backgroundRects({
    mode: "por-linha",
    blockW: 200,
    blockH: 80,
    padX: 10,
    padY: 4,
    radius: 8,
    lines: [
      { width: 200, y: -20, height: 40 },
      { width: 80, y: 20, height: 40 },
    ],
    words: [],
  })
  assert.equal(rects.length, 2)
  assert.equal(rects[0]?.w, 220)
  assert.equal(rects[1]?.w, 100)
  assert.notEqual(rects[0]?.y, rects[1]?.y)
})

test("bloco gera um unico retangulo; por-palavra um por palavra", () => {
  const block = backgroundRects({
    mode: "bloco",
    blockW: 120,
    blockH: 40,
    padX: 8,
    padY: 4,
    radius: 6,
    lines: [],
    words: [
      { x: -60, y: 0, width: 50, height: 40 },
      { x: 10, y: 0, width: 40, height: 40 },
    ],
  })
  assert.equal(block.length, 1)
  assert.equal(block[0]?.w, 136)
  assert.equal(block[0]?.h, 48)

  const perWord = backgroundRects({
    mode: "por-palavra",
    blockW: 120,
    blockH: 40,
    padX: 4,
    padY: 2,
    radius: 999,
    lines: [],
    words: [
      { x: -60, y: 0, width: 50, height: 40 },
      { x: 10, y: 0, width: 40, height: 40 },
    ],
  })
  assert.equal(perWord.length, 2)
  assert.equal(perWord[0]?.w, 58)
  assert.equal(perWord[1]?.w, 48)
})

test("backgroundCss por-linha usa inline + box-decoration-break clone", () => {
  const css = backgroundCss({
    ...LEGADO_STYLE.text.background,
    enabled: true,
    mode: "por-linha",
    color: "#000",
    opacity: 70,
    paddingX: 12,
    paddingY: 6,
    radius: 8,
  })
  assert.equal(css.display, "inline")
  assert.equal(css.boxDecorationBreak, "clone")
  assert.equal(css.WebkitBoxDecorationBreak, "clone")
})

test("viral mapeia stroke + palavra-ativa; limpo mapeia fundo bloco", () => {
  const viral = captionStyleToInsertStyle(caption, "viral")
  assert.equal(viral.text.textTransform, "uppercase")
  assert.equal(viral.text.stroke.enabled, true)
  assert.equal(viral.text.stroke.width, 6)
  assert.equal(viral.text.background.enabled, false)
  assert.equal(viral.text.highlight.mode, "palavra-ativa")
  assert.equal(viral.text.highlight.color, "#FFE500")
  assert.equal(viral.animation.enter.durationInFrames, 0)

  const limpo = captionStyleToInsertStyle(caption, "limpo")
  assert.equal(limpo.text.textTransform, "none")
  assert.equal(limpo.text.stroke.enabled, false)
  assert.equal(limpo.text.background.enabled, true)
  assert.equal(limpo.text.background.mode, "bloco")
  assert.equal(limpo.text.background.color, "#000000")
  assert.equal(limpo.text.highlight.mode, "palavra-ativa")
})

test("styleRef legado nao troca o visual viral; overlay de highlight/animacao aplica", () => {
  const styleRef: StyleRef = {
    presetId: "legado",
    overrides: {
      animation: {
        unit: "palavra",
        enter: {
          from: { scale: 0.6 },
          durationInFrames: 8,
          delayInFrames: 0,
          easing: "spring",
          overshoot: 0.15,
          staggerInFrames: 2,
        },
      },
      text: { highlight: { mode: "karaoke-fill", color: "#00E676" } },
    },
  }
  const painted = resolveCaptionInsertStyle(
    { styleRef },
    caption,
    "viral",
    null,
    {},
  )
  assert.equal(painted.text.color, "#FFFFFF")
  assert.equal(painted.text.stroke.enabled, true)
  assert.equal(painted.text.highlight.mode, "karaoke-fill")
  assert.equal(painted.animation.unit, "palavra")
  assert.equal(painted.animation.enter.staggerInFrames, 2)
})

test("layoutTextTokens: bloco compartilha index 0; palavra e letra staggeram", () => {
  const measure = (value: string) => value.length * 10
  const lines = ["oi tot"]
  const block = layoutTextTokens({
    lines,
    unit: "bloco",
    measure,
    lineHeight: 20,
    blockH: 20,
    spaceWidth: 10,
  })
  assert.deepEqual(block.map((token) => token.unitIndex), [0, 0])
  assert.deepEqual(block.map((token) => token.wordIndex), [0, 1])

  const words = layoutTextTokens({
    lines,
    unit: "palavra",
    measure,
    lineHeight: 20,
    blockH: 20,
    spaceWidth: 10,
  })
  assert.deepEqual(words.map((token) => token.unitIndex), [0, 1])

  const letters = layoutTextTokens({
    lines: ["ab"],
    unit: "letra",
    measure,
    lineHeight: 20,
    blockH: 20,
    spaceWidth: 10,
  })
  assert.deepEqual(
    letters.map((token) => ({ text: token.text, unitIndex: token.unitIndex })),
    [
      { text: "a", unitIndex: 0 },
      { text: "b", unitIndex: 1 },
    ],
  )
})
