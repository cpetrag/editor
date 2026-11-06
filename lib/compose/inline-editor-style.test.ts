import { test } from "node:test"
import assert from "node:assert/strict"

import {
  committedInlineText,
  fallbackTextLayout,
  inlineEditorCss,
  inlineEditorPlacement,
  paintedDisplayInsert,
} from "./inline-editor-style.ts"
import type { TextLayout } from "./layout-text.ts"
import type { CompositionInsert } from "../composition.ts"
import type { InsertStyle } from "../style/types.ts"

function textInsert(patch: Partial<CompositionInsert> = {}): CompositionInsert {
  return {
    id: "t1",
    type: "texto-livre",
    start: 0,
    duration: 3,
    text: "Link aqui",
    x: 50,
    y: 50,
    fontSize: 90,
    ...patch,
  } as CompositionInsert
}

function layoutOf(patch: Partial<TextLayout> = {}): TextLayout {
  return {
    lines: ["Link aqui"],
    blockW: 400,
    blockH: 108,
    effectiveFontSize: 90,
    overflow: false,
    cx: 540,
    cy: 960,
    rotation: 0,
    ...patch,
  }
}

function paintedStyle(): InsertStyle {
  return {
    text: {
      fontFamily: "anton",
      fontWeight: 400,
      fontSize: 90,
      letterSpacing: 0,
      lineHeight: 1.2,
      textTransform: "uppercase",
      textAlign: "center",
      maxWidth: 80,
      color: "#ffffff",
      gradient: { enabled: false, from: "#fff", to: "#000", angle: 0 },
      stroke: { enabled: true, width: 6, color: "#000000" },
      shadows: [{ x: 0, y: 4, blur: 8, color: "#000000" }],
      background: {
        enabled: true,
        mode: "bloco",
        color: "#111111",
        opacity: 100,
        paddingX: 30,
        paddingY: 12,
        radius: 20,
        backdropBlur: 0,
      },
      highlight: { mode: "nenhum", color: "#fff", boxColor: null, scale: 1, keywords: [] },
      x: 50,
      y: 50,
      rotation: 0,
      opacity: 100,
    },
    animation: {
      unit: "bloco",
      enter: { from: {}, durationInFrames: 0, delayInFrames: 0, easing: "linear", overshoot: 0, staggerInFrames: 0 },
      exit: { to: {}, durationInFrames: 0, easing: "linear" },
      loop: { type: "nenhum", amplitude: 0, speed: 0 },
    },
  }
}

test("inlineEditorCss scales font, stroke, padding and radius to the preview size", () => {
  const scale = 360 / 1080
  const css = inlineEditorCss({
    laidOut: textInsert(),
    layout: layoutOf(),
    painted: paintedStyle(),
    brandFontId: "geist",
    scale,
  })
  assert.equal(css.fontSize, 90 * scale)
  assert.equal(css.WebkitTextStroke, "2px #000000")
  assert.equal(css.padding, "4px 10px")
  assert.equal(css.borderRadius, "6.67px")
  assert.equal(css.backgroundColor, "#111111")
  assert.equal(css.textTransform, "uppercase")
  assert.ok(css.textShadow?.startsWith("0px 1.33px 2.67px"))
})

test("inlineEditorCss follows the shrink-to-fit size the canvas really drew", () => {
  const css = inlineEditorCss({
    laidOut: textInsert(),
    layout: layoutOf({ effectiveFontSize: 45 }),
    painted: paintedStyle(),
    brandFontId: "geist",
    scale: 1,
  })
  assert.equal(css.fontSize, 45)
  assert.equal(css.WebkitTextStroke, "3px #000000")
})

test("inlineEditorCss keeps a visible color when the paint color is transparent", () => {
  const painted = paintedStyle()
  painted.text.color = "transparent"
  const css = inlineEditorCss({
    laidOut: textInsert(),
    layout: layoutOf(),
    painted,
    brandFontId: "geist",
    scale: 1,
  })
  assert.equal(css.color, "#ffffff")
})

test("fallbackTextLayout keeps the editor placed when the text is empty", () => {
  const layout = fallbackTextLayout(textInsert({ text: "", x: 25, y: 40 }), "geist")
  assert.equal(layout.cx, 270)
  assert.ok(Math.abs(layout.cy - 768) < 1e-9)
  assert.equal(layout.effectiveFontSize, 90)
})

test("inlineEditorPlacement maps the play center into host pixels", () => {
  const placement = inlineEditorPlacement(
    layoutOf({ cx: 540, cy: 960, rotation: 8 }),
    { displayScale: 0.5, ox: 110, oy: 20 },
    { left: 100, top: 20 },
  )
  assert.deepEqual(placement, { centerX: 280, centerY: 480, rotation: 8 })
})

test("paintedDisplayInsert measures styled text with the preset size, position and case", () => {
  const insert = textInsert({ text: "Link aqui", fontSize: 90, x: 50, y: 50 })
  const painted = paintedStyle()
  painted.text.fontSize = 120
  painted.text.y = 35
  const display = paintedDisplayInsert({ insert, laidOut: insert, painted, brandFontId: "geist" })
  assert.equal(display.text, "LINK AQUI")
  assert.equal(display.fontSize, 120)
  assert.equal(display.y, 35)
  assert.equal(display.maxWidthPct, 80)
})

test("paintedDisplayInsert keeps the laid-out insert for legacy paint", () => {
  const insert = textInsert()
  const laidOut = textInsert({ y: 70 })
  assert.equal(paintedDisplayInsert({ insert, laidOut, painted: null, brandFontId: "geist" }), laidOut)
})

test("committedInlineText treats whitespace-only text as removal", () => {
  assert.equal(committedInlineText("   \n"), null)
  assert.equal(committedInlineText(""), null)
  assert.equal(committedInlineText(" Oi "), " Oi ")
})
