import { test } from "node:test"
import assert from "node:assert/strict"

import { captionStyleToInsertStyle } from "./caption-map.ts"
import {
  captionPaintSkipReason,
  planStyledTextDraw,
  warnInvisibleCaptionPaint,
} from "./caption-draw.ts"
import { LEGADO_STYLE, PRESETS } from "./presets.ts"
import type { InsertStyle } from "./types.ts"

const caption = {
  x: 50,
  y: 78,
  fontSize: 40,
  maxWidthPct: 84,
  fontFamily: "geist",
  fontWeight: 800,
  color: "#FFFFFF",
  highlightColor: "#FFE500",
  bgColor: "#111111",
  strokeColor: "#000000",
  strokeWidth: 8,
}

const words = [
  { text: "pague", start: 1, end: 2 },
  { text: "50%", start: 2, end: 3 },
]

function viralStyle(patch?: (style: InsertStyle) => InsertStyle): InsertStyle {
  const style = captionStyleToInsertStyle(caption, "viral")
  return patch ? patch(style) : style
}

function draw(style: InsertStyle, time: number, extra: Partial<Parameters<typeof planStyledTextDraw>[0]> = {}) {
  return planStyledTextDraw({
    lines: ["pague 50%"],
    words,
    style,
    time,
    measure: (value) => value.length * 10,
    lineHeight: 48,
    blockW: 90,
    blockH: 48,
    spaceWidth: 10,
    fps: 30,
    cardStart: 1,
    cardDuration: 3,
    ...extra,
  })
}

test("karaoke-fill acompanha a fala em 3 pontos do tempo absoluto", () => {
  const style = viralStyle((current) => ({
    ...current,
    text: {
      ...current.text,
      highlight: {
        mode: "karaoke-fill",
        color: "#00E676",
        boxColor: null,
        scale: 1,
        keywords: [],
      },
    },
  }))
  const at = (time: number) => draw(style, time, { cardStart: 0, cardDuration: 5 })
  assert.equal(at(1.5).tokens[0]?.karaoke, 0.5)
  assert.equal(at(1.5).tokens[1]?.karaoke, 0)
  assert.equal(at(2.5).tokens[0]?.karaoke, 1)
  assert.equal(at(2.5).tokens[1]?.karaoke, 0.5)
  assert.equal(at(3).tokens[1]?.karaoke, 1)
})

test("unit palavra com stagger muda so a pose, nao o highlight", () => {
  const style = viralStyle((current) => ({
    ...current,
    animation: {
      ...LEGADO_STYLE.animation,
      unit: "palavra",
      enter: {
        from: { opacity: 0 },
        durationInFrames: 6,
        delayInFrames: 0,
        easing: "linear",
        overshoot: 0,
        staggerInFrames: 6,
      },
    },
  }))
  const drawn = draw(style, 1.1)
  assert.equal(drawn.tokens[0]?.fill, "#FFE500")
  assert.equal(drawn.tokens[1]?.fill, "#FFFFFF")
  assert.ok((drawn.tokens[0]?.pose.opacity ?? 0) > (drawn.tokens[1]?.pose.opacity ?? 1))
})

test("karaoke sem words cai em texto simples e ainda planeja glifos", () => {
  const style = viralStyle((current) => ({
    ...current,
    text: {
      ...current.text,
      highlight: {
        mode: "karaoke-fill",
        color: "#00E676",
        boxColor: null,
        scale: 1,
        keywords: [],
      },
    },
  }))
  const drawn = planStyledTextDraw({
    lines: ["pague 50%"],
    words: [],
    style,
    time: 2.5,
    measure: (value) => value.length * 10,
    lineHeight: 48,
    blockW: 90,
    blockH: 48,
    spaceWidth: 10,
    fps: 30,
    cardStart: 1,
    cardDuration: 3,
  })
  assert.equal(drawn.tokens.length, 2)
  for (const token of drawn.tokens) {
    assert.ok(token.text)
    assert.equal(token.karaoke, null)
    assert.ok((token.pose.opacity ?? 0) > 0.05)
  }
})

test("palavra-ativa sem words pinta todos os tokens na cor base", () => {
  const style = viralStyle()
  const drawn = planStyledTextDraw({
    lines: ["pague 50%"],
    words: [],
    style,
    time: 2.5,
    measure: (value) => value.length * 10,
    lineHeight: 48,
    blockW: 90,
    blockH: 48,
    spaceWidth: 10,
    fps: 30,
    cardStart: 1,
    cardDuration: 3,
  })
  assert.equal(drawn.tokens.length, 2)
  assert.equal(drawn.tokens[0]?.fill, style.text.color)
  assert.equal(drawn.tokens[1]?.fill, style.text.color)
  for (const token of drawn.tokens) {
    assert.ok((token.pose.opacity ?? 0) > 0.05)
  }
})

test("Hormozi sem words permanece visível no primeiro frame do card", () => {
  const drawn = planStyledTextDraw({
    lines: ["pague agora"],
    words: [],
    style: PRESETS.hormozi.style,
    time: 1,
    measure: (value) => value.length * 10,
    lineHeight: 48,
    blockW: 120,
    blockH: 48,
    spaceWidth: 10,
    fps: 30,
    cardStart: 1,
    cardDuration: 3,
  })
  assert.ok(drawn.tokens.length > 0)
  for (const token of drawn.tokens) {
    assert.ok((token.pose.opacity ?? 0) > 0.05, "texto simples não pode nascer em opacity 0")
  }
})

test("prévia skipEnter mantém Hormozi visível no start mesmo com words[]", () => {
  const drawn = planStyledTextDraw({
    lines: ["pague agora"],
    words: [
      { text: "pague", start: 1, end: 2 },
      { text: "agora", start: 2, end: 3 },
    ],
    style: PRESETS.hormozi.style,
    time: 1,
    measure: (value) => value.length * 10,
    lineHeight: 48,
    blockW: 120,
    blockH: 48,
    spaceWidth: 10,
    fps: 30,
    cardStart: 1,
    cardDuration: 3,
    skipEnter: true,
  })
  for (const token of drawn.tokens) {
    assert.ok((token.pose.opacity ?? 0) > 0.05)
  }
  const exportFrame = planStyledTextDraw({
    lines: ["pague agora"],
    words: [
      { text: "pague", start: 1, end: 2 },
      { text: "agora", start: 2, end: 3 },
    ],
    style: PRESETS.hormozi.style,
    time: 1,
    measure: (value) => value.length * 10,
    lineHeight: 48,
    blockW: 120,
    blockH: 48,
    spaceWidth: 10,
    fps: 30,
    cardStart: 1,
    cardDuration: 3,
  })
  assert.ok((exportFrame.tokens[0]?.pose.opacity ?? 1) < 0.05)
})

test("caixa com texto e zero glifos visíveis explica o motivo", () => {
  assert.equal(
    captionPaintSkipReason({
      id: "c1",
      preset: "hormozi",
      blockW: 120,
      blockH: 40,
      text: "oi",
      tokenCount: 0,
      visibleGlyphs: 0,
      words: 0,
    }),
    "tokens-empty",
  )
  assert.equal(
    captionPaintSkipReason({
      id: "c1",
      preset: "hormozi",
      blockW: 120,
      blockH: 40,
      text: "oi",
      tokenCount: 2,
      visibleGlyphs: 0,
      words: 0,
    }),
    "zero-glyphs",
  )
  assert.equal(
    captionPaintSkipReason({
      id: "c1",
      preset: "hormozi",
      blockW: 120,
      blockH: 40,
      text: "oi",
      tokenCount: 2,
      visibleGlyphs: 2,
      words: 2,
    }),
    null,
  )
})

test("warnInvisibleCaptionPaint registra id, preset e motivo", () => {
  const lines: unknown[][] = []
  const original = console.warn
  console.warn = (...args: unknown[]) => {
    lines.push(args)
  }
  try {
    const reason = warnInvisibleCaptionPaint({
      id: "cap-9",
      preset: "hormozi",
      blockW: 200,
      blockH: 50,
      text: "TESTE",
      tokenCount: 0,
      visibleGlyphs: 0,
      words: 0,
    })
    assert.equal(reason, "tokens-empty")
    assert.equal(lines[0]?.[0], "[caption-paint] zero glyphs")
    assert.deepEqual(lines[0]?.[1], { id: "cap-9", preset: "hormozi", reason: "tokens-empty" })
  } finally {
    console.warn = original
  }
})

test("plano de legenda não recebe o envelope de fundo dos inserts", () => {
  const drawn = draw(viralStyle(), 1.2)
  assert.equal(drawn.backgroundMotion, undefined)
})

test("por-linha no plano gera dois fundos", () => {
  const style = captionStyleToInsertStyle(caption, "limpo")
  style.text.background.mode = "por-linha"
  style.text.background.enabled = true
  const drawn = planStyledTextDraw({
    lines: ["linha um", "dois"],
    words: [],
    style,
    time: 0,
    measure: (value) => value.length * 10,
    lineHeight: 40,
    blockW: 80,
    blockH: 80,
    spaceWidth: 10,
    fps: 30,
    cardStart: 0,
    cardDuration: 2,
  })
  assert.equal(drawn.backgrounds.length, 2)
  assert.ok((drawn.backgrounds[0]?.w ?? 0) > (drawn.backgrounds[1]?.w ?? 0))
})
