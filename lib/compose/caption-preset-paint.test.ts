import { test } from "node:test"
import assert from "node:assert/strict"

import {
  DEFAULT_CAPTION_STYLE,
  DEFAULT_FPS,
  type CompositionInsert,
} from "../composition.ts"
import { captionStyleToInsertStyle } from "../style/caption-map.ts"
import { PRESETS } from "../style/presets.ts"
import type { InsertStyle } from "../style/types.ts"
import { drawCaptionLine } from "./draw-captions.ts"
import { paintStyledTextPlan } from "./draw-insert-style.ts"
import { planStyledTextDraw } from "../style/caption-draw.ts"

const CAPTION_LOOKS = ["limpo", "viral", "hormozi", "karaoke", "neon", "minimal"] as const

const SAMPLE_WORDS = [
  { text: "pague", start: 1, end: 2 },
  { text: "agora", start: 2, end: 3 },
]

function lookStyle(id: (typeof CAPTION_LOOKS)[number]): InsertStyle {
  if (id === "limpo" || id === "viral") return captionStyleToInsertStyle(DEFAULT_CAPTION_STYLE, id)
  return PRESETS[id]!.style
}

function captionInsert(words: typeof SAMPLE_WORDS | []): CompositionInsert {
  return {
    id: "caption-1",
    type: "legenda",
    kind: "caption",
    start: 1,
    duration: 3,
    text: "pague agora",
    words,
    anchor: "bottom",
    animIn: "none",
    animOut: "none",
    styleRef:
      undefined,
  }
}

type CtxState = {
  alpha: number
  font: string
  fillStyle: unknown
  strokeStyle: unknown
  filter: string
  letterSpacing: string
}

function createPaintRecorder() {
  const stack: CtxState[] = [
    { alpha: 1, font: "16px sans-serif", fillStyle: "#000", strokeStyle: "#000", filter: "none", letterSpacing: "0px" },
  ]
  let glyphs = 0
  const current = () => stack[stack.length - 1]!
  const paint = (text: string) => {
    if (String(text).trim() && current().alpha > 0.01) glyphs += 1
  }
  const ctx = {
    canvas: { width: 1080, height: 1920 },
    save() {
      stack.push({ ...current() })
    },
    restore() {
      if (stack.length > 1) stack.pop()
    },
    translate() {},
    rotate() {},
    scale() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    arcTo() {},
    rect() {},
    clip() {},
    fill() {},
    roundRect() {},
    createLinearGradient: () => ({ addColorStop() {} }),
    measureText: (text: string) => ({ width: String(text).length * 10 }),
    fillText: paint,
    strokeText: paint,
    get globalAlpha() {
      return current().alpha
    },
    set globalAlpha(value: number) {
      current().alpha = value
    },
    get font() {
      return current().font
    },
    set font(value: string) {
      current().font = value
    },
    get fillStyle() {
      return current().fillStyle
    },
    set fillStyle(value: unknown) {
      current().fillStyle = value
    },
    get strokeStyle() {
      return current().strokeStyle
    },
    set strokeStyle(value: unknown) {
      current().strokeStyle = value
    },
    get filter() {
      return current().filter
    },
    set filter(value: string) {
      current().filter = value
    },
    get letterSpacing() {
      return current().letterSpacing
    },
    set letterSpacing(value: string) {
      current().letterSpacing = value
    },
    textBaseline: "middle",
    textAlign: "left",
    lineJoin: "round",
    miterLimit: 2,
    lineWidth: 1,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    shadowBlur: 0,
    shadowColor: "transparent",
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, glyphs: () => glyphs }
}

function paintedGlyphs(style: InsertStyle, words: typeof SAMPLE_WORDS | []): number {
  const insert = captionInsert(words)
  const recorder = createPaintRecorder()
  const measure = (value: string) => value.length * 10
  const plan = planStyledTextDraw({
    lines: ["pague agora"],
    words: words.length ? words : [],
    style,
    time: 2.5,
    measure,
    lineHeight: 48,
    blockW: 120,
    blockH: 48,
    spaceWidth: 10,
    fps: DEFAULT_FPS,
    cardStart: insert.start,
    cardDuration: insert.duration,
  })
  paintStyledTextPlan(
    recorder.ctx,
    plan,
    style,
    { cx: 540, cy: 960 },
    { family: "sans-serif", weight: style.text.fontWeight, size: 48 },
    48,
    1,
  )
  return recorder.glyphs()
}

test("cada preset de legenda pinta glifos com e sem words[]", () => {
  for (const id of CAPTION_LOOKS) {
    const style = lookStyle(id)
    const withWords = paintedGlyphs(style, SAMPLE_WORDS)
    const withoutWords = paintedGlyphs(style, [])
    assert.ok(withWords > 0, `${id} com words[] não pintou glifos`)
    assert.ok(withoutWords > 0, `${id} sem words[] não pintou glifos`)
  }
})

test("drawCaptionLine Hormozi sem words ainda pinta no meio do card", () => {
  const insert: CompositionInsert = {
    ...captionInsert([]),
    styleRef: { presetId: "hormozi", overrides: {} },
  }
  const recorder = createPaintRecorder()
  drawCaptionLine(
    recorder.ctx,
    insert,
    2.5,
    "viral",
    "geist",
    DEFAULT_CAPTION_STYLE,
    { fps: DEFAULT_FPS },
  )
  assert.ok(recorder.glyphs() > 0)
})

test("drawCaptionLine Hormozi com words no start pinta na prévia e some no export", () => {
  const insert: CompositionInsert = {
    ...captionInsert(SAMPLE_WORDS),
    styleRef: { presetId: "hormozi", overrides: {} },
  }
  const preview = createPaintRecorder()
  drawCaptionLine(preview.ctx, insert, 1, "viral", "geist", DEFAULT_CAPTION_STYLE, {
    fps: DEFAULT_FPS,
    editPreview: true,
  })
  assert.ok(preview.glyphs() > 0, "prévia deve pintar no start do card")

  const exported = createPaintRecorder()
  drawCaptionLine(exported.ctx, insert, 1, "viral", "geist", DEFAULT_CAPTION_STYLE, {
    fps: DEFAULT_FPS,
  })
  assert.equal(exported.glyphs(), 0, "export preserva o fade de entrada")
})
